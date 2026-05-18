// @vitest-environment jsdom

import * as React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { CreateBotForm } from '../create-bot-form';

const pushMock = vi.fn();
const refreshMock = vi.fn();
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
const quota = {
  isAtLimit: false,
  limit: 2,
  remainingCount: 1,
  usedCount: 1,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

it('shows the preserved defaults and grouped runtime fields', () => {
  const { container } = renderWithLocale(<CreateBotForm profiles={profiles} quota={quota} />, { locale: 'en' });

  expect(screen.getByRole('combobox', { name: 'LLM Profile' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'LLM Profile' })).toHaveTextContent('Primary');
  expect(screen.getByDisplayValue('openai')).toHaveAttribute('readonly');
  expect(screen.getByDisplayValue('gpt-5.4')).toHaveAttribute('readonly');
  expect(screen.getByDisplayValue('https://gateway.example.com/v1')).toHaveAttribute('readonly');
  expect(screen.getByDisplayValue('openai-responses')).toHaveAttribute('readonly');
  expect(screen.getByDisplayValue('Configured')).toHaveAttribute('readonly');
  expect(screen.getByText('1 of 2 bot slots used. 1 remaining.')).toBeInTheDocument();
  expect(container.querySelector('[data-create-bot-label]')).toHaveTextContent('Bot Name *');
  expect(container.querySelectorAll('[data-required-indicator]')).toHaveLength(1);
  expect(container.querySelector('[data-create-bot-panel]')).not.toHaveClass('shadow-[var(--shadow-panel)]');
  expect(container.querySelector('[data-create-bot-submit-strip]')).not.toHaveClass('shadow-[var(--shadow-soft)]');
  expect(screen.getByText('Runtime Config')).toBeInTheDocument();
});

it('disables submit while the request is pending', async () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

  renderWithLocale(<CreateBotForm profiles={profiles} quota={quota} />, { locale: 'en' });

  await userEvent.type(screen.getByLabelText('Bot Name'), 'Alpha');
  await userEvent.click(screen.getByRole('button', { name: 'Create Bot' }));

  expect(screen.getByRole('button', { name: /Create/i })).toBeDisabled();
});

it('submits only the bot name and keeps runtime config browser-owned fields out of the payload', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { id: 'bot_1' }, error: null }),
  });
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(<CreateBotForm profiles={profiles} quota={quota} />, { locale: 'en' });

  await userEvent.type(screen.getByLabelText('Bot Name'), 'Alpha');
  await userEvent.click(screen.getByRole('button', { name: 'Create Bot' }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/bots', expect.objectContaining({
      body: JSON.stringify({
        llmProfileId: 'profile_1',
        name: 'Alpha',
      }),
      method: 'POST',
    }));
  });
});

it('shows the API error message when creation fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ data: null, error: { code: 'FAIL', message: 'Create failed.' } }),
  }));

  renderWithLocale(<CreateBotForm profiles={profiles} quota={quota} />, { locale: 'en' });

  await userEvent.type(screen.getByLabelText('Bot Name'), 'Alpha');
  await userEvent.click(screen.getByRole('button', { name: 'Create Bot' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Create failed.');
});

it('blocks submission when the bot limit has been reached', () => {
  renderWithLocale(
    <CreateBotForm
      profiles={profiles}
      quota={{
        isAtLimit: true,
        limit: 2,
        remainingCount: 0,
        usedCount: 2,
      }}
    />,
    { locale: 'en' },
  );

  expect(screen.getByRole('button', { name: 'Create Bot' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('You have reached the bot limit for this account (2).');
});

it('blocks submission when no llm profiles exist yet', () => {
  renderWithLocale(<CreateBotForm profiles={[]} quota={quota} />, { locale: 'en' });

  expect(screen.getByRole('button', { name: 'Create Bot' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Create a profile in Settings first.');
});
