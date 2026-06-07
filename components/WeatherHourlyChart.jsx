import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  GripVertical,
  Loader2,
  Sun,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const CHART_WIDTH = 760;
const CHART_HEIGHT = 184;
const CHART_PADDING = {
  top: 14,
  right: 52,
  bottom: 30,
  left: 44,
};

const X_TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 23];
const HUMIDITY_TICKS = [100, 75, 50, 25, 0];

function WeatherHourlyChart({
  collapsed = false,
  loading = false,
  error = '',
  series = [],
  assetName = '',
  siteName = '',
  date = '',
  onToggleCollapsed,
  onClose,
}) {
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeHour, setActiveHour] = useState(null);
  const [chartCursor, setChartCursor] = useState(null);
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const dragStateRef = useRef(null);
  const hasPosition = Boolean(position);
  const chart = useMemo(() => buildChartModel(series), [series]);
  const dateLabel = formatDateLabel(date);
  const sourceLabel = series?.[0]?.sourceLabel || 'Open-Meteo';
  const timezoneAbbreviation = series?.[0]?.timezoneAbbreviation || '';
  const activePoint = Number.isInteger(activeHour) ? chart.points[activeHour] : null;
  const activeTooltipPosition = useMemo(
    () => getTooltipPosition(activePoint, chartCursor, chart),
    [activePoint, chartCursor, chart]
  );

  const getConstrainedChartPosition = useCallback((left, top) => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;

    if (!overlay || !panel) {
      return { left, top };
    }

    const overlayRect = overlay.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, overlayRect.width - panelRect.width - margin);
    const maxTop = Math.max(margin, overlayRect.height - panelRect.height - margin);

    return {
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop),
    };
  }, []);

  const handleDragStart = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const overlay = overlayRef.current;
    const panel = panelRef.current;

    if (!overlay || !panel) {
      return;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const startPosition = getConstrainedChartPosition(
      panelRect.left - overlayRect.left,
      panelRect.top - overlayRect.top
    );

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: startPosition.left,
      startTop: startPosition.top,
    };

    setPosition(startPosition);
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [getConstrainedChartPosition]);

  const handleDragMove = useCallback((event) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setPosition(
      getConstrainedChartPosition(
        dragState.startLeft + event.clientX - dragState.startX,
        dragState.startTop + event.clientY - dragState.startY
      )
    );
    event.preventDefault();
  }, [getConstrainedChartPosition]);

  const handleDragEnd = useCallback((event) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  useEffect(() => {
    if (!hasPosition) {
      return undefined;
    }

    const handleResize = () => {
      setPosition((current) => {
        if (!current) {
          return current;
        }

        const nextPosition = getConstrainedChartPosition(current.left, current.top);
        return nextPosition.left === current.left && nextPosition.top === current.top
          ? current
          : nextPosition;
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [collapsed, getConstrainedChartPosition, hasPosition]);

  useEffect(() => {
    setActiveHour(null);
    setChartCursor(null);
  }, [date, series]);

  const handleChartPointerMove = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const svgX = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
    const svgY = ((event.clientY - rect.top) / rect.height) * CHART_HEIGHT;
    const progress = (svgX - CHART_PADDING.left) / chart.innerWidth;
    const nearestHour = Math.max(0, Math.min(23, Math.round(progress * 23)));
    const nextPoint = chart.points[nearestHour];

    if (hasTooltipValues(nextPoint)) {
      setActiveHour(nearestHour);
      setChartCursor({
        x: svgX,
        y: svgY,
      });
      return;
    }

    setActiveHour(null);
    setChartCursor(null);
  }, [chart]);

  const handleChartPointerLeave = useCallback(() => {
    setActiveHour(null);
    setChartCursor(null);
  }, []);

  return (
    <div ref={overlayRef} className="weather-hourly-overlay-layer pointer-events-none">
      <section
        ref={panelRef}
        className={cn(
          'weather-hourly-panel pointer-events-auto',
          collapsed && 'weather-hourly-panel-collapsed',
          position && 'weather-hourly-panel-positioned',
          isDragging && 'weather-hourly-panel-dragging'
        )}
        style={position ? { left: `${position.left}px`, top: `${position.top}px` } : undefined}
        aria-label="Hourly weather chart"
      >
        <header
          className="weather-hourly-header"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
              <Activity className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[var(--foreground)]">Hourly weather</h2>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {assetName || 'Selected site'} - {dateLabel}
                {timezoneAbbreviation ? ` ${timezoneAbbreviation}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="hidden rounded-md border border-[color:var(--border)]/60 bg-[var(--card)]/70 px-2 py-1 text-[10px] font-medium uppercase text-[var(--muted)] sm:inline-flex">
              {sourceLabel}
            </span>
            <GripVertical className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onToggleCollapsed}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={collapsed ? 'Expand hourly chart' : 'Collapse hourly chart'}
              title={collapsed ? 'Expand hourly chart' : 'Collapse hourly chart'}
            >
              {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Close hourly chart"
              title="Close hourly chart"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {!collapsed ? (
          <div className="weather-hourly-body">
            {loading ? (
              <div className="weather-hourly-state">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                Loading hourly weather
              </div>
            ) : error ? (
              <div className="weather-hourly-state weather-hourly-state-warning">{error}</div>
            ) : chart.hasData ? (
              <>
                <div className="weather-hourly-chart-wrap">
                  <svg
                    className="weather-hourly-svg"
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    role="img"
                    aria-label="Hourly temperature humidity and dewpoint chart"
                    onPointerMove={handleChartPointerMove}
                    onPointerLeave={handleChartPointerLeave}
                    onPointerCancel={handleChartPointerLeave}
                  >
                    <rect
                      x={CHART_PADDING.left}
                      y={CHART_PADDING.top}
                      width={chart.innerWidth}
                      height={chart.innerHeight}
                      className="weather-hourly-plot-bg"
                    />
                    {chart.humidityTicks.map((tick) => (
                      <g key={`rh-${tick}`}>
                        <line
                          x1={CHART_PADDING.left}
                          y1={chart.yForHumidity(tick)}
                          x2={CHART_WIDTH - CHART_PADDING.right}
                          y2={chart.yForHumidity(tick)}
                          className="weather-hourly-grid-line"
                        />
                        <text
                          x={CHART_WIDTH - 10}
                          y={chart.yForHumidity(tick) + 4}
                          className="weather-hourly-axis-text weather-hourly-axis-text-right"
                        >
                          {tick}
                        </text>
                      </g>
                    ))}
                    {chart.temperatureTicks.map((tick) => (
                      <text
                        key={`temp-${tick}`}
                        x={8}
                        y={chart.yForTemperature(tick) + 4}
                        className="weather-hourly-axis-text"
                      >
                        {tick}
                      </text>
                    ))}
                    {X_TICK_HOURS.map((hour) => (
                      <g key={`hour-${hour}`}>
                        <line
                          x1={chart.xForHour(hour)}
                          y1={CHART_PADDING.top}
                          x2={chart.xForHour(hour)}
                          y2={CHART_HEIGHT - CHART_PADDING.bottom}
                          className="weather-hourly-grid-line weather-hourly-grid-line-vertical"
                        />
                        <text
                          x={chart.xForHour(hour)}
                          y={CHART_HEIGHT - 10}
                          textAnchor="middle"
                          className="weather-hourly-axis-text"
                        >
                          {formatHourDisplay(hour)}
                        </text>
                      </g>
                    ))}
                    <path d={chart.temperaturePath} className="weather-hourly-line weather-hourly-line-temp" />
                    <path d={chart.dewPointPath} className="weather-hourly-line weather-hourly-line-dew" />
                    <path d={chart.humidityPath} className="weather-hourly-line weather-hourly-line-rh" />
                    {activePoint && activeTooltipPosition ? (
                      <g className="weather-hourly-hover-layer" aria-hidden="true">
                        <line
                          x1={activeTooltipPosition.x}
                          y1={CHART_PADDING.top}
                          x2={activeTooltipPosition.x}
                          y2={CHART_HEIGHT - CHART_PADDING.bottom}
                          className="weather-hourly-hover-line"
                        />
                        {Number.isFinite(activePoint.temperature) ? (
                          <circle
                            cx={activeTooltipPosition.x}
                            cy={chart.yForTemperature(activePoint.temperature)}
                            r="5"
                            className="weather-hourly-hover-dot weather-hourly-hover-dot-temp"
                          />
                        ) : null}
                        {Number.isFinite(activePoint.dewPoint) ? (
                          <circle
                            cx={activeTooltipPosition.x}
                            cy={chart.yForTemperature(activePoint.dewPoint)}
                            r="5"
                            className="weather-hourly-hover-dot weather-hourly-hover-dot-dew"
                          />
                        ) : null}
                        {Number.isFinite(activePoint.humidity) ? (
                          <circle
                            cx={activeTooltipPosition.x}
                            cy={chart.yForHumidity(activePoint.humidity)}
                            r="5"
                            className="weather-hourly-hover-dot weather-hourly-hover-dot-rh"
                          />
                        ) : null}
                      </g>
                    ) : null}
                    {chart.points.map((point) => (
                      Number.isFinite(point.temperature) ? (
                        <circle
                          key={`dot-${point.hour}`}
                          cx={chart.xForHour(point.hour)}
                          cy={chart.yForTemperature(point.temperature)}
                          r="3"
                          className="weather-hourly-dot"
                        />
                      ) : null
                    ))}
                    <text x={8} y={12} className="weather-hourly-unit-text">C</text>
                    <text x={CHART_WIDTH - 14} y={12} textAnchor="end" className="weather-hourly-unit-text">%</text>
                  </svg>
                  {activePoint && activeTooltipPosition ? (
                    <div
                      className={cn(
                        'weather-hourly-tooltip',
                        activeTooltipPosition.alignLeft && 'weather-hourly-tooltip-left',
                        activeTooltipPosition.alignRight && 'weather-hourly-tooltip-right',
                        activeTooltipPosition.placeBelow && 'weather-hourly-tooltip-below'
                      )}
                      style={{
                        left: `${activeTooltipPosition.leftPercent}%`,
                        top: `${activeTooltipPosition.topPercent}%`,
                      }}
                    >
                      <div className="weather-hourly-tooltip-header">
                        <span>{activePoint.timeLabel}</span>
                        <strong>{activePoint.weatherLabel || '-'}</strong>
                      </div>
                      <div className="weather-hourly-tooltip-grid">
                        <TooltipMetric color="temp" label="Temp" value={formatMetricValue(activePoint.temperature, 'C')} />
                        <TooltipMetric color="dew" label="Dewpoint" value={formatMetricValue(activePoint.dewPoint, 'C')} />
                        <TooltipMetric color="rh" label="Humidity" value={formatMetricValue(activePoint.humidity, '%')} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="weather-hourly-legend" aria-label="Weather chart legend">
                  <LegendItem color="temp" label="Temp" value={chart.summary.temperature} />
                  <LegendItem color="dew" label="Dewpoint" value={chart.summary.dewPoint} />
                  <LegendItem color="rh" label="Humidity" value={chart.summary.humidity} />
                  <LegendItem color="rain" label="Rain hours" value={chart.summary.rain} />
                </div>

                <div className="weather-hourly-strip" aria-label="Hourly weather values from midnight to 11 PM">
                  {chart.points.map((point) => {
                    const weatherStatus = getWeatherStatus(point);
                    const WeatherStatusIcon = weatherStatus.icon;

                    return (
                      <div
                        key={`chip-${point.hour}`}
                        className={cn('weather-hourly-chip', `weather-hourly-chip-${weatherStatus.tone}`)}
                        title={`${point.timeLabel} - ${point.weatherLabel || weatherStatus.label}`}
                      >
                        <span className="weather-hourly-chip-time">{point.timeLabel}</span>
                        <strong>{formatNumber(point.temperature)} C</strong>
                        <span className={cn('weather-hourly-chip-status', `weather-hourly-chip-status-${weatherStatus.tone}`)}>
                          <WeatherStatusIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{weatherStatus.label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="truncate text-[11px] text-[var(--muted)]">
                  {siteName || 'Selected site'} - showing 12 AM until 11 PM on the selected date.
                </p>
              </>
            ) : (
              <div className="weather-hourly-state">
                <CloudSun className="h-4 w-4 text-[var(--primary)]" />
                Select a mapped site and date to show hourly weather.
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LegendItem({ color, label, value }) {
  return (
    <div className="weather-hourly-legend-item">
      <span className={cn('weather-hourly-legend-swatch', `weather-hourly-legend-${color}`)} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TooltipMetric({ color, label, value }) {
  return (
    <div className="weather-hourly-tooltip-metric">
      <span className={cn('weather-hourly-tooltip-dot', `weather-hourly-tooltip-dot-${color}`)} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getWeatherStatus(point) {
  const weatherCode = Math.round(Number(point?.weatherCode));

  if (Number.isFinite(weatherCode)) {
    if (weatherCode === 0 || weatherCode === 1) {
      return { label: 'Sunny', icon: Sun, tone: 'sunny' };
    }

    if (weatherCode === 2) {
      return { label: 'Partly', icon: CloudSun, tone: 'partly' };
    }

    if (weatherCode === 3) {
      return { label: 'Cloudy', icon: Cloud, tone: 'cloudy' };
    }

    if (weatherCode === 45 || weatherCode === 48) {
      return { label: 'Fog', icon: CloudFog, tone: 'fog' };
    }

    if (weatherCode >= 51 && weatherCode <= 57) {
      return { label: 'Drizzle', icon: CloudDrizzle, tone: 'drizzle' };
    }

    if ((weatherCode >= 61 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
      return { label: 'Rain', icon: CloudRain, tone: 'rain' };
    }

    if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
      return { label: 'Snow', icon: CloudSnow, tone: 'snow' };
    }

    if (weatherCode >= 95) {
      return { label: 'Storm', icon: CloudLightning, tone: 'storm' };
    }
  }

  const weatherLabel = String(point?.weatherLabel || '').toLowerCase();

  if (weatherLabel.includes('thunder')) {
    return { label: 'Storm', icon: CloudLightning, tone: 'storm' };
  }

  if (weatherLabel.includes('rain') || weatherLabel.includes('shower')) {
    return { label: 'Rain', icon: CloudRain, tone: 'rain' };
  }

  if (weatherLabel.includes('drizzle')) {
    return { label: 'Drizzle', icon: CloudDrizzle, tone: 'drizzle' };
  }

  if (weatherLabel.includes('fog')) {
    return { label: 'Fog', icon: CloudFog, tone: 'fog' };
  }

  if (weatherLabel.includes('snow')) {
    return { label: 'Snow', icon: CloudSnow, tone: 'snow' };
  }

  if (weatherLabel.includes('clear') || weatherLabel.includes('sun')) {
    return { label: 'Sunny', icon: Sun, tone: 'sunny' };
  }

  if (weatherLabel.includes('cloud') || weatherLabel.includes('overcast')) {
    return { label: 'Cloudy', icon: Cloud, tone: 'cloudy' };
  }

  return point?.isRainy
    ? { label: 'Rain', icon: CloudRain, tone: 'rain' }
    : { label: 'Weather', icon: CloudSun, tone: 'partly' };
}

function getTooltipPosition(point, cursor, chart) {
  if (!hasTooltipValues(point) || !cursor) {
    return null;
  }

  const guideX = chart.xForHour(point.hour);
  const cursorX = Math.max(CHART_PADDING.left, Math.min(CHART_WIDTH - CHART_PADDING.right, cursor.x));
  const cursorY = Math.max(CHART_PADDING.top, Math.min(CHART_HEIGHT - CHART_PADDING.bottom, cursor.y));

  return {
    x: guideX,
    leftPercent: (cursorX / CHART_WIDTH) * 100,
    topPercent: (cursorY / CHART_HEIGHT) * 100,
    alignLeft: cursorX < 180,
    alignRight: cursorX > CHART_WIDTH - 180,
    placeBelow: cursorY < CHART_HEIGHT * 0.46,
  };
}

function hasTooltipValues(point) {
  return (
    Boolean(point) &&
    (
      Number.isFinite(point.temperature) ||
      Number.isFinite(point.dewPoint) ||
      Number.isFinite(point.humidity)
    )
  );
}

function buildChartModel(series) {
  const sourcePoints = Array.isArray(series) ? series : [];
  const byHour = new Map(
    sourcePoints
      .filter((point) => Number.isFinite(Number(point?.hour)))
      .map((point) => [Number(point.hour), point])
  );
  const points = Array.from({ length: 24 }, (_, hour) => {
    const point = byHour.get(hour);
    return point
      ? {
          ...point,
          hour,
          timeLabel: point.displayTime || formatHourDisplay(hour),
        }
      : {
          hour,
          timeLabel: formatHourDisplay(hour),
          displayTime: formatHourDisplay(hour),
          temperature: null,
          humidity: null,
          dewPoint: null,
          rain: null,
          precipitation: null,
          weatherLabel: '-',
          isRainy: false,
        };
  });

  const temperatureValues = points
    .flatMap((point) => [point.temperature, point.dewPoint])
    .filter(Number.isFinite);
  const humidityValues = points.map((point) => point.humidity).filter(Number.isFinite);
  const hasData = temperatureValues.length > 0 || humidityValues.length > 0;
  const tempMinRaw = temperatureValues.length ? Math.min(...temperatureValues) : 20;
  const tempMaxRaw = temperatureValues.length ? Math.max(...temperatureValues) : 35;
  const tempPadding = Math.max(2, (tempMaxRaw - tempMinRaw) * 0.18);
  const tempMin = Math.floor(tempMinRaw - tempPadding);
  const tempMax = Math.ceil(tempMaxRaw + tempPadding);
  const safeTempMax = tempMax === tempMin ? tempMax + 1 : tempMax;
  const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const xForHour = (hour) => CHART_PADDING.left + (Math.max(0, Math.min(23, hour)) / 23) * innerWidth;
  const yForTemperature = (value) => {
    if (!Number.isFinite(value)) {
      return CHART_HEIGHT - CHART_PADDING.bottom;
    }
    return CHART_HEIGHT - CHART_PADDING.bottom - ((value - tempMin) / (safeTempMax - tempMin)) * innerHeight;
  };
  const yForHumidity = (value) => {
    if (!Number.isFinite(value)) {
      return CHART_HEIGHT - CHART_PADDING.bottom;
    }
    return CHART_HEIGHT - CHART_PADDING.bottom - (Math.max(0, Math.min(100, value)) / 100) * innerHeight;
  };

  return {
    points,
    hasData,
    innerWidth,
    innerHeight,
    temperatureTicks: buildTemperatureTicks(tempMin, safeTempMax),
    humidityTicks: HUMIDITY_TICKS,
    xForHour,
    yForTemperature,
    yForHumidity,
    temperaturePath: buildPath(points, (point) => point.temperature, xForHour, yForTemperature),
    dewPointPath: buildPath(points, (point) => point.dewPoint, xForHour, yForTemperature),
    humidityPath: buildPath(points, (point) => point.humidity, xForHour, yForHumidity),
    summary: {
      temperature: formatRange(points.map((point) => point.temperature).filter(Number.isFinite), 'C'),
      dewPoint: formatRange(points.map((point) => point.dewPoint).filter(Number.isFinite), 'C'),
      humidity: formatRange(points.map((point) => point.humidity).filter(Number.isFinite), '%'),
      rain: `${points.filter((point) => point.isRainy).length}/24`,
    },
  };
}

function buildPath(points, getValue, xForHour, yForValue) {
  let started = false;
  return points
    .map((point) => {
      const value = getValue(point);
      if (!Number.isFinite(value)) {
        return '';
      }
      const command = started ? 'L' : 'M';
      started = true;
      return `${command}${xForHour(point.hour).toFixed(1)},${yForValue(value).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');
}

function buildTemperatureTicks(min, max) {
  const middle = Math.round((min + max) / 2);
  return [max, middle, min];
}

function formatRange(values, suffix) {
  if (!values.length) {
    return '-';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(max - min) < 0.05) {
    return `${formatNumber(max)} ${suffix}`;
  }

  return `${formatNumber(min)}-${formatNumber(max)} ${suffix}`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return Math.abs(value) >= 100 ? `${Math.round(value)}` : value.toFixed(1);
}

function formatMetricValue(value, suffix) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return suffix === '%' ? `${formatNumber(value)}%` : `${formatNumber(value)} ${suffix}`;
}

function formatDateLabel(value) {
  if (!value) {
    return 'Selected date';
  }

  const timestamp = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatHourDisplay(hour) {
  const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
  const period = safeHour >= 12 ? 'PM' : 'AM';
  return `${safeHour % 12 || 12} ${period}`;
}

export default WeatherHourlyChart;
