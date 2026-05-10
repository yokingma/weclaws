// @vitest-environment jsdom

import * as React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { BotsConsole } from '../bots-console';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('filters bots by runtime status and search text', async () => {
  renderWithLocale(
    <BotsConsole
      bots={[
        {
          id: '1',
          name: 'Alpha',
          provider: 'anthropic',
          model: 'claude-opus-4-6',
          workspaceId: 'w1',
          desiredState: 'running',
          status: 'running',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: '2',
          name: 'Beta',
          provider: 'anthropic',
          model: 'claude-opus-4-6',
          workspaceId: 'w2',
          desiredState: 'stopped',
          status: 'failed',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: '3',
          name: 'Mystery',
          provider: 'anthropic',
          model: 'claude-opus-4-6',
          workspaceId: 'w3',
          desiredState: 'running',
          status: 'mystery' as never,
          createdAt: '',
          updatedAt: '',
        },
      ]}
      quota={{
        isAtLimit: false,
        limit: 5,
        remainingCount: 2,
        usedCount: 3,
      }}
    />,
    { locale: 'en' }
  );

  expect(screen.getByText('3 of 5 bot slots used. 2 remaining.')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Unknown/i })).toBeInTheDocument();

  await userEvent.type(screen.getByRole('searchbox'), 'Beta');
  await userEvent.selectOptions(screen.getByRole('combobox'), 'failed');

  expect(screen.getByText('Beta')).toBeInTheDocument();
  expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
});

it('renames a bot inline from the list without using the detail page editor', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    data: {
      id: '1',
      name: 'Renamed Alpha',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      workspaceId: 'w1',
      desiredState: 'running',
      status: 'running',
      createdAt: '',
      updatedAt: '2026-05-10T10:00:00.000Z',
    },
    error: null,
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  renderWithLocale(
    <BotsConsole
      bots={[
        {
          id: '1',
          name: 'Alpha',
          provider: 'anthropic',
          model: 'claude-opus-4-6',
          workspaceId: 'w1',
          desiredState: 'running',
          status: 'running',
          createdAt: '',
          updatedAt: '',
        },
      ]}
      quota={{
        isAtLimit: false,
        limit: 5,
        remainingCount: 4,
        usedCount: 1,
      }}
    />,
    { locale: 'en' }
  );

  await userEvent.click(screen.getByText('Alpha'));
  await userEvent.clear(screen.getByRole('textbox', { name: 'Bot Name' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Bot Name' }), 'Renamed Alpha');
  await userEvent.keyboard('{Enter}');

  expect(fetchMock).toHaveBeenCalledWith('/api/bots/1', {
    body: JSON.stringify({ name: 'Renamed Alpha' }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'PATCH',
  });
  expect(await screen.findByText('Renamed Alpha')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
});
