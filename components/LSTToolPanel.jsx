import React, { useMemo } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Flame,
  GitCompareArrows,
  GripVertical,
  KeyRound,
  Layers3,
  Link2,
  ListChecks,
  MapPinned,
  RefreshCw,
  Satellite,
  Split,
  ThermometerSun,
  Workflow,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { DatePicker } from './ui/date-picker';
import { Switch } from './ui/switch';
import { cn } from '../lib/utils';
import {
  DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS,
  DEFAULT_ESRI_LANDSAT_RENDERING_RULE,
  DEFAULT_LST_SOURCE_ID,
  ESRI_LANDSAT_EXPLORER_URL,
  LST_HEAT_LEGEND,
  LST_LAYER_SOURCE_OPTIONS,
  LST_URBAN_HEAT_WORKFLOW_STEPS,
  formatLSTDateLabel,
} from '../lib/lstService';

function LSTToolPanel({
  className,
  date,
  compareDate,
  sourceId = DEFAULT_LST_SOURCE_ID,
  sources = LST_LAYER_SOURCE_OPTIONS,
  layerEnabled,
  compareEnabled,
  opacity = 0.74,
  splitPosition = 50,
  arcgisServiceUrl = '',
  arcgisToken = '',
  arcgisRasterFunction = DEFAULT_ESRI_LANDSAT_RENDERING_RULE,
  arcgisWindowDays = DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS,
  selectedAssetName,
  sampleDateOptions = [],
  dragHandleProps = {},
  isDragging = false,
  onDateChange,
  onCompareDateChange,
  onSourceChange,
  onLayerEnabledChange,
  onCompareEnabledChange,
  onOpacityChange,
  onSplitPositionChange,
  onArcgisServiceUrlChange,
  onArcgisTokenChange,
  onArcgisRasterFunctionChange,
  onArcgisWindowDaysChange,
  onSampleDateChange,
  onUsePreviousYear,
  onRefresh,
  onClose,
}) {
  const { className: dragHandleClassName, ...dragHandleRest } = dragHandleProps;
  const source = useMemo(
    () => sources.find((candidate) => candidate.id === sourceId) || sources[0],
    [sourceId, sources]
  );
  const selectedSampleDate = useMemo(
    () =>
      sampleDateOptions.find((sampleDateOption) => sampleDateOption.value === date)?.value || '',
    [date, sampleDateOptions]
  );

  const opacityPercent = Math.round(Number(opacity) * 100);
  const isArcGISImageServer = source?.serviceType === 'arcgisImageServer';
  const isStaticGIBSLayer = source?.dateMode === 'static';
  const comparisonEnabled = Boolean(compareEnabled && !isStaticGIBSLayer);
  const safeArcgisWindowDays = Number.isFinite(Number(arcgisWindowDays))
    ? Number(arcgisWindowDays)
    : DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS;
  const sourceNote = getSourceNote({ isArcGISImageServer, isStaticGIBSLayer });

  return (
    <section
      className={cn(
        'rounded-md border border-[color:var(--border)]/70 bg-[color:var(--card-elevated)]/94 shadow-[var(--shadow-card)] backdrop-blur-md',
        'w-full max-w-[32rem] overflow-hidden',
        className
      )}
      aria-label="Land Surface Temperature tool"
    >
      <div
        {...dragHandleRest}
        className={cn(
          'flex touch-none select-none items-start justify-between gap-3 border-b border-[color:var(--border)]/60 px-3 py-2.5',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
          dragHandleClassName
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <ThermometerSun className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[var(--foreground)]">
                Land Surface Temperature
              </h2>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {source?.fullLabel || 'Satellite LST'} -{' '}
                {isStaticGIBSLayer ? '2013 static' : formatLSTDateLabel(date)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <GripVertical className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 shrink-0 p-0"
            aria-label="Close LST tool"
            title="Close LST tool"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-[var(--muted)]">LST date</span>
            <DatePicker
              value={date}
              onValueChange={onDateChange}
              disabled={isStaticGIBSLayer}
              placeholder="Pick date"
              triggerClassName="!h-9 px-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-[var(--muted)]">
              Sample date
            </span>
            <div
              className="relative"
              title={
                isStaticGIBSLayer
                  ? 'Static NASA UHI layer does not use daily sample dates'
                  : sampleDateOptions.length
                  ? `Choose ${selectedAssetName || 'selected asset'} sample date`
                  : 'Select a site with oil-test sample dates'
              }
            >
              <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <select
                value={selectedSampleDate}
                disabled={isStaticGIBSLayer || !sampleDateOptions.length}
                onChange={(event) => onSampleDateChange?.(event.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-[color:var(--border)] bg-[var(--card)] py-0 pl-8 pr-8 text-sm text-[var(--foreground)] outline-none transition focus:ring-2 focus:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Select oil sample date for LST"
              >
                <option value="">
                  {isStaticGIBSLayer
                    ? 'Static 2013'
                    : sampleDateOptions.length
                    ? 'Sample date'
                    : 'No sample dates'}
                </option>
                {sampleDateOptions.map((sampleDateOption) => (
                  <option key={sampleDateOption.value} value={sampleDateOption.value}>
                    {sampleDateOption.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-[var(--muted)]">Layer</span>
            <div className="relative">
              <Satellite className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <select
                value={sourceId}
                onChange={(event) => onSourceChange?.(event.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-[color:var(--border)] bg-[var(--card)] py-0 pl-8 pr-8 text-sm text-[var(--foreground)] outline-none transition focus:ring-2 focus:ring-[color:var(--ring)]"
                aria-label="Select LST layer"
              >
                {sources.map((sourceOption) => (
                  <option key={sourceOption.id} value={sourceOption.id}>
                    {sourceOption.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            </div>
          </label>
          <div className="flex flex-wrap items-end justify-end gap-2 self-end">
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 gap-1.5 px-2 text-xs"
              onClick={onRefresh}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <div className="flex h-9 items-center gap-2 rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/70 px-2">
              <span className="text-xs text-[var(--muted)]">Overlay</span>
              <Switch
                checked={Boolean(layerEnabled)}
                onCheckedChange={onLayerEnabledChange}
                aria-label="Toggle LST map overlay"
              />
            </div>
          </div>
        </div>

        {isArcGISImageServer ? (
          <ArcGISConfig
            arcgisRasterFunction={arcgisRasterFunction}
            arcgisServiceUrl={arcgisServiceUrl}
            arcgisToken={arcgisToken}
            safeArcgisWindowDays={safeArcgisWindowDays}
            onArcgisRasterFunctionChange={onArcgisRasterFunctionChange}
            onArcgisServiceUrlChange={onArcgisServiceUrlChange}
            onArcgisTokenChange={onArcgisTokenChange}
            onArcgisWindowDaysChange={onArcgisWindowDaysChange}
          />
        ) : null}

        <div className="rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/60 p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <GitCompareArrows className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate text-xs font-semibold text-[var(--foreground)]">
                Before / after comparison
              </span>
            </div>
            <Switch
              checked={comparisonEnabled}
              disabled={isStaticGIBSLayer}
              onCheckedChange={onCompareEnabledChange}
              aria-label="Toggle LST comparison"
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <DatePicker
              value={compareDate}
              onValueChange={onCompareDateChange}
              disabled={!comparisonEnabled}
              placeholder="Compare date"
              triggerClassName="!h-9 px-2 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 justify-start gap-2 px-2 text-sm"
              disabled={!comparisonEnabled}
              onClick={onUsePreviousYear}
            >
              <Split className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Last year</span>
            </Button>
          </div>
          {comparisonEnabled ? (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                <span className="truncate">Compare {formatLSTDateLabel(compareDate)}</span>
                <span className="truncate text-right">LST {formatLSTDateLabel(date)}</span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                step="1"
                value={splitPosition}
                onChange={(event) => onSplitPositionChange?.(Number(event.target.value))}
                className="lst-slider"
                aria-label="LST comparison split"
              />
            </div>
          ) : null}
        </div>

        {isArcGISImageServer ? <UrbanHeatWorkflow /> : null}

        <div className="space-y-1 rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/60 p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
              <Layers3 className="h-3.5 w-3.5 text-[var(--primary)]" />
              Opacity
            </div>
            <span className="text-xs font-semibold text-[var(--muted)]">{opacityPercent}%</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(event) => onOpacityChange?.(Number(event.target.value))}
            className="lst-slider"
            aria-label="LST overlay opacity"
          />
        </div>

        <div className="lst-thermal-legend" aria-label="LST thermal legend">
          <div className="flex items-center justify-between gap-2">
            {LST_HEAT_LEGEND.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]"
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <div className="lst-thermal-ramp mt-2" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCell icon={Satellite} label="Source" value={source?.satellite || '-'} />
          <SummaryCell icon={Layers3} label="Grid" value={source?.resolution || '-'} />
          <SummaryCell icon={Flame} label="Pass" value={source?.timeLabel || '-'} />
          <SummaryCell
            icon={GitCompareArrows}
            label="Mode"
            value={isStaticGIBSLayer ? 'Static' : comparisonEnabled ? 'Split' : 'Single'}
          />
        </div>

        <div className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-[var(--foreground)]">
          {sourceNote}
        </div>
      </div>
    </section>
  );
}

function ArcGISConfig({
  arcgisRasterFunction,
  arcgisServiceUrl,
  arcgisToken,
  safeArcgisWindowDays,
  onArcgisRasterFunctionChange,
  onArcgisServiceUrlChange,
  onArcgisTokenChange,
  onArcgisWindowDaysChange,
}) {
  return (
    <div className="space-y-2 rounded-md border border-cyan-400/25 bg-cyan-500/10 p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
            <MapPinned className="h-3.5 w-3.5 text-cyan-400" />
            ArcGIS Online mode
          </div>
          <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
            Landsat ST or hosted Urban Heat ImageServer
          </p>
        </div>
        <a
          href={ESRI_LANDSAT_EXPLORER_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[color:var(--primary)]/10"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Explorer
        </a>
      </div>

      <label className="block space-y-1">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-[var(--muted)]">
          <Link2 className="h-3 w-3" />
          ImageServer URL
        </span>
        <input
          type="url"
          value={arcgisServiceUrl}
          onChange={(event) => onArcgisServiceUrlChange?.(event.target.value)}
          placeholder="https://.../ImageServer"
          className="lst-text-input"
          aria-label="ArcGIS ImageServer URL"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-[var(--muted)]">
            <KeyRound className="h-3 w-3" />
            Token
          </span>
          <input
            type="password"
            value={arcgisToken}
            onChange={(event) => onArcgisTokenChange?.(event.target.value)}
            placeholder="ArcGIS token"
            className="lst-text-input"
            aria-label="ArcGIS access token"
          />
        </label>
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-[var(--muted)]">
            <CalendarDays className="h-3 w-3" />
            Window days
          </span>
          <input
            type="number"
            min="1"
            max="180"
            value={safeArcgisWindowDays}
            onChange={(event) => onArcgisWindowDaysChange?.(event.target.value)}
            className="lst-text-input"
            aria-label="ArcGIS Landsat scene window days"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-[var(--muted)]">
          <ListChecks className="h-3 w-3" />
          Raster function
        </span>
        <input
          type="text"
          value={arcgisRasterFunction}
          onChange={(event) => onArcgisRasterFunctionChange?.(event.target.value)}
          placeholder={DEFAULT_ESRI_LANDSAT_RENDERING_RULE}
          className="lst-text-input"
          aria-label="ArcGIS raster function"
        />
      </label>

      <p className="rounded-md border border-cyan-300/20 bg-[var(--card)]/55 px-2 py-1.5 text-[11px] leading-4 text-[var(--muted)]">
        Living Atlas Landsat Level-2 requires an ArcGIS org or developer token. Clear the raster
        function for an already processed hosted UHI ImageServer.
      </p>
    </div>
  );
}

function UrbanHeatWorkflow() {
  return (
    <div className="rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/60 p-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
        <Workflow className="h-3.5 w-3.5 text-amber-500" />
        Urban heat island workflow
      </div>
      <div className="mt-2 space-y-2">
        {LST_URBAN_HEAT_WORKFLOW_STEPS.map((step, index) => (
          <div key={step.title} className="lst-workflow-step">
            <span className="lst-workflow-step-index">{index + 1}</span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-semibold text-[var(--foreground)]">
                {step.title}
              </span>
              <span className="block text-[11px] leading-4 text-[var(--muted)]">
                {step.description}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCell({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/60 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-[var(--muted)]">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function getSourceNote({ isArcGISImageServer, isStaticGIBSLayer }) {
  if (isArcGISImageServer) {
    return 'Esri Landsat Level-2 gives finer 30 m surface-temperature viewing when your ArcGIS token or hosted ImageServer URL is valid.';
  }

  if (isStaticGIBSLayer) {
    return 'NASA GIBS UHI is a public static 2013 summer urban heat product. It is useful for heat-risk context and does not need a token.';
  }

  return 'NASA GIBS MODIS and VIIRS LST are public daily overlays for regional heat context. They run frontend-only with no token or backend.';
}

export default LSTToolPanel;
