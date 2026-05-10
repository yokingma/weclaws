// @vitest-environment jsdom

import * as React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { BotStatusCard } from '../bot-status-card';

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

it('keeps all actions visible and shows inline errors on failed commands', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ data: null, error: { code: 'FAIL', message: 'boom' } }),
  }));

  renderWithLocale(
    <BotStatusCard
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'running',
        processPid: 1,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        weixinAccountId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      }}
      onBotUpdated={() => {}}
    />,
    { locale: 'en' }
  );

  expect(screen.getByText('Runtime Summary')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));

  expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sync Skills' })).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('boom');
});

it('shows sync feedback without mutating the live bot payload', async () => {
  const onBotUpdated = vi.fn();

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        result: {
          bundleVersion: 'bundle-v1',
          error: null,
          errors: [],
          installedSkills: ['alpha'],
          metadataRepaired: false,
          operation: 'sync-all-managed',
          removedSkills: [],
          repairedMarkers: [],
          skippedConflicts: ['user-alpha'],
          status: 'success',
          updatedSkills: [],
        },
      },
      error: null,
    }),
    ok: true,
    status: 200,
  }));

  renderWithLocale(
    <BotStatusCard
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'running',
        processPid: 1,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        weixinAccountId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      }}
      onBotUpdated={onBotUpdated}
    />,
    { locale: 'en' }
  );

  await userEvent.click(screen.getByRole('button', { name: 'Sync Skills' }));

  expect(fetch).toHaveBeenCalledWith('/api/bots/bot_1/skills/sync', {
    method: 'POST',
  });
  expect(onBotUpdated).not.toHaveBeenCalled();
  expect(await screen.findByText('Managed skills synced. 1 conflicting user skill was kept.')).toBeInTheDocument();
});

it('requests a fresh qr flow without pretending to log out the Weixin account in-place', async () => {
  const onBotUpdated = vi.fn();

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'running',
        processPid: 1,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: '2026-05-10T10:00:00.000Z',
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        weixinAccountId: 'wx_1',
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      },
      error: null,
    }),
    ok: true,
    status: 200,
  }));

  renderWithLocale(
    <BotStatusCard
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'running',
        processPid: 1,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        weixinAccountId: 'wx_1',
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      }}
      onBotUpdated={onBotUpdated}
    />,
    { locale: 'en' }
  );

  await userEvent.click(screen.getByRole('button', { name: 'Reissue QR' }));

  expect(fetch).toHaveBeenCalledWith('/api/bots/bot_1/reissue-qr', {
    method: 'POST',
  });
  expect(onBotUpdated).toHaveBeenCalledWith(expect.objectContaining({
    qrReissueRequestedAt: '2026-05-10T10:00:00.000Z',
  }));
});

it('creates a public qr share link from the runtime card', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      data: null,
      error: null,
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      data: {
        publicUrl: 'http://localhost/share/qr/share_token_1',
        revokedAt: null,
        shareId: 'share_1',
      },
      error: null,
    }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(
    <BotStatusCard
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'waiting_for_qr',
        processPid: 1,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: 'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=abc&bot_type=3',
        weixinAccountId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      }}
      onBotUpdated={() => {}}
    />,
    { locale: 'en' }
  );

  await userEvent.click(screen.getByRole('button', { name: 'Enable QR Share' }));

  expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/bots/bot_1/qr-share', {
    method: 'POST',
  });
  expect(await screen.findByText('http://localhost/share/qr/share_token_1')).toBeInTheDocument();
});

it('requires an explicit confirmation button before deleting a stopped bot', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        id: 'bot_1',
      },
      error: null,
    }),
    ok: true,
    status: 200,
  }));

  renderWithLocale(
    <BotStatusCard
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'openai',
        model: 'gpt-5.4',
        workspaceId: 'w1',
        desiredState: 'stopped',
        status: 'stopped',
        processPid: null,
        processStartedAt: null,
        heartbeatAt: null,
        restartRequestedAt: null,
        qrReissueRequestedAt: null,
        lastQrCodeId: null,
        lastQrCodeUrl: null,
        weixinAccountId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      }}
      onBotUpdated={() => {}}
    />,
    { locale: 'en' }
  );

  expect(screen.getByText('Runtime Summary')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Delete Bot' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));

  expect(fetch).toHaveBeenCalledWith('/api/bots/bot_1', {
    method: 'DELETE',
  });
  expect(pushMock).toHaveBeenCalledWith('/bots');
});

it('moves qr content into runtime summary and removes duplicated status rows', () => {
  renderWithLocale(
    <BotStatusCard
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'openai',
        model: 'gpt-5.4',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'waiting_for_qr',
        processPid: 123,
        processStartedAt: '2026-04-14T10:00:00.000Z',
        heartbeatAt: '2026-04-14T10:03:00.000Z',
        restartRequestedAt: '2026-04-14T10:04:00.000Z',
        qrReissueRequestedAt: null,
        lastQrCodeId: 'qr_1',
        lastQrCodeUrl:
          'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=f20d3207f1db267785bd56467af4f96b&bot_type=3',
        weixinAccountId: null,
        lastErrorCode: 'WAITING_FOR_QR',
        lastErrorMessage: 'Scan required.',
        createdAt: '',
        updatedAt: '',
      }}
      onBotUpdated={() => {}}
    />,
    { locale: 'en' }
  );

  expect(screen.getByText('Runtime Summary')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'qr_1' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open QR page' })).toBeInTheDocument();
  expect(screen.queryByText('QR Code')).not.toBeInTheDocument();

  expect(screen.queryByText('Runtime Status')).not.toBeInTheDocument();
  expect(screen.queryByText('Desired State')).not.toBeInTheDocument();
  expect(screen.queryByText('Last Heartbeat')).not.toBeInTheDocument();
  expect(screen.queryByText('Process State')).not.toBeInTheDocument();
  expect(screen.queryByText('Latest Error')).not.toBeInTheDocument();
  expect(screen.queryByText('Restart Requested')).not.toBeInTheDocument();
});

it('hides stale qr content once the bot is already running', () => {
  renderWithLocale(
    <BotStatusCard
      bot={{
        id: 'bot_1',
        name: 'Alpha',
        llmConfigId: 'profile_1',
        llmProfileName: 'Primary',
        provider: 'openai',
        model: 'gpt-5.4',
        workspaceId: 'w1',
        desiredState: 'running',
        status: 'running',
        processPid: 123,
        processStartedAt: '2026-04-14T10:00:00.000Z',
        heartbeatAt: '2026-04-14T10:03:00.000Z',
        restartRequestedAt: '2026-04-14T10:04:00.000Z',
        qrReissueRequestedAt: null,
        lastQrCodeId: 'qr_1',
        lastQrCodeUrl:
          'https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=f20d3207f1db267785bd56467af4f96b&bot_type=3',
        weixinAccountId: 'wx_1',
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: '',
        updatedAt: '',
      }}
      onBotUpdated={() => {}}
    />,
    { locale: 'en' }
  );

  expect(screen.queryByRole('img', { name: 'qr_1' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Open QR page' })).not.toBeInTheDocument();
  expect(screen.getByText('No QR code yet')).toBeInTheDocument();
});
