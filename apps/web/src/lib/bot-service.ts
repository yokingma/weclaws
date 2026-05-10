import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import {
  botInstances as botInstancesTable,
  workspaces,
  type BotEventCursor as BotEventCursorRecord,
} from '@weclaws/db';
import { resolveBotInstancePaths, type BotDesiredState, type BotStatus } from '@weclaws/shared';
import { ApiError } from './api-error';
import { getUserBotLimit, resolveInstancesRoot } from './env';
import { getDatabaseClient, getRepositories } from './repositories';

export interface BotSummaryItem {
  id: string;
  name: string;
  provider: string;
  model: string;
  workspaceId: string;
  desiredState: BotDesiredState;
  status: BotStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BotDetailItem extends BotSummaryItem {
  llmConfigId: string | null;
  llmProfileName: string | null;
  processPid: number | null;
  processStartedAt: string | null;
  heartbeatAt: string | null;
  restartRequestedAt: string | null;
  qrReissueRequestedAt: string | null;
  lastQrCodeId: string | null;
  lastQrCodeUrl: string | null;
  weixinAccountId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export interface BotEventItem {
  rowId: number;
  id: string;
  botInstanceId: string;
  type: string;
  message: string;
  payloadJson: Record<string, unknown>;
  createdAt: string;
}

export interface BotEventCursor {
  rowId: number;
}

export interface CreateBotInput {
  ownerUserId: string;
  name: string;
  llmProfileId: string;
}

export interface DeleteBotResult {
  id: string;
}

export interface BotCreationQuota {
  isAtLimit: boolean;
  limit: number | null;
  remainingCount: number | null;
  usedCount: number;
}

export interface UpdateBotLlmProfileInput {
  botId: string;
  ownerUserId: string;
  llmProfileId: string;
}

export interface UpdateBotNameInput {
  botId: string;
  ownerUserId: string;
  name: string;
}

export async function listBots(ownerUserId: string): Promise<BotSummaryItem[]> {
  const rows = await getRepositories().botInstances.listByOwnerUserId(ownerUserId);
  return rows.map(toBotSummaryItem);
}

export async function getBotDetail(botId: string): Promise<BotDetailItem> {
  const bot = await getRepositories().botInstances.findById(botId);

  if (!bot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  }

  return hydrateBotDetail(bot);
}

export async function listBotEvents(botId: string): Promise<BotEventItem[]> {
  const events = await getRepositories().botEvents.listByBotInstanceId(botId);
  return events.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function listBotEventsAfterCursor(
  botId: string,
  cursor: BotEventCursor | null,
): Promise<BotEventItem[]> {
  const nextCursor: BotEventCursorRecord | null = cursor
    ? {
      rowId: cursor.rowId,
    }
    : null;
  const events = await getRepositories().botEvents.listByBotInstanceIdAfterCursor(botId, nextCursor);

  return events.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function createBot(input: CreateBotInput): Promise<BotDetailItem> {
  const repositories = getRepositories();
  const databaseClient = getDatabaseClient();
  const quota = await getBotCreationQuota(input.ownerUserId);
  const userBotLimit = getUserBotLimit();
  const llmProfile = await repositories.userLlmProfiles.findByIdForUser(input.llmProfileId, input.ownerUserId);

  if (quota.isAtLimit && quota.limit !== null) {
    throw createBotLimitReachedError();
  }

  if (!llmProfile) {
    throw createLlmProfileNotFoundError();
  }

  const botId = randomUUID();
  const workspaceId = randomUUID();
  const instancePaths = resolveBotInstancePaths(resolveInstancesRoot(), botId);

  try {
    await Promise.all([
      mkdir(instancePaths.dataDir, { recursive: true }),
      mkdir(instancePaths.workspaceDir, { recursive: true }),
      mkdir(instancePaths.logDir, { recursive: true }),
    ]);

    const now = new Date();

    databaseClient.db.transaction((tx) => {
      if (userBotLimit !== null) {
        const usedCount = databaseClient.connection
          .prepare('select count(*) from bot_instances where owner_user_id = ?')
          .pluck()
          .get(input.ownerUserId);

        if (Number(usedCount ?? 0) >= userBotLimit) {
          throw createBotLimitReachedError();
        }
      }

      tx.insert(workspaces).values({
        createdAt: now,
        id: workspaceId,
        name: `${input.name} Workspace`,
        ownerUserId: input.ownerUserId,
        updatedAt: now,
      }).run();

      tx.insert(botInstancesTable).values({
        createdAt: now,
        desiredState: 'running',
        id: botId,
        llmConfigId: llmProfile.id,
        model: llmProfile.model,
        name: input.name,
        ownerUserId: input.ownerUserId,
        provider: llmProfile.provider,
        restartCount: 0,
        status: 'provisioning',
        updatedAt: now,
        workspaceId,
      }).run();
    }, { behavior: 'immediate' });
  } catch (error) {
    await cleanupBotRoot(instancePaths.botRoot, error);
    throw error;
  }

  const bot = await repositories.botInstances.findById(botId);

  if (!bot) {
    await cleanupBotRoot(instancePaths.botRoot, new Error(`Bot ${botId} was not found after creation.`));
    throw new ApiError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create bot.',
      status: 500,
    });
  }

  return hydrateBotDetail(bot);
}

export async function getBotCreationQuota(ownerUserId: string): Promise<BotCreationQuota> {
  const usedCount = await getRepositories().botInstances.countByOwnerUserId(ownerUserId);
  return buildBotCreationQuota(usedCount);
}

export function buildBotCreationQuota(usedCount: number): BotCreationQuota {
  const limit = getUserBotLimit();

  if (limit === null) {
    return {
      isAtLimit: false,
      limit: null,
      remainingCount: null,
      usedCount,
    };
  }

  const remainingCount = Math.max(limit - usedCount, 0);

  return {
    isAtLimit: usedCount >= limit,
    limit,
    remainingCount,
    usedCount,
  };
}

export async function startBot(botId: string): Promise<BotDetailItem> {
  const currentBot = await getRepositories().botInstances.findById(botId);

  if (!currentBot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  }

  if (currentBot.status === 'failed') {
    const restartedBot = await getRepositories().botInstances.requestRestart(botId);

    if (!restartedBot) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: 'Bot not found.',
        status: 404,
      });
    }

    return hydrateBotDetail(restartedBot);
  }

  return updateDesiredState(botId, 'running');
}

export async function stopBot(botId: string): Promise<BotDetailItem> {
  return updateDesiredState(botId, 'stopped');
}

export async function restartBot(botId: string): Promise<BotDetailItem> {
  const bot = await getRepositories().botInstances.requestRestart(botId);

  if (!bot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  }

  return hydrateBotDetail(bot);
}

export async function requestBotQrReissue(botId: string): Promise<BotDetailItem> {
  const bot = await getRepositories().botInstances.requestQrReissue(botId, new Date());

  if (!bot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  }

  return hydrateBotDetail(bot);
}

export async function deleteBot(botId: string): Promise<DeleteBotResult> {
  const repositories = getRepositories();
  const bot = await repositories.botInstances.findById(botId);

  if (!bot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  }

  if (bot.desiredState !== 'stopped' || bot.status !== 'stopped' || bot.processPid !== null) {
    throw new ApiError({
      code: 'BOT_DELETE_NOT_ALLOWED',
      message: 'Stop the bot completely before deleting it.',
      status: 409,
    });
  }

  const instancePaths = resolveBotInstancePaths(resolveInstancesRoot(), botId);
  const workspaceDeleted = await repositories.workspaces.deleteById(bot.workspaceId);

  if (!workspaceDeleted) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot workspace not found.',
      status: 404,
    });
  }

  try {
    await rm(instancePaths.botRoot, { force: true, recursive: true });
  } catch (error) {
    console.error(`Failed to remove deleted bot directory: ${instancePaths.botRoot}`);
    console.error(error);
  }

  return { id: botId };
}

export async function updateBotLlmProfile(input: UpdateBotLlmProfileInput): Promise<BotDetailItem> {
  const repositories = getRepositories();
  const [bot, llmProfile] = await Promise.all([
    repositories.botInstances.findByIdForOwner(input.botId, input.ownerUserId),
    repositories.userLlmProfiles.findByIdForUser(input.llmProfileId, input.ownerUserId),
  ]);

  if (!bot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  }

  if (!llmProfile) {
    throw createLlmProfileNotFoundError();
  }

  if (bot.llmConfigId !== llmProfile.id) {
    const recordedAt = new Date();

    await repositories.botInstances.updateLlmConfigBinding(
      input.botId,
      input.ownerUserId,
      llmProfile.id,
      recordedAt,
    );
    await repositories.botInstances.recordRuntimeConfigSnapshot(input.botId, {
      model: llmProfile.model,
      provider: llmProfile.provider,
      recordedAt,
    });

    if (bot.desiredState === 'running') {
      await repositories.botInstances.requestRestart(input.botId, recordedAt);
    }
  }

  return getBotDetail(input.botId);
}

export async function updateBotName(input: UpdateBotNameInput): Promise<BotDetailItem> {
  const bot = await getRepositories().botInstances.updateNameForOwner(
    input.botId,
    input.ownerUserId,
    input.name,
    new Date(),
  );

  if (!bot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  }

  return hydrateBotDetail(bot);
}

async function updateDesiredState(botId: string, desiredState: BotDesiredState): Promise<BotDetailItem> {
  const bot = await getRepositories().botInstances.setDesiredState(botId, desiredState);

  if (!bot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  }

  return hydrateBotDetail(bot);
}

function createBotLimitReachedError() {
  return new ApiError({
    code: 'BOT_LIMIT_REACHED',
    message: 'You have reached the bot limit for this account.',
    status: 409,
  });
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

interface BotPersistenceRecord {
  id: string;
  name: string;
  ownerUserId: string;
  provider: string;
  model: string;
  llmConfigId: string | null;
  workspaceId: string;
  desiredState: BotDesiredState;
  status: BotStatus;
  processPid: number | null;
  processStartedAt: Date | null;
  heartbeatAt: Date | null;
  restartRequestedAt: Date | null;
  qrReissueRequestedAt: Date | null;
  lastQrCodeId: string | null;
  lastQrCodeUrl: string | null;
  weixinAccountId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toBotSummaryItem(bot: BotPersistenceRecord): BotSummaryItem {
  return {
    id: bot.id,
    name: bot.name,
    provider: bot.provider,
    model: bot.model,
    workspaceId: bot.workspaceId,
    desiredState: bot.desiredState,
    status: bot.status,
    createdAt: bot.createdAt.toISOString(),
    updatedAt: bot.updatedAt.toISOString(),
  };
}

function toBotDetailItem(bot: BotPersistenceRecord): BotDetailItem {
  return {
    ...toBotSummaryItem(bot),
    llmConfigId: bot.llmConfigId,
    llmProfileName: null,
    processPid: bot.processPid,
    processStartedAt: toIsoString(bot.processStartedAt),
    heartbeatAt: toIsoString(bot.heartbeatAt),
    restartRequestedAt: toIsoString(bot.restartRequestedAt),
    qrReissueRequestedAt: toIsoString(bot.qrReissueRequestedAt),
    lastQrCodeId: bot.lastQrCodeId,
    lastQrCodeUrl: bot.lastQrCodeUrl,
    weixinAccountId: bot.weixinAccountId,
    lastErrorCode: bot.lastErrorCode,
    lastErrorMessage: bot.lastErrorMessage,
  };
}

async function hydrateBotDetail(bot: BotPersistenceRecord): Promise<BotDetailItem> {
  const detail = toBotDetailItem(bot);

  if (!bot.llmConfigId) {
    return detail;
  }

  const profile = await getRepositories().userLlmProfiles.findByIdForUser(bot.llmConfigId, bot.ownerUserId);

  return {
    ...detail,
    llmProfileName: profile?.name ?? null,
  };
}

async function cleanupBotRoot(botRoot: string, cause: unknown) {
  try {
    await rm(botRoot, { force: true, recursive: true });
  } catch (cleanupError) {
    console.error(`Failed to clean bot root after createBot failure: ${botRoot}`);
    console.error(cleanupError);
  }

  void cause;
}

function createLlmProfileNotFoundError() {
  return new ApiError({
    code: 'NOT_FOUND',
    message: 'LLM profile not found.',
    status: 404,
  });
}
