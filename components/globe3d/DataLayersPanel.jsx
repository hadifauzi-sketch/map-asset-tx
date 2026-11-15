import React from 'react';
import { KeyRound, Lock } from 'lucide-react';
import { BUILDING_STYLES, getBuildingStyle } from '../../lib/globe3d/buildingStyles';
import { LAYERS, LAYER_GROUPS } from '../../lib/globe3d/layerRegistry';
import { UNKNOWN_VOLTAGE_COLOR, VOLTAGE_BANDS } from '../../lib/globe3d/powerGrid';
import { BUILT_IN_API_KEYS } from '../../lib/globe3d/settingsStore';
import { cn } from '../../lib/utils';
import { Switch } from '../ui/switch';

function keyLabel(keyId) {
  const definition = BUILT_IN_API_KEYS.find((entry) => entry.id === keyId);
  return definition?.shortLabel || definition?.label || keyId;
}

/** Left panel: on/off switch per data layer, plus the 3D buildings style. */
export default function DataLayersPanel({
  layers,
  layerStatus,
  availableKeys,
  buildingStyle,
  hasSelection,
  onToggleLayer,
  onBuildingStyleChange,
  onOpenKeys,
  onOpenDataCentres,
}) {
  const activeStyle = getBuildingStyle(buildingStyle);
  const buildingsUsable = Boolean(layers.buildings);

  return (
    <div className="g3d-panel-body g3d-layers">
      {LAYER_GROUPS.map((group) => (
        <section key={group.id} className="g3d-layer-group">
          <header className="g3d-section-title">
            <span>{group.label}</span>
            {group.note ? <span className="g3d-section-note">{group.note}</span> : null}
          </header>

          {LAYERS.filter((layer) => layer.group === group.id).map((layer) => {
            const Icon = layer.icon;
            const locked = Boolean(layer.requires && !availableKeys[layer.requires]);
            const status = layerStatus[layer.id];
            const isOn = Boolean(layers[layer.id]) && !locked;

            return (
              <div key={layer.id} className={cn('g3d-layer-row', isOn && 'is-on')}>
                <span className="g3d-layer-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="g3d-layer-text">
                  <span className="g3d-layer-label">{layer.label}</span>
                  <span className={cn('g3d-layer-source', status?.state === 'error' && 'is-error')}>
                    {locked ? `Needs ${keyLabel(layer.requires)}` : (isOn && status?.text) || layer.source}
                  </span>
                </span>
                {locked ? (
                  <button type="button" className="g3d-key-button" onClick={onOpenKeys}>
                    <Lock aria-hidden="true" />
                    Add key
                  </button>
                ) : (
                  <Switch
                    checked={isOn}
                    onCheckedChange={(next) => onToggleLayer(layer.id, next)}
                    aria-label={`${layer.label} layer`}
                  />
                )}
              </div>
            );
          })}

          {group.id === 'digital' ? <button type="button" className="g3d-wide-button" onClick={onOpenDataCentres}>
            Open tracker &amp; filters
          </button> : null}

          {group.id === 'world' ? (
            <div className={cn('g3d-style-block', !buildingsUsable && 'is-disabled')}>
              <div className="g3d-style-heading">
                <span>Building styling</span>
                <span className="g3d-section-note">3D Tiles feature styling</span>
              </div>
              <div className="g3d-style-grid">
                {BUILDING_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    disabled={!buildingsUsable}
                    className={cn('g3d-style-option', buildingStyle === style.id && 'is-active')}
                    aria-pressed={buildingStyle === style.id}
                    onClick={() => onBuildingStyleChange(style.id)}
                    title={style.description}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
              <ul className="g3d-legend">
                {activeStyle.legend.map((entry) => (
                  <li key={entry.label}>
                    <span className="g3d-legend-swatch" style={{ background: entry.color }} />
                    {entry.label}
                  </li>
                ))}
              </ul>
              {activeStyle.needsSelection && !hasSelection ? (
                <p className="g3d-hint">Select a transformer to colour buildings by distance from it.</p>
              ) : null}
              {!buildingsUsable ? (
                <p className="g3d-hint">Turn on 3D buildings to use styling.</p>
              ) : null}
            </div>
          ) : null}

          {group.id === 'grid' && layers.powerLines ? (
            <ul className="g3d-legend g3d-grid-legend" aria-label="Power line voltage colours">
              {[...VOLTAGE_BANDS, { label: 'Voltage not mapped', color: UNKNOWN_VOLTAGE_COLOR }].map((band) => (
                <li key={band.label}>
                  <span className="g3d-legend-swatch" style={{ background: band.color }} />
                  {band.label}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <button type="button" className="g3d-wide-button" onClick={onOpenKeys}>
        <KeyRound aria-hidden="true" />
        Manage API keys
      </button>
    </div>
  );
}
