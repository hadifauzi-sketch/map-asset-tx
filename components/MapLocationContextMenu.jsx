import React, { useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ExternalLink, MapPin, Plus, Search, Share2 } from 'lucide-react';

function formatCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : '-';
}

function getMenuPosition(menu) {
  if (typeof window === 'undefined') {
    return { left: menu.x, top: menu.y };
  }

  const width = 280;
  const height = 266;
  const margin = 12;

  return {
    left: Math.max(margin, Math.min(menu.x, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(menu.y, window.innerHeight - height - margin)),
  };
}

function MenuItem({ icon: Icon, label, helper, disabled = false, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--card-muted)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--foreground)]">{label}</span>
        {helper ? <span className="block text-xs text-[var(--muted)]">{helper}</span> : null}
      </span>
    </button>
  );
}

function MapLocationContextMenu({
  menu,
  canAddAsset = true,
  onClose,
  onShowAddress,
  onAddAsset,
  onOpenGoogleMaps,
  onShareLocation,
  onSearchAsset,
}) {
  const menuRef = useRef(null);
  const position = useMemo(() => getMenuPosition(menu), [menu]);
  const latitude = formatCoordinate(menu.lat);
  const longitude = formatCoordinate(menu.lng);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) {
        return;
      }
      onClose?.();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed z-[3900] w-[280px] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-[0_18px_60px_rgba(0,0,0,0.34)]"
      style={position}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="border-b border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Map location
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2 py-1.5">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Lat</span>
            <span className="font-semibold text-[var(--foreground)]">{latitude}</span>
          </div>
          <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2 py-1.5">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Lng</span>
            <span className="font-semibold text-[var(--foreground)]">{longitude}</span>
          </div>
        </div>
      </div>

      <div className="py-1">
        <MenuItem
          icon={MapPin}
          label="Show address"
          helper="Show latitude and longitude"
          onClick={onShowAddress}
        />
        <MenuItem
          icon={Plus}
          label="Add asset TX here"
          helper={canAddAsset ? 'Open transformer form at this pin' : 'Read-only access'}
          disabled={!canAddAsset}
          onClick={onAddAsset}
        />
        <MenuItem
          icon={ExternalLink}
          label="Open this on Google Maps"
          helper="Open this coordinate in a new tab"
          onClick={onOpenGoogleMaps}
        />
        <MenuItem
          icon={Share2}
          label="Share this location"
          helper="Share or copy a map link"
          onClick={onShareLocation}
        />
        <MenuItem
          icon={Search}
          label="Search the Asset"
          helper="Focus asset search"
          onClick={onSearchAsset}
        />
      </div>
    </div>,
    document.body
  );
}

export default MapLocationContextMenu;
