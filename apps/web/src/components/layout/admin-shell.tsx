'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Menu, Server, Ticket } from 'lucide-react';
import { AccountMenu } from '@/components/layout/account-menu';
import { BrandLockup } from '@/components/layout/brand-lockup';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface AdminShellProps {
  children: ReactNode;
  email: string;
}

interface AdminShellNavProps {
  email: string;
  layout: 'rail' | 'sheet';
}

const DESKTOP_SHELL_MAX_WIDTH = '1480px';
const DESKTOP_SHELL_SIDE_PADDING = '1.5rem';
const DESKTOP_RAIL_LEFT_OFFSET = `max(${DESKTOP_SHELL_SIDE_PADDING}, calc((100vw - ${DESKTOP_SHELL_MAX_WIDTH}) / 2 + ${DESKTOP_SHELL_SIDE_PADDING}))`;

function AdminShellNav({ email, layout }: AdminShellNavProps) {
  const { t } = useLocale();
  const pathname = usePathname();
  const isSandboxRuntimeRoute = pathname === '/admin/sandbox-runtime';
  const isInvitesRoute = pathname.startsWith('/admin/invites');

  return (
    <div className="flex h-full min-h-0 flex-col gap-6" data-admin-shell-nav={layout}>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <BrandLockup
            className="items-center gap-4"
            labelClassName="leading-none"
            variant="rail"
          />
          <div className="grid gap-1.5">
            <strong className="text-xl font-semibold text-foreground">
              {t((messages) => messages.shell.adminWorkspaceTitle)}
            </strong>
            <span className="max-w-[18rem] text-sm leading-6 text-muted-foreground">
              {t((messages) => messages.shell.adminWorkspaceDescription)}
            </span>
          </div>
        </div>

        <nav aria-label={t((messages) => messages.shell.adminWorkspaceTitle)} className="grid gap-3">
          <AdminNavLink
            href="/admin/sandbox-runtime"
            icon={<Server className="h-4 w-4" />}
            isActive={isSandboxRuntimeRoute}
            label={t((messages) => messages.shell.adminSandboxRuntime)}
          />
          <AdminNavLink
            href="/admin/invites"
            icon={<Ticket className="h-4 w-4" />}
            isActive={isInvitesRoute}
            label={t((messages) => messages.shell.invites)}
          />
          <AdminNavLink
            href="/bots"
            icon={<Bot className="h-4 w-4" />}
            isActive={false}
            label={t((messages) => messages.shell.bots)}
          />
        </nav>
      </div>

      <div className="mt-auto pt-2" data-admin-shell-nav-bottom="">
        <AccountMenu email={email} isAdmin />
      </div>
    </div>
  );
}

interface AdminNavLinkProps {
  href: string;
  icon: ReactNode;
  isActive: boolean;
  label: string;
}

function AdminNavLink({ href, icon, isActive, label }: AdminNavLinkProps) {
  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-[background-color,color,border-color]',
        isActive
          ? 'border border-[color:var(--border-soft)] bg-[color:var(--accent-soft)] text-foreground'
          : 'bg-transparent text-muted-foreground hover:bg-[color:var(--surface-muted)] hover:text-foreground'
      )}
      href={href}
    >
      {icon}
      {label}
    </Link>
  );
}

export function AdminShell({ children, email }: AdminShellProps) {
  const { t } = useLocale();
  const shellFrameStyle: CSSProperties & Record<'--shell-rail-left', string> = {
    '--shell-rail-left': DESKTOP_RAIL_LEFT_OFFSET,
  };

  const mobileNavigation = (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          aria-label={t((messages) => messages.shell.openNavigation)}
          size="icon"
          type="button"
          variant="outline"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        aria-describedby={undefined}
        className="flex h-full w-[min(88vw,20rem)] flex-col border-r-[color:var(--border-soft)]/50 bg-[color:var(--app-panel)]/92"
      >
        <SheetTitle className="sr-only">{t((messages) => messages.shell.adminWorkspaceTitle)}</SheetTitle>
        <AdminShellNav email={email} layout="sheet" />
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="min-h-screen bg-background">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-[color:var(--surface)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring"
        href="#main-content"
      >
        {t((messages) => messages.shell.skipToMain)}
      </a>
      <div
        className="mx-auto grid min-h-screen max-w-[1480px] gap-4 px-4 py-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:px-6"
        data-admin-shell-frame=""
        style={shellFrameStyle}
      >
        <aside className="hidden lg:block">
          <div
            className="flex flex-col rounded-[var(--radius-shell)] border border-[color:var(--border-soft)] bg-[color:var(--app-panel)] p-4 lg:fixed lg:left-[var(--shell-rail-left)] lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[248px]"
            data-admin-shell-rail=""
          >
            <AdminShellNav email={email} layout="rail" />
          </div>
        </aside>

        <div className="grid min-h-screen content-start gap-4">
          <header className="sticky top-0 z-20 border-b border-[color:var(--border-soft)] bg-[color:var(--app-bg)]/92 py-2 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="lg:hidden">{mobileNavigation}</div>
                <span className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                  {t((messages) => messages.shell.adminConsole)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
            </div>
          </header>

          <main
            className="grid content-start gap-6 py-2 lg:py-3"
            data-admin-shell-main=""
            id="main-content"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
