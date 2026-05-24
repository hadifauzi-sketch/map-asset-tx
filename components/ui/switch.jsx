import React from 'react';
import { cn } from '../../lib/utils';

const Switch = React.forwardRef(
  ({ className, checked = false, disabled = false, onCheckedChange, onClick, ...props }, ref) => {
    const handleClick = (event) => {
      onClick?.(event);

      if (event.defaultPrevented || disabled) {
        return;
      }

      onCheckedChange?.(!checked);
    };

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        ref={ref}
        onClick={handleClick}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/35 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--card-muted)]',
          className
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';

export { Switch };
