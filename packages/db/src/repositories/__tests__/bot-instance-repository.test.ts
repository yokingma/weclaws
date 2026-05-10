import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabaseClient, migrateDatabase } from '../../client.js';
import { BotEventRepository } from '../bot-event-repository.js';
import { BotInstanceRepository } from '../bot-instance-repository.js';
import { UserRepository } from '../user-repository.js';
import { WorkspaceRepository } from '../workspace-repository.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('BotInstanceRepository', () => {
  it('supports owner-scoped queries and restart requests', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);
    const botEvents = new BotEventRepository(client.db);

    const user = await (users as unknown as {
      create(input: { id: string; email: string; name: string }): Promise<{ id: string } | null>;
    }).create({
      id: 'user_1',
      email: 'zac@example.com',
      name: 'zac',
    });

    expect(user).toMatchObject({
      id: 'user_1',
    });

    await workspaces.create({
      id: 'ws_1',
      ownerUserId: 'user_1',
      name: 'Default Workspace',
    });

    await botInstances.create({
      id: 'bot_1',
      ownerUserId: 'user_1',
      workspaceId: 'ws_1',
      name: 'Bot One',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      desiredState: 'running',
      status: 'provisioning',
    });

    await botInstances.create({
      id: 'bot_2',
      ownerUserId: 'user_1',
      workspaceId: 'ws_1',
      name: 'Bot Two',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      desiredState: 'stopped',
      status: 'stopped',
    });

    client.connection
      .prepare(
        `INSERT INTO user_llm_profiles (
          id,
          user_id,
          name,
          provider,
          model,
          api_key,
          base_url,
          api_type,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'profile_1',
        'user_1',
        'Primary Anthropic',
        'anthropic',
        'claude-opus-4-6',
        'sk-test',
        null,
        null,
        Date.parse('2026-03-30T00:00:00.000Z'),
        Date.parse('2026-03-30T00:00:00.000Z'),
      );

    await botEvents.append({
      id: 'evt_1',
      botInstanceId: 'bot_1',
      type: 'process_started',
      message: 'IM runtime process started',
      payloadJson: { channel: 'weixin' },
    });

    const scopedRepository = botInstances as unknown as {
      listByOwnerUserId(ownerUserId: string): Promise<Array<{ id: string; desiredState: string }>>;
      countByOwnerUserId(ownerUserId: string): Promise<number>;
      findByIdForOwner(
        id: string,
        ownerUserId: string,
      ): Promise<{ id: string; ownerUserId: string } | null>;
      requestRestart(
        id: string,
        requestedAt: Date,
      ): Promise<{ id: string; desiredState: string; restartRequestedAt: Date | null } | null>;
      updateLlmConfigBinding(
        id: string,
        ownerUserId: string,
        llmConfigId: string,
        updatedAt: Date,
      ): Promise<{ id: string; llmConfigId: string | null } | null>;
      updateNameForOwner(
        id: string,
        ownerUserId: string,
        name: string,
        updatedAt: Date,
      ): Promise<{ id: string; name: string; updatedAt: Date } | null>;
      requestQrReissue(
        id: string,
        requestedAt: Date,
      ): Promise<{ id: string; desiredState: string; qrReissueRequestedAt: Date | null } | null>;
      findReconcileCandidates(now?: Date): Promise<Array<{ id: string; desiredState: string }>>;
    };

    const list = await scopedRepository.listByOwnerUserId('user_1');
    const count = await scopedRepository.countByOwnerUserId('user_1');
    const detail = await scopedRepository.findByIdForOwner('bot_1', 'user_1');
    const restartRequestedAt = new Date('2026-03-30T00:00:00.000Z');
    const restarted = await scopedRepository.requestRestart('bot_2', restartRequestedAt);
    const rebound = await scopedRepository.updateLlmConfigBinding(
      'bot_1',
      'user_1',
      'profile_1',
      new Date('2026-03-30T00:00:01.000Z'),
    );
    const renamedAt = new Date('2026-03-30T00:00:02.000Z');
    const renamed = await scopedRepository.updateNameForOwner(
      'bot_1',
      'user_1',
      'Renamed Bot',
      renamedAt,
    );
    const qrReissueRequestedAt = new Date('2026-03-30T00:00:03.000Z');
    const qrReissueRequested = await scopedRepository.requestQrReissue(
      'bot_1',
      qrReissueRequestedAt,
    );
    const blockedRename = await scopedRepository.updateNameForOwner(
      'bot_1',
      'user_2',
      'Wrong Owner Rename',
      renamedAt,
    );
    const runnable = await scopedRepository.findReconcileCandidates();
    const events = await botEvents.listByBotInstanceId('bot_1');

    expect(list).toHaveLength(2);
    expect(count).toBe(2);
    expect(list.map((item) => item.id)).toEqual(['bot_1', 'bot_2']);
    expect(detail).toMatchObject({
      id: 'bot_1',
      ownerUserId: 'user_1',
    });
    expect(restarted).toMatchObject({
      id: 'bot_2',
      desiredState: 'running',
      restartRequestedAt,
    });
    expect(rebound).toMatchObject({
      id: 'bot_1',
      llmConfigId: 'profile_1',
    });
    expect(renamed).toMatchObject({
      id: 'bot_1',
      name: 'Renamed Bot',
      updatedAt: renamedAt,
    });
    expect(qrReissueRequested).toMatchObject({
      id: 'bot_1',
      desiredState: 'running',
      qrReissueRequestedAt,
    });
    expect(blockedRename).toBeNull();
    expect(runnable).toHaveLength(2);
    expect(runnable.map((item) => item.id)).toEqual(['bot_1', 'bot_2']);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'evt_1',
      botInstanceId: 'bot_1',
      type: 'process_started',
    });
  });

  it('re-queues failed bots for reconcile when a restart is requested', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-restart-failed-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);

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
      id: 'bot_1',
      ownerUserId: 'user_1',
      workspaceId: 'ws_1',
      name: 'Bot One',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      desiredState: 'running',
      status: 'running',
    });

    await botInstances.markFailed('bot_1', {
      errorCode: 'LLM_PROFILE_INVALID',
      errorMessage: 'Bot LLM profile is invalid or inaccessible: profile_missing.',
      failedAt: new Date('2026-03-30T00:00:00.000Z'),
      restartCount: 0,
    });

    const restartRequestedAt = new Date('2026-03-30T00:05:00.000Z');
    const restarted = await botInstances.requestRestart('bot_1', restartRequestedAt);
    const runnable = await botInstances.findReconcileCandidates(restartRequestedAt);

    expect(restarted).toMatchObject({
      desiredState: 'running',
      id: 'bot_1',
      restartRequestedAt,
      status: 'stopped',
    });
    expect(runnable.map((item) => item.id)).toEqual(['bot_1']);
  });

  it('keeps qr reissue intents owner-agnostic and leaves stop intents untouched', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-qr-reissue-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);

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
      desiredState: 'stopped',
      id: 'bot_1',
      model: 'claude-opus-4-6',
      name: 'Bot One',
      ownerUserId: 'user_1',
      provider: 'anthropic',
      status: 'stopped',
      workspaceId: 'ws_1',
    });

    const requestedAt = new Date('2026-03-30T00:00:00.000Z');
    const requested = await (botInstances as unknown as {
      requestQrReissue(
        id: string,
        requestedAt: Date,
      ): Promise<{ desiredState: string; qrReissueRequestedAt: Date | null } | null>;
    }).requestQrReissue('bot_1', requestedAt);

    expect(requested).toMatchObject({
      desiredState: 'running',
      qrReissueRequestedAt: requestedAt,
    });
  });

  it('re-queues failed bots for reconcile when qr reissue is requested', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-qr-reissue-failed-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);

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
      status: 'running',
      workspaceId: 'ws_1',
    });

    await botInstances.markFailed('bot_1', {
      errorCode: 'RUNTIME_ERROR',
      errorMessage: 'FastAgent runtime failed.',
      failedAt: new Date('2026-03-30T00:00:00.000Z'),
      restartCount: 1,
    });

    const requestedAt = new Date('2026-03-30T00:01:00.000Z');
    const requested = await botInstances.requestQrReissue('bot_1', requestedAt);
    const runnable = await botInstances.findReconcileCandidates(requestedAt);

    expect(requested).toMatchObject({
      desiredState: 'running',
      id: 'bot_1',
      qrReissueRequestedAt: requestedAt,
      status: 'stopped',
    });
    expect(runnable.map((item) => item.id)).toEqual(['bot_1']);
  });

  it('applies runtime-specific state updates through narrow repository methods', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-runtime-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);

    await (users as unknown as {
      create(input: { id: string; email: string; name: string }): Promise<{ id: string } | null>;
    }).create({
      id: 'user_1',
      email: 'zac@example.com',
      name: 'zac',
    });

    await workspaces.create({
      id: 'ws_1',
      ownerUserId: 'user_1',
      name: 'Default Workspace',
    });

    await botInstances.create({
      id: 'bot_1',
      ownerUserId: 'user_1',
      workspaceId: 'ws_1',
      name: 'Bot One',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      desiredState: 'running',
      status: 'provisioning',
    });

    const runtimeRepository = botInstances as unknown as {
      markStarting(
        id: string,
        input: { heartbeatAt: Date; processPid: number; processStartedAt: Date },
      ): Promise<{
        heartbeatAt: Date | null;
        processPid: number | null;
        processStartedAt: Date | null;
        status: string;
      } | null>;
      recordQrCode(
        id: string,
        input: { observedAt: Date; qrCodeId: string; qrCodeUrl: string },
      ): Promise<{
        heartbeatAt: Date | null;
        lastQrCodeId: string | null;
        lastQrCodeUrl: string | null;
        status: string;
      } | null>;
      recordLoginConfirmed(
        id: string,
        input: { observedAt: Date; weixinAccountId: string },
      ): Promise<{
        heartbeatAt: Date | null;
        weixinAccountId: string | null;
      } | null>;
      markRunning(
        id: string,
        input: { heartbeatAt: Date; weixinAccountId?: string },
      ): Promise<{
        heartbeatAt: Date | null;
        lastErrorCode: string | null;
        lastErrorMessage: string | null;
        restartBackoffUntil: Date | null;
        restartCount: number;
        status: string;
        weixinAccountId: string | null;
      } | null>;
      recordRuntimeError(
        id: string,
        input: { errorCode: string; errorMessage: string; observedAt: Date },
      ): Promise<{
        heartbeatAt: Date | null;
        lastErrorCode: string | null;
        lastErrorMessage: string | null;
      } | null>;
      markDegraded(
        id: string,
        input: { heartbeatAt: Date },
      ): Promise<{ heartbeatAt: Date | null; status: string } | null>;
      markStopping(
        id: string,
        input: { heartbeatAt: Date },
      ): Promise<{ heartbeatAt: Date | null; status: string } | null>;
      scheduleRestart(
        id: string,
        input: { observedAt: Date; restartBackoffUntil: Date; restartCount: number },
      ): Promise<{
        processPid: number | null;
        processStartedAt: Date | null;
        restartBackoffUntil: Date | null;
        restartCount: number;
        status: string;
      } | null>;
      consumeRestartRequest(
        id: string,
        input: { consumedAt: Date },
      ): Promise<{ restartRequestedAt: Date | null } | null>;
      markFailed(
        id: string,
        input: { errorCode: string; errorMessage: string; failedAt: Date; restartCount: number },
      ): Promise<{
        lastErrorCode: string | null;
        lastErrorMessage: string | null;
        restartBackoffUntil: Date | null;
        restartCount: number;
        status: string;
      } | null>;
      markStopped(
        id: string,
        input: { observedAt: Date },
      ): Promise<{
        heartbeatAt: Date | null;
        processPid: number | null;
        processStartedAt: Date | null;
        status: string;
      } | null>;
    };

    const startAt = new Date('2026-03-30T00:00:00.000Z');
    const qrAt = new Date('2026-03-30T00:00:05.000Z');
    const loginAt = new Date('2026-03-30T00:00:10.000Z');
    const runningAt = new Date('2026-03-30T00:00:15.000Z');
    const errorAt = new Date('2026-03-30T00:00:20.000Z');
    const degradedAt = new Date('2026-03-30T00:00:25.000Z');
    const stoppingAt = new Date('2026-03-30T00:00:30.000Z');
    const stoppedAt = new Date('2026-03-30T00:00:35.000Z');
    const restartRequestedAt = new Date('2026-03-30T00:00:40.000Z');
    const restartBackoffUntil = new Date('2026-03-30T00:00:50.000Z');
    const failedAt = new Date('2026-03-30T00:01:00.000Z');

    const started = await runtimeRepository.markStarting('bot_1', {
      heartbeatAt: startAt,
      processPid: 123,
      processStartedAt: startAt,
    });
    const qrReady = await runtimeRepository.recordQrCode('bot_1', {
      observedAt: qrAt,
      qrCodeId: 'qr_1',
      qrCodeUrl: 'https://example.com/qrcode/1',
    });
    const loggedIn = await runtimeRepository.recordLoginConfirmed('bot_1', {
      observedAt: loginAt,
      weixinAccountId: 'wx_acc_1',
    });
    const running = await runtimeRepository.markRunning('bot_1', {
      heartbeatAt: runningAt,
      weixinAccountId: 'wx_acc_1',
    });
    const runtimeError = await runtimeRepository.recordRuntimeError('bot_1', {
      errorCode: 'RUNTIME_ERROR',
      errorMessage: 'FastAgent crashed.',
      observedAt: errorAt,
    });
    const degraded = await runtimeRepository.markDegraded('bot_1', {
      heartbeatAt: degradedAt,
    });
    const stopping = await runtimeRepository.markStopping('bot_1', {
      heartbeatAt: stoppingAt,
    });
    const stopped = await runtimeRepository.markStopped('bot_1', {
      observedAt: stoppedAt,
    });
    await botInstances.requestRestart('bot_1', restartRequestedAt);
    const consumed = await runtimeRepository.consumeRestartRequest('bot_1', {
      consumedAt: restartRequestedAt,
    });
    const scheduled = await runtimeRepository.scheduleRestart('bot_1', {
      observedAt: stoppedAt,
      restartBackoffUntil,
      restartCount: 1,
    });
    const failed = await runtimeRepository.markFailed('bot_1', {
      errorCode: 'RUNTIME_ERROR',
      errorMessage: 'Repeated crashes.',
      failedAt,
      restartCount: 4,
    });

    expect(started).toMatchObject({
      heartbeatAt: startAt,
      processPid: 123,
      processStartedAt: startAt,
      status: 'starting',
    });
    expect(qrReady).toMatchObject({
      heartbeatAt: qrAt,
      lastQrCodeId: 'qr_1',
      lastQrCodeUrl: 'https://example.com/qrcode/1',
      status: 'waiting_for_qr',
    });
    expect(loggedIn).toMatchObject({
      heartbeatAt: loginAt,
      weixinAccountId: 'wx_acc_1',
    });
    expect(running).toMatchObject({
      heartbeatAt: runningAt,
      lastErrorCode: null,
      lastErrorMessage: null,
      restartBackoffUntil: null,
      restartCount: 0,
      status: 'running',
      weixinAccountId: 'wx_acc_1',
    });
    expect(runtimeError).toMatchObject({
      heartbeatAt: errorAt,
      lastErrorCode: 'RUNTIME_ERROR',
      lastErrorMessage: 'FastAgent crashed.',
    });
    expect(degraded).toMatchObject({
      heartbeatAt: degradedAt,
      status: 'degraded',
    });
    expect(stopping).toMatchObject({
      heartbeatAt: stoppingAt,
      status: 'stopping',
    });
    expect(stopped).toMatchObject({
      heartbeatAt: stoppedAt,
      processPid: null,
      processStartedAt: null,
      status: 'stopped',
    });
    expect(consumed).toMatchObject({
      restartRequestedAt: null,
    });
    expect(scheduled).toMatchObject({
      processPid: null,
      processStartedAt: null,
      restartBackoffUntil,
      restartCount: 1,
      status: 'stopped',
    });
    expect(failed).toMatchObject({
      lastErrorCode: 'RUNTIME_ERROR',
      lastErrorMessage: 'Repeated crashes.',
      restartBackoffUntil: null,
      restartCount: 4,
      status: 'failed',
    });
  });

  it('treats provisioning stopped bots as stop candidates without persisting runtime paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-provisioning-stop-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);

    await users.create({
      id: 'user_1',
      email: 'zac@example.com',
      name: 'zac',
    });

    await workspaces.create({
      id: 'ws_1',
      ownerUserId: 'user_1',
      name: 'Default Workspace',
    });

    await botInstances.create({
      id: 'bot_1',
      ownerUserId: 'user_1',
      workspaceId: 'ws_1',
      name: 'Bot One',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      desiredState: 'stopped',
      status: 'provisioning',
    });

    const stopCandidates = await botInstances.findStopCandidates();
    const bot = await botInstances.findById('bot_1');

    expect(stopCandidates.map((candidate) => candidate.id)).toContain('bot_1');
    expect(bot).toMatchObject({
      status: 'provisioning',
      desiredState: 'stopped',
    });
  });

  it('lists bots by owner and llm profile binding', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-db-profile-binding-'));
    tempDirs.push(dir);

    const client = createDatabaseClient({
      url: `file:${join(dir, 'test.sqlite')}`,
    });
    migrateDatabase(client);

    const users = new UserRepository(client.db);
    const workspaces = new WorkspaceRepository(client.db);
    const botInstances = new BotInstanceRepository(client.db);

    await users.create({
      id: 'user_1',
      email: 'zac@example.com',
      name: 'zac',
    });

    await workspaces.create({
      id: 'ws_1',
      ownerUserId: 'user_1',
      name: 'Default Workspace',
    });

    client.connection
      .prepare(
        `INSERT INTO user_llm_profiles (
          id,
          user_id,
          name,
          provider,
          model,
          api_key,
          base_url,
          api_type,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'profile_1',
        'user_1',
        'Primary Anthropic',
        'anthropic',
        'claude-opus-4-6',
        'sk-test',
        null,
        null,
        Date.parse('2026-03-30T00:00:00.000Z'),
        Date.parse('2026-03-30T00:00:00.000Z'),
      );

    await botInstances.create({
      id: 'bot_1',
      ownerUserId: 'user_1',
      workspaceId: 'ws_1',
      name: 'Bot One',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      desiredState: 'running',
      status: 'provisioning',
    });

    await (botInstances as unknown as {
      updateLlmConfigBinding(
        id: string,
        ownerUserId: string,
        llmConfigId: string,
        updatedAt: Date,
      ): Promise<{ id: string; llmConfigId: string | null } | null>;
      listByOwnerUserIdAndLlmConfigId(
        ownerUserId: string,
        llmConfigId: string,
      ): Promise<Array<{ id: string; llmConfigId: string | null }>>;
    }).updateLlmConfigBinding(
      'bot_1',
      'user_1',
      'profile_1',
      new Date('2026-03-30T00:00:01.000Z'),
    );

    const boundBots = await (botInstances as unknown as {
      listByOwnerUserIdAndLlmConfigId(
        ownerUserId: string,
        llmConfigId: string,
      ): Promise<Array<{ id: string; llmConfigId: string | null }>>;
    }).listByOwnerUserIdAndLlmConfigId('user_1', 'profile_1');

    expect(boundBots).toEqual([
      expect.objectContaining({
        id: 'bot_1',
        llmConfigId: 'profile_1',
      }),
    ]);
  });
});
