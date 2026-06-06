import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';

function Combobox({ value, onValueChange, options = [], placeholder = 'Select...', className, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);

  const recalc = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    recalc();
    const onScroll = () => recalc();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', recalc);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(p => !p); }}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md',
          'border border-[color:var(--border)] bg-[var(--card)] px-3 py-2',
          'text-sm shadow-sm transition-colors duration-150',
          disabled
            ? 'cursor-not-allowed opacity-50 text-[var(--muted)]'
            : 'text-[var(--foreground)] hover:bg-[var(--card-muted)] cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
        )}
      >
        <span className={cn('truncate', !selected && 'text-[var(--muted)]')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      </button>

      {open && ReactDOM.createPortal(
        <>
          {/* Backdrop — closes dropdown when clicking outside */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'auto' }}
            onClick={() => setOpen(false)}
          />
          {/* Dropdown list */}
          <div
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, pointerEvents: 'auto' }}
            className="rounded-md border border-[color:var(--border)] bg-[var(--card)] shadow-[var(--shadow-dialog)] overflow-hidden"
          >
            <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
              {options.map(opt => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => { onValueChange(opt.value); setOpen(false); }}
                  className={cn(
                    'flex cursor-pointer select-none items-center px-3 py-2.5 text-sm',
                    'transition-colors duration-100 hover:bg-[var(--card-muted)]',
                    opt.value === value
                      ? 'text-[var(--primary)] font-medium'
                      : 'text-[var(--foreground)]',
                  )}
                >
                  <Check className={cn(
                    'mr-2.5 h-4 w-4 shrink-0 text-[var(--primary)]',
                    opt.value === value ? 'opacity-100' : 'opacity-0',
                  )} />
                  {opt.label}
                </li>
              ))}
            </ul>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

export { Combobox };
