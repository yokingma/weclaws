import { mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const WORKER_BOOTSTRAP_PATCH_MARKER = Symbol.for(
  'weclaws.sandbox-runtime.worker-bootstrap.writable-rebind',
);
const LINUX_MTAB_DENY_TARGET = '/etc/mtab';
const VIRTUAL_WORKSPACE_ROOT = '/workspace';
const VIRTUAL_STATE_ROOT = '/state';
const WORKSPACE_DIRECTORY_NAME = 'workspace';
const DATA_DIRECTORY_NAME = 'data';

await installLinuxWritableRebindBootstrap();

export function collectWritablePathsNeedingRebind(filesystem = {}) {
  const allowWrite = Array.isArray(filesystem.allowWrite) ? filesystem.allowWrite : [];
  const denyRead = Array.isArray(filesystem.denyRead) ? filesystem.denyRead : [];
  const denyReadRoots = uniquePaths(
    denyRead
      .map(stripRecursiveGlobSuffix)
      .filter((pattern) => pattern.length > 0 && !containsGlobChars(pattern))
      .map((pattern) => resolve(pattern)),
  );

  return uniquePaths(
    allowWrite
      .map((path) => resolve(path))
      .filter((path) => denyReadRoots.some((denyRoot) => isSameOrDescendant(path, denyRoot))),
  );
}

export function injectWritableRebindArgs(args, writablePaths, virtualPathAliases = {}) {
  const normalizedWritablePaths = Array.isArray(writablePaths) ? writablePaths : [];
  const explicitVirtualPathAliases = isRecord(virtualPathAliases) ? virtualPathAliases : {};

  if (
    !Array.isArray(args)
    || args.length === 0
    || (normalizedWritablePaths.length === 0 && Object.keys(explicitVirtualPathAliases).length === 0)
  ) {
    return Array.isArray(args) ? [...args] : [];
  }

  const sanitizedArgs = stripFatalLinuxReadDenyArgs(args);
  const separatorIndex = sanitizedArgs.indexOf('--');

  if (separatorIndex === -1) {
    return sanitizedArgs;
  }

  const insertionIndex = findWritableRebindInsertionIndex(sanitizedArgs, separatorIndex);
  const virtualAliasBinds = resolveVirtualAliasBinds(normalizedWritablePaths, explicitVirtualPathAliases);

  return [
    ...sanitizedArgs.slice(0, insertionIndex),
    ...normalizedWritablePaths.flatMap((path) => ['--bind', path, path]),
    ...virtualAliasBinds.flatMap(({ source, target }) => ['--bind', source, target]),
    ...sanitizedArgs.slice(insertionIndex),
  ];
}

export function stripFatalLinuxReadDenyArgs(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return [];
  }

  const sanitizedArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const nextToken = args[index + 1];
    const thirdToken = args[index + 2];

    if ((token === '--ro-bind' || token === '--bind') && nextToken === '/dev/null' && thirdToken === LINUX_MTAB_DENY_TARGET) {
      index += 2;
      continue;
    }

    sanitizedArgs.push(token);
  }

  return sanitizedArgs;
}

export async function installLinuxWritableRebindBootstrap({
  runtimePackageRoot = process.env.WECLAWS_SANDBOX_RUNTIME_PACKAGE_ROOT
    ?? process.env.FASTAGENT_SANDBOX_RUNTIME_PACKAGE_ROOT
    ?? null,
} = {}) {
  if (process.platform !== 'linux' || !runtimePackageRoot) {
    return false;
  }

  const runtimeRequire = createRequire(pathToFileURL(resolve(runtimePackageRoot, 'package.json')));
  const sandboxManagerModulePath = runtimeRequire.resolve(
    '@anthropic-ai/sandbox-runtime/dist/sandbox/sandbox-manager.js',
  );
  const shellQuoteModulePath = runtimeRequire.resolve('shell-quote');
  const [
    { SandboxManager },
    { default: shellquote },
  ] = await Promise.all([
    import(pathToFileURL(sandboxManagerModulePath).href),
    import(pathToFileURL(shellQuoteModulePath).href),
  ]);

  if (!SandboxManager || SandboxManager[WORKER_BOOTSTRAP_PATCH_MARKER]) {
    return false;
  }

  const originalWrapWithSandbox = SandboxManager.wrapWithSandbox.bind(SandboxManager);

  SandboxManager.wrapWithSandbox = async function patchedWrapWithSandbox(
    command,
    binShell,
    customConfig,
    abortSignal,
  ) {
    const wrappedCommand = await originalWrapWithSandbox(command, binShell, customConfig, abortSignal);
    const filesystem = customConfig?.filesystem ?? SandboxManager.getConfig?.()?.filesystem ?? {};
    const writablePaths = collectWritablePathsNeedingRebind(filesystem);
    const virtualPathAliases = isRecord(filesystem.virtualPathAliases)
      ? filesystem.virtualPathAliases
      : {};

    if (writablePaths.length === 0 && Object.keys(virtualPathAliases).length === 0) {
      return wrappedCommand;
    }

    const parsedArgs = shellquote.parse(wrappedCommand).map((token) => String(token));
    ensureVirtualAliasMountPoints(resolveVirtualAliasBinds(writablePaths, virtualPathAliases));
    const rewrittenArgs = injectWritableRebindArgs(parsedArgs, writablePaths, virtualPathAliases);

    if (rewrittenArgs.length === parsedArgs.length) {
      return wrappedCommand;
    }

    return shellquote.quote(rewrittenArgs);
  };

  Object.defineProperty(SandboxManager, WORKER_BOOTSTRAP_PATCH_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return true;
}

export function resolveVirtualAliasBinds(writablePaths, virtualPathAliases = {}) {
  const normalizedWritablePaths = Array.isArray(writablePaths) ? writablePaths : [];
  const explicitVirtualPathAliases = isRecord(virtualPathAliases) ? virtualPathAliases : {};

  return uniqueVirtualAliasBinds([
    ...normalizeVirtualAliasBinds(explicitVirtualPathAliases),
    ...normalizeVirtualAliasBinds(deriveVirtualPathAliasesFromWritablePaths(normalizedWritablePaths)),
  ]);
}

export function ensureVirtualAliasMountPoints(binds, filesystem = { mkdirSync }) {
  const mkdir = typeof filesystem.mkdirSync === 'function'
    ? filesystem.mkdirSync
    : mkdirSync;

  for (const bind of Array.isArray(binds) ? binds : []) {
    if (!bind || typeof bind.target !== 'string' || !bind.target.startsWith('/')) {
      continue;
    }

    mkdir(bind.target, { recursive: true });
  }
}

function containsGlobChars(pathPattern) {
  return /[*?[\]]/.test(pathPattern);
}

function stripRecursiveGlobSuffix(pathPattern) {
  return pathPattern.replace(/\/\*\*$/, '');
}

function isSameOrDescendant(candidatePath, ancestorPath) {
  return candidatePath === ancestorPath || candidatePath.startsWith(`${ancestorPath}${sep}`);
}

function findWritableRebindInsertionIndex(args, separatorIndex) {
  for (const flag of ['--unshare-pid', '--proc']) {
    const flagIndex = args.indexOf(flag);

    if (flagIndex !== -1 && flagIndex < separatorIndex) {
      return flagIndex;
    }
  }

  return separatorIndex;
}

function uniquePaths(paths) {
  const nextPaths = [];
  const seenPaths = new Set();

  for (const path of paths) {
    if (!path || seenPaths.has(path)) {
      continue;
    }

    seenPaths.add(path);
    nextPaths.push(path);
  }

  return nextPaths;
}

function deriveVirtualPathAliasesFromWritablePaths(writablePaths) {
  const normalizedPaths = uniquePaths(
    writablePaths
      .filter((path) => typeof path === 'string' && path.length > 0)
      .map((path) => resolve(path)),
  );
  const normalizedPathSet = new Set(normalizedPaths);

  for (const workspacePath of normalizedPaths) {
    if (basename(workspacePath) !== WORKSPACE_DIRECTORY_NAME) {
      continue;
    }

    const dataPath = join(dirname(workspacePath), DATA_DIRECTORY_NAME);

    if (normalizedPathSet.has(dataPath)) {
      return {
        [VIRTUAL_WORKSPACE_ROOT]: workspacePath,
        [VIRTUAL_STATE_ROOT]: dataPath,
      };
    }
  }

  return {};
}

function normalizeVirtualAliasBinds(virtualPathAliases) {
  if (!isRecord(virtualPathAliases)) {
    return [];
  }

  const binds = [];
  const seenTargets = new Set();

  for (const [target, source] of Object.entries(virtualPathAliases)) {
    if (typeof source !== 'string' || source.length === 0) {
      continue;
    }

    if (typeof target !== 'string' || target.length === 0 || !target.startsWith('/')) {
      continue;
    }

    if (seenTargets.has(target)) {
      continue;
    }

    seenTargets.add(target);
    binds.push({ source: resolve(source), target });
  }

  return binds;
}

function uniqueVirtualAliasBinds(binds) {
  const nextBinds = [];
  const seenTargets = new Set();

  for (const bind of binds) {
    if (seenTargets.has(bind.target)) {
      continue;
    }

    seenTargets.add(bind.target);
    nextBinds.push(bind);
  }

  return nextBinds;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
