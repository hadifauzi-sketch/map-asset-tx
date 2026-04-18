import React from 'react';
import { cn } from '../../lib/utils';

const variantClasses = {
  default:
    'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[color:var(--primary-strong)]',
  secondary:
    'bg-[var(--card-muted)] text-[var(--foreground)] hover:bg-[var(--card-strong)]',
  outline:
    'border border-[color:var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--card-muted)]',
  ghost:
    'bg-transparent text-[var(--foreground)] hover:bg-[var(--card-muted)]',
  destructive:
    'bg-[var(--destructive)] text-white hover:bg-[color:var(--destructive-strong)]',
};

const sizeClasses = {
  default: 'h-10 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
  icon: 'h-10 w-10',
};

const Button = React.forwardRef(function Button(
  { className, variant = 'default', size = 'default', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant] || variantClasses.default,
        sizeClasses[size] || sizeClasses.default,
        className
      )}
      {...props}
    />
  );
});

export { Button };
