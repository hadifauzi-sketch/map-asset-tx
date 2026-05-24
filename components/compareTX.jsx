import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Beaker,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Gauge,
  GitCompareArrows,
  Hash,
  MapPin,
  MinusCircle,
  XCircle,
  Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { analyzeSample } from '../lib/dga/diagnostics';
import { getStandardLabelForOilType, getStandardOptionsForOilType } from '../lib/dga/appConfig';
import {
  getOilQualityAssessment,
  getOilQualitySupplementaryAssessment,
} from '../lib/standards/oilQualityAssessment';
import { getAssetOwnerLabel } from '../lib/assetOwner';
import { getTransformerState } from '../lib/malaysiaStates';

const DGA_GASES = [
  { key: 'h2', label: 'H2', name: 'Hydrogen' },
  { key: 'ch4', label: 'CH4', name: 'Methane' },
  { key: 'c2h6', label: 'C2H6', name: 'Ethane' },
  { key: 'c2h4', label: 'C2H4', name: 'Ethylene' },
  { key: 'c2h2', label: 'C2H2', name: 'Acetylene' },
  { key: 'co', label: 'CO', name: 'Carbon monoxide' },
  { key: 'co2', label: 'CO2', name: 'Carbon dioxide' },
];

const OIL_METRICS = [
  { key: 'breakdown', label: 'BDV', unit: 'kV' },
  { key: 'waterContent', label: 'Moisture', unit: 'ppm' },
  { key: 'acidity', label: 'Acidity', unit: 'mg KOH/g' },
  { key: 'interfacialTension', label: 'IFT', unit: 'mN/m' },
  { key: 'powerFactor', label: 'Tan delta', unit: '' },
  { key: 'color', label: 'Color', unit: '' },
  { key: 'inhibitor', label: 'Inhibitor', unit: '%' },
  { key: 'dbds', label: 'DBDS', unit: 'mg/kg' },
  { key: 'passivator', label: 'Passivator', unit: 'mg/kg' },
  { key: 'copperCorrosive', label: 'Copper corrosion', unit: '' },
  { key: 'fal2', label: '2-FAL', unit: 'ppb' },
  { key: 'methanol', label: 'Methanol', unit: 'ppm' },
  { key: 'estimatedDpFuran', label: 'DP from furan', unit: '' },
  { key: 'estimatedDpMethanol', label: 'DP from methanol', unit: '' },
];

const STATUS_STYLES = {
  healthy: {
    label: 'Normal',
    badge: 'success',
    icon: CheckCircle2,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300',
  },
  monitor: {
    label: 'Watch',
    badge: 'warning',
    icon: AlertTriangle,
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-300',
  },
  action: {
    label: 'Action',
    badge: 'danger',
    icon: XCircle,
    className:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300',
  },
  noData: {
    label: 'No data',
    badge: 'secondary',
    icon: MinusCircle,
    className:
      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/45 dark:text-slate-300',
  },
};

function normalizeStatus(status) {
  if (status === 'no-data' || status === 'insufficient-data') {
    return 'noData';
  }

  return STATUS_STYLES[status] ? status : 'noData';
}

function statusWeight(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'action') return 3;
  if (normalized === 'monitor') return 2;
  if (normalized === 'healthy') return 1;
  return 0;
}

function formatValue(value, fallback = '-') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, digits = 1) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return '-';
  }

  if (Math.abs(numeric) >= 100) {
    return numeric.toFixed(0);
  }

  if (Math.abs(numeric) >= 10) {
    return numeric.toFixed(1).replace(/\.0$/, '');
  }

  return numeric.toFixed(digits).replace(/\.0+$/, '');
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getLatestOilTestRecord(oilTests = []) {
  if (!Array.isArray(oilTests) || oilTests.length === 0) {
    return null;
  }

  return [...oilTests]
    .filter((test) => test)
    .sort((left, right) => new Date(right.testDate || 0) - new Date(left.testDate || 0))[0] || null;
}

function getTransformerAgeAtSample(yearBuilt, sampleDate) {
  const builtYear = Number.parseInt(yearBuilt, 10);
  if (!Number.isFinite(builtYear)) {
    return '';
  }

  const sampledYear = sampleDate ? new Date(sampleDate).getFullYear() : new Date().getFullYear();
  if (!Number.isFinite(sampledYear) || sampledYear < builtYear) {
    return '';
  }

  return sampledYear - builtYear;
}

function resolveTransformerDgaPreferences(transformer) {
  const oilType = transformer?.oilType || 'mineral';
  const options = getStandardOptionsForOilType(oilType);
  const candidate = transformer?.gasLimitStandard;
  const gasLimitStandard = options.some((option) => option.value === candidate)
    ? candidate
    : options[0]?.value || 'IEC';

  return { oilType, gasLimitStandard };
}

function classifyGasLimit(value, limit) {
  if (!Number.isFinite(value)) {
    return 'noData';
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return 'healthy';
  }

  if (value > limit) {
    return 'action';
  }

  if (value >= limit * 0.8) {
    return 'monitor';
  }

  return 'healthy';
}

function buildDgaAssessment(asset, latestTest) {
  if (!latestTest) {
    return {
      status: 'noData',
      standardLabel: 'DGA limits',
      primaryFault: null,
      gasRows: DGA_GASES.map((gas) => ({ ...gas, value: null, limit: null, status: 'noData' })),
    };
  }

  const sampleDate = latestTest.testDate || new Date().toISOString().slice(0, 10);
  const { oilType, gasLimitStandard } = resolveTransformerDgaPreferences(asset);

  try {
    const analysis = analyzeSample(
      {
        date: sampleDate,
        h2: latestTest.h2,
        ch4: latestTest.ch4,
        c2h6: latestTest.c2h6,
        c2h4: latestTest.c2h4,
        c2h2: latestTest.c2h2,
        co: latestTest.co,
        co2: latestTest.co2,
        o2: latestTest.o2,
        n2: latestTest.n2,
        transformerAge: getTransformerAgeAtSample(asset?.yearBuilt, sampleDate),
      },
      gasLimitStandard,
      oilType
    );

    let status = 'healthy';
    const gasRows = DGA_GASES.map((gas) => {
      const detail = analysis?.gasLimitDetails?.[gas.key];
      const value = toNumber(detail?.value ?? latestTest[gas.key]);
      const limit = toNumber(detail?.activeLimit);
      const gasStatus = classifyGasLimit(value, limit);
      status = statusWeight(gasStatus) > statusWeight(status) ? gasStatus : status;

      return {
        ...gas,
        value,
        limit,
        status: gasStatus,
      };
    });

    if (gasRows.every((gas) => gas.status === 'noData')) {
      status = 'noData';
    }

    return {
      status,
      standardLabel: getStandardLabelForOilType(gasLimitStandard, oilType),
      primaryFault: analysis?.primaryFault || null,
      gasRows,
    };
  } catch (error) {
    console.error('Compare TX: failed to evaluate DGA limits', error);
    return {
      status: 'noData',
      standardLabel: 'DGA limits unavailable',
      primaryFault: null,
      gasRows: DGA_GASES.map((gas) => ({ ...gas, value: toNumber(latestTest[gas.key]), limit: null, status: 'noData' })),
    };
  }
}

function buildOilAssessment(asset, latestTest) {
  if (!latestTest) {
    return {
      status: 'noData',
      standardLabel: 'Oil quality',
      metrics: {},
      priorityItems: [],
      summary: { healthy: 0, monitor: 0, action: 0, noData: 0 },
    };
  }

  try {
    const mainAssessment = getOilQualityAssessment(latestTest, asset);
    const supplementaryAssessment = getOilQualitySupplementaryAssessment(latestTest);
    const items = [
      ...(mainAssessment?.items || []),
      ...(supplementaryAssessment?.items || []),
    ];
    const metrics = items.reduce((accumulator, item) => {
      if (item?.key) {
        accumulator[item.key] = item;
      }
      return accumulator;
    }, {});
    const summary = items.reduce(
      (accumulator, item) => {
        const normalized = normalizeStatus(item?.status);
        if (normalized === 'healthy') accumulator.healthy += 1;
        if (normalized === 'monitor') accumulator.monitor += 1;
        if (normalized === 'action') accumulator.action += 1;
        if (normalized === 'noData') accumulator.noData += 1;
        return accumulator;
      },
      { healthy: 0, monitor: 0, action: 0, noData: 0 }
    );
    const status = summary.action > 0
      ? 'action'
      : summary.monitor > 0
        ? 'monitor'
        : summary.healthy > 0
          ? 'healthy'
          : 'noData';
    const priorityItems = items
      .filter((item) => ['action', 'monitor'].includes(normalizeStatus(item?.status)))
      .sort((left, right) => statusWeight(right.status) - statusWeight(left.status))
      .slice(0, 3);

    return {
      status,
      standardLabel: [
        mainAssessment?.standard?.label,
        mainAssessment?.limitProfile?.shortLabel,
        mainAssessment?.profile?.shortLabel,
      ].filter(Boolean).join(' - ') || 'Oil quality',
      metrics,
      priorityItems,
      summary,
    };
  } catch (error) {
    console.error('Compare TX: failed to evaluate oil quality', error);
    return {
      status: 'noData',
      standardLabel: 'Oil quality unavailable',
      metrics: {},
      priorityItems: [],
      summary: { healthy: 0, monitor: 0, action: 0, noData: 0 },
    };
  }
}

function buildCompareRecords(assets) {
  return assets.map((asset) => {
    const latestTest = getLatestOilTestRecord(asset?.oilTests);
    const dga = buildDgaAssessment(asset, latestTest);
    const oil = buildOilAssessment(asset, latestTest);

    return {
      asset,
      latestTest,
      dga,
      oil,
      overallStatus: statusWeight(dga.status) > statusWeight(oil.status) ? dga.status : oil.status,
    };
  });
}

function StatusBadge({ status, label }) {
  const normalized = normalizeStatus(status);
  const style = STATUS_STYLES[normalized];

  return (
    <Badge variant={style.badge} className="whitespace-nowrap">
      {label || style.label}
    </Badge>
  );
}

function StatusPanel({ status, label, value }) {
  const normalized = normalizeStatus(status);
  const style = STATUS_STYLES[normalized];
  const Icon = style.icon;
  const displayValue = value === null || value === undefined || value === '' ? style.label : value;

  return (
    <div className={`rounded-md border px-3 py-2 ${style.className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-base font-bold leading-none">{displayValue}</div>
    </div>
  );
}

function MetricCell({ value, unit, status, helper }) {
  const normalized = normalizeStatus(status);
  const style = STATUS_STYLES[normalized];

  return (
    <div className={`min-w-[132px] rounded-md border px-2.5 py-2 ${style.className}`}>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold">{value}</span>
        {unit ? <span className="text-[10px] font-medium opacity-75">{unit}</span> : null}
      </div>
      {helper ? <div className="mt-1 text-[10px] leading-4 opacity-80">{helper}</div> : null}
    </div>
  );
}

function getMetricStatus(record, metricKey) {
  return normalizeStatus(record.oil.metrics?.[metricKey]?.status);
}

function getOilMetricHelper(record, metricKey) {
  const assessment = record.oil.metrics?.[metricKey];
  if (!assessment) {
    return null;
  }

  if (assessment.statusLabel) {
    return assessment.statusLabel;
  }

  return null;
}

function getOilMetricValue(record, metric) {
  const value = record.latestTest?.[metric.key];
  if (!hasValue(value)) {
    return '-';
  }

  if (metric.key === 'copperCorrosive') {
    return formatValue(value);
  }

  if (metric.key === 'color') {
    return formatValue(value);
  }

  return formatNumber(value);
}

function CompareTX({ open, assets = [], groupTitle = 'Selected transformers', groupSubtitle = '', onClose }) {
  const records = useMemo(() => buildCompareRecords(assets), [assets]);
  const summary = useMemo(() => {
    return records.reduce(
      (accumulator, record) => {
        const status = normalizeStatus(record.overallStatus);
        accumulator[status] += 1;
        return accumulator;
      },
      { healthy: 0, monitor: 0, action: 0, noData: 0 }
    );
  }, [records]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose?.() : null)}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1180px)] max-w-none overflow-hidden rounded-xl">
        <DialogHeader className="bg-[linear-gradient(135deg,var(--card)_0%,var(--card-muted)_100%)] pr-14">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="default" className="gap-1.5">
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  {records.length} selected
                </Badge>
                <Badge variant="outline">{groupTitle}</Badge>
              </div>
              <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <Zap className="h-5 w-5 text-[var(--primary)]" />
                Transformer Compare
              </DialogTitle>
              <DialogDescription className="mt-1">
                {groupSubtitle || 'Latest oil test and DGA assessment by selected transformer.'}
              </DialogDescription>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[420px]">
              <StatusPanel status="action" label="Action" value={summary.action} />
              <StatusPanel status="monitor" label="Watch" value={summary.monitor} />
              <StatusPanel status="healthy" label="Normal" value={summary.healthy} />
              <StatusPanel status="noData" label="No data" value={summary.noData} />
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)]/45 p-3 sm:p-4">
          {records.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card)] p-8 text-center">
              <GitCompareArrows className="h-8 w-8 text-[var(--muted)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">No transformer selected</p>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {records.map((record) => {
                  const asset = record.asset;
                  const latestDate = formatDate(record.latestTest?.testDate);

                  return (
                    <article
                      key={asset.id}
                      className="rounded-md border border-[color:var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-[var(--foreground)]">
                            {asset.txName || asset.mnemonic || 'Unnamed transformer'}
                          </h3>
                          <p className="mt-1 truncate text-xs text-[var(--muted)]">
                            {asset.siteName || groupTitle || 'Unknown site'}
                          </p>
                        </div>
                        <StatusBadge status={record.overallStatus} />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-[var(--card-muted)] px-2.5 py-2">
                          <div className="flex items-center gap-1.5 text-[var(--muted)]">
                            <Calendar className="h-3.5 w-3.5" />
                            Latest sample
                          </div>
                          <div className="mt-1 font-semibold text-[var(--foreground)]">{latestDate}</div>
                        </div>
                        <div className="rounded-md bg-[var(--card-muted)] px-2.5 py-2">
                          <div className="flex items-center gap-1.5 text-[var(--muted)]">
                            <ClipboardList className="h-3.5 w-3.5" />
                            Oil tests
                          </div>
                          <div className="mt-1 font-semibold text-[var(--foreground)]">
                            {asset.oilTests?.length || 0}
                          </div>
                        </div>
                        <div className="rounded-md bg-[var(--card-muted)] px-2.5 py-2">
                          <div className="flex items-center gap-1.5 text-[var(--muted)]">
                            <Gauge className="h-3.5 w-3.5" />
                            Voltage
                          </div>
                          <div className="mt-1 truncate font-semibold text-[var(--foreground)]">
                            {formatValue(asset.voltage, 'N/A')}
                          </div>
                        </div>
                        <div className="rounded-md bg-[var(--card-muted)] px-2.5 py-2">
                          <div className="flex items-center gap-1.5 text-[var(--muted)]">
                            <MapPin className="h-3.5 w-3.5" />
                            State
                          </div>
                          <div className="mt-1 truncate font-semibold text-[var(--foreground)]">
                            {getTransformerState(asset) || 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <StatusPanel status={record.oil.status} label="Oil" value={STATUS_STYLES[normalizeStatus(record.oil.status)].label} />
                        <StatusPanel status={record.dga.status} label="DGA" value={STATUS_STYLES[normalizeStatus(record.dga.status)].label} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="gap-1">
                          <Hash className="h-3 w-3" />
                          {formatValue(asset.mnemonic)}
                        </Badge>
                        <Badge variant="secondary">{getAssetOwnerLabel(asset.ownerType)}</Badge>
                        {record.dga.primaryFault ? (
                          <Badge variant="outline">{record.dga.primaryFault.code}: {record.dga.primaryFault.label}</Badge>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </section>

              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-3 py-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
                      <Activity className="h-4 w-4 text-[var(--primary)]" />
                      DGA Test Compare
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">Latest sample checked against each transformer active DGA standard.</p>
                  </div>
                </div>

                <div className="overflow-x-auto p-3">
                  <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 w-[190px] bg-[var(--card)] px-2 py-2 font-semibold text-[var(--muted)]">
                          Gas
                        </th>
                        {records.map((record) => (
                          <th key={record.asset.id} className="min-w-[160px] px-2 py-2 font-semibold text-[var(--foreground)]">
                            <div className="truncate">{record.asset.txName || record.asset.mnemonic || 'Transformer'}</div>
                            <div className="mt-1 truncate text-[10px] font-normal text-[var(--muted)]">{record.dga.standardLabel}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DGA_GASES.map((gas) => (
                        <tr key={gas.key}>
                          <td className="sticky left-0 z-10 border-t border-[color:var(--border)] bg-[var(--card)] px-2 py-2">
                            <div className="font-semibold text-[var(--foreground)]">{gas.label}</div>
                            <div className="text-[10px] text-[var(--muted)]">{gas.name}</div>
                          </td>
                          {records.map((record) => {
                            const row = record.dga.gasRows.find((item) => item.key === gas.key);
                            return (
                              <td key={`${record.asset.id}-${gas.key}`} className="border-t border-[color:var(--border)] px-2 py-2">
                                <MetricCell
                                  value={formatNumber(row?.value)}
                                  unit="ppm"
                                  status={row?.status}
                                  helper={row?.limit ? `Limit ${formatNumber(row.limit)} ppm` : null}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-3 py-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
                      <Beaker className="h-4 w-4 text-[var(--primary)]" />
                      Oil Test Compare
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">Latest oil condition values with the active oil quality assessment status.</p>
                  </div>
                </div>

                <div className="overflow-x-auto p-3">
                  <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 w-[190px] bg-[var(--card)] px-2 py-2 font-semibold text-[var(--muted)]">
                          Parameter
                        </th>
                        {records.map((record) => (
                          <th key={record.asset.id} className="min-w-[160px] px-2 py-2 font-semibold text-[var(--foreground)]">
                            <div className="truncate">{record.asset.txName || record.asset.mnemonic || 'Transformer'}</div>
                            <div className="mt-1 truncate text-[10px] font-normal text-[var(--muted)]">{record.oil.standardLabel}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {OIL_METRICS.map((metric) => (
                        <tr key={metric.key}>
                          <td className="sticky left-0 z-10 border-t border-[color:var(--border)] bg-[var(--card)] px-2 py-2">
                            <div className="font-semibold text-[var(--foreground)]">{metric.label}</div>
                            {metric.unit ? <div className="text-[10px] text-[var(--muted)]">{metric.unit}</div> : null}
                          </td>
                          {records.map((record) => (
                            <td key={`${record.asset.id}-${metric.key}`} className="border-t border-[color:var(--border)] px-2 py-2">
                              <MetricCell
                                value={getOilMetricValue(record, metric)}
                                unit={metric.unit}
                                status={getMetricStatus(record, metric.key)}
                                helper={getOilMetricHelper(record, metric.key)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-card)]">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
                  <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
                  Priority Findings
                </h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {records.map((record) => (
                    <div key={record.asset.id} className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)]/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {record.asset.txName || record.asset.mnemonic || 'Transformer'}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted)]">{formatDate(record.latestTest?.testDate)}</div>
                        </div>
                        <StatusBadge status={record.overallStatus} />
                      </div>

                      <div className="mt-3 space-y-2 text-xs">
                        {record.dga.primaryFault ? (
                          <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2.5 py-2">
                            <div className="font-semibold text-[var(--foreground)]">{record.dga.primaryFault.code}: {record.dga.primaryFault.label}</div>
                            <div className="mt-1 text-[var(--muted)]">{record.dga.primaryFault.source}</div>
                          </div>
                        ) : null}

                        {record.oil.priorityItems.length ? (
                          record.oil.priorityItems.map((item) => (
                            <div key={item.key} className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2.5 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-[var(--foreground)]">
                                  {item.limit?.shortLabel || item.limit?.label || item.key}
                                </span>
                                <StatusBadge status={item.status} label={item.statusLabel} />
                              </div>
                              <div className="mt-1 text-[var(--muted)]">
                                Value {formatValue(item.value)}{item.limit?.unit ? ` ${item.limit.unit}` : ''}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2.5 py-2 text-[var(--muted)]">
                            No oil quality watch item on the latest sample.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-[color:var(--border)] bg-[var(--card)] px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CompareTX;
