import { constants as fsConstants } from 'node:fs';
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  BotEventRepository,
  BotInstanceRepository,
  UserLlmProfileRepository,
  UserSandboxRuntimePoolRepository,
  UserRepository,
  WorkspaceRepository,
  createDatabaseClient,
  migrateDatabase,
} from '@weclaws/db';
import { parseSandboxRuntimePoolDefaults, resolveBotInstancePaths } from '@weclaws/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { SupervisorConfig } from '../../config';
import { InstanceLock } from '../instance-lock';
import { InstanceReconciler } from '../instance-reconciler';
import { ProcessManager } from '../process-manager';
import {
  createScriptedFastAgentBinary,
  RESTORED_ACCOUNT_ID,
  type ScriptedFastAgentScenario,
} from './scripted-fastagent';

const tempDirs: string[] = [];
const tempChildren: Array<ReturnType<typeof spawn>> = [];
const require = createRequire(import.meta.url);
const TSX_IMPORT_PATH = require.resolve('tsx');
const execFile = promisify(execFileCallback);

afterEach(async () => {
  await Promise.all(tempChildren.splice(0).map(async (child) => {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGKILL');
    }
  }));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('InstanceReconciler', () => {
  it('starts running candidates, stops stopped candidates, and consumes restart requests', async () => {
    const { botInstances, processManager, reconciler } = await createReconcilerHarness();

    await reconciler.runOnce();

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'running';
    }, 10_000);

    await botInstances.requestRestart('bot_1', new Date('2026-03-30T00:00:30.000Z'));
    await reconciler.runOnce();

    const restartingBot = await botInstances.findById('bot_1');
    expect(restartingBot).toMatchObject({
      restartRequestedAt: null,
      status: 'stopping',
    });

    await waitFor(async () => {
      await reconciler.runOnce();
      const current = await botInstances.findById('bot_1');
      return current?.status === 'running' && processManager.hasInstance('bot_1');
    }, 10_000);

    await botInstances.setDesiredState('bot_1', 'stopped');
    await reconciler.runOnce();

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'stopped' && !processManager.hasInstance('bot_1');
    }, 10_000);

    await processManager.dispose();
  }, 10_000);

  it('waits for restart backoff before starting a crashed instance again', async () => {
    const { botInstances, processManager, reconciler } = await createReconcilerHarness();

    await botInstances.scheduleRestart('bot_1', {
      observedAt: new Date('2026-03-30T00:00:00.000Z'),
      restartBackoffUntil: new Date('2026-03-30T00:00:10.000Z'),
      restartCount: 1,
    });

    await reconciler.runOnce(new Date('2026-03-30T00:00:05.000Z'));
    expect(processManager.hasInstance('bot_1')).toBe(false);

    await reconciler.runOnce(new Date('2026-03-30T00:00:11.000Z'));

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'running' && processManager.hasInstance('bot_1');
    });

    await processManager.dispose();
  });

  it('marks desired stopped instances as stopped when no child process is present', async () => {
    const { botInstances, reconciler } = await createReconcilerHarness();

    await botInstances.markRunning('bot_1', {
      heartbeatAt: new Date('2026-03-30T00:00:00.000Z'),
    });
    await botInstances.markStarting('bot_1', {
      heartbeatAt: new Date('2026-03-30T00:00:00.000Z'),
      processPid: 120,
      processStartedAt: new Date('2026-03-30T00:00:00.000Z'),
    });
    await botInstances.setDesiredState('bot_1', 'stopped');

    await reconciler.runOnce(new Date('2026-03-30T00:00:05.000Z'));

    const bot = await botInstances.findById('bot_1');

    expect(bot).toMatchObject({
      desiredState: 'stopped',
      processPid: null,
      processStartedAt: null,
      status: 'stopped',
    });
  });

  it('converges provisioning instances directly to stopped when they are stopped before first start', async () => {
    const { botInstances, reconciler } = await createReconcilerHarness();

    await botInstances.setDesiredState('bot_1', 'stopped');

    await reconciler.runOnce(new Date('2026-03-30T00:00:05.000Z'));

    const bot = await botInstances.findById('bot_1');

    expect(bot).toMatchObject({
      desiredState: 'stopped',
      processPid: null,
      processStartedAt: null,
      status: 'stopped',
    });
  });

  it('restores desired running instances directly into running without qr flow after supervisor restart', async () => {
    const { botInstances, processManager, reconciler } = await createReconcilerHarness({
      binaryScenario: 'restored_happy',
    });

    await botInstances.markStopped('bot_1', {
      observedAt: new Date('2026-03-30T00:00:00.000Z'),
    });

    await reconciler.runOnce(new Date('2026-03-30T00:00:05.000Z'));

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'running' && processManager.hasInstance('bot_1');
    });

    const restoredBot = await botInstances.findById('bot_1');

    expect(restoredBot).toMatchObject({
      lastQrCodeUrl: null,
      restartCount: 0,
      status: 'running',
      weixinAccountId: RESTORED_ACCOUNT_ID,
    });

    await processManager.dispose();
  });

  it('enters failed after four startup crash loops and stops restarting', async () => {
    const { botInstances, processManager, reconciler } = await createReconcilerHarness({
      binaryScenario: 'startup_crash',
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await reconciler.runOnce(new Date(`2099-03-30T00:0${attempt}:30.000Z`));

      await waitFor(async () => {
        const current = await botInstances.findById('bot_1');

        if (attempt === 3) {
          return current?.status === 'failed' && current.restartCount === 4 && !processManager.hasInstance('bot_1');
        }

        return current?.status === 'stopped' && current.restartCount === attempt + 1 && !processManager.hasInstance('bot_1');
      });
    }

    await reconciler.runOnce(new Date('2099-03-30T00:10:00.000Z'));

    const failedBot = await botInstances.findById('bot_1');

    expect(failedBot).toMatchObject({
      lastErrorCode: 'RUNTIME_ERROR',
      restartBackoffUntil: null,
      restartCount: 4,
      status: 'failed',
      weixinAccountId: null,
    });
    expect(processManager.hasInstance('bot_1')).toBe(false);

    await processManager.dispose();
  }, 15_000);

  it('restarts failed bots after a restart request re-queues them for reconcile', async () => {
    const { botInstances, processManager, reconciler } = await createReconcilerHarness();

    await botInstances.markFailed('bot_1', {
      errorCode: 'LLM_PROFILE_REQUIRED',
      errorMessage: 'Bot LLM profile is required.',
      failedAt: new Date('2026-03-30T00:00:00.000Z'),
      restartCount: 0,
    });
    await botInstances.requestRestart('bot_1', new Date('2026-03-30T00:00:10.000Z'));

    await reconciler.runOnce(new Date('2026-03-30T00:00:11.000Z'));

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'running' && processManager.hasInstance('bot_1');
    });

    await processManager.dispose();
  });

  it('stops a logged-in runtime, clears FastAgent login state, and re-enters qr wait on qr reissue', async () => {
    const { botInstances, config, processManager, reconciler } = await createReconcilerHarness({
      binaryScenario: 'stateful_restore_or_qr',
    });
    const instancePaths = resolveBotInstancePaths(config.instancesRoot, 'bot_1');
    const requestedAt = new Date('2026-03-30T00:00:10.000Z');

    await seedLoginStateFiles(instancePaths.dataDir);
    await reconciler.runOnce(new Date('2026-03-30T00:00:00.000Z'));

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'running'
        && current.weixinAccountId === RESTORED_ACCOUNT_ID
        && processManager.hasInstance('bot_1');
    });

    await botInstances.requestQrReissue('bot_1', requestedAt);
    await reconciler.runOnce(new Date('2026-03-30T00:00:11.000Z'));

    const stoppingBot = await botInstances.findById('bot_1');
    expect(stoppingBot).toMatchObject({
      qrReissueRequestedAt: requestedAt,
      status: 'stopping',
      weixinAccountId: RESTORED_ACCOUNT_ID,
    });

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'stopped' && !processManager.hasInstance('bot_1');
    });

    await expectLoginStatePresent(instancePaths.dataDir);

    await reconciler.runOnce(new Date('2026-03-30T00:00:12.000Z'));

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'waiting_for_qr'
        && current.qrReissueRequestedAt === null
        && current.weixinAccountId === null
        && typeof current.lastQrCodeUrl === 'string'
        && processManager.hasInstance('bot_1');
    });

    const qrBot = await botInstances.findById('bot_1');
    expect(qrBot).toMatchObject({
      qrReissueRequestedAt: null,
      status: 'waiting_for_qr',
      weixinAccountId: null,
    });
    await expectLoginStateMissing(instancePaths.dataDir);

    await processManager.dispose();
  }, 15_000);

  it('terminates orphaned live processes before restarting desired running instances after supervisor loss', async () => {
    const {
      botInstances,
      config,
      processManager,
      reconciler,
    } = await createReconcilerHarness({
      binaryScenario: 'restored_happy',
    });

    const orphan = await spawnOrphanedFastAgent(config, 'bot_1');
    const orphanStartedAt = await getProcessStartedAt(orphan.pid!);

    await botInstances.markStarting('bot_1', {
      heartbeatAt: new Date('2026-03-30T00:00:00.000Z'),
      processPid: orphan.pid!,
      processStartedAt: new Date(orphanStartedAt),
    });
    await botInstances.markRunning('bot_1', {
      heartbeatAt: new Date('2026-03-30T00:00:01.000Z'),
      weixinAccountId: RESTORED_ACCOUNT_ID,
    });

    await reconciler.runOnce(new Date('2026-03-30T00:00:05.000Z'));
    await waitForChildExit(orphan);

    const stoppedBot = await botInstances.findById('bot_1');
    expect(stoppedBot).toMatchObject({
      processPid: null,
      status: 'stopped',
    });
    expect(processManager.hasInstance('bot_1')).toBe(false);

    await reconciler.runOnce(new Date('2026-03-30T00:00:06.000Z'));

    await waitFor(async () => {
      const current = await botInstances.findById('bot_1');
      return current?.status === 'running'
        && current.processPid !== null
        && current.processPid !== orphan.pid
        && processManager.hasInstance('bot_1');
    });

    await processManager.dispose();
  }, 15_000);

  it('terminates orphaned live processes before converging desired stopped instances to stopped', async () => {
    const {
      botInstances,
      config,
      reconciler,
    } = await createReconcilerHarness({
      binaryScenario: 'restored_happy',
    });

    const orphan = await spawnOrphanedFastAgent(config, 'bot_1');
    const orphanStartedAt = await getProcessStartedAt(orphan.pid!);

    await botInstances.markStarting('bot_1', {
      heartbeatAt: new Date('2026-03-30T00:00:00.000Z'),
      processPid: orphan.pid!,
      processStartedAt: new Date(orphanStartedAt),
    });
    await botInstances.markRunning('bot_1', {
      heartbeatAt: new Date('2026-03-30T00:00:01.000Z'),
      weixinAccountId: RESTORED_ACCOUNT_ID,
    });
    await botInstances.setDesiredState('bot_1', 'stopped');

    await reconciler.runOnce(new Date('2026-03-30T00:00:05.000Z'));
    await waitForChildExit(orphan);

    const stoppedBot = await botInstances.findById('bot_1');
    expect(stoppedBot).toMatchObject({
      desiredState: 'stopped',
      processPid: null,
      status: 'stopped',
    });
  }, 15_000);
});

async function createReconcilerHarness(input: {
  binaryScenario?: ScriptedFastAgentScenario;
} = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-reconciler-'));
  tempDirs.push(dir);

  const client = createDatabaseClient({
    url: `file:${join(dir, 'test.sqlite')}`,
  });
  migrateDatabase(client);

  const users = new UserRepository(client.db);
  const userLlmProfiles = new UserLlmProfileRepository(client.db);
  const userSandboxRuntimePools = new UserSandboxRuntimePoolRepository(client.db);
  const workspaces = new WorkspaceRepository(client.db);
  const botInstances = new BotInstanceRepository(client.db);
  const botEvents = new BotEventRepository(client.db);

  await users.create({
    email: 'zac@example.com',
    id: 'user_1',
    name: 'zac',
  });

  const instancesRoot = join(dir, 'instances');
  const instancePaths = resolveBotInstancePaths(instancesRoot, 'bot_1');
  const fastagentBinaryPath = input.binaryScenario
    ? await createScriptedFastAgentBinary(dir, input.binaryScenario)
    : join(dir, 'fastagent');

  await Promise.all([
    mkdir(instancePaths.workspaceDir, { recursive: true }),
    mkdir(instancePaths.dataDir, { recursive: true }),
    mkdir(instancePaths.logDir, { recursive: true }),
  ]);
  await writeManagedBundleFixture(dir);
  if (!input.binaryScenario) {
    await writeFile(
      fastagentBinaryPath,
      `#!/bin/sh\nexec "${process.execPath}" --import "${TSX_IMPORT_PATH}" "${fileURLToPath(
        new URL('../../../../../tests/fixtures/mock-fastagent.ts', import.meta.url),
      )}" "$@"\n`,
    );
    await chmod(fastagentBinaryPath, 0o755);
    await access(fastagentBinaryPath, fsConstants.X_OK);
  }

  await workspaces.create({
    id: 'ws_1',
    name: 'Workspace',
    ownerUserId: 'user_1',
  });

  await userLlmProfiles.create({
    apiKey: 'sk-test',
    apiType: null,
    baseUrl: null,
    id: 'profile_1',
    model: 'claude-opus-4-6',
    name: 'Primary Anthropic',
    provider: 'anthropic',
    userId: 'user_1',
  });

  await botInstances.create({
    id: 'bot_1',
    llmConfigId: 'profile_1',
    model: 'claude-opus-4-6',
    name: 'Bot One',
    ownerUserId: 'user_1',
    provider: 'anthropic',
    desiredState: 'running',
    status: 'provisioning',
    workspaceId: 'ws_1',
  });

  const config: SupervisorConfig = {
    databaseUrl: `file:${join(dir, 'test.sqlite')}`,
    fastagentBinaryPath,
    instancesRoot,
    mockFastAgentFixturePath: fileURLToPath(
      new URL('../../../../../tests/fixtures/mock-fastagent.ts', import.meta.url),
    ),
    reconcileIntervalMs: 50,
    sandboxMode: 'remote',
    sandboxApiKey: null,
    sandboxUrl: null,
    srtPoolConfigFile: join(instancesRoot, '.sandbox-runtime', 'srt-pools.json'),
    srtPoolDefaults: parseSandboxRuntimePoolDefaults({}),
    srtPoolStatusFile: join(instancesRoot, '.sandbox-runtime', 'srt-pool-status.json'),
    srtServiceHost: 'sandbox-runtime',
    srtWorkspaceMapDir: join(instancesRoot, '.sandbox-runtime', 'workspace-map'),
    workspaceRoot: dir,
  };

  const processManager = new ProcessManager({
    botEvents,
    botInstances,
    config,
    userSandboxRuntimePools,
    userLlmProfiles,
  });

  return {
    botInstances,
    config,
    processManager,
    reconciler: new InstanceReconciler({
      botInstances,
      lock: new InstanceLock(),
      processManager,
    }),
  };
}

async function writeManagedBundleFixture(workspaceRoot: string) {
  const bundleRoot = join(workspaceRoot, 'resources', 'skills', 'managed');
  await mkdir(bundleRoot, { recursive: true });
  await writeFile(join(bundleRoot, 'manifest.json'), JSON.stringify({
    skills: [],
    version: 'bundle-v0',
  }, null, 2));
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number = 5_000) {
  const start = Date.now();

  while (Date.now() - start <= timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }

  throw new Error('Timed out waiting for condition.');
}

async function seedLoginStateFiles(dataDir: string) {
  await Promise.all([
    writeFile(join(dataDir, 'accounts-roster.jsonl'), '{"accountId":"restored_acc_1"}\n'),
    writeFile(join(dataDir, 'accounts-runtime.jsonl'), '{"accountId":"restored_acc_1"}\n'),
    writeFile(join(dataDir, 'bindings.jsonl'), '{"peerId":"wx_user_1"}\n'),
  ]);
}

async function expectLoginStatePresent(dataDir: string) {
  await Promise.all([
    access(join(dataDir, 'accounts-roster.jsonl')),
    access(join(dataDir, 'accounts-runtime.jsonl')),
    access(join(dataDir, 'bindings.jsonl')),
  ]);
}

async function expectLoginStateMissing(dataDir: string) {
  await expect(access(join(dataDir, 'accounts-roster.jsonl'))).rejects.toThrow();
  await expect(access(join(dataDir, 'accounts-runtime.jsonl'))).rejects.toThrow();
  await expect(access(join(dataDir, 'bindings.jsonl'))).rejects.toThrow();
}

async function spawnOrphanedFastAgent(config: SupervisorConfig, botInstanceId: string) {
  const instancePaths = resolveBotInstancePaths(config.instancesRoot, botInstanceId);
  const child = spawn(
    config.fastagentBinaryPath,
    ['--channel', 'weixin', '--sandbox', 'remote', '--sandbox-url', 'http://localhost:8788', '--output', 'jsonl'],
    {
      cwd: instancePaths.workspaceDir,
      env: {
        FASTAGENT_API_KEY: 'test-fastagent-key',
        FASTAGENT_MODEL: 'claude-opus-4-6',
        FASTAGENT_PROVIDER: 'anthropic',
        PATH: process.env.PATH,
        IM_GATEWAY_AGENT_ID: botInstanceId,
        IM_GATEWAY_ALLOW_ALL_PERMISSIONS: 'true',
        IM_GATEWAY_DATA_DIR: instancePaths.dataDir,
        IM_GATEWAY_WORKSPACE_DIR: instancePaths.workspaceDir,
        SANDBOX_API_KEY: config.sandboxApiKey ?? 'sandbox-key',
        SANDBOX_URL: config.sandboxUrl ?? 'http://localhost:8788',
      },
      stdio: 'ignore',
    },
  );

  tempChildren.push(child);
  await waitFor(async () => child.pid !== undefined && child.exitCode === null);

  return child;
}

async function getProcessStartedAt(pid: number) {
  const { stdout } = await execFile('ps', ['-p', String(pid), '-o', 'lstart=']);
  const startedAt = new Date(stdout.trim().replace(/\s+/g, ' '));

  return startedAt.toISOString();
}

async function waitForChildExit(child: ReturnType<typeof spawn>, timeoutMs: number = 5_000) {
  const start = Date.now();

  while (Date.now() - start <= timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null || child.killed) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }

  throw new Error(`Timed out waiting for child pid ${child.pid} to exit.`);
}
