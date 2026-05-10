import { join } from 'node:path';
import type {
  BotEventRepository,
  BotInstanceRepository,
  UserLlmProfileRepository,
  UserSandboxRuntimePoolRepository,
} from '@weclaws/db';
import type { ChildProcess } from 'node:child_process';
import {
  resolveManagedSkillsBundleRoot,
  syncManagedSkills,
} from '@weclaws/shared/managed-skills';
import type { SupervisorConfig } from '../config';
import { applyFastAgentEvent } from './event-applier';
import { createFastAgentEventReader } from './event-reader';
import { clearBotLoginState } from './clear-bot-login-state';
import { ProcessRegistry } from './process-registry';
import {
  spawnFastAgentProcess,
  type MockFastAgentScenario,
  type ResolvedSandboxRuntimePool,
  type SpawnableBotInstance,
} from './spawn-fastagent';
import {
  LlmProfileInvalidError,
  LlmProfileRequiredError,
  resolveFastAgentRuntimeConfig,
} from './resolve-fastagent-runtime-config';

const FASTAGENT_START_FAILED_ERROR_CODE = 'FASTAGENT_START_FAILED';
const FASTAGENT_START_FAILED_ERROR_MESSAGE = 'FastAgent runtime could not be started.';
const SRT_POOL_DISABLED_ERROR_CODE = 'SRT_POOL_DISABLED';
const SRT_POOL_DISABLED_ERROR_MESSAGE = 'Sandbox runtime pool is disabled for this user.';

export interface StartInstanceOptions {
  mockScenario?: MockFastAgentScenario;
  stepDelayMs?: number;
}

export interface ProcessManagerDependencies {
  botEvents: BotEventRepository;
  botInstances: BotInstanceRepository;
  config: SupervisorConfig;
  userLlmProfiles: UserLlmProfileRepository;
  userSandboxRuntimePools: UserSandboxRuntimePoolRepository;
  registry?: ProcessRegistry;
}

export class ProcessManager {
  private readonly botEvents: BotEventRepository;
  private readonly botInstances: BotInstanceRepository;
  private readonly config: SupervisorConfig;
  private readonly registry: ProcessRegistry;
  private readonly userLlmProfiles: UserLlmProfileRepository;
  private readonly userSandboxRuntimePools: UserSandboxRuntimePoolRepository;

  constructor(dependencies: ProcessManagerDependencies) {
    this.botEvents = dependencies.botEvents;
    this.botInstances = dependencies.botInstances;
    this.config = dependencies.config;
    this.registry = dependencies.registry ?? new ProcessRegistry();
    this.userLlmProfiles = dependencies.userLlmProfiles;
    this.userSandboxRuntimePools = dependencies.userSandboxRuntimePools;
  }

  hasInstance(botInstanceId: string) {
    return this.registry.has(botInstanceId);
  }

  async clearInstanceLoginState(botInstanceId: string) {
    await clearBotLoginState({
      botInstanceId,
      instancesRoot: this.config.instancesRoot,
    });
  }

  async startInstance(botInstance: SpawnableBotInstance, options: StartInstanceOptions = {}) {
    if (this.registry.has(botInstance.id)) {
      return false;
    }

    const runtimeConfig = await this.resolveRuntimeConfigOrFail(botInstance);

    if (!runtimeConfig) {
      return false;
    }

    const sandboxRuntimePool = await this.resolveSandboxRuntimePoolOrFail(botInstance);

    if (sandboxRuntimePool === null) {
      return false;
    }

    await this.botInstances.recordRuntimeConfigSnapshot(botInstance.id, {
      model: runtimeConfig.model,
      provider: runtimeConfig.provider,
      recordedAt: new Date(),
    });
    await this.trySyncManagedSkills(botInstance.id);

    let child: ChildProcess;

    try {
      child = await spawnFastAgentProcess({
        botInstance,
        config: this.config,
        mockScenario: options.mockScenario,
        runtimeConfig,
        sandboxRuntimePool,
        stepDelayMs: options.stepDelayMs,
      });
    } catch (error) {
      await this.handleStartInstanceFailure(botInstance.id, error);
      return false;
    }

    const entry = {
      applyChain: Promise.resolve(),
      botInstanceId: botInstance.id,
      child,
      fatalRuntimeFailureHandled: false,
    };

    const queueEvent = (event: Parameters<typeof applyFastAgentEvent>[1]['event']) => {
      entry.applyChain = entry.applyChain
        .then(async () => {
          if (
            entry.fatalRuntimeFailureHandled
            && event.type !== 'stopped'
            && event.type !== 'stopping'
          ) {
            return;
          }

          await applyFastAgentEvent(
            {
              botEvents: this.botEvents,
              botInstances: this.botInstances,
            },
            {
              botInstanceId: botInstance.id,
              event,
            },
          );
        })
        .catch((error: unknown) => {
          return this.handleFatalRuntimeFailure(
            entry,
            'FastAgent event application failed.',
            error,
          );
        });
    };

    const reader = createFastAgentEventReader({
      onEvent: queueEvent,
      onInvalidLine: ({ error, line }) => {
        console.error(`Invalid FastAgent line for ${botInstance.id}: ${line}`);
        entry.applyChain = entry.applyChain
          .then(() => this.handleFatalRuntimeFailure(
            entry,
            'FastAgent emitted invalid JSONL output.',
            error,
          ))
          .catch((chainError: unknown) => {
            console.error(chainError);
            return this.handleFatalRuntimeFailure(
              entry,
              'FastAgent emitted invalid JSONL output.',
              error,
            );
          });
      },
    });

    this.attachProcessListeners(botInstance.id, child, entry, reader);
    this.registry.add(entry);

    return true;
  }

  async stopInstance(botInstanceId: string) {
    const entry = this.registry.get(botInstanceId);

    if (!entry) {
      return false;
    }

    if (entry.child.exitCode !== null || entry.child.killed) {
      this.registry.delete(botInstanceId);
      return false;
    }

    entry.child.kill('SIGTERM');
    return true;
  }

  async dispose() {
    const activeEntries = this.registry.values();

    for (const entry of activeEntries) {
      entry.child.removeAllListeners();
      entry.child.stdout?.removeAllListeners();
      entry.child.stderr?.removeAllListeners();

      if (entry.child.exitCode === null && !entry.child.killed) {
        entry.child.kill('SIGKILL');
      }

      this.registry.delete(entry.botInstanceId);
    }
  }

  private attachProcessListeners(
    botInstanceId: string,
    child: ChildProcess,
    entry: { applyChain: Promise<void>; botInstanceId: string; child: ChildProcess },
    reader: ReturnType<typeof createFastAgentEventReader>,
  ) {
    child.stdout?.on('data', (chunk: Buffer | string) => {
      reader.push(chunk);
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      console.error(`FastAgent stderr [${botInstanceId}]: ${chunk.toString().trim()}`);
    });

    child.on('exit', () => {
      reader.flush();
      this.releaseEntryWhenApplied(entry);
    });

    child.on('error', (error) => {
      console.error(`FastAgent child error [${botInstanceId}]`);
      console.error(error);
      this.releaseEntryWhenApplied(entry);
    });
  }

  private releaseEntryWhenApplied(entry: { applyChain: Promise<void>; botInstanceId: string }) {
    void entry.applyChain.finally(() => {
      this.registry.delete(entry.botInstanceId);
    });
  }

  private async handleFatalRuntimeFailure(
    entry: {
      applyChain: Promise<void>;
      botInstanceId: string;
      child: ChildProcess;
      fatalRuntimeFailureHandled: boolean;
    },
    message: string,
    error: unknown,
  ) {
    if (entry.fatalRuntimeFailureHandled) {
      return;
    }

    entry.fatalRuntimeFailureHandled = true;
    console.error(`${message} [${entry.botInstanceId}]`);
    console.error(error);

    try {
      await this.botInstances.recordRuntimeError(entry.botInstanceId, {
        errorCode: 'RUNTIME_ERROR',
        errorMessage: message,
        observedAt: new Date(),
      });
    } catch (recordError) {
      console.error(`Failed to persist runtime error for ${entry.botInstanceId}`);
      console.error(recordError);
    }

    if (entry.child.exitCode === null && !entry.child.killed) {
      entry.child.kill('SIGTERM');
    }
  }

  private async trySyncManagedSkills(botInstanceId: string) {
    try {
      const result = await syncManagedSkills({
        botInstanceId,
        bundleRoot: resolveManagedSkillsBundleRoot(this.config.workspaceRoot),
        instancesRoot: this.config.instancesRoot,
        operation: {
          type: 'sync-all-managed',
        },
      });

      if (result.status === 'busy') {
        console.warn(`Managed skills sync already in progress for ${botInstanceId}. Skipping this attempt.`);
        return;
      }

      if (result.status === 'error') {
        console.error(`Managed skills sync failed for ${botInstanceId}. Continuing startup.`);

        for (const error of result.errors) {
          console.error(error);
        }
      }
    } catch (error) {
      console.error(`Managed skills sync threw for ${botInstanceId}. Continuing startup.`);
      console.error(error);
    }
  }

  private async handleStartInstanceFailure(botInstanceId: string, error: unknown) {
    console.error(`FastAgent startup failed [${botInstanceId}]`);
    console.error(error);

    await this.botInstances.markFailed(botInstanceId, {
      errorCode: FASTAGENT_START_FAILED_ERROR_CODE,
      errorMessage: FASTAGENT_START_FAILED_ERROR_MESSAGE,
      failedAt: new Date(),
      restartCount: 0,
    });
  }

  private async resolveRuntimeConfigOrFail(botInstance: SpawnableBotInstance) {
    try {
      return await resolveFastAgentRuntimeConfig({
        botInstance,
        userLlmProfiles: this.userLlmProfiles,
      });
    } catch (error) {
      if (!(error instanceof LlmProfileRequiredError) && !(error instanceof LlmProfileInvalidError)) {
        throw error;
      }

      await this.botInstances.markFailed(botInstance.id, {
        errorCode: error.code,
        errorMessage: error.message,
        failedAt: new Date(),
        restartCount: 0,
      });

      return null;
    }
  }

  private async resolveSandboxRuntimePoolOrFail(
    botInstance: SpawnableBotInstance,
  ): Promise<ResolvedSandboxRuntimePool | null | undefined> {
    if (this.config.sandboxMode === 'disabled') {
      return undefined;
    }

    if (!this.config.srtPoolDefaults || !this.config.srtServiceHost || !this.config.srtWorkspaceMapDir) {
      throw new Error('Remote sandbox mode requires SRT pool defaults, service host, and workspace map directory.');
    }

    const pool = await this.userSandboxRuntimePools.ensureForUser({
      defaults: this.config.srtPoolDefaults,
      ownerUserId: botInstance.ownerUserId,
    });

    if (!pool.enabled) {
      await this.botInstances.markFailed(botInstance.id, {
        errorCode: SRT_POOL_DISABLED_ERROR_CODE,
        errorMessage: SRT_POOL_DISABLED_ERROR_MESSAGE,
        failedAt: new Date(),
        restartCount: 0,
      });

      return null;
    }

    return {
      apiKey: pool.apiKey,
      url: `http://${this.config.srtServiceHost}:${pool.port}`,
      workspaceMapFile: join(this.config.srtWorkspaceMapDir, `${pool.ownerUserId}.json`),
    };
  }
}
