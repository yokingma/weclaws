// @vitest-environment jsdom

import * as React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

it('renders primary actions in the header and separates qr sharing from runtime summary', async () => {
  const eventSourceMock = {
    addEventListener: vi.fn(),
    close: vi.fn(),
  };
  const updatedBot = {
    createdAt: '',
    desiredState: 'running',
    heartbeatAt: null,
    id: 'bot_1',
    lastErrorCode: null,
    lastErrorMessage: null,
    lastQrCodeId: 'qr_1',
    lastQrCodeUrl: 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=abc&bot_type=3',
    llmConfigId: 'profile_1',
    llmProfileName: 'Primary',
    model: 'claude-opus-4-6',
    name: 'Alpha',
    processPid: 123,
    processStartedAt: null,
    provider: 'anthropic',
    qrReissueRequestedAt: null,
    restartRequestedAt: null,
    status: 'waiting_for_qr',
    updatedAt: '',
    weixinAccountId: null,
    workspaceId: 'w1',
  };
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith('/qr-share') && init?.method !== 'POST') {
      return Promise.resolve(new Response(JSON.stringify({
        data: null,
        error: null,
      }), { status: 200 }));
    }

    if (url.endsWith('/reissue-qr')) {
      return Promise.resolve(new Response(JSON.stringify({
        data: {
          ...updatedBot,
          qrReissueRequestedAt: '2026-05-10T10:00:00.000Z',
        },
        error: null,
      }), { status: 200 }));
    }

    if (url.endsWith('/skills/sync')) {
      return Promise.resolve(new Response(JSON.stringify({
        data: {
          result: {
            error: null,
            skippedConflicts: [],
            status: 'success',
          },
        },
        error: null,
      }), { status: 200 }));
    }

    if (url.endsWith('/stop')) {
      return Promise.resolve(new Response(JSON.stringify({
        data: {
          ...updatedBot,
          desiredState: 'stopped',
          status: 'stopping',
        },
        error: null,
      }), { status: 200 }));
    }

    if (url.endsWith('/restart')) {
      return Promise.resolve(new Response(JSON.stringify({
        data: {
          ...updatedBot,
          restartRequestedAt: '2026-05-10T10:01:00.000Z',
          status: 'starting',
        },
        error: null,
      }), { status: 200 }));
    }

    return Promise.resolve(new Response(JSON.stringify({
      data: null,
      error: null,
    }), { status: 200 }));
  });

  vi.stubGlobal('EventSource', vi.fn(function EventSourceMock() {
    return eventSourceMock;
  }));
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(
    <BotDetailLiveView
      initialBot={{
        id: 'bot_1',
        name: 'Alpha',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'waiting_for_qr',
        processPid: 123,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: 'qr_1',
        lastQrCodeUrl: 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=abc&bot_type=3',
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
  const headerActions = screen.getByRole('region', { name: 'Bot Header Actions' });
  const qrShareRegion = screen.getByRole('region', { name: 'QR Code and Share' });

  expect(within(controlsRegion).queryByText('Runtime Summary')).not.toBeInTheDocument();
  expect(within(headerActions).getByRole('button', { name: 'Start' })).toBeInTheDocument();
  expect(within(headerActions).getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  expect(within(headerActions).getByRole('button', { name: 'Restart' })).toBeInTheDocument();
  expect(within(headerActions).getByRole('button', { name: 'Profile' })).toBeInTheDocument();
  expect(within(headerActions).getByRole('button', { name: 'Sync Skills' })).toBeInTheDocument();
  expect(within(headerActions).getByRole('button', { name: 'Delete Bot' })).toBeDisabled();
  expect(within(qrShareRegion).queryByText('QR Code')).not.toBeInTheDocument();
  expect(within(qrShareRegion).getByRole('img', { name: 'qr_1' })).toBeInTheDocument();
  expect(within(qrShareRegion).getByText(/Create a public page link/)).toBeInTheDocument();
  expect(within(qrShareRegion).queryByText(/Runtime field:/)).not.toBeInTheDocument();
  expect(within(qrShareRegion).queryByText(/Preview rendered/)).not.toBeInTheDocument();
  const qrActions = within(qrShareRegion).getByRole('group', { name: 'QR Code Actions' });
  expect(within(qrActions).getByRole('link', { name: 'Open QR page' })).toBeInTheDocument();
  expect(within(qrActions).getByRole('button', { name: 'Reissue QR' })).toBeInTheDocument();
  expect(within(activityRegion).getByText('Recent Events')).toBeInTheDocument();
  expect(within(activityRegion).queryByText('Technical Metadata')).not.toBeInTheDocument();
  expect(within(controlsRegion).queryByText('Technical Metadata')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'LLM Profile' })).not.toBeInTheDocument();

  await userEvent.click(within(qrShareRegion).getByRole('button', { name: 'Reissue QR' }));
  expect(fetchMock).not.toHaveBeenCalledWith('/api/bots/bot_1/reissue-qr', {
    method: 'POST',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Reissue QR' }));
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/bots/bot_1/reissue-qr', {
      method: 'POST',
    });
  });

  await userEvent.click(within(headerActions).getByRole('button', { name: 'Restart' }));
  expect(fetchMock).not.toHaveBeenCalledWith('/api/bots/bot_1/restart', {
    method: 'POST',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Restart' }));
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/bots/bot_1/restart', {
      method: 'POST',
    });
  });

  await userEvent.click(within(headerActions).getByRole('button', { name: 'Stop' }));
  expect(fetchMock).not.toHaveBeenCalledWith('/api/bots/bot_1/stop', {
    method: 'POST',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Stop' }));
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/bots/bot_1/stop', {
      method: 'POST',
    });
  });

  await userEvent.click(within(headerActions).getByRole('button', { name: 'Sync Skills' }));
  expect(fetchMock).not.toHaveBeenCalledWith('/api/bots/bot_1/skills/sync', {
    method: 'POST',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Sync Skills' }));
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/bots/bot_1/skills/sync', {
      method: 'POST',
    });
  });
  expect(await screen.findByText('Managed skills synced.')).toBeInTheDocument();

  await userEvent.click(within(headerActions).getByRole('button', { name: 'Profile' }));

  const profileDialog = screen.getByRole('dialog', { name: 'LLM Profile' });
  expect(within(profileDialog).getByRole('combobox', { name: 'LLM Profile' })).toBeInTheDocument();
});

it('renders sanitized stream errors separately from bot runtime payload updates', async () => {
  const listeners = new Map<string, EventListener>();
  const eventSourceMock = {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      listeners.set(type, handler);
    }),
    close: vi.fn(),
  };

  vi.stubGlobal('EventSource', vi.fn(function EventSourceMock() {
    return eventSourceMock;
  }));

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
