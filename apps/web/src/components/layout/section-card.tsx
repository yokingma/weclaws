import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  headerClassName?: string;
  title?: ReactNode;
}

export function SectionCard({
  children,
  className,
  contentClassName,
  description,
  headerClassName,
  title,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        'rounded-[var(--radius-panel)] border-[color:var(--border-soft)] bg-[color:var(--surface)] shadow-none',
        className
      )}
    >
      {title || description ? (
        <CardHeader className={cn('gap-2 border-b border-[color:var(--border-soft)] px-4 py-3', headerClassName)}>
          {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
          {description ? <p className="m-0 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn('p-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
