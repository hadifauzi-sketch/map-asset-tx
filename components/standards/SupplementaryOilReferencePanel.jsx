import React from 'react';
import { AlertTriangle, BookOpenText, CheckCircle2, Info } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  formatSupplementaryValue,
  getSupplementaryActionRangeLabel,
  getSupplementaryHealthyRangeLabel,
  getSupplementaryMonitorRangeLabel,
  getSupplementaryOilAssessment,
} from '../../lib/standards/supplementaryOilReferences';

const STATUS_ICONS = {
  healthy: CheckCircle2,
  monitor: AlertTriangle,
  action: AlertTriangle,
  noData: Info,
};

const SUMMARY_TILES = [
  { key: 'healthy', label: 'Healthy', variant: 'success' },
  { key: 'monitor', label: 'Monitor', variant: 'warning' },
  { key: 'action', label: 'Action', variant: 'danger' },
  { key: 'noData', label: 'No data', variant: 'secondary' },
];

function appendUnit(label, reference) {
  if (!label || label === '-' || label === 'Not used') {
    return label || '-';
  }
  return reference?.unit ? `${label} ${reference.unit}` : label;
}

function formatLatestValue(item) {
  if (item.value === null || item.value === undefined || item.value === '') {
    return '-';
  }

  const formatted = formatSupplementaryValue(item.value, item.reference);
  return item.reference?.unit ? `${formatted} ${item.reference.unit}` : formatted;
}

function SupplementaryOilReferencePanel({
  assessment,
  sample,
  title = 'Supplementary diagnostic references',
  description = 'Extra operating references for parameters not covered by the IEC voltage-group table.',
  className = '',
}) {
  const resolvedAssessment = assessment || getSupplementaryOilAssessment(sample);

  if (!resolvedAssessment || !resolvedAssessment.items?.length) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4 text-[var(--primary-strong)]" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SUMMARY_TILES.map((tile) => (
            <div
              key={tile.key}
              className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {tile.label}
                </p>
                <Badge variant={tile.variant}>{resolvedAssessment.summary[tile.key]}</Badge>
              </div>
              <p className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                {resolvedAssessment.summary[tile.key]}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-md border border-[color:var(--border)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[var(--card-muted)] text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Parameter</th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Latest</th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Healthy</th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Monitor</th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Action</th>
                </tr>
              </thead>
              <tbody>
                {resolvedAssessment.items.map((item) => {
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
                            {formatLatestValue(item)}
                          </span>
                          <Badge variant={item.badgeVariant}>
                            <Icon className="h-3.5 w-3.5" />
                            {item.statusLabel}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {appendUnit(getSupplementaryHealthyRangeLabel(item.reference), item.reference)}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {appendUnit(getSupplementaryMonitorRangeLabel(item.reference), item.reference)}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {appendUnit(getSupplementaryActionRangeLabel(item.reference), item.reference)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SupplementaryOilReferencePanel;
