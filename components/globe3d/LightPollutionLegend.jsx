import React from 'react';
import { lightPollutionGradientCss } from '../../lib/globe3d/nightModes';
import { cn } from '../../lib/utils';

const GRADIENT = lightPollutionGradientCss();

/** Colour key for the Night look's light-pollution modes. */
export default function LightPollutionLegend({ className, compact = false }) {
  return (
    <div className={cn('g3d-lp-legend', compact && 'is-compact', className)} role="img" aria-label="Light pollution scale, from pristine dark sky to city centre">
      {compact ? <span className="g3d-lp-legend-title">Light pollution</span> : null}
      <span className="g3d-lp-legend-bar" style={{ background: GRADIENT }} aria-hidden="true" />
      <span className="g3d-lp-legend-labels" aria-hidden="true">
        <span>Pristine</span>
        <span>Rural</span>
        <span>Suburban</span>
        <span>Urban</span>
        <span>City</span>
      </span>
      {compact ? null : (
        <small className="g3d-lp-legend-note">
          Estimated sky glow spread from NASA VIIRS city lights — for context, not a measured sky brightness.
        </small>
      )}
    </div>
  );
}
