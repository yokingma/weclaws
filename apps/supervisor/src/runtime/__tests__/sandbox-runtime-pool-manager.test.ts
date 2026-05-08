import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error repo-local ESM manager has no TS declaration surface
import { buildChildEnv, createSandboxRuntimePoolManager } from '../../../../../infra/sandbox-runtime/srt-pool-manager.mjs';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('sandbox-runtime pool manager entrypoints', () => {
  it('keeps entry.mjs as manager startup and child entry as patched SandboxAPI startup', async () => {
    const entryPath = fileURLToPath(new URL('../../../../../infra/sandbox-runtime/entry.mjs', import.meta.url));
    const childEntryPath = fileURLToPath(
      new URL('../../../../../infra/sandbox-runtime/srt-child-entry.mjs', import.meta.url),
    );

    const [entryFile, childEntryFile] = await Promise.all([
      readFile(entryPath, 'utf8'),
      readFile(childEntryPath, 'utf8'),
    ]);

    expect(entryFile).toContain('startSandboxRuntimePoolManager');
    expect(childEntryFile).toContain('installWorkspacePathOverride');
    expect(childEntryFile).toContain('new SandboxAPI');
  });
});

describe('sandbox-runtime pool manager', () => {
  it('builds child env from one pool without leaking global sandbox credentials', () => {
    const env = buildChildEnv(createPoolFixture(), {
      API_KEY: 'global-key',
      BROWSERLESS_API_KEY: 'browserless-key',
      BROWSERLESS_API_URL: 'http://browserless:3000',
      PATH: '/usr/bin',
      SANDBOX_URL: 'http://global-sandbox:8788',
    });

    expect(env).toMatchObject({
      API_KEY: 'pool-key',
      AUTH_ENABLED: 'true',
      BROWSERLESS_API_KEY: 'browserless-key',
      BROWSERLESS_API_URL: 'http://browserless:3000',
      FASTAGENT_SANDBOX_ALLOW_HOST_BIND: 'false',
      FASTAGENT_SANDBOX_PROFILE: 'shared',
      HOST: '0.0.0.0',
      MIN_READY_PROCESSES: '1',
      NODE_ENV: 'production',
      PATH: '/usr/bin',
      POOL_SIZE: '3',
      PORT: '31000',
      PORT_RANGE_END: '9199',
      PORT_RANGE_START: '9100',
      SANDBOX_DEFAULT_ALLOW_WRITE: '/tmp',
      SANDBOX_DEFAULT_DENY_READ: '/etc/passwd',
      SANDBOX_DEFAULT_DENY_WRITE: '.env',
      SANDBOX_WORKSPACE_MAP_FILE: '/app/storage/sandbox-runtime-private/workspace-map/user_1.json',
      SESSION_TIMEOUT: '600000',
      WORKSPACE_BASE_PATH: '/app/apps/sandbox-runtime/user-workspaces/user_1',
      WORKSPACE_ENABLED: 'true',
    });
    expect(env.SANDBOX_URL).toBeUndefined();
  });

  it('starts, restarts, stops, and writes status for pool children', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-srt-manager-'));
    tempDirs.push(dir);

    const spawnCalls: Array<{ args: string[]; command: string; env: NodeJS.ProcessEnv }> = [];
    const children: FakeChild[] = [];
    const manager = createSandboxRuntimePoolManager({
      childEntryPath: '/app/infra/sandbox-runtime/srt-child-entry.mjs',
      now: () => new Date('2026-05-02T00:00:00.000Z'),
      spawnProcess: (command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
        const child = new FakeChild(100 + children.length);
        children.push(child);
        spawnCalls.push({ args, command, env: options.env });
        return child;
      },
      statusFilePath: join(dir, 'srt-pool-status.json'),
    });

    await manager.reconcilePools({
      pools: [createPoolFixture()],
      updatedAt: '2026-05-02T00:00:00.000Z',
      version: 1,
    });
    await manager.reconcilePools({
      pools: [createPoolFixture()],
      updatedAt: '2026-05-02T00:01:00.000Z',
      version: 1,
    });
    await manager.reconcilePools({
      pools: [createPoolFixture({ restartRequestedAt: '2026-05-02T00:02:00.000Z' })],
      updatedAt: '2026-05-02T00:02:00.000Z',
      version: 1,
    });
    await manager.reconcilePools({
      pools: [createPoolFixture({ enabled: false, restartRequestedAt: '2026-05-02T00:02:00.000Z' })],
      updatedAt: '2026-05-02T00:03:00.000Z',
      version: 1,
    });

    const status = JSON.parse(await readFile(join(dir, 'srt-pool-status.json'), 'utf8')) as {
      manager: { managedPoolCount: number; runningPoolCount: number };
      pools: Array<{ ownerUserId: string; state: string }>;
    };

    expect(spawnCalls).toHaveLength(2);
    expect(spawnCalls[0]).toMatchObject({
      args: ['/app/infra/sandbox-runtime/srt-child-entry.mjs'],
      command: process.execPath,
    });
    expect(children[0].kill).toHaveBeenCalledWith('SIGTERM');
    expect(children[1].kill).toHaveBeenCalledWith('SIGTERM');
    expect(status.manager.managedPoolCount).toBe(1);
    expect(status.manager.runningPoolCount).toBe(0);
    expect(status.pools[0]).toMatchObject({
      ownerUserId: 'user_1',
      state: 'stopped',
    });
  });
});

class FakeChild extends EventEmitter {
  readonly kill = vi.fn();
  killed = false;
  exitCode: number | null = null;
  pid: number;

  constructor(pid: number) {
    super();
    this.pid = pid;
    this.kill.mockImplementation(() => {
      this.killed = true;
      this.exitCode = 0;
      return true;
    });
  }
}

function createPoolFixture(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: 'pool-key',
    defaultAllowRead: [],
    defaultAllowWrite: ['/tmp'],
    defaultDeniedDomains: [],
    defaultDenyRead: ['/etc/passwd'],
    defaultDenyWrite: ['.env'],
    enabled: true,
    healthCheckIntervalMs: 60_000,
    maxConcurrentInit: 1,
    minReadyProcesses: 1,
    ownerUserId: 'user_1',
    poolSize: 3,
    port: 31_000,
    portRangeEnd: 9_199,
    portRangeStart: 9_100,
    restartRequestedAt: null,
    sessionTimeoutMs: 600_000,
    updatedAt: '2026-05-02T00:00:00.000Z',
    url: 'http://sandbox-runtime:31000',
    workspaceBasePath: '/app/apps/sandbox-runtime/user-workspaces/user_1',
    workspaceMapFile: '/app/storage/sandbox-runtime-private/workspace-map/user_1.json',
    ...overrides,
  };
}
