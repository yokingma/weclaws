'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-0.5"
      data-toolbar-control="language"
    >
      <Button
        className={cn(
          'h-8 rounded-[0.7rem] px-3 text-[11px] tracking-[0.01em]',
          locale === 'zh-CN'
            ? 'bg-[color:var(--accent-soft)] text-foreground'
            : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
        )}
        onClick={() => setLocale('zh-CN')}
        size="sm"
        type="button"
        variant="ghost"
      >
        {t((messages) => messages.shell.languageChinese)}
      </Button>
      <Button
        className={cn(
          'h-8 rounded-[0.7rem] px-3 text-[11px] tracking-[0.01em]',
          locale === 'en'
            ? 'bg-[color:var(--accent-soft)] text-foreground'
            : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
        )}
        onClick={() => setLocale('en')}
        size="sm"
        type="button"
        variant="ghost"
      >
        {t((messages) => messages.shell.languageEnglish)}
      </Button>
    </div>
  );
}
