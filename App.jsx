import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import L from 'leaflet';
import {
  AlertTriangle,
  Box,
  CloudSun,
  FileText,
  LogOut,
  MapPin,
  Menu,
  Move,
  Plus,
  Minus,
  Power,
  RotateCcw,
  Settings as SettingsIcon,
  TestTubeDiagonal,
  ThermometerSun,
  UserCircle2,
  Wrench,
  X,
} from 'lucide-react';
import TransformerMarker from './components/TransformerMarker';
import TransformerSidebar from './components/TransformerSidebar';
import NoticeDialog from './components/NoticeDialog';
import ConfirmDialog from './components/ConfirmDialog';
import AppInfoDialog from './components/AppInfoDialog';
import AppOnboardingTour, { readTourEnabled, writeTourEnabled } from './components/AppOnboardingTour';
import GeoSearchControl from './components/GeoSearchControl';
import MapLocationContextMenu from './components/MapLocationContextMenu';
import LSTMapLayer from './components/LSTMapLayer';
import MountWhenOpened from './components/MountWhenOpened';
import WeatherMapLayer from './components/WeatherMapLayer';
import PowerGridControl from './components/PowerGridControl';
import PowerGridMapLayer from './components/PowerGridMapLayer';
import DataCentreControl from './components/DataCentreControl';
import DataCentreMapLayer from './components/DataCentreMapLayer';
import { useDataCentreTracker } from './lib/useDataCentreTracker';
import { readPowerGridState, writePowerGridState } from './lib/powerGridMap';
import CompanyBoundaryMapLayer from './components/CompanyBoundaryMapLayer';
import FloorPlanMapLayer from './components/FloorPlanMapLayer';
import { AppTooltip } from './components/ui/app-tooltip';
import { Badge } from './components/ui/badge';
import { Switch } from './components/ui/switch';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import SignIn, {
  clearSession,
  getSessionIdleRemainingMs,
  readSession,
  touchSessionActivity,
} from './components/Authentic/sign-in';
import { getStandardOptionsForOilType } from './lib/dga/appConfig';
import { analyzeSample } from './lib/dga/diagnostics';
import {
  createDraftFloorPlan,
  findTransformersInsidePolygon,
  getPolygonCentroid,
  isPointInsidePolygon,
  normalizeFloorPlan,
} from './lib/floorPlanStorage';
import { floorPlanService } from './lib/floorPlanService';
import { resolveAssetPlacement } from './lib/assetPlacement';
import { createDraftCompanyBoundary, normalizeCompanyBoundary } from './lib/companyBoundaryStorage';
import { companyBoundaryService } from './lib/companyBoundaryService';
import { getTransformerState, inferMalaysianStateFromText } from './lib/malaysiaStates';
import { MAP_BASE_LAYERS, SATELLITE_LABELS_LAYER } from './lib/mapBaseLayers';
import { documentService } from './lib/documentService';
import { oilTestService } from './lib/oilTestService';
import { isSameImportedOilTestPayload } from './lib/oilTestImportUtils';
import { createTransformerDraft } from './lib/transformerDraft';
import { INTENT_RESULT, matchLimsRecordToAsset, subscribeToLimsBridge } from './lib/limsBridge';
import {
  ASSET_OWNER_FILTERS,
  matchesAssetOwnerFilter,
  normalizeAssetOwnerFilter,
  normalizeAssetOwnerType,
} from './lib/assetOwner';
import {
  DEFAULT_WEATHER_OPTIONS,
  buildObservationsFromRecords,
  buildRecordsFromObservations,
  buildWeatherRequestUrl,
  fetchTransformerHourlyWeather,
  fetchTransformerWeather,
  getLocalDateInput,
} from './lib/weatherService';
import { weatherObservationService } from './lib/weatherObservationService';
import {
  DEFAULT_ARCGIS_MOSAIC_WINDOW_DAYS,
  DEFAULT_ESRI_LANDSAT_RENDERING_RULE,
  DEFAULT_LST_SOURCE_ID,
  ESRI_LANDSAT_LEVEL2_IMAGE_SERVICE_URL,
  LST_LAYER_SOURCE_OPTIONS,
  getComparisonLSTDate,
  getDefaultLSTDate,
  getLSTSource,
  normalizeLSTDate,
} from './lib/lstService';
import { cn } from './lib/utils';
import { transformerService } from './lib/transformerService';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
import './App.css';

// The Cesium 3D globe is a large dependency, so it is only downloaded when the
// user opens the 3D view.
const Globe3DView = lazy(() => import('./components/globe3d/Globe3DView'));

// On-demand screens are split out of the main bundle. Each loader is kept so
// the most-used ones can be prefetched when the browser is idle (see App).
const loadTransformerModal = () => import('./components/TransformerModal');
const loadTransformerDetailModal = () => import('./components/TransformerDetailModal');
const TransformerModal = lazy(loadTransformerModal);
const TransformerDetailModal = lazy(loadTransformerDetailModal);
const LocationRegisterModule = lazy(() => import('./components/location-register/LocationRegisterModule'));
const FloorPlanMetadataDialog = lazy(() => import('./components/FloorPlanMetadataDialog'));
const CompanyBoundaryMetadataDialog = lazy(() => import('./components/CompanyBoundaryMetadataDialog'));
const FloorPlanDetailModal = lazy(() => import('./components/FloorPlanDetailModal'));
const AssetManagementDialog = lazy(() => import('./components/Authentic/AssetManagement'));
const Roles = lazy(() => import('./components/Authentic/roles'));
const SOPFlowchartDialog = lazy(() => import('./components/SOPFlowchartDialog'));
// Map tool panels: only rendered while their tool is open.
const WeatherToolPanel = lazy(() => import('./components/WeatherToolPanel'));
const LSTToolPanel = lazy(() => import('./components/LSTToolPanel'));
const WeatherHourlyChart = lazy(() => import('./components/WeatherHourlyChart'));


const DEFAULT_CENTER = [3.139, 101.6869];
const DEFAULT_ZOOM = 11;
const MALAYSIA_CENTER = [4.2105, 108.9758];
const MALAYSIA_ZOOM = 6;
const MARKER_CLUSTER_DISABLE_AT_ZOOM = 15;
const THEME_STORAGE_KEY = 'transformer-asset-map-theme';
const MAP_BASE_LAYER_STORAGE_KEY = 'transformer-asset-map-base-layer';
const DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY = 'transformer-asset-map-desktop-sidebar-collapsed';
const ASSET_OWNER_FILTER_STORAGE_KEY = 'transformer-asset-map-owner-filter';
const SESSION_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
const IDLE_SIGN_OUT_MESSAGE = 'Session expired after 8 hours of inactivity. Please sign in again.';

function formatMapCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : '-';
}

function buildGoogleMapsLocationUrl(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

const FAULT_LABELS = {
  PD: 'Partial Discharge',
  T1: 'Thermal < 300 C',
  T2: 'Thermal 300-700 C',
  T3: 'Thermal > 700 C',
  'T2-H': 'Thermal 300-700 C',
  'T3-H': 'Thermal > 700 C',
  D1: 'Low Energy Discharge',
  D2: 'High Energy Discharge',
  DT: 'Mixed Fault',
  S: 'Stray Gassing',
  O: 'Overheating',
  C: 'Carbonization',
  ND: 'Not Determined',
};

const TRIANGLE_ZONE_KEYS = {
  mineral: 'triangle1',
  soybean: 'triangle3_soybean',
  rapeseed: 'triangle3_rapeseed',
  sunflower: 'triangle3_sunflower',
  synthetic: 'triangle3_synthetic',
};

const PENTAGON_ZONE_KEYS = {
  mineral: 'pentagon',
  soybean: 'pentagon3_soybean',
  rapeseed: 'pentagon3_rapeseed',
  sunflower: 'pentagon3_sunflower',
  synthetic: 'pentagon3_synthetic',
};

const FOCUSED_FAULT_OIL_TYPE = 'mineral';
const FOCUSED_FAULT_STANDARD = 'IEEE_2019';
const MAX_FOCUSED_TREND_POINTS = 8;
const MARKER_DGA_GAS_KEYS = ['h2', 'ch4', 'c2h6', 'c2h4', 'c2h2'];
const MARKER_STATUS_COLORS = {
  normal: '#16a34a',
  warning: '#eab308',
  critical: '#dc2626',
};

const FOCUSED_TREND_GAS_SERIES = [
  { key: 'h2', label: 'H2', color: '#0ea5e9' },
  { key: 'ch4', label: 'CH4', color: '#8b5cf6' },
  { key: 'c2h6', label: 'C2H6', color: '#f59e0b' },
  { key: 'c2h4', label: 'C2H4', color: '#ef4444' },
  { key: 'c2h2', label: 'C2H2', color: '#10b981' },
];

const FOCUSED_TREND_TABLE_GAS_SERIES = [
  { key: 'h2', name: 'Hydrogen', formula: 'H2', color: '#0ea5e9' },
  { key: 'ch4', name: 'Methane', formula: 'CH4', color: '#8b5cf6' },
  { key: 'c2h6', name: 'Ethane', formula: 'C2H6', color: '#f59e0b' },
  { key: 'c2h4', name: 'Ethylene', formula: 'C2H4', color: '#ef4444' },
  { key: 'c2h2', name: 'Acetylene', formula: 'C2H2', color: '#10b981' },
  { key: 'co', name: 'Carbon Monoxide', formula: 'CO', color: '#f97316' },
  { key: 'co2', name: 'Carbon Dioxide', formula: 'CO2', color: '#7c3aed' },
];

function getDateTimestamp(value) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function getSortedOilTests(oilTests = []) {
  if (!Array.isArray(oilTests) || oilTests.length === 0) {
    return [];
  }

  return [...oilTests].sort((left, right) => {
    const dateDiff = getDateTimestamp(left.testDate) - getDateTimestamp(right.testDate);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return getDateTimestamp(left.createdAt) - getDateTimestamp(right.createdAt);
  });
}

function getLatestOilTestRecord(oilTests = []) {
  const sortedOilTests = getSortedOilTests(oilTests);
  return sortedOilTests[sortedOilTests.length - 1] ?? null;
}

function getOilTestSampleDateOptions(oilTests = []) {
  const seenDates = new Set();
  return getSortedOilTests(oilTests)
    .map((test) => String(test?.testDate || '').slice(0, 10))
    .filter((testDate) => {
      if (!testDate || seenDates.has(testDate)) {
        return false;
      }
      seenDates.add(testDate);
      return true;
    })
    .reverse()
    .map((testDate) => ({
      value: testDate,
      label: new Date(`${testDate}T00:00:00`).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    }));
}

function resolveTransformerDgaPreferences(transformer) {
  const oilType = transformer?.oilType || 'mineral';
  const standardOptions = getStandardOptionsForOilType(oilType);
  const gasLimitStandard = standardOptions.some((option) => option.value === transformer?.gasLimitStandard)
    ? transformer.gasLimitStandard
    : standardOptions[0]?.value ?? 'IEEE_2019';

  return {
    oilType,
    gasLimitStandard,
  };
}

function getTransformerMarkerStatus(transformer) {
  const latestTest = getLatestOilTestRecord(transformer?.oilTests);
  if (!latestTest) {
    return 'normal';
  }

  const sampleDate = latestTest.testDate || new Date().toISOString().slice(0, 10);
  const { oilType, gasLimitStandard } = resolveTransformerDgaPreferences(transformer);

  try {
    const analysis = analyzeSample(
      {
        date: sampleDate,
        h2: latestTest?.h2,
        ch4: latestTest?.ch4,
        c2h6: latestTest?.c2h6,
        c2h4: latestTest?.c2h4,
        c2h2: latestTest?.c2h2,
        co: latestTest?.co,
        co2: latestTest?.co2,
        o2: latestTest?.o2,
        n2: latestTest?.n2,
        transformerAge: getTransformerAgeAtSample(transformer?.yearBuilt, sampleDate),
      },
      gasLimitStandard,
      oilType,
    );

    let hasWarning = false;

    for (const gasKey of MARKER_DGA_GAS_KEYS) {
      const detail = analysis.gasLimitDetails?.[gasKey];
      const value = Number(detail?.value);
      const limit = Number(detail?.activeLimit);

      if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) {
        continue;
      }

      if (value >= limit * 1.1) {
        return 'critical';
      }

      if (value >= limit * 1.05) {
        hasWarning = true;
      }
    }

    return hasWarning ? 'warning' : 'normal';
  } catch (error) {
    console.error('Failed to evaluate DGA marker status:', error);
    return 'normal';
  }
}

function formatFaultZone(zone) {
  if (!zone) {
    return 'N/A';
  }
  return FAULT_LABELS[zone] ? `${zone} - ${FAULT_LABELS[zone]}` : zone;
}

function getTransformerAgeAtSample(yearBuilt, sampleDate) {
  const builtYear = Number.parseInt(String(yearBuilt || '').slice(0, 4), 10);
  if (!Number.isFinite(builtYear)) {
    return '';
  }

  const sampleYear = new Date(sampleDate || Date.now()).getFullYear();
  if (!Number.isFinite(sampleYear)) {
    return '';
  }

  return String(Math.max(0, sampleYear - builtYear));
}

function getFocusedTrendChartMaximum(maxValue) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1;
  }

  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep || 1));
  const normalized = roughStep / magnitude;
  const niceStep = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceStep * magnitude;

  return Math.ceil(maxValue / step) * step;
}

function formatFocusedTrendAxisValue(value) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatFocusedTrendTooltipValue(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function FormulaWithSubscript({ formula = '' }) {
  const tokens = String(formula).split(/(\d+)/).filter(Boolean);
  return (
    <>
      {tokens.map((token, index) =>
        /^\d+$/.test(token) ? <sub key={`${formula}-${index}`}>{token}</sub> : <span key={`${formula}-${index}`}>{token}</span>
      )}
    </>
  );
}

const transformerIconCache = new Map();

/**
 * Returns a callback whose identity never changes but which always runs the
 * latest `fn`. Lets memoised children (TransformerMarker) skip re-rendering
 * without having to list every closure dependency of the handler.
 */
function useStableCallback(fn) {
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  return useCallback((...args) => fnRef.current(...args), []);
}

const createTransformerIcon = (color = '#0f766e') => {
  // One shared L.divIcon per colour. A fresh icon object on every render made
  // react-leaflet call setIcon() and rebuild every marker's DOM on each App render.
  const cached = transformerIconCache.get(color);
  if (cached) {
    return cached;
  }
  const icon = L.divIcon({
    className: 'custom-transformer-icon',
    html: `
      <div class="map-marker-shell" style="--marker-color: ${color}">
        <div class="map-marker-core"></div>
        <div class="map-marker-stem"></div>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
    popupAnchor: [0, -30],
  });
  transformerIconCache.set(color, icon);
  return icon;
};

const geoSearchIcon = L.divIcon({
  className: 'geo-search-pin-icon',
  html: '<div class="geo-search-pin"><div class="geo-search-pin-dot"></div></div>',
  iconSize: [34, 42],
  iconAnchor: [17, 38],
  popupAnchor: [0, -32],
});

function App() {
  const [currentUser, setCurrentUser] = useState(() => readSession());
  const [authNotice, setAuthNotice] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAssetManagementOpen, setIsAssetManagementOpen] = useState(false);
  const [isSOPOpen, setIsSOPOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourEnabled, setTourEnabled] = useState(() => readTourEnabled());
  const [appInfoDialogMode, setAppInfoDialogMode] = useState(null);
  const [transformers, setTransformers] = useState([]);
  const [selectedTransformer, setSelectedTransformer] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isGlobe3DOpen, setIsGlobe3DOpen] = useState(false);
  const [editingTransformer, setEditingTransformer] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appNotice, setAppNotice] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [mapBaseLayer, setMapBaseLayer] = useState(() => {
    if (typeof window === 'undefined') {
      return 'streets';
    }

    const storedLayer = window.localStorage.getItem(MAP_BASE_LAYER_STORAGE_KEY);
    return storedLayer && MAP_BASE_LAYERS[storedLayer] ? storedLayer : 'streets';
  });
  const [assetOwnerFilter, setAssetOwnerFilter] = useState(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }

    return normalizeAssetOwnerFilter(window.localStorage.getItem(ASSET_OWNER_FILTER_STORAGE_KEY));
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    return window.localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth >= 1024;
  });
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const storedPreference = window.localStorage.getItem(DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (storedPreference === null) {
      return true;
    }

    return storedPreference === 'true';
  });
  const [isSidebarInteracting, setIsSidebarInteracting] = useState(false);
  const [isMapToolbarExpanded, setIsMapToolbarExpanded] = useState(false);
  // Power grid overlay (substations, lines, cables…) — saved per browser.
  const [powerGridLayers, setPowerGridLayers] = useState(readPowerGridState);
  const [powerGridStatus, setPowerGridStatus] = useState({});
  const dataCentreTracker = useDataCentreTracker();
  useEffect(() => {
    writePowerGridState(powerGridLayers);
  }, [powerGridLayers]);
  const handlePowerGridStatus = useCallback((layerId, status) => {
    setPowerGridStatus((current) => ({ ...current, [layerId]: status }));
  }, []);
  const [companyBoundaries, setCompanyBoundaries] = useState([]);
  const [showCompanyBoundaries, setShowCompanyBoundaries] = useState(true);
  const [selectedCompanyBoundaryId, setSelectedCompanyBoundaryId] = useState(null);
  const [companyBoundaryDraft, setCompanyBoundaryDraft] = useState(null);
  const [isCompanyBoundaryDialogOpen, setIsCompanyBoundaryDialogOpen] = useState(false);
  const [companyBoundaryDialogDraft, setCompanyBoundaryDialogDraft] = useState(null);
  const [floorPlans, setFloorPlans] = useState([]);
  const [showFloorPlans, setShowFloorPlans] = useState(true);
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState(null);
  const [floorPlanDraft, setFloorPlanDraft] = useState(null);
  const [isFloorPlanDialogOpen, setIsFloorPlanDialogOpen] = useState(false);
  const [floorPlanDialogDraft, setFloorPlanDialogDraft] = useState(null);
  const [floorDetailFloorPlanId, setFloorDetailFloorPlanId] = useState(null);
  const [isFloorDetailModalOpen, setIsFloorDetailModalOpen] = useState(false);
  const [isDraggable, setIsDraggable] = useState(false);
  const [isLocationRegisterOpen, setIsLocationRegisterOpen] = useState(false);
  const [geoSearchSelection, setGeoSearchSelection] = useState(null);
  const [mapContextMenu, setMapContextMenu] = useState(null);
  const [sidebarSearchFocusRequest, setSidebarSearchFocusRequest] = useState(0);
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
  const [weatherPanelPosition, setWeatherPanelPosition] = useState(null);
  const [isWeatherPanelDragging, setIsWeatherPanelDragging] = useState(false);
  const [isWeatherHourlyChartOpen, setIsWeatherHourlyChartOpen] = useState(false);
  const [isWeatherHourlyChartCollapsed, setIsWeatherHourlyChartCollapsed] = useState(false);
  const [weatherHourlySeries, setWeatherHourlySeries] = useState([]);
  const [weatherHourlyLoading, setWeatherHourlyLoading] = useState(false);
  const [weatherHourlyError, setWeatherHourlyError] = useState('');
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
  const [lstPanelPosition, setLSTPanelPosition] = useState(null);
  const [isLSTPanelDragging, setIsLSTPanelDragging] = useState(false);
  const pendingFloorAssignment = useRef(null);
  const leafletMapRef = useRef(null);
  const idleSignOutTimerRef = useRef(null);
  const mapToolbarExpandedRef = useRef(null);
  const weatherPanelLayerRef = useRef(null);
  const weatherPanelRef = useRef(null);
  const weatherPanelDragRef = useRef(null);
  const lstPanelLayerRef = useRef(null);
  const lstPanelRef = useRef(null);
  const lstPanelDragRef = useRef(null);
  const isAdmin = currentUser?.role === 'admin';
  const isViewer = currentUser?.role === 'viewer';
  const canEditAssets = !currentUser || currentUser.role !== 'viewer';
  const [isMapToolbarContentMounted, setIsMapToolbarContentMounted] = useState(false);
  const [mapToolbarViewportWidth, setMapToolbarViewportWidth] = useState(0);

  const updateMapToolbarViewportWidth = useCallback(() => {
    const expandedPanel = mapToolbarExpandedRef.current;
    if (!expandedPanel) {
      return;
    }

    const nextWidth = Math.ceil(expandedPanel.scrollWidth);
    setMapToolbarViewportWidth((currentWidth) => {
      if (Math.abs(currentWidth - nextWidth) < 1) {
        return currentWidth;
      }

      return nextWidth;
    });
  }, []);

  useEffect(() => {
    if (isMapToolbarExpanded) {
      setIsMapToolbarContentMounted(true);

      if (typeof window === 'undefined') {
        updateMapToolbarViewportWidth();
        return undefined;
      }

      const frameId = window.requestAnimationFrame(() => {
        updateMapToolbarViewportWidth();
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    setMapToolbarViewportWidth(0);
    return undefined;
  }, [isMapToolbarExpanded, updateMapToolbarViewportWidth]);

  useEffect(() => {
    if (
      !isMapToolbarContentMounted ||
      !isMapToolbarExpanded ||
      typeof window === 'undefined' ||
      typeof ResizeObserver === 'undefined'
    ) {
      return undefined;
    }

    const expandedPanel = mapToolbarExpandedRef.current;
    if (!expandedPanel) {
      return undefined;
    }

    let frameId = null;
    const observer = new ResizeObserver(() => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateMapToolbarViewportWidth();
      });
    });

    observer.observe(expandedPanel);
    updateMapToolbarViewportWidth();

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isMapToolbarContentMounted, isMapToolbarExpanded, updateMapToolbarViewportWidth]);

  const clearIdleSignOutTimer = useCallback(() => {
    if (typeof window === 'undefined' || idleSignOutTimerRef.current === null) {
      return;
    }

    window.clearTimeout(idleSignOutTimerRef.current);
    idleSignOutTimerRef.current = null;
  }, []);

  const showAppNotice = useCallback((notice) => {
    setAppNotice(notice);
  }, []);

  const ensureCanEditAssets = useCallback(() => {
    if (canEditAssets) {
      return true;
    }
    showAppNotice({
      variant: 'warning',
      title: 'Read-only access',
      description: 'Viewer accounts cannot edit assets or floor plans.',
      detail: 'Contact an administrator if you need edit access.',
      contextLabel: 'Permissions',
      actionLabel: 'Close',
    });
    return false;
  }, [canEditAssets, showAppNotice]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    const preventUnhandledBrowserContextMenu = (event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable="true"], [data-allow-browser-context-menu="true"]')
      ) {
        return;
      }

      event.preventDefault();
    };

    document.addEventListener('contextmenu', preventUnhandledBrowserContextMenu);

    return () => {
      document.removeEventListener('contextmenu', preventUnhandledBrowserContextMenu);
    };
  }, [currentUser]);

  const activateSidebarInteraction = () => {
    setIsSidebarInteracting(true);
  };

  const deactivateSidebarInteraction = () => {
    setIsSidebarInteracting(false);
  };

  useEffect(() => {
    if (canEditAssets) {
      return;
    }
    setIsAddMode(false);
    setIsDraggable(false);
    pendingFloorAssignment.current = null;
  }, [canEditAssets]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(MAP_BASE_LAYER_STORAGE_KEY, mapBaseLayer);
  }, [mapBaseLayer]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(ASSET_OWNER_FILTER_STORAGE_KEY, assetOwnerFilter);
  }, [assetOwnerFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(isDesktopSidebarCollapsed)
    );
  }, [isDesktopSidebarCollapsed]);

  useEffect(() => {
    const syncSidebarState = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', syncSidebarState);
    return () => window.removeEventListener('resize', syncSidebarState);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add your project URL and anon key before loading the map.');
      setLoading(false);
      return;
    }

    if (!currentUser) {
      setLoading(false);
      return;
    }

    loadTransformers();
    loadFloorPlans();
    loadCompanyBoundaries();
  }, [currentUser]);

  useEffect(() => {
    if (!isDetailModalOpen) {
      return;
    }

    if (!selectedTransformer) {
      setIsDetailModalOpen(false);
    }
  }, [isDetailModalOpen, selectedTransformer]);

  const filteredTransformers = useMemo(
    () => transformers.filter((transformer) => matchesAssetOwnerFilter(transformer, assetOwnerFilter)),
    [assetOwnerFilter, transformers]
  );

  const assetOwnerCounts = useMemo(
    () =>
      transformers.reduce(
        (counts, transformer) => {
          const ownerType = normalizeAssetOwnerType(transformer.ownerType);
          return {
            ...counts,
            all: counts.all + 1,
            [ownerType]: (counts[ownerType] || 0) + 1,
          };
        },
        { all: 0 }
      ),
    [transformers]
  );

  const assetOwnerFilterOptions = useMemo(
    () =>
      ASSET_OWNER_FILTERS.map((option) => ({
        ...option,
        count: option.value === 'all' ? assetOwnerCounts.all : assetOwnerCounts[option.value] || 0,
      })),
    [assetOwnerCounts]
  );

  const activeAssetOwnerFilter = useMemo(
    () => ASSET_OWNER_FILTERS.find((option) => option.value === assetOwnerFilter) || ASSET_OWNER_FILTERS[0],
    [assetOwnerFilter]
  );

  useEffect(() => {
    if (!selectedTransformer || matchesAssetOwnerFilter(selectedTransformer, assetOwnerFilter)) {
      return;
    }

    setSelectedTransformer(null);
    setIsDetailModalOpen(false);
  }, [assetOwnerFilter, selectedTransformer]);

  const overviewStats = useMemo(() => {
    const oilSamples = filteredTransformers.reduce((sum, transformer) => sum + (transformer.oilTests?.length || 0), 0);
    const documents = filteredTransformers.reduce((sum, transformer) => sum + (transformer.documents?.length || 0), 0);
    const sites = new Set(filteredTransformers.map((transformer) => transformer.siteName).filter(Boolean)).size;
    return [
      { label: 'Assets', value: filteredTransformers.length, icon: Power },
      { label: 'Oil Samples', value: oilSamples, icon: TestTubeDiagonal },
      { label: 'Documents', value: documents, icon: FileText },
      { label: 'Sites', value: sites, icon: MapPin },
    ];
  }, [filteredTransformers]);

  const focusedAssetFaultSummary = useMemo(() => {
    if (!selectedTransformer) {
      return null;
    }

    const oilTests = Array.isArray(selectedTransformer.oilTests) ? selectedTransformer.oilTests : [];
    if (oilTests.length === 0) {
      return {
        ready: false,
        message: 'No oil-test record available for fault diagnostics.',
      };
    }

    const sortedOilTests = getSortedOilTests(oilTests);
    const latestTest = sortedOilTests[sortedOilTests.length - 1] ?? null;

    const fallbackDate = new Date().toISOString().slice(0, 10);
    const sampleDate = latestTest?.testDate || fallbackDate;
    const triangleKey = TRIANGLE_ZONE_KEYS[FOCUSED_FAULT_OIL_TYPE] ?? 'triangle1';
    const pentagonKey = PENTAGON_ZONE_KEYS[FOCUSED_FAULT_OIL_TYPE] ?? 'pentagon';

    try {
      const analysis = analyzeSample(
        {
          date: sampleDate,
          h2: latestTest?.h2,
          ch4: latestTest?.ch4,
          c2h6: latestTest?.c2h6,
          c2h4: latestTest?.c2h4,
          c2h2: latestTest?.c2h2,
          co: latestTest?.co,
          co2: latestTest?.co2,
          o2: latestTest?.o2,
          n2: latestTest?.n2,
          transformerAge: getTransformerAgeAtSample(selectedTransformer.yearBuilt, sampleDate),
        },
        FOCUSED_FAULT_STANDARD,
        FOCUSED_FAULT_OIL_TYPE
      );

      const gasTrendPoints = sortedOilTests
        .slice(-MAX_FOCUSED_TREND_POINTS)
        .map((test, index) => {
          const testDate = test?.testDate || fallbackDate;
          const gasValues = FOCUSED_TREND_GAS_SERIES.reduce(
            (accumulator, gas) => {
              const parsedValue = Number.parseFloat(test?.[gas.key]);
              if (Number.isFinite(parsedValue)) {
                accumulator[gas.key] = Math.max(parsedValue, 0);
                accumulator.hasValue = true;
              } else {
                accumulator[gas.key] = null;
              }
              return accumulator;
            },
            { hasValue: false }
          );

          if (!gasValues.hasValue) {
            return null;
          }

          return {
            id: test?.id ?? `${testDate}-${index}`,
            testDate,
            dateLabel: new Date(testDate).toLocaleDateString('en-GB'),
            h2: gasValues.h2,
            ch4: gasValues.ch4,
            c2h6: gasValues.c2h6,
            c2h4: gasValues.c2h4,
            c2h2: gasValues.c2h2,
            co: Number.isFinite(Number.parseFloat(test?.co)) ? Math.max(Number.parseFloat(test?.co), 0) : null,
            co2: Number.isFinite(Number.parseFloat(test?.co2)) ? Math.max(Number.parseFloat(test?.co2), 0) : null,
          };
        })
        .filter(Boolean);

      if ((analysis?.requiredGasCount ?? 0) < 5) {
        return {
          ready: false,
          message: `Latest sample (${new Date(sampleDate).toLocaleDateString()}) has insufficient gas data for Duval fault.`,
          gasTrendPoints,
        };
      }

      return {
        ready: true,
        testDateLabel: new Date(sampleDate).toLocaleDateString(),
        triangleZone: formatFaultZone(analysis?.faultZones?.[triangleKey] ?? null),
        pentagonZone: formatFaultZone(analysis?.faultZones?.[pentagonKey] ?? null),
        gasTrendPoints,
      };
    } catch (error) {
      console.error('Failed to analyze focused-asset fault summary:', error);
      return {
        ready: false,
        message: 'Unable to calculate Duval fault summary.',
      };
    }
  }, [selectedTransformer]);

  const weatherSampleDateOptions = useMemo(
    () => getOilTestSampleDateOptions(selectedTransformer?.oilTests),
    [selectedTransformer]
  );

  // DGA status per transformer (normal / warning / critical). Shared by the 2D
  // marker colours and the 3D globe view so both always agree.
  const transformerMarkerStatuses = useMemo(
    () =>
      new Map(
        filteredTransformers.map((transformer) => [
          transformer.id,
          getTransformerMarkerStatus(transformer),
        ]),
      ),
    [filteredTransformers],
  );

  const transformerMarkerColors = useMemo(
    () =>
      new Map(
        filteredTransformers.map((transformer) => [
          transformer.id,
          MARKER_STATUS_COLORS[transformerMarkerStatuses.get(transformer.id)] ?? MARKER_STATUS_COLORS.normal,
        ]),
      ),
    [filteredTransformers, transformerMarkerStatuses],
  );

  const floorPlanByTransformerId = useMemo(() => {
    const assignments = new Map();
    floorPlans.forEach((floorPlan) => {
      floorPlan.transformerIds.forEach((transformerId) => {
        assignments.set(String(transformerId), floorPlan);
      });
    });
    return assignments;
  }, [floorPlans]);

  const floorDetailFloorPlan = useMemo(
    () => floorDetailFloorPlanId ? floorPlans.find((fp) => fp.id === floorDetailFloorPlanId) || null : null,
    [floorPlans, floorDetailFloorPlanId]
  );

  const selectedCompanyBoundary = useMemo(
    () => companyBoundaries.find((boundary) => boundary.id === selectedCompanyBoundaryId) || null,
    [companyBoundaries, selectedCompanyBoundaryId]
  );

  const selectedFloorPlan = useMemo(
    () => floorPlans.find((floorPlan) => floorPlan.id === selectedFloorPlanId) || null,
    [floorPlans, selectedFloorPlanId]
  );

  // Company / parent and area come from the drawn overlays: the saved floor-plan assignment
  // first, then whichever polygon geometrically contains the asset.
  const selectedTransformerPlacement = useMemo(
    () => resolveAssetPlacement(selectedTransformer, floorPlans, companyBoundaries),
    [companyBoundaries, floorPlans, selectedTransformer]
  );

  const selectedCompanyFloors = useMemo(() => {
    if (!selectedCompanyBoundary) {
      return [];
    }

    const companyName = String(selectedCompanyBoundary.companyName || '').trim().toLowerCase();
    return floorPlans.filter(
      (floorPlan) => String(floorPlan.companyName || '').trim().toLowerCase() === companyName
    );
  }, [floorPlans, selectedCompanyBoundary]);

  const selectedCompanyAssetCount = useMemo(
    () =>
      selectedCompanyFloors.reduce(
        (total, floorPlan) => total + (Array.isArray(floorPlan.transformerIds) ? floorPlan.transformerIds.length : 0),
        0
      ),
    [selectedCompanyFloors]
  );

  const selectedFloorTransformers = useMemo(
    () =>
      selectedFloorPlan
        ? selectedFloorPlan.transformerIds
            .map((transformerId) => filteredTransformers.find((transformer) => String(transformer.id) === String(transformerId)))
            .filter(Boolean)
        : [],
    [filteredTransformers, selectedFloorPlan]
  );

  const focusTransformer = (transformer, zoom = 15) => {
    const latitude = Number(transformer?.position?.[0]);
    const longitude = Number(transformer?.position?.[1]);
    const nextCenter =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? [latitude, longitude]
        : [...DEFAULT_CENTER];

    setMapCenter(nextCenter);
    setMapZoom(zoom);
    setSelectedTransformer(transformer);
    setSelectedFloorPlanId(null);
    setSelectedCompanyBoundaryId(null);
    deactivateSidebarInteraction();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const focusFloorPlan = (floorPlan, zoom = 18) => {
    const centroid = getPolygonCentroid(floorPlan?.points || []);
    setMapCenter(centroid || [...DEFAULT_CENTER]);
    setMapZoom(zoom);
    setSelectedFloorPlanId(floorPlan?.id || null);
    setSelectedCompanyBoundaryId(null);
    setSelectedTransformer(null);
    deactivateSidebarInteraction();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const focusCompanyBoundary = (boundary, zoom = 16) => {
    const centroid = getPolygonCentroid(boundary?.points || []);
    setMapCenter(centroid || [...DEFAULT_CENTER]);
    setMapZoom(zoom);
    setSelectedCompanyBoundaryId(boundary?.id || null);
    setSelectedFloorPlanId(null);
    setSelectedTransformer(null);
    deactivateSidebarInteraction();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const focusLocationPosition = useCallback((position, zoom = 18) => {
    const latitude = Number(position?.[0]);
    const longitude = Number(position?.[1]);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    setMapCenter([latitude, longitude]);
    setMapZoom(zoom);
    deactivateSidebarInteraction();

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const handleGeoSearchPlaceSelect = (result) => {
    const latitude = Number(result?.position?.[0]);
    const longitude = Number(result?.position?.[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    setGeoSearchSelection({
      position: [latitude, longitude],
      title: result?.title || 'Search result',
      subtitle: result?.subtitle || '',
    });
    setSelectedTransformer(null);
    setSelectedFloorPlanId(null);
    setSelectedCompanyBoundaryId(null);

    const boundingBox = Array.isArray(result?.boundingBox) ? result.boundingBox : null;
    if (boundingBox?.length === 4 && leafletMapRef.current) {
      const [south, north, west, east] = boundingBox.map(Number);
      if ([south, north, west, east].every(Number.isFinite) && south !== north && west !== east) {
        const bounds = L.latLngBounds([south, west], [north, east]);
        const targetCenter = bounds.getCenter();
        const boundsZoom = leafletMapRef.current.getBoundsZoom(bounds, false, L.point(80, 80));
        const targetZoom = Number.isFinite(boundsZoom) ? Math.min(boundsZoom, 17) : 17;
        focusLocationPosition([targetCenter.lat, targetCenter.lng], Math.max(targetZoom, 3));
        return;
      }
    }

    focusLocationPosition([latitude, longitude], 17);
  };

  const handleWeatherOptionChange = useCallback((optionKey, checked) => {
    setWeatherOptions((current) => ({
      ...current,
      [optionKey]: checked,
    }));
  }, []);

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
  }, [isLSTToolOpen, lstDate]);

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

  const getConstrainedWeatherPanelPosition = useCallback((left, top) => {
    const layer = weatherPanelLayerRef.current;
    const panel = weatherPanelRef.current;

    if (!layer || !panel) {
      return { left, top };
    }

    const layerRect = layer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 12;
    const maxLeft = Math.max(margin, layerRect.width - panelRect.width - margin);
    const maxTop = Math.max(margin, layerRect.height - panelRect.height - margin);

    return {
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop),
    };
  }, []);

  const handleWeatherPanelDragStart = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const layer = weatherPanelLayerRef.current;
    const panel = weatherPanelRef.current;

    if (!layer || !panel) {
      return;
    }

    const layerRect = layer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const startPosition = getConstrainedWeatherPanelPosition(
      panelRect.left - layerRect.left,
      panelRect.top - layerRect.top
    );

    weatherPanelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: startPosition.left,
      startTop: startPosition.top,
    };

    setWeatherPanelPosition(startPosition);
    setIsWeatherPanelDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [getConstrainedWeatherPanelPosition]);

  const handleWeatherPanelDragMove = useCallback((event) => {
    const dragState = weatherPanelDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    // Move the panel straight in the DOM while dragging; React state is
    // committed once on drag end, so App does not re-render per pointer move.
    const nextPosition = getConstrainedWeatherPanelPosition(
      dragState.startLeft + event.clientX - dragState.startX,
      dragState.startTop + event.clientY - dragState.startY
    );
    dragState.latest = nextPosition;
    const panel = weatherPanelRef.current;
    if (panel) {
      panel.style.left = `${nextPosition.left}px`;
      panel.style.top = `${nextPosition.top}px`;
    }
    event.preventDefault();
  }, [getConstrainedWeatherPanelPosition]);

  const handleWeatherPanelDragEnd = useCallback((event) => {
    const dragState = weatherPanelDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    weatherPanelDragRef.current = null;
    if (dragState.latest) {
      setWeatherPanelPosition(dragState.latest);
    }
    setIsWeatherPanelDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const getConstrainedLSTPanelPosition = useCallback((left, top) => {
    const layer = lstPanelLayerRef.current;
    const panel = lstPanelRef.current;

    if (!layer || !panel) {
      return { left, top };
    }

    const layerRect = layer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 12;
    const maxLeft = Math.max(margin, layerRect.width - panelRect.width - margin);
    const maxTop = Math.max(margin, layerRect.height - panelRect.height - margin);

    return {
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop),
    };
  }, []);

  const handleLSTPanelDragStart = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const layer = lstPanelLayerRef.current;
    const panel = lstPanelRef.current;

    if (!layer || !panel) {
      return;
    }

    const layerRect = layer.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const startPosition = getConstrainedLSTPanelPosition(
      panelRect.left - layerRect.left,
      panelRect.top - layerRect.top
    );

    lstPanelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: startPosition.left,
      startTop: startPosition.top,
    };

    setLSTPanelPosition(startPosition);
    setIsLSTPanelDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [getConstrainedLSTPanelPosition]);

  const handleLSTPanelDragMove = useCallback((event) => {
    const dragState = lstPanelDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    // Same as the weather panel: DOM-only while dragging, one state commit on end.
    const nextPosition = getConstrainedLSTPanelPosition(
      dragState.startLeft + event.clientX - dragState.startX,
      dragState.startTop + event.clientY - dragState.startY
    );
    dragState.latest = nextPosition;
    const panel = lstPanelRef.current;
    if (panel) {
      panel.style.left = `${nextPosition.left}px`;
      panel.style.top = `${nextPosition.top}px`;
    }
    event.preventDefault();
  }, [getConstrainedLSTPanelPosition]);

  const handleLSTPanelDragEnd = useCallback((event) => {
    const dragState = lstPanelDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    lstPanelDragRef.current = null;
    if (dragState.latest) {
      setLSTPanelPosition(dragState.latest);
    }
    setIsLSTPanelDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
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
  }, [isWeatherToolOpen]);

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
    if (!isWeatherToolOpen || !weatherPanelPosition) {
      return undefined;
    }

    const handleResize = () => {
      setWeatherPanelPosition((current) => {
        if (!current) {
          return current;
        }

        const nextPosition = getConstrainedWeatherPanelPosition(current.left, current.top);
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
  }, [getConstrainedWeatherPanelPosition, isWeatherToolOpen, weatherPanelPosition]);

  useEffect(() => {
    if (!isLSTToolOpen || !lstPanelPosition) {
      return undefined;
    }

    const handleResize = () => {
      setLSTPanelPosition((current) => {
        if (!current) {
          return current;
        }

        const nextPosition = getConstrainedLSTPanelPosition(current.left, current.top);
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
  }, [getConstrainedLSTPanelPosition, isLSTToolOpen, lstPanelPosition]);

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
          filteredTransformers,
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
          filteredTransformers,
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
  }, [filteredTransformers, isWeatherToolOpen, weatherDate, weatherRefreshKey, weatherTime]);

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

  const handleWeatherRecordSelect = useCallback((record) => {
    const nextTransformer = filteredTransformers.find(
      (transformer) => String(transformer.id) === String(record?.id)
    );

    if (!nextTransformer) {
      return;
    }

    setSelectedTransformer(nextTransformer);
    setSelectedFloorPlanId(null);
    setSelectedCompanyBoundaryId(null);
    setGeoSearchSelection(null);
  }, [filteredTransformers]);

  const loadFloorPlans = async () => {
    try {
      await floorPlanService.migrateFromLocalStorage();
      const data = await floorPlanService.getAll();
      setFloorPlans(data);
    } catch (err) {
      console.error('Failed to load floor plans:', err);
    }
  };

  const loadCompanyBoundaries = async () => {
    try {
      const data = await companyBoundaryService.getAll();
      setCompanyBoundaries(data);
    } catch (err) {
      console.error('Failed to load company boundaries:', err);
      showAppNotice({
        variant: 'warning',
        title: 'Company boundary table not ready',
        description: 'The parent boundary layer needs the company_boundaries database table.',
        detail: err?.message || 'Run the latest Supabase migration, then refresh the app.',
        contextLabel: 'Company boundaries',
      });
    }
  };

  const handleOpenFloorDetail = useCallback((floorPlan) => {
    if (!floorPlan) return;
    setFloorDetailFloorPlanId(floorPlan.id);
    setIsFloorDetailModalOpen(true);
  }, []);

  const handleRemoveTransformerFromFloor = useCallback(async (floorPlanId, transformerId) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    const floorPlan = floorPlans.find((fp) => fp.id === floorPlanId);
    if (!floorPlan) return;
    const updatedIds = floorPlan.transformerIds.filter((id) => String(id) !== String(transformerId));
    try {
      await floorPlanService.updateTransformerIds(floorPlanId, updatedIds);
      setFloorPlans((prev) =>
        prev.map((fp) => fp.id === floorPlanId ? { ...fp, transformerIds: updatedIds } : fp)
      );
    } catch (err) {
      console.error('Failed to remove transformer from floor:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to update floor plan',
        description: 'The transformer assignment could not be updated yet.',
        detail: err?.message || 'Failed to update floor plan. Please try again.',
        contextLabel: 'Floor plan',
      });
    }
  }, [ensureCanEditAssets, floorPlans, showAppNotice]);

  const handleFloorDetailAddTransformer = useCallback((position, floorPlanId) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    pendingFloorAssignment.current = floorPlanId;
    setEditingTransformer(createTransformerDraft({
      position,
    }));
    setIsModalOpen(true);
  }, [ensureCanEditAssets]);

  const loadTransformers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await transformerService.getAll();
      let visible = data;
      if (currentUser && currentUser.role !== 'admin') {
        const { data: perms, error: permError } = await supabase.rpc('list_my_permissions', {
          p_user_id: currentUser.id,
        });
        if (permError) throw permError;
        const allowed = new Set((perms ?? []).map((row) => row.transformer_id));
        visible = data.filter((transformer) => allowed.has(transformer.id));
      }
      setTransformers(visible);
      setSelectedTransformer((currentSelected) =>
        currentSelected ? visible.find((transformer) => transformer.id === currentSelected.id) || currentSelected : currentSelected
      );
    } catch (err) {
      console.error('Failed to load transformers:', err);
      setError('Failed to load transformers. Please check your database connection and Supabase policies.');
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (event) => {
    setMapContextMenu(null);

    if (!canEditAssets) {
      return;
    }

    if (companyBoundaryDraft) {
      setCompanyBoundaryDraft((current) =>
        current
          ? {
              ...current,
              points: [...current.points, [event.latlng.lat, event.latlng.lng]],
            }
          : current
      );
      return;
    }

    if (floorPlanDraft) {
      setFloorPlanDraft((current) =>
        current
          ? {
              ...current,
              points: [...current.points, [event.latlng.lat, event.latlng.lng]],
            }
          : current
      );
      return;
    }

    if (!isAddMode) {
      return;
    }

    const newTransformer = createTransformerDraft({
      position: [event.latlng.lat, event.latlng.lng],
    });
    setEditingTransformer(newTransformer);
    setIsModalOpen(true);
    setIsAddMode(false);
  };

  const handleMapContextMenu = (event) => {
    event.originalEvent?.preventDefault?.();
    event.originalEvent?.stopPropagation?.();

    if (!event.latlng) {
      return;
    }

    setMapContextMenu({
      x: event.originalEvent?.clientX ?? 0,
      y: event.originalEvent?.clientY ?? 0,
      lat: event.latlng.lat,
      lng: event.latlng.lng,
    });
  };

  const handleMapContextShowAddress = () => {
    if (!mapContextMenu) {
      return;
    }

    const latitude = formatMapCoordinate(mapContextMenu.lat);
    const longitude = formatMapCoordinate(mapContextMenu.lng);
    setMapContextMenu(null);
    showAppNotice({
      variant: 'info',
      title: 'Map location',
      description: `Latitude ${latitude}, longitude ${longitude}`,
      detail: `${latitude}, ${longitude}`,
      contextLabel: 'Show address',
      actionLabel: 'Close',
    });
  };

  const handleMapContextAddAsset = () => {
    if (!mapContextMenu || !ensureCanEditAssets()) {
      return;
    }

    const position = [mapContextMenu.lat, mapContextMenu.lng];
    setMapContextMenu(null);
    cancelFloorPlanDrawing();
    cancelCompanyBoundaryDrawing();
    setIsLocationRegisterOpen(false);
    setIsAddMode(false);
    setSelectedFloorPlanId(null);
    setSelectedCompanyBoundaryId(null);
    setEditingTransformer(createTransformerDraft({ position }));
    setIsModalOpen(true);
  };

  const handleMapContextOpenGoogleMaps = () => {
    if (!mapContextMenu || typeof window === 'undefined') {
      return;
    }

    const url = buildGoogleMapsLocationUrl(mapContextMenu.lat, mapContextMenu.lng);
    setMapContextMenu(null);
    const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');

    if (!openedWindow) {
      showAppNotice({
        variant: 'warning',
        title: 'Unable to open Google Maps',
        description: 'Your browser blocked the new tab.',
        detail: url,
        contextLabel: 'Google Maps',
        actionLabel: 'Close',
      });
    }
  };

  const handleMapContextShareLocation = async () => {
    if (!mapContextMenu || typeof window === 'undefined') {
      return;
    }

    const latitude = formatMapCoordinate(mapContextMenu.lat);
    const longitude = formatMapCoordinate(mapContextMenu.lng);
    const url = buildGoogleMapsLocationUrl(mapContextMenu.lat, mapContextMenu.lng);
    const text = `Transformer map location: ${latitude}, ${longitude}`;
    setMapContextMenu(null);

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Map location',
          text,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      showAppNotice({
        variant: 'success',
        title: 'Location link copied',
        description: 'The Google Maps link is ready to share.',
        detail: url,
        contextLabel: 'Share location',
        actionLabel: 'Close',
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }

      showAppNotice({
        variant: 'error',
        title: 'Unable to share location',
        description: 'The app could not share or copy this map link.',
        detail: err?.message || url,
        contextLabel: 'Share location',
      });
    }
  };

  const handleMapContextSearchAsset = () => {
    setMapContextMenu(null);
    setSidebarOpen(true);
    setIsDesktopSidebarCollapsed(false);
    setSidebarSearchFocusRequest((current) => current + 1);
  };

  const syncImportedReportForTransformer = async (transformerId, importSession, existingOilTests = []) => {
    const payloads = Array.isArray(importSession?.oilTestPayloads) ? importSession.oilTestPayloads : [];

    if (!transformerId || (!importSession?.file && !payloads.length)) {
      return {
        documentStored: false,
        createdCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
      };
    }

    // LIMS imports arrive as data only, with no report file to store.
    if (importSession.file) {
      await documentService.upload(transformerId, importSession.file);
    }

    const existingByDate = new Map();

    existingOilTests.forEach((test) => {
      if (!test?.testDate || existingByDate.has(test.testDate)) {
        return;
      }

      existingByDate.set(test.testDate, test);
    });

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const payload of payloads) {
      const existingTest = existingByDate.get(payload.testDate);

      if (existingTest?.id) {
        if (isSameImportedOilTestPayload(existingTest, payload)) {
          unchangedCount += 1;
          continue;
        }

        const updatedTest = await oilTestService.update(existingTest.id, payload);
        updatedCount += 1;
        existingByDate.set(payload.testDate, updatedTest || { ...existingTest, ...payload });
        continue;
      }

      const createdTest = await oilTestService.create(transformerId, payload);
      createdCount += 1;
      existingByDate.set(payload.testDate, createdTest || payload);
    }

    return {
      documentStored: Boolean(importSession.file),
      createdCount,
      updatedCount,
      unchangedCount,
    };
  };

  const handleAddTransformer = async (transformerData) => {
    if (!ensureCanEditAssets()) {
      return;
    }

    const isEditingTransformer = Boolean(editingTransformer?.id);
    const txName = String(transformerData?.txName || editingTransformer?.txName || '').trim();
    const siteName = String(transformerData?.siteName || editingTransformer?.siteName || '').trim();
    const recordStatusLabel = isEditingTransformer ? 'Updated' : 'Saved';

    try {
      setLoading(true);
      const { importSession = null, ...transformerPayload } = transformerData;
      const existingOilTests = Array.isArray(editingTransformer?.oilTests) ? editingTransformer.oilTests : [];
      let savedTransformerId = editingTransformer?.id || null;
      let importSummary = null;
      let postSaveNotice = null;

      if (editingTransformer?.id) {
        const updatedTransformer = await transformerService.update(editingTransformer.id, transformerPayload);
        savedTransformerId = updatedTransformer?.id || editingTransformer.id;
      } else {
        const newTransformer = await transformerService.create(transformerPayload);
        savedTransformerId = newTransformer?.id || null;
        if (currentUser && currentUser.role !== 'admin' && newTransformer?.id) {
          const { error: grantError } = await supabase.rpc('grant_self_transformer_access', {
            p_user_id: currentUser.id,
            p_transformer_id: newTransformer.id,
          });
          if (grantError) {
            throw grantError;
          }
        }
        if (pendingFloorAssignment.current && newTransformer?.id) {
          const targetFloorId = pendingFloorAssignment.current;
          pendingFloorAssignment.current = null;
          const targetFloor = floorPlans.find((fp) => fp.id === targetFloorId);
          if (targetFloor) {
            const updatedIds = [...new Set([...targetFloor.transformerIds, String(newTransformer.id)])];
            await floorPlanService.updateTransformerIds(targetFloorId, updatedIds);
            setFloorPlans((prev) =>
              prev.map((fp) => fp.id === targetFloorId ? { ...fp, transformerIds: updatedIds } : fp)
            );
          }
        }
      }

      if (savedTransformerId && (importSession?.file || importSession?.oilTestPayloads?.length)) {
        try {
          importSummary = await syncImportedReportForTransformer(savedTransformerId, importSession, existingOilTests);
        } catch (importError) {
          console.error('Report import after transformer save failed:', importError);
          postSaveNotice = {
            variant: 'warning',
            title: isEditingTransformer ? 'Transformer updated with import warning' : 'Transformer saved with import warning',
            description:
              'The transformer record was saved, but the linked ACTMS report could not fully sync into Documents and Oil Tests automatically.',
            detail:
              importError?.message || 'Please retry the PDF sync from the transformer details screen.',
            txName,
            siteName,
            recordStatusLabel,
            recordLabel: 'Transformer',
            documentStored: false,
          };
        }
      }

      await loadTransformers();
      setIsModalOpen(false);
      setIsLocationRegisterOpen(false);
      setEditingTransformer(null);

      const importSyncedAnyTest = Boolean(
        importSummary &&
          (importSummary.createdCount || importSummary.updatedCount || importSummary.unchangedCount)
      );

      if (!postSaveNotice && (importSummary?.documentStored || importSyncedAnyTest)) {
        postSaveNotice = {
          variant: 'success',
          title: isEditingTransformer ? 'Transformer updated successfully' : 'Transformer saved successfully',
          description:
            importSummary.createdCount > 0 || importSummary.updatedCount > 0 || importSummary.unchangedCount > 0
              ? 'The ACTMS report was stored in Documents and the linked oil-test results were synced successfully.'
              : 'The ACTMS report was stored in Documents successfully.',
          txName,
          siteName,
          recordStatusLabel,
          recordLabel: 'Transformer',
          documentStored: true,
          createdCount: importSummary.createdCount,
          updatedCount: importSummary.updatedCount,
          unchangedCount: importSummary.unchangedCount,
        };
      }

      if (postSaveNotice) {
        setAppNotice(postSaveNotice);
      }
    } catch (err) {
      console.error('Failed to save transformer:', err);
      const errorMessage = err?.message || 'Failed to save transformer. Please try again.';
      const isDuplicateSerialError = /duplicate serial number|serial number already exists|duplicate key value/i.test(
        errorMessage
      );

      setAppNotice({
        variant: isDuplicateSerialError ? 'warning' : 'error',
        title: isDuplicateSerialError
          ? 'Duplicate serial number detected'
          : isEditingTransformer
            ? 'Unable to update transformer'
            : 'Unable to save transformer',
        description: isDuplicateSerialError
          ? 'This serial number already belongs to another transformer in the register.'
          : 'The transformer record could not be saved yet.',
        detail: isDuplicateSerialError
          ? `${errorMessage} Open the existing asset and update it instead of creating a duplicate transformer record.`
          : errorMessage,
        txName,
        siteName,
        recordStatusLabel: isDuplicateSerialError ? undefined : 'Not saved',
        recordLabel: 'Transformer',
        actionLabel: isDuplicateSerialError ? 'Back to form' : 'Close',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditTransformer = (transformer) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setEditingTransformer(transformer);
    setIsModalOpen(true);
    setSelectedFloorPlanId(null);
  };

  // Files a LIMS sample straight into the matched asset's oil test records.
  // Unlike the asset action this writes immediately — there are no identity
  // fields to review, and the upsert is keyed on test date, so re-sending the
  // same sample updates that row instead of adding a duplicate.
  const handleLimsResult = useCallback(
    async (record, match, matchReason) => {
      if (!match) {
        showAppNotice({
          variant: 'warning',
          title: 'No asset matched this result',
          description:
            'Nothing was filed: no asset matched this sample by serial number, or by site and transformer name. Use "Add or update the asset from this record" first, then send the result.',
          recordLabel: 'Oil test',
          txName: record.transformer.txName || '',
          siteName: record.transformer.siteName || '',
          actionLabel: 'Close',
        });
        return;
      }

      try {
        setLoading(true);
        const summary = await syncImportedReportForTransformer(
          match.id,
          { file: null, oilTestPayloads: record.oilTestPayloads },
          Array.isArray(match.oilTests) ? match.oilTests : []
        );

        await loadTransformers();

        const changes = [
          summary.createdCount ? `${summary.createdCount} added` : null,
          summary.updatedCount ? `${summary.updatedCount} updated` : null,
          summary.unchangedCount ? `${summary.unchangedCount} already current` : null,
        ].filter(Boolean);

        showAppNotice({
          variant: 'success',
          title: 'Test result filed from LIMS',
          description: `${match.siteName} / ${match.txName} — matched by ${matchReason}. ${
            changes.join(', ') || 'No changes'
          }.`,
          recordLabel: 'Oil test',
          txName: match.txName || '',
          siteName: match.siteName || '',
          recordStatusLabel: 'Saved',
          actionLabel: 'Close',
        });
      } catch (resultError) {
        console.error('LIMS result import failed:', resultError);
        showAppNotice({
          variant: 'error',
          title: 'Could not file the LIMS result',
          description: 'The asset was matched, but its oil test records could not be updated.',
          detail: resultError?.message || 'Please retry, or add the result manually.',
          recordLabel: 'Oil test',
          txName: match.txName || '',
          siteName: match.siteName || '',
          actionLabel: 'Close',
        });
      } finally {
        setLoading(false);
      }
    },
    [showAppNotice]
  );

  // Receives records pushed by the LIMS Chrome extension (see extension/README.md).
  // The asset action writes nothing here: the record opens in the normal edit
  // form so the values can be reviewed, and saving goes through
  // handleAddTransformer as usual. The result action is handled above.
  const handleLimsRecord = useCallback(
    (record) => {
      if (!ensureCanEditAssets()) {
        return;
      }

      const { match, reason: matchReason } = matchLimsRecordToAsset(record.transformer, transformers);

      if (record.intent === INTENT_RESULT) {
        handleLimsResult(record, match, matchReason);
        return;
      }

      // The asset action carries identity only — results go through the result
      // action, so nothing is filed behind the user's back here.
      const importSession = null;

      // ACTMS has no state field, but its client address carries one.
      const incoming = { ...record.transformer };
      if (!incoming.state && record.address) {
        const inferredState = inferMalaysianStateFromText(record.address);
        if (inferredState) {
          incoming.state = inferredState;
        }
      }

      if (match) {
        // Only fill blanks on a known asset — the LIMS should not silently
        // overwrite details already curated in the app.
        const filled = { ...match };
        Object.entries(incoming).forEach(([key, value]) => {
          if (key === 'position') {
            return;
          }
          if (filled[key] === undefined || filled[key] === null || filled[key] === '') {
            filled[key] = value;
          }
        });

        setEditingTransformer({ ...filled, importSession });
      } else {
        setEditingTransformer(createTransformerDraft({ ...incoming, importSession }));
      }

      setIsModalOpen(true);
      setSelectedFloorPlanId(null);
      showAppNotice({
        variant: 'info',
        title: match ? `LIMS asset matched by ${matchReason}` : 'New asset from LIMS',
        description: match
          ? `Matched ${match.siteName} / ${match.txName}${
              match.serialNumber ? ` (SN ${match.serialNumber})` : ''
            }. Check this is the right asset, then save. Send the test result separately with "Add this test result to the asset".`
          : 'No asset matched this LIMS record. Complete the required fields and save to create it, then send the test result separately.',
        recordLabel: 'Transformer',
        txName: record.transformer.txName || '',
        siteName: record.transformer.siteName || '',
        actionLabel: 'Review',
      });
    },
    [ensureCanEditAssets, handleLimsResult, showAppNotice, transformers]
  );

  useEffect(() => subscribeToLimsBridge(handleLimsRecord), [handleLimsRecord]);

  const handleDeleteTransformer = async (id) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    const confirmed = window.confirm(
      'Delete this transformer and all of its oil tests and documents? This action cannot be undone.'
    );
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await transformerService.delete(id);
      const affectedFloors = floorPlans.filter((plan) =>
        plan.transformerIds.some((tid) => String(tid) === String(id))
      );
      await Promise.all(
        affectedFloors.map((plan) =>
          floorPlanService.updateTransformerIds(
            plan.id,
            plan.transformerIds.filter((tid) => String(tid) !== String(id))
          )
        )
      );
      const nextFloorPlans = floorPlans.map((floorPlan) => ({
        ...floorPlan,
        transformerIds: floorPlan.transformerIds.filter(
          (transformerId) => String(transformerId) !== String(id)
        ),
      }));
      setFloorPlans(nextFloorPlans);
      if (selectedTransformer?.id === id) {
        setSelectedTransformer(null);
        setIsDetailModalOpen(false);
      }
      await loadTransformers();
    } catch (err) {
      console.error('Failed to delete transformer:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to delete transformer',
        description: 'The transformer record could not be deleted yet.',
        detail: err?.message || 'Failed to delete transformer. Please try again.',
        contextLabel: 'Transformer',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerDragEnd = async (id, newPosition) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    try {
      await transformerService.updatePosition(id, newPosition);
      setTransformers((current) =>
        current.map((transformer) =>
          transformer.id === id ? { ...transformer, position: newPosition } : transformer
        )
      );
      setSelectedTransformer((currentSelected) =>
        currentSelected?.id === id ? { ...currentSelected, position: newPosition } : currentSelected
      );
    } catch (err) {
      console.error('Failed to update position:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to update map position',
        description: 'The new transformer location could not be saved yet.',
        detail: err?.message || 'Failed to update position. Please try again.',
        contextLabel: 'Map position',
      });
    }
  };

  const handleViewDetails = (transformer) => {
    setSelectedTransformer(transformer);
    setIsDetailModalOpen(true);
    setSelectedFloorPlanId(null);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setTimeout(() => setSelectedTransformer(null), 550);
    loadTransformers();
  };

  // Stable identities for the per-marker handlers so memo(TransformerMarker)
  // only re-renders a marker when its own data or selection changes.
  const stableMarkerDragEnd = useStableCallback(handleMarkerDragEnd);
  const stableEditTransformer = useStableCallback(handleEditTransformer);
  const stableDeleteTransformer = useStableCallback(handleDeleteTransformer);
  const stableViewDetails = useStableCallback(handleViewDetails);
  const handleMarkerSelect = useCallback((nextTransformer) => {
    setSelectedTransformer(nextTransformer);
    setSelectedFloorPlanId(null);
  }, []);

  // Warm the two most-used dialogs once the browser is idle, so their first
  // open is instant even though they are no longer in the main bundle.
  useEffect(() => {
    const requestIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 2000));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;
    const handle = requestIdle(() => {
      loadTransformerDetailModal().catch(() => {});
      loadTransformerModal().catch(() => {});
    });
    return () => cancelIdle(handle);
  }, []);

  /**
   * Asset Management retypes assets TNB ↔ Non-TNB in bulk. Patching the loaded
   * list keeps the map badges and the TNB / Non-TNB filters honest without a
   * full reload behind the still-open dialog.
   */
  const handleAssetOwnerChanged = useCallback((transformerIds, ownerType) => {
    const changed = new Set(transformerIds);
    if (changed.size === 0) return;
    setTransformers((current) =>
      current.map((transformer) =>
        changed.has(transformer.id) ? { ...transformer, ownerType } : transformer
      )
    );
    setSelectedTransformer((currentSelected) =>
      currentSelected && changed.has(currentSelected.id)
        ? { ...currentSelected, ownerType }
        : currentSelected
    );
  }, []);

  const handleUpdateOilTests = (transformerId, oilTests) => {
    setTransformers((current) =>
      current.map((transformer) =>
        transformer.id === transformerId ? { ...transformer, oilTests } : transformer
      )
    );
    setSelectedTransformer((currentSelected) =>
      currentSelected?.id === transformerId
        ? { ...currentSelected, oilTests }
        : currentSelected
    );
  };

  const handleDgaPreferencesSaved = (transformerId, preferences) => {
    if (!transformerId || !preferences) {
      return;
    }
    setTransformers((current) =>
      current.map((transformer) =>
        transformer.id === transformerId ? { ...transformer, ...preferences } : transformer
      )
    );
    setSelectedTransformer((currentSelected) =>
      currentSelected?.id === transformerId
        ? { ...currentSelected, ...preferences }
        : currentSelected
    );
  };

  const handleUpdateDocuments = (transformerId, documents) => {
    setTransformers((current) =>
      current.map((transformer) =>
        transformer.id === transformerId ? { ...transformer, documents } : transformer
      )
    );
    setSelectedTransformer((currentSelected) =>
      currentSelected?.id === transformerId
        ? { ...currentSelected, documents }
        : currentSelected
    );
  };

  const closeTransformerModal = () => {
    setIsModalOpen(false);
    setEditingTransformer(null);
    pendingFloorAssignment.current = null;
  };

  const startFloorPlanDrawing = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setIsAddMode(false);
    setCompanyBoundaryDraft(null);
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
    setSelectedCompanyBoundaryId(null);
    setSelectedFloorPlanId(null);
    setFloorPlanDraft(createDraftFloorPlan());
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
  };

  const startCompanyBoundaryDrawing = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setIsAddMode(false);
    setFloorPlanDraft(null);
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
    setSelectedFloorPlanId(null);
    setSelectedCompanyBoundaryId(null);
    setCompanyBoundaryDraft(createDraftCompanyBoundary());
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
  };

  const handleEditCompanyBoundary = (boundary) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!boundary) {
      return;
    }

    focusCompanyBoundary(boundary);
    setIsAddMode(false);
    setFloorPlanDraft(null);
    setCompanyBoundaryDraft(createDraftCompanyBoundary(boundary));
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
  };

  const handleEditFloorPlan = (floorPlan) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!floorPlan) {
      return;
    }

    focusFloorPlan(floorPlan);
    setIsAddMode(false);
    setCompanyBoundaryDraft(null);
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
    setFloorPlanDraft(createDraftFloorPlan(floorPlan));
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
  };

  const handleSaveCompanyBoundaryShape = async (boundary, nextPoints) => {
    if (!ensureCanEditAssets()) {
      return false;
    }
    if (!boundary || !Array.isArray(nextPoints) || nextPoints.length < 3) {
      showAppNotice({
        variant: 'warning',
        title: 'More boundary points needed',
        description: 'A company boundary needs at least three points before it can be saved.',
        detail: 'Add more points or continue reshaping the parent boundary, then try saving again.',
        contextLabel: 'Company boundary',
        actionLabel: 'Back to map',
      });
      return false;
    }

    try {
      const normalizedBoundary = normalizeCompanyBoundary({
        ...boundary,
        points: nextPoints,
        createdAt: boundary.createdAt || new Date().toISOString(),
      });

      await companyBoundaryService.upsert(normalizedBoundary);
      const storedBoundaries = await companyBoundaryService.getAll();
      setCompanyBoundaries(storedBoundaries);
      focusCompanyBoundary(normalizedBoundary);
      return true;
    } catch (err) {
      console.error('Failed to reshape company boundary:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to save company boundary',
        description: 'The reshaped company boundary could not be saved yet.',
        detail: err?.message || 'Failed to save company boundary. Please try again.',
        contextLabel: 'Company boundary',
      });
      return false;
    }
  };

  const handleSaveFloorPlanShape = async (floorPlan, nextPoints) => {
    if (!ensureCanEditAssets()) {
      return false;
    }
    if (!floorPlan || !Array.isArray(nextPoints) || nextPoints.length < 3) {
      showAppNotice({
        variant: 'warning',
        title: 'More boundary points needed',
        description: 'A floor boundary needs at least three points before it can be saved.',
        detail: 'Add more points or continue reshaping the boundary, then try saving again.',
        contextLabel: 'Floor boundary',
        actionLabel: 'Back to map',
      });
      return false;
    }

    try {
      const normalizedFloorPlan = normalizeFloorPlan({
        ...floorPlan,
        points: nextPoints,
        createdAt: floorPlan.createdAt || new Date().toISOString(),
      });

      await floorPlanService.upsert(normalizedFloorPlan);
      const storedFloorPlans = await floorPlanService.getAll();
      setFloorPlans(storedFloorPlans);
      focusFloorPlan(normalizedFloorPlan);
      return true;
    } catch (err) {
      console.error('Failed to reshape floor plan:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to save floor boundary',
        description: 'The reshaped floor boundary could not be saved yet.',
        detail: err?.message || 'Failed to save floor boundary. Please try again.',
        contextLabel: 'Floor boundary',
      });
      return false;
    }
  };

  const cancelFloorPlanDrawing = () => {
    setFloorPlanDraft(null);
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
  };

  const cancelCompanyBoundaryDrawing = () => {
    setCompanyBoundaryDraft(null);
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
  };

  const handleCompanyBoundaryDraftVertexMove = (pointIndex, nextPoint) => {
    if (!canEditAssets) {
      return;
    }
    setCompanyBoundaryDraft((current) =>
      current
        ? {
            ...current,
            points: current.points.map((point, index) => (index === pointIndex ? nextPoint : point)),
          }
        : current
    );
  };

  const handleUndoCompanyBoundaryDraftPoint = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setCompanyBoundaryDraft((current) =>
      current
        ? {
            ...current,
            points: current.points.slice(0, -1),
          }
        : current
    );
  };

  const openCompanyBoundaryMetadataDialog = (draft) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setCompanyBoundaryDialogDraft(draft);
    setIsCompanyBoundaryDialogOpen(true);
  };

  const handleEditCompanyBoundaryInfo = (boundary) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!boundary) {
      return;
    }

    focusCompanyBoundary(boundary);
    setCompanyBoundaryDraft(null);
    openCompanyBoundaryMetadataDialog({
      ...createDraftCompanyBoundary(boundary),
      points: boundary.points,
    });
  };

  const openCompanyBoundaryDialogFromDraft = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!companyBoundaryDraft || companyBoundaryDraft.points.length < 3) {
      showAppNotice({
        variant: 'warning',
        title: 'More boundary points needed',
        description: 'Draw at least three points on the map to create a company boundary.',
        detail: 'Keep clicking on the map until the parent area has enough points to form a closed boundary.',
        contextLabel: 'Company boundary',
        actionLabel: 'Back to map',
      });
      return;
    }

    const existingBoundary = companyBoundaryDraft.id
      ? companyBoundaries.find((boundary) => boundary.id === companyBoundaryDraft.id) || null
      : null;
    const detectedTransformers = findTransformersInsidePolygon(filteredTransformers, companyBoundaryDraft.points);
    const primaryTransformer = detectedTransformers[0] || selectedTransformer || null;

    openCompanyBoundaryMetadataDialog({
      ...createDraftCompanyBoundary({
        ...existingBoundary,
        ...companyBoundaryDraft,
        companyName: existingBoundary?.companyName || primaryTransformer?.siteName || '',
        state: existingBoundary?.state || (primaryTransformer ? getTransformerState(primaryTransformer) : '') || '',
      }),
    });
  };

  const handleSaveCompanyBoundary = async (nextBoundaryDraft) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    try {
      const currentBoundary = nextBoundaryDraft?.id
        ? companyBoundaries.find((boundary) => boundary.id === nextBoundaryDraft.id) || null
        : null;
      const normalizedBoundary = normalizeCompanyBoundary({
        ...currentBoundary,
        ...nextBoundaryDraft,
        createdAt: currentBoundary?.createdAt || nextBoundaryDraft?.createdAt || new Date().toISOString(),
      });

      await companyBoundaryService.upsert(normalizedBoundary);
      const storedBoundaries = await companyBoundaryService.getAll();
      setCompanyBoundaries(storedBoundaries);
      setIsCompanyBoundaryDialogOpen(false);
      setCompanyBoundaryDialogDraft(null);
      setCompanyBoundaryDraft(null);
      focusCompanyBoundary(normalizedBoundary);
    } catch (err) {
      console.error('Failed to save company boundary:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to save company boundary',
        description: 'The company or parent boundary could not be saved yet.',
        detail: err?.message || 'Failed to save company boundary. Please try again.',
        contextLabel: 'Company boundary',
      });
    }
  };

  const handleDeleteCompanyBoundary = (boundaryId) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    const targetBoundary = companyBoundaries.find((boundary) => boundary.id === boundaryId);
    const boundaryLabel = targetBoundary?.companyName || 'this company boundary';

    const runDelete = async () => {
      try {
        setConfirmBusy(true);
        await companyBoundaryService.delete(boundaryId);
        setCompanyBoundaries((current) => current.filter((boundary) => boundary.id !== boundaryId));
        if (selectedCompanyBoundaryId === boundaryId) {
          setSelectedCompanyBoundaryId(null);
        }
        if (companyBoundaryDraft?.id === boundaryId) {
          setCompanyBoundaryDraft(null);
        }
        setIsCompanyBoundaryDialogOpen(false);
        setCompanyBoundaryDialogDraft(null);
        setConfirmState(null);
      } catch (err) {
        console.error('Failed to delete company boundary:', err);
        showAppNotice({
          variant: 'error',
          title: 'Unable to delete company boundary',
          description: 'The company or parent boundary could not be deleted yet.',
          detail: err?.message || 'Failed to delete company boundary. Please try again.',
          contextLabel: 'Company boundary',
        });
      } finally {
        setConfirmBusy(false);
      }
    };

    setConfirmState({
      title: `Delete ${boundaryLabel}?`,
      description: 'Delete this parent boundary only. Area/floor polygons and transformer records remain unchanged.',
      confirmLabel: 'Delete boundary',
      tone: 'danger',
      onConfirm: runDelete,
    });
  };

  const openLocationRegisterModule = useCallback(() => {
    if (!ensureCanEditAssets()) {
      return;
    }

    cancelFloorPlanDrawing();
    cancelCompanyBoundaryDrawing();
    pendingFloorAssignment.current = null;
    setEditingTransformer(null);
    setIsModalOpen(false);
    setIsAddMode(false);
    setIsLocationRegisterOpen(true);
    setSelectedFloorPlanId(null);

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [cancelFloorPlanDrawing, cancelCompanyBoundaryDrawing, ensureCanEditAssets]);

  const handleFloorDraftVertexMove = (pointIndex, nextPoint) => {
    if (!canEditAssets) {
      return;
    }
    setFloorPlanDraft((current) =>
      current
        ? {
            ...current,
            points: current.points.map((point, index) => (index === pointIndex ? nextPoint : point)),
          }
        : current
    );
  };

  const handleUndoFloorDraftPoint = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setFloorPlanDraft((current) =>
      current
        ? {
            ...current,
            points: current.points.slice(0, -1),
          }
        : current
    );
  };

  const openFloorPlanMetadataDialog = (draft) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    setFloorPlanDialogDraft(draft);
    setIsFloorPlanDialogOpen(true);
  };

  const handleEditFloorPlanInfo = (floorPlan) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!floorPlan) {
      return;
    }

    focusFloorPlan(floorPlan);
    setFloorPlanDraft(null);
    setCompanyBoundaryDraft(null);
    setIsCompanyBoundaryDialogOpen(false);
    setCompanyBoundaryDialogDraft(null);
    openFloorPlanMetadataDialog({
      ...createDraftFloorPlan(floorPlan),
      points: floorPlan.points,
      detectedTransformerIds: floorPlan.transformerIds.map((transformerId) => String(transformerId)),
    });
  };

  const openFloorPlanDialogFromDraft = () => {
    if (!ensureCanEditAssets()) {
      return;
    }
    if (!floorPlanDraft || floorPlanDraft.points.length < 3) {
      showAppNotice({
        variant: 'warning',
        title: 'More boundary points needed',
        description: 'Draw at least three points on the map to create a floor boundary.',
        detail: 'Keep clicking on the map until the area has enough points to form a closed boundary.',
        contextLabel: 'Floor boundary',
        actionLabel: 'Back to map',
      });
      return;
    }

    const detectedTransformers = findTransformersInsidePolygon(filteredTransformers, floorPlanDraft.points);
    const existingFloorPlan = floorPlanDraft.id
      ? floorPlans.find((floorPlan) => floorPlan.id === floorPlanDraft.id) || null
      : null;
    const draftCentroid = getPolygonCentroid(floorPlanDraft.points);
    const containingCompanyBoundary = draftCentroid
      ? companyBoundaries.find((boundary) => isPointInsidePolygon(draftCentroid, boundary.points))
      : null;
    const primaryTransformer =
      detectedTransformers[0] ||
      (existingFloorPlan?.transformerIds || [])
        .map((transformerId) =>
          filteredTransformers.find((transformer) => String(transformer.id) === String(transformerId))
        )
        .filter(Boolean)[0] ||
      selectedTransformer ||
      null;

    openFloorPlanMetadataDialog({
      ...createDraftFloorPlan({
        ...existingFloorPlan,
        ...floorPlanDraft,
        name: existingFloorPlan?.name || '',
        companyName: existingFloorPlan?.companyName || containingCompanyBoundary?.companyName || primaryTransformer?.siteName || '',
        state: existingFloorPlan?.state || containingCompanyBoundary?.state || (primaryTransformer ? getTransformerState(primaryTransformer) : '') || '',
        transformerIds:
          existingFloorPlan?.transformerIds?.length
            ? existingFloorPlan.transformerIds
            : detectedTransformers.map((transformer) => String(transformer.id)),
        }),
      detectedTransformerIds: detectedTransformers.map((transformer) => String(transformer.id)),
    });
  };

  const handleSaveFloorPlan = async (nextFloorPlanDraft) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    try {
      const currentFloorPlan = nextFloorPlanDraft?.id
        ? floorPlans.find((floorPlan) => floorPlan.id === nextFloorPlanDraft.id) || null
        : null;
      const normalizedFloorPlan = normalizeFloorPlan({
        ...currentFloorPlan,
        ...nextFloorPlanDraft,
        createdAt: currentFloorPlan?.createdAt || nextFloorPlanDraft?.createdAt || new Date().toISOString(),
      });

      const assignedTransformerIds = new Set(
        normalizedFloorPlan.transformerIds.map((transformerId) => String(transformerId))
      );

      const stripUpdates = floorPlans
        .filter((plan) => plan.id !== normalizedFloorPlan.id)
        .filter((plan) => plan.transformerIds.some((tid) => assignedTransformerIds.has(String(tid))))
        .map((plan) =>
          floorPlanService.updateTransformerIds(
            plan.id,
            plan.transformerIds.filter((tid) => !assignedTransformerIds.has(String(tid)))
          )
        );

      await Promise.all([floorPlanService.upsert(normalizedFloorPlan), ...stripUpdates]);

      const storedFloorPlans = await floorPlanService.getAll();
      setFloorPlans(storedFloorPlans);
      setIsFloorPlanDialogOpen(false);
      setFloorPlanDialogDraft(null);
      setFloorPlanDraft(null);
      focusFloorPlan(normalizedFloorPlan);
    } catch (err) {
      console.error('Failed to save floor plan:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to save floor plan',
        description: 'The floor plan record could not be saved yet.',
        detail: err?.message || 'Failed to save floor plan. Please try again.',
        contextLabel: 'Floor plan',
      });
    }
  };

  const handleDeleteFloorPlan = (floorPlanId) => {
    if (!ensureCanEditAssets()) {
      return;
    }

    const targetPlan = floorPlans.find((plan) => plan.id === floorPlanId);
    const planLabel = targetPlan?.name || targetPlan?.floorLabel || 'this floor';

    const runDelete = async () => {
      setConfirmBusy(true);
      try {
        await floorPlanService.delete(floorPlanId);
        setFloorPlans((current) => current.filter((plan) => plan.id !== floorPlanId));
        if (selectedFloorPlanId === floorPlanId) {
          setSelectedFloorPlanId(null);
        }
        if (floorPlanDraft?.id === floorPlanId) {
          setFloorPlanDraft(null);
        }
        setIsFloorPlanDialogOpen(false);
        setFloorPlanDialogDraft(null);
        setConfirmState(null);
      } catch (err) {
        console.error('Failed to delete floor plan:', err);
        setConfirmState(null);
        showAppNotice({
          variant: 'error',
          title: 'Unable to delete floor plan',
          description: 'The floor plan overlay could not be deleted yet.',
          detail: err?.message || 'Failed to delete floor plan. Please try again.',
          contextLabel: 'Floor plan',
        });
      } finally {
        setConfirmBusy(false);
      }
    };

    setConfirmState({
      title: `Delete ${planLabel}?`,
      description:
        'The transformer records stay, but they will be ungrouped from this floor.',
      confirmLabel: 'Delete floor',
      cancelLabel: 'Cancel',
      tone: 'danger',
      onConfirm: runDelete,
    });
  };

  const activeBaseLayer = MAP_BASE_LAYERS[mapBaseLayer];

  const handleSignOut = useCallback((reason = 'manual') => {
    const signOutReason = reason === 'idle' ? 'idle' : 'manual';
    clearSession();
    clearIdleSignOutTimer();
    setCurrentUser(null);
    setAuthNotice(signOutReason === 'idle' ? IDLE_SIGN_OUT_MESSAGE : null);
    setIsSettingsOpen(false);
    setTransformers([]);
    setSelectedTransformer(null);
  }, [clearIdleSignOutTimer]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    clearIdleSignOutTimer();

    if (!currentUser) {
      return undefined;
    }

    const scheduleIdleCheck = () => {
      clearIdleSignOutTimer();

      const idleRemainingMs = getSessionIdleRemainingMs();
      if (idleRemainingMs === null || idleRemainingMs <= 0) {
        handleSignOut('idle');
        return;
      }

      idleSignOutTimerRef.current = window.setTimeout(() => {
        scheduleIdleCheck();
      }, idleRemainingMs);
    };

    const handleActivity = () => {
      const sessionStillValid = touchSessionActivity();
      if (!sessionStillValid) {
        handleSignOut('idle');
        return;
      }

      scheduleIdleCheck();
    };

    const handleVisibilityChange = () => {
      scheduleIdleCheck();
    };

    scheduleIdleCheck();
    SESSION_ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity);
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      SESSION_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearIdleSignOutTimer();
    };
  }, [currentUser, handleSignOut, clearIdleSignOutTimer]);

  if (!currentUser && isSupabaseConfigured) {
    return (
      <SignIn
        infoMessage={authNotice}
        onSuccess={(user) => {
          setAuthNotice(null);
          setCurrentUser(user);
          if (readTourEnabled()) setShowTour(true);
        }}
      />
    );
  }

  if (loading && transformers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-[var(--foreground)]">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-[color:var(--border)] border-t-[color:var(--primary)]" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Loading transformer asset map</h1>
            <p className="text-sm text-[var(--muted)]">Bringing in assets, samples, and documents.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[var(--warning-soft)] text-[var(--warning-strong)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Configuration Required</CardTitle>
                <p className="text-sm text-[var(--muted)]">{error}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
              <p className="text-sm font-medium text-[var(--foreground)]">Add these values to your environment file:</p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-[var(--background)] p-3 text-sm text-[var(--foreground)]">
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
              </pre>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Restart the dev server after updating the environment variables. The existing asset and map logic is ready once Supabase is connected.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const markerClusterEnabled = !(isDraggable && canEditAssets);
  const isWeatherOverlayVisible =
    isWeatherToolOpen &&
    weatherLayerEnabled &&
    weatherRecords.length > 0 &&
    Object.values(weatherOptions).some(Boolean);
  const isLSTOverlayVisible =
    isLSTToolOpen &&
    lstLayerEnabled &&
    Boolean(lstDate);
  const isLSTCompareVisible =
    isLSTOverlayVisible &&
    lstCompareEnabled &&
    Boolean(lstCompareDate);
  const transformerMarkerNodes = filteredTransformers.map((transformer) => (
    <TransformerMarker
      key={transformer.id}
      transformer={transformer}
      icon={createTransformerIcon(transformerMarkerColors.get(transformer.id) ?? MARKER_STATUS_COLORS.normal)}
      isSelected={selectedTransformer?.id === transformer.id}
      isDraggable={isDraggable && canEditAssets}
      canManageAssets={canEditAssets}
      onDragEnd={stableMarkerDragEnd}
      onEdit={stableEditTransformer}
      onDelete={stableDeleteTransformer}
      onViewDetails={stableViewDetails}
      onSelect={handleMarkerSelect}
    />
  ));

  return (
    <div className="app-shell relative overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className={cn('app-frame flex overflow-hidden', isDesktopSidebarCollapsed && 'is-sidebar-collapsed')}>
        <aside
          className={cn(
            'app-sidebar fixed inset-y-0 left-0 z-[1200] w-screen max-w-none shrink-0 overflow-hidden transition-all duration-300 sm:w-[430px] sm:max-w-[430px] lg:absolute',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            isDesktopSidebarCollapsed
              ? 'border-r border-[color:var(--border)] lg:w-[84px] lg:max-w-[84px]'
              : 'border-r border-[color:var(--border)] lg:w-[380px]'
          )}
          aria-label="Transformer sidebar"
          onPointerEnter={activateSidebarInteraction}
          onPointerLeave={deactivateSidebarInteraction}
          onMouseMoveCapture={activateSidebarInteraction}
          onWheelCapture={(event) => {
            activateSidebarInteraction();
            event.stopPropagation();
            if (typeof event.nativeEvent.stopImmediatePropagation === 'function') {
              event.nativeEvent.stopImmediatePropagation();
            }
          }}
        >
          <TransformerSidebar
            transformers={filteredTransformers}
            floorPlans={floorPlans}
            companyBoundaries={companyBoundaries}
            statusById={transformerMarkerStatuses}
            currentUser={currentUser}
            canManageAssets={canEditAssets}
            onAddClick={() => {
              if (!ensureCanEditAssets()) {
                return;
              }
              cancelFloorPlanDrawing();
              cancelCompanyBoundaryDrawing();
              setIsLocationRegisterOpen(false);
              setIsAddMode(true);
              setSelectedFloorPlanId(null);
              setSelectedCompanyBoundaryId(null);
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setSidebarOpen(false);
              }
            }}
            onLocationRegisterClick={openLocationRegisterModule}
            onDrawFloorClick={() => {
              if (floorPlanDraft) {
                cancelFloorPlanDrawing();
              } else {
                startFloorPlanDrawing();
              }
            }}
            onTransformerClick={(transformer) => focusTransformer(transformer)}
            onEditClick={handleEditTransformer}
            onDeleteClick={handleDeleteTransformer}
            onViewDetails={handleViewDetails}
            onFloorPlanClick={focusFloorPlan}
            onCompanyBoundaryClick={focusCompanyBoundary}
            onEditCompanyBoundaryInfo={handleEditCompanyBoundaryInfo}
            onEditCompanyBoundary={handleEditCompanyBoundary}
            onDeleteCompanyBoundary={handleDeleteCompanyBoundary}
            onEditFloorPlanInfo={handleEditFloorPlanInfo}
            onEditFloorPlan={handleEditFloorPlan}
            onDeleteFloorPlan={handleDeleteFloorPlan}
            isAddMode={isAddMode}
            isLocationRegisterOpen={isLocationRegisterOpen}
            isFloorDrawingMode={Boolean(floorPlanDraft)}
            loading={loading}
            selectedTransformerId={selectedTransformer?.id ?? null}
            selectedCompanyBoundaryId={selectedCompanyBoundaryId}
            selectedFloorPlanId={selectedFloorPlanId}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAssetManagement={isAdmin ? () => setIsAssetManagementOpen(true) : undefined}
            onOpenSOP={() => setIsSOPOpen(true)}
            onCloseMobile={() => setSidebarOpen(false)}
            collapsed={isDesktopSidebarCollapsed}
            onToggleCollapsed={() => setIsDesktopSidebarCollapsed((current) => !current)}
            searchFocusRequest={sidebarSearchFocusRequest}
          />
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-[1150] bg-black/40 lg:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main data-tour="map-container" className="app-main relative min-w-0 flex-1 overflow-hidden">
          <div className="app-top-overlay absolute inset-x-0 top-0 z-[1000] pointer-events-none">
            <div className="flex items-start justify-between gap-3">
              <div className="pointer-events-auto flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  {!sidebarOpen ? (
                    <div className="flex items-center gap-2 lg:hidden">
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-[color:var(--card-elevated)]/90 backdrop-blur"
                        onClick={() => {
                          setSidebarOpen(true);
                        }}
                        aria-label="Open sidebar"
                      >
                        <Menu className="h-4 w-4" />
                      </Button>
                      {isAddMode ? (
                        <Badge variant="warning" className="shadow-sm">
                          Map placement active
                        </Badge>
                      ) : companyBoundaryDraft ? (
                        <Badge variant="secondary" className="shadow-sm">
                          Company pen active
                        </Badge>
                      ) : floorPlanDraft ? (
                        <Badge variant="secondary" className="shadow-sm">
                          Floor pen active
                        </Badge>
                      ) : isViewer ? (
                        <Badge variant="outline" className="shadow-sm">
                          Viewer mode
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}

                  <div data-tour="map-layers" className="flex shrink-0 items-center gap-1 rounded-md border border-[color:var(--border)]/60 bg-[color:var(--card-elevated)]/78 p-1 shadow-[var(--shadow-card)] backdrop-blur-md">
                    {Object.entries(MAP_BASE_LAYERS).map(([layerKey, layer]) => {
                      const isActive = mapBaseLayer === layerKey;
                      const LayerIcon = layer.icon;

                      return (
                        <AppTooltip key={layerKey} content={layer.label}>
                          <button
                            type="button"
                            onClick={() => setMapBaseLayer(layerKey)}
                            className={cn(
                              'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent transition-colors',
                              isActive
                                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                                : 'text-[var(--foreground)]/80 hover:border-[color:var(--border)] hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]'
                            )}
                            aria-label={layer.label}
                            aria-pressed={isActive}
                          >
                            <LayerIcon className="h-4 w-4" />
                            <span className="sr-only">{layer.label}</span>
                          </button>
                        </AppTooltip>
                      );
                    })}
                    <AppTooltip content="3D globe view">
                      <button
                        type="button"
                        onClick={() => setIsGlobe3DOpen(true)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[color:var(--primary)]/40 bg-[var(--primary-soft)] px-2.5 text-xs font-semibold text-[var(--primary-strong)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]"
                        aria-label="Open 3D globe view"
                      >
                        <Box className="h-4 w-4" />
                        3D
                      </button>
                    </AppTooltip>
                  </div>
                </div>

                <GeoSearchControl
                  mapRef={leafletMapRef}
                  onSelectPlace={handleGeoSearchPlaceSelect}
                  onClearSelection={() => setGeoSearchSelection(null)}
                />

                <div data-tour="map-weather" className="flex shrink-0 items-center gap-1 rounded-md border border-[color:var(--border)]/60 bg-[color:var(--card-elevated)]/78 p-1 shadow-[var(--shadow-card)] backdrop-blur-md">
                  <Button
                    size="sm"
                    variant={isWeatherToolOpen ? 'default' : 'outline'}
                    className="h-9 w-9 shrink-0 p-0"
                    onClick={() => {
                      if (!isWeatherToolOpen) {
                        setWeatherPanelPosition(null);
                      } else {
                        setIsWeatherHourlyChartOpen(false);
                        setIsWeatherHourlyChartCollapsed(false);
                      }
                      setIsWeatherToolOpen((current) => !current);
                      setWeatherLayerEnabled(true);
                    }}
                    aria-pressed={isWeatherToolOpen}
                    aria-label={isWeatherToolOpen ? 'Close weather tool' : 'Open weather tool'}
                    title={isWeatherToolOpen ? 'Close weather tool' : 'Open weather tool'}
                  >
                    <CloudSun className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={isLSTToolOpen ? 'default' : 'outline'}
                    className="h-9 w-9 shrink-0 p-0"
                    onClick={() => {
                      if (!isLSTToolOpen) {
                        setLSTPanelPosition(null);
                      }
                      setIsLSTToolOpen((current) => !current);
                      setLSTLayerEnabled(true);
                    }}
                    aria-pressed={isLSTToolOpen}
                    aria-label={isLSTToolOpen ? 'Close LST tool' : 'Open LST tool'}
                    title={isLSTToolOpen ? 'Close LST tool' : 'Open LST tool'}
                  >
                    <ThermometerSun className="h-4 w-4" />
                  </Button>
                  <PowerGridControl
                    layers={powerGridLayers}
                    status={powerGridStatus}
                    onChange={setPowerGridLayers}
                  />
                  <DataCentreControl settings={dataCentreTracker.settings} onChange={dataCentreTracker.setSettings} />
                </div>

                <div data-tour="map-tools" className="mobile-control-strip flex items-center gap-2 rounded-md border border-[color:var(--border)]/60 bg-[color:var(--card-elevated)]/78 px-2 py-1.5 shadow-[var(--shadow-card)] backdrop-blur-md sm:flex-wrap">
                  <Button
                    size="sm"
                    variant={isMapToolbarExpanded ? 'secondary' : 'outline'}
                    className="h-9 w-9 shrink-0 px-0"
                    onClick={() => setIsMapToolbarExpanded((current) => !current)}
                    aria-expanded={isMapToolbarExpanded}
                    aria-label={isMapToolbarExpanded ? 'Collapse map tools' : 'Expand map tools'}
                    title={isMapToolbarExpanded ? 'Collapse map tools' : 'Expand map tools'}
                  >
                    <Wrench className="h-4 w-4" />
                  </Button>
                  {isMapToolbarContentMounted ? (
                    <div
                      className="map-toolbar-viewport shrink-0"
                      style={{ width: `${mapToolbarViewportWidth}px` }}
                      onTransitionEnd={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          event.propertyName === 'width' &&
                          !isMapToolbarExpanded
                        ) {
                          setIsMapToolbarContentMounted(false);
                        }
                      }}
                    >
                      <div
                        ref={mapToolbarExpandedRef}
                        aria-hidden={!isMapToolbarExpanded}
                        className={cn(
                          'map-toolbar-panel',
                          isMapToolbarExpanded ? 'map-toolbar-panel-visible' : 'map-toolbar-panel-hidden-right'
                        )}
                      >
                  <Button
                    size="sm"
                    variant={showFloorPlans ? 'default' : 'outline'}
                    className="h-9 shrink-0"
                    onClick={() => setShowFloorPlans((current) => !current)}
                    tabIndex={isMapToolbarExpanded ? undefined : -1}
                  >
                    {showFloorPlans ? 'Floors on' : 'Floors off'}
                  </Button>
                  <Button
                    size="sm"
                    variant={showCompanyBoundaries ? 'default' : 'outline'}
                    className="h-9 shrink-0"
                    onClick={() => setShowCompanyBoundaries((current) => !current)}
                    tabIndex={isMapToolbarExpanded ? undefined : -1}
                  >
                    {showCompanyBoundaries ? 'Companies on' : 'Companies off'}
                  </Button>
                  <Button
                    size="sm"
                    variant={companyBoundaryDraft ? 'secondary' : 'outline'}
                    className="h-9 shrink-0"
                    disabled={!canEditAssets}
                    onClick={() => {
                      if (companyBoundaryDraft) {
                        cancelCompanyBoundaryDrawing();
                      } else {
                        startCompanyBoundaryDrawing();
                      }
                    }}
                    tabIndex={isMapToolbarExpanded ? undefined : -1}
                  >
                    {companyBoundaryDraft ? 'Cancel company' : 'Draw company'}
                  </Button>
                  <Button
                    size="sm"
                    variant={floorPlanDraft ? 'secondary' : 'outline'}
                    className="h-9 shrink-0"
                    disabled={!canEditAssets}
                    onClick={() => {
                      if (floorPlanDraft) {
                        cancelFloorPlanDrawing();
                      } else {
                        startFloorPlanDrawing();
                      }
                    }}
                    tabIndex={isMapToolbarExpanded ? undefined : -1}
                  >
                    {floorPlanDraft ? 'Cancel draw' : 'Draw floor'}
                  </Button>
                  <Button
                    size="sm"
                    variant={isDraggable ? 'secondary' : 'outline'}
                    className={`h-9 shrink-0 gap-1.5${isDraggable ? ' ring-2 ring-amber-400 ring-offset-1' : ''}`}
                    title={isDraggable ? 'Pin dragging ON — click to lock pins' : 'Pin dragging OFF — click to allow moving pins'}
                    disabled={!canEditAssets}
                    onClick={() => setIsDraggable((v) => !v)}
                    tabIndex={isMapToolbarExpanded ? undefined : -1}
                  >
                    <Move className="h-3.5 w-3.5" />
                    {isDraggable ? 'Pins unlocked' : 'Move pins'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0"
                    onClick={() => handleEditFloorPlanInfo(selectedFloorPlan)}
                    disabled={!canEditAssets || !selectedFloorPlan}
                    title={selectedFloorPlan ? 'Edit the selected floor name and company' : 'Select a floor first'}
                    tabIndex={isMapToolbarExpanded ? undefined : -1}
                  >
                    Edit info
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0"
                    onClick={() => handleEditFloorPlan(selectedFloorPlan)}
                    disabled={!canEditAssets || !selectedFloorPlan}
                    title={selectedFloorPlan ? 'Edit the selected floor boundary' : 'Select a floor first'}
                    tabIndex={isMapToolbarExpanded ? undefined : -1}
                  >
                    Reshape
                  </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* divider */}
                  <div className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" />

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    aria-label="Zoom in"
                    title="Zoom in"
                    onClick={() => leafletMapRef.current?.zoomIn()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    aria-label="Zoom out"
                    title="Zoom out"
                    onClick={() => leafletMapRef.current?.zoomOut()}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    aria-label="Reset view to Malaysia"
                    title="Reset view — Malaysia"
                    onClick={() => leafletMapRef.current?.setView(MALAYSIA_CENTER, MALAYSIA_ZOOM)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedCompanyBoundary ? (
                <div className="pointer-events-auto hidden w-full max-w-[360px] shrink-0 lg:block">
                  <Card className="border-[color:var(--border)]/50 bg-[color:var(--card-elevated)]/80 shadow-[var(--shadow-card)] backdrop-blur-xl" style={{ borderRadius: '14px' }}>
                    <CardContent className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                            Selected Company
                          </p>
                          <h2 className="truncate text-sm font-semibold">
                            {selectedCompanyBoundary.companyName || 'Unnamed company'}
                          </h2>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {selectedCompanyBoundary.state || 'State not set'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                          <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                            {selectedCompanyFloors.length} areas
                          </Badge>
                          <Badge variant="outline" className="px-2 py-0 text-[10px]">
                            {selectedCompanyAssetCount} assets
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {selectedCompanyFloors.slice(0, 4).map((floorPlan) => (
                          <Badge key={floorPlan.id} variant="outline" className="px-2 py-0 text-[10px]">
                            {floorPlan.name || 'Area'}
                          </Badge>
                        ))}
                        {selectedCompanyFloors.length > 4 ? (
                          <Badge variant="outline" className="px-2 py-0 text-[10px]">
                            +{selectedCompanyFloors.length - 4} more
                          </Badge>
                        ) : null}
                      </div>

                      {selectedCompanyBoundary.notes ? (
                        <p className="text-[11px] text-[var(--muted)]">{selectedCompanyBoundary.notes}</p>
                      ) : (
                        <p className="text-[11px] text-[var(--muted)]">
                          This parent boundary groups area/floor polygons that use the same company name.
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          disabled={!canEditAssets}
                          onClick={() => handleEditCompanyBoundaryInfo(selectedCompanyBoundary)}
                        >
                          Info
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs"
                          disabled={!canEditAssets}
                          onClick={() => handleEditCompanyBoundary(selectedCompanyBoundary)}
                        >
                          Reshape
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : selectedFloorPlan ? (
                <div className="pointer-events-auto hidden w-full max-w-[360px] shrink-0 lg:block">
                  <Card className="border-[color:var(--border)]/50 bg-[color:var(--card-elevated)]/80 shadow-[var(--shadow-card)] backdrop-blur-xl" style={{ borderRadius: '14px' }}>
                    <CardContent className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                            Selected Floor
                          </p>
                          <h2 className="truncate text-sm font-semibold">
                            {selectedFloorPlan.name || 'Unnamed floor'}
                          </h2>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {selectedFloorPlan.companyName || 'Unknown company'}
                            {selectedFloorPlan.state ? ` - ${selectedFloorPlan.state}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                          <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                            {selectedFloorTransformers.length} assets
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            disabled={!canEditAssets}
                            onClick={() => handleEditFloorPlanInfo(selectedFloorPlan)}
                          >
                            Info
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs"
                            disabled={!canEditAssets}
                            onClick={() => handleEditFloorPlan(selectedFloorPlan)}
                          >
                            Reshape
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {selectedFloorTransformers.slice(0, 4).map((transformer) => (
                          <Badge key={transformer.id} variant="outline" className="px-2 py-0 text-[10px]">
                            {transformer.txName || transformer.mnemonic || 'Asset'}
                          </Badge>
                        ))}
                        {selectedFloorTransformers.length > 4 ? (
                          <Badge variant="outline" className="px-2 py-0 text-[10px]">
                            +{selectedFloorTransformers.length - 4} more
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-[11px] text-[var(--muted)]">
                        This overlay stays on the Leaflet map and groups the assets listed under this floor.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : selectedTransformer ? (
                <div className="pointer-events-auto hidden w-full max-w-[340px] shrink-0 lg:block">
                  <Card className="border-[color:var(--border)]/50 bg-[color:var(--card-elevated)]/80 shadow-[var(--shadow-card)] backdrop-blur-xl" style={{ borderRadius: '14px' }}>
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                            Focused Asset
                          </p>
                          <h2 className="truncate text-sm font-semibold">
                            {selectedTransformer.txName || 'Unnamed Transformer'}
                          </h2>
                          <p className="truncate text-xs text-[var(--muted)]">
                            {selectedTransformer.siteName || 'Unknown site'}
                            {selectedTransformer.mnemonic ? ` - ${selectedTransformer.mnemonic}` : ''}
                          </p>
                          {focusedAssetFaultSummary?.ready ? (
                            <div className="space-y-1 pt-1">
                              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                                Latest fault ({focusedAssetFaultSummary.testDateLabel})
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="px-2 py-0 text-[10px]">
                                  Tri: {focusedAssetFaultSummary.triangleZone}
                                </Badge>
                                <Badge variant="outline" className="px-2 py-0 text-[10px]">
                                  Pent: {focusedAssetFaultSummary.pentagonZone}
                                </Badge>
                              </div>
                            </div>
                          ) : focusedAssetFaultSummary?.message ? (
                            <p className="pt-1 text-[10px] text-[var(--muted)]">
                              {focusedAssetFaultSummary.message}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                          <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                            {selectedTransformer.voltage || 'Voltage N/A'}
                          </Badge>
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => handleViewDetails(selectedTransformer)}
                          >
                            Open
                          </Button>
                        </div>
                      </div>
                      {focusedAssetFaultSummary?.gasTrendPoints?.length > 1 ? (
                        <FocusedGasTrendChart
                          trendPoints={focusedAssetFaultSummary.gasTrendPoints}
                          assetName={selectedTransformer.txName || selectedTransformer.mnemonic || 'Focused asset'}
                        />
                      ) : null}

                      {floorPlanByTransformerId.get(String(selectedTransformer.id)) ? (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--border)]/80 bg-[var(--card)]/55 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--foreground)]">
                              {floorPlanByTransformerId.get(String(selectedTransformer.id)).name}
                            </p>
                            <p className="truncate text-[11px] text-[var(--muted)]">
                              {floorPlanByTransformerId.get(String(selectedTransformer.id)).companyName}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => handleOpenFloorDetail(floorPlanByTransformerId.get(String(selectedTransformer.id)))}
                          >
                            Open floor
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-[color:var(--border)]/80 bg-[var(--card)]/55 px-3 py-2">
                          <p className="text-xs font-medium text-[var(--foreground)]">
                            This transformer is not inside a saved floor yet
                          </p>
                          <p className="text-[11px] text-[var(--muted)]">
                            Draw a plant boundary on the map to group this asset under a named floor.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          </div>

          {isWeatherToolOpen ? (
            <div
              ref={weatherPanelLayerRef}
              className="weather-panel-layer pointer-events-none absolute inset-0 z-[1100]"
            >
              <div
                ref={weatherPanelRef}
                className={cn(
                  'weather-panel-floating pointer-events-auto absolute',
                  weatherPanelPosition ? 'weather-panel-floating-positioned' : 'weather-panel-floating-default'
                )}
                style={
                  weatherPanelPosition
                    ? {
                        left: `${weatherPanelPosition.left}px`,
                        top: `${weatherPanelPosition.top}px`,
                      }
                    : undefined
                }
              >
                <Suspense fallback={null}>
                <WeatherToolPanel
                  className="weather-panel-card"
                  date={weatherDate}
                  options={weatherOptions}
                  layerEnabled={weatherLayerEnabled}
                  loading={weatherLoading}
                  error={weatherError}
                  records={selectedWeatherRecords}
                  emptyMessage={weatherPanelEmptyMessage}
                  scopeLabel="Site"
                  lastUpdatedAt={weatherUpdatedAt}
                  sampleDateOptions={weatherSampleDateOptions}
                  selectedAssetName={selectedTransformer?.txName || selectedTransformer?.mnemonic || ''}
                  hourlyChartOpen={isWeatherHourlyChartOpen}
                  hourlyChartCollapsed={isWeatherHourlyChartCollapsed}
                  hourlyChartDisabled={!selectedTransformer}
                  storedNotice={weatherStoredNotice}
                  apiUrl={weatherApiUrl}
                  isDragging={isWeatherPanelDragging}
                  dragHandleProps={{
                    onPointerDown: handleWeatherPanelDragStart,
                    onPointerMove: handleWeatherPanelDragMove,
                    onPointerUp: handleWeatherPanelDragEnd,
                    onPointerCancel: handleWeatherPanelDragEnd,
                  }}
                  onDateChange={setWeatherDate}
                  onOptionChange={handleWeatherOptionChange}
                  onLayerEnabledChange={setWeatherLayerEnabled}
                  onSampleDateChange={handleWeatherSampleDateChange}
                  onToggleHourlyChart={handleToggleWeatherHourlyChart}
                  onRefresh={() => setWeatherRefreshKey((current) => current + 1)}
                  onClose={() => {
                    setIsWeatherToolOpen(false);
                    setWeatherPanelPosition(null);
                    setIsWeatherHourlyChartOpen(false);
                    setIsWeatherHourlyChartCollapsed(false);
                  }}
                />
                </Suspense>
              </div>
            </div>
          ) : null}

          {isLSTToolOpen ? (
            <div
              ref={lstPanelLayerRef}
              className="lst-panel-layer pointer-events-none absolute inset-0 z-[1090]"
            >
              <div
                ref={lstPanelRef}
                className={cn(
                  'lst-panel-floating pointer-events-auto absolute',
                  lstPanelPosition ? 'lst-panel-floating-positioned' : 'lst-panel-floating-default'
                )}
                style={
                  lstPanelPosition
                    ? {
                        left: `${lstPanelPosition.left}px`,
                        top: `${lstPanelPosition.top}px`,
                      }
                    : undefined
                }
              >
                <Suspense fallback={null}>
                <LSTToolPanel
                  className="lst-panel-card"
                  date={lstDate}
                  compareDate={lstCompareDate}
                  sourceId={lstSourceId}
                  sources={LST_LAYER_SOURCE_OPTIONS}
                  layerEnabled={lstLayerEnabled}
                  compareEnabled={lstCompareEnabled}
                  opacity={lstOpacity}
                  splitPosition={lstCompareSplit}
                  arcgisServiceUrl={lstArcgisServiceUrl}
                  arcgisToken={lstArcgisToken}
                  arcgisRasterFunction={lstArcgisRasterFunction}
                  arcgisWindowDays={lstArcgisWindowDays}
                  sampleDateOptions={weatherSampleDateOptions}
                  selectedAssetName={selectedTransformer?.txName || selectedTransformer?.mnemonic || ''}
                  isDragging={isLSTPanelDragging}
                  dragHandleProps={{
                    onPointerDown: handleLSTPanelDragStart,
                    onPointerMove: handleLSTPanelDragMove,
                    onPointerUp: handleLSTPanelDragEnd,
                    onPointerCancel: handleLSTPanelDragEnd,
                  }}
                  onDateChange={handleLSTDateChange}
                  onCompareDateChange={handleLSTCompareDateChange}
                  onSourceChange={handleLSTSourceChange}
                  onLayerEnabledChange={setLSTLayerEnabled}
                  onCompareEnabledChange={setLSTCompareEnabled}
                  onOpacityChange={handleLSTOpacityChange}
                  onSplitPositionChange={handleLSTCompareSplitChange}
                  onArcgisServiceUrlChange={setLSTArcgisServiceUrl}
                  onArcgisTokenChange={setLSTArcgisToken}
                  onArcgisRasterFunctionChange={setLSTArcgisRasterFunction}
                  onArcgisWindowDaysChange={handleLSTArcgisWindowDaysChange}
                  onSampleDateChange={handleLSTSampleDateChange}
                  onUsePreviousYear={handleUsePreviousLSTYear}
                  onRefresh={() => setLSTRefreshKey((current) => current + 1)}
                  onClose={() => {
                    setIsLSTToolOpen(false);
                    setLSTPanelPosition(null);
                  }}
                />
                </Suspense>
              </div>
            </div>
          ) : null}

          {isLSTCompareVisible ? (
            <div
              className="lst-compare-split-indicator pointer-events-none absolute inset-y-0 z-[880]"
              style={{ left: `${lstCompareSplit}%` }}
              aria-hidden="true"
            >
              <span className="lst-compare-map-label lst-compare-map-label-left">{lstCompareDate}</span>
              <span className="lst-compare-map-label lst-compare-map-label-right">{lstDate}</span>
            </div>
          ) : null}

          {isWeatherHourlyChartOpen ? (
            <Suspense fallback={null}>
            <WeatherHourlyChart
              collapsed={isWeatherHourlyChartCollapsed}
              loading={weatherHourlyLoading}
              error={weatherHourlyError}
              series={weatherHourlySeries}
              assetName={selectedTransformer?.txName || selectedTransformer?.mnemonic || ''}
              siteName={selectedTransformer?.siteName || ''}
              date={weatherDate}
              onToggleCollapsed={() => setIsWeatherHourlyChartCollapsed((current) => !current)}
              onClose={() => {
                setIsWeatherHourlyChartOpen(false);
                setIsWeatherHourlyChartCollapsed(false);
              }}
            />
            </Suspense>
          ) : null}

          <div className="app-map-region w-full">
            <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full" zoomControl={false}>
              <TileLayer attribution={activeBaseLayer.attribution} url={activeBaseLayer.url} />
              {mapBaseLayer === 'hybrid' ? (
                <TileLayer attribution={SATELLITE_LABELS_LAYER.attribution} url={SATELLITE_LABELS_LAYER.url} />
              ) : null}
              {isLSTOverlayVisible ? (
                <LSTMapLayer
                  date={lstDate}
                  compareDate={lstCompareDate}
                  sourceId={lstSourceId}
                  compareEnabled={lstCompareEnabled}
                  opacity={lstOpacity}
                  splitPosition={lstCompareSplit}
                  refreshKey={lstRefreshKey}
                  arcgisServiceUrl={lstArcgisServiceUrl}
                  arcgisToken={lstArcgisToken}
                  arcgisRasterFunction={lstArcgisRasterFunction}
                  arcgisWindowDays={lstArcgisWindowDays}
                />
              ) : null}
              <MapUpdater center={mapCenter} zoom={mapZoom} />
              <MapRefCapture mapRef={leafletMapRef} />
              <MapInteractionController sidebarActive={isSidebarInteracting} />
              <MapClickHandler onMapClick={handleMapClick} onMapContextMenu={handleMapContextMenu} />
              <CompanyBoundaryMapLayer
                companyBoundaries={companyBoundaries}
                floorPlans={floorPlans}
                canManageAssets={canEditAssets}
                showCompanyBoundaries={showCompanyBoundaries}
                selectedCompanyBoundaryId={selectedCompanyBoundaryId}
                draft={companyBoundaryDraft}
                onSelectCompanyBoundary={focusCompanyBoundary}
                onEditCompanyBoundaryInfo={handleEditCompanyBoundaryInfo}
                onEditCompanyBoundary={handleEditCompanyBoundary}
                onDeleteCompanyBoundary={handleDeleteCompanyBoundary}
                onDraftVertexMove={handleCompanyBoundaryDraftVertexMove}
              />
              <FloorPlanMapLayer
                floorPlans={floorPlans}
                transformers={filteredTransformers}
                canManageAssets={canEditAssets}
                showFloorPlans={showFloorPlans}
                selectedFloorPlanId={selectedFloorPlanId}
                draft={floorPlanDraft}
                onSelectFloorPlan={focusFloorPlan}
                onOpenFloor={handleOpenFloorDetail}
                onEditFloorPlanInfo={handleEditFloorPlanInfo}
                onEditFloorPlan={handleEditFloorPlan}
                onDeleteFloorPlan={handleDeleteFloorPlan}
                onDraftVertexMove={handleFloorDraftVertexMove}
              />
              <PowerGridMapLayer layers={powerGridLayers} onStatus={handlePowerGridStatus} />
              <DataCentreMapLayer tracker={dataCentreTracker} visible={!isGlobe3DOpen} />
              {isWeatherOverlayVisible ? (
                <WeatherMapLayer
                  records={weatherRecords}
                  options={weatherOptions}
                  selectedRecordId={selectedTransformer?.id ?? null}
                  onSelectRecord={handleWeatherRecordSelect}
                />
              ) : null}
              {geoSearchSelection?.position ? (
                <Marker position={geoSearchSelection.position} icon={geoSearchIcon}>
                  <Popup className="geo-search-popup">
                    <div className="min-w-[190px] space-y-1 px-3 py-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {geoSearchSelection.title}
                      </p>
                      {geoSearchSelection.subtitle ? (
                        <p className="text-xs text-[var(--muted)]">
                          {geoSearchSelection.subtitle}
                        </p>
                      ) : null}
                    </div>
                  </Popup>
                </Marker>
              ) : null}
              {markerClusterEnabled ? (
                <MarkerClusterGroup
                  chunkedLoading
                  disableClusteringAtZoom={MARKER_CLUSTER_DISABLE_AT_ZOOM}
                  showCoverageOnHover={false}
                  spiderfyOnMaxZoom
                  removeOutsideVisibleBounds
                >
                  {transformerMarkerNodes}
                </MarkerClusterGroup>
              ) : (
                transformerMarkerNodes
              )}
            </MapContainer>
          </div>

          {mapContextMenu ? (
            <MapLocationContextMenu
              menu={mapContextMenu}
              canAddAsset={canEditAssets}
              onClose={() => setMapContextMenu(null)}
              onShowAddress={handleMapContextShowAddress}
              onAddAsset={handleMapContextAddAsset}
              onOpenGoogleMaps={handleMapContextOpenGoogleMaps}
              onShareLocation={handleMapContextShareLocation}
              onSearchAsset={handleMapContextSearchAsset}
            />
          ) : null}

          {companyBoundaryDraft ? (
            <div className="app-bottom-banner pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center">
              <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded-md border border-sky-400/45 bg-[color:var(--card-elevated)]/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {companyBoundaryDraft.id ? 'Edit the company boundary on the map.' : 'Click on the map to draw the Company / Parent boundary.'}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {companyBoundaryDraft.points.length} point{companyBoundaryDraft.points.length === 1 ? '' : 's'} placed. Use this as the main outline for a company like GS Paper & Packaging.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUndoCompanyBoundaryDraftPoint}
                    disabled={!companyBoundaryDraft.points.length}
                  >
                    Undo point
                  </Button>
                  <Button
                    size="sm"
                    onClick={openCompanyBoundaryDialogFromDraft}
                    disabled={companyBoundaryDraft.points.length < 3}
                  >
                    Save company
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelCompanyBoundaryDrawing}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : floorPlanDraft ? (
            <div className="app-bottom-banner pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center">
              <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded-md border border-[color:var(--primary-soft)] bg-[color:var(--card-elevated)]/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {floorPlanDraft.id ? 'Edit the floor boundary on the map.' : 'Click on the map to draw the floor boundary.'}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {floorPlanDraft.points.length} point{floorPlanDraft.points.length === 1 ? '' : 's'} placed. Drag the blue handles to refine the shape, then save the floor.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUndoFloorDraftPoint}
                    disabled={!floorPlanDraft.points.length}
                  >
                    Undo point
                  </Button>
                  <Button
                    size="sm"
                    onClick={openFloorPlanDialogFromDraft}
                    disabled={floorPlanDraft.points.length < 3}
                  >
                    Save floor
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelFloorPlanDrawing}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : isAddMode ? (
            <div className="app-bottom-banner pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center">
              <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-md border border-[color:var(--warning-soft)] bg-[color:var(--card-elevated)]/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Click anywhere on the map to place a transformer.</p>
                  <p className="text-sm text-[var(--muted)]">The location opens the asset form immediately after placement.</p>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsAddMode(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {error && isSupabaseConfigured ? (
            <div className="app-toast absolute z-[1000] w-[calc(100%-2rem)] max-w-[28rem]">
              <div className="flex items-start gap-3 rounded-md border border-[color:var(--danger-soft)] bg-[color:var(--card-elevated)]/96 p-4 shadow-[var(--shadow-card)] backdrop-blur">
                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--danger-soft)] text-[var(--danger-strong)]">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Sync issue</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{error}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                  onClick={() => setError(null)}
                  aria-label="Dismiss message"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <MountWhenOpened open={isModalOpen}>
        <TransformerModal
          open={isModalOpen}
        transformer={editingTransformer}
        transformers={transformers}
        onSave={handleAddTransformer}
        onClose={closeTransformerModal}
          onShowNotice={showAppNotice}
        />
      </MountWhenOpened>

      <NoticeDialog
        open={Boolean(appNotice)}
        notice={appNotice}
        onClose={() => setAppNotice(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        description={confirmState?.description}
        detail={confirmState?.detail}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        tone={confirmState?.tone}
        busy={confirmBusy}
        onConfirm={() => confirmState?.onConfirm?.()}
        onClose={() => {
          if (confirmBusy) return;
          setConfirmState(null);
        }}
      />

      <MountWhenOpened open={isLocationRegisterOpen}>
        <LocationRegisterModule
          open={isLocationRegisterOpen}
        onClose={() => setIsLocationRegisterOpen(false)}
        onSave={handleAddTransformer}
        onFocusPosition={focusLocationPosition}
        onShowNotice={showAppNotice}
        />
      </MountWhenOpened>

      {isGlobe3DOpen ? (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[3000] grid place-items-center bg-[#041416] font-mono text-xs uppercase tracking-[0.2em] text-[#99f6e4]">
              Loading 3D view…
            </div>
          }
        >
          <Globe3DView
            dataCentreTracker={dataCentreTracker}
            transformers={filteredTransformers}
            statusById={transformerMarkerStatuses}
            companyBoundaries={showCompanyBoundaries ? companyBoundaries : []}
            floorPlans={showFloorPlans ? floorPlans : []}
            hierarchyCompanyBoundaries={companyBoundaries}
            hierarchyFloorPlans={floorPlans}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            onClose={() => setIsGlobe3DOpen(false)}
            onViewDetails={handleViewDetails}
          />
        </Suspense>
      ) : null}

      <MountWhenOpened open={isDetailModalOpen}>
        <TransformerDetailModal
          open={isDetailModalOpen}
        transformer={selectedTransformer}
        companyName={selectedTransformerPlacement.companyName}
        areaName={selectedTransformerPlacement.areaName}
        readOnly={isViewer}
        onClose={handleCloseDetailModal}
        onUpdateOilTests={handleUpdateOilTests}
        onUpdateDocuments={handleUpdateDocuments}
          onDgaPreferencesSaved={handleDgaPreferencesSaved}
        />
      </MountWhenOpened>

      <MountWhenOpened open={isFloorPlanDialogOpen}>
        <FloorPlanMetadataDialog
          open={isFloorPlanDialogOpen}
        floorPlanDraft={floorPlanDialogDraft}
        companyBoundaries={companyBoundaries}
        transformers={filteredTransformers}
        detectedTransformerIds={floorPlanDialogDraft?.detectedTransformerIds || []}
        onClose={() => {
          setIsFloorPlanDialogOpen(false);
          setFloorPlanDialogDraft(null);
        }}
        onSave={handleSaveFloorPlan}
          onShowNotice={showAppNotice}
        />
      </MountWhenOpened>

      <MountWhenOpened open={isCompanyBoundaryDialogOpen}>
        <CompanyBoundaryMetadataDialog
          open={isCompanyBoundaryDialogOpen}
        boundaryDraft={companyBoundaryDialogDraft}
        onClose={() => {
          setIsCompanyBoundaryDialogOpen(false);
          setCompanyBoundaryDialogDraft(null);
        }}
        onSave={handleSaveCompanyBoundary}
          onShowNotice={showAppNotice}
        />
      </MountWhenOpened>

      <MountWhenOpened open={isFloorDetailModalOpen}>
        <FloorPlanDetailModal
        floorPlan={floorDetailFloorPlan}
        transformers={filteredTransformers}
        isOpen={isFloorDetailModalOpen}
        canManageAssets={canEditAssets}
        onClose={() => setIsFloorDetailModalOpen(false)}
        onEditInfo={(floorPlan) => {
          handleEditFloorPlanInfo(floorPlan);
        }}
        onReshape={(floorPlan) => {
          handleEditFloorPlan(floorPlan);
        }}
        onSaveReshape={handleSaveFloorPlanShape}
        onAddTransformerToFloor={handleFloorDetailAddTransformer}
        onEditTransformer={(transformer) => {
          setEditingTransformer(transformer);
          setIsModalOpen(true);
        }}
        onViewDetails={(transformer) => {
          setSelectedTransformer(transformer);
          setIsDetailModalOpen(true);
        }}
        onRemoveFromFloor={handleRemoveTransformerFromFloor}
        onMarkerDragEnd={handleMarkerDragEnd}
          onShowNotice={showAppNotice}
        />
      </MountWhenOpened>

      <MountWhenOpened open={isAssetManagementOpen}>
        <AssetManagementDialog
          open={isAssetManagementOpen}
        onOpenChange={setIsAssetManagementOpen}
        currentUser={currentUser}
        onAssetOwnerChanged={handleAssetOwnerChanged}
        />
      </MountWhenOpened>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="mobile-form-dialog max-w-[960px]">
          <DialogHeader>
            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4 text-[var(--primary)]" />
                  Settings
                </DialogTitle>
                <DialogDescription>
                  Manage your account
                  {isAdmin ? ' and users. Asset access moved to Asset Management in the sidebar.' : '.'}
                </DialogDescription>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-1.5 text-sm">
                  <UserCircle2 className="h-5 w-5 text-[var(--muted)]" />
                  <div className="min-w-0 leading-tight">
                    <div className="font-semibold">{currentUser?.full_name || currentUser?.username}</div>
                    <div className="text-xs text-[var(--muted)]">@{currentUser?.username} · {currentUser?.role}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setAppInfoDialogMode('about')}
                      aria-label="About this app"
                      title="About this app"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setAppInfoDialogMode('disclaimer')}
                      aria-label="Disclaimer"
                      title="Disclaimer"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSignOut}>
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-shrink-0 max-h-[45vh] overflow-y-auto overscroll-contain space-y-4 p-4 sm:max-h-none sm:p-5">
              <Card>
                <CardHeader>
                  <CardTitle>Asset owner visibility</CardTitle>
                  <CardDescription>
                    Showing{' '}
                    {activeAssetOwnerFilter.value === 'all'
                      ? 'all TNB and Non-TNB assets'
                      : `${activeAssetOwnerFilter.label} assets`}{' '}
                    on the map and asset lists.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {assetOwnerFilterOptions.map((option) => {
                      const isActive = assetOwnerFilter === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={cn(
                            'flex min-h-16 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                            isActive
                              ? 'border-[color:var(--primary)] bg-[var(--primary-soft)] text-[var(--foreground)]'
                              : 'border-[color:var(--border)] bg-[var(--card-muted)] text-[var(--foreground)] hover:bg-[var(--card-strong)]'
                          )}
                          aria-pressed={isActive}
                          onClick={() => setAssetOwnerFilter(option.value)}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{option.label}</span>
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">
                              {option.value === 'all' ? 'TNB and Non-TNB' : `${option.shortLabel} assets`}
                            </span>
                          </span>
                          <Badge variant={isActive ? 'default' : 'outline'}>{option.count}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>App Tour</CardTitle>
                  <CardDescription>
                    Show the guided feature tour automatically each time you sign in.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-[var(--foreground)]">Show tour on sign-in</p>
                      <p className="text-xs text-[var(--muted)]">
                        Highlights key buttons and areas for new or returning users. Turn off once you know your way around.
                      </p>
                    </div>
                    <Switch
                      checked={tourEnabled}
                      onCheckedChange={(checked) => {
                        setTourEnabled(checked);
                        writeTourEnabled(checked);
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setShowTour(true);
                    }}
                  >
                    Launch tour now
                  </Button>
                </CardContent>
              </Card>

              {!isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle>Account</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                    <p>
                      You are signed in as <span className="font-semibold text-[var(--foreground)]">{currentUser?.username}</span>.
                      Contact an administrator to change your access to transformer assets.
                    </p>
                    {isViewer ? (
                      <p>
                        This account is in <span className="font-semibold text-[var(--foreground)]">viewer</span> mode, so asset edits, uploads, and new records are disabled.
                      </p>
                    ) : null}
                    <p>Assets you can currently view: <span className="font-semibold text-[var(--foreground)]">{transformers.length}</span></p>
                  </CardContent>
                </Card>
              )}
            </div>
            {isAdmin && (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5 sm:pb-5">
                <Suspense fallback={<p className="text-sm text-[var(--muted-foreground)]">Loading user roles…</p>}>
                  <Roles currentUser={currentUser} onClose={() => setIsSettingsOpen(false)} />
                </Suspense>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <MountWhenOpened open={appInfoDialogMode !== null}>
        <AppInfoDialog
          open={appInfoDialogMode !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setAppInfoDialogMode(null);
          }
        }}
          mode={appInfoDialogMode || 'about'}
        />
      </MountWhenOpened>

      <MountWhenOpened open={isSOPOpen}>
        <SOPFlowchartDialog
          open={isSOPOpen}
          onClose={() => setIsSOPOpen(false)}
        />
      </MountWhenOpened>

      <AppOnboardingTour
        open={showTour}
        onClose={() => setShowTour(false)}
      />
    </div>
  );
}

function FocusedGasTrendSvg({
  trendPoints = [],
  width = 248,
  height = 52,
  paddingX = 8,
  paddingY = 6,
  lineWidth = 1.7,
  dotRadius = 1.9,
  className = 'mt-1 h-14 w-full overflow-visible',
  ariaLabel = 'Focused asset DGA trend chart',
}) {
  const count = trendPoints.length;
  const drawableWidth = width - paddingX * 2;
  const drawableHeight = height - paddingY * 2;
  const maxValue = Math.max(
    ...trendPoints.flatMap((point) =>
      FOCUSED_TREND_GAS_SERIES.map((gas) => (Number.isFinite(point[gas.key]) ? point[gas.key] : 0))
    ),
    1
  );

  const getPoint = (index, value) => {
    if (!Number.isFinite(value)) {
      return null;
    }
    const x = count <= 1 ? width / 2 : paddingX + (index / (count - 1)) * drawableWidth;
    const ratio = value / maxValue;
    const y = paddingY + (1 - ratio) * drawableHeight;
    return { x, y };
  };

  const buildPath = (valueKey) => {
    let path = '';
    let previousMissing = true;

    trendPoints.forEach((point, index) => {
      const plotPoint = getPoint(index, point[valueKey]);
      if (!plotPoint) {
        previousMissing = true;
        return;
      }

      path += `${previousMissing ? 'M' : 'L'} ${plotPoint.x} ${plotPoint.y} `;
      previousMissing = false;
    });

    return path.trim();
  };

  const getLastPoint = (valueKey) => {
    for (let index = trendPoints.length - 1; index >= 0; index -= 1) {
      const plotPoint = getPoint(index, trendPoints[index][valueKey]);
      if (plotPoint) {
        return plotPoint;
      }
    }
    return null;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border)" strokeWidth="1" />
      <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 2" />
      {FOCUSED_TREND_GAS_SERIES.map((gas) => {
        const path = buildPath(gas.key);
        const lastPoint = getLastPoint(gas.key);

        if (!path) {
          return null;
        }

        return (
          <g key={gas.key}>
            <path d={path} fill="none" stroke={gas.color} strokeWidth={lineWidth} />
            {lastPoint ? <circle cx={lastPoint.x} cy={lastPoint.y} r={dotRadius} fill={gas.color} /> : null}
          </g>
        );
      })}
    </svg>
  );
}

function FocusedGasTrendExpandedChart({ trendPoints = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [tablePage, setTablePage] = useState(1);

  const chartWidth = 960;
  const chartHeight = 360;
  const margin = { top: 14, right: 24, bottom: 70, left: 78 };
  const plotWidth = chartWidth - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const sampleCount = trendPoints.length;
  const TABLE_PAGE_SIZE = 5;

  const chartMax = useMemo(() => {
    const maxValue = Math.max(
      0,
      ...trendPoints.flatMap((point) =>
        FOCUSED_TREND_GAS_SERIES.map((gas) =>
          Number.isFinite(point?.[gas.key]) ? point[gas.key] : 0
        )
      )
    );
    return getFocusedTrendChartMaximum(maxValue);
  }, [trendPoints]);

  const yTicks = useMemo(
    () => Array.from({ length: 5 }, (_, index) => (chartMax * index) / 4),
    [chartMax]
  );

  const points = useMemo(() => {
    const denominator = Math.max(1, sampleCount - 1);
    const step = sampleCount > 1 ? plotWidth / denominator : plotWidth;
    const hitWidth = sampleCount > 1 ? Math.max(28, Math.min(90, step)) : Math.max(48, plotWidth * 0.5);

    return trendPoints.map((point, index) => {
      const x = sampleCount === 1 ? margin.left + plotWidth / 2 : margin.left + (plotWidth * index) / denominator;
      const yByGas = Object.fromEntries(
        FOCUSED_TREND_GAS_SERIES.map((gas) => {
          const value = point?.[gas.key];
          const y =
            Number.isFinite(value) && chartMax > 0
              ? margin.top + plotHeight - (value / chartMax) * plotHeight
              : null;
          return [gas.key, y];
        })
      );

      const hitX = Math.max(
        margin.left,
        Math.min(margin.left + plotWidth - hitWidth, x - hitWidth / 2)
      );

      return {
        index,
        x,
        hitX,
        hitWidth,
        testDate: point?.testDate ?? '',
        dateLabel: point?.dateLabel ?? '-',
        values: {
          ...Object.fromEntries(
            FOCUSED_TREND_GAS_SERIES.map((gas) => [gas.key, point?.[gas.key]])
          ),
          co: point?.co,
          co2: point?.co2,
        },
        yByGas,
      };
    });
  }, [chartMax, margin.left, margin.top, plotHeight, plotWidth, sampleCount, trendPoints]);

  const tableRows = useMemo(
    () =>
      [...points].sort((left, right) => {
        const leftTime = Date.parse(left.testDate || '');
        const rightTime = Date.parse(right.testDate || '');

        if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
          return rightTime - leftTime;
        }

        return right.index - left.index;
      }),
    [points]
  );

  const totalTablePages = useMemo(
    () => Math.max(1, Math.ceil(tableRows.length / TABLE_PAGE_SIZE)),
    [tableRows.length, TABLE_PAGE_SIZE]
  );

  const pagedTableRows = useMemo(() => {
    const startIndex = (tablePage - 1) * TABLE_PAGE_SIZE;
    return tableRows.slice(startIndex, startIndex + TABLE_PAGE_SIZE);
  }, [TABLE_PAGE_SIZE, tablePage, tableRows]);

  useEffect(() => {
    if (tablePage > totalTablePages) {
      setTablePage(totalTablePages);
    }
  }, [tablePage, totalTablePages]);

  const activeIndex = hoveredIndex ?? selectedIndex;
  const activePoint = activeIndex != null ? points[activeIndex] ?? null : null;

  const activeAnchorY = useMemo(() => {
    if (!activePoint) {
      return null;
    }

    const yValues = FOCUSED_TREND_GAS_SERIES.map((gas) => activePoint.yByGas[gas.key]).filter((value) => Number.isFinite(value));
    if (!yValues.length) {
      return margin.top + plotHeight / 2;
    }
    return Math.min(...yValues);
  }, [activePoint, margin.top, plotHeight]);

  const tooltipPosition = useMemo(() => {
    if (!activePoint || !Number.isFinite(activeAnchorY)) {
      return null;
    }

    const leftPercent = (activePoint.x / chartWidth) * 100;
    const topPercent = (activeAnchorY / chartHeight) * 100;
    const isNearLeft = activePoint.x < chartWidth * 0.25;
    const isNearRight = activePoint.x > chartWidth * 0.75;
    const isNearTop = activeAnchorY < margin.top + 48;

    const transform = isNearTop
      ? isNearLeft
        ? 'translate(0%, 10px)'
        : isNearRight
        ? 'translate(-100%, 10px)'
        : 'translate(-50%, 10px)'
      : isNearLeft
      ? 'translate(0%, calc(-100% - 10px))'
      : isNearRight
      ? 'translate(-100%, calc(-100% - 10px))'
      : 'translate(-50%, calc(-100% - 10px))';

    return {
      left: `${leftPercent}%`,
      top: `${topPercent}%`,
      transform,
    };
  }, [activeAnchorY, activePoint, chartHeight, chartWidth, margin.top]);

  const buildPath = (valueKey) => {
    let path = '';
    let hasSegment = false;

    points.forEach((point) => {
      const y = point.yByGas[valueKey];
      if (!Number.isFinite(y)) {
        hasSegment = false;
        return;
      }

      path += `${hasSegment ? 'L' : 'M'} ${point.x} ${y} `;
      hasSegment = true;
    });

    return path.trim();
  };

  const handleSelectPoint = (index) => {
    setSelectedIndex((currentIndex) => (currentIndex === index ? null : index));
  };

  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)]/60 p-2.5">
      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-[40vh] min-h-[240px] w-full"
          role="img"
          aria-label="Expanded focused asset DGA trend chart with date and gas concentration axes"
          onPointerLeave={() => setHoveredIndex(null)}
        >
          <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="transparent" />

          {yTicks.map((tickValue) => {
            const y = margin.top + plotHeight - (tickValue / chartMax) * plotHeight;
            return (
              <g key={`focused-y-tick-${tickValue}`}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={chartWidth - margin.right}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                />
                <text
                  x={margin.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--muted)"
                >
                  {formatFocusedTrendAxisValue(tickValue)}
                </text>
              </g>
            );
          })}

          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={chartHeight - margin.bottom}
            stroke="var(--border)"
            strokeWidth="1.2"
          />
          <line
            x1={margin.left}
            y1={chartHeight - margin.bottom}
            x2={chartWidth - margin.right}
            y2={chartHeight - margin.bottom}
            stroke="var(--border)"
            strokeWidth="1.2"
          />

          {activePoint ? (
            <line
              x1={activePoint.x}
              y1={margin.top}
              x2={activePoint.x}
              y2={chartHeight - margin.bottom}
              stroke="var(--primary)"
              strokeDasharray="5 5"
              strokeWidth="1.4"
              opacity="0.7"
            />
          ) : null}

          {FOCUSED_TREND_GAS_SERIES.map((gas) => {
            const path = buildPath(gas.key);
            if (!path) {
              return null;
            }

            return (
              <path
                key={`expanded-path-${gas.key}`}
                d={path}
                fill="none"
                stroke={gas.color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {points.map((point) => (
            <rect
              key={`focused-hit-${point.index}`}
              x={point.hitX}
              y={margin.top}
              width={point.hitWidth}
              height={plotHeight + 30}
              fill="transparent"
              className="cursor-pointer"
              onPointerEnter={() => setHoveredIndex(point.index)}
              onClick={() => handleSelectPoint(point.index)}
            >
              <title>{point.dateLabel}</title>
            </rect>
          ))}

          {FOCUSED_TREND_GAS_SERIES.map((gas) =>
            points.map((point) => {
              const y = point.yByGas[gas.key];
              if (!Number.isFinite(y)) {
                return null;
              }

              const isActive = activePoint?.index === point.index;
              return (
                <g
                  key={`expanded-dot-${gas.key}-${point.index}`}
                  className="cursor-pointer"
                  onPointerEnter={() => setHoveredIndex(point.index)}
                  onClick={() => handleSelectPoint(point.index)}
                >
                  {isActive ? (
                    <circle
                      cx={point.x}
                      cy={y}
                      r="6.8"
                      fill={gas.color}
                      opacity="0.2"
                    />
                  ) : null}
                  <circle
                    cx={point.x}
                    cy={y}
                    r={isActive ? '4.7' : '3.4'}
                    fill={gas.color}
                    stroke="var(--card)"
                    strokeWidth="1.6"
                  />
                </g>
              );
            })
          )}

          {points.map((point) => (
            <text
              key={`focused-date-${point.index}`}
              x={point.x}
              y={chartHeight - margin.bottom + 18}
              textAnchor="middle"
              fontSize="10.8"
              fill={activePoint?.index === point.index ? 'var(--foreground)' : 'var(--muted)'}
              fontWeight={activePoint?.index === point.index ? '600' : '500'}
            >
              {point.dateLabel}
            </text>
          ))}

          <text
            x={margin.left + plotWidth / 2}
            y={chartHeight - 18}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--foreground)"
          >
            Date of Testing
          </text>
          <text
            x="22"
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--foreground)"
            transform={`rotate(-90 22 ${margin.top + plotHeight / 2})`}
          >
            Gas Concentration (ppm)
          </text>
        </svg>

        {activePoint && tooltipPosition ? (
          <div
            className="pointer-events-none absolute z-20 min-w-[170px] rounded-md border border-[color:var(--border)] bg-[var(--card-elevated)]/95 px-2.5 py-2 text-[11px] shadow-[var(--shadow-card)] backdrop-blur-sm"
            style={tooltipPosition}
          >
            <p className="font-semibold text-[var(--foreground)]">{activePoint.dateLabel}</p>
            <div className="mt-1.5 space-y-1 text-[var(--foreground)]">
              {FOCUSED_TREND_GAS_SERIES.map((gas) => (
                <div key={`tooltip-${gas.key}`} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: gas.color }} />
                    {gas.label}
                  </span>
                  <span className="font-medium">
                    {formatFocusedTrendTooltipValue(activePoint.values[gas.key])} ppm
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        {FOCUSED_TREND_GAS_SERIES.map((gas) => (
          <span key={`modal-legend-${gas.key}`} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: gas.color }} />
            {gas.label}
          </span>
        ))}
      </div>
      <div
        className="mt-2 overflow-x-auto rounded-md border border-[color:var(--border)]"
        onPointerLeave={() => setHoveredIndex(null)}
      >
        <table className="min-w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-[var(--card-muted)] text-[var(--muted)]">
              <th className="border-b border-[color:var(--border)] px-2.5 py-2 text-left font-semibold">Date</th>
              {FOCUSED_TREND_TABLE_GAS_SERIES.map((gas) => (
                <th
                  key={`focused-table-head-${gas.key}`}
                  className="border-b border-[color:var(--border)] px-2.5 py-2 text-right font-semibold"
                  style={{ color: gas.color }}
                >
                  {gas.name}, <FormulaWithSubscript formula={gas.formula} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedTableRows.map((point) => {
              const isActive = activePoint?.index === point.index;
              return (
                <tr
                  key={`focused-table-row-${point.index}`}
                  className="cursor-pointer"
                  style={{ backgroundColor: isActive ? 'var(--card-muted)' : 'transparent' }}
                  onPointerEnter={() => setHoveredIndex(point.index)}
                  onClick={() => handleSelectPoint(point.index)}
                >
                  <td className="border-b border-[color:var(--border)] px-2.5 py-1.5 font-medium text-[var(--foreground)]">
                    {point.dateLabel}
                  </td>
                  {FOCUSED_TREND_TABLE_GAS_SERIES.map((gas) => (
                    <td
                      key={`focused-table-cell-${point.index}-${gas.key}`}
                      className="border-b border-[color:var(--border)] px-2.5 py-1.5 text-right font-medium text-[var(--foreground)]"
                    >
                      {formatFocusedTrendTooltipValue(point.values[gas.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalTablePages > 1 ? (
        <div className="mt-1.5 flex items-center justify-end gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setTablePage((currentPage) => Math.max(1, currentPage - 1))}
            disabled={tablePage <= 1}
            className="rounded-md border border-[color:var(--border)] px-2 py-1 text-[var(--foreground)] transition disabled:cursor-not-allowed disabled:opacity-45"
          >
            Prev
          </button>
          <span className="px-1 text-[var(--muted)]">
            Page {tablePage} / {totalTablePages}
          </span>
          <button
            type="button"
            onClick={() => setTablePage((currentPage) => Math.min(totalTablePages, currentPage + 1))}
            disabled={tablePage >= totalTablePages}
            className="rounded-md border border-[color:var(--border)] px-2 py-1 text-[var(--foreground)] transition disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
        </div>
      ) : null}
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        Hover a date/dot/row for quick preview, or click to pin the info tip.
      </p>
    </div>
  );
}

function FocusedGasTrendChart({ trendPoints = [], assetName = 'Focused asset' }) {
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);

  return (
    <>
      <div className="mt-1.5 rounded-md border border-[color:var(--border)]/80 bg-[var(--card)]/80 p-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
            DGA trend
          </p>
          <p className="text-[10px] text-[var(--muted)]">last {trendPoints.length}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsChartModalOpen(true)}
          className="mt-0.5 w-full rounded-md text-left transition hover:bg-[var(--card-muted)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
          aria-label="Open DGA trend chart"
        >
          <FocusedGasTrendSvg trendPoints={trendPoints} />
          <div className="mt-0.5 flex items-center gap-2 overflow-hidden text-[9px] text-[var(--muted)]">
            {FOCUSED_TREND_GAS_SERIES.map((gas) => (
              <span key={gas.key} className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: gas.color }} />
                {gas.label}
              </span>
            ))}
          </div>
        </button>
      </div>

      <Dialog open={isChartModalOpen} onOpenChange={setIsChartModalOpen}>
        <DialogContent className="max-w-[980px]">
          <DialogHeader className="pr-10">
            <DialogTitle className="text-base sm:text-lg">DGA Trend Chart</DialogTitle>
            <DialogDescription>
              {assetName} - last {trendPoints.length} samples
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
            <FocusedGasTrendExpandedChart trendPoints={trendPoints} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MapMetric({ icon: Icon, label, value }) {
  return (
    <Card className="bg-[color:var(--card-elevated)]/92 backdrop-blur">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MapUpdater({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.75 });
  }, [center, zoom, map]);

  return null;
}

function MapRefCapture({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function MapClickHandler({ onMapClick, onMapContextMenu }) {
  useMapEvents({
    click: (event) => {
      onMapClick(event);
    },
    contextmenu: (event) => {
      onMapContextMenu?.(event);
    },
  });

  return null;
}

function MapInteractionController({ sidebarActive }) {
  const map = useMap();
  const isHoveringRef = useRef(false);
  const sidebarActiveRef = useRef(sidebarActive);

  // Keep ref in sync with latest prop value so event handlers always read fresh state
  useEffect(() => {
    sidebarActiveRef.current = sidebarActive;
  });

  // Register mouse enter/leave listeners once — handlers read refs to avoid stale closures
  useEffect(() => {
    const container = map.getContainer();

    map.scrollWheelZoom.disable();

    const handleMouseEnter = () => {
      isHoveringRef.current = true;
      if (!sidebarActiveRef.current) {
        map.scrollWheelZoom.enable();
      }
    };

    const handleMouseLeave = () => {
      isHoveringRef.current = false;
      map.scrollWheelZoom.disable();
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [map]);

  // When sidebarActive changes, sync scroll wheel zoom state immediately
  useEffect(() => {
    if (sidebarActive) {
      map.scrollWheelZoom.disable();
    } else if (isHoveringRef.current) {
      // Mouse is already inside the map — re-enable without requiring a mouse-out/in
      map.scrollWheelZoom.enable();
    }
  }, [sidebarActive, map]);

  return null;
}

export default App;
