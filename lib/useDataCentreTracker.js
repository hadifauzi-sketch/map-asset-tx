import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { DEFAULT_DC_SETTINGS, dataCentreSource, filterDataCentres, readDataCentreSettings, writeDataCentreSettings } from './dataCentres';

// Invoked once by App so settings, data and filters are shared across both maps.
export function useDataCentreTracker() {
  const [settings, setSettings] = useState(readDataCentreSettings);
  const [dataBySource, setDataBySource] = useState({});
  const [status, setStatus] = useState({ state: 'idle' });
  const [retry, setRetry] = useState(0);
  const needed = settings.enabled || settings.panelOpen;
  const source = dataCentreSource(settings.source || 'seafic');
  const data = dataBySource[source.id] || null;
  useEffect(() => {
    if (!settings.source) setSettings((current) => ({ ...DEFAULT_DC_SETTINGS, enabled: current.enabled, panelOpen: current.panelOpen, markerScale: current.markerScale }));
  }, [settings.source]);
  useEffect(() => { writeDataCentreSettings(settings); }, [settings]);
  useEffect(() => {
    if (!needed) return undefined;
    if (data) { setStatus({ state: 'ok' }); return undefined; }
    const controller = new AbortController();
    setStatus({ state: 'loading' });
    fetch(`${import.meta.env.BASE_URL}${source.file}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Data file returned HTTP ${response.status}`);
        return response.json();
      })
      .then((result) => {
        if (!Array.isArray(result.rows) || result.metadata?.schemaVersion !== source.schemaVersion) throw new Error('Data centre file has an unexpected format.');
        if (controller.signal.aborted) return;
        setDataBySource((current) => ({ ...current, [source.id]: { ...result, rows: result.rows.map((row) => ({ ...row, source: source.id })) } }));
        setStatus({ state: 'ok' });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus({ state: 'error', text: error.message || 'Unable to load data centres.' });
      });
    return () => controller.abort();
  }, [needed, source, data, retry]);
  const query = useDeferredValue(settings.query);
  const facilities = useMemo(() => filterDataCentres(data?.rows || [], { ...settings, query }),
    [data, settings.country, settings.operator, settings.status, settings.state, settings.location, query]);
  const retryLoad = useCallback(() => setRetry((current) => current + 1), []);
  // Memoised so the memoised 2D MapView (and the 3D view) only re-render when the
  // tracker's data actually changes, not on every App render.
  return useMemo(
    () => ({ settings, setSettings, data, status, facilities, retry: retryLoad }),
    [settings, data, status, facilities, retryLoad]
  );
}
