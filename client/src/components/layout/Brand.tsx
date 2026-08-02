import { Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BrandProps {
  className?: string;
  /** Hides the wordmark, leaving just the mark (used in tight headers). */
  markOnly?: boolean;
}

export function Brand({ className, markOnly = false }: BrandProps): JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-card">
        <Layers className="size-[18px]" aria-hidden="true" />
      </span>
      {!markOnly && (
        <span className="font-display text-[1.0625rem] font-extrabold tracking-tight">
          Toolzy<span className="text-primary">Pro</span>
        </span>
      )}
    </span>
  );
}
