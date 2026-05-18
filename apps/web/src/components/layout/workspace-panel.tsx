import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WorkspacePanelProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  title: ReactNode;
}

export function WorkspacePanel({
  actions,
  children,
  className,
  contentClassName,
  description,
  title,
}: WorkspacePanelProps) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-panel)] border border-[color:var(--border-soft)] bg-[color:var(--surface)] shadow-none',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border-soft)] px-4 py-3">
        <div className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-foreground">{title}</h2>
          {description ? <p className="m-0 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
      <div className={cn('p-4', contentClassName)}>{children}</div>
    </section>
  );
}
