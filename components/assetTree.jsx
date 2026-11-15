import React from 'react';
import './assetTree.css';

// Same colours as the 2D map markers (App.jsx MARKER_STATUS_COLORS).
export const STATUS_COLORS = {
  critical: '#dc2626',
  warning: '#eab308',
  normal: '#16a34a',
};

export const STATUS_LABELS = {
  critical: 'Critical',
  warning: 'Warning',
  normal: 'Normal',
};

const STATUS_ORDER = ['critical', 'warning', 'normal'];

export function getAssetStatus(statusById, transformer) {
  return statusById?.get?.(transformer?.id) || 'normal';
}

/** { total, critical, warning, normal } for a list of transformers. */
export function summarizeStatuses(transformers, statusById) {
  const summary = { total: 0, critical: 0, warning: 0, normal: 0 };
  (transformers || []).forEach((transformer) => {
    summary.total += 1;
    summary[getAssetStatus(statusById, transformer)] += 1;
  });
  return summary;
}

/** "● 3  ● 1  [12]" — critical and warning only when present, then the total. */
export function StatusCounts({ summary, totalLabel }) {
  return (
    <span className="atree-counts">
      {summary.critical ? (
        <span className="atree-count" title={`${summary.critical} critical`}>
          <span className="atree-dot" style={{ background: STATUS_COLORS.critical }} aria-hidden="true" />
          {summary.critical}
        </span>
      ) : null}
      {summary.warning ? (
        <span className="atree-count" title={`${summary.warning} warning`}>
          <span className="atree-dot" style={{ background: STATUS_COLORS.warning }} aria-hidden="true" />
          {summary.warning}
        </span>
      ) : null}
      <span className="atree-total" title={`${summary.total} transformers`}>
        {totalLabel ?? summary.total}
      </span>
    </span>
  );
}

/** Thin stacked bar showing the critical / warning / normal mix of a group. */
export function StatusMeter({ summary }) {
  if (!summary.total) {
    return null;
  }
  return (
    <span className="atree-meter" aria-hidden="true">
      {STATUS_ORDER.map((status) =>
        summary[status] ? (
          <span key={status} style={{ flexGrow: summary[status], background: STATUS_COLORS[status] }} />
        ) : null
      )}
    </span>
  );
}
