'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Settings, Shield, User } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import {
  DropdownMenu,
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface AccountMenuProps {
  align?: 'start' | 'end';
  className?: string;
  email: string;
  isAdmin?: boolean;
}

export function AccountMenu({ align = 'start', className, email, isAdmin = false }: AccountMenuProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const monogram = email.trim().charAt(0).toUpperCase() || '?';

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      const result = await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push('/login');
          },
        },
      });

      if (result?.error) {
        setIsSigningOut(false);
      }
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t((messages) => messages.shell.openAccountMenu)}
          className={cn(
            'group flex w-full items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-3 text-left transition-[border-color,background-color] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            className
          )}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[color:var(--accent-strong)] text-sm font-semibold text-[color:var(--accent-contrast)]">
              {monogram}
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                {t((messages) => messages.shell.account)}
              </span>
              <span className="truncate text-sm font-medium text-foreground" title={email}>
                {email}
              </span>
            </span>
          </span>

          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)] transition-colors group-hover:text-foreground">
            <ChevronDown className="h-4 w-4" />
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-[min(19rem,calc(100vw-2rem))]"
        side="top"
        sideOffset={12}
      >
        <DropdownMenuItem disabled>
          <User className="h-4 w-4" />
          <span>{t((messages) => messages.shell.accountDetails)}</span>
          <DropdownMenuShortcut>{t((messages) => messages.common.comingSoon)}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            <span>{t((messages) => messages.shell.accountSettings)}</span>
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/sandbox-runtime">
              <Shield className="h-4 w-4" />
              <span>{t((messages) => messages.shell.adminConsole)}</span>
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-[color:var(--status-danger)] focus:bg-[color:var(--status-danger-soft)] focus:text-[color:var(--status-danger)]"
          disabled={isSigningOut}
          onSelect={() => {
            void handleSignOut();
          }}
        >
          <LogOut className="h-4 w-4" />
          <span>{t((messages) => messages.shell.logout)}</span>
        </DropdownMenuItem>
        <DropdownMenuArrow />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
