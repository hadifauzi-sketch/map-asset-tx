import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_RAIN_RADAR_SETTINGS,
  formatRainRadarAge,
  latestRainRadarIndex,
  normalizeRainRadarSettings,
  parseRainRadarFrames,
  rainRadarTileUrl,
  resolveRainRadarIndex,
} from '../lib/globe3d/rainRadar.js';

const sample = {
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1000, path: '/v2/radar/a' },
      { time: 1600, path: '/v2/radar/b' },
      { time: 2200, path: '/v2/radar/c' },
      { time: 'bad', path: '/v2/radar/x' },
    ],
    nowcast: [{ time: 2800, path: '/v2/radar/n' }],
  },
};

test('parseRainRadarFrames keeps valid frames oldest first and flags forecasts', () => {
  const { host, frames } = parseRainRadarFrames(sample);
  assert.equal(host, 'https://tilecache.rainviewer.com');
  assert.deepEqual(
    frames.map((frame) => [frame.time, frame.path, frame.nowcast]),
    [
      [1000000, '/v2/radar/a', false],
      [1600000, '/v2/radar/b', false],
      [2200000, '/v2/radar/c', false],
      [2800000, '/v2/radar/n', true],
    ]
  );
  assert.deepEqual(parseRainRadarFrames(null), { host: '', frames: [] });
});

test('live frame is the newest observed frame, not a forecast', () => {
  const { frames } = parseRainRadarFrames(sample);
  assert.equal(latestRainRadarIndex(frames), 2);
  assert.equal(resolveRainRadarIndex(frames, null), 2);
  assert.equal(resolveRainRadarIndex(frames, 0), 0);
  assert.equal(resolveRainRadarIndex(frames, 99), 3);
  assert.equal(resolveRainRadarIndex(frames, -4), 0);
  assert.equal(resolveRainRadarIndex([], null), -1);
});

test('tile URL switches smoothing only', () => {
  assert.equal(
    rainRadarTileUrl('https://h', '/v2/radar/a', { smooth: true }),
    'https://h/v2/radar/a/256/{z}/{x}/{y}/2/1_1.png'
  );
  assert.equal(
    rainRadarTileUrl('https://h', '/v2/radar/a', { smooth: false }),
    'https://h/v2/radar/a/256/{z}/{x}/{y}/2/0_1.png'
  );
});

test('settings fall back to defaults and clamp opacity', () => {
  assert.deepEqual(normalizeRainRadarSettings(undefined), DEFAULT_RAIN_RADAR_SETTINGS);
  assert.deepEqual(normalizeRainRadarSettings({ opacity: 5, smooth: false, speedMs: 123, autoRefresh: 'yes' }), {
    ...DEFAULT_RAIN_RADAR_SETTINGS,
    opacity: 1,
    smooth: false,
  });
  assert.equal(normalizeRainRadarSettings({ opacity: 0 }).opacity, 0.1);
  assert.equal(normalizeRainRadarSettings({ speedMs: 350 }).speedMs, 350);
});

test('age label reads naturally', () => {
  const now = 10 * 3600 * 1000;
  assert.equal(formatRainRadarAge(now, now), 'now');
  assert.equal(formatRainRadarAge(now - 20 * 60000, now), '20 min ago');
  assert.equal(formatRainRadarAge(now - 70 * 60000, now), '1 h 10 min ago');
  assert.equal(formatRainRadarAge(now - 120 * 60000, now), '2 h ago');
  assert.equal(formatRainRadarAge(now + 10 * 60000, now), 'in 10 min');
});
