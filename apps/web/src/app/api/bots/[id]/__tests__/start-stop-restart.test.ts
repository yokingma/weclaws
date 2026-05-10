import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRequestSessionMock = vi.fn();
const requireOwnedBotMock = vi.fn();
const startBotMock = vi.fn();
const stopBotMock = vi.fn();
const restartBotMock = vi.fn();
const requestBotQrReissueMock = vi.fn();

vi.mock('@/lib/session', () => ({
  requireRequestSession: requireRequestSessionMock,
  requireOwnedBot: requireOwnedBotMock,
}));

vi.mock('@/lib/bot-service', () => ({
  startBot: startBotMock,
  stopBot: stopBotMock,
  restartBot: restartBotMock,
  requestBotQrReissue: requestBotQrReissueMock,
}));

describe('bot command routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRequestSessionMock.mockResolvedValue({
      user: { id: 'user_1', email: 'zac@example.com' },
    });
    requireOwnedBotMock.mockResolvedValue({
      id: 'bot_1',
      ownerUserId: 'user_1',
    });
  });

  it('marks the bot as running on start', async () => {
    startBotMock.mockResolvedValue({
      id: 'bot_1',
      desiredState: 'running',
    });

    const { POST } = await import('../start/route');
    const response = await POST(new Request('http://localhost/api/bots/bot_1/start'), {
      params: Promise.resolve({ id: 'bot_1' }),
    });

    expect(startBotMock).toHaveBeenCalledWith('bot_1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        id: 'bot_1',
        desiredState: 'running',
      },
      error: null,
    });
  });

  it('marks the bot as stopped on stop', async () => {
    stopBotMock.mockResolvedValue({
      id: 'bot_1',
      desiredState: 'stopped',
    });

    const { POST } = await import('../stop/route');
    const response = await POST(new Request('http://localhost/api/bots/bot_1/stop'), {
      params: Promise.resolve({ id: 'bot_1' }),
    });

    expect(stopBotMock).toHaveBeenCalledWith('bot_1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        id: 'bot_1',
        desiredState: 'stopped',
      },
      error: null,
    });
  });

  it('records restart requests without touching runtime fields', async () => {
    restartBotMock.mockResolvedValue({
      id: 'bot_1',
      desiredState: 'running',
      restartRequestedAt: '2026-03-30T00:00:00.000Z',
    });

    const { POST } = await import('../restart/route');
    const response = await POST(new Request('http://localhost/api/bots/bot_1/restart'), {
      params: Promise.resolve({ id: 'bot_1' }),
    });

    expect(restartBotMock).toHaveBeenCalledWith('bot_1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        id: 'bot_1',
        desiredState: 'running',
        restartRequestedAt: '2026-03-30T00:00:00.000Z',
      },
      error: null,
    });
  });

  it('records qr reissue requests for the authorized owner', async () => {
    requestBotQrReissueMock.mockResolvedValue({
      id: 'bot_1',
      desiredState: 'running',
      qrReissueRequestedAt: '2026-05-10T10:00:00.000Z',
      status: 'running',
    });

    const { POST } = await import('../reissue-qr/route');
    const response = await POST(new Request('http://localhost/api/bots/bot_1/reissue-qr'), {
      params: Promise.resolve({ id: 'bot_1' }),
    });

    expect(requestBotQrReissueMock).toHaveBeenCalledWith('bot_1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        id: 'bot_1',
        desiredState: 'running',
        qrReissueRequestedAt: '2026-05-10T10:00:00.000Z',
        status: 'running',
      },
      error: null,
    });
  });
});
