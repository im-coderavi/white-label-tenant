import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-secondary text-muted',
        brand: 'border-primary/20 bg-primary/10 text-primary',
        accent: 'border-accent/20 bg-accent/10 text-accent',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        danger: 'border-destructive/20 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Maps a domain status onto a badge tone so status colour stays consistent app-wide. */
const STATUS_TONES: Record<string, BadgeProps['tone']> = {
  published: 'success',
  active: 'success',
  paid: 'success',
  activated: 'success',
  assigned: 'brand',
  available: 'brand',
  draft: 'neutral',
  pending: 'warning',
  archived: 'neutral',
  inactive: 'neutral',
  suspended: 'danger',
  failed: 'danger',
  revoked: 'danger',
  expired: 'danger',
  global: 'accent',
  optional: 'brand',
  private: 'warning',
  exclusive: 'accent',
};

export function statusTone(status: string): BadgeProps['tone'] {
  return STATUS_TONES[status?.toLowerCase()] ?? 'neutral';
}

export function StatusBadge({ status, className }: { status: string; className?: string }): JSX.Element {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {status}
    </Badge>
  );
}

export { Badge, badgeVariants };
