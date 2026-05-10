import type { BotInstanceRepository } from '@weclaws/db';
import { InstanceLock } from './instance-lock';
import { isProcessAlive, stopTrackedProcess } from './process-identity';
import { ProcessManager } from './process-manager';

export interface InstanceReconcilerDependencies {
  botInstances: BotInstanceRepository;
  lock: InstanceLock;
  processManager: ProcessManager;
}

export class InstanceReconciler {
  private isRunning = false;
  private readonly botInstances: BotInstanceRepository;
  private readonly lock: InstanceLock;
  private readonly processManager: ProcessManager;

  constructor(dependencies: InstanceReconcilerDependencies) {
    this.botInstances = dependencies.botInstances;
    this.lock = dependencies.lock;
    this.processManager = dependencies.processManager;
  }

  async runOnce(now: Date = new Date()) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const [runningCandidates, stopCandidates] = await Promise.all([
        this.botInstances.findReconcileCandidates(now),
        this.botInstances.findStopCandidates(),
      ]);

      for (const candidate of runningCandidates) {
        await this.lock.withLock(candidate.id, async () => {
          const latest = await this.botInstances.findById(candidate.id);

          if (!latest || latest.desiredState !== 'running' || latest.status === 'failed') {
            return;
          }

          if (latest.qrReissueRequestedAt) {
            if (this.processManager.hasInstance(latest.id)) {
              if (latest.status !== 'stopping') {
                await this.botInstances.markStopping(latest.id, {
                  heartbeatAt: now,
                });
              }

              await this.processManager.stopInstance(latest.id);
              return;
            }

            const persistedProcessHandled = await this.reconcilePersistedProcess(latest.id, latest, now);

            if (persistedProcessHandled) {
              return;
            }

            await this.processManager.clearInstanceLoginState(latest.id);

            const reissuedBot = await this.botInstances.consumeQrReissueRequest(latest.id, now);

            if (!reissuedBot) {
              return;
            }

            await this.processManager.startInstance(reissuedBot);
            return;
          }

          if (latest.restartRequestedAt) {
            await this.botInstances.consumeRestartRequest(latest.id, {
              consumedAt: now,
            });

            if (this.processManager.hasInstance(latest.id)) {
              await this.botInstances.markStopping(latest.id, {
                heartbeatAt: now,
              });
              await this.processManager.stopInstance(latest.id);
              return;
            }
          }

          if (!this.processManager.hasInstance(latest.id)) {
            const persistedProcessHandled = await this.reconcilePersistedProcess(latest.id, latest, now);

            if (persistedProcessHandled) {
              return;
            }
          }

          if (!this.processManager.hasInstance(latest.id)) {
            await this.processManager.startInstance(latest);
          }
        });
      }

      for (const candidate of stopCandidates) {
        await this.lock.withLock(candidate.id, async () => {
          const latest = await this.botInstances.findById(candidate.id);

          if (!latest || latest.desiredState !== 'stopped') {
            return;
          }

          if (!this.processManager.hasInstance(latest.id)) {
            const persistedProcessHandled = await this.reconcilePersistedProcess(latest.id, latest, now);

            if (persistedProcessHandled) {
              return;
            }
          }

          if (this.processManager.hasInstance(latest.id)) {
            await this.processManager.stopInstance(latest.id);
            return;
          }

          await this.botInstances.markStopped(latest.id, {
            observedAt: now,
          });
        });
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async reconcilePersistedProcess(
    botInstanceId: string,
    latest: {
      processPid: number | null;
      processStartedAt: Date | null;
    },
    now: Date,
  ) {
    if (latest.processPid === null) {
      return false;
    }

    if (!latest.processStartedAt) {
      if (!isProcessAlive(latest.processPid)) {
        await this.botInstances.markStopped(botInstanceId, {
          observedAt: now,
        });
        return true;
      }

      console.error(
        `Bot ${botInstanceId} still has a live processPid without processStartedAt; skipping reconcile to avoid killing an unrelated process.`,
      );
      return true;
    }

    const stopResult = await stopTrackedProcess(
      latest.processPid,
      latest.processStartedAt.toISOString(),
    );

    if (stopResult === 'failed') {
      console.error(
        `Failed to stop unmanaged FastAgent process ${latest.processPid} for ${botInstanceId}; leaving instance untouched for the next reconcile pass.`,
      );
      return true;
    }

    await this.botInstances.markStopped(botInstanceId, {
      observedAt: now,
    });
    return true;
  }
}
