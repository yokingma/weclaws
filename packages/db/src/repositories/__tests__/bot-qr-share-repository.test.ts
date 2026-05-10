import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabaseClient, migrateDatabase } from '../../client.js';
import { BotQrShareRepository } from '../bot-qr-share-repository.js';
import { BotInstanceRepository } from '../bot-instance-repository.js';
import { UserRepository } from '../user-repository.js';
import { WorkspaceRepository } from '../workspace-repository.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('BotQrShareRepository', () => {
  it('stores one active share per bot and resolves active shares by token hash', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-bot-qr-share-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);
    const botQrShares = new BotQrShareRepository(client.db);

    await users.create({
      email: 'zac@example.com',
      id: 'user_1',
      name: 'zac',
    });

    await workspaces.create({
      id: 'ws_1',
      ownerUserId: 'user_1',
      name: 'Default Workspace',
    });

    await botInstances.create({
      desiredState: 'running',
      id: 'bot_1',
      model: 'claude-opus-4-6',
      name: 'Bot One',
      ownerUserId: 'user_1',
      provider: 'anthropic',
      status: 'waiting_for_qr',
      workspaceId: 'ws_1',
    });

    const createdAt = new Date('2026-05-10T10:00:00.000Z');
    const first = await botQrShares.upsertActiveByBotInstanceId({
      botInstanceId: 'bot_1',
      createdAt,
      token: 'token_1',
      tokenHash: 'hash_1',
    });
    const rotated = await botQrShares.upsertActiveByBotInstanceId({
      botInstanceId: 'bot_1',
      createdAt: new Date('2026-05-10T10:05:00.000Z'),
      token: 'token_2',
      tokenHash: 'hash_2',
    });
    const found = await botQrShares.findActiveByTokenHash('hash_2');
    const revoked = await botQrShares.revokeByBotInstanceId('bot_1', new Date('2026-05-10T10:10:00.000Z'));
    const missingAfterRevoke = await botQrShares.findActiveByTokenHash('hash_2');
    const missingRevoke = await botQrShares.revokeByBotInstanceId('bot_1', new Date('2026-05-10T10:11:00.000Z'));

    expect(first).toMatchObject({
      botInstanceId: 'bot_1',
      revokedAt: null,
      token: 'token_1',
      tokenHash: 'hash_1',
    });
    expect(rotated).toMatchObject({
      botInstanceId: 'bot_1',
      revokedAt: null,
      token: 'token_2',
      tokenHash: 'hash_2',
    });
    expect(found).toMatchObject({
      botInstanceId: 'bot_1',
      tokenHash: 'hash_2',
    });
    expect(revoked).toMatchObject({
      botInstanceId: 'bot_1',
    });
    expect(missingAfterRevoke).toBeNull();
    expect(missingRevoke).toBeNull();
  });

  it('handles concurrent active-share creation for the same bot as one rotating record', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-bot-qr-share-concurrent-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);
    const botQrShares = new BotQrShareRepository(client.db);

    await users.create({
      email: 'zac@example.com',
      id: 'user_1',
      name: 'zac',
    });

    await workspaces.create({
      id: 'ws_1',
      ownerUserId: 'user_1',
      name: 'Default Workspace',
    });

    await botInstances.create({
      desiredState: 'running',
      id: 'bot_1',
      model: 'claude-opus-4-6',
      name: 'Bot One',
      ownerUserId: 'user_1',
      provider: 'anthropic',
      status: 'waiting_for_qr',
      workspaceId: 'ws_1',
    });

    await expect(Promise.all([
      botQrShares.upsertActiveByBotInstanceId({
        botInstanceId: 'bot_1',
        token: 'token_1',
        tokenHash: 'hash_1',
      }),
      botQrShares.upsertActiveByBotInstanceId({
        botInstanceId: 'bot_1',
        token: 'token_2',
        tokenHash: 'hash_2',
      }),
    ])).resolves.toHaveLength(2);

    const active = await botQrShares.findActiveByBotInstanceId('bot_1');

    expect(active).toMatchObject({
      botInstanceId: 'bot_1',
      revokedAt: null,
      token: 'token_2',
      tokenHash: 'hash_2',
    });
  });
});
