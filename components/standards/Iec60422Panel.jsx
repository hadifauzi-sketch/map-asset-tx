import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  ShieldCheck,
} from 'lucide-react';
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
        <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--primary-strong)]" />
              <p className="text-sm font-semibold text-[var(--foreground)]">Active transformer class</p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Voltage basis
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {voltageInput || 'Not set'}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Highest winding: {highestVoltageKv !== null ? `${formatVoltage(highestVoltageKv)} kV` : 'Not resolved'}
                </p>
              </div>

              <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  IEC group
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{profile.label}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{profile.description}</p>
              </div>

              <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Test basis
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                  {limitProfile?.label || 'Routine / in-service oil'}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {testType ? `${testType} - ` : ''}{limitProfile?.sourceLabel || 'IEC 60422:2024'}
                </p>
              </div>
            </div>

            {sampleDate ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Assessed sample date: {formatDate(sampleDate)}
              </p>
            ) : null}

            {usedFallback ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-[color:var(--border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning-strong)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  The app could not parse the transformer voltage, so it is using the 72.5-170 kV profile until a rated voltage is entered.
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            {SUMMARY_TILES.map((tile) => {
              const label = getSummaryTileLabel(tile, limitProfile);
              return (
              <div
                key={tile.key}
                className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {label}
                  </p>
                  <Badge variant={tile.variant}>{summary[tile.key]}</Badge>
                </div>
                <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{summary[tile.key]}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {tile.key === 'healthy' ? 'Within the active IEC basis' : null}
                  {tile.key === 'monitor' ? 'Between good and poor bands' : null}
                  {tile.key === 'action' ? 'Outside the active IEC basis' : null}
                  {tile.key === 'noData' ? 'No result captured yet' : null}
                </p>
              </div>
            );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-[color:var(--border)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[var(--card-muted)] text-left">
                <tr
                  className="cursor-pointer select-none hover:bg-[var(--card-hover,var(--card-muted))] transition-colors"
                  onClick={() => setTableCollapsed((c) => !c)}
                  title={tableCollapsed ? 'Show parameters' : 'Hide parameters'}
                >
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">
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
                          color: 'var(--muted)',
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      Parameter
                    </span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Latest</th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">{columnLabels.healthy}</th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">{columnLabels.monitor}</th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">{columnLabels.action}</th>
                </tr>
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
            <button
              type="button"
              className="flex w-full cursor-pointer select-none items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--card-hover,var(--card-muted))]"
              onClick={() => setMatrixCollapsed((c) => !c)}
              title={matrixCollapsed ? 'Show voltage-group comparison' : 'Hide voltage-group comparison'}
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

        <p className="text-xs text-[var(--muted)]">{standard.validationNote}</p>
      </CardContent>
    </Card>
  );
}

export default Iec60422Panel;
