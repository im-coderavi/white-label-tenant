import * as React from 'react';
import { cn } from '../../lib/utils';

/** Wraps a table so wide content scrolls inside the card instead of the page. */
const TableWrap = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('w-full overflow-x-auto rounded-lg border border-border bg-surface shadow-card', className)}
      {...props}
    />
  )
);
TableWrap.displayName = 'TableWrap';

const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn('w-full border-collapse text-sm', className)} {...props} />
  )
);
Table.displayName = 'Table';

const THead = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('border-b border-border bg-secondary/60', className)} {...props} />
  )
);
THead.displayName = 'THead';

const TBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('divide-y divide-border', className)} {...props} />
  )
);
TBody.displayName = 'TBody';

const TR = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('transition-colors hover:bg-secondary/40', className)} {...props} />
  )
);
TR.displayName = 'TR';

const TH = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'whitespace-nowrap px-4 py-3 text-left text-eyebrow uppercase text-muted first:pl-5 last:pr-5',
        className
      )}
      {...props}
    />
  )
);
TH.displayName = 'TH';

const TD = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('px-4 py-3 align-middle first:pl-5 last:pr-5', className)} {...props} />
  )
);
TD.displayName = 'TD';

export { TableWrap, Table, THead, TBody, TR, TH, TD };
