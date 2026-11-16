import { useCallback, useState } from 'react';
import {
  DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS,
  DEFAULT_ESRI_LANDSAT_RENDERING_RULE,
  DEFAULT_LST_SOURCE_ID,
  ESRI_LANDSAT_LEVEL2_IMAGE_SERVICE_URL,
  getComparisonLSTDate,
  getDefaultLSTDate,
  getLSTSource,
  normalizeLSTDate,
} from './lstService';
import { useDraggablePanel } from './useDraggablePanel';

/**
 * Land-surface-temperature (LST / UHI) map tool: overlay settings, compare
 * mode and the draggable tool panel. Moved out of App.jsx unchanged; the
 * returned names match the ones App used before, so call sites are untouched.
 */
export function useLstTool() {
  const [isLSTToolOpen, setIsLSTToolOpen] = useState(false);
  const [lstLayerEnabled, setLSTLayerEnabled] = useState(true);
  const [lstDate, setLSTDate] = useState(() => getDefaultLSTDate());
  const [lstCompareDate, setLSTCompareDate] = useState(() => getComparisonLSTDate(getDefaultLSTDate()));
  const [lstSourceId, setLSTSourceId] = useState(DEFAULT_LST_SOURCE_ID);
  const [lstArcgisServiceUrl, setLSTArcgisServiceUrl] = useState(ESRI_LANDSAT_LEVEL2_IMAGE_SERVICE_URL);
  const [lstArcgisToken, setLSTArcgisToken] = useState('');
  const [lstArcgisRasterFunction, setLSTArcgisRasterFunction] = useState(DEFAULT_ESRI_LANDSAT_RENDERING_RULE);
  const [lstArcgisWindowDays, setLSTArcgisWindowDays] = useState(DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS);
  const [lstOpacity, setLSTOpacity] = useState(0.74);
  const [lstCompareEnabled, setLSTCompareEnabled] = useState(false);
  const [lstCompareSplit, setLSTCompareSplit] = useState(50);
  const [lstRefreshKey, setLSTRefreshKey] = useState(0);
  const panel = useDraggablePanel(isLSTToolOpen);
  const setLSTPanelPosition = panel.setPosition;

  const handleLSTDateChange = useCallback((dateValue) => {
    const nextDate = normalizeLSTDate(dateValue, lstDate);
    setLSTDate(nextDate);
    setLSTLayerEnabled(true);
    setLSTCompareDate((current) => current || getComparisonLSTDate(nextDate));
  }, [lstDate]);

  const handleLSTCompareDateChange = useCallback((dateValue) => {
    setLSTCompareDate((current) =>
      normalizeLSTDate(dateValue, current || getComparisonLSTDate(lstDate))
    );
  }, [lstDate]);

  const handleLSTSampleDateChange = useCallback((sampleDate) => {
    if (!sampleDate) {
      return;
    }

    const nextDate = normalizeLSTDate(sampleDate, lstDate);
    setLSTDate(nextDate);
    setLSTLayerEnabled(true);
    setLSTCompareDate((current) => current || getComparisonLSTDate(nextDate));
    if (!isLSTToolOpen) {
      setLSTPanelPosition(null);
    }
    setIsLSTToolOpen(true);
    setLSTRefreshKey((current) => current + 1);
  }, [isLSTToolOpen, lstDate, setLSTPanelPosition]);

  const handleUsePreviousLSTYear = useCallback(() => {
    setLSTCompareDate(getComparisonLSTDate(lstDate));
    setLSTCompareEnabled(true);
  }, [lstDate]);

  const handleLSTOpacityChange = useCallback((value) => {
    const nextOpacity = Number(value);
    setLSTOpacity(Number.isFinite(nextOpacity) ? Math.min(1, Math.max(0.3, nextOpacity)) : 0.74);
  }, []);

  const handleLSTCompareSplitChange = useCallback((value) => {
    const nextSplit = Number(value);
    setLSTCompareSplit(Number.isFinite(nextSplit) ? Math.min(80, Math.max(20, nextSplit)) : 50);
  }, []);

  const handleLSTSourceChange = useCallback((sourceId) => {
    const nextSource = getLSTSource(sourceId);
    setLSTSourceId(sourceId);
    setLSTLayerEnabled(true);
    if (nextSource.dateMode === 'static') {
      setLSTCompareEnabled(false);
    }
    setLSTRefreshKey((current) => current + 1);
  }, []);

  const handleLSTArcgisWindowDaysChange = useCallback((value) => {
    const nextWindowDays = Number(value);
    setLSTArcgisWindowDays(
      Number.isFinite(nextWindowDays)
        ? Math.min(180, Math.max(1, Math.round(nextWindowDays)))
        : DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS
    );
  }, []);

  return {
    isLSTToolOpen,
    setIsLSTToolOpen,
    lstLayerEnabled,
    setLSTLayerEnabled,
    lstDate,
    setLSTDate,
    lstCompareDate,
    setLSTCompareDate,
    lstSourceId,
    setLSTSourceId,
    lstArcgisServiceUrl,
    setLSTArcgisServiceUrl,
    lstArcgisToken,
    setLSTArcgisToken,
    lstArcgisRasterFunction,
    setLSTArcgisRasterFunction,
    lstArcgisWindowDays,
    setLSTArcgisWindowDays,
    lstOpacity,
    setLSTOpacity,
    lstCompareEnabled,
    setLSTCompareEnabled,
    lstCompareSplit,
    setLSTCompareSplit,
    lstRefreshKey,
    setLSTRefreshKey,
    lstPanelPosition: panel.position,
    setLSTPanelPosition,
    isLSTPanelDragging: panel.isDragging,
    lstPanelLayerRef: panel.layerRef,
    lstPanelRef: panel.panelRef,
    handleLSTDateChange,
    handleLSTCompareDateChange,
    handleLSTSampleDateChange,
    handleUsePreviousLSTYear,
    handleLSTOpacityChange,
    handleLSTCompareSplitChange,
    handleLSTSourceChange,
    handleLSTArcgisWindowDaysChange,
    handleLSTPanelDragStart: panel.onDragStart,
    handleLSTPanelDragMove: panel.onDragMove,
    handleLSTPanelDragEnd: panel.onDragEnd,
  };
}
