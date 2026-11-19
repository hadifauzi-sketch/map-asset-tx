import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  CloudRain,
  Globe2,
  KeyRound,
  Layers,
  List,
  Map as MapIcon,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Sun,
  Factory,
  FlaskConical,
  Server,
  X,
} from 'lucide-react';
import { STATUS_META, STATUS_ORDER, hasValidPosition } from '../../lib/globe3d/assetSummary';
import { getMapSource } from '../../lib/globe3d/mapSources';
import { loadSettings, resolveApiKey, saveSettings } from '../../lib/globe3d/settingsStore';
import { getVisualPreset } from '../../lib/globe3d/visualPresets';
import { getNightMode } from '../../lib/globe3d/nightModes';
import { DEFAULT_RAIN_RADAR_SETTINGS, resolveRainRadarIndex } from '../../lib/globe3d/rainRadar';
import { cn } from '../../lib/utils';
import PowerPlantLegend from '../PowerPlantLegend';
import { useHiddenFuels } from '../../lib/hiddenFuelsStore';
import DataCentreTrackerPanel from '../DataCentreTrackerPanel';
import DataCentreInfoCard, { DataCentreHoverCard } from '../DataCentreInfoCard';
import { describeDataCentre } from '../../lib/dataCentres';
import ApiKeysDialog from './ApiKeysDialog';
import BottomDock from './BottomDock';
import CesiumScene from './CesiumScene';
import DataLayersPanel from './DataLayersPanel';
import RainRadarPanel from './RainRadarPanel';
import ResultPanel from './ResultPanel';
import TxListPanel from './TxListPanel';
import './globe3d.css';

function formatAltitude(meters) {
  if (!Number.isFinite(meters)) {
    return '—';
  }
  return meters >= 10000 ? `${(meters / 1000).toFixed(0)} km` : `${Math.round(meters).toLocaleString()} m`;
}

function formatCoordinate(value, positive, negative) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return `${Math.abs(value).toFixed(5)}° ${value >= 0 ? positive : negative}`;
}

/**
 * Camera + cursor readout. Holds its own state and is updated imperatively so
 * camera movement never re-renders the panels.
 */
const HudReadout = forwardRef(function HudReadout(_props, ref) {
  const [camera, setCamera] = useState(null);
  const [cursor, setCursor] = useState(null);
  useImperativeHandle(ref, () => ({ setCamera, setCursor }), []);

  return (
    <>
      <div className="g3d-hud g3d-hud-left" aria-hidden="true">
        <span>
          CURSOR{' '}
          {cursor
            ? `${formatCoordinate(cursor.latitude, 'N', 'S')}  ${formatCoordinate(cursor.longitude, 'E', 'W')}`
            : '—'}
        </span>
      </div>
      <div className="g3d-hud g3d-hud-right" aria-hidden="true">
        <span>ALT {formatAltitude(camera?.height)}</span>
        <span>HDG {camera ? `${Math.round(camera.heading + 360) % 360}°` : '—'}</span>
        <span>TILT {camera ? `${Math.round(90 + camera.pitch)}°` : '—'}</span>
      </div>
    </>
  );
});

const HoverTip = forwardRef(function HoverTip({ transformers, statusById }, ref) {
  const [hover, setHover] = useState(null);
  useImperativeHandle(ref, () => ({ setHover }), []);

  if (hover?.dataCentre) {
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.max(12, Math.min(hover.x + 16, window.innerWidth - width - 12));
    const top = Math.max(12, Math.min(hover.y + 16, window.innerHeight - 220));
    return <div className="g3d-dc-hover" role="tooltip" style={{ left, top, width }}><DataCentreHoverCard facility={hover.dataCentre} /></div>;
  }

  const transformer = hover
    ? transformers.find((item) => String(item.id) === String(hover.txId))
    : null;
  if (!hover || !transformer) {
    return null;
  }
  const status = statusById.get(transformer.id) || 'normal';

  return (
    <div className="g3d-hover-tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
      <strong>{transformer.txName || 'Unnamed transformer'}</strong>
      <span>{transformer.siteName || 'Unknown site'}</span>
      <span className="g3d-hover-status">
        <i style={{ background: STATUS_META[status].color }} />
        {STATUS_META[status].label}
      </span>
    </div>
  );
});

/**
 * Full-screen 3D globe view of the transformer fleet.
 *
 * Receives the same (already filtered) transformers the 2D map shows, so
 * owner filters and access rules stay in App.jsx.
 */
export default function Globe3DView({
  dataCentreTracker,
  transformers = [],
  statusById,
  companyBoundaries = [],
  floorPlans = [],
  // Full lists used to group the Tx list (company → area), independent of
  // whether the boundary / floor-plan overlays are drawn on the globe.
  hierarchyCompanyBoundaries = companyBoundaries,
  hierarchyFloorPlans = floorPlans,
  theme = 'dark',
  onToggleTheme,
  onClose,
  onViewDetails,
}) {
  const sceneRef = useRef(null);
  const hudRef = useRef(null);
  const hoverRef = useRef(null);

  const [settings, setSettings] = useState(() => loadSettings());
  const [selectedId, setSelectedId] = useState(null);
  const [leftTab, setLeftTab] = useState('assets');
  const isWide = typeof window === 'undefined' || window.innerWidth >= 1100;
  const [leftOpen, setLeftOpen] = useState(isWide);
  const [rightOpen, setRightOpen] = useState(isWide);
  // Right panel tab when the data centre tracker isn't showing: 'result' | 'plants' | 'radar'.
  const [rightTab, setRightTab] = useState('result');
  // Rain radar playback: frame index (null = live) and play state. Kept here,
  // not in the tab, so the animation keeps running while the tab is collapsed.
  const [radarFrameIndex, setRadarFrameIndex] = useState(null);
  const [radarPlaying, setRadarPlaying] = useState(false);
  const [radarRefreshToken, setRadarRefreshToken] = useState(0);
  // Fuel filter shared with the 2D map legend.
  const [hiddenFuels, setHiddenFuels] = useHiddenFuels();
  const [keysOpen, setKeysOpen] = useState(false);
  const [layerStatus, setLayerStatus] = useState({});
  const [featureInfo, setFeatureInfo] = useState(null);
  const showDataCentrePanel = Boolean(dataCentreTracker?.settings.panelOpen);

  useEffect(() => {
    setFeatureInfo((current) => current?.dataCentre ? null : current);
    hoverRef.current?.setHover(null);
  }, [dataCentreTracker?.facilities]);

  useEffect(() => {
    if (showDataCentrePanel) {
      setRightOpen(true);
      if (window.innerWidth < 900) setLeftOpen(false);
    }
  }, [showDataCentrePanel]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Narrow screens only have room for one side panel at a time.
  const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 900;
  const openLeft = (open) => {
    setLeftOpen(open);
    if (open && isNarrow()) {
      setRightOpen(false);
    }
  };
  const openRight = (open) => {
    setRightOpen(open);
    if (open && isNarrow()) {
      setLeftOpen(false);
    }
  };
  // Opens the tracker panel only; layer visibility stays the user's own switch.
  const openDataCentres = () => {
    dataCentreTracker?.setSettings((current) => ({ ...current, panelOpen: true }));
    openRight(true);
  };
  // DGA result / power plant tabs: a second click on the active tab collapses the panel.
  const toggleRightTab = (tab) => {
    const isActive = rightOpen && !showDataCentrePanel && rightTab === tab;
    dataCentreTracker?.setSettings((current) => current.panelOpen ? { ...current, panelOpen: false } : current);
    setRightTab(tab);
    openRight(!isActive);
  };
  const showPlantsPanel = rightOpen && !showDataCentrePanel && rightTab === 'plants';
  const showResultPanel = rightOpen && !showDataCentrePanel && rightTab === 'result';
  const showRadarPanel = rightOpen && !showDataCentrePanel && rightTab === 'radar';

  // ── Rain radar ──────────────────────────────────────────────────────────
  const radarOn = Boolean(settings.layers?.rainRadar);
  const radarSettings = settings.rainRadar || DEFAULT_RAIN_RADAR_SETTINGS;
  const radarFrames = layerStatus.rainRadar?.frames;
  const rainRadarOptions = useMemo(
    () => ({ ...radarSettings, frameIndex: radarFrameIndex, refreshToken: radarRefreshToken }),
    [radarSettings, radarFrameIndex, radarRefreshToken]
  );
  const patchRadarSettings = (patch) =>
    setSettings((current) => ({
      ...current,
      rainRadar: { ...(current.rainRadar || DEFAULT_RAIN_RADAR_SETTINGS), ...patch },
    }));

  // Switching the layer off stops playback and returns to live.
  useEffect(() => {
    if (!radarOn) {
      setRadarPlaying(false);
      setRadarFrameIndex(null);
    }
  }, [radarOn]);

  // Looped playback through the frame list.
  useEffect(() => {
    if (!radarPlaying || !radarOn || !radarFrames || radarFrames.length < 2) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setRadarFrameIndex((current) => (resolveRainRadarIndex(radarFrames, current) + 1) % radarFrames.length);
    }, radarSettings.speedMs);
    return () => window.clearInterval(timer);
  }, [radarPlaying, radarOn, radarFrames, radarSettings.speedMs]);

  const safeStatusById = useMemo(() => statusById || new Map(), [statusById]);
  const selectedTransformer = useMemo(
    () => transformers.find((transformer) => String(transformer.id) === String(selectedId)) || null,
    [transformers, selectedId]
  );

  const ionToken = resolveApiKey(settings, 'cesiumIon');
  const googleKey = resolveApiKey(settings, 'googleMaps');
  const availableKeys = useMemo(
    () => ({ cesiumIon: Boolean(ionToken), googleMaps: Boolean(googleKey) }),
    [ionToken, googleKey]
  );

  const statusCounts = useMemo(() => {
    const counts = { critical: 0, warning: 0, normal: 0 };
    transformers.forEach((transformer) => {
      counts[safeStatusById.get(transformer.id) || 'normal'] += 1;
    });
    return counts;
  }, [transformers, safeStatusById]);

  const patchSettings = useCallback((patch) => setSettings((current) => ({ ...current, ...patch })), []);

  const selectAsset = useCallback(
    (transformerId) => {
      setSelectedId(transformerId);
      setFeatureInfo(null);
      if (transformerId === null) {
        return;
      }
      setRightTab('result');
      setRightOpen(true);
      dataCentreTracker?.setSettings((current) => current.panelOpen ? { ...current, panelOpen: false } : current);
      if (typeof window !== 'undefined' && window.innerWidth < 900) {
        setLeftOpen(false);
      }
      const transformer = transformers.find((item) => String(item.id) === String(transformerId));
      if (transformer && hasValidPosition(transformer)) {
        sceneRef.current?.flyToAsset(transformer);
      }
    },
    [transformers, dataCentreTracker?.setSettings]
  );

  const handleLayerStatus = useCallback((id, status) => {
    setLayerStatus((current) => {
      if (!status && !current[id]) {
        return current;
      }
      const next = { ...current };
      if (status) {
        next[id] = status;
      } else {
        delete next[id];
      }
      return next;
    });
  }, []);

  const handleCameraCommand = useCallback((command) => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    if (command === 'home') scene.resetView();
    if (command === 'north') scene.northUp();
    if (command === 'tilt') scene.toggleTilt();
    if (command === 'zoomIn') scene.zoom(1);
    if (command === 'zoomOut') scene.zoom(-1);
  }, []);

  // Escape closes the feature card first, then the selection.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || keysOpen || event.defaultPrevented) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) {
        return;
      }
      if (featureInfo) {
        setFeatureInfo(null);
      } else if (selectedId !== null) {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [featureInfo, selectedId, keysOpen]);

  const activeSource = getMapSource(settings.mapSource);
  const activePreset = getVisualPreset(settings.visualPreset);
  const nightMode = getNightMode(settings.nightMode);
  const activePresetLabel = activePreset.night ? nightMode.label : activePreset.label;
  const sourceError = layerStatus.mapSource?.state === 'error' ? layerStatus.mapSource.text : '';

  return (
    <div
      className={cn(
        'g3d',
        theme === 'dark' ? 'g3d--dark' : 'g3d--light',
        leftOpen && 'g3d--left-open',
        rightOpen && 'g3d--right-open'
      )}
      role="region"
      aria-label="3D globe view"
    >
      <CesiumScene
        dataCentreTracker={dataCentreTracker}
        ref={sceneRef}
        transformers={transformers}
        statusById={safeStatusById}
        selectedTransformer={selectedTransformer}
        companyBoundaries={companyBoundaries}
        floorPlans={floorPlans}
        layers={settings.layers}
        hiddenFuels={hiddenFuels}
        rainRadarOptions={rainRadarOptions}
        mapSource={settings.mapSource}
        visualPreset={settings.visualPreset}
        nightMode={nightMode.id}
        buildingStyle={settings.buildingStyle}
        ionToken={ionToken}
        googleKey={googleKey}
        onSelect={selectAsset}
        onHover={(hover) => hoverRef.current?.setHover(hover)}
        onFeaturePick={setFeatureInfo}
        onCamera={(camera) => hudRef.current?.setCamera(camera)}
        onCursor={(cursor) => hudRef.current?.setCursor(cursor)}
        onLayerStatus={handleLayerStatus}
      />

      <div className="g3d-vignette" aria-hidden="true" />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="g3d-topbar">
        <div className="g3d-brand">
          <span className="g3d-brand-mark">
            <Globe2 aria-hidden="true" />
          </span>
          <span>
            <span className="g3d-brand-title">
              TX ASSET <em>3D VIEW</em>
            </span>
            <span className="g3d-brand-sub">Transformer fleet · oil condition</span>
          </span>
        </div>

        <div className="g3d-status-strip" aria-label="Fleet DGA status">
          {STATUS_ORDER.map((status) => (
            <span key={status} className="g3d-status-pill">
              <i style={{ background: STATUS_META[status].color }} />
              {statusCounts[status]}
              <small>{STATUS_META[status].label}</small>
            </span>
          ))}
        </div>

        <div className="g3d-top-actions">
          <span className="g3d-style-readout" aria-hidden="true">
            <small>Active style</small>
            {activePresetLabel} · {activeSource.label}
          </span>
          <button type="button" className="g3d-icon-button" onClick={() => setKeysOpen(true)} aria-label="API keys" title="API keys">
            <KeyRound aria-hidden="true" />
          </button>
          <button
            type="button"
            className="g3d-icon-button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button type="button" className="g3d-exit-button" onClick={onClose}>
            <MapIcon aria-hidden="true" />
            2D map
          </button>
        </div>
      </header>

      {/* ── Left: Tx list / data layers ─────────────────────────────────── */}
      <aside className={cn('g3d-side g3d-side-left', !leftOpen && 'is-collapsed')} aria-label="Transformer list and data layers">
        <nav className="g3d-rail" aria-label="Left panel">
          <button
            type="button"
            className={cn('g3d-rail-button', leftOpen && leftTab === 'assets' && 'is-active')}
            aria-pressed={leftOpen && leftTab === 'assets'}
            aria-label="Transformer list"
            title="Tx list"
            onClick={() => {
              openLeft(!(leftOpen && leftTab === 'assets'));
              setLeftTab('assets');
            }}
          >
            <List aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn('g3d-rail-button', leftOpen && leftTab === 'layers' && 'is-active')}
            aria-pressed={leftOpen && leftTab === 'layers'}
            aria-label="Data layers"
            title="Data layers"
            onClick={() => {
              openLeft(!(leftOpen && leftTab === 'layers'));
              setLeftTab('layers');
            }}
          >
            <Layers aria-hidden="true" />
          </button>
        </nav>

        {leftOpen ? (
          <div className="g3d-panel">
            <div className="g3d-panel-header">
              <span>{leftTab === 'assets' ? 'Tx list' : 'Data layers'}</span>
              <span className="g3d-panel-count">
                {leftTab === 'assets' ? `${transformers.length} assets` : 'Show / hide'}
              </span>
              <button type="button" className="g3d-panel-close" onClick={() => setLeftOpen(false)} aria-label="Collapse panel">
                <PanelLeftClose aria-hidden="true" />
              </button>
            </div>
            {leftTab === 'assets' ? (
              <TxListPanel
                transformers={transformers}
                statusById={safeStatusById}
                selectedId={selectedId}
                onSelect={selectAsset}
                floorPlans={hierarchyFloorPlans}
                companyBoundaries={hierarchyCompanyBoundaries}
              />
            ) : (
              <DataLayersPanel
                layers={{ ...settings.layers, dataCentres: Boolean(dataCentreTracker?.settings.enabled) }}
                layerStatus={{ ...layerStatus, dataCentres: dataCentreTracker?.status.state === 'ok'
                  ? { state: 'ok', text: `${dataCentreTracker.facilities.filter((facility) => facility.mapped).length} mapped · ${dataCentreTracker.facilities.length} ${dataCentreTracker.settings.source === 'seafic' ? 'campuses' : 'facilities'}` }
                  : dataCentreTracker?.status }}
                availableKeys={availableKeys}
                buildingStyle={settings.buildingStyle}
                hasSelection={Boolean(selectedTransformer)}
                onToggleLayer={(layerId, next) => {
                  if (layerId === 'dataCentres') {
                    dataCentreTracker?.setSettings((current) => ({ ...current, enabled: next }));
                    if (next) openDataCentres();
                  } else setSettings((current) => ({ ...current, layers: { ...current.layers, [layerId]: next } }));
                }}
                onBuildingStyleChange={(buildingStyle) => patchSettings({ buildingStyle })}
                onOpenKeys={() => setKeysOpen(true)}
              />
            )}
          </div>
        ) : null}
      </aside>

      {/* ── Right: DGA + oil result ─────────────────────────────────────── */}
      <aside className={cn('g3d-side g3d-side-right', !rightOpen && 'is-collapsed')} aria-label={showDataCentrePanel ? 'Data centre tracker' : rightTab === 'plants' ? 'Power plants' : rightTab === 'radar' ? 'Rain radar' : 'DGA and oil result'}>
        {rightOpen && showDataCentrePanel ? <div className="g3d-panel g3d-dc-panel">
          <DataCentreTrackerPanel tracker={dataCentreTracker}
            onClose={() => dataCentreTracker.setSettings((current) => ({ ...current, panelOpen: false }))}
            onFlyTo={(campus) => {
              if (isNarrow()) {
                dataCentreTracker.setSettings((current) => ({ ...current, panelOpen: false }));
                setRightOpen(false);
              }
              sceneRef.current?.flyTo(campus.latitude, campus.longitude, 4000);
              setFeatureInfo(describeDataCentre(campus));
            }}
            onFit={() => {
              if (isNarrow()) {
                dataCentreTracker.setSettings((current) => ({ ...current, panelOpen: false }));
                setRightOpen(false);
              }
              sceneRef.current?.fitDataCentres(dataCentreTracker.facilities);
            }} />
        </div> : null}
        {showPlantsPanel ? (
          <div className="g3d-panel g3d-plant-panel">
            <div className="g3d-panel-header">
              <span>Power plants</span>
              <span className="g3d-panel-count">
                {settings.layers?.powerPlants && layerStatus.powerPlants?.count
                  ? `${layerStatus.powerPlants.count} stations`
                  : 'Layer off'}
              </span>
              <button type="button" className="g3d-panel-close" onClick={() => setRightOpen(false)} aria-label="Collapse panel">
                <PanelRightClose aria-hidden="true" />
              </button>
            </div>
            <div className="g3d-plant-panel-body">
              {!settings.layers?.powerPlants ? (
                <div className="g3d-plant-off">
                  <p>The power plant layer is off, so nothing is drawn on the globe.</p>
                  <button
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, layers: { ...current.layers, powerPlants: true } }))}
                  >
                    Show power plants
                  </button>
                </div>
              ) : null}
              <PowerPlantLegend
                className="g3d-plant-legend"
                counts={layerStatus.powerPlants?.fuelCounts}
                hiddenFuels={hiddenFuels}
                onHiddenFuelsChange={setHiddenFuels}
                collapsible={false}
              />
            </div>
          </div>
        ) : null}
        {showRadarPanel ? (
          <RainRadarPanel
            enabled={radarOn}
            status={layerStatus.rainRadar}
            frameIndex={radarFrameIndex}
            playing={radarPlaying}
            settings={radarSettings}
            onEnable={() => setSettings((current) => ({ ...current, layers: { ...current.layers, rainRadar: true } }))}
            onFrameChange={setRadarFrameIndex}
            onPlayingChange={setRadarPlaying}
            onSettingsChange={patchRadarSettings}
            onRefresh={() => setRadarRefreshToken((token) => token + 1)}
            onClose={() => setRightOpen(false)}
          />
        ) : null}
        {showResultPanel ? (
          <div className="g3d-panel">
            <div className="g3d-panel-header">
              <span>DGA &amp; oil result</span>
              <span className="g3d-panel-count">{selectedTransformer ? 'Latest sample' : 'Fleet'}</span>
              {selectedTransformer ? (
                <button type="button" className="g3d-panel-close" onClick={() => setSelectedId(null)} aria-label="Clear selection" title="Clear selection">
                  <X aria-hidden="true" />
                </button>
              ) : null}
              <button type="button" className="g3d-panel-close" onClick={() => setRightOpen(false)} aria-label="Collapse panel">
                <PanelRightClose aria-hidden="true" />
              </button>
            </div>
            <ResultPanel
              transformer={selectedTransformer}
              status={selectedTransformer ? safeStatusById.get(selectedTransformer.id) || 'normal' : null}
              transformers={transformers}
              statusById={safeStatusById}
              onFlyTo={(transformer) => sceneRef.current?.flyToAsset(transformer)}
              onViewDetails={onViewDetails}
            />
          </div>
        ) : null}

        <nav className="g3d-rail" aria-label="Right panel">
          <button
            type="button"
            className={cn('g3d-rail-button', showResultPanel && 'is-active')}
            aria-pressed={showResultPanel}
            aria-label="DGA and oil result"
            title="DGA & oil result"
            onClick={() => toggleRightTab('result')}
          >
            <FlaskConical aria-hidden="true" />
          </button>
          <button type="button" className={cn('g3d-rail-button', rightOpen && showDataCentrePanel && 'is-active')}
            aria-label="Data centre directory" title="Data centres" aria-pressed={rightOpen && showDataCentrePanel}
            onClick={() => {
              if (rightOpen && showDataCentrePanel) dataCentreTracker.setSettings((current) => ({ ...current, panelOpen: false }));
              else openDataCentres();
            }}><Server aria-hidden="true" /></button>
          <button
            type="button"
            className={cn('g3d-rail-button', showPlantsPanel && 'is-active')}
            aria-pressed={showPlantsPanel}
            aria-label="Power plants legend and fuel filter"
            title="Power plants"
            onClick={() => toggleRightTab('plants')}
          >
            <Factory aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn('g3d-rail-button', showRadarPanel && 'is-active', radarPlaying && 'is-busy')}
            aria-pressed={showRadarPanel}
            aria-label="Rain radar time and settings"
            title={radarPlaying ? 'Rain radar (playing)' : 'Rain radar'}
            onClick={() => toggleRightTab('radar')}
          >
            <CloudRain aria-hidden="true" />
          </button>
        </nav>
      </aside>

      {/* ── Picked building / reference feature ─────────────────────────── */}
      {featureInfo?.dataCentre ? <div className="g3d-feature-card g3d-dc-feature-card">
        <DataCentreInfoCard facility={featureInfo.dataCentre} onClose={() => setFeatureInfo(null)} />
      </div> : null}
      {featureInfo && !featureInfo.dataCentre ? (
        <div className={cn('g3d-feature-card', featureInfo.layout === 'list' && 'is-list')} role="status">
          <button type="button" className="g3d-panel-close" onClick={() => setFeatureInfo(null)} aria-label="Close">
            <X aria-hidden="true" />
          </button>
          {featureInfo.layout === 'list' ? (
            <p className="g3d-feature-heading">
              {featureInfo.color ? (
                <span className="g3d-feature-swatch" style={{ background: featureInfo.color }} aria-hidden="true" />
              ) : null}
              {featureInfo.kind}
            </p>
          ) : (
            <>
              <p className="g3d-eyebrow">{featureInfo.kind}</p>
              <p className="g3d-feature-title">{featureInfo.title}</p>
            </>
          )}
          <dl>
            {(featureInfo.rows || [])
              .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{featureInfo.layout === 'list' ? `${label}:` : label}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
          </dl>
          {featureInfo.link?.href && /^https?:\/\//i.test(featureInfo.link.href) ? (
            <a className="g3d-feature-link" href={featureInfo.link.href} target="_blank" rel="noopener noreferrer">
              {featureInfo.link.label || 'Source'} ↗
            </a>
          ) : null}
        </div>
      ) : null}

      {sourceError ? <div className="g3d-toast" role="alert">{sourceError}</div> : null}

      <HoverTip ref={hoverRef} transformers={transformers} statusById={safeStatusById} />
      <HudReadout ref={hudRef} />

      <BottomDock
        transformers={transformers}
        mapSource={settings.mapSource}
        visualPreset={settings.visualPreset}
        availableKeys={availableKeys}
        placeSearchEnabled={!(activeSource.kind === 'google3d' && googleKey)}
        onSelectAsset={selectAsset}
        onFlyTo={(latitude, longitude) => sceneRef.current?.flyTo(latitude, longitude)}
        onCamera={handleCameraCommand}
        onMapSourceChange={(mapSource) => patchSettings({ mapSource })}
        onVisualPresetChange={(visualPreset) => patchSettings({ visualPreset })}
        nightMode={nightMode.id}
        onNightModeChange={(id) => patchSettings({ nightMode: id })}
        onOpenKeys={() => setKeysOpen(true)}
      />

      <ApiKeysDialog
        open={keysOpen}
        apiKeys={settings.apiKeys}
        customKeys={settings.customKeys}
        onClose={() => setKeysOpen(false)}
        onSave={({ apiKeys, customKeys }) => {
          patchSettings({ apiKeys, customKeys });
          setKeysOpen(false);
        }}
      />
    </div>
  );
}
