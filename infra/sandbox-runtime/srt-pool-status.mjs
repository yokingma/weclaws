import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const SRT_POOL_STATUS_FILE_VERSION = 1;

export async function writeStatusFile(statusFilePath, status) {
  await mkdir(dirname(statusFilePath), { recursive: true });
  const tempFile = `${statusFilePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  await rename(tempFile, statusFilePath);
}

export function createStatusDocument({ children, lastErrorMessage, now, pools }) {
  const poolStatuses = pools.map((pool) => {
    const child = children.get(pool.ownerUserId);
    const processAlive = child && child.child.exitCode == null && child.child.signalCode == null;
    const state = resolvePoolState(pool, child);

    return {
      activeSessions: child?.poolStats?.activeSessions ?? null,
      busyProcesses: child?.poolStats?.busyProcesses ?? null,
      cpuPercent: child?.resourceUsage?.cpuPercent ?? null,
      lastErrorMessage: child?.lastErrorMessage ?? null,
      lastExitCode: child?.lastExitCode ?? null,
      lastHealthAt: child?.lastHealthAt ?? null,
      lastRestartAt: child?.lastRestartAt ?? null,
      ownerUserId: pool.ownerUserId,
      pid: processAlive ? child.child.pid ?? null : null,
      poolSize: pool.poolSize,
      portRangeEnd: pool.portRangeEnd,
      portRangeStart: pool.portRangeStart,
      readyProcesses: child?.poolStats?.readyProcesses ?? null,
      rssBytes: child?.resourceUsage?.rssBytes ?? null,
      startedAt: processAlive ? child.startedAt : null,
      state,
      url: pool.url,
    };
  });
  const runningPoolCount = poolStatuses.filter((pool) => pool.state === 'running').length;
  const degradedPoolCount = poolStatuses.filter((pool) => (
    pool.state === 'degraded'
    || pool.state === 'starting'
    || pool.state === 'stopping'
  )).length;
  const failedPoolCount = poolStatuses.filter((pool) => pool.state === 'failed').length;
  const knownActiveSessions = poolStatuses.filter((pool) => pool.activeSessions !== null);
  const totalActiveSessions = knownActiveSessions.length > 0
    ? knownActiveSessions.reduce((sum, pool) => sum + pool.activeSessions, 0)
    : null;

  return {
    manager: {
      cpuPercent: null,
      degradedPoolCount,
      failedPoolCount,
      lastErrorMessage,
      lastReconcileAt: now,
      managedPoolCount: pools.length,
      pid: process.pid,
      rssBytes: process.memoryUsage().rss,
      runningPoolCount,
      state: failedPoolCount > 0 || degradedPoolCount > 0 || lastErrorMessage ? 'degraded' : 'running',
      totalActiveSessions,
      totalPoolSize: pools.reduce((sum, pool) => sum + pool.poolSize, 0),
      uptimeMs: Math.round(process.uptime() * 1000),
    },
    pools: poolStatuses,
    updatedAt: now,
    version: SRT_POOL_STATUS_FILE_VERSION,
  };
}

function resolvePoolState(pool, child) {
  if (!pool.enabled || !child) {
    return 'stopped';
  }

  if (child.child.exitCode != null || child.child.signalCode != null) {
    return child.state === 'failed' ? 'failed' : 'stopped';
  }

  return child.state ?? 'running';
}
