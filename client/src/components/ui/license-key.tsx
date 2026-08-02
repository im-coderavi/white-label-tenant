import * as React from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface LicenseKeyProps {
  value: string;
  label?: string;
  meta?: React.ReactNode;
  className?: string;
}

/**
 * The product sells rights, and a key is the credential that carries them — so a key is
 * drawn as a tear-off stub (dot grid, perforated divider) rather than printed as plain text.
 */
export function LicenseKey({
  value,
  label = 'License key',
  meta,
  className,
}: LicenseKeyProps): JSX.Element {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the key stays selectable so copying by hand still works.
    }
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface shadow-card',
        className
      )}
    >
      <div className="key-grid flex items-stretch">
        <div className="min-w-0 flex-1 p-5">
          <p className="flex items-center gap-1.5 text-eyebrow uppercase text-muted">
            <KeyRound className="size-3.5" aria-hidden="true" />
            {label}
          </p>
          <p className="mt-2.5 select-all break-all font-mono text-lg font-bold tracking-[0.12em] text-foreground">
            {value}
          </p>
          {meta && <div className="mt-2.5 text-sm text-muted">{meta}</div>}
        </div>

        {/* Perforation between the key and its action, like a ticket stub. */}
        <div className="relative border-l border-dashed border-border" aria-hidden="true">
          <span className="absolute -left-[9px] -top-2 size-4 rounded-full border border-border bg-background" />
          <span className="absolute -bottom-2 -left-[9px] size-4 rounded-full border border-border bg-background" />
        </div>

        <div className="grid shrink-0 place-items-center px-4">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    </div>
  );
}
