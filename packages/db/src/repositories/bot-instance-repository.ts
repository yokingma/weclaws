import type { BotDesiredState, BotStatus } from '@weclaws/shared';
import { and, asc, count, eq, isNull, lte, ne, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { botInstances } from '../schema/bot-instances';
import type * as schema from '../schema/index';

type Db = BetterSQLite3Database<typeof schema>;
type BotInstanceUpdateValues = Partial<typeof botInstances.$inferInsert>;

export interface CreateBotInstanceInput {
  id: string;
  ownerUserId: string;
  workspaceId: string;
  name: string;
  provider: string;
  model: string;
  llmConfigId?: string | null;
  desiredState: BotDesiredState;
  status: BotStatus;
}

export interface MarkStartingInput {
  heartbeatAt: Date;
  processPid: number;
  processStartedAt: Date;
}

export interface RecordQrCodeInput {
  observedAt: Date;
  qrCodeId: string;
  qrCodeUrl: string;
}

export interface RecordLoginConfirmedInput {
  observedAt: Date;
  weixinAccountId: string;
}

export interface MarkRunningInput {
  heartbeatAt: Date;
  weixinAccountId?: string | null;
}

export interface MarkDegradedInput {
  heartbeatAt: Date;
}

export interface RecordRuntimeErrorInput {
  errorCode: string;
  errorMessage: string;
  observedAt: Date;
}

export interface MarkStoppingInput {
  heartbeatAt: Date;
}

export interface MarkStoppedInput {
  observedAt: Date;
}

export interface ScheduleRestartInput {
  observedAt: Date;
  restartBackoffUntil: Date;
  restartCount: number;
}

export interface ConsumeRestartRequestInput {
  consumedAt: Date;
}

export interface RecordRuntimeConfigSnapshotInput {
  model: string;
  provider: string;
  recordedAt: Date;
}

export interface MarkFailedInput {
  errorCode: string;
  errorMessage: string;
  failedAt: Date;
  restartCount: number;
}

export class BotInstanceRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateBotInstanceInput) {
    const now = new Date();

    this.db.insert(botInstances).values({
      ...input,
      createdAt: now,
      updatedAt: now,
      restartCount: 0,
    }).run();

    return this.findById(input.id);
  }

  async findById(id: string) {
    const row = this.db.select().from(botInstances).where(eq(botInstances.id, id)).get();
    return row ?? null;
  }

  async findByIdForOwner(id: string, ownerUserId: string) {
    const row = this.db.select()
      .from(botInstances)
      .where(and(eq(botInstances.id, id), eq(botInstances.ownerUserId, ownerUserId)))
      .get();

    return row ?? null;
  }

  async listByOwnerUserId(ownerUserId: string) {
    return this.db.select()
      .from(botInstances)
      .where(eq(botInstances.ownerUserId, ownerUserId))
      .orderBy(asc(botInstances.createdAt), asc(botInstances.id))
      .all();
  }

  async listByOwnerUserIdAndLlmConfigId(ownerUserId: string, llmConfigId: string) {
    return this.db.select()
      .from(botInstances)
      .where(and(eq(botInstances.ownerUserId, ownerUserId), eq(botInstances.llmConfigId, llmConfigId)))
      .orderBy(asc(botInstances.createdAt), asc(botInstances.id))
      .all();
  }

  async countByOwnerUserId(ownerUserId: string) {
    const row = this.db.select({ count: count() })
      .from(botInstances)
      .where(eq(botInstances.ownerUserId, ownerUserId))
      .get();

    return row?.count ?? 0;
  }

  async setDesiredState(id: string, desiredState: BotDesiredState) {
    const now = new Date();
    this.db.update(botInstances)
      .set({ desiredState, updatedAt: now })
      .where(eq(botInstances.id, id))
      .run();
    return this.findById(id);
  }

  async markStatus(id: string, status: BotStatus) {
    const now = new Date();
    return this.updateById(id, { status, updatedAt: now });
  }

  async recordProcessStart(id: string, processPid: number, processStartedAt: Date = new Date()) {
    return this.updateById(id, {
      processPid,
      processStartedAt,
      updatedAt: processStartedAt,
    });
  }

  async recordHeartbeat(id: string, heartbeatAt: Date = new Date()) {
    return this.updateById(id, {
      heartbeatAt,
      updatedAt: heartbeatAt,
    });
  }

  async requestRestart(id: string, requestedAt: Date = new Date()) {
    const current = await this.findById(id);

    if (!current) {
      return null;
    }

    return this.updateById(id, {
      desiredState: 'running',
      qrReissueRequestedAt: null,
      restartBackoffUntil: null,
      restartRequestedAt: requestedAt,
      ...(current.status === 'failed'
        ? {
          status: 'stopped' as const,
        }
        : {}),
      updatedAt: requestedAt,
    });
  }

  async updateLlmConfigBinding(id: string, ownerUserId: string, llmConfigId: string, updatedAt: Date = new Date()) {
    this.db.update(botInstances)
      .set({
        llmConfigId,
        updatedAt,
      })
      .where(and(eq(botInstances.id, id), eq(botInstances.ownerUserId, ownerUserId)))
      .run();

    return this.findByIdForOwner(id, ownerUserId);
  }

  async updateNameForOwner(id: string, ownerUserId: string, name: string, updatedAt: Date = new Date()) {
    this.db.update(botInstances)
      .set({
        name,
        updatedAt,
      })
      .where(and(eq(botInstances.id, id), eq(botInstances.ownerUserId, ownerUserId)))
      .run();

    return this.findByIdForOwner(id, ownerUserId);
  }

  async requestQrReissue(id: string, requestedAt: Date = new Date()) {
    const current = await this.findById(id);

    if (!current) {
      return null;
    }

    return this.updateById(id, {
      desiredState: 'running',
      qrReissueRequestedAt: requestedAt,
      restartBackoffUntil: null,
      restartRequestedAt: null,
      ...(current.status === 'failed'
        ? {
          status: 'stopped' as const,
        }
        : {}),
      updatedAt: requestedAt,
    });
  }

  async findReconcileCandidates(now: Date = new Date()) {
    return this.db.select().from(botInstances).where(
      and(
        eq(botInstances.desiredState, 'running'),
        ne(botInstances.status, 'failed'),
        or(
          isNull(botInstances.restartBackoffUntil),
          lte(botInstances.restartBackoffUntil, now),
        ),
      ),
    ).all();
  }

  async findStopCandidates() {
    return this.db.select().from(botInstances).where(
      and(
        eq(botInstances.desiredState, 'stopped'),
        or(
          eq(botInstances.status, 'provisioning'),
          eq(botInstances.status, 'starting'),
          eq(botInstances.status, 'waiting_for_qr'),
          eq(botInstances.status, 'running'),
          eq(botInstances.status, 'degraded'),
          eq(botInstances.status, 'stopping'),
        ),
      ),
    ).all();
  }

  async markStarting(id: string, input: MarkStartingInput) {
    return this.updateById(id, {
      heartbeatAt: input.heartbeatAt,
      processPid: input.processPid,
      processStartedAt: input.processStartedAt,
      status: 'starting',
      updatedAt: input.heartbeatAt,
    });
  }

  async recordQrCode(id: string, input: RecordQrCodeInput) {
    return this.updateById(id, {
      heartbeatAt: input.observedAt,
      lastQrCodeId: input.qrCodeId,
      lastQrCodeUrl: input.qrCodeUrl,
      status: 'waiting_for_qr',
      updatedAt: input.observedAt,
    });
  }

  async recordLoginConfirmed(id: string, input: RecordLoginConfirmedInput) {
    return this.updateById(id, {
      heartbeatAt: input.observedAt,
      weixinAccountId: input.weixinAccountId,
      updatedAt: input.observedAt,
    });
  }

  async markRunning(id: string, input: MarkRunningInput) {
    return this.updateById(id, {
      heartbeatAt: input.heartbeatAt,
      lastErrorCode: null,
      lastErrorMessage: null,
      restartBackoffUntil: null,
      restartCount: 0,
      status: 'running',
      updatedAt: input.heartbeatAt,
      ...(input.weixinAccountId ? { weixinAccountId: input.weixinAccountId } : {}),
    });
  }

  async markDegraded(id: string, input: MarkDegradedInput) {
    return this.updateById(id, {
      heartbeatAt: input.heartbeatAt,
      status: 'degraded',
      updatedAt: input.heartbeatAt,
    });
  }

  async recordRuntimeError(id: string, input: RecordRuntimeErrorInput) {
    return this.updateById(id, {
      heartbeatAt: input.observedAt,
      lastErrorCode: input.errorCode,
      lastErrorMessage: input.errorMessage,
      updatedAt: input.observedAt,
    });
  }

  async markStopping(id: string, input: MarkStoppingInput) {
    return this.updateById(id, {
      heartbeatAt: input.heartbeatAt,
      status: 'stopping',
      updatedAt: input.heartbeatAt,
    });
  }

  async markStopped(id: string, input: MarkStoppedInput) {
    return this.updateById(id, {
      heartbeatAt: input.observedAt,
      processPid: null,
      processStartedAt: null,
      status: 'stopped',
      updatedAt: input.observedAt,
    });
  }

  async scheduleRestart(id: string, input: ScheduleRestartInput) {
    return this.updateById(id, {
      heartbeatAt: input.observedAt,
      processPid: null,
      processStartedAt: null,
      restartBackoffUntil: input.restartBackoffUntil,
      restartCount: input.restartCount,
      status: 'stopped',
      updatedAt: input.observedAt,
    });
  }

  async consumeRestartRequest(id: string, input: ConsumeRestartRequestInput) {
    return this.updateById(id, {
      restartRequestedAt: null,
      updatedAt: input.consumedAt,
    });
  }

  async consumeQrReissueRequest(id: string, consumedAt: Date = new Date()) {
    return this.updateById(id, {
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      qrReissueRequestedAt: null,
      updatedAt: consumedAt,
      weixinAccountId: null,
    });
  }

  async recordRuntimeConfigSnapshot(id: string, input: RecordRuntimeConfigSnapshotInput) {
    return this.updateById(id, {
      model: input.model,
      provider: input.provider,
      updatedAt: input.recordedAt,
    });
  }

  async markFailed(id: string, input: MarkFailedInput) {
    return this.updateById(id, {
      heartbeatAt: input.failedAt,
      lastErrorCode: input.errorCode,
      lastErrorMessage: input.errorMessage,
      processPid: null,
      processStartedAt: null,
      restartBackoffUntil: null,
      restartCount: input.restartCount,
      restartRequestedAt: null,
      status: 'failed',
      updatedAt: input.failedAt,
    });
  }

  private updateById(id: string, values: BotInstanceUpdateValues) {
    this.db.update(botInstances)
      .set(values)
      .where(eq(botInstances.id, id))
      .run();

    return this.findById(id);
  }
}
