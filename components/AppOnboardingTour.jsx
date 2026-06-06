import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe,
  HelpCircle,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Layers3,
  MapPin,
  MousePointer2,
  MousePointerClick,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  SunMedium,
  X,
} from 'lucide-react';
import { Button } from './ui/button';

export const TOUR_STORAGE_KEY = 'tx-asset-map-tour-enabled';

export function readTourEnabled() {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function writeTourEnabled(enabled) {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, String(enabled));
  } catch {}
}

const SPOTLIGHT_PAD = 10;
const CARD_WIDTH = 320;
const CARD_H_EST = 230;

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to TX Asset Management',
    description:
      "Let's take a quick tour of the key features. Use the arrows to navigate, or skip anytime.",
    target: null,
    position: 'center',
    icon: Sparkles,
  },
  {
    id: 'quick-stats',
    title: 'Asset Dashboard',
    description:
      'Your live snapshot — total assets, areas/substations, companies, and states. Click any card to view the full filtered list.',
    target: '[data-tour="quick-stats"]',
    position: 'right',
    icon: BarChart3,
  },
  {
    id: 'settings-btn',
    title: 'Settings & Account',
    description:
      'Manage account settings, user roles (admin), asset visibility filters, and sign out from here.',
    target: '[data-tour="settings-btn"]',
    position: 'bottom',
    icon: Settings,
  },
  {
    id: 'sop-flowchart',
    title: 'SOP Flowchart',
    description:
      'Click the help icon (?) to open the Standard Operating Procedure flowchart — a step-by-step visual guide for transformer inspection, oil sampling, DGA analysis, and maintenance decisions.',
    target: '[data-tour="sop-btn"]',
    position: 'bottom',
    icon: HelpCircle,
  },
  {
    id: 'theme-toggle',
    title: 'Light & Dark Mode',
    description:
      'Switch between Light and Dark themes instantly. Your preference is saved — the app remembers it the next time you open it.',
    target: '[data-tour="theme-btn"]',
    position: 'bottom',
    icon: SunMedium,
  },
  {
    id: 'add-transformer',
    title: 'Add a Transformer',
    description:
      'Click "+ Transformer" to register a new asset. Fill in the details, then drop a pin on the map to set its exact location.',
    target: '[data-tour="add-transformer"]',
    position: 'right',
    icon: Plus,
  },
  {
    id: 'gps-register',
    title: 'GPS Field Registration',
    description:
      'Register a transformer from your phone or tablet at the site — your device GPS captures the exact location without manual map placement.',
    target: '[data-tour="gps-register"]',
    position: 'right',
    icon: MapPin,
  },
  {
    id: 'search',
    title: 'Search & Filter',
    description:
      'Search by company, floor/substation name, transformer ID, serial number, or state to instantly find any asset in the hierarchy.',
    target: '[data-tour="search"]',
    position: 'right',
    icon: Search,
  },
  {
    id: 'floor-hierarchy',
    title: 'Asset Hierarchy',
    description:
      'Assets are organized by state → company → floor/substation. Expand rows to drill down, and click a transformer to highlight it on the map.',
    target: '[data-tour="floor-hierarchy"]',
    position: 'right',
    icon: Layers3,
  },
  {
    id: 'right-click-context-menu',
    title: 'Right-Click for Quick Actions',
    description:
      'Right-click any company or floor/substation row in the sidebar to open a quick-action popup — see asset counts, jump to the full card gallery, or manage the area directly.',
    target: '[data-tour="floor-hierarchy"]',
    position: 'right',
    icon: MousePointerClick,
    image: '/tour/right-click-menu.jpg',
    legend: [
      { color: '#0ea5e9', fill: '#0ea5e914', label: 'Company / Parent context menu' },
      { color: '#8b5cf6', fill: '#8b5cf614', label: 'Area / Substation context menu' },
    ],
  },
  {
    id: 'asset-card-gallery',
    title: 'Asset Card Gallery',
    description:
      'Choosing "Show all asset in Card" opens a full-screen grid of every transformer in that company or floor — DGA health badge, oil test date, serial number, voltage, and more. Use the search bar to filter, or "Compare" to diff assets side by side.',
    target: null,
    position: 'center',
    icon: LayoutGrid,
    image: '/tour/asset-card-gallery.jpg',
  },
  {
    id: 'map-layers',
    title: 'Map Layers',
    description:
      'Switch between Street Map, Satellite, and Hybrid views. Hybrid overlays road labels on satellite imagery.',
    target: '[data-tour="map-layers"]',
    position: 'bottom',
    icon: Layers,
  },
  {
    id: 'map-tools',
    title: 'Map Tools',
    description:
      'Expand the toolbar to draw company boundaries and floor plan overlays, toggle layers on/off, or unlock pins to reposition transformers.',
    target: '[data-tour="map-tools"]',
    position: 'bottom',
    icon: Pencil,
  },
  {
    id: 'state-areas',
    title: 'State Coverage Areas',
    description:
      'Assets are grouped by state in the hierarchy. Each state row lists its companies and the number of transformers. The map also shows coloured shaded regions — hover a region to see the state name and asset count.',
    target: '[data-tour="floor-hierarchy"]',
    position: 'right',
    icon: Globe,
    image: '/tour/state-areas.jpg',
    legend: [
      { color: '#ca8a04', fill: '#fef08a33', label: 'State with assets' },
      { color: '#6b7280', fill: '#f3f4f633', label: 'State — no assets yet' },
    ],
  },
  {
    id: 'company-boundary',
    title: 'Company Boundaries',
    description:
      'Purple dashed polygons mark a company\'s physical area on the map — e.g. "GS Paper & Packaging" in Kedah. Draw a new one via Map Tools → "Draw company". Click a boundary to select it and see its details.',
    target: '[data-tour="map-container"]',
    position: 'center',
    icon: Building2,
    image: '/tour/company-boundary.jpg',
    legend: [
      { color: '#7c3aed', fill: '#a855f714', label: 'Company boundary (dashed)' },
      { color: '#0ea5e9', fill: '#38bdf814', label: 'Selected company boundary' },
    ],
  },
  {
    id: 'floor-site-area',
    title: 'Floor / Site Areas',
    description:
      'Teal polygons inside a company boundary are individual site areas or plant floors — e.g. "Main Plant", "Substation A". Each floor groups the transformers assigned to it. One company can have many floors for finer organisation.',
    target: '[data-tour="map-container"]',
    position: 'center',
    icon: LayoutTemplate,
    image: '/tour/floor-site-area.jpg',
    legend: [
      { color: '#0f766e', fill: '#0f766e14', label: 'Floor / site area (dashed)' },
      { color: '#2563eb', fill: '#2563eb1a', label: 'Selected floor area' },
    ],
  },
  {
    id: 'map-click-asset',
    title: 'Click to Open Asset Snapshot',
    description:
      'Left-click any Company or Floor polygon on the map to open a popup. Press "Open floor" to launch the asset grid — cards showing every transformer in that area with DGA health, oil test date, location, and more.',
    target: '[data-tour="map-container"]',
    position: 'center',
    icon: MousePointer2,
    image: '/tour/map-click-asset.jpg',
    legend: [
      { color: '#16a34a', fill: '#16a34a1a', label: 'Healthy asset' },
      { color: '#eab308', fill: '#eab3081a', label: 'Asset needs attention' },
      { color: '#dc2626', fill: '#dc26261a', label: 'Critical — action required' },
    ],
  },
];

function getSpotlightRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  // If the element is mostly scrolled out of the viewport, skip the spotlight
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const visibleTop = Math.max(r.top, 0);
  const visibleLeft = Math.max(r.left, 0);
  const visibleBottom = Math.min(r.bottom, vpH);
  const visibleRight = Math.min(r.right, vpW);
  const visibleArea = Math.max(0, visibleRight - visibleLeft) * Math.max(0, visibleBottom - visibleTop);
  const totalArea = r.width * r.height;
  if (totalArea > 0 && visibleArea / totalArea < 0.5) return null;
  return {
    top: r.top - SPOTLIGHT_PAD,
    left: r.left - SPOTLIGHT_PAD,
    width: r.width + SPOTLIGHT_PAD * 2,
    height: r.height + SPOTLIGHT_PAD * 2,
  };
}

function computeCardStyle(spotRect, position) {
  if (!spotRect || position === 'center') {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const GAP = 14;

  let top, left;

  if (position === 'right') {
    top = spotRect.top + spotRect.height / 2 - CARD_H_EST / 2;
    left = spotRect.left + spotRect.width + GAP;
    if (left + CARD_WIDTH > vpW - 8) {
      top = spotRect.top + spotRect.height + GAP;
      left = Math.max(8, Math.min(vpW - CARD_WIDTH - 8, spotRect.left));
    }
  } else if (position === 'bottom') {
    top = spotRect.top + spotRect.height + GAP;
    left = spotRect.left + spotRect.width / 2 - CARD_WIDTH / 2;
  } else {
    top = spotRect.top + spotRect.height + GAP;
    left = spotRect.left;
  }

  top = Math.max(8, Math.min(vpH - CARD_H_EST - 8, top));
  left = Math.max(8, Math.min(vpW - CARD_WIDTH - 8, left));

  return { position: 'fixed', top, left };
}

export default function AppOnboardingTour({ open, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);
  // tick forces card position recalc after paint
  const [tick, setTick] = useState(0);

  const step = TOUR_STEPS[stepIndex];
  const StepIcon = step?.icon ?? null;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const total = TOUR_STEPS.length;

  const recalc = useCallback(() => {
    setSpotRect(getSpotlightRect(step?.target ?? null));
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    recalc();
  }, [open, stepIndex, recalc]);

  useEffect(() => {
    if (!open) return;
    // Retry after paint so newly mounted elements are measured
    const id = requestAnimationFrame(() => {
      recalc();
      setTick((n) => n + 1);
    });
    return () => cancelAnimationFrame(id);
  }, [open, stepIndex, recalc]);

  useEffect(() => {
    if (!open) return;
    const handler = () => { recalc(); setTick((n) => n + 1); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [open, recalc]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Reset to step 0 when tour opens
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  if (!open) return null;

  // Suppress lint — tick is read here only to force re-render for card position
  void tick;

  const cardStyle = computeCardStyle(spotRect, step?.position);

  return (
    <>
      {/* Backdrop — blocks interaction with the page; intentionally does NOT close on click */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 10000 }}
      />

      {/* Spotlight box-shadow "cutout" — transparent center shows the element */}
      {spotRect ? (
        <div
          style={{
            position: 'fixed',
            zIndex: 10001,
            pointerEvents: 'none',
            top: spotRect.top,
            left: spotRect.left,
            width: spotRect.width,
            height: spotRect.height,
            borderRadius: 10,
            boxShadow:
              '0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 2.5px rgba(16,185,129,0.9), 0 0 22px 6px rgba(16,185,129,0.2)',
          }}
        />
      ) : (
        /* No target element — plain dark full-screen overlay */
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            background: 'rgba(0,0,0,0.72)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Pulsing beacon dot at the top-right corner of the spotlight */}
      {spotRect && (
        <div
          style={{
            position: 'fixed',
            zIndex: 10002,
            pointerEvents: 'none',
            top: spotRect.top - 5,
            left: spotRect.left + spotRect.width - 5,
          }}
        >
          <span className="relative flex h-4 w-4">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ background: 'var(--primary)' }}
            />
            <span
              className="relative inline-flex h-4 w-4 rounded-full"
              style={{ background: 'var(--primary)' }}
            />
          </span>
        </div>
      )}

      {/* Tour card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`tour-card-${stepIndex}`}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-label={`Tour step ${stepIndex + 1} of ${total}: ${step?.title}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            ...cardStyle,
            zIndex: 10003,
            width: CARD_WIDTH,
          }}
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[var(--card-elevated)] shadow-2xl"
        >
          {/* Accent bar */}
          <div
            style={{
              height: 3,
              background: 'linear-gradient(to right, var(--primary), var(--primary-strong, var(--primary)))',
            }}
          />

          {/* Step label + close */}
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <div className="flex items-center gap-1.5">
              {StepIcon && (
                <div className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                  <StepIcon className="h-3.5 w-3.5" />
                </div>
              )}
              <span
                className="font-semibold uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  color: 'var(--primary)',
                }}
              >
                Step {stepIndex + 1} / {total}
              </span>
            </div>
            <button
              type="button"
              aria-label="Close tour"
              onClick={onClose}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--card-muted)]"
              style={{ color: 'var(--muted)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 pb-3 pt-2">
            <h3 className="mb-1.5 text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
              {step?.title}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {step?.description}
            </p>
            {/* Example screenshot — shown for map overlay steps */}
            {step?.image && (
              <div
                role="button"
                tabIndex={0}
                aria-label="Click to enlarge image"
                className="mt-2.5 overflow-hidden rounded-lg cursor-zoom-in flex items-center justify-center"
                style={{ border: '1px solid var(--border)' }}
                onClick={() => setZoomedImage(step.image)}
                onKeyDown={(e) => e.key === 'Enter' && setZoomedImage(step.image)}
              >
                <img
                  src={step.image}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="w-full object-cover object-center"
                  style={{ maxHeight: 130, display: 'block' }}
                />
              </div>
            )}
            {/* Colour legend — shown for map overlay steps */}
            {step?.legend?.length ? (
              <div className="mt-2.5 space-y-1.5">
                {step.legend.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      style={{
                        display: 'inline-block',
                        width: 28,
                        height: 14,
                        borderRadius: 4,
                        border: `2px solid ${item.color}`,
                        background: item.fill,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.3 }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1 pb-3">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setStepIndex(i)}
                style={{
                  height: 5,
                  width: i === stepIndex ? 18 : 6,
                  borderRadius: 999,
                  background: i === stepIndex ? 'var(--primary)' : 'var(--border)',
                  transition: 'all 0.2s ease',
                  padding: 0,
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Footer nav */}
          <div
            className="flex items-center justify-between px-3 py-2.5"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              type="button"
              className="text-xs transition-colors hover:text-[var(--foreground)]"
              style={{ color: 'var(--muted)' }}
              onClick={onClose}
            >
              Skip tour
            </button>
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  aria-label="Previous step"
                  onClick={() => setStepIndex((i) => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                className="h-8 min-w-[64px]"
                onClick={() => {
                  if (isLast) onClose();
                  else setStepIndex((i) => i + 1);
                }}
              >
                {isLast ? (
                  'Done'
                ) : (
                  <>
                    Next <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Image zoom lightbox */}
      {zoomedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged image"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10010,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
          onClick={() => setZoomedImage(null)}
          onKeyDown={(e) => e.key === 'Escape' && setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt=""
            draggable={false}
            style={{
              maxWidth: '88vw',
              maxHeight: '82vh',
              borderRadius: 12,
              boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
              display: 'block',
            }}
          />
        </div>
      )}
    </>
  );
}
