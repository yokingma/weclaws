import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error repo-local ESM manager has no TS declaration surface
import { buildChildEnv, createSandboxRuntimePoolManager, startHealthServer } from '../../../../../infra/sandbox-runtime/srt-pool-manager.mjs';

const tempDirs: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
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
  it('serves aggregate manager health instead of a static ok response', async () => {
    const server = startHealthServer(0, {
      getHealthSummary: () => ({
        degradedPoolCount: 1,
        failedPoolCount: 0,
        managedPoolCount: 2,
        runningPoolCount: 1,
        state: 'degraded',
      }),
    });
    await new Promise<void>((resolve) => {
      server.once('listening', resolve);
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected health server to listen on a TCP address');
      }
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        degradedPoolCount: 1,
        managedPoolCount: 2,
        runningPoolCount: 1,
        state: 'degraded',
      });
      expect(body).not.toEqual({ ok: true });
    } finally {
      server.close();
    }
  });

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

  it('probes child pool status and writes real health fields', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-srt-manager-health-'));
    tempDirs.push(dir);

    const children: FakeChild[] = [];
    const manager = createSandboxRuntimePoolManager({
      fetchPoolStatus: vi.fn().mockResolvedValue({
        initialized: true,
        shuttingDown: false,
        stats: {
          activeSessions: 2,
          busyProcesses: 1,
          readyProcesses: 2,
        },
      }),
      now: () => new Date('2026-05-02T00:00:00.000Z'),
      spawnProcess: () => {
        const child = new FakeChild(200 + children.length);
        children.push(child);
        return child;
      },
      statusFilePath: join(dir, 'srt-pool-status.json'),
    });

    await manager.reconcilePools({
      pools: [createPoolFixture()],
      updatedAt: '2026-05-02T00:00:00.000Z',
      version: 1,
    });

    const status = JSON.parse(await readFile(join(dir, 'srt-pool-status.json'), 'utf8')) as {
      manager: { degradedPoolCount: number; runningPoolCount: number };
      pools: Array<{
        activeSessions: number | null;
        busyProcesses: number | null;
        lastHealthAt: string | null;
        readyProcesses: number | null;
        state: string;
      }>;
    };

    expect(status.manager.degradedPoolCount).toBe(0);
    expect(status.manager.runningPoolCount).toBe(1);
    expect(status.pools[0]).toMatchObject({
      activeSessions: 2,
      busyProcesses: 1,
      lastHealthAt: '2026-05-02T00:00:00.000Z',
      readyProcesses: 2,
      state: 'running',
    });
  });

  it('restarts a running child when health probing fails outside the startup grace window', async () => {
    const children: FakeChild[] = [];
    const fetchPoolStatus = vi
      .fn()
      .mockResolvedValueOnce({
        initialized: true,
        shuttingDown: false,
        stats: { activeSessions: 0, busyProcesses: 0, readyProcesses: 1 },
      })
      .mockRejectedValueOnce(new Error('connection refused'));
    const manager = createSandboxRuntimePoolManager({
      childHealthStartupGraceMs: 0,
      fetchPoolStatus,
      now: () => new Date('2026-05-02T00:00:00.000Z'),
      spawnProcess: () => {
        const child = new FakeChild(300 + children.length);
        children.push(child);
        return child;
      },
      statusFilePath: join(awaitTempStatusDir(), 'srt-pool-status.json'),
    });

    const document = {
      pools: [createPoolFixture()],
      updatedAt: '2026-05-02T00:00:00.000Z',
      version: 1,
    };

    await manager.reconcilePools(document);
    await manager.reconcilePools(document);

    expect(children).toHaveLength(2);
    expect(children[0].kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('serializes concurrent reconciles so one restart intent only replaces one child once', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weixin-claws-srt-manager-concurrent-'));
    tempDirs.push(dir);

    const children: FakeChild[] = [];
    const manager = createSandboxRuntimePoolManager({
      fetchPoolStatus: vi.fn().mockResolvedValue({
        initialized: true,
        shuttingDown: false,
        stats: { activeSessions: 0, busyProcesses: 0, readyProcesses: 1 },
      }),
      now: () => new Date('2026-05-02T00:00:00.000Z'),
      spawnProcess: () => {
        const child = new FakeChild(500 + children.length, { exitDelayMs: children.length === 0 ? 10 : 0 });
        children.push(child);
        return child;
      },
      statusFilePath: join(dir, 'srt-pool-status.json'),
    });

    await manager.reconcilePools({
      pools: [createPoolFixture()],
      updatedAt: '2026-05-02T00:00:00.000Z',
      version: 1,
    });

    const restartDocument = {
      pools: [createPoolFixture({ restartRequestedAt: '2026-05-02T00:01:00.000Z' })],
      updatedAt: '2026-05-02T00:01:00.000Z',
      version: 1,
    };

    await Promise.all([
      manager.reconcilePools(restartDocument),
      manager.reconcilePools(restartDocument),
    ]);

    expect(children).toHaveLength(2);
    expect(children[0].kill).toHaveBeenCalledTimes(1);
    expect(children[0].kill).toHaveBeenCalledWith('SIGTERM');
    expect(children[1].kill).not.toHaveBeenCalled();
  });

  it('force kills a child that ignores graceful shutdown', async () => {
    vi.useFakeTimers();
    const stubbornChild = new FakeChild(400, { exitOnSignal: false });
    const manager = createSandboxRuntimePoolManager({
      spawnProcess: () => stubbornChild,
      statusFilePath: join(awaitTempStatusDir(), 'srt-pool-status.json'),
      stopGraceMs: 5,
    });

    await manager.reconcilePools({
      pools: [createPoolFixture()],
      updatedAt: '2026-05-02T00:00:00.000Z',
      version: 1,
    });

    const stopPromise = manager.reconcilePools({
      pools: [],
      updatedAt: '2026-05-02T00:01:00.000Z',
      version: 1,
    });

    await vi.advanceTimersByTimeAsync(5);
    stubbornChild.emitExit(0);
    await stopPromise;

    expect(stubbornChild.kill).toHaveBeenCalledWith('SIGTERM');
    expect(stubbornChild.kill).toHaveBeenCalledWith('SIGKILL');
  });
});

class FakeChild extends EventEmitter {
  readonly kill = vi.fn();
  killed = false;
  exitCode: number | null = null;
  pid: number;
  private readonly exitDelayMs: number;
  private readonly exitOnSignal: boolean;

  constructor(pid: number, options: { exitDelayMs?: number; exitOnSignal?: boolean } = {}) {
    super();
    this.exitDelayMs = options.exitDelayMs ?? 0;
    this.exitOnSignal = options.exitOnSignal ?? true;
    this.pid = pid;
    this.kill.mockImplementation((signal: NodeJS.Signals) => {
      this.killed = true;
      if (this.exitOnSignal || signal === 'SIGKILL') {
        if (this.exitDelayMs > 0) {
          setTimeout(() => {
            this.emitExit(0);
          }, this.exitDelayMs);
        } else {
          this.emitExit(0);
        }
      }
      return true;
    });
  }

  emitExit(exitCode: number) {
    this.exitCode = exitCode;
    this.emit('exit', exitCode);
  }
}

function awaitTempStatusDir() {
  const dir = join(tmpdir(), `weixin-claws-srt-manager-${Date.now()}-${Math.random()}`);
  tempDirs.push(dir);
  return dir;
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
