import { useSyncExternalStore } from 'react';
import { FUEL_LEGEND } from './powerPlants.js';

// Power plant fuel types switched off in the legend. One setting shared by the
// 2D map legend and the 3D globe's power plant tab, saved per browser.

const STORAGE_KEY = 'tx-asset.powerPlants.hiddenFuels';
const FUEL_IDS = FUEL_LEGEND.map((entry) => entry.id);
const listeners = new Set();

/** Known legend ids only, in legend order, no duplicates. */
function sanitize(ids) {
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  return FUEL_IDS.filter((id) => wanted.has(id));
}

function read() {
  try {
    return sanitize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

let current = typeof window === 'undefined' ? [] : read();

export function getHiddenFuels() {
  return current;
}

export function setHiddenFuels(ids) {
  const next = sanitize(ids);
  if (next.length === current.length && next.every((id, index) => id === current[index])) {
    return;
  }
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage blocked (private mode etc.): the filter still works for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeHiddenFuels(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Keep other open tabs in step.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    current = read();
    listeners.forEach((listener) => listener());
  });
}

/** [hiddenFuels, setHiddenFuels] — the same list in every view. */
export function useHiddenFuels() {
  const hiddenFuels = useSyncExternalStore(subscribeHiddenFuels, getHiddenFuels, getHiddenFuels);
  return [hiddenFuels, setHiddenFuels];
}
