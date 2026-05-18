'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { t } = useLocale();
  const { setTheme, theme } = useTheme();

  return (
    <div
      className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-0.5"
      data-toolbar-control="theme"
    >
      <Button
        aria-pressed={theme === 'light'}
        className={cn(
          'h-8 rounded-[0.7rem] px-3 text-[11px] tracking-[0.01em]',
          theme === 'light'
            ? 'bg-[color:var(--accent-soft)] text-foreground'
            : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
        )}
        onClick={() => setTheme('light')}
        size="sm"
        type="button"
        variant="ghost"
      >
        {t((messages) => messages.shell.themeLight)}
      </Button>
      <Button
        aria-pressed={theme === 'dark'}
        className={cn(
          'h-8 rounded-[0.7rem] px-3 text-[11px] tracking-[0.01em]',
          theme === 'dark'
            ? 'bg-[color:var(--accent-soft)] text-foreground'
            : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
        )}
        onClick={() => setTheme('dark')}
        size="sm"
        type="button"
        variant="ghost"
      >
        {t((messages) => messages.shell.themeDark)}
      </Button>
    </div>
  );
}
