import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPublicBotQrShareMock = vi.fn();

vi.mock('@/lib/bot-qr-share-service', () => ({
  getPublicBotQrShare: getPublicBotQrShareMock,
}));

describe('/api/share/qr/[token] route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns the current public qr payload for a valid share token', async () => {
    getPublicBotQrShareMock.mockResolvedValue({
      qrCodeUrl: 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=abc&bot_type=3',
      shareId: 'share_1',
      status: 'waiting_for_qr',
      updatedAt: '2026-05-10T10:00:00.000Z',
    });

    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost/api/share/qr/token_1'), {
      params: Promise.resolve({ token: 'token_1' }),
    });

    expect(getPublicBotQrShareMock).toHaveBeenCalledWith('token_1');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      data: {
        qrCodeUrl: 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=abc&bot_type=3',
        shareId: 'share_1',
        status: 'waiting_for_qr',
        updatedAt: '2026-05-10T10:00:00.000Z',
      },
      error: null,
    });
  });

  it('returns not found once a share token is revoked or unknown', async () => {
    const { ApiError } = await import('@/lib/api-error');

    getPublicBotQrShareMock.mockRejectedValue(new ApiError({
      code: 'NOT_FOUND',
      message: 'QR share not found.',
      status: 404,
    }));

    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost/api/share/qr/token_1'), {
      params: Promise.resolve({ token: 'token_1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'QR share not found.',
      },
    });
  });
});
