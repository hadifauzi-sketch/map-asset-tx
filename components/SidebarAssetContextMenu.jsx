import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Grid2X2, Layers3, X } from 'lucide-react';
import { Badge } from './ui/badge';

function SidebarAssetContextMenu({ menu, onClose, onShowCards }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    const handleWindowChange = () => onClose?.();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [menu, onClose]);

  if (!menu || typeof document === 'undefined') {
    return null;
  }

  const assetCount = menu.assets?.length || 0;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed z-[3900] w-[280px] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_18px_60px_rgba(15,23,42,0.26)]"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="border-b border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {menu.typeLabel || 'Asset group'}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-[var(--foreground)]">
              {menu.title || 'Unnamed group'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
            onClick={onClose}
            aria-label="Close asset menu"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
            {assetCount} asset{assetCount === 1 ? '' : 's'}
          </Badge>
          {menu.subtitle ? (
            <span className="max-w-full truncate text-[11px] text-[var(--muted)]">{menu.subtitle}</span>
          ) : null}
        </div>
      </div>

      <div className="p-2">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={assetCount === 0}
          onClick={() => onShowCards?.(menu)}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
            <Grid2X2 className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--foreground)]">Show all asset in Card</span>
            <span className="block text-xs text-[var(--muted)]">Open a professional asset card gallery.</span>
          </span>
        </button>

        <div className="mt-1 flex items-center gap-2 rounded-lg bg-[var(--card-muted)] px-3 py-2 text-[11px] text-[var(--muted)]">
          <Layers3 className="h-3.5 w-3.5 shrink-0" />
          <span>Tip: right-click a company or floor in the sidebar.</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SidebarAssetContextMenu;
