// Persistent settings for the 3D globe view.
// Everything lives in localStorage on this browser only — API keys are never
// sent to Supabase or any server other than the provider they belong to.

import { DEFAULT_LAYER_STATE } from './layerRegistry';
import { DEFAULT_RAIN_RADAR_SETTINGS, normalizeRainRadarSettings } from './rainRadar';

const STORAGE_KEY = 'transformer-asset-map-globe3d-v1';

export const BUILT_IN_API_KEYS = [
  {
    id: 'cesiumIon',
    label: 'Cesium ion access token',
    shortLabel: 'Cesium ion token',
    envVar: 'VITE_CESIUM_ION_TOKEN',
    helpUrl: 'https://ion.cesium.com/tokens',
    unlocks: '3D buildings, world terrain, Bing aerial imagery',
  },
  {
    id: 'googleMaps',
    label: 'Google Maps Platform key',
    shortLabel: 'Google Maps key',
    envVar: 'VITE_GOOGLE_MAPS_API_KEY',
    helpUrl: 'https://developers.google.com/maps/documentation/tile/get-api-key',
    unlocks: 'Google Photorealistic 3D Tiles (enable the Map Tiles API)',
  },
];

const ENV_DEFAULTS = {
  cesiumIon: import.meta.env?.VITE_CESIUM_ION_TOKEN || '',
  googleMaps: import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '',
};

export const DEFAULT_SETTINGS = {
  apiKeys: { cesiumIon: '', googleMaps: '' },
  // Extra named keys for layers added later, e.g. { name: 'TOMTOM', value: '…' }.
  customKeys: [],
  layers: DEFAULT_LAYER_STATE,
  mapSource: 'esriSatellite',
  visualPreset: 'normal',
  // Night look: 'lights' | 'lightsCity' | 'pollution' | 'pollutionCity' (lib/globe3d/nightModes.js).
  nightMode: 'lights',
  buildingStyle: 'teal',
  // Rain radar tab: opacity, smoothing, playback speed, auto-refresh.
  rainRadar: DEFAULT_RAIN_RADAR_SETTINGS,
};

export function loadSettings() {
  let stored = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    stored = {};
  }

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...(stored.apiKeys || {}) },
    customKeys: Array.isArray(stored.customKeys) ? stored.customKeys : [],
    layers: { ...DEFAULT_LAYER_STATE, ...(stored.layers || {}) },
    rainRadar: normalizeRainRadarSettings(stored.rainRadar),
  };
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save 3D view settings:', error);
  }
}

/** Key typed in the app wins; otherwise fall back to the .env default. */
export function resolveApiKey(settings, id) {
  const typed = String(settings?.apiKeys?.[id] || '').trim();
  if (typed) {
    return typed;
  }
  if (ENV_DEFAULTS[id]) {
    return ENV_DEFAULTS[id];
  }
  const custom = (settings?.customKeys || []).find(
    (entry) => String(entry?.name || '').trim().toLowerCase() === String(id).toLowerCase()
  );
  return String(custom?.value || '').trim();
}

export function isEnvProvided(id) {
  return Boolean(ENV_DEFAULTS[id]);
}
