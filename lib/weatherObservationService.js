import { supabase } from './supabaseClient';

export const WEATHER_SOURCE_API = 'api';
export const WEATHER_SOURCE_MANUAL = 'manual';

const TABLE = 'weather_observations';

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toRow(observation) {
  return {
    site_name: observation.siteName,
    observed_date: observation.observedDate,
    source: observation.source === WEATHER_SOURCE_API ? WEATHER_SOURCE_API : WEATHER_SOURCE_MANUAL,
    temperature: toNumberOrNull(observation.temperature),
    humidity: toNumberOrNull(observation.humidity),
    rain: toNumberOrNull(observation.rain),
    precipitation: toNumberOrNull(observation.precipitation),
    wind_speed: toNumberOrNull(observation.windSpeed),
    dew_point: toNumberOrNull(observation.dewPoint),
    weather_code: toNumberOrNull(observation.weatherCode),
    weather_label: observation.weatherLabel || '',
    is_rainy: Boolean(observation.isRainy),
    observation_time: observation.observationTime || '',
    timezone: observation.timezone || '',
    timezone_abbreviation: observation.timezoneAbbreviation || '',
    note: observation.note || '',
  };
}

function fromRow(row) {
  return {
    id: row.id,
    siteName: row.site_name || '',
    observedDate: row.observed_date,
    source: row.source,
    temperature: toNumberOrNull(row.temperature),
    humidity: toNumberOrNull(row.humidity),
    rain: toNumberOrNull(row.rain),
    precipitation: toNumberOrNull(row.precipitation),
    windSpeed: toNumberOrNull(row.wind_speed),
    dewPoint: toNumberOrNull(row.dew_point),
    weatherCode: toNumberOrNull(row.weather_code),
    weatherLabel: row.weather_label || '',
    isRainy: Boolean(row.is_rainy),
    observationTime: row.observation_time || '',
    timezone: row.timezone || '',
    timezoneAbbreviation: row.timezone_abbreviation || '',
    note: row.note || '',
    updatedAt: row.updated_at,
  };
}

export const weatherObservationService = {
  async getByDate(observedDate) {
    if (!observedDate) {
      return [];
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('observed_date', observedDate);

    if (error) throw error;
    return (data || []).map(fromRow);
  },

  async getForSiteAndDate(siteName, observedDate) {
    if (!siteName || !observedDate) {
      return [];
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('site_name', siteName)
      .eq('observed_date', observedDate);

    if (error) throw error;
    return (data || []).map(fromRow);
  },

  async upsert(observation) {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert([toRow(observation)], { onConflict: 'site_name,observed_date,source' })
      .select()
      .single();

    if (error) throw error;
    return fromRow(data);
  },

  async upsertMany(observations) {
    const rows = observations.map(toRow).filter((row) => row.site_name && row.observed_date);

    if (rows.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from(TABLE)
      .upsert(rows, { onConflict: 'site_name,observed_date,source' })
      .select();

    if (error) throw error;
    return (data || []).map(fromRow);
  },

  async remove(siteName, observedDate, source = WEATHER_SOURCE_MANUAL) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('site_name', siteName)
      .eq('observed_date', observedDate)
      .eq('source', source);

    if (error) throw error;
  },
};
