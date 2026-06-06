import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { AppTooltip } from '../ui/app-tooltip';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  IEC_60422_PARAMETER_ORDER,
  IEC_60422_VOLTAGE_GROUPS,
  formatIecValue,
  getActionRangeLabel,
  getHealthyRangeLabel,
  getIec60422Assessment,
  getMonitorRangeLabel,
} from '../../lib/standards/iec60422Profiles';
import {
  formatSupplementaryValue,
  getSupplementaryActionRangeLabel,
  getSupplementaryHealthyRangeLabel,
  getSupplementaryMonitorRangeLabel,
} from '../../lib/standards/supplementaryOilReferences';

const STATUS_ICONS = {
  healthy: CheckCircle2,
  monitor: AlertTriangle,
  action: AlertTriangle,
  noData: Info,
};

const SUMMARY_TILES = [
  { key: 'healthy', fallbackLabel: 'Healthy', variant: 'success' },
  { key: 'monitor', fallbackLabel: 'Monitor', variant: 'warning' },
  { key: 'action', fallbackLabel: 'Action', variant: 'danger' },
  { key: 'noData', fallbackLabel: 'No data', variant: 'secondary' },
];

function getSummaryTileLabel(tile, limitProfile) {
  return limitProfile?.statusLabels?.[tile.key] || tile.fallbackLabel;
}

function getSummaryTileDescription(key) {
  if (key === 'healthy') return 'Within active IEC basis';
  if (key === 'monitor') return 'Between good and poor';
  if (key === 'action') return 'Outside active IEC basis';
  return 'No result captured';
}

function formatValueWithUnit(value, limit) {
  const formattedValue = formatIecValue(value, limit);
  return limit?.unit ? `${formattedValue} ${limit.unit}` : formattedValue;
}

function formatRangeWithUnit(rangeLabel, limit) {
  if (!rangeLabel || rangeLabel === '-') {
    return '-';
  }
  return limit?.unit && rangeLabel !== 'Not used' ? `${rangeLabel} ${limit.unit}` : rangeLabel;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatVoltage(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  if (Number.isInteger(numericValue)) {
    return `${numericValue}`;
  }

  return numericValue.toFixed(1);
}

function appendSupplementaryUnit(label, reference) {
  if (!label || label === '-' || label === 'Not used') return label || '-';
  return reference?.unit ? `${label} ${reference.unit}` : label;
}

function formatSupplementaryLatestValue(item) {
  if (item.value === null || item.value === undefined || item.value === '') return '-';
  const formatted = formatSupplementaryValue(item.value, item.reference);
  return item.reference?.unit ? `${formatted} ${item.reference.unit}` : formatted;
}

function ThresholdCell({ limit }) {
  return (
    <div className="grid gap-1 text-xs text-[var(--foreground)]">
      <span className="font-semibold text-[var(--foreground)]">{limit.shortLabel}</span>
      <span className="text-[var(--muted)]">
        {limit.statusLabels?.healthy || 'Healthy'} {formatRangeWithUnit(getHealthyRangeLabel(limit), limit)}
      </span>
      <span className="text-[var(--muted)]">
        {limit.statusLabels?.action || 'Action'} {formatRangeWithUnit(getActionRangeLabel(limit), limit)}
      </span>
    </div>
  );
}

function Iec60422Panel({
  assessment,
  sample,
  transformer,
  supplementaryAssessment,
  title = 'IEC 60422 operating profile',
  description = 'Stored in-app so the same voltage-group limits can drive the dashboard and every oil-test result.',
  showGroupMatrix = false,
  className = '',
}) {
  const [tableCollapsed, setTableCollapsed] = useState(true);
  const [matrixCollapsed, setMatrixCollapsed] = useState(true);
  const resolvedAssessment = assessment || getIec60422Assessment(sample, transformer);

  if (!resolvedAssessment) {
    return null;
  }

  const {
    standard,
    limitProfile,
    limitProfileGroups,
    testType,
    profile,
    voltageInput,
    highestVoltageKv,
    usedFallback,
    items,
    summary,
    sampleDate,
    parameterOrder,
  } = resolvedAssessment;
  const voltageGroups = limitProfileGroups || IEC_60422_VOLTAGE_GROUPS;
  const matrixParameterOrder = parameterOrder || IEC_60422_PARAMETER_ORDER;
  const matrixMetricKeys = matrixParameterOrder.filter((metricKey) =>
    Object.values(voltageGroups).some((group) => group.limits?.[metricKey]),
  );
  const columnLabels = limitProfile?.columnLabels || {
    healthy: 'Healthy',
    monitor: 'Monitor',
    action: 'Action',
  };
  const selectedStandardLabel = standard?.label || 'the selected IEC standard';

  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--primary-strong)]" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{standard.label}</Badge>
            {limitProfile ? <Badge variant="secondary">{limitProfile.shortLabel}</Badge> : null}
            <Badge variant="outline">Group {profile.code}</Badge>
            <Badge variant="outline">{profile.shortLabel}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid items-start gap-3 xl:grid-cols-[1.2fr_1fr]">
          <div className="iec-class-snapshot">
            <div className="iec-class-tile">
              <p className="iec-summary-label">
                <Layers className="h-3.5 w-3.5 text-[var(--primary-strong)]" />
                Voltage basis
              </p>
              <p className="iec-class-value">{voltageInput || 'Not set'}</p>
              <p className="iec-summary-helper">
                Highest winding: {highestVoltageKv !== null ? `${formatVoltage(highestVoltageKv)} kV` : 'Not resolved'}
                {sampleDate ? ` - ${formatDate(sampleDate)}` : ''}
              </p>
            </div>

            <div className="iec-class-tile">
              <p className="iec-summary-label">IEC group</p>
              <p className="iec-class-value">{profile.label}</p>
              <p className="iec-summary-helper">{profile.description}</p>
            </div>

            <div className="iec-class-tile">
              <p className="iec-summary-label">Test basis</p>
              <p className="iec-class-value">{limitProfile?.label || 'Routine / in-service oil'}</p>
              <p className="iec-summary-helper">
                {testType ? `${testType} - ` : ''}{limitProfile?.sourceLabel || 'IEC 60422:2024'}
              </p>
            </div>

            {usedFallback ? (
              <div className="iec-class-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  The app could not parse the transformer voltage, so it is using the 72.5-170 kV profile until a rated voltage is entered.
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid self-start gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {SUMMARY_TILES.map((tile) => {
              const label = getSummaryTileLabel(tile, limitProfile);
              return (
              <div
                key={tile.key}
                className={`iec-summary-tile iec-summary-tile-${tile.key}`}
              >
                <div className="min-w-0">
                  <p className="iec-summary-label">{label}</p>
                  <p className="iec-summary-value">{summary[tile.key]}</p>
                </div>
                <Badge className="iec-summary-badge" variant={tile.variant}>{summary[tile.key]}</Badge>
                <p className="iec-summary-helper">{getSummaryTileDescription(tile.key)}</p>
              </div>
            );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-[color:var(--border)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="text-left">
                <AppTooltip content={tableCollapsed ? 'Show parameters' : 'Hide parameters'}>
                  <tr
                    className={`iec-limits-toggle-row cursor-pointer select-none transition-colors ${
                      tableCollapsed ? 'is-collapsed' : 'is-expanded'
                    }`}
                    onClick={() => setTableCollapsed((c) => !c)}
                    aria-expanded={!tableCollapsed}
                  >
                    <th className="px-4 py-3 font-semibold">
                      <span className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            width: 14,
                            height: 14,
                            flexShrink: 0,
                            transition: 'transform 0.2s',
                            transform: tableCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        Parameter
                      </span>
                    </th>
                    <th className="px-4 py-3 font-semibold">Latest</th>
                    <th className="px-4 py-3 font-semibold">{columnLabels.healthy}</th>
                    <th className="px-4 py-3 font-semibold">{columnLabels.monitor}</th>
                    <th className="px-4 py-3 font-semibold">{columnLabels.action}</th>
                  </tr>
                </AppTooltip>
              </thead>
              {!tableCollapsed && <tbody>
                {items.map((item) => {
                  const Icon = STATUS_ICONS[item.status === 'no-data' ? 'noData' : item.status];

                  return (
                    <tr
                      key={item.key}
                      className="border-t border-[color:var(--border)] bg-[var(--card)] align-top"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{item.limit.label}</p>
                          <p className="text-xs text-[var(--muted)]">{item.limit.testBasis}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[var(--foreground)]">
                            {item.value === null ? '-' : formatValueWithUnit(item.value, item.limit)}
                          </span>
                          <Badge variant={item.badgeVariant}>
                            <Icon className="h-3.5 w-3.5" />
                            {item.statusLabel}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {formatRangeWithUnit(item.healthyRangeLabel, item.limit)}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {formatRangeWithUnit(item.monitorRangeLabel, item.limit)}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {formatRangeWithUnit(item.actionRangeLabel, item.limit)}
                      </td>
                    </tr>
                  );
                })}
                {supplementaryAssessment?.items?.length > 0 ? (
                  <>
                    {supplementaryAssessment.items.map((item) => {
                      const Icon = STATUS_ICONS[item.status === 'noData' ? 'noData' : item.status];
                      return (
                        <tr
                          key={item.key}
                          className="border-t border-[color:var(--border)] bg-[var(--card)] align-top"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-[var(--foreground)]">{item.reference.label}</p>
                              <p className="text-xs text-[var(--muted)]">{item.reference.sourceLabel}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[var(--foreground)]">
                                {formatSupplementaryLatestValue(item)}
                              </span>
                              <Badge variant={item.badgeVariant}>
                                <Icon className="h-3.5 w-3.5" />
                                {item.statusLabel}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {appendSupplementaryUnit(getSupplementaryHealthyRangeLabel(item.reference), item.reference)}
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {appendSupplementaryUnit(getSupplementaryMonitorRangeLabel(item.reference), item.reference)}
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {appendSupplementaryUnit(getSupplementaryActionRangeLabel(item.reference), item.reference)}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ) : null}
              </tbody>}
            </table>
          </div>
        </div>

        {showGroupMatrix ? (
          <div className="overflow-hidden rounded-md border border-[color:var(--border)] bg-[var(--card-muted)]">
            <AppTooltip content={matrixCollapsed ? 'Show voltage-group comparison' : 'Hide voltage-group comparison'}>
              <button
                type="button"
                className="flex w-full cursor-pointer select-none items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--card-hover,var(--card-muted))]"
                onClick={() => setMatrixCollapsed((c) => !c)}
                aria-label={matrixCollapsed ? 'Show voltage-group comparison' : 'Hide voltage-group comparison'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    width: 14,
                    height: 14,
                    flexShrink: 0,
                    transition: 'transform 0.2s',
                    transform: matrixCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    color: 'var(--muted)',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Voltage-group comparison</p>
                  <p className="text-xs text-[var(--muted)]">
                    {limitProfile?.sourceLabel || 'IEC 60422:2024'} limits for the active test basis.
                  </p>
                </div>
              </button>
            </AppTooltip>

            {!matrixCollapsed && (
              <div className="overflow-x-auto border-t border-[color:var(--border)] px-4 pb-4 pt-3">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] text-left">
                      <th className="px-3 py-2 font-semibold text-[var(--foreground)]">Parameter</th>
                      {Object.values(voltageGroups).map((group) => (
                        <th key={group.key} className="px-3 py-2 font-semibold text-[var(--foreground)]">
                          {group.shortLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixMetricKeys.map((metricKey) => (
                      <tr key={metricKey} className="border-t border-[color:var(--border)] align-top">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-[var(--foreground)]">
                            {voltageGroups.medium.limits[metricKey].label}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {voltageGroups.medium.limits[metricKey].unit || voltageGroups.medium.limits[metricKey].testBasis}
                          </p>
                        </td>
                        {Object.values(voltageGroups).map((group) => (
                          <td key={`${group.key}-${metricKey}`} className="px-3 py-3">
                            {group.limits[metricKey] ? <ThresholdCell limit={group.limits[metricKey]} /> : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        <p className="text-xs text-[var(--muted)]">
          Disclaimer: Limits follow {selectedStandardLabel} for the selected oil and test type. Data is
          synced from the certificate; verify it against the signed original with TNB Labs.
        </p>
      </CardContent>
    </Card>
  );
}

export default Iec60422Panel;
