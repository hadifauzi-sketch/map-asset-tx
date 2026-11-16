import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_WEATHER_OPTIONS,
  buildObservationsFromRecords,
  buildRecordsFromObservations,
  buildWeatherRequestUrl,
  fetchTransformerHourlyWeather,
  fetchTransformerWeather,
  getLocalDateInput,
} from './weatherService';
import { weatherObservationService } from './weatherObservationService';
import { useDraggablePanel } from './useDraggablePanel';

/**
 * Weather map tool: Open-Meteo readings for the visible transformers (with a
 * Supabase-cached fallback), the hourly chart for the selected transformer and
 * the draggable tool panel. Moved out of App.jsx unchanged; the returned names
 * match the ones App used before, so call sites are untouched.
 *
 * @param {object}   params
 * @param {object[]} params.transformers         transformers currently shown on the map
 * @param {object?}  params.selectedTransformer  transformer selected on the map / sidebar
 */
export function useWeatherTool({ transformers, selectedTransformer }) {
  const [isWeatherToolOpen, setIsWeatherToolOpen] = useState(false);
  const [weatherLayerEnabled, setWeatherLayerEnabled] = useState(true);
  const [weatherDate, setWeatherDate] = useState(() => getLocalDateInput());
  const [weatherTime, setWeatherTime] = useState('12:00');
  const [weatherOptions, setWeatherOptions] = useState(DEFAULT_WEATHER_OPTIONS);
  const [weatherRecords, setWeatherRecords] = useState([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState(null);
  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
  const [weatherStoredNotice, setWeatherStoredNotice] = useState('');
  const [weatherObservations, setWeatherObservations] = useState([]);
  const [isWeatherHourlyChartOpen, setIsWeatherHourlyChartOpen] = useState(false);
  const [isWeatherHourlyChartCollapsed, setIsWeatherHourlyChartCollapsed] = useState(false);
  const [weatherHourlySeries, setWeatherHourlySeries] = useState([]);
  const [weatherHourlyLoading, setWeatherHourlyLoading] = useState(false);
  const [weatherHourlyError, setWeatherHourlyError] = useState('');
  const panel = useDraggablePanel(isWeatherToolOpen);
  const setWeatherPanelPosition = panel.setPosition;

  const handleWeatherOptionChange = useCallback((optionKey, checked) => {
    setWeatherOptions((current) => ({
      ...current,
      [optionKey]: checked,
    }));
  }, []);

  const handleWeatherSampleDateChange = useCallback((sampleDate) => {
    if (!sampleDate) {
      return;
    }

    setWeatherDate(sampleDate);
    setWeatherTime('12:00');
    setWeatherLayerEnabled(true);
    if (!isWeatherToolOpen) {
      setWeatherPanelPosition(null);
    }
    setIsWeatherToolOpen(true);
    setWeatherRefreshKey((current) => current + 1);
  }, [isWeatherToolOpen, setWeatherPanelPosition]);

  const handleToggleWeatherHourlyChart = useCallback(() => {
    if (!selectedTransformer) {
      return;
    }

    if (!isWeatherHourlyChartOpen) {
      setIsWeatherHourlyChartCollapsed(false);
      setIsWeatherHourlyChartOpen(true);
      return;
    }

    setIsWeatherHourlyChartCollapsed((current) => !current);
  }, [isWeatherHourlyChartOpen, selectedTransformer]);

  useEffect(() => {
    if (selectedTransformer) {
      return;
    }

    setIsWeatherHourlyChartOpen(false);
    setIsWeatherHourlyChartCollapsed(false);
    setWeatherHourlySeries([]);
  }, [selectedTransformer]);

  useEffect(() => {
    if (!isWeatherToolOpen) {
      return undefined;
    }

    const controller = new AbortController();
    let ignore = false;

    async function loadWeather() {
      setWeatherLoading(true);
      setWeatherError('');
      setWeatherStoredNotice('');

      // Loaded up front so there is something to fall back on if the API call fails.
      let observations = [];
      try {
        observations = await weatherObservationService.getByDate(weatherDate);
        if (!ignore) {
          setWeatherObservations(observations);
        }
      } catch (err) {
        console.error('Failed to load saved weather observations:', err);
      }

      try {
        const records = await fetchTransformerWeather(
          transformers,
          {
            date: weatherDate,
            time: weatherTime,
          },
          {
            signal: controller.signal,
          }
        );

        if (ignore) {
          return;
        }

        setWeatherRecords(records);
        setWeatherUpdatedAt(new Date().toISOString());

        if (records.length === 0) {
          setWeatherError('No mapped assets have coordinates for weather lookup.');
        }

        // Cache one reading per site so the panel still works if Open-Meteo goes down.
        try {
          await weatherObservationService.upsertMany(buildObservationsFromRecords(records, weatherDate));
        } catch (err) {
          console.error('Failed to cache weather observations:', err);
        }
      } catch (err) {
        if (ignore || err?.name === 'AbortError') {
          return;
        }

        console.error('Failed to load Open-Meteo weather:', err);

        const storedRecords = buildRecordsFromObservations(
          transformers,
          observations,
          weatherDate
        );

        setWeatherRecords(storedRecords);

        if (storedRecords.length > 0) {
          setWeatherStoredNotice(
            `Open-Meteo unreachable - showing saved readings for ${weatherDate}.`
          );
          setWeatherError('');
        } else {
          setWeatherError(
            err?.message || 'Unable to load Open-Meteo weather for the selected date and time.'
          );
        }
      } finally {
        if (!ignore) {
          setWeatherLoading(false);
        }
      }
    }

    loadWeather();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [transformers, isWeatherToolOpen, weatherDate, weatherRefreshKey, weatherTime]);

  useEffect(() => {
    if (!isWeatherHourlyChartOpen || !selectedTransformer) {
      if (!isWeatherHourlyChartOpen) {
        setWeatherHourlyLoading(false);
        setWeatherHourlyError('');
      }
      return undefined;
    }

    const controller = new AbortController();
    let ignore = false;

    async function loadHourlyWeather() {
      setWeatherHourlyLoading(true);
      setWeatherHourlyError('');

      try {
        const series = await fetchTransformerHourlyWeather(
          selectedTransformer,
          {
            date: weatherDate,
          },
          {
            signal: controller.signal,
          }
        );

        if (ignore) {
          return;
        }

        setWeatherHourlySeries(series);

        if (series.length === 0) {
          setWeatherHourlyError('No hourly weather is available for the selected site and date.');
        }
      } catch (err) {
        if (ignore || err?.name === 'AbortError') {
          return;
        }

        console.error('Failed to load hourly Open-Meteo weather:', err);
        setWeatherHourlySeries([]);
        setWeatherHourlyError(err?.message || 'Unable to load hourly weather for the selected site.');
      } finally {
        if (!ignore) {
          setWeatherHourlyLoading(false);
        }
      }
    }

    loadHourlyWeather();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isWeatherHourlyChartOpen, selectedTransformer, weatherDate, weatherRefreshKey]);

  const selectedWeatherRecords = useMemo(() => {
    if (!selectedTransformer) {
      return [];
    }

    const selectedTransformerId = String(selectedTransformer.id);
    return weatherRecords.filter((record) => String(record.id) === selectedTransformerId);
  }, [selectedTransformer, weatherRecords]);

  const weatherPanelEmptyMessage = selectedTransformer
    ? 'No weather record is available for the selected site yet.'
    : 'Select a site on the map to show its weather history here.';

  // The exact Open-Meteo request behind the numbers on screen, as a browser-readable
  // JSON URL for the selected site so it can be opened or copied straight from the panel.
  const weatherApiUrl = useMemo(
    () => buildWeatherRequestUrl(selectedTransformer, { date: weatherDate }),
    [selectedTransformer, weatherDate]
  );

  return {
    isWeatherToolOpen,
    setIsWeatherToolOpen,
    weatherLayerEnabled,
    setWeatherLayerEnabled,
    weatherDate,
    setWeatherDate,
    weatherTime,
    setWeatherTime,
    weatherOptions,
    setWeatherOptions,
    weatherRecords,
    setWeatherRecords,
    weatherLoading,
    weatherError,
    weatherUpdatedAt,
    weatherRefreshKey,
    setWeatherRefreshKey,
    weatherStoredNotice,
    weatherObservations,
    weatherPanelPosition: panel.position,
    setWeatherPanelPosition,
    isWeatherPanelDragging: panel.isDragging,
    weatherPanelLayerRef: panel.layerRef,
    weatherPanelRef: panel.panelRef,
    isWeatherHourlyChartOpen,
    setIsWeatherHourlyChartOpen,
    isWeatherHourlyChartCollapsed,
    setIsWeatherHourlyChartCollapsed,
    weatherHourlySeries,
    weatherHourlyLoading,
    weatherHourlyError,
    selectedWeatherRecords,
    weatherPanelEmptyMessage,
    weatherApiUrl,
    handleWeatherOptionChange,
    handleWeatherSampleDateChange,
    handleToggleWeatherHourlyChart,
    handleWeatherPanelDragStart: panel.onDragStart,
    handleWeatherPanelDragMove: panel.onDragMove,
    handleWeatherPanelDragEnd: panel.onDragEnd,
  };
}
