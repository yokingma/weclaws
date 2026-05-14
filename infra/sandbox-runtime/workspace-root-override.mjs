import { readFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

export const WORKSPACE_MAP_VERSION = 1;
export const VIRTUAL_WORKSPACE_ROOT = '/workspace';
export const VIRTUAL_STATE_ROOT = '/state';

const PATCH_MARKER = Symbol.for('weclaws.sandbox-runtime.workspace-root-override');
const SESSION_SECURITY_PATCH_MARKER = Symbol.for(
  'weclaws.sandbox-runtime.workspace-root-override.session-security',
);
const REAL_STATE_PATH_MARKER = Symbol.for(
  'weclaws.sandbox-runtime.workspace-root-override.real-state-path',
);
const REAL_WORKSPACE_PATH_MARKER = Symbol.for(
  'weclaws.sandbox-runtime.workspace-root-override.real-workspace-path',
);
const SENSITIVE_ETC_READ_DENY_PATHS = [
  '/etc/passwd',
  '/etc/passwd-',
  '/etc/shadow',
  '/etc/shadow-',
  '/etc/group',
  '/etc/group-',
  '/etc/gshadow',
  '/etc/gshadow-',
];
const SENSITIVE_PROC_READ_DENY_PATTERNS = [
  '/proc/self/mountinfo',
  '/proc/*/mountinfo',
  '/proc/self/mounts',
  '/proc/*/mounts',
  '/proc/mounts',
  '/proc/self/mountstats',
  '/proc/*/mountstats',
  '/proc/self/cmdline',
  '/proc/1/cmdline',
  '/proc/*/cmdline',
  '/proc/self/environ',
  '/proc/1/environ',
  '/proc/*/environ',
  '/proc/kallsyms',
  '/proc/self/cgroup',
  '/proc/*/cgroup',
  '/proc/cgroups',
];

export async function resolveWorkspacePathOverride({ workspaceId, workspaceMapFile }) {
  return resolveWorkspacePathOverrideSync({ workspaceId, workspaceMapFile });
}

export function resolveWorkspacePathOverrideSync({ workspaceId, workspaceMapFile }) {
  if (!workspaceId || !workspaceMapFile) {
    return null;
  }

  const document = readWorkspaceMapDocument(workspaceMapFile);
  const entry = document.workspaces[workspaceId];

  if (!entry || typeof entry.workspacePath !== 'string' || entry.workspacePath.trim().length === 0) {
    return null;
  }

  return resolve(entry.workspacePath);
}

export function installWorkspacePathOverride({ WorkspaceManager, workspaceMapFile }) {
  if (!workspaceMapFile) {
    return false;
  }

  const prototype = WorkspaceManager?.prototype;

  if (!prototype || typeof prototype.getWorkspacePath !== 'function') {
    throw new Error('WorkspaceManager.getWorkspacePath is required for workspace root override.');
  }

  if (prototype[PATCH_MARKER]) {
    return false;
  }

  const originalGetWorkspacePath = prototype.getWorkspacePath;

  prototype.getWorkspacePath = function patchedGetWorkspacePath(workspaceId, userId) {
    const overrideWorkspacePath = resolveWorkspacePathOverrideSync({
      workspaceId,
      workspaceMapFile,
    });

    if (overrideWorkspacePath) {
      return overrideWorkspacePath;
    }

    return originalGetWorkspacePath.call(this, workspaceId, userId);
  };

  Object.defineProperty(prototype, PATCH_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return true;
}

export function installSessionSecurityOverrides({
  ConfigValidationError,
  SandboxProcessPool,
  workspaceMapFile,
}) {
  if (!workspaceMapFile) {
    return false;
  }

  const prototype = SandboxProcessPool?.prototype;

  if (!prototype
    || typeof prototype.createSession !== 'function'
    || typeof prototype.getWorkspaceFilesystemRestrictions !== 'function'
    || typeof prototype.resolveCommandCwd !== 'function') {
    throw new Error(
      'SandboxProcessPool.createSession/getWorkspaceFilesystemRestrictions/resolveCommandCwd are required.',
    );
  }

  if (prototype[SESSION_SECURITY_PATCH_MARKER]) {
    return false;
  }

  const originalCreateSession = prototype.createSession;
  const originalGetWorkspaceFilesystemRestrictions = prototype.getWorkspaceFilesystemRestrictions;

  prototype.createSession = async function patchedCreateSession(...args) {
    const result = await originalCreateSession.apply(this, args);

    if (result?.session) {
      virtualizeSessionPaths(result.session);
    }

    return result;
  };

  prototype.getWorkspaceFilesystemRestrictions = function patchedGetWorkspaceFilesystemRestrictions(
    executionContext,
  ) {
    if (!executionContext?.workspacePath || !executionContext?.stateRoot) {
      return originalGetWorkspaceFilesystemRestrictions.call(this, executionContext);
    }

    const projectRoot = process.cwd();
    const basePath = normalizeOptionalPath(this.workspaceManager?.getConfig?.().basePath);
    const workspaceMapPath = normalizeOptionalPath(workspaceMapFile);
    const realWorkspacePath = resolve(executionContext.workspacePath);
    const realStatePath = resolve(executionContext.stateRoot);
    const metadataRoot = executionContext.metadataRoot
      ? resolve(executionContext.metadataRoot)
      : null;
    const persistentStatePath = derivePersistentStatePath(realWorkspacePath);
    const instancesRoot = deriveInstancesRoot(realWorkspacePath);
    const storageRoot = deriveParentPath(instancesRoot);
    const workspaceBaseRoot = deriveParentPath(basePath);
    const workspaceMapPrivateRoot = workspaceMapPath
      ? deriveWorkspaceMapPrivateRoot(workspaceMapPath)
      : null;

    return {
      allowRead: uniquePaths([
        realWorkspacePath,
        persistentStatePath,
        realStatePath,
      ]),
      allowWrite: uniquePaths([
        realWorkspacePath,
        persistentStatePath,
        realStatePath,
      ]),
      denyRead: uniquePaths([
        ...denyPathAndDescendants(storageRoot),
        ...denyPathAndDescendants(instancesRoot),
        ...denyPathAndDescendants(workspaceBaseRoot),
        ...denyPathAndDescendants(basePath),
        ...denyPathAndDescendants(workspaceMapPrivateRoot),
        ...denyPathAndDescendants(metadataRoot),
        workspaceMapPath,
        `${projectRoot}/.env`,
        `${projectRoot}/.env.*`,
        ...denyPathAndDescendants(join(projectRoot, 'node_modules')),
        ...denyPathAndDescendants(join(projectRoot, 'infra')),
        ...denyPathAndDescendants(join(projectRoot, 'src')),
        ...denyPathAndDescendants(join(projectRoot, 'dist')),
        ...denyPathAndDescendants(join(projectRoot, 'tests')),
        ...SENSITIVE_ETC_READ_DENY_PATHS,
        ...SENSITIVE_PROC_READ_DENY_PATTERNS,
        '/root',
        '~/.ssh',
        '~/.aws',
      ]),
      denyWrite: uniquePaths([
        ...denyPathAndDescendants(storageRoot),
        ...denyPathAndDescendants(instancesRoot),
        ...denyPathAndDescendants(workspaceBaseRoot),
        ...denyPathAndDescendants(basePath),
        ...denyPathAndDescendants(workspaceMapPrivateRoot),
        ...denyPathAndDescendants(metadataRoot),
        workspaceMapPath,
        `${projectRoot}/**`,
        '/etc/**',
        '/root/**',
        '~/.ssh/**',
        '~/.aws/**',
      ]),
      virtualPathAliases: {
        [VIRTUAL_WORKSPACE_ROOT]: realWorkspacePath,
        [VIRTUAL_STATE_ROOT]: persistentStatePath,
      },
    };
  };

  prototype.resolveCommandCwd = async function patchedResolveCommandCwd(session, requestedCwd) {
    const realWorkspacePath = getRealWorkspacePath(session)
      ?? resolveSessionWorkspacePathFromMap({
        session,
        workspaceMapFile,
      });

    if (!realWorkspacePath) {
      return requestedCwd ?? session?.workspacePath;
    }

    const realStatePath = getRealStatePath(session) ?? derivePersistentStatePath(realWorkspacePath);
    const candidateCwd = requestedCwd
      ? resolveRequestedCwd(requestedCwd, realWorkspacePath, realStatePath)
      : realWorkspacePath;

    for (const allowedRoot of [realWorkspacePath, realStatePath]) {
      if (!allowedRoot) {
        continue;
      }

      try {
        const normalizedCwd = assertPathContained(allowedRoot, candidateCwd);
        await assertRealPathContained(allowedRoot, normalizedCwd);
        return normalizedCwd;
      } catch {
        continue;
      }
    }

    throw new ConfigValidationError('cwd must stay within the session workspace root', [
      `allowed virtual roots: ${VIRTUAL_WORKSPACE_ROOT}, ${VIRTUAL_STATE_ROOT}`,
    ]);
  };

  Object.defineProperty(prototype, SESSION_SECURITY_PATCH_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return true;
}

function readWorkspaceMapDocument(workspaceMapFile) {
  try {
    const rawDocument = readFileSync(workspaceMapFile, 'utf8');
    return parseWorkspaceMapDocument(rawDocument);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return createEmptyWorkspaceMapDocument();
    }

    throw error;
  }
}

function virtualizeSessionPaths(session) {
  if (!session || typeof session !== 'object') {
    return session;
  }

  const currentWorkspacePath = typeof session.workspacePath === 'string'
    ? session.workspacePath
    : null;
  const existingRealWorkspacePath = getRealWorkspacePath(session);

  if (!currentWorkspacePath && !existingRealWorkspacePath) {
    return session;
  }

  const realWorkspacePath = existingRealWorkspacePath ?? resolve(currentWorkspacePath);
  const realStatePath = getRealStatePath(session) ?? derivePersistentStatePath(realWorkspacePath);

  Object.defineProperty(session, REAL_WORKSPACE_PATH_MARKER, {
    configurable: true,
    enumerable: false,
    value: realWorkspacePath,
    writable: true,
  });
  Object.defineProperty(session, REAL_STATE_PATH_MARKER, {
    configurable: true,
    enumerable: false,
    value: realStatePath,
    writable: true,
  });

  session.workspacePath = VIRTUAL_WORKSPACE_ROOT;
  return session;
}

function resolveRequestedCwd(requestedCwd, realWorkspacePath, realStatePath) {
  const translatedCwd = translateVirtualPathToRealPath({
    realStatePath,
    realWorkspacePath,
    requestedPath: requestedCwd,
  });

  if (isAbsolute(translatedCwd)) {
    return translatedCwd;
  }

  return resolve(realWorkspacePath, translatedCwd);
}

function translateVirtualPathToRealPath({ realStatePath, realWorkspacePath, requestedPath }) {
  if (!isAbsolute(requestedPath)) {
    return requestedPath;
  }

  if (requestedPath === VIRTUAL_WORKSPACE_ROOT) {
    return realWorkspacePath;
  }

  if (requestedPath.startsWith(`${VIRTUAL_WORKSPACE_ROOT}/`)) {
    return join(realWorkspacePath, requestedPath.slice(VIRTUAL_WORKSPACE_ROOT.length + 1));
  }

  if (requestedPath === VIRTUAL_STATE_ROOT) {
    return realStatePath;
  }

  if (requestedPath.startsWith(`${VIRTUAL_STATE_ROOT}/`)) {
    return join(realStatePath, requestedPath.slice(VIRTUAL_STATE_ROOT.length + 1));
  }

  return requestedPath;
}

function getRealWorkspacePath(session) {
  return session?.[REAL_WORKSPACE_PATH_MARKER] ?? null;
}

function getRealStatePath(session) {
  return session?.[REAL_STATE_PATH_MARKER] ?? null;
}

function resolveSessionWorkspacePathFromMap({ session, workspaceMapFile }) {
  const workspaceId = typeof session?.workspaceId === 'string' && session.workspaceId.length > 0
    ? session.workspaceId
    : null;

  if (!workspaceId || !workspaceMapFile) {
    return null;
  }

  return resolveWorkspacePathOverrideSync({
    workspaceId,
    workspaceMapFile,
  });
}

function derivePersistentStatePath(realWorkspacePath) {
  return join(dirname(resolve(realWorkspacePath)), 'data');
}

function deriveInstancesRoot(realWorkspacePath) {
  return dirname(dirname(resolve(realWorkspacePath)));
}

function deriveParentPath(path) {
  if (!path) {
    return null;
  }

  const normalizedPath = resolve(path);
  const parentPath = dirname(normalizedPath);

  return parentPath === normalizedPath ? null : parentPath;
}

function deriveWorkspaceMapPrivateRoot(workspaceMapFile) {
  const mapDirectory = dirname(resolve(workspaceMapFile));

  if (basename(mapDirectory) === 'workspace-map') {
    return deriveParentPath(mapDirectory);
  }

  return mapDirectory;
}

function denyPathAndDescendants(path) {
  if (!path) {
    return [];
  }

  const normalizedPath = resolve(path);

  if (dirname(normalizedPath) === normalizedPath) {
    return [normalizedPath];
  }

  return [normalizedPath, `${normalizedPath}/**`];
}

function normalizeOptionalPath(path) {
  return typeof path === 'string' && path.trim().length > 0
    ? resolve(path)
    : null;
}

function uniquePaths(paths) {
  const nextPaths = [];
  const seenPaths = new Set();

  for (const value of paths) {
    if (!value || seenPaths.has(value)) {
      continue;
    }

    seenPaths.add(value);
    nextPaths.push(value);
  }

  return nextPaths;
}

function assertPathContained(rootPath, candidatePath) {
  const normalizedRootPath = resolve(rootPath);
  const normalizedCandidatePath = resolve(candidatePath);
  const relativePath = relative(normalizedRootPath, normalizedCandidatePath);

  if (relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))) {
    return normalizedCandidatePath;
  }

  throw new Error(`Path "${normalizedCandidatePath}" is outside the allowed root "${normalizedRootPath}"`);
}

async function assertRealPathContained(rootPath, candidatePath) {
  const normalizedRootPath = await realpath(rootPath);
  const normalizedCandidatePath = await realpath(candidatePath);
  const relativePath = relative(normalizedRootPath, normalizedCandidatePath);

  if (relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))) {
    return normalizedCandidatePath;
  }

  throw new Error(`Path "${normalizedCandidatePath}" is outside the allowed root "${normalizedRootPath}"`);
}

function parseWorkspaceMapDocument(rawDocument) {
  const fallbackDocument = createEmptyWorkspaceMapDocument();
  const parsedDocument = JSON.parse(rawDocument);

  if (!isRecord(parsedDocument) || !isRecord(parsedDocument.workspaces)) {
    return fallbackDocument;
  }

  const workspaces = Object.fromEntries(
    Object.entries(parsedDocument.workspaces)
      .filter(([, entry]) => isRecord(entry) && typeof entry.workspacePath === 'string')
      .map(([workspaceId, entry]) => [
        workspaceId,
        {
          workspacePath: resolve(entry.workspacePath),
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : fallbackDocument.updatedAt,
        },
      ]),
  );

  return {
    version: WORKSPACE_MAP_VERSION,
    updatedAt: typeof parsedDocument.updatedAt === 'string'
      ? parsedDocument.updatedAt
      : fallbackDocument.updatedAt,
    workspaces,
  };
}

function createEmptyWorkspaceMapDocument() {
  return {
    version: WORKSPACE_MAP_VERSION,
    updatedAt: new Date(0).toISOString(),
    workspaces: {},
  };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
