import { describe, expect, it } from 'vitest';
// @ts-ignore repo-local ESM bootstrap test helper has no TS declaration surface
import { collectWritablePathsNeedingRebind, injectWritableRebindArgs, stripFatalLinuxReadDenyArgs } from '../../../../../infra/sandbox-runtime/worker-bootstrap.mjs';

describe('sandbox-runtime worker bootstrap', () => {
  it('rebinds allowWrite paths that live inside denied parent directories', () => {
    const storageRoot = '/app/storage';
    const instancesRoot = '/app/storage/instances';
    const runtimeWorkspacesRoot = '/app/apps/sandbox-runtime/user-workspaces';
    const runtimeBasePath = `${runtimeWorkspacesRoot}/user_1`;
    const botWorkspacePath = '/app/storage/instances/bot_1/workspace';
    const botDataPath = '/app/storage/instances/bot_1/data';
    const stateRoot = `${runtimeBasePath}/.runtime/user_1/ws_1`;

    expect(collectWritablePathsNeedingRebind({
      allowWrite: [
        botWorkspacePath,
        botDataPath,
        stateRoot,
        '/tmp',
      ],
      denyRead: [
        storageRoot,
        `${storageRoot}/**`,
        instancesRoot,
        `${instancesRoot}/**`,
        runtimeWorkspacesRoot,
        `${runtimeWorkspacesRoot}/**`,
        runtimeBasePath,
        `${runtimeBasePath}/**`,
        '/etc/passwd',
      ],
    })).toEqual([
      botWorkspacePath,
      botDataPath,
      stateRoot,
    ]);
  });

  it('injects writable rebinds before the sandbox command separator', () => {
    const outputPath = '/app/storage/instances/bot_1/output';
    const cachePath = '/app/storage/instances/bot_1/cache';

    expect(injectWritableRebindArgs([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--tmpfs',
      '/app/storage/instances',
      '--dev',
      '/dev',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ], [
      outputPath,
      cachePath,
    ])).toEqual([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--tmpfs',
      '/app/storage/instances',
      '--dev',
      '/dev',
      '--bind',
      outputPath,
      outputPath,
      '--bind',
      cachePath,
      cachePath,
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ]);
  });

  it('derives virtual workspace and state alias binds from bot write roots when upstream drops custom fields', () => {
    const botWorkspacePath = '/app/storage/instances/bot_1/workspace';
    const botDataPath = '/app/storage/instances/bot_1/data';

    expect(injectWritableRebindArgs([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--tmpfs',
      '/app/storage/instances',
      '--dev',
      '/dev',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ], [
      botWorkspacePath,
      botDataPath,
    ])).toEqual([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--tmpfs',
      '/app/storage/instances',
      '--dev',
      '/dev',
      '--bind',
      botWorkspacePath,
      botWorkspacePath,
      '--bind',
      botDataPath,
      botDataPath,
      '--bind',
      botWorkspacePath,
      '/workspace',
      '--bind',
      botDataPath,
      '/state',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ]);
  });

  it('injects virtual workspace and state alias binds before the sandbox command separator', () => {
    const botWorkspacePath = '/app/storage/instances/bot_1/workspace';
    const botDataPath = '/app/storage/instances/bot_1/data';

    expect(injectWritableRebindArgs([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--tmpfs',
      '/app/storage/instances',
      '--dev',
      '/dev',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ], [
      botWorkspacePath,
      botDataPath,
    ], {
      '/workspace': botWorkspacePath,
      '/state': botDataPath,
    })).toEqual([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--tmpfs',
      '/app/storage/instances',
      '--dev',
      '/dev',
      '--bind',
      botWorkspacePath,
      botWorkspacePath,
      '--bind',
      botDataPath,
      botDataPath,
      '--bind',
      botWorkspacePath,
      '/workspace',
      '--bind',
      botDataPath,
      '/state',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ]);
  });

  it('keeps writable rebinds ahead of pid namespace flags in real bwrap argv order', () => {
    const botWorkspacePath = '/app/storage/instances/bot_1/workspace';
    const botDataPath = '/app/storage/instances/bot_1/data';

    expect(injectWritableRebindArgs([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--tmpfs',
      '/app/storage',
      '--dev',
      '/dev',
      '--unshare-pid',
      '--proc',
      '/proc',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ], [
      botWorkspacePath,
      botDataPath,
    ])).toEqual([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--tmpfs',
      '/app/storage',
      '--dev',
      '/dev',
      '--bind',
      botWorkspacePath,
      botWorkspacePath,
      '--bind',
      botDataPath,
      botDataPath,
      '--bind',
      botWorkspacePath,
      '/workspace',
      '--bind',
      botDataPath,
      '/state',
      '--unshare-pid',
      '--proc',
      '/proc',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ]);
  });

  it('strips the fatal /etc/mtab deny bind from linux bwrap argv', () => {
    expect(stripFatalLinuxReadDenyArgs([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--ro-bind',
      '/dev/null',
      '/etc/mtab',
      '--ro-bind',
      '/dev/null',
      '/proc/mounts',
      '--unshare-pid',
      '--proc',
      '/proc',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ])).toEqual([
      'bwrap',
      '--ro-bind',
      '/',
      '/',
      '--ro-bind',
      '/dev/null',
      '/proc/mounts',
      '--unshare-pid',
      '--proc',
      '/proc',
      '--',
      '/bin/bash',
      '-c',
      'pwd',
    ]);
  });
});
