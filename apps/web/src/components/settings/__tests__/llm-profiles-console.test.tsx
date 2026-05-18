// @vitest-environment jsdom

import * as React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { LlmProfilesConsole } from '../llm-profiles-console';

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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('updates an existing profile without resending the stored api key', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        profile: {
          apiType: 'openai-completions',
          baseUrl: null,
          createdAt: '2026-04-17T02:00:00.000Z',
          hasApiKey: true,
          id: 'profile_1',
          model: 'gpt-5.5',
          name: 'Primary v2',
          provider: 'openai',
          updatedAt: '2026-04-17T04:00:00.000Z',
        },
        restartRequestedBotCount: 2,
      },
      error: null,
    }),
    ok: true,
  });

  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(
    <LlmProfilesConsole
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

  expect(document.querySelector('[data-llm-profile-row]')).not.toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.clear(screen.getByLabelText('Profile Name'));
  await userEvent.type(screen.getByLabelText('Profile Name'), 'Primary v2');
  await userEvent.clear(screen.getByLabelText('Model'));
  await userEvent.type(screen.getByLabelText('Model'), 'gpt-5.5');
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/llm-profiles/profile_1', expect.objectContaining({
      body: JSON.stringify({
        apiType: 'openai-responses',
        baseUrl: 'https://gateway.example.com/v1',
        model: 'gpt-5.5',
        name: 'Primary v2',
        provider: 'openai',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'PATCH',
    }));
  });
});

it('creates a new profile and prepends it to the list', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        profile: {
          apiType: 'openai-responses',
          baseUrl: 'https://gateway.example.com/v1',
          createdAt: '2026-04-17T05:00:00.000Z',
          hasApiKey: true,
          id: 'profile_2',
          model: 'gpt-5.4',
          name: 'Secondary',
          provider: 'openai',
          updatedAt: '2026-04-17T05:00:00.000Z',
        },
        restartRequestedBotCount: 0,
      },
      error: null,
    }),
    ok: true,
  });

  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(<LlmProfilesConsole profiles={[]} />, { locale: 'en' });

  await userEvent.type(screen.getByLabelText('Profile Name'), 'Secondary');
  await userEvent.type(screen.getByLabelText('Provider'), 'openai');
  await userEvent.type(screen.getByLabelText('Model'), 'gpt-5.4');
  await userEvent.click(screen.getByRole('combobox', { name: 'API Type' }));
  await userEvent.click(screen.getByRole('option', { name: 'openai-completions' }));
  await userEvent.type(screen.getByLabelText('API Key'), 'sk-user-2');
  await userEvent.click(screen.getByRole('button', { name: 'Create Profile' }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/llm-profiles', expect.objectContaining({
      body: JSON.stringify({
        apiType: 'openai-completions',
        baseUrl: null,
        model: 'gpt-5.4',
        name: 'Secondary',
        provider: 'openai',
        apiKey: 'sk-user-2',
      }),
      method: 'POST',
    }));
  });

  expect(await screen.findByText('Secondary')).toBeInTheDocument();
});

it('requires choosing an api type before creating a profile', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(<LlmProfilesConsole profiles={[]} />, { locale: 'en' });

  await userEvent.type(screen.getByLabelText('Profile Name'), 'Claude');
  await userEvent.type(screen.getByLabelText('Provider'), 'anthropic');
  await userEvent.type(screen.getByLabelText('Model'), 'claude-sonnet-4-5');
  await userEvent.type(screen.getByLabelText('API Key'), 'sk-anthropic');
  await userEvent.click(screen.getByRole('button', { name: 'Create Profile' }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByText('Select an API type before saving the profile.')).toBeInTheDocument();
});

it('shows required markers and explains the optional base url behavior', () => {
  const { container } = renderWithLocale(<LlmProfilesConsole profiles={[]} />, { locale: 'en' });

  expect(container.querySelector('[data-llm-profile-label="name"] [data-required-indicator]')).not.toBeNull();
  expect(container.querySelector('[data-llm-profile-label="provider"] [data-required-indicator]')).not.toBeNull();
  expect(container.querySelector('[data-llm-profile-label="model"] [data-required-indicator]')).not.toBeNull();
  expect(container.querySelector('[data-llm-profile-label="apiType"] [data-required-indicator]')).not.toBeNull();
  expect(container.querySelector('[data-llm-profile-label="apiKey"] [data-required-indicator]')).not.toBeNull();
  expect(screen.getByText('Leave blank to use the provider official default URL.')).toBeInTheDocument();
});

it('removes the api key required marker while editing an existing profile', async () => {
  const { container } = renderWithLocale(
    <LlmProfilesConsole
      profiles={[
        {
          apiType: 'openai-completions',
          baseUrl: null,
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
    { locale: 'en' },
  );

  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

  expect(container.querySelector('[data-llm-profile-label="apiKey"] [data-required-indicator]')).toBeNull();
});

it('does not silently backfill a legacy empty api type while editing', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(
    <LlmProfilesConsole
      profiles={[
        {
          apiType: null,
          baseUrl: null,
          createdAt: '2026-04-17T02:00:00.000Z',
          hasApiKey: true,
          id: 'profile_1',
          model: 'claude-sonnet-4-5',
          name: 'Claude',
          provider: 'anthropic',
          updatedAt: '2026-04-17T03:00:00.000Z',
        },
      ]}
    />,
    { locale: 'en' },
  );

  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.clear(screen.getByLabelText('Model'));
  await userEvent.type(screen.getByLabelText('Model'), 'claude-opus-4-1');
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByText('Select an API type before saving the profile.')).toBeInTheDocument();
});

it('deletes an unused profile from the list', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        id: 'profile_1',
      },
      error: null,
    }),
    ok: true,
  });

  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(
    <LlmProfilesConsole
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

  await userEvent.click(screen.getByRole('button', { name: 'Delete Profile' }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/llm-profiles/profile_1', {
      method: 'DELETE',
    });
  });

  expect(screen.queryByText('Primary')).not.toBeInTheDocument();
});
