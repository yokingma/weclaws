// @vitest-environment jsdom

import * as React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLocale } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminInvitesConsole } from '../admin-invites-console';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('renders invite usage states for existing records', () => {
  renderWithLocale(
    <AdminInvitesConsole
      invites={[
        {
          canDelete: true,
          code: 'INV-READY',
          createdAt: '2026-04-02T07:00:00.000Z',
          createdByEmail: 'admin@example.com',
          id: 'invite_1',
          reservedAt: null,
          reservedByEmail: null,
          usedAt: null,
          usedByEmail: null,
        },
        {
          canDelete: false,
          code: 'INV-RESERVED',
          createdAt: '2026-04-02T06:45:00.000Z',
          createdByEmail: 'admin@example.com',
          id: 'invite_reserved',
          reservedAt: '2026-04-02T06:50:00.000Z',
          reservedByEmail: 'pending@example.com',
          usedAt: null,
          usedByEmail: null,
        },
        {
          canDelete: false,
          code: 'INV-USED',
          createdAt: '2026-04-02T06:00:00.000Z',
          createdByEmail: 'admin@example.com',
          id: 'invite_2',
          reservedAt: null,
          reservedByEmail: null,
          usedAt: '2026-04-02T06:30:00.000Z',
          usedByEmail: 'member@example.com',
        },
      ]}
    />,
    { locale: 'en' }
  );

  expect(screen.getByText('INV-READY')).toBeInTheDocument();
  expect(screen.getByText('Available')).toBeInTheDocument();
  expect(screen.getByText('Reserved')).toBeInTheDocument();
  expect(screen.getByText('pending@example.com')).toBeInTheDocument();
  expect(screen.getByText('Used')).toBeInTheDocument();
  expect(document.querySelectorAll('[data-invite-audit-row]')).toHaveLength(3);
  expect(screen.getAllByText('admin@example.com')).toHaveLength(3);
  expect(screen.getByText('member@example.com')).toBeInTheDocument();
  expect(screen.queryByText('admin_1')).not.toBeInTheDocument();
  expect(screen.queryByText('user_2')).not.toBeInTheDocument();
});

it('creates a new invite and prepends it to the list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        canDelete: true,
        code: 'INV-NEWCODE',
        createdAt: '2026-04-02T08:00:00.000Z',
        createdByEmail: 'admin@example.com',
        id: 'invite_3',
        reservedAt: null,
        reservedByEmail: null,
        usedAt: null,
        usedByEmail: null,
      },
      error: null,
    }),
  }));

  renderWithLocale(<AdminInvitesConsole invites={[]} />, { locale: 'en' });

  await userEvent.click(screen.getByRole('button', { name: 'Generate Invite' }));

  expect(await screen.findByText('INV-NEWCODE')).toBeInTheDocument();
  expect(screen.getByText('admin@example.com')).toBeInTheDocument();
});

it('deletes an unused invite from the list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        id: 'invite_1',
      },
      error: null,
    }),
  }));

  renderWithLocale(
    <AdminInvitesConsole
      invites={[
        {
          canDelete: true,
          code: 'INV-READY',
          createdAt: '2026-04-02T07:00:00.000Z',
          createdByEmail: 'admin@example.com',
          id: 'invite_1',
          reservedAt: null,
          reservedByEmail: null,
          usedAt: null,
          usedByEmail: null,
        },
      ]}
    />,
    { locale: 'en' }
  );

  await userEvent.click(screen.getByRole('button', { name: 'Delete Invite' }));

  expect(await screen.queryByText('INV-READY')).not.toBeInTheDocument();
});

it('shows the API error when invite deletion fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({
      data: null,
      error: {
        code: 'INVITE_DELETE_NOT_ALLOWED',
        message: 'Only unused and unreserved invites can be deleted.',
      },
    }),
  }));

  renderWithLocale(
    <AdminInvitesConsole
      invites={[
        {
          canDelete: true,
          code: 'INV-READY',
          createdAt: '2026-04-02T07:00:00.000Z',
          createdByEmail: 'admin@example.com',
          id: 'invite_1',
          reservedAt: null,
          reservedByEmail: null,
          usedAt: null,
          usedByEmail: null,
        },
      ]}
    />,
    { locale: 'en' }
  );

  await userEvent.click(screen.getByRole('button', { name: 'Delete Invite' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Only unused and unreserved invites can be deleted.');
});
