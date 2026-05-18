// @vitest-environment jsdom

import * as React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/test/render';
import { BotDetailHeader } from '../bot-detail-header';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('renders one merged summary surface for current runtime status and technical metadata', () => {
  renderWithLocale(
    <BotDetailHeader
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'workspace_alpha',
        desiredState: 'running',
        status: 'running',
        processPid: 12345,
        processStartedAt: '2026-04-08T10:00:00.000Z',
        heartbeatAt: '2026-04-08T10:02:00.000Z',
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        weixinAccountId: 'wx_alpha',
        lastErrorCode: 'RUNTIME_DEGRADED',
        lastErrorMessage: 'temporary issue',
        createdAt: '2026-04-08T09:30:00.000Z',
        updatedAt: '2026-04-08T10:02:00.000Z',
      }}
      onBotUpdated={() => {}}
      profiles={[
        {
          apiType: 'anthropic-messages',
          baseUrl: null,
          createdAt: '2026-04-08T09:00:00.000Z',
          hasApiKey: true,
          id: 'profile_1',
          model: 'claude-opus-4-6',
          name: 'Primary',
          provider: 'anthropic',
          updatedAt: '2026-04-08T09:00:00.000Z',
        },
      ]}
    />,
    { locale: 'en' }
  );

  const summarySurface = document.querySelector('[data-bot-detail-summary]');

  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByText('anthropic / claude-opus-4-6')).toBeInTheDocument();
  expect(summarySurface).not.toBeNull();
  expect(summarySurface).toHaveClass('rounded-[var(--radius-panel)]');
  expect(within(summarySurface as HTMLElement).getByText('Current Runtime Status')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('Technical Metadata')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('Process Started')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('Workspace ID')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('workspace_alpha')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('Weixin Account')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('wx_alpha')).toBeInTheDocument();
});

it('requires confirmation before deleting a stopped bot from the header actions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    data: {
      id: 'bot_1',
    },
    error: null,
  }), { status: 200 })));

  renderWithLocale(
    <BotDetailHeader
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'workspace_alpha',
        desiredState: 'stopped',
        status: 'stopped',
        processPid: null,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        weixinAccountId: 'wx_alpha',
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '2026-04-08T09:30:00.000Z',
        updatedAt: '2026-04-08T10:02:00.000Z',
      }}
      onBotUpdated={() => {}}
      profiles={[
        {
          apiType: 'anthropic-messages',
          baseUrl: null,
          createdAt: '2026-04-08T09:00:00.000Z',
          hasApiKey: true,
          id: 'profile_1',
          model: 'claude-opus-4-6',
          name: 'Primary',
          provider: 'anthropic',
          updatedAt: '2026-04-08T09:00:00.000Z',
        },
      ]}
    />,
    { locale: 'en' },
  );

  const headerActions = screen.getByRole('region', { name: 'Bot Header Actions' });

  await userEvent.click(within(headerActions).getByRole('button', { name: 'Delete Bot' }));

  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Confirm Delete Bot' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Confirm Delete Bot' }));

  expect(fetch).toHaveBeenCalledWith('/api/bots/bot_1', {
    method: 'DELETE',
  });
  expect(pushMock).toHaveBeenCalledWith('/bots');
});
