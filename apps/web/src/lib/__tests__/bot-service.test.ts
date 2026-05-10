import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteWorkspaceByIdMock = vi.fn();
const findByIdMock = vi.fn();
const findByIdForOwnerMock = vi.fn();
const findProfileByIdForUserMock = vi.fn();
const listByOwnerUserIdMock = vi.fn();
const requestQrReissueMock = vi.fn();
const requestRestartMock = vi.fn();
const recordRuntimeConfigSnapshotMock = vi.fn();
const resolveInstancesRootMock = vi.fn();
const rmMock = vi.fn();
const setDesiredStateMock = vi.fn();
const updateLlmConfigBindingMock = vi.fn();
const updateNameForOwnerMock = vi.fn();

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  rm: rmMock,
}));

vi.mock('../env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../env')>();

  return {
    ...actual,
    resolveInstancesRoot: resolveInstancesRootMock,
  };
});

vi.mock('../repositories', () => ({
  getRepositories: () => ({
    botEvents: {
      listByBotInstanceId: vi.fn(),
    },
    botInstances: {
      findById: findByIdMock,
      findByIdForOwner: findByIdForOwnerMock,
      listByOwnerUserId: listByOwnerUserIdMock,
      recordRuntimeConfigSnapshot: recordRuntimeConfigSnapshotMock,
      requestQrReissue: requestQrReissueMock,
      requestRestart: requestRestartMock,
      setDesiredState: setDesiredStateMock,
      updateLlmConfigBinding: updateLlmConfigBindingMock,
      updateNameForOwner: updateNameForOwnerMock,
    },
    userLlmProfiles: {
      findByIdForUser: findProfileByIdForUserMock,
    },
    workspaces: {
      create: vi.fn(),
      deleteById: deleteWorkspaceByIdMock,
    },
  }),
}));

describe('bot-service DTO mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveInstancesRootMock.mockReturnValue('/tmp/instances');
  });

  it('returns list summaries without detail-only runtime fields', async () => {
    listByOwnerUserIdMock.mockResolvedValue([
      {
        createdAt: new Date('2026-03-30T00:00:00.000Z'),
        desiredState: 'running',
        heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
        id: 'bot_1',
        lastErrorCode: 'RUNTIME_ERROR',
        lastErrorMessage: 'boom',
        lastQrCodeId: 'qr_1',
        lastQrCodeUrl: 'https://example.com/qrcode/1',
        model: 'claude-opus-4-6',
        name: 'Bot One',
        processPid: 123,
        processStartedAt: new Date('2026-03-30T00:00:01.000Z'),
        provider: 'anthropic',
        restartRequestedAt: new Date('2026-03-30T00:00:06.000Z'),
        status: 'running',
        updatedAt: new Date('2026-03-30T00:00:05.000Z'),
        weixinAccountId: 'wx_acc_1',
        workspaceId: 'ws_1',
      },
    ]);

    const { listBots } = await import('../bot-service');
    const bots = await listBots('user_1');

    expect(bots).toEqual([
      {
        createdAt: '2026-03-30T00:00:00.000Z',
        desiredState: 'running',
        id: 'bot_1',
        model: 'claude-opus-4-6',
        name: 'Bot One',
        provider: 'anthropic',
        status: 'running',
        updatedAt: '2026-03-30T00:00:05.000Z',
        workspaceId: 'ws_1',
      },
    ]);
    expect(bots[0]).not.toHaveProperty('processPid');
    expect(bots[0]).not.toHaveProperty('weixinAccountId');
  });

  it('returns detail views with runtime fields serialized for the detail page and sse', async () => {
    findByIdMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      id: 'bot_1',
      llmConfigId: 'profile_1',
      lastErrorCode: 'RUNTIME_ERROR',
      lastErrorMessage: 'boom',
      lastQrCodeId: 'qr_1',
      lastQrCodeUrl: 'https://example.com/qrcode/1',
      model: 'claude-opus-4-6',
      name: 'Bot One',
      processPid: 123,
      processStartedAt: new Date('2026-03-30T00:00:01.000Z'),
      provider: 'anthropic',
      qrReissueRequestedAt: null,
      restartRequestedAt: new Date('2026-03-30T00:00:06.000Z'),
      status: 'running',
      updatedAt: new Date('2026-03-30T00:00:05.000Z'),
      weixinAccountId: 'wx_acc_1',
      workspaceId: 'ws_1',
    });
    findProfileByIdForUserMock.mockResolvedValue({
      id: 'profile_1',
      name: 'Primary',
      userId: 'user_1',
    });

    const { getBotDetail } = await import('../bot-service');
    const bot = await getBotDetail('bot_1');

    expect(bot).toEqual({
      createdAt: '2026-03-30T00:00:00.000Z',
      desiredState: 'running',
      heartbeatAt: '2026-03-30T00:00:05.000Z',
      id: 'bot_1',
      llmConfigId: 'profile_1',
      llmProfileName: 'Primary',
      lastErrorCode: 'RUNTIME_ERROR',
      lastErrorMessage: 'boom',
      lastQrCodeId: 'qr_1',
      lastQrCodeUrl: 'https://example.com/qrcode/1',
      model: 'claude-opus-4-6',
      name: 'Bot One',
      processPid: 123,
      processStartedAt: '2026-03-30T00:00:01.000Z',
      provider: 'anthropic',
      qrReissueRequestedAt: null,
      restartRequestedAt: '2026-03-30T00:00:06.000Z',
      status: 'running',
      updatedAt: '2026-03-30T00:00:05.000Z',
      weixinAccountId: 'wx_acc_1',
      workspaceId: 'ws_1',
    });
  });

  it('preserves real runtime field shapes when qr id is absent and errors come from structured runtime payloads', async () => {
    findByIdMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      heartbeatAt: new Date('2026-03-30T10:18:19.068Z'),
      id: 'bot_1',
      llmConfigId: null,
      lastErrorCode: 'RUNTIME_ERROR',
      lastErrorMessage: 'Sandbox session crashed unexpectedly',
      lastQrCodeId: null,
      lastQrCodeUrl: 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=81617e3de8b98a196dd0842c26bdba4b&bot_type=3',
      model: 'gpt-5.4',
      name: 'Bot One',
      processPid: 84721,
      processStartedAt: new Date('2026-03-30T10:18:18.753Z'),
      provider: 'openai',
      qrReissueRequestedAt: null,
      restartRequestedAt: null,
      status: 'running',
      updatedAt: new Date('2026-03-30T10:18:19.068Z'),
      weixinAccountId: 'a8452ac9698f@im.bot',
      workspaceId: 'ws_1',
    });

    const { getBotDetail } = await import('../bot-service');
    const bot = await getBotDetail('bot_1');

    expect(bot).toEqual({
      createdAt: '2026-03-30T00:00:00.000Z',
      desiredState: 'running',
      heartbeatAt: '2026-03-30T10:18:19.068Z',
      id: 'bot_1',
      llmConfigId: null,
      llmProfileName: null,
      lastErrorCode: 'RUNTIME_ERROR',
      lastErrorMessage: 'Sandbox session crashed unexpectedly',
      lastQrCodeId: null,
      lastQrCodeUrl: 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=81617e3de8b98a196dd0842c26bdba4b&bot_type=3',
      model: 'gpt-5.4',
      name: 'Bot One',
      processPid: 84721,
      processStartedAt: '2026-03-30T10:18:18.753Z',
      provider: 'openai',
      qrReissueRequestedAt: null,
      restartRequestedAt: null,
      status: 'running',
      updatedAt: '2026-03-30T10:18:19.068Z',
      weixinAccountId: 'a8452ac9698f@im.bot',
      workspaceId: 'ws_1',
    });
  });

  it('keeps the persisted provider and model snapshot instead of drifting with the bound profile', async () => {
    listByOwnerUserIdMock.mockResolvedValue([
      {
        createdAt: new Date('2026-03-30T00:00:00.000Z'),
        desiredState: 'running',
        id: 'bot_1',
        llmConfigId: 'profile_1',
        model: 'claude-opus-4-6',
        name: 'Bot One',
        ownerUserId: 'user_1',
        provider: 'anthropic',
        status: 'running',
        updatedAt: new Date('2026-03-30T00:00:05.000Z'),
        workspaceId: 'ws_1',
      },
    ]);
    findByIdMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      id: 'bot_1',
      llmConfigId: 'profile_1',
      model: 'claude-opus-4-6',
      name: 'Bot One',
      ownerUserId: 'user_1',
      provider: 'anthropic',
      restartRequestedAt: null,
      status: 'running',
      updatedAt: new Date('2026-03-30T00:00:05.000Z'),
      workspaceId: 'ws_1',
      processPid: null,
      processStartedAt: null,
      heartbeatAt: null,
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      weixinAccountId: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    findProfileByIdForUserMock.mockResolvedValue({
      id: 'profile_1',
      name: 'OpenAI Production',
      userId: 'user_1',
    });

    const { getBotDetail, listBots } = await import('../bot-service');
    const [bots, detail] = await Promise.all([
      listBots('user_1'),
      getBotDetail('bot_1'),
    ]);

    expect(bots[0]).toMatchObject({
      model: 'claude-opus-4-6',
      provider: 'anthropic',
    });
    expect(detail).toMatchObject({
      llmConfigId: 'profile_1',
      llmProfileName: 'OpenAI Production',
      model: 'claude-opus-4-6',
      provider: 'anthropic',
    });
  });

  it('rebinds a bot to another profile, refreshes the runtime snapshot, and requests restart for running bots', async () => {
    findByIdForOwnerMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      id: 'bot_1',
      llmConfigId: 'profile_old',
      model: 'claude-opus-4-6',
      name: 'Bot One',
      ownerUserId: 'user_1',
      provider: 'anthropic',
      status: 'running',
      updatedAt: new Date('2026-03-30T00:00:05.000Z'),
      workspaceId: 'ws_1',
      processPid: 42,
      processStartedAt: new Date('2026-03-30T00:00:01.000Z'),
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      restartRequestedAt: null,
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      weixinAccountId: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    findByIdMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      id: 'bot_1',
      llmConfigId: 'profile_new',
      model: 'gpt-5.5',
      name: 'Bot One',
      ownerUserId: 'user_1',
      provider: 'openai',
      status: 'running',
      updatedAt: new Date('2026-03-30T00:00:10.000Z'),
      workspaceId: 'ws_1',
      processPid: 42,
      processStartedAt: new Date('2026-03-30T00:00:01.000Z'),
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      restartRequestedAt: new Date('2026-03-30T00:00:10.000Z'),
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      weixinAccountId: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    findProfileByIdForUserMock.mockImplementation(async (profileId: string) => {
      if (profileId === 'profile_new') {
        return {
          apiKey: 'sk-user-1',
          apiType: 'openai-responses',
          baseUrl: 'https://gateway.example.com/v1',
          createdAt: new Date('2026-03-30T00:00:00.000Z'),
          id: 'profile_new',
          model: 'gpt-5.5',
          name: 'Primary',
          provider: 'openai',
          updatedAt: new Date('2026-03-30T00:00:00.000Z'),
          userId: 'user_1',
        };
      }

      return null;
    });

    const { updateBotLlmProfile } = await import('../bot-service');
    const updated = await updateBotLlmProfile({
      botId: 'bot_1',
      llmProfileId: 'profile_new',
      ownerUserId: 'user_1',
    });

    expect(updateLlmConfigBindingMock).toHaveBeenCalledWith(
      'bot_1',
      'user_1',
      'profile_new',
      expect.any(Date),
    );
    expect(recordRuntimeConfigSnapshotMock).toHaveBeenCalledWith('bot_1', {
      model: 'gpt-5.5',
      provider: 'openai',
      recordedAt: expect.any(Date),
    });
    expect(requestRestartMock).toHaveBeenCalledWith('bot_1', expect.any(Date));
    expect(updated).toMatchObject({
      id: 'bot_1',
      llmConfigId: 'profile_new',
      llmProfileName: 'Primary',
      model: 'gpt-5.5',
      provider: 'openai',
      restartRequestedAt: '2026-03-30T00:00:10.000Z',
    });
  });

  it('updates a bot name for the owner without requesting a restart', async () => {
    updateNameForOwnerMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      id: 'bot_1',
      llmConfigId: 'profile_1',
      lastErrorCode: null,
      lastErrorMessage: null,
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      model: 'claude-opus-4-6',
      name: 'Renamed Bot',
      ownerUserId: 'user_1',
      processPid: 123,
      processStartedAt: new Date('2026-03-30T00:00:01.000Z'),
      provider: 'anthropic',
      restartRequestedAt: null,
      status: 'running',
      updatedAt: new Date('2026-03-30T00:01:00.000Z'),
      weixinAccountId: 'wx_acc_1',
      workspaceId: 'ws_1',
    });
    findProfileByIdForUserMock.mockResolvedValue({
      id: 'profile_1',
      name: 'Primary',
      userId: 'user_1',
    });

    const { updateBotName } = await import('../bot-service');
    const bot = await updateBotName({
      botId: 'bot_1',
      name: 'Renamed Bot',
      ownerUserId: 'user_1',
    });

    expect(updateNameForOwnerMock).toHaveBeenCalledWith(
      'bot_1',
      'user_1',
      'Renamed Bot',
      expect.any(Date),
    );
    expect(requestRestartMock).not.toHaveBeenCalled();
    expect(bot).toMatchObject({
      id: 'bot_1',
      llmProfileName: 'Primary',
      name: 'Renamed Bot',
      restartRequestedAt: null,
      status: 'running',
    });
  });

  it('returns not found when updating a bot name outside the owner scope', async () => {
    updateNameForOwnerMock.mockResolvedValue(null);

    const { updateBotName } = await import('../bot-service');

    await expect(updateBotName({
      botId: 'bot_1',
      name: 'Renamed Bot',
      ownerUserId: 'user_2',
    })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Bot not found.',
      status: 404,
    });
  });

  it('uses a restart request to recover failed bots back into supervisor reconcile', async () => {
    const restartRequestedAt = new Date('2026-03-30T00:00:10.000Z');
    findByIdMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      id: 'bot_1',
      llmConfigId: 'profile_1',
      lastErrorCode: 'LLM_PROFILE_INVALID',
      lastErrorMessage: 'Bot LLM profile is invalid or inaccessible: profile_missing.',
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      model: 'claude-opus-4-6',
      name: 'Bot One',
      ownerUserId: 'user_1',
      processPid: null,
      processStartedAt: null,
      provider: 'anthropic',
      restartRequestedAt: null,
      status: 'failed',
      updatedAt: new Date('2026-03-30T00:00:05.000Z'),
      weixinAccountId: null,
      workspaceId: 'ws_1',
    });
    requestRestartMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      id: 'bot_1',
      llmConfigId: 'profile_1',
      lastErrorCode: 'LLM_PROFILE_INVALID',
      lastErrorMessage: 'Bot LLM profile is invalid or inaccessible: profile_missing.',
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      model: 'claude-opus-4-6',
      name: 'Bot One',
      ownerUserId: 'user_1',
      processPid: null,
      processStartedAt: null,
      provider: 'anthropic',
      restartRequestedAt,
      status: 'stopped',
      updatedAt: new Date('2026-03-30T00:00:10.000Z'),
      weixinAccountId: null,
      workspaceId: 'ws_1',
    });

    const { startBot } = await import('../bot-service');
    const bot = await startBot('bot_1');

    expect(requestRestartMock).toHaveBeenCalledWith('bot_1');
    expect(setDesiredStateMock).not.toHaveBeenCalled();
    expect(bot).toMatchObject({
      id: 'bot_1',
      restartRequestedAt: '2026-03-30T00:00:10.000Z',
      status: 'stopped',
    });
  });

  it('deletes fully stopped bots and removes the instance directory', async () => {
    findByIdMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'stopped',
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      id: 'bot_1',
      lastErrorCode: null,
      lastErrorMessage: null,
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      model: 'gpt-5.4',
      name: 'Bot One',
      ownerUserId: 'user_1',
      processPid: null,
      processStartedAt: null,
      provider: 'openai',
      restartRequestedAt: null,
      status: 'stopped',
      updatedAt: new Date('2026-03-30T00:00:05.000Z'),
      weixinAccountId: null,
      workspaceId: 'ws_1',
    });
    deleteWorkspaceByIdMock.mockResolvedValue(true);

    const { deleteBot } = await import('../bot-service');
    const result = await deleteBot('bot_1');

    expect(deleteWorkspaceByIdMock).toHaveBeenCalledWith('ws_1');
    expect(rmMock).toHaveBeenCalledWith('/tmp/instances/bot_1', {
      force: true,
      recursive: true,
    });
    expect(result).toEqual({
      id: 'bot_1',
    });
  });

  it('rejects deletion unless the bot is fully stopped with no live process', async () => {
    findByIdMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'running',
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      id: 'bot_1',
      lastErrorCode: null,
      lastErrorMessage: null,
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      model: 'gpt-5.4',
      name: 'Bot One',
      ownerUserId: 'user_1',
      processPid: 31415,
      processStartedAt: new Date('2026-03-30T00:00:01.000Z'),
      provider: 'openai',
      restartRequestedAt: null,
      status: 'running',
      updatedAt: new Date('2026-03-30T00:00:05.000Z'),
      weixinAccountId: null,
      workspaceId: 'ws_1',
    });

    const { deleteBot } = await import('../bot-service');

    await expect(deleteBot('bot_1')).rejects.toMatchObject({
      code: 'BOT_DELETE_NOT_ALLOWED',
      status: 409,
    });
    expect(deleteWorkspaceByIdMock).not.toHaveBeenCalled();
    expect(rmMock).not.toHaveBeenCalled();
  });

  it('treats instance directory cleanup failures as non-blocking after the bot is deleted', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    findByIdMock.mockResolvedValue({
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      desiredState: 'stopped',
      heartbeatAt: new Date('2026-03-30T00:00:05.000Z'),
      id: 'bot_1',
      lastErrorCode: null,
      lastErrorMessage: null,
      lastQrCodeId: null,
      lastQrCodeUrl: null,
      model: 'gpt-5.4',
      name: 'Bot One',
      ownerUserId: 'user_1',
      processPid: null,
      processStartedAt: null,
      provider: 'openai',
      restartRequestedAt: null,
      status: 'stopped',
      updatedAt: new Date('2026-03-30T00:00:05.000Z'),
      weixinAccountId: null,
      workspaceId: 'ws_1',
    });
    deleteWorkspaceByIdMock.mockResolvedValue(true);
    rmMock.mockRejectedValueOnce(new Error('EACCES'));

    const { deleteBot } = await import('../bot-service');
    const result = await deleteBot('bot_1');

    expect(result).toEqual({
      id: 'bot_1',
    });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
