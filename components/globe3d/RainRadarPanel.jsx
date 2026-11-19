import React from 'react';
import { Pause, PanelRightClose, Play, Radio, RefreshCw, SkipBack, SkipForward } from 'lucide-react';
import {
  RAIN_RADAR_SPEEDS,
  formatRainRadarAge,
  formatRainRadarTime,
  latestRainRadarIndex,
  resolveRainRadarIndex,
} from '../../lib/globe3d/rainRadar';
import { cn } from '../../lib/utils';

// RainViewer "Universal Blue" scale, light rain to extreme (approximate dBZ bands).
const RADAR_SCALE = [
  { label: 'Light', color: '#88ddee' },
  { label: 'Moderate', color: '#0077aa' },
  { label: 'Heavy', color: '#ffee00' },
  { label: 'Very heavy', color: '#ff4400' },
  { label: 'Extreme', color: '#ffaaff' },
];

/**
 * Right-rail tab for the Rain radar layer: time scrubber with playback, plus
 * opacity / smoothing / speed / auto-refresh. Frame state lives in the parent
 * (Globe3DView) so playback keeps running while the tab is collapsed.
 */
export default function RainRadarPanel({
  enabled,
  status,
  frameIndex,
  playing,
  settings,
  onEnable,
  onFrameChange,
  onPlayingChange,
  onSettingsChange,
  onRefresh,
  onClose,
}) {
  const frames = status?.frames || [];
  const hasFrames = enabled && frames.length > 0;
  const index = resolveRainRadarIndex(frames, frameIndex);
  const latestIndex = latestRainRadarIndex(frames);
  const frame = hasFrames ? frames[index] : null;
  const isLive = frameIndex === null || frameIndex === undefined;
  const step = (delta) => {
    onPlayingChange(false);
    onFrameChange((index + delta + frames.length) % frames.length);
  };

  let countLabel = 'Layer off';
  if (enabled) {
    countLabel = status?.state === 'loading' ? 'Loading…' : status?.state === 'error' ? 'Error' : `${frames.length} frames`;
  }

  return (
    <div className="g3d-panel g3d-radar-panel">
      <div className="g3d-panel-header">
        <span>Rain radar</span>
        <span className="g3d-panel-count">{countLabel}</span>
        <button type="button" className="g3d-panel-close" onClick={onClose} aria-label="Collapse panel">
          <PanelRightClose aria-hidden="true" />
        </button>
      </div>

      <div className="g3d-plant-panel-body g3d-radar-body">
        {!enabled ? (
          <div className="g3d-plant-off">
            <p>The rain radar layer is off, so nothing is drawn on the globe.</p>
            <button type="button" onClick={onEnable}>
              Show rain radar
            </button>
          </div>
        ) : null}
        {enabled && status?.state === 'error' ? (
          <div className="g3d-plant-off g3d-radar-error" role="alert">
            <p>Radar failed to load: {status.text}</p>
            <button type="button" onClick={onRefresh}>
              Try again
            </button>
          </div>
        ) : null}

        {/* ── Time ─────────────────────────────────────────────── */}
        <section className="g3d-radar-section" aria-label="Radar time">
          <div className="g3d-radar-now">
            <strong>{frame ? formatRainRadarTime(frame.time) : '--:--'}</strong>
            <span>{frame ? formatRainRadarAge(frame.time) : enabled ? 'Waiting for frames' : 'No frame'}</span>
            {frame ? (
              <span
                className={cn(
                  'g3d-radar-badge',
                  frame.nowcast ? 'is-forecast' : isLive || index === latestIndex ? 'is-live' : 'is-past'
                )}
              >
                {frame.nowcast ? 'Forecast' : isLive || index === latestIndex ? 'Live' : 'Past'}
              </span>
            ) : null}
          </div>

          <input
            type="range"
            className="g3d-radar-range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            step={1}
            value={Math.max(0, index)}
            disabled={!hasFrames}
            aria-label="Radar frame time"
            aria-valuetext={frame ? `${formatRainRadarTime(frame.time)}, ${formatRainRadarAge(frame.time)}` : 'No frame'}
            onChange={(event) => {
              onPlayingChange(false);
              const next = Number(event.target.value);
              onFrameChange(next === latestIndex ? null : next);
            }}
          />
          <div className="g3d-radar-range-labels" aria-hidden="true">
            <span>{hasFrames ? formatRainRadarTime(frames[0].time) : ''}</span>
            <span>{hasFrames ? formatRainRadarTime(frames[frames.length - 1].time) : ''}</span>
          </div>

          <div className="g3d-radar-transport">
            <button type="button" onClick={() => step(-1)} disabled={!hasFrames} aria-label="Previous frame" title="Previous frame">
              <SkipBack aria-hidden="true" />
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => onPlayingChange(!playing)}
              disabled={!hasFrames || frames.length < 2}
              aria-pressed={playing}
              aria-label={playing ? 'Pause animation' : 'Play animation'}
              title={playing ? 'Pause' : 'Play the past 2 hours'}
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => step(1)} disabled={!hasFrames} aria-label="Next frame" title="Next frame">
              <SkipForward aria-hidden="true" />
            </button>
            <button
              type="button"
              className={cn('g3d-radar-live', isLive && !playing && 'is-active')}
              onClick={() => {
                onPlayingChange(false);
                onFrameChange(null);
              }}
              disabled={!hasFrames}
              aria-pressed={isLive && !playing}
              title="Jump to the latest frame"
            >
              <Radio aria-hidden="true" />
              Live
            </button>
          </div>

          <div className="g3d-radar-row">
            <span>Speed</span>
            <div className="g3d-segmented" role="group" aria-label="Playback speed">
              {RAIN_RADAR_SPEEDS.map((speed) => (
                <button
                  key={speed.id}
                  type="button"
                  className={cn(settings.speedMs === speed.id && 'is-active')}
                  aria-pressed={settings.speedMs === speed.id}
                  onClick={() => onSettingsChange({ speedMs: speed.id })}
                >
                  {speed.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Display ──────────────────────────────────────────── */}
        <section className="g3d-radar-section" aria-label="Radar display">
          <label className="g3d-radar-row">
            <span>Opacity</span>
            <input
              type="range"
              className="g3d-radar-range"
              min={0.1}
              max={1}
              step={0.05}
              value={settings.opacity}
              onChange={(event) => onSettingsChange({ opacity: Number(event.target.value) })}
            />
            <output>{Math.round(settings.opacity * 100)}%</output>
          </label>
          <label className="g3d-radar-check">
            <input type="checkbox" checked={settings.smooth} onChange={(event) => onSettingsChange({ smooth: event.target.checked })} />
            <span>
              Smooth edges
              <small>Off shows the raw radar pixels</small>
            </span>
          </label>
          <div className="g3d-radar-check-row">
            <label className="g3d-radar-check">
              <input
                type="checkbox"
                checked={settings.autoRefresh}
              onChange={(event) => onSettingsChange({ autoRefresh: event.target.checked })}
            />
            <span>
              Auto-refresh every 5 min
              <small>{status?.fetchedAt ? `Updated ${formatRainRadarTime(status.fetchedAt)}` : 'Not loaded yet'}</small>
              </span>
            </label>
            <button
              type="button"
              className="g3d-radar-refresh"
              onClick={onRefresh}
              disabled={!enabled}
              aria-label="Refresh radar now"
              title="Refresh now"
            >
              <RefreshCw aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* ── Legend ───────────────────────────────────────────── */}
        <section className="g3d-radar-section" aria-label="Rain intensity legend">
          <div className="g3d-radar-scale" aria-hidden="true">
            {RADAR_SCALE.map((band) => (
              <span key={band.label} style={{ background: band.color }} />
            ))}
          </div>
          <div className="g3d-radar-scale-labels">
            <span>Light</span>
            <span>Heavy</span>
            <span>Extreme</span>
          </div>
          <p className="g3d-radar-note">
            RainViewer free tier: 10-minute frames over the past ~2 hours, one colour scheme, detail to ~1 km.
          </p>
        </section>
      </div>
    </div>
  );
}
