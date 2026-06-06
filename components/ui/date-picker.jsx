import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PRESETS = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'In 3 days', offset: 3 },
  { label: 'In a week', offset: 7 },
];

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = MONTHS[date.getMonth()].slice(0, 3);
  return `${d} ${m} ${date.getFullYear()}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a, b) {
  return (
    a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), outside: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ date: new Date(year, month, i), outside: false });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ date: new Date(year, month + 1, i), outside: true });
  }
  return cells;
}

export function DatePicker({
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Pick a date',
  className,
}) {
  const today = startOfDay(new Date());
  const selected = parseDate(value);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [calView, setCalView] = useState('days'); // 'days' | 'months' | 'years'
  const [yearRangeStart, setYearRangeStart] = useState(
    Math.floor((selected?.getFullYear() ?? today.getFullYear()) / 12) * 12,
  );
  const triggerRef = useRef(null);

  const recalc = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const popupWidth = 360;
    let left = r.left;
    if (left + popupWidth > window.innerWidth - 8) {
      left = window.innerWidth - popupWidth - 8;
    }
    setPos({ top: r.bottom + 4, left });
  };

  useEffect(() => {
    if (!open) return;
    recalc();
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', recalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [open]);

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value]);

  const handleSelect = (date) => {
    onValueChange(toValue(date));
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const calDays = buildCalendarDays(viewYear, viewMonth);
  const yearGrid = Array.from({ length: 12 }, (_, i) => yearRangeStart + i);

  const openToMonths = () => {
    setYearRangeStart(Math.floor(viewYear / 12) * 12);
    setCalView('months');
  };

  const openToYears = () => {
    setYearRangeStart(Math.floor(viewYear / 12) * 12);
    setCalView('years');
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setCalView('days'); setOpen(p => !p); } }}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-md',
          'border border-[color:var(--border)] bg-[var(--card)] px-3 py-2',
          'text-sm shadow-sm transition-colors duration-150',
          disabled
            ? 'cursor-not-allowed opacity-50 text-[var(--muted)]'
            : 'cursor-pointer text-[var(--foreground)] hover:bg-[var(--card-muted)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <span className={cn('flex-1 text-left', !selected && 'text-[var(--muted)]')}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
      </button>

      {open && ReactDOM.createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'auto' }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: 360, zIndex: 9999, pointerEvents: 'auto' }}
            className="flex rounded-lg border border-[color:var(--border)] bg-[var(--card)] shadow-[var(--shadow-dialog)] overflow-hidden"
          >
            {/* Presets */}
            <div className="flex flex-col gap-1 border-r border-[color:var(--border)] p-3 w-[120px] shrink-0">
              <span className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Quick pick
              </span>
              {PRESETS.map(({ label, offset }) => {
                const d = startOfDay(addDays(today, offset));
                const active = isSameDay(selected, d);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelect(d)}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-sm transition-colors duration-100',
                      active
                        ? 'bg-[var(--primary)] font-medium text-white'
                        : 'text-[var(--foreground)] hover:bg-[var(--card-muted)]',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Calendar panel */}
            <div className="flex-1 p-3">

              {/* ── DAYS VIEW ── */}
              {calView === 'days' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={openToMonths}
                      title="Pick month / year"
                      className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] px-2 py-1 rounded-md hover:bg-[var(--card-muted)] transition-colors"
                    >
                      {MONTHS[viewMonth]} {viewYear}
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 mb-1">
                    {DAYS.map(d => (
                      <div key={d} className="flex h-8 items-center justify-center text-[11px] font-semibold text-[var(--muted)]">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calDays.map(({ date, outside }, i) => {
                      const isSel = isSameDay(date, selected);
                      const isToday = isSameDay(date, today);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelect(date)}
                          className={cn(
                            'flex h-8 items-center justify-center rounded-md text-sm transition-colors duration-100',
                            outside && 'text-[var(--muted)] opacity-30',
                            !outside && !isSel && 'text-[var(--foreground)] hover:bg-[var(--card-muted)]',
                            isToday && !isSel && 'border border-[color:var(--primary)] font-semibold text-[var(--primary)]',
                            isSel && 'bg-[var(--primary)] font-semibold text-white',
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── MONTHS VIEW ── */}
              {calView === 'months' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => setViewYear(y => y - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={openToYears}
                      title="Pick year"
                      className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] px-2 py-1 rounded-md hover:bg-[var(--card-muted)] transition-colors"
                    >
                      {viewYear}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewYear(y => y + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {MONTHS.map((m, i) => {
                      const isSelMonth = selected && selected.getFullYear() === viewYear && selected.getMonth() === i;
                      const isCurMonth = today.getFullYear() === viewYear && today.getMonth() === i;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setViewMonth(i); setCalView('days'); }}
                          className={cn(
                            'rounded-md py-2 text-sm transition-colors duration-100',
                            isSelMonth
                              ? 'bg-[var(--primary)] font-semibold text-white'
                              : isCurMonth
                              ? 'border border-[color:var(--primary)] font-semibold text-[var(--primary)] hover:bg-[var(--card-muted)]'
                              : 'text-[var(--foreground)] hover:bg-[var(--card-muted)]',
                          )}
                        >
                          {m.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── YEARS VIEW ── */}
              {calView === 'years' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => setYearRangeStart(y => y - 12)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {yearRangeStart} – {yearRangeStart + 11}
                    </span>
                    <button
                      type="button"
                      onClick={() => setYearRangeStart(y => y + 12)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {yearGrid.map((yr) => {
                      const isSelYear = selected && selected.getFullYear() === yr;
                      const isCurYear = today.getFullYear() === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => { setViewYear(yr); setCalView('months'); }}
                          className={cn(
                            'rounded-md py-2 text-sm transition-colors duration-100',
                            isSelYear
                              ? 'bg-[var(--primary)] font-semibold text-white'
                              : isCurYear
                              ? 'border border-[color:var(--primary)] font-semibold text-[var(--primary)] hover:bg-[var(--card-muted)]'
                              : 'text-[var(--foreground)] hover:bg-[var(--card-muted)]',
                          )}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
