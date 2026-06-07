import React from 'react';
import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { WEATHER_OPTION_LABELS, formatWeatherValue } from '../lib/weatherService';

function WeatherMapLayer({ records = [], options = {}, selectedRecordId = null, onSelectRecord }) {
  const activeOptionKeys = Object.keys(WEATHER_OPTION_LABELS).filter((key) => options[key]);

  if (!activeOptionKeys.length) {
    return null;
  }

  return (
    <>
      {records.map((record) => {
        const style = getWeatherMarkerStyle(record, options);
        const isSelected = selectedRecordId !== null && String(selectedRecordId) === String(record.id);

        return (
          <CircleMarker
            key={`weather-${record.id}`}
            center={record.position}
            radius={style.radius + (isSelected ? 3 : 0)}
            eventHandlers={{
              click: () => onSelectRecord?.(record),
            }}
            pathOptions={{
              color: isSelected ? '#f8fafc' : style.color,
              fillColor: style.fillColor,
              fillOpacity: style.fillOpacity,
              opacity: 0.9,
              weight: isSelected ? 4 : 2,
              className: 'weather-map-marker',
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              opacity={1}
              className="weather-overlay-tooltip"
            >
              <div className="weather-tooltip-content">
                <p className="weather-tooltip-title">{record.name}</p>
                <p className="weather-tooltip-meta">{record.dryLabel}</p>
              </div>
            </Tooltip>
            <Popup className="weather-popup" maxWidth={320} autoPan={false}>
              <div className="weather-popup-content">
                <div className="weather-popup-header">
                  <div>
                    <p className="weather-popup-eyebrow">Weather</p>
                    <h3>{record.name}</h3>
                  </div>
                  <span className={record.isRainy ? 'weather-status weather-status-rain' : 'weather-status weather-status-dry'}>
                    {record.dryLabel}
                  </span>
                </div>
                <p className="weather-popup-site">{record.siteName}</p>
                <dl className="weather-popup-grid">
                  {activeOptionKeys.map((optionKey) => (
                    <div key={`${record.id}-popup-${optionKey}`} className="weather-popup-metric">
                      <dt>{WEATHER_OPTION_LABELS[optionKey]}</dt>
                      <dd>{formatWeatherValue(record, optionKey)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="weather-popup-time">
                  {record.observationTime}
                  {record.timezoneAbbreviation ? ` ${record.timezoneAbbreviation}` : ''}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function getWeatherMarkerStyle(record, options) {
  if (options.rain && record.isRainy) {
    const rainfall = Number.isFinite(record.rain) ? record.rain : record.precipitation;
    const radius = Number.isFinite(rainfall) ? 12 + Math.min(10, rainfall * 2) : 14;
    return {
      color: '#0284c7',
      fillColor: '#38bdf8',
      fillOpacity: 0.34,
      radius,
    };
  }

  if (options.temperature && Number.isFinite(record.temperature)) {
    const warmRatio = clamp((record.temperature - 18) / 18, 0, 1);
    const color = warmRatio > 0.66 ? '#dc2626' : warmRatio > 0.38 ? '#d97706' : '#0891b2';
    return {
      color,
      fillColor: color,
      fillOpacity: 0.24 + warmRatio * 0.18,
      radius: 11 + warmRatio * 7,
    };
  }

  if (options.humidity && Number.isFinite(record.humidity)) {
    const humidityRatio = clamp(record.humidity / 100, 0, 1);
    return {
      color: '#059669',
      fillColor: '#34d399',
      fillOpacity: 0.22 + humidityRatio * 0.22,
      radius: 10 + humidityRatio * 8,
    };
  }

  if (options.windSpeed && Number.isFinite(record.windSpeed)) {
    const windRatio = clamp(record.windSpeed / 45, 0, 1);
    return {
      color: '#2563eb',
      fillColor: '#60a5fa',
      fillOpacity: 0.22 + windRatio * 0.22,
      radius: 10 + windRatio * 9,
    };
  }

  if (options.dewPoint && Number.isFinite(record.dewPoint)) {
    const dewRatio = clamp((record.dewPoint + 5) / 35, 0, 1);
    return {
      color: '#7c3aed',
      fillColor: '#a78bfa',
      fillOpacity: 0.22 + dewRatio * 0.2,
      radius: 10 + dewRatio * 7,
    };
  }

  return {
    color: record.isRainy ? '#0284c7' : '#059669',
    fillColor: record.isRainy ? '#38bdf8' : '#34d399',
    fillOpacity: 0.28,
    radius: 12,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default WeatherMapLayer;
