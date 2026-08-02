import * as React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const alertVariants = cva('flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm', {
  variants: {
    tone: {
      danger: 'border-destructive/25 bg-destructive/[0.07] text-destructive',
      success: 'border-success/25 bg-success/[0.07] text-success',
      info: 'border-primary/20 bg-primary/[0.06] text-primary',
    },
  },
  defaultVariants: { tone: 'danger' },
});

const ICONS = { danger: AlertCircle, success: CheckCircle2, info: Info } as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

/**
 * Inline feedback. Always announced: errors and confirmations both need to reach
 * screen readers at the moment they appear.
 */
export function Alert({ className, tone = 'danger', children, ...props }: AlertProps): JSX.Element {
  const Icon = ICONS[tone ?? 'danger'];
  return (
    <div role="alert" className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="font-medium leading-snug">{children}</span>
    </div>
  );
}
