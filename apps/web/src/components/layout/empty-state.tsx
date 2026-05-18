import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  action?: ReactNode;
  className?: string;
  description: ReactNode;
  title: ReactNode;
}

export function EmptyState({ action, className, description, title }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'grid gap-3 rounded-[var(--radius-panel)] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-5 py-7 text-center',
        className
      )}
    >
      <div className="grid gap-2">
        <h3 className="m-0 text-lg font-semibold text-foreground">{title}</h3>
        <div className="text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}
