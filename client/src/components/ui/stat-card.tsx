import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type Accent = 'primary' | 'accent' | 'success' | 'warning' | 'destructive';

const ACCENT_BAR: Record<Accent, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

const ACCENT_ICON: Record<Accent, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  className?: string;
}

/** KPI tile. The accent bar is the only colour on the card, so the number stays the focus. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'primary',
  className,
}: StatCardProps): JSX.Element {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface p-5 shadow-card',
        className
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-[3px]', ACCENT_BAR[accent])} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-eyebrow uppercase text-muted">{label}</p>
        {Icon && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-md', ACCENT_ICON[accent])}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-2xl font-bold leading-tight">{value}</div>
      {hint && <div className="mt-1.5 text-sm text-muted">{hint}</div>}
    </div>
  );
}
