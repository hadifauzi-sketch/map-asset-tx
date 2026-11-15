import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { CAPACITY_KEY_MW, FUEL_LEGEND, POWER_PLANT_LAYER_TITLE, plantRadius } from '../lib/powerPlants';

/**
 * Fuel-colour + capacity-size legend for the power plant layer, shared by the
 * 2D map (inside a Leaflet control) and the 3D globe (right-panel tab).
 * `counts` ({ Gas: 20, ... } keyed by legend id) is optional; fuels with no
 * plant in the data are dimmed.
 * Pass `onHiddenFuelsChange` to make each fuel row a show/hide toggle;
 * `hiddenFuels` is the list of legend ids currently hidden.
 */
export default function PowerPlantLegend({
  counts,
  className,
  hiddenFuels = [],
  onHiddenFuelsChange,
  collapsible = true,
  showTitle = true,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasCounts = counts && Object.keys(counts).length > 0;
  const interactive = typeof onHiddenFuelsChange === 'function';
  const hidden = new Set(hiddenFuels);
  const isOpen = !collapsible || !collapsed;

  const toggleFuel = (id) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onHiddenFuelsChange(FUEL_LEGEND.map((entry) => entry.id).filter((fuelId) => next.has(fuelId)));
  };

  return (
    <section
      className={cn('plant-legend', collapsible && collapsed && 'is-collapsed', interactive && 'is-interactive', className)}
      aria-label={POWER_PLANT_LAYER_TITLE}
    >
      {showTitle || collapsible ? (
        <header className="plant-legend-header">
          {showTitle ? <h3>{POWER_PLANT_LAYER_TITLE}</h3> : <span />}
          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
              title={collapsed ? 'Expand legend' : 'Collapse legend'}
            >
              {collapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </button>
          ) : null}
        </header>
      ) : null}

      {isOpen ? (
        <>
          {interactive ? (
            <div className="plant-legend-bulk">
              <span>{FUEL_LEGEND.length - hidden.size} of {FUEL_LEGEND.length} fuel types shown</span>
              <button type="button" onClick={() => onHiddenFuelsChange([])} disabled={hidden.size === 0}>
                Show all
              </button>
              <button
                type="button"
                onClick={() => onHiddenFuelsChange(FUEL_LEGEND.map((entry) => entry.id))}
                disabled={hidden.size === FUEL_LEGEND.length}
              >
                Hide all
              </button>
            </div>
          ) : null}

          <ul className="plant-legend-list">
            {FUEL_LEGEND.map((entry) => {
              const count = counts?.[entry.id] || 0;
              const isHidden = hidden.has(entry.id);
              const content = (
                <>
                  <span
                    className="plant-legend-swatch"
                    style={isHidden ? { borderColor: entry.color } : { background: entry.color }}
                    aria-hidden="true"
                  >
                    {interactive && !isHidden ? <Check aria-hidden="true" /> : null}
                  </span>
                  <span className="plant-legend-label">{entry.label}</span>
                  {hasCounts ? <span className="plant-legend-count">{count}</span> : null}
                </>
              );
              return (
                <li key={entry.id} className={cn(hasCounts && count === 0 && 'is-empty', isHidden && 'is-hidden')}>
                  {interactive ? (
                    <button
                      type="button"
                      className="plant-legend-toggle"
                      onClick={() => toggleFuel(entry.id)}
                      aria-pressed={!isHidden}
                      title={isHidden ? `Show ${entry.label}` : `Hide ${entry.label}`}
                    >
                      {content}
                    </button>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>

          <div className="plant-legend-sizes" aria-label="Circle size by capacity">
            {CAPACITY_KEY_MW.map((mw) => {
              const size = plantRadius(mw) * 2;
              return (
                <span key={mw}>
                  <i style={{ width: size, height: size }} aria-hidden="true" />
                  {mw.toLocaleString('en-US')} MW
                </span>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
