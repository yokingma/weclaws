import { createHash, randomUUID } from 'node:crypto';
import { normalizeTrustedQrCodeUrl } from '@weclaws/shared';
import { ApiError } from './api-error';
import { getEnv } from './env';
import { getRepositories } from './repositories';

export interface BotQrShareOwnerItem {
  publicUrl: string;
  revokedAt: string | null;
  shareId: string;
}

export interface PublicBotQrShareItem {
  qrCodeUrl: string | null;
  shareId: string;
  status: string;
  updatedAt: string;
}

export async function getBotQrShareForOwner(botInstanceId: string): Promise<BotQrShareOwnerItem | null> {
  const share = await getRepositories().botQrShares.findActiveByBotInstanceId(botInstanceId);

  if (!share) {
    return null;
  }

  return {
    publicUrl: buildPublicQrShareUrl(share.token),
    revokedAt: share.revokedAt?.toISOString() ?? null,
    shareId: share.id,
  };
}

export async function enableBotQrShare(botInstanceId: string): Promise<BotQrShareOwnerItem> {
  const token = randomUUID();
  const share = await getRepositories().botQrShares.upsertActiveByBotInstanceId({
    botInstanceId,
    token,
    tokenHash: hashShareToken(token),
  });

  if (!share) {
    throw new ApiError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create QR share link.',
      status: 500,
    });
  }

  return {
    publicUrl: buildPublicQrShareUrl(token),
    revokedAt: share.revokedAt?.toISOString() ?? null,
    shareId: share.id,
  };
}

export async function disableBotQrShare(botInstanceId: string): Promise<BotQrShareOwnerItem | null> {
  const share = await getRepositories().botQrShares.revokeByBotInstanceId(botInstanceId);

  if (!share) {
    return null;
  }

  return {
    publicUrl: buildPublicQrShareUrl(share.token),
    revokedAt: share.revokedAt?.toISOString() ?? null,
    shareId: share.id,
  };
}

export async function getPublicBotQrShare(token: string): Promise<PublicBotQrShareItem> {
  const share = await getRepositories().botQrShares.findActiveByTokenHash(hashShareToken(token));

  if (!share) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'QR share not found.',
      status: 404,
    });
  }

  const bot = await getRepositories().botInstances.findById(share.botInstanceId);

  if (!bot) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'QR share not found.',
      status: 404,
    });
  }

  return {
    qrCodeUrl: bot.status === 'waiting_for_qr' ? normalizeTrustedQrCodeUrl(bot.lastQrCodeUrl) : null,
    shareId: share.id,
    status: bot.status,
    updatedAt: bot.updatedAt.toISOString(),
  };
}

function hashShareToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function buildPublicQrShareUrl(token: string) {
  return new URL(`/share/qr/${token}`, getEnv().APP_BASE_URL).toString();
}
