// RainViewer radar helpers for the 3D globe's "Rain radar" layer and its
// right-rail settings tab. Pure functions only, so they can be unit tested.
//
// RainViewer's public API lists ~2 hours of past frames, 10 minutes apart.
// The free tier serves one colour scheme only (every scheme id returns the
// same tile) and tiles up to zoom 7, so the settings here are limited to what
// actually changes the picture: frame, opacity and smoothing.

export const RAIN_RADAR_MAX_LEVEL = 7;
export const RAIN_RADAR_REFRESH_MS = 5 * 60 * 1000;

export const RAIN_RADAR_SPEEDS = [
  { id: 1200, label: 'Slow' },
  { id: 700, label: 'Normal' },
  { id: 350, label: 'Fast' },
];

export const DEFAULT_RAIN_RADAR_SETTINGS = {
  opacity: 0.65,
  smooth: true,
  speedMs: 700,
  autoRefresh: true,
};

/** Merge stored settings over the defaults, dropping anything out of range. */
export function normalizeRainRadarSettings(stored) {
  const value = stored && typeof stored === 'object' ? stored : {};
  const opacity = Number(value.opacity);
  const speedMs = Number(value.speedMs);
  return {
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.1, opacity)) : DEFAULT_RAIN_RADAR_SETTINGS.opacity,
    smooth: typeof value.smooth === 'boolean' ? value.smooth : DEFAULT_RAIN_RADAR_SETTINGS.smooth,
    speedMs: RAIN_RADAR_SPEEDS.some((speed) => speed.id === speedMs) ? speedMs : DEFAULT_RAIN_RADAR_SETTINGS.speedMs,
    autoRefresh: typeof value.autoRefresh === 'boolean' ? value.autoRefresh : DEFAULT_RAIN_RADAR_SETTINGS.autoRefresh,
  };
}

/** weather-maps.json -> { host, frames: [{ time (ms), path, nowcast }] }, oldest first. */
export function parseRainRadarFrames(data) {
  const host = typeof data?.host === 'string' ? data.host : '';
  const toFrames = (list, nowcast) =>
    (Array.isArray(list) ? list : [])
      .filter((frame) => frame && typeof frame.path === 'string' && Number.isFinite(frame.time))
      .map((frame) => ({ time: frame.time * 1000, path: frame.path, nowcast }));
  const frames = [...toFrames(data?.radar?.past, false), ...toFrames(data?.radar?.nowcast, true)].sort(
    (a, b) => a.time - b.time
  );
  return { host, frames };
}

/** Index of the newest observed (non-forecast) frame, or the last frame. */
export function latestRainRadarIndex(frames) {
  if (!Array.isArray(frames) || !frames.length) {
    return -1;
  }
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (!frames[index].nowcast) {
      return index;
    }
  }
  return frames.length - 1;
}

/** Frame index to show: null means "live" (latest observed frame). */
export function resolveRainRadarIndex(frames, frameIndex) {
  if (!Array.isArray(frames) || !frames.length) {
    return -1;
  }
  if (frameIndex === null || frameIndex === undefined || !Number.isFinite(Number(frameIndex))) {
    return latestRainRadarIndex(frames);
  }
  return Math.min(frames.length - 1, Math.max(0, Math.trunc(Number(frameIndex))));
}

/** XYZ tile template for one frame. Colour scheme 2 (Universal Blue), snow shown. */
export function rainRadarTileUrl(host, path, { smooth = true } = {}) {
  return `${host}${path}/256/{z}/{x}/{y}/2/${smooth ? 1 : 0}_1.png`;
}

export function formatRainRadarTime(ms) {
  if (!Number.isFinite(ms)) {
    return '';
  }
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** "now", "20 min ago", "1 h 10 min ago" relative to `now`. */
export function formatRainRadarAge(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) {
    return '';
  }
  const minutes = Math.round((now - ms) / 60000);
  if (minutes <= 0) {
    return minutes < 0 ? `in ${-minutes} min` : 'now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min ago` : `${hours} h ago`;
}
