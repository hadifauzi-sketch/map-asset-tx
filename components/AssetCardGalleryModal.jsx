import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  ClipboardList,
  Eye,
  FileText,
  Gauge,
  Hash,
  MapPin,
  Pencil,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { analyzeSample } from '../lib/dga/diagnostics';
import { getStandardLabelForOilType, getStandardOptionsForOilType } from '../lib/dga/appConfig';
import { getTransformerState } from '../lib/malaysiaStates';

const DGA_CARD_GASES = [
  { key: 'h2', label: 'H2', name: 'Hydrogen' },
  { key: 'ch4', label: 'CH4', name: 'Methane' },
  { key: 'c2h6', label: 'C2H6', name: 'Ethane' },
  { key: 'c2h4', label: 'C2H4', name: 'Ethylene' },
  { key: 'c2h2', label: 'C2H2', name: 'Acetylene' },
];

const DGA_STATUS_STYLES = {
  healthy: {
    label: 'DGA Normal',
    shortLabel: 'Normal',
    badgeVariant: 'success',
    accent: '#16a34a',
    bg: 'rgba(22, 163, 74, 0.11)',
    border: 'rgba(22, 163, 74, 0.42)',
    text: '#15803d',
  },
  monitor: {
    label: 'DGA Watch',
    shortLabel: 'Watch',
    badgeVariant: 'warning',
    accent: '#eab308',
    bg: 'rgba(234, 179, 8, 0.13)',
    border: 'rgba(234, 179, 8, 0.45)',
    text: '#a16207',
  },
  action: {
    label: 'Limit Over',
    shortLabel: 'Over',
    badgeVariant: 'danger',
    accent: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.12)',
    border: 'rgba(220, 38, 38, 0.46)',
    text: '#b91c1c',
  },
  noData: {
    label: 'No DGA',
    shortLabel: 'No data',
    badgeVariant: 'secondary',
    accent: '#64748b',
    bg: 'rgba(100, 116, 139, 0.11)',
    border: 'rgba(100, 116, 139, 0.25)',
    text: '#64748b',
  },
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function formatValue(value, fallback = '-') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getDateTimestamp(value) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function getLatestOilTestRecord(oilTests = []) {
  if (!Array.isArray(oilTests) || oilTests.length === 0) {
    return null;
  }

  return [...oilTests].sort((left, right) => {
    const dateDiff = getDateTimestamp(right.testDate) - getDateTimestamp(left.testDate);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return getDateTimestamp(right.createdAt) - getDateTimestamp(left.createdAt);
  })[0] || null;
}

function formatPosition(position) {
  if (!Array.isArray(position) || position.length < 2) {
    return 'No map pin';
  }

  const latitude = Number(position[0]);
  const longitude = Number(position[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 'No map pin';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function sortAssets(assets) {
  return [...assets].sort((left, right) => {
    const nameDiff = String(left.txName || '').localeCompare(String(right.txName || ''));
    if (nameDiff !== 0) {
      return nameDiff;
    }

    const mnemonicDiff = String(left.mnemonic || '').localeCompare(String(right.mnemonic || ''));
    if (mnemonicDiff !== 0) {
      return mnemonicDiff;
    }

    return String(left.serialNumber || '').localeCompare(String(right.serialNumber || ''));
  });
}

function getTransformerAgeAtSample(yearBuilt, sampleDate) {
  const builtYear = Number.parseInt(yearBuilt, 10);
  const sampleYear = Number.parseInt(String(sampleDate || '').slice(0, 4), 10);
  if (!Number.isFinite(builtYear) || !Number.isFinite(sampleYear)) {
    return '';
  }

  return String(Math.max(0, sampleYear - builtYear));
}

function resolveTransformerDgaPreferences(transformer) {
  const oilType = transformer?.oilType || 'mineral';
  const standardOptions = getStandardOptionsForOilType(oilType);
  const gasLimitStandard = standardOptions.some((option) => option.value === transformer?.gasLimitStandard)
    ? transformer.gasLimitStandard
    : standardOptions[0]?.value ?? 'IEEE_2019';

  return { oilType, gasLimitStandard };
}

function toNumericGasValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(String(value).replace(/,/g, '.'));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatGasNumber(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '-';
  }

  if (Math.abs(numeric) >= 100) {
    return String(Math.round(numeric));
  }

  return String(Math.round(numeric * 10) / 10);
}

function classifyGasLimit(value, limit) {
  if (!Number.isFinite(value) || !Number.isFinite(limit)) {
    return 'noData';
  }

  if (limit <= 0) {
    return value > 0 ? 'action' : 'healthy';
  }

  if (value > limit) {
    return 'action';
  }

  if (value >= limit * 0.8) {
    return 'monitor';
  }

  return 'healthy';
}

function getMostSevereStatus(left, right) {
  const severity = { noData: 0, healthy: 1, monitor: 2, action: 3 };
  return severity[right] > severity[left] ? right : left;
}

function getAssetDgaStatus(asset) {
  const latestTest = getLatestOilTestRecord(asset?.oilTests);
  if (!latestTest) {
    return {
      status: 'noData',
      latestTest: null,
      standardLabel: 'DGA limits',
      gasRows: DGA_CARD_GASES.map((gas) => ({ ...gas, status: 'noData', value: null, limit: null, ratio: null })),
      exceededCount: 0,
      watchCount: 0,
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
    const gasRows = DGA_CARD_GASES.map((gas) => {
      const detail = analysis?.gasLimitDetails?.[gas.key];
      const value = toNumericGasValue(detail?.value ?? latestTest[gas.key]);
      const limit = toNumericGasValue(detail?.activeLimit);
      const gasStatus = classifyGasLimit(value, limit);
      const ratio = Number.isFinite(value) && Number.isFinite(limit) && limit > 0 ? value / limit : null;

      status = getMostSevereStatus(status, gasStatus);

      return {
        ...gas,
        value,
        limit,
        ratio,
        status: gasStatus,
      };
    });

    const resolvedStatus = gasRows.every((gas) => gas.status === 'noData') ? 'noData' : status;

    return {
      status: resolvedStatus,
      latestTest,
      standardLabel: getStandardLabelForOilType(gasLimitStandard, oilType),
      gasRows,
      exceededCount: gasRows.filter((gas) => gas.status === 'action').length,
      watchCount: gasRows.filter((gas) => gas.status === 'monitor').length,
    };
  } catch (error) {
    console.error('Asset cards: failed to evaluate DGA gas limits', error);
    return {
      status: 'noData',
      latestTest,
      standardLabel: 'DGA limits unavailable',
      gasRows: DGA_CARD_GASES.map((gas) => ({ ...gas, status: 'noData', value: null, limit: null, ratio: null })),
      exceededCount: 0,
      watchCount: 0,
    };
  }
}

function matchesAsset(asset, query) {
  if (!query) {
    return true;
  }

  return [
    asset.txName,
    asset.siteName,
    asset.mnemonic,
    asset.serialNumber,
    asset.voltage,
    asset.loadMVA,
    asset.maker,
    getTransformerState(asset),
  ]
    .filter(Boolean)
    .some((value) => normalizeText(value).includes(query));
}

function getSummaryStats(assets) {
  const oilTestCount = assets.reduce((sum, asset) => sum + (asset.oilTests?.length || 0), 0);
  const documentCount = assets.reduce((sum, asset) => sum + (asset.documents?.length || 0), 0);
  const pinnedCount = assets.filter((asset) => Array.isArray(asset.position) && asset.position.length >= 2).length;
  const voltageCount = new Set(assets.map((asset) => normalizeText(asset.voltage)).filter(Boolean)).size;

  return [
    { label: 'Transformers', value: assets.length, icon: Zap },
    { label: 'Oil tests', value: oilTestCount, icon: ClipboardList },
    { label: 'Documents', value: documentCount, icon: FileText },
    { label: 'Voltage groups', value: voltageCount, icon: Gauge },
    { label: 'Map pins', value: pinnedCount, icon: MapPin },
  ];
}

function AssetCardGalleryModal({
  open,
  group,
  selectedAssetId,
  canManageAssets = true,
  onClose,
  onFocusAsset,
  onViewDetails,
  onEditAsset,
  onDeleteAsset,
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setQuery('');
    }
  }, [open, group?.title]);

  const assets = useMemo(() => sortAssets(group?.assets || []), [group]);
  const filteredAssets = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return assets.filter((asset) => matchesAsset(asset, normalizedQuery));
  }, [assets, query]);
  const summaryStats = useMemo(() => getSummaryStats(assets), [assets]);

  const groupTitle = group?.title || 'Asset group';
  const groupType = group?.typeLabel || 'Asset group';
  const groupSubtitle = group?.subtitle || 'Transformer assets';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose?.() : null)}>
      <DialogContent
        className="mobile-fullscreen-dialog !fixed !inset-0 flex !h-screen !max-h-none !w-screen !max-w-none flex-col gap-0 overflow-hidden !rounded-none border-0 p-0 sm:!rounded-none"
        aria-describedby={undefined}
      >
        <DialogHeader className="relative overflow-hidden border-b-0 px-0 py-0">
          <div className="relative bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.22),transparent_34%),linear-gradient(135deg,var(--card)_0%,var(--card-muted)_100%)] px-4 py-5 sm:px-6 sm:py-6">
            <div className="absolute right-8 top-6 hidden h-28 w-28 rounded-full border border-[color:var(--border)]/60 bg-[var(--card)]/30 blur-[1px] sm:block" />
            <div className="relative flex flex-col gap-4 pr-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="uppercase tracking-[0.14em]">
                    {groupType}
                  </Badge>
                  <Badge variant="outline">{assets.length} asset{assets.length === 1 ? '' : 's'}</Badge>
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {groupTitle}
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  {groupSubtitle}
                </DialogDescription>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                {summaryStats.slice(0, 3).map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-[color:var(--border)] bg-[var(--card)]/72 px-3 py-2 shadow-sm backdrop-blur"
                    >
                      <div className="flex items-center gap-2 text-[var(--muted)]">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{stat.label}</span>
                      </div>
                      <p className="mt-1 text-lg font-bold leading-none text-[var(--foreground)]">{stat.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="border-y border-[color:var(--border)] bg-[var(--card)]/82 px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {summaryStats.slice(3).map((stat) => {
                const Icon = stat.icon;
                return (
                  <Badge key={stat.label} variant="secondary" className="gap-1.5 px-2.5 py-1">
                    <Icon className="h-3.5 w-3.5" />
                    {stat.value} {stat.label.toLowerCase()}
                  </Badge>
                );
              })}
            </div>

            <label className="relative w-full lg:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search transformer, serial, voltage..."
                className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[var(--card-muted)] pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/35"
              />
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)]/35 px-3 py-3 sm:px-4">
          {assets.length === 0 ? (
            <EmptyAssetState title="No transformer assets are assigned here yet." />
          ) : filteredAssets.length === 0 ? (
            <EmptyAssetState title={`No asset cards match "${query}".`} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {filteredAssets.map((asset) => (
                <TransformerAssetCard
                  key={asset.id}
                  asset={asset}
                  selected={String(selectedAssetId ?? '') === String(asset.id)}
                  canManageAssets={canManageAssets}
                  onFocus={() => onFocusAsset?.(asset)}
                  onViewDetails={() => onViewDetails?.(asset)}
                  onEdit={() => onEditAsset?.(asset)}
                  onDelete={() => onDeleteAsset?.(asset.id)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyAssetState({ title }) {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <div className="max-w-sm rounded-2xl border border-dashed border-[color:var(--border)] bg-[var(--card)] px-6 py-8 text-center shadow-sm">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--card-muted)] text-[var(--muted)]">
          <Zap className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Try another sidebar group or clear the search keyword.</p>
      </div>
    </div>
  );
}

function DgaLimitPanel({ dgaStatus }) {
  const statusStyle = DGA_STATUS_STYLES[dgaStatus.status] || DGA_STATUS_STYLES.noData;
  const primaryText =
    dgaStatus.status === 'action'
      ? `${dgaStatus.exceededCount} gas over limit`
      : dgaStatus.status === 'monitor'
        ? `${dgaStatus.watchCount} gas near limit`
        : dgaStatus.status === 'healthy'
          ? 'All five gases within limit'
          : 'No latest DGA result';

  return (
    <section
      className="mt-2 rounded-xl border p-2"
      style={{
        background: statusStyle.bg,
        borderColor: statusStyle.border,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: statusStyle.text }}>
            DGA Result
          </p>
          <p className="mt-0.5 text-xs font-bold text-[var(--foreground)]">{primaryText}</p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{dgaStatus.standardLabel}</p>
        </div>
        <div className="relative h-9 w-9 shrink-0">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${statusStyle.accent} 0 76%, rgba(148,163,184,0.22) 76% 100%)`,
            }}
          />
          <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-[var(--card)] text-[8px] font-black" style={{ color: statusStyle.text }}>
            DGA
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {dgaStatus.gasRows.map((gas) => (
          <GasLimitChip key={gas.key} gas={gas} />
        ))}
      </div>
    </section>
  );
}

function GasLimitChip({ gas }) {
  const statusStyle = DGA_STATUS_STYLES[gas.status] || DGA_STATUS_STYLES.noData;
  const ratioLabel = Number.isFinite(gas.ratio) ? `${Math.round(gas.ratio * 100)}%` : '-';
  const title = `${gas.name}: ${formatGasNumber(gas.value)} ppm / limit ${formatGasNumber(gas.limit)} ppm`;

  return (
    <div
      className="min-w-0 rounded-md border px-1 py-1 text-center"
      style={{ background: statusStyle.bg, borderColor: statusStyle.border }}
      title={title}
    >
      <p className="truncate text-[9px] font-black leading-none" style={{ color: statusStyle.text }}>
        {gas.label}
      </p>
      <p className="mt-0.5 text-[9px] font-semibold leading-none text-[var(--foreground)]">
        {formatGasNumber(gas.value)}
      </p>
      <p className="mt-0.5 text-[8px] leading-none text-[var(--muted)]">{ratioLabel}</p>
    </div>
  );
}

function TransformerAssetCard({
  asset,
  selected,
  canManageAssets,
  onFocus,
  onViewDetails,
  onEdit,
  onDelete,
}) {
  const dgaStatus = getAssetDgaStatus(asset);
  const dgaStyle = DGA_STATUS_STYLES[dgaStatus.status] || DGA_STATUS_STYLES.noData;
  const latestOilTestDate = formatDate(dgaStatus.latestTest?.testDate);
  const transformerState = getTransformerState(asset);

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border bg-[var(--card)] shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,23,42,0.14)] ${
        selected
          ? 'border-[color:var(--primary)] ring-2 ring-[color:var(--ring)]'
          : 'border-[color:var(--border)]'
      }`}
      style={{ borderColor: selected ? 'var(--primary)' : dgaStyle.border }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: dgaStyle.accent }} />

      <div className="p-3">
        <div className="flex items-start gap-2">
          <div
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              selected
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
            }`}
          >
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-[var(--foreground)]">
                  {asset.txName || asset.mnemonic || 'Unnamed transformer'}
                </h3>
                <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                  {asset.siteName || 'Unknown site'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={dgaStyle.badgeVariant}>{dgaStyle.shortLabel}</Badge>
                {selected ? <Badge variant="default">Selected</Badge> : null}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">{formatValue(asset.voltage, 'Voltage N/A')}</Badge>
              <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">{transformerState || 'State N/A'}</Badge>
            </div>
          </div>
        </div>

        <DgaLimitPanel dgaStatus={dgaStatus} />

        <dl className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
          <AssetFact icon={Hash} label="Mnemonic" value={formatValue(asset.mnemonic)} />
          <AssetFact icon={ClipboardList} label="Serial" value={formatValue(asset.serialNumber)} />
          <AssetFact icon={Gauge} label="Load" value={asset.loadMVA ? `${asset.loadMVA} MVA` : '-'} />
          <AssetFact icon={Calendar} label="Built" value={formatValue(asset.yearBuilt)} />
        </dl>

        <div className="mt-2 rounded-lg border border-[color:var(--border)] bg-[var(--card-muted)]/72 p-2">
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <CompactMetric label="Oil tests" value={asset.oilTests?.length || 0} />
            <CompactMetric label="Documents" value={asset.documents?.length || 0} />
          </div>
          <div className="mt-2 space-y-1 text-[10px] text-[var(--muted)]">
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Latest oil test: <span className="font-medium text-[var(--foreground)]">{latestOilTestDate || 'No test yet'}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{formatPosition(asset.position)}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{formatValue(asset.maker, 'Maker not set')}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-[color:var(--border)] bg-[var(--card-muted)]/45 px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-9 px-0 text-xs"
          onClick={onFocus}
          aria-label="Focus transformer on map"
          title="Focus transformer on map"
        >
          <MapPin className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          className="h-7 w-9 px-0 text-xs"
          onClick={onViewDetails}
          aria-label="Open transformer details"
          title="Open transformer details"
        >
          <Eye className="h-3 w-3" />
        </Button>
        {canManageAssets ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-9 px-0 text-xs"
              onClick={onEdit}
              aria-label="Edit transformer"
              title="Edit transformer"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-9 px-0 text-xs text-[var(--danger-strong)] hover:bg-[var(--danger-soft)]"
              onClick={onDelete}
              aria-label="Delete transformer"
              title="Delete transformer"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function AssetFact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-[var(--card-muted)] px-2 py-1.5">
      <dt className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-xs font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function CompactMetric({ label, value }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
      <p className="text-sm font-bold leading-tight text-[var(--foreground)]">{value}</p>
    </div>
  );
}

export default AssetCardGalleryModal;
