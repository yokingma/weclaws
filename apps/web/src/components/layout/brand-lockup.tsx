import { cn } from '@/lib/utils';

const BRAND_VARIANTS = {
  compact: {
    frame: 'h-10 w-10 rounded-[1rem]',
    label: 'text-[11px] tracking-[0.24em]',
  },
  hero: {
    frame: 'h-[2.1rem] w-[2.1rem] rounded-[0.9rem]',
    label: 'text-[18px] tracking-[0.22em]',
  },
  rail: {
    frame: 'h-11 w-11 rounded-[1.1rem]',
    label: 'text-[22px] font-black normal-case text-foreground',
  },
} as const;

type BrandVariant = keyof typeof BRAND_VARIANTS;

interface BrandLockupProps {
  className?: string;
  labelClassName?: string;
  variant?: BrandVariant;
}

export function BrandLockup({
  className,
  labelClassName,
  variant = 'compact',
}: BrandLockupProps) {
  const styles = BRAND_VARIANTS[variant];

  return (
    <div className={cn('inline-flex min-w-0 items-center gap-3', className)}>
      <span
        data-brand-frame=""
        className={cn(
          'inline-flex shrink-0 overflow-hidden border border-black/10 bg-black shadow-[0_18px_40px_-28px_rgba(15,15,15,0.92)]',
          styles.frame,
        )}
      >
        <img
          alt="WeClaws logo"
          className="h-full w-full object-cover"
          decoding="async"
          height="720"
          loading="lazy"
          src="/brand/logo-black.png"
          width="720"
        />
      </span>
      <span
        data-brand-label=""
        className={cn(
          'truncate font-semibold uppercase text-[color:var(--text-soft)]',
          styles.label,
          labelClassName,
        )}
      >
        WeClaws
      </span>
    </div>
  );
}
