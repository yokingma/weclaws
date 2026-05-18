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
const DEFAULT_CHILD_HEALTH_STARTUP_GRACE_MS = 10_000;
const DEFAULT_CHILD_HEALTH_TIMEOUT_MS = 1_500;
const DEFAULT_STOP_GRACE_MS = 3_000;
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CHILD_ENTRY = join(CURRENT_DIR, 'srt-child-entry.mjs');
const SAFE_BASE_ENV_KEYS = [
  'BROWSERLESS_API_KEY',
  'BROWSERLESS_API_URL',
  'HOME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LOG_LEVEL',
  'NODE_EXTRA_CA_CERTS',
  'PATH',
  'SANDBOX_COMMAND_EXTRA_PATHS',
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
  const healthServer = startHealthServer(managerPort, manager);
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
  const childHealthStartupGraceMs = options.childHealthStartupGraceMs ?? DEFAULT_CHILD_HEALTH_STARTUP_GRACE_MS;
  const childHealthTimeoutMs = options.childHealthTimeoutMs ?? DEFAULT_CHILD_HEALTH_TIMEOUT_MS;
  const fetchPoolStatus = options.fetchPoolStatus ?? fetchPoolStatusOverHttp;
  const stopGraceMs = options.stopGraceMs ?? DEFAULT_STOP_GRACE_MS;
  let operationQueue = Promise.resolve();
  let lastStatusDocument = createStatusDocument({
    children,
    lastErrorMessage: null,
    now: now().toISOString(),
    pools: [],
  });

  const manager = {
    children,
    reconcilePools(document) {
      return serializeOperation(() => runReconcilePools(document));
    },
    stopAll() {
      return serializeOperation(runStopAll);
    },
    getHealthSummary() {
      return lastStatusDocument.manager;
    },
    writeStatus(pools, lastErrorMessage) {
      return serializeOperation(() => writeStatus(pools, lastErrorMessage));
    },
  };

  return manager;

  function serializeOperation(operation) {
    const nextOperation = operationQueue.catch(() => {}).then(operation);
    operationQueue = nextOperation.catch(() => {});
    return nextOperation;
  }

  async function runReconcilePools(document) {
    const pools = Array.isArray(document?.pools) ? document.pools : [];
    const desiredOwnerIds = new Set(pools.map((pool) => pool.ownerUserId));

    for (const [ownerUserId, managedChild] of children.entries()) {
      if (!desiredOwnerIds.has(ownerUserId)) {
        await stopManagedChild(managedChild, { stopGraceMs });
        children.delete(ownerUserId);
      }
    }

    for (const pool of pools) {
      const existing = children.get(pool.ownerUserId);

      if (!pool.enabled) {
        if (existing) {
          await stopManagedChild(existing, { stopGraceMs });
          children.delete(pool.ownerUserId);
        }
        continue;
      }

      const configHash = hashPoolConfig(pool);
      if (existing && existing.configHash === configHash && isManagedChildRunning(existing)) {
        const healthy = await refreshManagedChildHealth(existing, pool, {
          childHealthStartupGraceMs,
          childHealthTimeoutMs,
          fetchPoolStatus,
          now,
        });

        if (healthy) {
          continue;
        }
      }

      if (existing) {
        await stopManagedChild(existing, { stopGraceMs });
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
        poolStats: null,
        resourceUsage: null,
        startedAt: now().toISOString(),
        state: 'starting',
      };

      child.on?.('exit', (exitCode) => {
        managedChild.lastExitCode = exitCode;
        managedChild.state = 'stopped';
      });
      children.set(pool.ownerUserId, managedChild);
      await refreshManagedChildHealth(managedChild, pool, {
        childHealthStartupGraceMs,
        childHealthTimeoutMs,
        fetchPoolStatus,
        now,
      });
    }

    await collectResources(children);
    await writeStatus(pools, null);
  }

  async function runStopAll() {
    for (const managedChild of children.values()) {
      await stopManagedChild(managedChild, { stopGraceMs });
    }
    children.clear();
    await writeStatus([], null);
  }

  async function writeStatus(pools, lastErrorMessage) {
    const timestamp = now().toISOString();
    lastStatusDocument = createStatusDocument({
      children,
      lastErrorMessage,
      now: timestamp,
      pools,
    });
    await writeStatusFile(statusFilePath, lastStatusDocument);
  }
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

export function startHealthServer(port, manager = null) {
  const server = http.createServer((request, response) => {
    if (request.url === '/health') {
      const healthSummary = manager?.getHealthSummary?.() ?? { state: 'starting' };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(healthSummary));
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

async function refreshManagedChildHealth(managedChild, pool, options) {
  if (!isManagedChildRunning(managedChild)) {
    managedChild.state = 'stopped';
    return false;
  }

  try {
    const status = await options.fetchPoolStatus(pool, { timeoutMs: options.childHealthTimeoutMs });
    managedChild.lastErrorMessage = null;
    managedChild.lastHealthAt = options.now().toISOString();
    managedChild.poolStats = normalizePoolStats(status?.stats);
    managedChild.state = status?.initialized !== false && status?.shuttingDown !== true
      ? 'running'
      : getStartupState(managedChild, options);
    return managedChild.state === 'running' || managedChild.state === 'starting';
  } catch (error) {
    managedChild.lastErrorMessage = error instanceof Error ? error.message : String(error);
    managedChild.poolStats = null;
    managedChild.state = getStartupState(managedChild, options);
    return managedChild.state === 'starting';
  }
}

function getStartupState(managedChild, options) {
  return isWithinStartupGrace(managedChild, options) ? 'starting' : 'degraded';
}

function isWithinStartupGrace(managedChild, options) {
  const startedAtMs = Date.parse(managedChild.startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return false;
  }

  return options.now().getTime() - startedAtMs < options.childHealthStartupGraceMs;
}

function normalizePoolStats(stats) {
  return {
    activeSessions: normalizeNonNegativeInteger(stats?.activeSessions),
    busyProcesses: normalizeNonNegativeInteger(stats?.busyProcesses),
    readyProcesses: normalizeNonNegativeInteger(stats?.readyProcesses),
  };
}

function normalizeNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function fetchPoolStatusOverHttp(pool, options) {
  return new Promise((resolve, reject) => {
    const request = http.get({
      headers: {
        'x-api-key': pool.apiKey,
      },
      hostname: '127.0.0.1',
      path: '/pool/status',
      port: pool.port,
      timeout: options.timeoutMs,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Pool status probe failed with HTTP ${response.statusCode ?? 'unknown'}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Pool status probe timed out after ${options.timeoutMs}ms`));
    });
    request.on('error', reject);
  });
}

function isManagedChildRunning(managedChild) {
  return !hasChildExited(managedChild.child);
}

function hasChildExited(child) {
  return child.exitCode != null || child.signalCode != null;
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

async function stopManagedChild(managedChild, options) {
  if (!isManagedChildRunning(managedChild)) {
    managedChild.state = 'stopped';
    return;
  }

  managedChild.state = 'stopping';
  managedChild.child.kill('SIGTERM');

  const exitedGracefully = await waitForChildExit(managedChild.child, options.stopGraceMs);
  if (!exitedGracefully && isManagedChildRunning(managedChild)) {
    managedChild.child.kill('SIGKILL');
    await waitForChildExit(managedChild.child, options.stopGraceMs);
  }

  managedChild.state = isManagedChildRunning(managedChild) ? 'failed' : 'stopped';
}

function waitForChildExit(child, timeoutMs) {
  if (hasChildExited(child)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let timer = null;
    const handleExit = () => {
      cleanup();
      resolve(true);
    };
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
      }
      child.off?.('exit', handleExit);
      child.removeListener?.('exit', handleExit);
    };

    child.once?.('exit', handleExit);
    timer = setTimeout(() => {
      cleanup();
      resolve(hasChildExited(child));
    }, timeoutMs);
  });
}
