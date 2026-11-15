import React, { useMemo } from 'react';
import { ExternalLink, FileText, FlaskConical, LocateFixed, MapPinOff, MousePointerClick } from 'lucide-react';
import {
  STATUS_META,
  STATUS_ORDER,
  buildAssetSummary,
  formatDate,
  formatValue,
  hasValidPosition,
} from '../../lib/globe3d/assetSummary';
import { getAssetOwnerLabel } from '../../lib/assetOwner';
import { getTransformerState } from '../../lib/malaysiaStates';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const TONE_COLORS = {
  normal: STATUS_META.normal.color,
  warning: STATUS_META.warning.color,
  critical: STATUS_META.critical.color,
  none: 'var(--g3d-muted)',
};

function Formula({ value }) {
  return (
    <>
      {String(value)
        .split(/(\d+)/)
        .filter(Boolean)
        .map((token, index) =>
          /^\d+$/.test(token) ? <sub key={index}>{token}</sub> : <span key={index}>{token}</span>
        )}
    </>
  );
}

function Sparkline({ values, color }) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point) => point.value !== null);
  if (points.length < 2) {
    return <span className="g3d-spark-empty" aria-hidden="true" />;
  }

  const width = 52;
  const height = 18;
  const max = Math.max(...points.map((point) => point.value));
  const min = Math.min(...points.map((point) => point.value));
  const range = max - min || 1;
  const lastIndex = values.length - 1 || 1;
  const coordinates = points.map((point) => [
    2 + (point.index / lastIndex) * (width - 4),
    height - 2 - ((point.value - min) / range) * (height - 4),
  ]);
  const [lastX, lastY] = coordinates[coordinates.length - 1];

  return (
    <svg className="g3d-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={coordinates.map((pair) => pair.join(',')).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

function FleetSummary({ transformers, statusById }) {
  const counts = { critical: 0, warning: 0, normal: 0 };
  transformers.forEach((transformer) => {
    counts[statusById.get(transformer.id) || 'normal'] += 1;
  });
  const unplaced = transformers.filter((transformer) => !hasValidPosition(transformer)).length;
  const sampleCount = transformers.reduce((sum, transformer) => sum + (transformer.oilTests?.length || 0), 0);

  return (
    <div className="g3d-panel-body">
      <div className="g3d-empty-state">
        <MousePointerClick aria-hidden="true" />
        <p className="g3d-empty-title">Select a transformer</p>
        <p className="g3d-empty-text">
          Click a pin on the globe or a row in the Tx list to see its latest DGA and oil quality result.
        </p>
      </div>

      <div className="g3d-section-title">
        <span>Fleet DGA status</span>
        <span className="g3d-section-note">{transformers.length} assets</span>
      </div>
      <div className="g3d-fleet-grid">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="g3d-fleet-card">
            <span className="g3d-fleet-value" style={{ color: STATUS_META[status].color }}>
              {counts[status]}
            </span>
            <span className="g3d-fleet-label">{STATUS_META[status].label}</span>
          </div>
        ))}
      </div>
      <dl className="g3d-kv">
        <div>
          <dt>Oil samples on record</dt>
          <dd>{sampleCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Without GPS position</dt>
          <dd>{unplaced}</dd>
        </div>
      </dl>
      <p className="g3d-hint">
        Status is taken from the latest oil test, on H<sub>2</sub>, CH<sub>4</sub>, C<sub>2</sub>H<sub>6</sub>,
        C<sub>2</sub>H<sub>4</sub> and C<sub>2</sub>H<sub>2</sub> against the transformer&apos;s saved gas limit
        standard: critical at ≥ 110 % of a limit, warning at ≥ 105 %. Same rule as the 2D map.
      </p>
    </div>
  );
}

/** Right panel: latest DGA + oil quality result for the selected transformer. */
export default function ResultPanel({ transformer, status, transformers, statusById, onFlyTo, onViewDetails }) {
  const summary = useMemo(() => (transformer ? buildAssetSummary(transformer) : null), [transformer]);

  if (!transformer || !summary) {
    return <FleetSummary transformers={transformers} statusById={statusById} />;
  }

  const located = hasValidPosition(transformer);
  const statusMeta = STATUS_META[status] || STATUS_META.normal;
  const { dga, oil } = summary;
  const [latitude, longitude] = transformer.position || [];

  return (
    <div className="g3d-panel-body">
      <header className="g3d-asset-header">
        <p className="g3d-eyebrow">{transformer.siteName || 'Unknown site'}</p>
        <h2 className="g3d-asset-title">{transformer.txName || 'Unnamed transformer'}</h2>
        <div className="g3d-badge-row">
          {transformer.voltage ? <Badge variant="default">{transformer.voltage}</Badge> : null}
          {transformer.loadMVA ? <Badge variant="secondary">{transformer.loadMVA} MVA</Badge> : null}
          <Badge variant="secondary">{getAssetOwnerLabel(transformer.ownerType)}</Badge>
          <Badge variant="outline">{getTransformerState(transformer)}</Badge>
        </div>
      </header>

      <div className="g3d-status-banner" style={{ '--g3d-status': statusMeta.color }}>
        <span className="g3d-status-pulse" aria-hidden="true" />
        <div>
          <p className="g3d-status-label">DGA status · {statusMeta.label}</p>
          <p className="g3d-status-text">
            {dga.ready && dga.primaryFault
              ? `${dga.primaryFault.code} — ${dga.primaryFault.label} (${dga.primaryFault.source})`
              : dga.ready && dga.insufficientForDuval
                ? 'Not enough gases for a Duval fault zone'
                : dga.ready
                  ? 'No fault zone indicated'
                  : dga.message}
          </p>
        </div>
      </div>

      <section>
        <div className="g3d-section-title">
          <span>
            <FlaskConical aria-hidden="true" /> Dissolved gas analysis
          </span>
          <span className="g3d-section-note">{dga.ready ? formatDate(dga.sampleDate) : '—'}</span>
        </div>

        {dga.ready ? (
          <>
            <div className="g3d-gas-table" role="table" aria-label="Dissolved gases against limits">
              <div className="g3d-gas-head" role="row">
                <span role="columnheader">Gas</span>
                <span role="columnheader">ppm</span>
                <span role="columnheader">Limit</span>
                <span role="columnheader">Trend</span>
              </div>
              {dga.gases.map((gas) => {
                const color = TONE_COLORS[gas.tone];
                const fill = gas.ratio !== null ? Math.min(gas.ratio / 1.25, 1) * 100 : 0;
                return (
                  <div key={gas.key} className="g3d-gas-row" role="row" title={gas.name}>
                    <span className="g3d-gas-name" role="cell">
                      <Formula value={gas.formula} />
                    </span>
                    <span className="g3d-gas-value" role="cell" style={gas.tone !== 'normal' && gas.tone !== 'none' ? { color } : undefined}>
                      {formatValue(gas.value)}
                    </span>
                    <span className="g3d-gas-limit" role="cell">
                      {gas.limit !== null ? formatValue(gas.limit) : '—'}
                    </span>
                    <span role="cell">
                      <Sparkline values={gas.trend} color={gas.tone === 'none' ? 'var(--g3d-primary)' : color} />
                    </span>
                    <span className="g3d-gas-bar" aria-hidden="true">
                      <span style={{ width: `${fill}%`, background: color }} />
                      {gas.limit !== null ? <i /> : null}
                    </span>
                  </div>
                );
              })}
            </div>

            <dl className="g3d-kv">
              <div>
                <dt>TDCG</dt>
                <dd>{dga.tdcg !== null ? `${formatValue(dga.tdcg)} ppm` : '—'}</dd>
              </div>
              <div>
                <dt>
                  CO<sub>2</sub>/CO
                </dt>
                <dd>{dga.co2CoRatio !== null ? formatValue(dga.co2CoRatio) : '—'}</dd>
              </div>
              <div>
                <dt>Gas limits</dt>
                <dd>{dga.standardLabel}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="g3d-empty">{dga.message}</p>
        )}
      </section>

      <section>
        <div className="g3d-section-title">
          <span>
            <FileText aria-hidden="true" /> Oil quality
          </span>
          <span className="g3d-section-note">{oil.ready ? formatDate(oil.sampleDate) : '—'}</span>
        </div>

        {oil.ready ? (
          <ul className="g3d-oil-list">
            {oil.items.map((item) => (
              <li key={item.key} title={item.rangeLabel ? `Good: ${item.rangeLabel}` : undefined}>
                <span className="g3d-oil-label">{item.label}</span>
                <span className="g3d-oil-value">
                  {formatValue(item.value)}
                  {item.unit ? <small> {item.unit}</small> : null}
                </span>
                <Badge variant={item.badgeVariant} className="g3d-oil-badge">
                  {item.statusLabel}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="g3d-empty">{oil.message}</p>
        )}
        {oil.ready && oil.profileLabel ? (
          <p className="g3d-hint">Assessed against the {oil.profileLabel} in-service profile.</p>
        ) : null}
      </section>

      <dl className="g3d-kv g3d-kv-compact">
        <div>
          <dt>Serial</dt>
          <dd>{transformer.serialNumber || '—'}</dd>
        </div>
        <div>
          <dt>Maker · built</dt>
          <dd>{[transformer.maker, transformer.yearBuilt].filter(Boolean).join(' · ') || '—'}</dd>
        </div>
        <div>
          <dt>Records</dt>
          <dd>
            {summary.testCount} oil tests · {transformer.documents?.length || 0} documents
          </dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd className={cn(!located && 'g3d-warn-text')}>
            {located ? (
              `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
            ) : (
              <>
                <MapPinOff aria-hidden="true" /> Not set
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="g3d-action-row">
        <Button className="flex-1" onClick={() => onViewDetails(transformer)}>
          Open full details
        </Button>
        <Button variant="outline" size="icon" onClick={() => onFlyTo(transformer)} disabled={!located} aria-label="Fly to transformer" title="Fly to transformer">
          <LocateFixed className="h-4 w-4" />
        </Button>
        {located ? (
          <a
            className="g3d-icon-link"
            href={`https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in Google Maps"
            title="Open in Google Maps"
          >
            <ExternalLink aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
