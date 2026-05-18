import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
}

export function PageHeader({ actions, className, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className={cn('grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end', className)}>
      <div className="grid gap-4">
        {eyebrow ? (
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="grid gap-3">
          <h1 className="m-0 text-3xl font-semibold text-foreground lg:text-[2.9rem]">
            {title}
          </h1>
          {description ? (
            <div className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div> : null}
    </header>
  );
}
