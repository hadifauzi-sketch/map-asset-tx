import { fetchWeatherApi } from 'openmeteo';

export const DEFAULT_WEATHER_OPTIONS = {
  temperature: true,
  humidity: true,
  rain: true,
  conditions: true,
  windSpeed: true,
  dewPoint: true,
};

export const WEATHER_OPTION_LABELS = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  rain: 'Rain',
  conditions: 'Condition',
  windSpeed: 'Wind speed',
  dewPoint: 'Dewpoint',
};

const OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_HOURLY_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'rain',
  'weather_code',
  'wind_speed_10m',
  'dew_point_2m',
];

// Open-Meteo sits behind nginx, which rejects request URIs over 8 KB with a 414 that
// carries no CORS headers - the browser then surfaces it as an opaque "Failed to fetch".
// Coordinates travel in the query string, so a large asset list has to be split up.
const MAX_LOCATIONS_PER_REQUEST = 100;
const MAX_CONCURRENT_REQUESTS = 3;
// Weather models resolve to 1-25 km grids, so 4 decimals (~11 m) is already finer than
// the API can use and keeps each URL short.
const COORDINATE_DECIMALS = 4;

const WEATHER_CODE_LABELS = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Heavy thunderstorm with hail',
};

const pad2 = (value) => String(value).padStart(2, '0');

export function getLocalDateInput(date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() - nextDate.getTimezoneOffset());
  return nextDate.toISOString().slice(0, 10);
}

export function getLocalTimeInput(date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() - nextDate.getTimezoneOffset());
  return nextDate.toISOString().slice(11, 16);
}

export function getWeatherEndpointForDate(dateString) {
  const selectedDate = parseLocalDateStart(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    return {
      url: OPEN_METEO_ARCHIVE_URL,
      key: 'archive',
      label: 'Open-Meteo archive',
    };
  }

  return {
    url: OPEN_METEO_FORECAST_URL,
    key: 'forecast',
    label: 'Open-Meteo forecast',
  };
}

export async function fetchTransformerWeather(transformers = [], config = {}, fetchOptions = {}) {
  const date = normalizeDateInput(config.date);
  const time = normalizeTimeInput(config.time);
  const targets = buildWeatherTargets(transformers);

  if (targets.length === 0) {
    return [];
  }

  const endpoint = getWeatherEndpointForDate(date);
  const responses = await fetchWeatherForTargets(targets, { endpoint, date, fetchOptions });
  const targetTimeMs = getPseudoLocalTimestamp(date, time);

  return targets
    .map((target, index) => parseWeatherResponse(responses[index], target, {
      date,
      time,
      endpoint,
      targetTimeMs,
    }))
    .filter(Boolean);
}

export async function fetchTransformerHourlyWeather(transformer, config = {}, fetchOptions = {}) {
  const date = normalizeDateInput(config.date);
  const targets = buildWeatherTargets(transformer ? [transformer] : []);

  if (targets.length === 0) {
    return [];
  }

  const endpoint = getWeatherEndpointForDate(date);
  const responses = await fetchWeatherForTargets(targets, { endpoint, date, fetchOptions });
  return parseHourlyWeatherSeries(responses[0], targets[0], {
    date,
    endpoint,
  });
}

/**
 * The exact Open-Meteo request behind one asset's reading, in browser-readable JSON form.
 * The live app asks for flatbuffers and batches many locations per call, so this is the
 * single-location equivalent - the same endpoint, date and variables, openable in a tab.
 */
export function buildWeatherRequestUrl(transformer, config = {}) {
  const date = normalizeDateInput(config.date);
  const [target] = buildWeatherTargets(transformer ? [transformer] : []);

  if (!target) {
    return '';
  }

  const endpoint = getWeatherEndpointForDate(date);
  const params = new URLSearchParams({
    latitude: String(roundCoordinate(target.latitude)),
    longitude: String(roundCoordinate(target.longitude)),
    start_date: date,
    end_date: date,
    hourly: WEATHER_HOURLY_VARIABLES.join(','),
    timezone: 'auto',
  });

  return `${endpoint.url}?${params.toString()}`;
}

export function formatWeatherValue(record, optionKey) {
  if (!record) {
    return '-';
  }

  if (optionKey === 'temperature') {
    return Number.isFinite(record.temperature) ? `${record.temperature.toFixed(1)} deg C` : '-';
  }

  if (optionKey === 'humidity') {
    return Number.isFinite(record.humidity) ? `${Math.round(record.humidity)}% RH` : '-';
  }

  if (optionKey === 'rain') {
    const rainfall = Number.isFinite(record.rain) ? record.rain : record.precipitation;
    return Number.isFinite(rainfall) ? `${rainfall.toFixed(1)} mm` : '-';
  }

  if (optionKey === 'conditions') {
    return record.weatherLabel || '-';
  }

  if (optionKey === 'windSpeed') {
    return Number.isFinite(record.windSpeed) ? `${record.windSpeed.toFixed(1)} km/h` : '-';
  }

  if (optionKey === 'dewPoint') {
    return Number.isFinite(record.dewPoint) ? `${record.dewPoint.toFixed(1)} deg C` : '-';
  }

  return '-';
}

export function getWeatherCodeLabel(code) {
  const numericCode = Number(code);
  if (!Number.isFinite(numericCode)) {
    return '-';
  }

  const roundedCode = Math.round(numericCode);
  return WEATHER_CODE_LABELS[roundedCode] || `Code ${Number.isFinite(roundedCode) ? roundedCode : '-'}`;
}

async function fetchWeatherForTargets(targets, { endpoint, date, fetchOptions }) {
  const batches = chunkArray(targets, MAX_LOCATIONS_PER_REQUEST);
  const responsesByBatch = new Array(batches.length);
  let nextBatchIndex = 0;

  async function runBatches() {
    while (nextBatchIndex < batches.length) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;
      const batch = batches[batchIndex];

      responsesByBatch[batchIndex] = await fetchWeatherApi(
        endpoint.url,
        {
          latitude: batch.map((target) => roundCoordinate(target.latitude)),
          longitude: batch.map((target) => roundCoordinate(target.longitude)),
          start_date: date,
          end_date: date,
          hourly: WEATHER_HOURLY_VARIABLES.join(','),
          timezone: 'auto',
        },
        2,
        0.2,
        1.5,
        fetchOptions
      );
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_REQUESTS, batches.length);

  try {
    await Promise.all(Array.from({ length: workerCount }, runBatches));
  } catch (error) {
    throw describeWeatherFetchError(error);
  }

  return responsesByBatch.flat();
}

function describeWeatherFetchError(error) {
  // fetch() rejects with a bare TypeError for anything the browser blocks at the network
  // layer, so replace the opaque message with something actionable.
  if (error instanceof TypeError) {
    const networkError = new Error('Could not reach Open-Meteo. Check your network connection and try again.');
    networkError.cause = error;
    return networkError;
  }

  return error;
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function roundCoordinate(value) {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

export function normalizeSiteKey(siteName) {
  return String(siteName || '').trim().toLowerCase();
}

/**
 * Collapse per-asset API records down to one reading per site, ready to cache in Supabase.
 */
export function buildObservationsFromRecords(records = [], date) {
  const bySite = new Map();

  records.forEach((record) => {
    const siteKey = normalizeSiteKey(record.siteName);

    if (!siteKey || bySite.has(siteKey)) {
      return;
    }

    bySite.set(siteKey, {
      siteName: record.siteName,
      observedDate: date,
      source: 'api',
      temperature: record.temperature,
      humidity: record.humidity,
      rain: record.rain,
      precipitation: record.precipitation,
      windSpeed: record.windSpeed,
      dewPoint: record.dewPoint,
      weatherCode: record.weatherCode,
      weatherLabel: record.weatherLabel,
      isRainy: record.isRainy,
      observationTime: record.observationTime,
      timezone: record.timezone,
      timezoneAbbreviation: record.timezoneAbbreviation,
    });
  });

  return Array.from(bySite.values());
}

/**
 * Rebuild panel records from the cached observations when Open-Meteo cannot be reached.
 */
export function buildRecordsFromObservations(transformers = [], observations = [], date) {
  const bySite = new Map();

  observations.forEach((observation) => {
    const siteKey = normalizeSiteKey(observation.siteName);

    if (siteKey && !bySite.has(siteKey)) {
      bySite.set(siteKey, observation);
    }
  });

  return buildWeatherTargets(transformers)
    .map((target) => {
      const observation = bySite.get(normalizeSiteKey(target.siteName));

      if (!observation) {
        return null;
      }

      const isRainy = resolveRainState(
        observation.weatherCode,
        observation.precipitation,
        observation.rain
      );

      return {
        ...target,
        requestedDate: date,
        observationTime: observation.observationTime || `${date} (saved)`,
        sourceKey: 'archive-cache',
        sourceLabel: 'Open-Meteo (saved)',
        isStored: true,
        timezone: observation.timezone || '',
        timezoneAbbreviation: observation.timezoneAbbreviation || '',
        temperature: observation.temperature,
        humidity: observation.humidity,
        precipitation: observation.precipitation,
        rain: observation.rain,
        weatherCode: observation.weatherCode,
        windSpeed: observation.windSpeed,
        dewPoint: observation.dewPoint,
        weatherLabel: observation.weatherLabel || getWeatherCodeLabel(observation.weatherCode),
        isRainy,
        dryLabel: isRainy ? 'Rain / wet' : 'Dry',
      };
    })
    .filter(Boolean);
}

function buildWeatherTargets(transformers) {
  return transformers
    .map((transformer) => {
      const latitude = Number(transformer?.position?.[0]);
      const longitude = Number(transformer?.position?.[1]);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return {
        id: String(transformer.id),
        name: transformer.txName || transformer.mnemonic || 'Unnamed transformer',
        siteName: transformer.siteName || 'Unknown site',
        position: [latitude, longitude],
        latitude,
        longitude,
      };
    })
    .filter(Boolean);
}

function parseWeatherResponse(response, target, meta) {
  const hourly = response?.hourly?.();
  if (!hourly) {
    return null;
  }

  const interval = Number(hourly.interval());
  const start = Number(hourly.time());
  const end = Number(hourly.timeEnd());
  const utcOffsetSeconds = Number(response.utcOffsetSeconds?.() || 0);

  if (!Number.isFinite(interval) || interval <= 0 || !Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  const timestamps = range(start, end, interval);
  if (timestamps.length === 0) {
    return null;
  }

  const nearestIndex = findNearestWeatherIndex(timestamps, utcOffsetSeconds, meta.targetTimeMs);
  const weatherCode = getVariableValue(hourly, 4, nearestIndex);
  const windSpeed = getVariableValue(hourly, 5, nearestIndex);
  const dewPoint = getVariableValue(hourly, 6, nearestIndex);
  const precipitation = getVariableValue(hourly, 2, nearestIndex);
  const rain = getVariableValue(hourly, 3, nearestIndex);
  const isRainy = resolveRainState(weatherCode, precipitation, rain);

  return {
    ...target,
    requestedDate: meta.date,
    requestedTime: meta.time,
    observationTime: formatPseudoLocalDateTime((timestamps[nearestIndex] + utcOffsetSeconds) * 1000),
    sourceKey: meta.endpoint.key,
    sourceLabel: meta.endpoint.label,
    timezone: response.timezone?.() || '',
    timezoneAbbreviation: response.timezoneAbbreviation?.() || '',
    temperature: getVariableValue(hourly, 0, nearestIndex),
    humidity: getVariableValue(hourly, 1, nearestIndex),
    precipitation,
    rain,
    weatherCode,
    windSpeed,
    dewPoint,
    weatherLabel: getWeatherCodeLabel(weatherCode),
    isRainy,
    dryLabel: isRainy ? 'Rain / wet' : 'Dry',
  };
}

function parseHourlyWeatherSeries(response, target, meta) {
  const hourly = response?.hourly?.();
  if (!hourly) {
    return [];
  }

  const interval = Number(hourly.interval());
  const start = Number(hourly.time());
  const end = Number(hourly.timeEnd());
  const utcOffsetSeconds = Number(response.utcOffsetSeconds?.() || 0);

  if (!Number.isFinite(interval) || interval <= 0 || !Number.isFinite(start) || !Number.isFinite(end)) {
    return [];
  }

  return range(start, end, interval)
    .map((timestamp, index) => {
      const pseudoLocalMs = (timestamp + utcOffsetSeconds) * 1000;
      const pseudoLocalDate = new Date(pseudoLocalMs);
      const localDate = `${pseudoLocalDate.getUTCFullYear()}-${pad2(pseudoLocalDate.getUTCMonth() + 1)}-${pad2(pseudoLocalDate.getUTCDate())}`;

      if (localDate !== meta.date) {
        return null;
      }

      const weatherCode = getVariableValue(hourly, 4, index);
      const windSpeed = getVariableValue(hourly, 5, index);
      const dewPoint = getVariableValue(hourly, 6, index);
      const precipitation = getVariableValue(hourly, 2, index);
      const rain = getVariableValue(hourly, 3, index);
      const isRainy = resolveRainState(weatherCode, precipitation, rain);
      const hour = pseudoLocalDate.getUTCHours();

      return {
        ...target,
        id: `${target.id}-${pad2(hour)}`,
        transformerId: target.id,
        requestedDate: meta.date,
        requestedTime: `${pad2(hour)}:00`,
        hour,
        timeLabel: `${pad2(hour)}:00`,
        displayTime: formatHourDisplay(hour),
        observationTime: formatPseudoLocalDateTime(pseudoLocalMs),
        sourceKey: meta.endpoint.key,
        sourceLabel: meta.endpoint.label,
        timezone: response.timezone?.() || '',
        timezoneAbbreviation: response.timezoneAbbreviation?.() || '',
        temperature: getVariableValue(hourly, 0, index),
        humidity: getVariableValue(hourly, 1, index),
        precipitation,
        rain,
        weatherCode,
        windSpeed,
        dewPoint,
        weatherLabel: getWeatherCodeLabel(weatherCode),
        isRainy,
        dryLabel: isRainy ? 'Rain / wet' : 'Dry',
      };
    })
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeDateInput(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return value;
  }

  return getLocalDateInput();
}

function normalizeTimeInput(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})/);
  if (!match) {
    return '12:00';
  }

  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function parseLocalDateStart(dateString) {
  const [year, month, day] = normalizeDateInput(dateString).split('-').map(Number);
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getPseudoLocalTimestamp(dateString, timeString) {
  const [year, month, day] = normalizeDateInput(dateString).split('-').map(Number);
  const [hours, minutes] = normalizeTimeInput(timeString).split(':').map(Number);
  return Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
}

function formatPseudoLocalDateTime(timestampMs) {
  const date = new Date(timestampMs);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function formatHourDisplay(hour) {
  const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
  const period = safeHour >= 12 ? 'PM' : 'AM';
  return `${safeHour % 12 || 12} ${period}`;
}

function range(start, stop, step) {
  const length = Math.max(0, Math.ceil((stop - start) / step));
  return Array.from({ length }, (_, index) => start + index * step);
}

function findNearestWeatherIndex(timestamps, utcOffsetSeconds, targetTimeMs) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  timestamps.forEach((timestamp, index) => {
    const distance = Math.abs((timestamp + utcOffsetSeconds) * 1000 - targetTimeMs);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function getVariableValue(hourly, variableIndex, valueIndex) {
  const values = hourly.variables(variableIndex)?.valuesArray();
  if (!values) {
    return null;
  }

  const value = Number(values[valueIndex]);
  return Number.isFinite(value) ? value : null;
}

function resolveRainState(weatherCode, precipitation, rain) {
  const roundedCode = Math.round(Number(weatherCode));
  const rainAmount = Number.isFinite(rain) ? rain : 0;
  const precipitationAmount = Number.isFinite(precipitation) ? precipitation : 0;

  if (rainAmount > 0.05 || precipitationAmount > 0.05) {
    return true;
  }

  return (
    (roundedCode >= 51 && roundedCode <= 67) ||
    (roundedCode >= 80 && roundedCode <= 82) ||
    roundedCode >= 95
  );
}
