import * as React from 'react';
import { cn } from '../../lib/utils';

const fieldStyles =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-card transition-colors placeholder:text-muted/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        fieldStyles,
        'h-10',
        type === 'file' &&
          'h-auto py-2 file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldStyles, 'min-h-[92px] resize-y', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(fieldStyles, 'h-10 cursor-pointer pr-8', className)} {...props} />
  )
);
Select.displayName = 'Select';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-sm font-medium text-foreground', className)}
      {...props}
    />
  )
);
Label.displayName = 'Label';

/** Inline validation copy shown directly beneath a control. */
const FieldError = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs font-medium text-destructive', className)} {...props} />
  )
);
FieldError.displayName = 'FieldError';

export { Input, Textarea, Select, Label, FieldError, fieldStyles };
