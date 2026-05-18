// @vitest-environment jsdom

import * as React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminSandboxRuntimeConsole } from '../admin-sandbox-runtime-console';
import type { AdminSandboxRuntimePoolsPayload } from '@/lib/sandbox-runtime-admin';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('shows manager and per-pool resource status without exposing API keys', () => {
  renderWithLocale(<AdminSandboxRuntimeConsole initialData={createPayload()} />, { locale: 'en' });

  expect(screen.getByText('Sandbox Runtime Pools')).toBeInTheDocument();
  expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  expect(document.querySelector('[data-srt-pool-row]')).not.toBeNull();
  expect(screen.getByText('12.5%')).toBeInTheDocument();
  expect(screen.getByText('244.1 MB')).toBeInTheDocument();
  expect(screen.getByText('31000')).toBeInTheDocument();
  expect(screen.queryByText('Pool 3 · Min 1 · Max 1')).not.toBeInTheDocument();
  expect(screen.queryByText('http://sandbox-runtime:31000')).not.toBeInTheDocument();
  expect(screen.getByText('API key configured')).toBeInTheDocument();
  expect(screen.queryByText('secret')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit Pool' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Restart Pool' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Config' })).not.toBeInTheDocument();
});

it('requests a pool restart and updates the visible restart timestamp', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        ownerUserId: 'user_1',
        restartRequestedAt: '2026-05-02T03:00:00.000Z',
      },
      error: null,
    }),
    ok: true,
  });
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(<AdminSandboxRuntimeConsole initialData={createPayload()} />, { locale: 'en' });

  await userEvent.click(screen.getByRole('button', { name: 'Edit Pool' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Restart Pool' }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/sandbox-runtime/pools/user_1/restart', {
      method: 'POST',
    });
  });
  const restartTime = await screen.findByText((_content, element) => (
    element?.tagName === 'TIME' && element.getAttribute('dateTime') === '2026-05-02T03:00:00.000Z'
  ));
  expect(restartTime).toBeInTheDocument();
});

it('saves edited pool capacity through the admin PATCH API', async () => {
  const updatedPool = {
    ...createPayload().pools[0],
    poolSize: 4,
    updatedAt: '2026-05-02T03:10:00.000Z',
  };
  const fetchMock = vi.fn().mockResolvedValue({
    json: async () => ({
      data: updatedPool,
      error: null,
    }),
    ok: true,
  });
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(<AdminSandboxRuntimeConsole initialData={createPayload()} />, { locale: 'en' });

  await userEvent.click(screen.getByRole('button', { name: 'Edit Pool' }));
  await userEvent.clear(await screen.findByLabelText('Pool Size for owner@example.com'));
  await userEvent.type(screen.getByLabelText('Pool Size for owner@example.com'), '4');
  await userEvent.click(screen.getByRole('button', { name: 'Save Config' }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/sandbox-runtime/pools/user_1', expect.objectContaining({
      body: JSON.stringify({
        enabled: true,
        healthCheckIntervalMs: 60_000,
        maxConcurrentInit: 1,
        minReadyProcesses: 1,
        poolSize: 4,
        port: 31_000,
        portRangeEnd: 9_199,
        portRangeStart: 9_100,
        sessionTimeoutMs: 600_000,
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'PATCH',
    }));
  });

  expect(screen.queryByText('Pool 4 · Min 1 · Max 1')).not.toBeInTheDocument();
});

it('blocks invalid cross-field values locally and shows field errors in the modal', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(<AdminSandboxRuntimeConsole initialData={createPayload()} />, { locale: 'en' });

  await userEvent.click(screen.getByRole('button', { name: 'Edit Pool' }));
  await userEvent.clear(await screen.findByLabelText('Pool Size for owner@example.com'));
  await userEvent.type(screen.getByLabelText('Pool Size for owner@example.com'), '1');
  await userEvent.clear(screen.getByLabelText('Min Ready for owner@example.com'));
  await userEvent.type(screen.getByLabelText('Min Ready for owner@example.com'), '2');
  await userEvent.clear(screen.getByLabelText('Port Range Start for owner@example.com'));
  await userEvent.type(screen.getByLabelText('Port Range Start for owner@example.com'), '9200');
  await userEvent.clear(screen.getByLabelText('Port Range End for owner@example.com'));
  await userEvent.type(screen.getByLabelText('Port Range End for owner@example.com'), '9100');

  await userEvent.click(screen.getByRole('button', { name: 'Save Config' }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(await screen.findByText('Min Ready must be less than or equal to Pool Size.')).toBeInTheDocument();
  expect(screen.getByText('Port Range Start must be less than or equal to Port Range End.')).toBeInTheDocument();
});

it('does not expose workspaceBasePath as an editable field in the modal', async () => {
  renderWithLocale(<AdminSandboxRuntimeConsole initialData={createPayload()} />, { locale: 'en' });

  await userEvent.click(screen.getByRole('button', { name: 'Edit Pool' }));

  expect(screen.queryByLabelText('Workspace Base Path for owner@example.com')).not.toBeInTheDocument();
});

function createPayload(): AdminSandboxRuntimePoolsPayload {
  return {
    manager: {
      cpuPercent: 2.5,
      degradedPoolCount: 0,
      failedPoolCount: 0,
      lastErrorMessage: null,
      managedPoolCount: 1,
      pid: 123,
      rssBytes: 128_000_000,
      runningPoolCount: 1,
      state: 'running',
      totalActiveSessions: null,
      totalPoolSize: 3,
      uptimeMs: 25_000,
    },
    pools: [
      {
        apiKeyConfigured: true,
        createdAt: '2026-05-02T01:00:00.000Z',
        defaultAllowRead: [],
        defaultAllowWrite: ['/tmp'],
        defaultDeniedDomains: [],
        defaultDenyRead: ['/etc/passwd'],
        defaultDenyWrite: ['.env'],
        enabled: true,
        healthCheckIntervalMs: 60_000,
        id: 'pool_1',
        maxConcurrentInit: 1,
        minReadyProcesses: 1,
        ownerEmail: 'owner@example.com',
        ownerUserId: 'user_1',
        poolSize: 3,
        port: 31_000,
        portRangeEnd: 9_199,
        portRangeStart: 9_100,
        restartRequestedAt: null,
        runtime: {
          activeSessions: null,
          busyProcesses: null,
          cpuPercent: 12.5,
          lastErrorMessage: null,
          lastExitCode: null,
          lastHealthAt: null,
          lastRestartAt: null,
          pid: 456,
          readyProcesses: null,
          rssBytes: 256_000_000,
          startedAt: '2026-05-02T02:00:00.000Z',
          state: 'running',
          url: 'http://sandbox-runtime:31000',
        },
        sessionTimeoutMs: 600_000,
        updatedAt: '2026-05-02T01:10:00.000Z',
        workspaceBasePath: '/app/apps/sandbox-runtime/user-workspaces/user_1',
      },
    ],
    statusUpdatedAt: '2026-05-02T02:00:00.000Z',
  };
}
