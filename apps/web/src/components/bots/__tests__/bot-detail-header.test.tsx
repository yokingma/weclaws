// @vitest-environment jsdom

import * as React from 'react';
import { screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/test/render';
import { BotDetailHeader } from '../bot-detail-header';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

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
    />,
    { locale: 'en' }
  );

  const summarySurface = document.querySelector('[data-bot-detail-summary]');

  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByText('anthropic / claude-opus-4-6')).toBeInTheDocument();
  expect(summarySurface).not.toBeNull();
  expect(within(summarySurface as HTMLElement).getByText('Current Runtime Status')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('Technical Metadata')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('Workspace ID')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('workspace_alpha')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('Weixin Account')).toBeInTheDocument();
  expect(within(summarySurface as HTMLElement).getByText('wx_alpha')).toBeInTheDocument();
});
