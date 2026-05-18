// @vitest-environment jsdom

import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ConsoleToolbar } from '../console-toolbar';

const refreshMock = vi.fn();
const usePathnameMock = vi.fn(() => '/bots');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ refresh: refreshMock }),
}));

afterEach(() => {
  vi.clearAllMocks();
  document.cookie = 'locale=; Max-Age=0; path=/';
  document.cookie = 'theme=; Max-Age=0; path=/';
});

function renderToolbar(fastAgentCliVersion?: string | null) {
  return render(
    <ThemeProvider initialTheme="light">
      <LocaleProvider initialLocale="en">
        <ConsoleToolbar fastAgentCliVersion={fastAgentCliVersion} />
      </LocaleProvider>
    </ThemeProvider>
  );
}

it('shows a utility-only header without mixing admin navigation into the user workspace', () => {
  usePathnameMock.mockReturnValue('/admin/invites');

  renderToolbar();

  const banner = screen.getByRole('banner');
  const themeControl = banner.querySelector('[data-toolbar-control="theme"]');
  const languageControl = banner.querySelector('[data-toolbar-control="language"]');

  expect(banner).toHaveAttribute('data-console-toolbar');
  expect(banner).not.toHaveClass('shadow-[var(--shadow-soft)]');
  expect(within(banner).queryByText('WeClaws')).not.toBeInTheDocument();
  expect(within(banner).queryByAltText('WeClaws logo')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Invites' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Admin Console' })).not.toBeInTheDocument();
  expect(themeControl).toHaveClass('h-9');
  expect(languageControl).toHaveClass('h-9');
  expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument();
});

it('renders the FastAgent CLI version badge on the left side when version data is available', () => {
  renderToolbar('0.5.2');

  const banner = screen.getByRole('banner');

  expect(within(banner).getByText('FastAgent CLI v0.5.2')).toBeInTheDocument();
});

it('omits the FastAgent CLI version badge when version data is unavailable', () => {
  renderToolbar(null);

  expect(screen.queryByText('FastAgent CLI v0.5.2')).not.toBeInTheDocument();
});
