import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStatusDocument, writeStatusFile } from './srt-pool-status.mjs';
import { readProcessResourceUsage } from './srt-resource-collector.mjs';

const DEFAULT_CONFIG_FILE = '/app/storage/sandbox-runtime-private/srt-pools.json';
const DEFAULT_STATUS_FILE = '/app/storage/sandbox-runtime-private/srt-pool-status.json';
const DEFAULT_MANAGER_PORT = 8788;
const DEFAULT_RECONCILE_INTERVAL_MS = 2_000;
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CHILD_ENTRY = join(CURRENT_DIR, 'srt-child-entry.mjs');
const SAFE_BASE_ENV_KEYS = [
  'BROWSERLESS_API_KEY',
  'BROWSERLESS_API_URL',
  'HOME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'NODE_EXTRA_CA_CERTS',
  'PATH',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'TEMP',
  'TMP',
  'TMPDIR',
  'TZ',
];

export async function startSandboxRuntimePoolManager(options = {}) {
  const configFilePath = options.configFilePath ?? process.env.SRT_POOL_CONFIG_FILE ?? DEFAULT_CONFIG_FILE;
  const statusFilePath = options.statusFilePath ?? process.env.SRT_POOL_STATUS_FILE ?? DEFAULT_STATUS_FILE;
  const managerPort = parseInteger(process.env.SRT_MANAGER_PORT, DEFAULT_MANAGER_PORT);
  const manager = createSandboxRuntimePoolManager({
    childEntryPath: options.childEntryPath ?? DEFAULT_CHILD_ENTRY,
    statusFilePath,
  });

  const reconcileFromFile = async () => {
    try {
      await manager.reconcilePools(await readPoolConfig(configFilePath));
    } catch (error) {
      console.error('Failed to reconcile sandbox runtime pools.');
      console.error(error);
      await manager.writeStatus([], error instanceof Error ? error.message : String(error));
    }
  };

  await reconcileFromFile();
  const healthServer = startHealthServer(managerPort);
  const interval = setInterval(() => {
    void reconcileFromFile();
  }, options.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS);
  const watcher = startConfigWatcher(configFilePath, reconcileFromFile);

  const shutdown = async () => {
    clearInterval(interval);
    watcher.close();
    healthServer.close();
    await manager.stopAll();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });

  return manager;
}

export function createSandboxRuntimePoolManager(options = {}) {
  const children = new Map();
  const spawnProcess = options.spawnProcess ?? spawn;
  const childEntryPath = options.childEntryPath ?? DEFAULT_CHILD_ENTRY;
  const statusFilePath = options.statusFilePath ?? process.env.SRT_POOL_STATUS_FILE ?? DEFAULT_STATUS_FILE;
  const now = options.now ?? (() => new Date());

  return {
    children,
    async reconcilePools(document) {
      const pools = Array.isArray(document?.pools) ? document.pools : [];
      const desiredOwnerIds = new Set(pools.map((pool) => pool.ownerUserId));

      for (const [ownerUserId, managedChild] of children.entries()) {
        if (!desiredOwnerIds.has(ownerUserId)) {
          stopManagedChild(managedChild);
          children.delete(ownerUserId);
        }
      }

      for (const pool of pools) {
        const existing = children.get(pool.ownerUserId);

        if (!pool.enabled) {
          if (existing) {
            stopManagedChild(existing);
            children.delete(pool.ownerUserId);
          }
          continue;
        }

        const configHash = hashPoolConfig(pool);
        if (existing && existing.configHash === configHash && existing.child.exitCode === null && !existing.child.killed) {
          continue;
        }

        if (existing) {
          stopManagedChild(existing);
          children.delete(pool.ownerUserId);
        }

        const child = spawnProcess(process.execPath, [childEntryPath], {
          env: buildChildEnv(pool, process.env),
          stdio: ['ignore', 'inherit', 'inherit'],
        });
        const managedChild = {
          child,
          configHash,
          lastErrorMessage: null,
          lastExitCode: null,
          lastHealthAt: null,
          lastRestartAt: pool.restartRequestedAt,
          ownerUserId: pool.ownerUserId,
          resourceUsage: null,
          startedAt: now().toISOString(),
        };

        child.on?.('exit', (exitCode) => {
          managedChild.lastExitCode = exitCode;
        });
        children.set(pool.ownerUserId, managedChild);
      }

      await collectResources(children);
      await this.writeStatus(pools, null);
    },
    async stopAll() {
      for (const managedChild of children.values()) {
        stopManagedChild(managedChild);
      }
      children.clear();
      await this.writeStatus([], null);
    },
    async writeStatus(pools, lastErrorMessage) {
      const timestamp = now().toISOString();
      await writeStatusFile(statusFilePath, createStatusDocument({
        children,
        lastErrorMessage,
        now: timestamp,
        pools,
      }));
    },
  };
}

export function buildChildEnv(pool, baseEnv = process.env) {
  return {
    ...pickBaseEnv(baseEnv),
    API_KEY: pool.apiKey,
    AUTH_ENABLED: 'true',
    FASTAGENT_SANDBOX_ALLOW_HOST_BIND: 'false',
    FASTAGENT_SANDBOX_PROFILE: 'shared',
    HEALTH_CHECK_INTERVAL: String(pool.healthCheckIntervalMs),
    HOST: '0.0.0.0',
    MAX_CONCURRENT_INIT: String(pool.maxConcurrentInit),
    MIN_READY_PROCESSES: String(pool.minReadyProcesses),
    NODE_ENV: 'production',
    POOL_SIZE: String(pool.poolSize),
    PORT: String(pool.port),
    PORT_RANGE_END: String(pool.portRangeEnd),
    PORT_RANGE_START: String(pool.portRangeStart),
    SANDBOX_DEFAULT_ALLOW_READ: pool.defaultAllowRead.join(','),
    SANDBOX_DEFAULT_ALLOW_WRITE: pool.defaultAllowWrite.join(','),
    SANDBOX_DEFAULT_DENIED_DOMAINS: pool.defaultDeniedDomains.join(','),
    SANDBOX_DEFAULT_DENY_READ: pool.defaultDenyRead.join(','),
    SANDBOX_DEFAULT_DENY_WRITE: pool.defaultDenyWrite.join(','),
    SANDBOX_WORKSPACE_MAP_FILE: pool.workspaceMapFile,
    SESSION_TIMEOUT: String(pool.sessionTimeoutMs),
    WORKSPACE_BASE_PATH: pool.workspaceBasePath,
    WORKSPACE_ENABLED: 'true',
  };
}

export async function readPoolConfig(configFilePath) {
  try {
    return JSON.parse(await readFile(configFilePath, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return {
        pools: [],
        updatedAt: new Date(0).toISOString(),
        version: 1,
      };
    }

    throw error;
  }
}

export function startHealthServer(port) {
  const server = http.createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404);
    response.end();
  });
  server.listen(port, '0.0.0.0');
  return server;
}

function startConfigWatcher(configFilePath, reconcileFromFile) {
  try {
    return watch(configFilePath, () => {
      void reconcileFromFile();
    });
  } catch {
    return {
      close() {},
    };
  }
}

async function collectResources(children) {
  await Promise.all([...children.values()].map(async (managedChild) => {
    if (!managedChild.child.pid) {
      return;
    }

    managedChild.resourceUsage = await readProcessResourceUsage(
      managedChild.child.pid,
      managedChild.resourceUsage,
    );
  }));
}

function hashPoolConfig(pool) {
  return createHash('sha256').update(JSON.stringify({
    apiKey: pool.apiKey,
    defaultAllowRead: pool.defaultAllowRead,
    defaultAllowWrite: pool.defaultAllowWrite,
    defaultDeniedDomains: pool.defaultDeniedDomains,
    defaultDenyRead: pool.defaultDenyRead,
    defaultDenyWrite: pool.defaultDenyWrite,
    enabled: pool.enabled,
    healthCheckIntervalMs: pool.healthCheckIntervalMs,
    maxConcurrentInit: pool.maxConcurrentInit,
    minReadyProcesses: pool.minReadyProcesses,
    poolSize: pool.poolSize,
    port: pool.port,
    portRangeEnd: pool.portRangeEnd,
    portRangeStart: pool.portRangeStart,
    restartRequestedAt: pool.restartRequestedAt,
    sessionTimeoutMs: pool.sessionTimeoutMs,
    workspaceBasePath: pool.workspaceBasePath,
    workspaceMapFile: pool.workspaceMapFile,
  })).digest('hex');
}

function parseInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pickBaseEnv(baseEnv) {
  return Object.fromEntries(
    Object.entries(baseEnv).filter(([key, value]) => value && SAFE_BASE_ENV_KEYS.includes(key)),
  );
}

function stopManagedChild(managedChild) {
  if (managedChild.child.exitCode === null && !managedChild.child.killed) {
    managedChild.child.kill('SIGTERM');
  }
}
