import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  VIRTUAL_STATE_ROOT,
  VIRTUAL_WORKSPACE_ROOT,
  installSessionSecurityOverrides,
} from '../../../../../infra/sandbox-runtime/workspace-root-override.mjs';

const tempDirs: string[] = [];
const ORIGINAL_BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const ORIGINAL_BROWSERLESS_API_URL = process.env.BROWSERLESS_API_URL;

beforeEach(() => {
  process.env.BROWSERLESS_API_KEY = 'browserless-key';
  process.env.BROWSERLESS_API_URL = 'http://browserless:3000';
});

afterEach(async () => {
  if (ORIGINAL_BROWSERLESS_API_KEY === undefined) {
    delete process.env.BROWSERLESS_API_KEY;
  } else {
    process.env.BROWSERLESS_API_KEY = ORIGINAL_BROWSERLESS_API_KEY;
  }

  if (ORIGINAL_BROWSERLESS_API_URL === undefined) {
    delete process.env.BROWSERLESS_API_URL;
  } else {
    process.env.BROWSERLESS_API_URL = ORIGINAL_BROWSERLESS_API_URL;
  }

  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe('sandbox-runtime session security override', () => {
  it('keeps the outward workspace path real and translates virtual cwd roots back to the real bot scope', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weclaws-sandbox-runtime-session-security-'));
    tempDirs.push(dir);

    const workspacePath = join(dir, 'instances', 'bot_1', 'workspace');
    const dataPath = join(dir, 'instances', 'bot_1', 'data');
    await Promise.all([
      mkdir(join(workspacePath, 'nested'), { recursive: true }),
      mkdir(join(dataPath, 'cache'), { recursive: true }),
    ]);

    class ConfigValidationError extends Error {}

    class FakeSandboxProcessPool {
      workspaceManager = {
        getConfig() {
          return {
            basePath: join(dir, 'sandbox-workspace'),
          };
        },
      };

      async createSession(..._args: unknown[]) {
        return {
          processInfo: {
            id: 'proc_1',
          },
          session: {
            id: 'session_1',
            processId: 'proc_1',
            userId: 'user_1',
            workspaceId: 'ws_1',
            workspacePath,
          },
        };
      }

      async resolveCommandCwd(session: { workspacePath: string }, requestedCwd?: string) {
        return requestedCwd ?? session.workspacePath;
      }

      getWorkspaceFilesystemRestrictions() {
        return {
          allowRead: [],
          allowWrite: [],
          denyRead: [],
          denyWrite: [],
        };
      }
    }

    installSessionSecurityOverrides({
      ConfigValidationError,
      SandboxProcessPool: FakeSandboxProcessPool,
      workspaceMapFile: '/app/storage/sandbox-runtime-private/workspace-map.json',
    });

    const pool = new FakeSandboxProcessPool();
    const { session } = await pool.createSession('user_1', 'ws_1');

    expect(session.workspacePath).toBe(workspacePath);
    await expect(pool.resolveCommandCwd(session, `${VIRTUAL_WORKSPACE_ROOT}/nested`)).resolves.toBe(
      join(workspacePath, 'nested'),
    );
    await expect(pool.resolveCommandCwd(session, `${VIRTUAL_STATE_ROOT}/cache`)).resolves.toBe(
      join(dataPath, 'cache'),
    );
    await expect(
      pool.resolveCommandCwd(session, join(dir, 'instances', 'bot_2', 'workspace')),
    ).rejects.toThrow('cwd must stay within the session workspace root');
  });

  it('recovers the real workspace and state roots for restored sessions that lost internal markers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weclaws-sandbox-runtime-session-security-'));
    tempDirs.push(dir);

    const workspacePath = join(dir, 'instances', 'bot_1', 'workspace');
    const dataPath = join(dir, 'instances', 'bot_1', 'data');
    const workspaceMapFile = join(dir, 'sandbox-runtime-private', 'workspace-map.json');
    await Promise.all([
      mkdir(join(workspacePath, 'nested'), { recursive: true }),
      mkdir(join(dataPath, 'cache'), { recursive: true }),
      mkdir(join(dir, 'sandbox-runtime-private'), { recursive: true }),
      writeFile(workspaceMapFile, JSON.stringify({
        updatedAt: new Date('2026-05-07T00:00:00.000Z').toISOString(),
        version: 1,
        workspaces: {
          ws_1: {
            updatedAt: new Date('2026-05-07T00:00:00.000Z').toISOString(),
            workspacePath,
          },
        },
      })),
    ]);

    class ConfigValidationError extends Error {}

    class FakeSandboxProcessPool {
      workspaceManager = {
        getConfig() {
          return {
            basePath: join(dir, 'sandbox-workspace'),
          };
        },
      };

      async createSession(..._args: unknown[]) {
        throw new Error('not used');
      }

      async resolveCommandCwd(session: { workspacePath: string }, requestedCwd?: string) {
        return requestedCwd ?? session.workspacePath;
      }

      getWorkspaceFilesystemRestrictions() {
        return {
          allowRead: [],
          allowWrite: [],
          denyRead: [],
          denyWrite: [],
        };
      }
    }

    installSessionSecurityOverrides({
      ConfigValidationError,
      SandboxProcessPool: FakeSandboxProcessPool,
      workspaceMapFile,
    });

    const pool = new FakeSandboxProcessPool();
    const restoredSession = {
      id: 'session_1',
      processId: 'proc_1',
      userId: 'user_1',
      workspaceId: 'ws_1',
      workspacePath: VIRTUAL_WORKSPACE_ROOT,
    };

    await expect(pool.resolveCommandCwd(restoredSession, `${VIRTUAL_WORKSPACE_ROOT}/nested`)).resolves.toBe(
      join(workspacePath, 'nested'),
    );
    await expect(pool.resolveCommandCwd(restoredSession, `${VIRTUAL_STATE_ROOT}/cache`)).resolves.toBe(
      join(dataPath, 'cache'),
    );
  });

  it('keeps deny-then-allow read restrictions around the current bot workspace and data roots', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'weclaws-sandbox-runtime-session-security-'));
    tempDirs.push(dir);

    const workspaceBaseRoot = join(dir, 'sandbox-user-workspaces');
    const basePath = join(workspaceBaseRoot, 'user_1');
    const storageRoot = join(dir, 'storage');
    const botWorkspacePath = join(dir, 'storage', 'instances', 'bot_1', 'workspace');
    const botDataPath = join(dir, 'storage', 'instances', 'bot_1', 'data');
    const instancesRoot = join(dir, 'storage', 'instances');
    const privateRoot = join(dir, 'storage', 'sandbox-runtime-private');
    const workspaceMapFile = join(privateRoot, 'workspace-map.json');
    const stateRoot = join(basePath, '.runtime', 'user_1', 'ws_1');
    const metadataRoot = join(basePath, '.runtime-meta', 'user_1', 'ws_1');

    await Promise.all([
      mkdir(botWorkspacePath, { recursive: true }),
      mkdir(botDataPath, { recursive: true }),
      mkdir(stateRoot, { recursive: true }),
      mkdir(metadataRoot, { recursive: true }),
      mkdir(privateRoot, { recursive: true }),
    ]);

    class ConfigValidationError extends Error {}

    class FakeSandboxProcessPool {
      workspaceManager = {
        getConfig() {
          return {
            basePath,
          };
        },
      };

      async createSession(..._args: unknown[]) {
        throw new Error('not used');
      }

      async resolveCommandCwd() {
        return '';
      }

      getWorkspaceFilesystemRestrictions(_executionContext?: unknown) {
        return {
          allowRead: [],
          allowWrite: [],
          denyRead: [],
          denyWrite: [],
        } as Record<string, unknown>;
      }
    }

    installSessionSecurityOverrides({
      ConfigValidationError,
      SandboxProcessPool: FakeSandboxProcessPool,
      workspaceMapFile,
    });

    const pool = new FakeSandboxProcessPool();
    const restrictions = pool.getWorkspaceFilesystemRestrictions({
      metadataRoot,
      stateRoot,
      workspacePath: botWorkspacePath,
    });

    expect(restrictions.allowRead).toEqual([
      botWorkspacePath,
      botDataPath,
      stateRoot,
    ]);
    expect(restrictions.allowWrite).toEqual([
      botWorkspacePath,
      botDataPath,
      stateRoot,
    ]);
    expect(restrictions.virtualPathAliases).toEqual({
      '/workspace': botWorkspacePath,
      '/state': botDataPath,
    });
    expect(restrictions.denyRead).toEqual(expect.arrayContaining([
      storageRoot,
      `${storageRoot}/**`,
      instancesRoot,
      `${instancesRoot}/**`,
      workspaceBaseRoot,
      `${workspaceBaseRoot}/**`,
      basePath,
      `${basePath}/**`,
      privateRoot,
      `${privateRoot}/**`,
    ]));
    expect(restrictions.denyRead).toEqual(expect.arrayContaining([
      '/etc/passwd',
      '/etc/passwd-',
      '/etc/shadow',
      '/etc/shadow-',
      '/etc/group',
      '/etc/group-',
      '/etc/gshadow',
      '/etc/gshadow-',
      '/proc/self/mountinfo',
      '/proc/*/mountinfo',
      '/proc/self/mountstats',
      '/proc/*/mountstats',
      '/proc/1/cmdline',
      '/proc/*/cmdline',
      '/proc/1/environ',
      '/proc/*/environ',
      '/proc/kallsyms',
    ]));
    expect(restrictions.denyRead).toContain(workspaceMapFile);
    expect(restrictions.denyWrite).toEqual(expect.arrayContaining([
      storageRoot,
      `${storageRoot}/**`,
      instancesRoot,
      `${instancesRoot}/**`,
      workspaceBaseRoot,
      `${workspaceBaseRoot}/**`,
      basePath,
      `${basePath}/**`,
      privateRoot,
      `${privateRoot}/**`,
      metadataRoot,
      `${metadataRoot}/**`,
    ]));
    expect(restrictions.denyWrite).toContain(workspaceMapFile);
  });

  it('injects browserless env into session command options without overriding caller values', async () => {
    class ConfigValidationError extends Error {}

    class FakeSandboxProcessPool {
      async createSession(..._args: unknown[]) {
        return {
          processInfo: {
            id: 'proc_1',
          },
          session: {
            id: 'session_1',
            processId: 'proc_1',
            userId: 'user_1',
            workspaceId: 'ws_1',
            workspacePath: '/workspace',
          },
        };
      }

      async resolveCommandCwd(session: { workspacePath: string }, requestedCwd?: string) {
        return requestedCwd ?? session.workspacePath;
      }

      getWorkspaceFilesystemRestrictions() {
        return {
          allowRead: [],
          allowWrite: [],
          denyRead: [],
          denyWrite: [],
        };
      }

      async resolveCommandExecutionOptions(
        _sessionId: string,
        options: { cwd?: string; env?: Record<string, string>; timeout?: number },
      ) {
        return {
          cwd: options.cwd ?? '/workspace',
          env: options.env,
          timeout: options.timeout,
        };
      }
    }

    installSessionSecurityOverrides({
      ConfigValidationError,
      SandboxProcessPool: FakeSandboxProcessPool,
      workspaceMapFile: '/app/storage/sandbox-runtime-private/workspace-map.json',
    });

    const pool = new FakeSandboxProcessPool();

    await expect(pool.resolveCommandExecutionOptions('session_1', {})).resolves.toMatchObject({
      env: {
        BROWSERLESS_API_KEY: 'browserless-key',
        BROWSERLESS_API_URL: 'http://browserless:3000',
      },
    });

    await expect(pool.resolveCommandExecutionOptions('session_1', {
      env: {
        BROWSERLESS_API_KEY: 'custom-key',
      },
    })).resolves.toMatchObject({
      env: {
        BROWSERLESS_API_KEY: 'custom-key',
        BROWSERLESS_API_URL: 'http://browserless:3000',
      },
    });
  });
});
