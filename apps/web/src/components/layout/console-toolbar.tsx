'use client';

import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useLocale } from '@/components/providers/locale-provider';

interface ConsoleToolbarProps {
  fastAgentCliVersion?: string | null;
  navigation?: ReactNode;
}

export function ConsoleToolbar({ fastAgentCliVersion, navigation }: ConsoleToolbarProps) {
  const { t } = useLocale();

  return (
    <header
      className="sticky top-0 z-20 border-b border-[color:var(--border-soft)] bg-[color:var(--app-bg)]/92 py-2 backdrop-blur"
      data-console-toolbar=""
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {navigation ? <div className="lg:hidden">{navigation}</div> : null}
          {fastAgentCliVersion ? (
            <span className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 text-xs font-semibold tracking-[0.01em] text-foreground">
              {t((messages) => messages.shell.fastAgentCliVersion)} v{fastAgentCliVersion}
            </span>
          ) : null}
          {!navigation && !fastAgentCliVersion ? <div aria-hidden className="hidden h-9 w-9 lg:block" /> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
