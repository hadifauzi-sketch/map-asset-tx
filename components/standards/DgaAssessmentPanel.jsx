import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  OIL_OPTIONS,
  getStandardLabelForOilType,
  getStandardOptionsForOilType,
} from '../../lib/dga/appConfig';
import { analyzeSample, getGasLimitReferenceGuide } from '../../lib/dga/diagnostics';

const STATUS_ICONS = {
  healthy: CheckCircle2,
  monitor: AlertTriangle,
  action: AlertTriangle,
  reference: Info,
  noData: Info,
};

const SUMMARY_TILES = [
  { key: 'healthy', classKey: 'healthy', label: 'Healthy', variant: 'success' },
  { key: 'monitor', classKey: 'monitor', label: 'Monitor', variant: 'warning' },
  { key: 'action', classKey: 'action', label: 'Action', variant: 'danger' },
  { key: 'reference', classKey: 'noData', label: 'Reference / no data', variant: 'secondary' },
];

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function toNumberOrNull(value) {
  if (!hasValue(value)) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatNumber(value, maximumFractionDigits = 2) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '-';
  }

  const minimumFractionDigits = Number.isInteger(numericValue) ? 0 : Math.min(2, maximumFractionDigits);

  return numericValue.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

function formatValueWithUnit(value, unit = 'ppm') {
  const numericValue = toNumberOrNull(value);
  if (numericValue === null) {
    return '-';
  }

  return `${formatNumber(numericValue)} ${unit}`;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return parsedDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getOilTypeLabel(oilType) {
  return OIL_OPTIONS.find((option) => option.value === oilType)?.label || 'Mineral oil';
}

function resolveTransformerDgaPreferences(transformer) {
  const oilType = transformer?.oilType || 'mineral';
  const standardOptions = getStandardOptionsForOilType(oilType);
  const gasLimitStandard = standardOptions.some((option) => option.value === transformer?.gasLimitStandard)
    ? transformer.gasLimitStandard
    : standardOptions[0]?.value ?? 'IEEE_2019';

  return { oilType, gasLimitStandard };
}

function getTransformerAgeAtSample(yearBuilt, sampleDate) {
  const builtYear = Number.parseInt(yearBuilt, 10);
  const sampleYear = Number.parseInt(String(sampleDate || '').slice(0, 4), 10);
  if (!Number.isFinite(builtYear) || !Number.isFinite(sampleYear)) {
    return '';
  }

  return String(Math.max(0, sampleYear - builtYear));
}

function getReferenceGuide(standard, oilType) {
  const guide = getGasLimitReferenceGuide();

  if (oilType !== 'mineral') {
    return guide.ieeeC57155;
  }

  if (standard === 'IEC') {
    return guide.iec60599_2022;
  }

  if (standard === 'IEEE_2008') {
    return guide.ieeeC57104_2008;
  }

  return guide.ieeeC57104_2019;
}

function getRowStatus(detail) {
  const numericValue = toNumberOrNull(detail?.value);
  const activeLimit = toNumberOrNull(detail?.activeLimit);
  const hasStandaloneLimit = Boolean(detail?.supported) && activeLimit !== null;

  if (numericValue === null) {
    return 'noData';
  }

  if (!hasStandaloneLimit) {
    return 'reference';
  }

  if (activeLimit <= 0) {
    return numericValue > 0 ? 'action' : 'healthy';
  }

  if (numericValue > activeLimit) {
    return 'action';
  }

  if (numericValue >= activeLimit * 0.8) {
    return 'monitor';
  }

  return 'healthy';
}

function getStatusLabel(status) {
  if (status === 'healthy') return 'Healthy';
  if (status === 'monitor') return 'Monitor';
  if (status === 'action') return 'Action';
  if (status === 'reference') return 'Reference';
  return 'No data';
}

function getStatusVariant(status) {
  if (status === 'healthy') return 'success';
  if (status === 'monitor') return 'warning';
  if (status === 'action') return 'danger';
  return 'secondary';
}

function buildReferenceLines(detail) {
  const lines = [
    detail?.source || null,
    detail?.ageBandLabel ? `Age band: ${detail.ageBandLabel}` : null,
    detail?.branchLabel ? `Branch: ${detail.branchLabel}` : null,
    Number.isFinite(detail?.ratio) ? `O2/N2 ratio: ${formatNumber(detail.ratio, 3)}` : null,
    detail?.note || null,
    detail?.message || null,
  ].filter(Boolean);

  return [...new Set(lines)];
}

function getSummaryDescription(key) {
  if (key === 'healthy') return 'Comfortably below active limit';
  if (key === 'monitor') return 'At least 80% of active limit';
  if (key === 'action') return 'Above active limit';
  return 'Reference-only row or missing reading';
}

function DgaAssessmentPanel({
  sample,
  transformer,
  title = 'DGA result assessment',
  description = 'Each DGA gas is checked against the transformer active DGA limit standard, with the source and limit basis shown beside the result.',
  className = '',
}) {
  const [tableCollapsed, setTableCollapsed] = useState(true);

  const panelData = useMemo(() => {
    try {
      const { oilType, gasLimitStandard } = resolveTransformerDgaPreferences(transformer);
      const sampleDate = sample?.testDate || sample?.date || '';
      const transformerAge = hasValue(sample?.transformerAge)
        ? sample.transformerAge
        : getTransformerAgeAtSample(transformer?.yearBuilt, sampleDate);
      const guide = getGasLimitReferenceGuide();
      const selectedGuide = getReferenceGuide(gasLimitStandard, oilType);
      const standardLabel = getStandardLabelForOilType(gasLimitStandard, oilType);
      const oilTypeLabel = getOilTypeLabel(oilType);
      const analysis = analyzeSample(
        {
          ...sample,
          date: sampleDate,
          transformerAge,
        },
        gasLimitStandard,
        oilType,
      );

      const contextDetail =
        analysis?.gasLimitDetails?.h2
        || analysis?.gasLimitDetails?.co
        || Object.values(analysis?.gasLimitDetails || {}).find(Boolean)
        || null;

      const rows = guide.gasColumns.map((gas) => {
        const detail = analysis?.gasLimitDetails?.[gas.key] || null;
        const status = getRowStatus(detail);
        const activeLimit = toNumberOrNull(detail?.activeLimit);
        const monitorLimit = activeLimit !== null ? activeLimit * 0.8 : null;
        const hasStandaloneLimit = Boolean(detail?.supported) && activeLimit !== null;

        return {
          ...gas,
          detail,
          status,
          statusLabel: getStatusLabel(status),
          badgeVariant: getStatusVariant(status),
          latestLabel: formatValueWithUnit(detail?.value, gas.unit),
          healthyLabel: hasStandaloneLimit ? `<= ${formatValueWithUnit(activeLimit, gas.unit)}` : 'Not used',
          monitorLabel: hasStandaloneLimit
            ? `>= ${formatValueWithUnit(monitorLimit, gas.unit)} to <= ${formatValueWithUnit(activeLimit, gas.unit)}`
            : 'Not used',
          actionLabel: hasStandaloneLimit ? `> ${formatValueWithUnit(activeLimit, gas.unit)}` : 'Not used',
          referenceLines: buildReferenceLines(detail),
        };
      });

      const summary = rows.reduce(
        (result, row) => {
          if (row.status === 'healthy') result.healthy += 1;
          else if (row.status === 'monitor') result.monitor += 1;
          else if (row.status === 'action') result.action += 1;
          else result.reference += 1;
          return result;
        },
        { healthy: 0, monitor: 0, action: 0, reference: 0 },
      );

      return {
        analysis,
        contextDetail,
        oilType,
        oilTypeLabel,
        gasLimitStandard,
        guide,
        selectedGuide,
        standardLabel,
        sampleDate,
        transformerAge,
        rows,
        summary,
      };
    } catch (error) {
      console.error('Oil tests: failed to build DGA assessment panel', error);
      return { error };
    }
  }, [sample, transformer]);

  if (panelData.error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <ShieldCheck className='h-4 w-4 text-[var(--warning-strong)]' />
            {title}
          </CardTitle>
          <CardDescription>The DGA limit panel could not be generated for this sample.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const {
    oilTypeLabel,
    standardLabel,
    rows,
  } = panelData;

  return (
    <Card className={className}>
      <CardHeader className='space-y-3'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <ShieldCheck className='h-4 w-4 text-[var(--primary-strong)]' />
              {title}
            </CardTitle>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>{standardLabel}</Badge>
            <Badge variant='outline'>{oilTypeLabel}</Badge>
            <Badge variant='outline'>9 gas references</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='overflow-hidden rounded-md border border-[color:var(--border)]'>
          <div className='overflow-x-auto'>
            <table className='min-w-full border-collapse text-sm'>
              <thead className='text-left'>
                <tr
                  className={`iec-limits-toggle-row cursor-pointer select-none transition-colors ${
                    tableCollapsed ? 'is-collapsed' : 'is-expanded'
                  }`}
                  onClick={() => setTableCollapsed((collapsed) => !collapsed)}
                  title={tableCollapsed ? 'Show DGA gas limits' : 'Hide DGA gas limits'}
                  aria-expanded={!tableCollapsed}
                >
                  <th className='px-4 py-3 font-semibold'>
                    <span className='flex items-center gap-2'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        style={{
                          width: 14,
                          height: 14,
                          flexShrink: 0,
                          transition: 'transform 0.2s',
                          transform: tableCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        }}
                      >
                        <polyline points='6 9 12 15 18 9' />
                      </svg>
                      Parameter
                    </span>
                  </th>
                  <th className='px-4 py-3 font-semibold'>Latest</th>
                  <th className='px-4 py-3 font-semibold'>Healthy</th>
                  <th className='px-4 py-3 font-semibold'>Monitor</th>
                  <th className='px-4 py-3 font-semibold'>Action</th>
                  <th className='px-4 py-3 font-semibold'>Reference</th>
                </tr>
              </thead>
              {!tableCollapsed ? (
                <tbody>
                  {rows.map((row) => {
                    const Icon = STATUS_ICONS[row.status];

                    return (
                      <tr
                        key={row.key}
                        className='border-t border-[color:var(--border)] bg-[var(--card)] align-top'
                      >
                        <td className='px-4 py-3'>
                          <div>
                            <p className='font-semibold text-[var(--foreground)]'>
                              {row.name}
                              {' '}
                              <span className='text-xs font-normal text-[var(--muted)]'>({row.formula})</span>
                            </p>
                            <p className='text-xs text-[var(--muted)]'>{row.unit}</p>
                          </div>
                        </td>
                        <td className='px-4 py-3'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <span className='font-semibold text-[var(--foreground)]'>{row.latestLabel}</span>
                            <Badge variant={row.badgeVariant}>
                              <Icon className='h-3.5 w-3.5' />
                              {row.statusLabel}
                            </Badge>
                          </div>
                        </td>
                        <td className='px-4 py-3 text-[var(--muted)]'>{row.healthyLabel}</td>
                        <td className='px-4 py-3 text-[var(--muted)]'>{row.monitorLabel}</td>
                        <td className='px-4 py-3 text-[var(--muted)]'>{row.actionLabel}</td>
                        <td className='px-4 py-3 text-[var(--muted)]'>
                          <div className='space-y-1'>
                            {row.referenceLines.length > 0 ? (
                              row.referenceLines.map((line) => (
                                <p key={`${row.key}-${line}`}>{line}</p>
                              ))
                            ) : (
                              <p>-</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ) : null}
            </table>
          </div>
        </div>

        <div className='text-xs text-[var(--muted)]'>
          <p>
            Disclaimer: DGA limits are shown for reference against the stored sample and transformer preference. Always
            verify the signed original report before making maintenance decisions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default DgaAssessmentPanel;
