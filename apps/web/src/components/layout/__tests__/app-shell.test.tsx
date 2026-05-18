// @vitest-environment jsdom

import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AppShell } from '../app-shell';

const usePathnameMock = vi.fn(() => '/bots');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  document.cookie = 'locale=; Max-Age=0; path=/';
  document.cookie = 'theme=; Max-Age=0; path=/';
});

function renderShell() {
  return render(
    <ThemeProvider initialTheme="light">
      <LocaleProvider initialLocale="en">
        <AppShell email="admin@example.com" isAdmin>
          <div>Shell Content</div>
        </AppShell>
      </LocaleProvider>
    </ThemeProvider>
  );
}

it('keeps account identity out of the top toolbar and renders it in the left rail', () => {
  renderShell();

  const rail = document.querySelector('[data-shell-nav="rail"]');
  const railBottom = rail?.querySelector('[data-shell-nav-bottom]');

  expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content');
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  expect(within(screen.getByRole('banner')).queryByText('admin@example.com')).not.toBeInTheDocument();
  expect(rail).not.toBeNull();
  expect(railBottom).not.toBeNull();
  expect(within(railBottom as HTMLElement).getByText('admin@example.com')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /overview/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /sessions/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /files/i })).not.toBeInTheDocument();
});

it('renders the account card inside the mobile navigation sheet', async () => {
  renderShell();

  await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));

  const dialog = await screen.findByRole('dialog');
  const sheetNav = dialog.querySelector('[data-shell-nav="sheet"]');
  const sheetBottom = sheetNav?.querySelector('[data-shell-nav-bottom]');

  expect(sheetNav).not.toBeNull();
  expect(sheetBottom).not.toBeNull();
  expect(within(sheetBottom as HTMLElement).getByText('admin@example.com')).toBeInTheDocument();
  expect(within(sheetBottom as HTMLElement).getByRole('button', { name: /open account menu/i })).toBeInTheDocument();
});

it('uses document scrolling while keeping the desktop rail fixed in the viewport', () => {
  renderShell();

  const shellFrame = document.querySelector<HTMLElement>('[data-shell-frame]');
  const rail = document.querySelector<HTMLElement>('[data-shell-rail]');
  const main = document.querySelector<HTMLElement>('[data-shell-main]');
  const scrollRegion = document.querySelector<HTMLElement>('[data-shell-scroll-region]');

  expect(shellFrame).not.toBeNull();
  expect(rail).not.toBeNull();
  expect(main).not.toBeNull();
  expect(scrollRegion).toBeNull();
  expect(shellFrame).not.toHaveClass('lg:h-screen', 'lg:overflow-hidden');
  expect(shellFrame).toHaveClass('lg:grid-cols-[248px_minmax(0,1fr)]');
  expect(rail).toHaveClass('lg:fixed', 'lg:h-[calc(100vh-2rem)]');
  expect(main).not.toHaveClass('shadow-[var(--shadow-soft)]');
});

it('keeps Bots as a light selected nav item while preserving the Create Bot primary action', () => {
  renderShell();

  const botsLink = screen.getByRole('link', { name: 'Bots' });
  const createBotLink = screen.getByRole('link', { name: 'Create Bot' });
  const createBotButton = within(createBotLink).getByRole('button', { name: 'Create Bot' });

  expect(botsLink).toHaveAttribute('aria-current', 'page');
  expect(botsLink).toHaveClass('border-[color:var(--border-soft)]/80', 'bg-[color:var(--surface-elevated)]/88', 'text-foreground');
  expect(botsLink).not.toHaveClass('bg-[color:var(--accent-strong)]', 'text-[color:var(--accent-contrast)]');
  expect(createBotButton).toBeInTheDocument();
  expect(createBotButton).toHaveClass('justify-start');
});
