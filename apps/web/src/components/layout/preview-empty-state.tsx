import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PreviewEmptyStateProps {
  badge: ReactNode;
  className?: string;
  description: ReactNode;
  title?: ReactNode;
}

export function PreviewEmptyState({ badge, className, description, title }: PreviewEmptyStateProps) {
  return (
    <div
      className={cn(
        'grid min-h-40 place-items-center rounded-[var(--radius-panel)] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-5 py-8 text-center',
        className
      )}
    >
      <div className="grid max-w-md gap-3">
        <div className="flex justify-center">
          <Badge variant="outline">{badge}</Badge>
        </div>
        <div className="grid gap-2">
          {title ? <h3 className="m-0 text-base font-semibold text-foreground">{title}</h3> : null}
          <p className="m-0 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
