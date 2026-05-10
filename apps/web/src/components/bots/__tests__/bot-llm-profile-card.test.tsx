// @vitest-environment jsdom

import * as React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { BotLlmProfileCard } from '../bot-llm-profile-card';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}

if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const bot = {
  createdAt: '',
  desiredState: 'running' as const,
  heartbeatAt: null,
  id: 'bot_1',
  lastErrorCode: null,
  lastErrorMessage: null,
  lastQrCodeId: null,
  lastQrCodeUrl: null,
  llmConfigId: 'profile_1',
  llmProfileName: 'Primary',
  model: 'gpt-5.4',
  name: 'Alpha',
  processPid: null,
  processStartedAt: null,
  provider: 'openai',
  restartRequestedAt: null,
  qrReissueRequestedAt: null,
  status: 'running' as const,
  updatedAt: '',
  weixinAccountId: null,
  workspaceId: 'ws_1',
};

const profiles = [
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
  {
    apiType: null,
    baseUrl: null,
    createdAt: '2026-04-17T04:00:00.000Z',
    hasApiKey: true,
    id: 'profile_2',
    model: 'claude-opus-4-6',
    name: 'Claude',
    provider: 'anthropic',
    updatedAt: '2026-04-17T04:00:00.000Z',
  },
];

it('rebinds the bot to another llm profile', async () => {
  const onBotUpdated = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        ...bot,
        llmConfigId: 'profile_2',
        llmProfileName: 'Claude',
        model: 'claude-opus-4-6',
        provider: 'anthropic',
        restartRequestedAt: '2026-04-17T05:00:00.000Z',
      },
      error: null,
    }),
    ok: true,
  }));

  renderWithLocale(
    <BotLlmProfileCard bot={bot} onBotUpdated={onBotUpdated} profiles={profiles} />,
    { locale: 'en' }
  );

  await userEvent.click(screen.getByRole('combobox', { name: 'LLM Profile' }));
  await userEvent.click(screen.getByRole('option', { name: 'Claude' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply Profile' }));

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith('/api/bots/bot_1/llm-profile', expect.objectContaining({
      body: JSON.stringify({
        llmProfileId: 'profile_2',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'PATCH',
    }));
  });

  expect(onBotUpdated).toHaveBeenCalledWith(expect.objectContaining({
    llmConfigId: 'profile_2',
    llmProfileName: 'Claude',
  }));
});

it('shows an inline error when rebinding fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({
      data: null,
      error: {
        code: 'FAIL',
        message: 'Profile switch failed.',
      },
    }),
    ok: false,
  }));

  renderWithLocale(
    <BotLlmProfileCard bot={bot} onBotUpdated={() => {}} profiles={profiles} />,
    { locale: 'en' }
  );

  await userEvent.click(screen.getByRole('combobox', { name: 'LLM Profile' }));
  await userEvent.click(screen.getByRole('option', { name: 'Claude' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply Profile' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Profile switch failed.');
});
