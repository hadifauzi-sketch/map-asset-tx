import React, { useMemo } from 'react';
import { Activity, CalendarDays, ChevronDown, CloudRain, CloudSun, Droplet, Droplets, GripVertical, Loader2, RefreshCw, Thermometer, Wind, X } from 'lucide-react';
import { Button } from './ui/button';
import { DatePicker } from './ui/date-picker';
import { Switch } from './ui/switch';
import { cn } from '../lib/utils';
import { WEATHER_OPTION_LABELS, formatWeatherValue } from '../lib/weatherService';

const WEATHER_OPTION_ICONS = {
  temperature: Thermometer,
  humidity: Droplets,
  rain: CloudRain,
  conditions: CloudSun,
  windSpeed: Wind,
  dewPoint: Droplet,
};

function WeatherToolPanel({
  className,
  date,
  options,
  layerEnabled,
  loading,
  error,
  records,
  emptyMessage = 'No weather records',
  scopeLabel = 'Assets',
  lastUpdatedAt,
  sampleDateOptions = [],
  selectedAssetName,
  hourlyChartOpen = false,
  hourlyChartCollapsed = false,
  hourlyChartDisabled = false,
  dragHandleProps = {},
  isDragging = false,
  onDateChange,
  onOptionChange,
  onLayerEnabledChange,
  onSampleDateChange,
  onToggleHourlyChart,
  onRefresh,
  onClose,
}) {
  const { className: dragHandleClassName, ...dragHandleRest } = dragHandleProps;
  const activeOptionKeys = useMemo(
    () => Object.keys(WEATHER_OPTION_LABELS).filter((key) => options?.[key]),
    [options]
  );

  const summary = useMemo(() => {
    const safeRecords = Array.isArray(records) ? records : [];
    const temperatures = safeRecords.map((record) => record.temperature).filter(Number.isFinite);
    const humidities = safeRecords.map((record) => record.humidity).filter(Number.isFinite);
    const windSpeeds = safeRecords.map((record) => record.windSpeed).filter(Number.isFinite);
    const dewPoints = safeRecords.map((record) => record.dewPoint).filter(Number.isFinite);
    const rainyCount = safeRecords.filter((record) => record.isRainy).length;

    return {
      assetCount: safeRecords.length,
      rainyCount,
      averageTemperature: average(temperatures),
      averageHumidity: average(humidities),
      averageWindSpeed: average(windSpeeds),
      averageDewPoint: average(dewPoints),
      sourceLabel: safeRecords[0]?.sourceLabel || 'Open-Meteo',
    };
  }, [records]);

  const selectedSampleDate = useMemo(
    () => sampleDateOptions.find((sampleDateOption) => sampleDateOption.value === date)?.value || '',
    [date, sampleDateOptions]
  );

  return (
    <section
      className={cn(
        'rounded-md border border-[color:var(--border)]/70 bg-[color:var(--card-elevated)]/94 shadow-[var(--shadow-card)] backdrop-blur-md',
        'w-full max-w-[30rem] overflow-hidden',
        className
      )}
      aria-label="Weather tool"
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
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
              <CloudSun className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[var(--foreground)]">Weather history</h2>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {summary.sourceLabel}
                {lastUpdatedAt ? ` - ${new Date(lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
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
            aria-label="Close weather tool"
            title="Close weather tool"
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
            <span className="text-[11px] font-medium uppercase text-[var(--muted)]">Date</span>
            <DatePicker
              value={date}
              onValueChange={onDateChange}
              placeholder="Pick date"
              triggerClassName="!h-9 px-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-[var(--muted)]">Sample date</span>
            <div
              className="relative"
              title={
                sampleDateOptions.length
                  ? `Choose ${selectedAssetName || 'selected asset'} sample date`
                  : 'Select a site with oil-test sample dates'
              }
            >
              <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <select
                value={selectedSampleDate}
                disabled={!sampleDateOptions.length}
                onChange={(event) => onSampleDateChange?.(event.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-[color:var(--border)] bg-[var(--card)] py-0 pl-8 pr-8 text-sm text-[var(--foreground)] outline-none transition focus:ring-2 focus:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Select oil sample date for weather history"
              >
                <option value="">{sampleDateOptions.length ? 'Sample date' : 'No sample dates'}</option>
                {sampleDateOptions.map((sampleDateOption) => (
                  <option key={sampleDateOption.value} value={sampleDateOption.value}>
                    {sampleDateOption.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
            </div>
          </label>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-[var(--muted)]">Hourly</span>
            <Button
              type="button"
              size="sm"
              variant={hourlyChartOpen ? 'secondary' : 'outline'}
              className="h-9 w-full justify-start gap-2 px-2 text-sm"
              onClick={onToggleHourlyChart}
              disabled={hourlyChartDisabled}
              aria-pressed={hourlyChartOpen}
              title={hourlyChartDisabled ? 'Select a site to show hourly weather' : 'Show hourly weather chart'}
            >
              <Activity className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {hourlyChartOpen ? (hourlyChartCollapsed ? 'Expand chart' : 'Collapse chart') : 'Hourly chart'}
              </span>
            </Button>
          </div>
          <div className="flex flex-wrap items-end justify-end gap-2 self-end">
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 gap-1.5 px-2 text-xs"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading ? 'animate-spin' : '')} />
              Refresh
            </Button>
            <div className="flex h-9 items-center gap-2 rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/70 px-2">
              <span className="text-xs text-[var(--muted)]">Map overlay</span>
              <Switch checked={layerEnabled} onCheckedChange={onLayerEnabledChange} aria-label="Toggle weather map overlay" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(WEATHER_OPTION_LABELS).map(([optionKey, label]) => {
            const OptionIcon = WEATHER_OPTION_ICONS[optionKey];
            return (
              <div
                key={optionKey}
                className="flex items-center justify-between gap-2 rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/60 px-2 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <OptionIcon className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                  <span className="truncate text-xs font-medium text-[var(--foreground)]">{label}</span>
                </div>
                <Switch
                  checked={Boolean(options?.[optionKey])}
                  onCheckedChange={(checked) => onOptionChange(optionKey, checked)}
                  aria-label={`Toggle ${label}`}
                />
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SummaryCell label={scopeLabel} value={loading ? '...' : summary.assetCount || '-'} />
          <SummaryCell
            label="Avg temp"
            value={Number.isFinite(summary.averageTemperature) ? `${summary.averageTemperature.toFixed(1)} C` : '-'}
          />
          <SummaryCell
            label="Avg RH"
            value={Number.isFinite(summary.averageHumidity) ? `${Math.round(summary.averageHumidity)}%` : '-'}
          />
          <SummaryCell
            label="Rain"
            value={loading ? '...' : `${summary.rainyCount}/${summary.assetCount || 0}`}
          />
          <SummaryCell
            label="Avg wind"
            value={Number.isFinite(summary.averageWindSpeed) ? `${summary.averageWindSpeed.toFixed(1)} km/h` : '-'}
          />
          <SummaryCell
            label="Avg dew"
            value={Number.isFinite(summary.averageDewPoint) ? `${summary.averageDewPoint.toFixed(1)} C` : '-'}
          />
        </div>

        {error ? (
          <div className="rounded-md border border-[color:var(--warning-strong)]/30 bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--foreground)]">
            {error}
          </div>
        ) : null}

        <div className="max-h-[15rem] overflow-y-auto rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/55">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading weather
            </div>
          ) : records?.length ? (
            records.slice(0, 12).map((record) => (
              <div key={record.id} className="border-b border-[color:var(--border)]/50 px-3 py-2 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{record.name}</p>
                    <p className="truncate text-[11px] text-[var(--muted)]">{record.siteName}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                      record.isRainy
                        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    )}
                  >
                    {record.dryLabel}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeOptionKeys.length ? (
                    activeOptionKeys.map((optionKey) => (
                      <span
                        key={`${record.id}-${optionKey}`}
                        className="rounded-md border border-[color:var(--border)]/60 bg-[var(--card-elevated)]/70 px-2 py-0.5 text-[11px] text-[var(--foreground)]"
                      >
                        {WEATHER_OPTION_LABELS[optionKey]}: {formatWeatherValue(record, optionKey)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-[var(--muted)]">No weather fields active</span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  {record.observationTime}
                  {record.timezoneAbbreviation ? ` ${record.timezoneAbbreviation}` : ''}
                </p>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-[var(--muted)]">{emptyMessage}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryCell({ label, value }) {
  return (
    <div className="rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/60 px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase text-[var(--muted)]">{label}</p>
      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default WeatherToolPanel;
