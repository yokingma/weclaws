// @vitest-environment jsdom

import * as React from 'react';
import { act, screen, within } from '@testing-library/react';
import { renderWithLocale } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { BotDetailLiveView } from '../bot-detail-live-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('renders runtime controls on the left and recent events on the right', () => {
  const eventSourceMock = {
    addEventListener: vi.fn(),
    close: vi.fn(),
  };

  vi.stubGlobal('EventSource', vi.fn(() => eventSourceMock));

  renderWithLocale(
    <BotDetailLiveView
      initialBot={{
        id: 'bot_1',
        name: 'Alpha',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'running',
        processPid: 123,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        weixinAccountId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      }}
      initialEvents={[
        {
          rowId: 1,
          id: 'evt_1',
          botInstanceId: 'bot_1',
          type: 'bot.started',
          message: 'Bot started',
          payloadJson: {},
          createdAt: '2026-04-08T10:03:00.000Z',
        },
      ]}
      profiles={[
        {
          apiType: 'openai-responses',
          baseUrl: 'https://gateway.example.com/v1',
          createdAt: '2026-04-17T02:00:00.000Z',
          hasApiKey: true,
          id: 'profile_1',
          model: 'gpt-5.4',
          name: 'Primary',
          provider: 'openai',
          updatedAt: '2026-04-17T03:00:00.000Z',
        },
      ]}
    />,
    { locale: 'en' }
  );

  const activityRegion = screen.getByRole('region', { name: 'Live Activity' });
  const controlsRegion = screen.getByRole('complementary', { name: 'Bot Controls' });

  expect(within(controlsRegion).getByText('Runtime Summary')).toBeInTheDocument();
  expect(within(controlsRegion).getByRole('combobox', { name: 'LLM Profile' })).toBeInTheDocument();
  expect(within(controlsRegion).queryByText('QR Code')).not.toBeInTheDocument();
  expect(within(activityRegion).getByText('Recent Events')).toBeInTheDocument();
  expect(within(activityRegion).queryByText('Technical Metadata')).not.toBeInTheDocument();
  expect(within(controlsRegion).queryByText('Technical Metadata')).not.toBeInTheDocument();
});

it('renders sanitized stream errors separately from bot runtime payload updates', async () => {
  const listeners = new Map<string, EventListener>();
  const eventSourceMock = {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      listeners.set(type, handler);
    }),
    close: vi.fn(),
  };

  vi.stubGlobal('EventSource', vi.fn(() => eventSourceMock));

  renderWithLocale(
    <BotDetailLiveView
      initialBot={{
        id: 'bot_1',
        name: 'Alpha',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'running',
        processPid: 123,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        weixinAccountId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      }}
      initialEvents={[]}
      profiles={[
        {
          apiType: 'openai-responses',
          baseUrl: 'https://gateway.example.com/v1',
          createdAt: '2026-04-17T02:00:00.000Z',
          hasApiKey: true,
          id: 'profile_1',
          model: 'gpt-5.4',
          name: 'Primary',
          provider: 'openai',
          updatedAt: '2026-04-17T03:00:00.000Z',
        },
      ]}
    />,
    { locale: 'en' }
  );

  await act(async () => {
    listeners.get('bot.stream.error')?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          id: 'bot_1',
          message: 'Unexpected server error.',
        }),
      }),
    );
  });

  expect(screen.getByText('Unexpected server error.')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
