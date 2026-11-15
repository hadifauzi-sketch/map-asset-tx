import { useEffect, useRef, useState } from 'react';
import { UtilityPole } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { cn } from '../lib/utils';
import { GRID_LAYER_COLORS, UNKNOWN_VOLTAGE_COLOR, VOLTAGE_BANDS } from '../lib/globe3d/powerGrid';
import { ACCENT, GRID_SYMBOLS } from '../lib/gridSymbols';
import { fuelColor } from '../lib/powerPlants';
import { POWER_GRID_GROUPS, POWER_GRID_MAP_LAYERS, countActiveGridLayers, gridLayersInGroup } from '../lib/powerGridMap';

const POWER_LINE_GRADIENT = `linear-gradient(90deg, ${VOLTAGE_BANDS.map((band) => band.color).join(', ')})`;
// Fuel colours as a pie, hinting that power stations are coloured by fuel.
const PLANT_SWATCH = `conic-gradient(${['Coal', 'Gas', 'Hydro', 'Solar', 'Oil']
  .map((fuel, index, all) => `${fuelColor(fuel)} ${(index / all.length) * 360}deg ${((index + 1) / all.length) * 360}deg`)
  .join(', ')})`;

/** The map symbol itself (lib/gridSymbols.js), drawn as inline SVG. */
function SymbolSwatch({ symbolId }) {
  const parts = GRID_SYMBOLS[symbolId] || [];
  const accent = fuelColor('Gas');
  return (
    <svg className="grid-swatch-symbol" viewBox="0 0 16 16" aria-hidden="true">
      {parts.map((part, index) => (
        <path
          key={index}
          d={part.d}
          fill={part.fill ? (part.fill === ACCENT ? accent : part.fill) : 'none'}
          stroke={part.stroke ? (part.stroke === ACCENT ? accent : part.stroke) : 'none'}
          strokeWidth={part.stroke ? (part.width ?? 1.1) : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function LayerSwatch({ layer }) {
  if (layer.shape === 'symbol') {
    return <SymbolSwatch symbolId={layer.swatch} />;
  }
  if (layer.shape === 'point') {
    return (
      <span
        className="grid-swatch-point"
        style={{ background: layer.id === 'powerPlants' ? PLANT_SWATCH : GRID_LAYER_COLORS[layer.id] }}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn('grid-swatch-line', layer.id === 'powerCables' && 'is-dashed')}
      style={
        layer.id === 'powerLines'
          ? { background: POWER_LINE_GRADIENT }
          : { '--grid-swatch-color': GRID_LAYER_COLORS[layer.id] }
      }
      aria-hidden="true"
    />
  );
}

function statusText(layer, isOn, status) {
  if (!isOn || !status) return layer.note;
  if (status.state === 'loading') return 'Loading…';
  if (status.state === 'error') return status.text || 'Failed to load';
  if (Number.isFinite(status.belowZoom)) {
    return `${status.count.toLocaleString()} loaded · zoom in (level ${status.belowZoom}+) to see`;
  }
  if (Number.isFinite(status.count)) return `${status.count.toLocaleString()} on the map`;
  return layer.note;
}

/**
 * Toolbar button + dropdown with one switch per power grid layer.
 *
 * layers:   { [layerId]: boolean }
 * status:   { [layerId]: { state, text?, count? } }
 * onChange: (nextLayers) => void
 */
export default function PowerGridControl({ layers, status, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const activeCount = countActiveGridLayers(layers);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setIsOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const setLayer = (layerId, next) => onChange({ ...layers, [layerId]: next });
  const setAll = (next) =>
    onChange(Object.fromEntries(POWER_GRID_MAP_LAYERS.map((layer) => [layer.id, next])));
  const setGroup = (groupId, next) =>
    onChange({ ...layers, ...Object.fromEntries(gridLayersInGroup(groupId).map((layer) => [layer.id, next])) });

  return (
    <div ref={rootRef} className="relative">
      <Button
        size="sm"
        variant={isOpen || activeCount > 0 ? 'default' : 'outline'}
        className="relative h-9 w-9 shrink-0 p-0"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? 'Close power grid layers' : 'Open power grid layers'}
        title="Power grid layers"
      >
        <UtilityPole className="h-4 w-4" />
        {activeCount > 0 ? <span className="grid-count-badge">{activeCount}</span> : null}
      </Button>

      {isOpen ? (
        <div className="grid-menu" role="dialog" aria-label="Power grid layers">
          <div className="grid-menu-header">
            <div>
              <p className="grid-menu-title">Power grid</p>
              <p className="grid-menu-subtitle">Malaysia · shown on the map</p>
            </div>
            <div className="grid-menu-actions">
              <button type="button" onClick={() => setAll(true)} disabled={activeCount === POWER_GRID_MAP_LAYERS.length}>
                All on
              </button>
              <button type="button" onClick={() => setAll(false)} disabled={activeCount === 0}>
                Clear
              </button>
            </div>
          </div>

          <div className="grid-menu-scroll">
            {POWER_GRID_GROUPS.map((group) => {
              const groupLayers = gridLayersInGroup(group.id);
              const onCount = groupLayers.filter((layer) => layers[layer.id]).length;
              const allOn = onCount === groupLayers.length;
              return (
                <section key={group.id} className="grid-menu-group" aria-label={group.label}>
                  <div className="grid-menu-group-head">
                    <span className="grid-menu-group-title">
                      {group.label}
                      <span className="grid-menu-group-count">
                        {onCount}/{groupLayers.length}
                      </span>
                    </span>
                    <button type="button" onClick={() => setGroup(group.id, !allOn)}>
                      {allOn ? 'Hide all' : 'Show all'}
                    </button>
                  </div>
                  <ul className="grid-menu-list">
                    {groupLayers.map((layer) => {
                      const isOn = Boolean(layers[layer.id]);
                      const layerStatus = status[layer.id];
                      return (
                        <li key={layer.id} className={cn('grid-menu-row', isOn && 'is-on')}>
                          <LayerSwatch layer={layer} />
                          <span className="grid-menu-text">
                            <span className="grid-menu-label">{layer.label}</span>
                            <span
                              className={cn(
                                'grid-menu-note',
                                isOn && layerStatus?.state === 'error' && 'is-error',
                                isOn && Number.isFinite(layerStatus?.belowZoom) && 'is-hint'
                              )}
                            >
                              {statusText(layer, isOn, layerStatus)}
                            </span>
                          </span>
                          <Switch
                            checked={isOn}
                            onCheckedChange={(next) => setLayer(layer.id, next)}
                            aria-label={`${layer.label} layer`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          {layers.powerLines ? (
            <div className="grid-menu-legend" aria-label="Power line voltage colours">
              {[...VOLTAGE_BANDS, { label: 'Not mapped', color: UNKNOWN_VOLTAGE_COLOR }].map((band) => (
                <span key={band.label}>
                  <i style={{ background: band.color }} aria-hidden="true" />
                  {band.label}
                </span>
              ))}
            </div>
          ) : null}

          <p className="grid-menu-footer">
            Click a site or line for details. Grid data © OpenStreetMap contributors (ODbL); power stations: WRI
            Global Power Plant Database.
          </p>
        </div>
      ) : null}
    </div>
  );
}
