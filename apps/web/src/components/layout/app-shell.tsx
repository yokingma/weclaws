'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Menu, Plus } from 'lucide-react';
import { AccountMenu } from '@/components/layout/account-menu';
import { BrandLockup } from '@/components/layout/brand-lockup';
import { ConsoleToolbar } from '@/components/layout/console-toolbar';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  email: string;
  fastAgentCliVersion?: string | null;
  isAdmin: boolean;
}

interface AppShellNavProps {
  email: string;
  isAdmin: boolean;
  layout: 'rail' | 'sheet';
}

const DESKTOP_SHELL_MAX_WIDTH = '1480px';
const DESKTOP_SHELL_SIDE_PADDING = '1.5rem';
const DESKTOP_RAIL_LEFT_OFFSET = `max(${DESKTOP_SHELL_SIDE_PADDING}, calc((100vw - ${DESKTOP_SHELL_MAX_WIDTH}) / 2 + ${DESKTOP_SHELL_SIDE_PADDING}))`;

function AppShellNav({ email, isAdmin, layout }: AppShellNavProps) {
  const { t } = useLocale();
  const pathname = usePathname();
  const isBotsRoute = pathname === '/bots' || pathname.startsWith('/bots/');

  return (
    <div className="flex h-full min-h-0 flex-col gap-6" data-shell-nav={layout}>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <BrandLockup
            className="items-center gap-4"
            labelClassName="leading-none"
            variant="rail"
          />
          <div className="grid gap-1.5">
            <strong className="text-xl font-semibold text-foreground">
              {t((messages) => messages.shell.workspaceTitle)}
            </strong>
            <span className="max-w-[18rem] text-sm leading-6 text-muted-foreground">
              {t((messages) => messages.shell.workspaceDescription)}
            </span>
          </div>
        </div>

        <nav aria-label={t((messages) => messages.shell.workspaceTitle)} className="grid gap-3">
          <Link
            aria-current={isBotsRoute ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-[background-color,color,border-color]',
              isBotsRoute
                ? 'border border-[color:var(--border-soft)]/80 bg-[color:var(--surface-elevated)]/88 text-foreground shadow-none'
                : 'bg-transparent text-muted-foreground hover:bg-[color:var(--surface-muted)] hover:text-foreground'
            )}
            href="/bots"
          >
            <Bot className="h-4 w-4" />
            {t((messages) => messages.shell.bots)}
          </Link>
          <Link href="/bots/new">
            <Button className="w-full justify-start" type="button">
              <Plus className="h-4 w-4" />
              {t((messages) => messages.shell.createBot)}
            </Button>
          </Link>
        </nav>
      </div>

      <div className="mt-auto pt-2" data-shell-nav-bottom="">
        <AccountMenu email={email} isAdmin={isAdmin} />
      </div>
    </div>
  );
}

export function AppShell({ children, email, fastAgentCliVersion, isAdmin }: AppShellProps) {
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
        <SheetTitle className="sr-only">{t((messages) => messages.shell.workspaceTitle)}</SheetTitle>
        <AppShellNav email={email} isAdmin={isAdmin} layout="sheet" />
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
        data-shell-frame=""
        style={shellFrameStyle}
      >
        <aside className="hidden lg:block">
          <div
            className="flex flex-col rounded-[var(--radius-shell)] border border-[color:var(--border-soft)] bg-[color:var(--app-panel)] p-4 lg:fixed lg:left-[var(--shell-rail-left)] lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[248px]"
            data-shell-rail=""
          >
            <AppShellNav email={email} isAdmin={isAdmin} layout="rail" />
          </div>
        </aside>

        <div className="grid min-h-screen content-start gap-4">
          <ConsoleToolbar fastAgentCliVersion={fastAgentCliVersion} navigation={mobileNavigation} />

          <main
            className="grid content-start gap-6 py-2 lg:py-3"
            data-shell-main=""
            id="main-content"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
