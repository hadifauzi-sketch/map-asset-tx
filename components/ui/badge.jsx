import React from 'react';
import { cn } from '../../lib/utils';

const variantClasses = {
  default: 'bg-[var(--primary-soft)] text-[var(--primary-strong)]',
  secondary: 'bg-[var(--card-muted)] text-[var(--foreground)]',
  outline: 'border border-[color:var(--border)] bg-transparent text-[var(--foreground)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning-strong)]',
  success: 'bg-[var(--success-soft)] text-[var(--success-strong)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger-strong)]',
};

function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
        variantClasses[variant] || variantClasses.default,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
