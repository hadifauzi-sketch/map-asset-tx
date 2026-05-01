import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import L from 'leaflet';
import {
  AlertTriangle,
  FileText,
  Layers3,
  LogOut,
  Map as MapIcon,
  MapPin,
  Menu,
  Move,
  Plus,
  Minus,
  Power,
  RotateCcw,
  Satellite,
  Settings as SettingsIcon,
  TestTubeDiagonal,
  UserCircle2,
  X,
} from 'lucide-react';
import TransformerMarker from './components/TransformerMarker';
import TransformerSidebar from './components/TransformerSidebar';
import TransformerModal from './components/TransformerModal';
import NoticeDialog from './components/NoticeDialog';
import TransformerDetailModal from './components/TransformerDetailModal';
import LocationRegisterModule from './components/location-register/LocationRegisterModule';
import FloorPlanMapLayer from './components/FloorPlanMapLayer';
import FloorPlanMetadataDialog from './components/FloorPlanMetadataDialog';
import FloorPlanDetailModal from './components/FloorPlanDetailModal';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import SignIn, {
  clearSession,
  getSessionIdleRemainingMs,
  readSession,
  touchSessionActivity,
} from './components/Authentic/sign-in';
import Roles from './components/Authentic/roles';
import { getStandardOptionsForOilType } from './lib/dga/appConfig';
import { analyzeSample } from './lib/dga/diagnostics';
import {
  createDraftFloorPlan,
  findTransformersInsidePolygon,
  getPolygonCentroid,
  normalizeFloorPlan,
} from './lib/floorPlanStorage';
import { floorPlanService } from './lib/floorPlanService';
import { getTransformerState } from './lib/malaysiaStates';
import { documentService } from './lib/documentService';
import { oilTestService } from './lib/oilTestService';
import { isSameImportedOilTestPayload } from './lib/oilTestImportUtils';
import { createTransformerDraft } from './lib/transformerDraft';
import { cn } from './lib/utils';
import { transformerService } from './lib/transformerService';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
import './App.css';

const DEFAULT_CENTER = [3.139, 101.6869];
const DEFAULT_ZOOM = 11;
const MALAYSIA_CENTER = [4.2105, 108.9758];
const MALAYSIA_ZOOM = 6;
const MARKER_CLUSTER_DISABLE_AT_ZOOM = 15;
const THEME_STORAGE_KEY = 'transformer-asset-map-theme';
const MAP_BASE_LAYER_STORAGE_KEY = 'transformer-asset-map-base-layer';
const DESKTOP_SIDEBAR_COLLAPSED_STORAGE_KEY = 'transformer-asset-map-desktop-sidebar-collapsed';
const SESSION_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
const IDLE_SIGN_OUT_MESSAGE = 'Session expired after 8 hours of inactivity. Please sign in again.';

const MAP_BASE_LAYERS = {
  streets: {
    label: 'Map',
    icon: MapIcon,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Apps by <a href="https://www.linkedin.com/in/chm-hadi-fauzi/" target="_blank" rel="noreferrer">ChM. Ts. Hadi Fauzi</a>',
  },
  satellite: {
    label: 'Satellite',
    icon: Satellite,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community | Apps by <a href="https://www.linkedin.com/in/chm-hadi-fauzi/" target="_blank" rel="noreferrer">ChM. Ts. Hadi Fauzi</a>',
  },
  hybrid: {
    label: 'Hybrid',
    icon: Layers3,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community | Apps by <a href="https://www.linkedin.com/in/chm-hadi-fauzi/" target="_blank" rel="noreferrer">ChM. Ts. Hadi Fauzi</a>',
  },
};

const SATELLITE_LABELS_LAYER = {
  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Labels &copy; Esri',
};

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

function getTransformerMarkerColor(transformer) {
  return MARKER_STATUS_COLORS[getTransformerMarkerStatus(transformer)] ?? MARKER_STATUS_COLORS.normal;
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

const createTransformerIcon = (color = '#0f766e') =>
  L.divIcon({
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

function App() {
  const [currentUser, setCurrentUser] = useState(() => readSession());
  const [authNotice, setAuthNotice] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [transformers, setTransformers] = useState([]);
  const [selectedTransformer, setSelectedTransformer] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingTransformer, setEditingTransformer] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appNotice, setAppNotice] = useState(null);
  const [mapBaseLayer, setMapBaseLayer] = useState(() => {
    if (typeof window === 'undefined') {
      return 'streets';
    }

    const storedLayer = window.localStorage.getItem(MAP_BASE_LAYER_STORAGE_KEY);
    return storedLayer && MAP_BASE_LAYERS[storedLayer] ? storedLayer : 'streets';
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
  const pendingFloorAssignment = useRef(null);
  const leafletMapRef = useRef(null);
  const idleSignOutTimerRef = useRef(null);
  const isAdmin = currentUser?.role === 'admin';
  const isViewer = currentUser?.role === 'viewer';
  const canEditAssets = !currentUser || currentUser.role !== 'viewer';

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
  }, [currentUser]);

  useEffect(() => {
    if (!isDetailModalOpen) {
      return;
    }

    if (!selectedTransformer) {
      setIsDetailModalOpen(false);
    }
  }, [isDetailModalOpen, selectedTransformer]);

  const overviewStats = useMemo(() => {
    const oilSamples = transformers.reduce((sum, transformer) => sum + (transformer.oilTests?.length || 0), 0);
    const documents = transformers.reduce((sum, transformer) => sum + (transformer.documents?.length || 0), 0);
    const sites = new Set(transformers.map((transformer) => transformer.siteName).filter(Boolean)).size;
    return [
      { label: 'Assets', value: transformers.length, icon: Power },
      { label: 'Oil Samples', value: oilSamples, icon: TestTubeDiagonal },
      { label: 'Documents', value: documents, icon: FileText },
      { label: 'Sites', value: sites, icon: MapPin },
    ];
  }, [transformers]);

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

  const transformerMarkerColors = useMemo(
    () =>
      new Map(
        transformers.map((transformer) => [
          transformer.id,
          getTransformerMarkerColor(transformer),
        ]),
      ),
    [transformers],
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

  const selectedFloorPlan = useMemo(
    () => floorPlans.find((floorPlan) => floorPlan.id === selectedFloorPlanId) || null,
    [floorPlans, selectedFloorPlanId]
  );

  const selectedFloorTransformers = useMemo(
    () =>
      selectedFloorPlan
        ? selectedFloorPlan.transformerIds
            .map((transformerId) => transformers.find((transformer) => String(transformer.id) === String(transformerId)))
            .filter(Boolean)
        : [],
    [selectedFloorPlan, transformers]
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

  const loadFloorPlans = async () => {
    try {
      await floorPlanService.migrateFromLocalStorage();
      const data = await floorPlanService.getAll();
      setFloorPlans(data);
    } catch (err) {
      console.error('Failed to load floor plans:', err);
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
    if (!canEditAssets) {
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

  const syncImportedReportForTransformer = async (transformerId, importSession, existingOilTests = []) => {
    if (!transformerId || !importSession?.file) {
      return {
        documentStored: false,
        createdCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
      };
    }

    await documentService.upload(transformerId, importSession.file);

    const payloads = Array.isArray(importSession.oilTestPayloads) ? importSession.oilTestPayloads : [];
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
      documentStored: true,
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

      if (savedTransformerId && importSession?.file) {
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

      if (!postSaveNotice && importSummary?.documentStored) {
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
    setSelectedTransformer(null);
    loadTransformers();
  };

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
    setSelectedFloorPlanId(null);
    setFloorPlanDraft(createDraftFloorPlan());
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
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
    setFloorPlanDraft(createDraftFloorPlan(floorPlan));
    setIsFloorPlanDialogOpen(false);
    setFloorPlanDialogDraft(null);
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

  const openLocationRegisterModule = useCallback(() => {
    if (!ensureCanEditAssets()) {
      return;
    }

    cancelFloorPlanDrawing();
    pendingFloorAssignment.current = null;
    setEditingTransformer(null);
    setIsModalOpen(false);
    setIsAddMode(false);
    setIsLocationRegisterOpen(true);
    setSelectedFloorPlanId(null);

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [cancelFloorPlanDrawing, ensureCanEditAssets]);

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

    const detectedTransformers = findTransformersInsidePolygon(transformers, floorPlanDraft.points);
    const existingFloorPlan = floorPlanDraft.id
      ? floorPlans.find((floorPlan) => floorPlan.id === floorPlanDraft.id) || null
      : null;
    const primaryTransformer =
      detectedTransformers[0] ||
      (existingFloorPlan?.transformerIds || [])
        .map((transformerId) =>
          transformers.find((transformer) => String(transformer.id) === String(transformerId))
        )
        .filter(Boolean)[0] ||
      selectedTransformer ||
      null;

    openFloorPlanMetadataDialog({
      ...createDraftFloorPlan({
        ...existingFloorPlan,
        ...floorPlanDraft,
        name: existingFloorPlan?.name || '',
        companyName: existingFloorPlan?.companyName || primaryTransformer?.siteName || '',
        state: existingFloorPlan?.state || (primaryTransformer ? getTransformerState(primaryTransformer) : '') || '',
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

  const handleDeleteFloorPlan = async (floorPlanId) => {
    if (!ensureCanEditAssets()) {
      return;
    }
    const confirmed = window.confirm(
      'Delete this floor plan overlay? The transformer records stay, but they will be ungrouped from this floor.'
    );
    if (!confirmed) {
      return;
    }

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
    } catch (err) {
      console.error('Failed to delete floor plan:', err);
      showAppNotice({
        variant: 'error',
        title: 'Unable to delete floor plan',
        description: 'The floor plan overlay could not be deleted yet.',
        detail: err?.message || 'Failed to delete floor plan. Please try again.',
        contextLabel: 'Floor plan',
      });
    }
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
  const transformerMarkerNodes = transformers.map((transformer) => (
    <TransformerMarker
      key={transformer.id}
      transformer={transformer}
      icon={createTransformerIcon(transformerMarkerColors.get(transformer.id) ?? MARKER_STATUS_COLORS.normal)}
      isSelected={selectedTransformer?.id === transformer.id}
      isDraggable={isDraggable && canEditAssets}
      canManageAssets={canEditAssets}
      onDragEnd={handleMarkerDragEnd}
      onEdit={handleEditTransformer}
      onDelete={handleDeleteTransformer}
      onViewDetails={handleViewDetails}
      onSelect={(nextTransformer) => {
        setSelectedTransformer(nextTransformer);
        setSelectedFloorPlanId(null);
      }}
    />
  ));

  return (
    <div className="app-shell relative overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="app-frame flex overflow-hidden">
        <aside
          className={cn(
            'app-sidebar fixed inset-y-0 left-0 z-[1200] w-[92vw] max-w-[380px] shrink-0 overflow-hidden transition-all duration-300 lg:static',
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
            transformers={transformers}
            floorPlans={floorPlans}
            currentUser={currentUser}
            canManageAssets={canEditAssets}
            onAddClick={() => {
              if (!ensureCanEditAssets()) {
                return;
              }
              cancelFloorPlanDrawing();
              setIsLocationRegisterOpen(false);
              setIsAddMode(true);
              setSelectedFloorPlanId(null);
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
            onEditFloorPlanInfo={handleEditFloorPlanInfo}
            onEditFloorPlan={handleEditFloorPlan}
            onDeleteFloorPlan={handleDeleteFloorPlan}
            isAddMode={isAddMode}
            isLocationRegisterOpen={isLocationRegisterOpen}
            isFloorDrawingMode={Boolean(floorPlanDraft)}
            loading={loading}
            selectedTransformerId={selectedTransformer?.id ?? null}
            selectedFloorPlanId={selectedFloorPlanId}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onCloseMobile={() => setSidebarOpen(false)}
            collapsed={isDesktopSidebarCollapsed}
            onToggleCollapsed={() => setIsDesktopSidebarCollapsed((current) => !current)}
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

        <main className="app-main relative min-w-0 flex-1 overflow-hidden">
          <div className="app-top-overlay absolute inset-x-0 top-0 z-[1000] pointer-events-none">
            <div className="flex items-start justify-between gap-3">
              <div className="pointer-events-auto flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {/* On mobile: hamburger + base-layer selector share one row to save vertical space */}
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

                  <div className="flex shrink-0 items-center gap-1 rounded-md border border-[color:var(--border)]/60 bg-[color:var(--card-elevated)]/78 p-1 shadow-[var(--shadow-card)] backdrop-blur-md">
                    {Object.entries(MAP_BASE_LAYERS).map(([layerKey, layer]) => {
                      const isActive = mapBaseLayer === layerKey;
                      const LayerIcon = layer.icon;

                      return (
                        <button
                          key={layerKey}
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
                          title={layer.label}
                        >
                          <LayerIcon className="h-4 w-4" />
                          <span className="sr-only">{layer.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mobile-control-strip flex items-center gap-2 rounded-md border border-[color:var(--border)]/60 bg-[color:var(--card-elevated)]/78 px-2 py-1.5 shadow-[var(--shadow-card)] backdrop-blur-md sm:flex-wrap">
                  <Button
                    size="sm"
                    variant={showFloorPlans ? 'default' : 'outline'}
                    className="h-9 shrink-0"
                    onClick={() => setShowFloorPlans((current) => !current)}
                  >
                    {showFloorPlans ? 'Floors on' : 'Floors off'}
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
                  >
                    {floorPlanDraft ? 'Cancel draw' : 'Draw floor'}
                  </Button>
                  <Button
                    size="sm"
                    variant={isLocationRegisterOpen ? 'secondary' : 'outline'}
                    className="h-9 shrink-0 gap-1.5"
                    disabled={!canEditAssets}
                    onClick={openLocationRegisterModule}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    GPS register
                  </Button>
                  <Button
                    size="sm"
                    variant={isDraggable ? 'secondary' : 'outline'}
                    className={`h-9 shrink-0 gap-1.5${isDraggable ? ' ring-2 ring-amber-400 ring-offset-1' : ''}`}
                    title={isDraggable ? 'Pin dragging ON — click to lock pins' : 'Pin dragging OFF — click to allow moving pins'}
                    disabled={!canEditAssets}
                    onClick={() => setIsDraggable((v) => !v)}
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
                  >
                    Reshape
                  </Button>

                  {/* divider */}
                  <div className="mx-1 h-6 w-px shrink-0 bg-[var(--border)]" />

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    title="Zoom in"
                    onClick={() => leafletMapRef.current?.zoomIn()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    title="Zoom out"
                    onClick={() => leafletMapRef.current?.zoomOut()}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 shrink-0 p-0"
                    title="Reset view — Malaysia"
                    onClick={() => leafletMapRef.current?.setView(MALAYSIA_CENTER, MALAYSIA_ZOOM)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedFloorPlan ? (
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

          <div className="app-map-region w-full">
            <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full" zoomControl={false}>
              <TileLayer attribution={activeBaseLayer.attribution} url={activeBaseLayer.url} />
              {mapBaseLayer === 'hybrid' ? (
                <TileLayer attribution={SATELLITE_LABELS_LAYER.attribution} url={SATELLITE_LABELS_LAYER.url} />
              ) : null}
              <MapUpdater center={mapCenter} zoom={mapZoom} />
              <MapRefCapture mapRef={leafletMapRef} />
              <MapInteractionController sidebarActive={isSidebarInteracting} />
              <MapClickHandler onMapClick={handleMapClick} />
              <FloorPlanMapLayer
                floorPlans={floorPlans}
                transformers={transformers}
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

          {floorPlanDraft ? (
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

      <TransformerModal
        open={isModalOpen}
        transformer={editingTransformer}
        transformers={transformers}
        onSave={handleAddTransformer}
        onClose={closeTransformerModal}
        onShowNotice={showAppNotice}
      />

      <NoticeDialog
        open={Boolean(appNotice)}
        notice={appNotice}
        onClose={() => setAppNotice(null)}
      />

      <LocationRegisterModule
        open={isLocationRegisterOpen}
        onClose={() => setIsLocationRegisterOpen(false)}
        onSave={handleAddTransformer}
        onFocusPosition={focusLocationPosition}
        onShowNotice={showAppNotice}
      />

      <TransformerDetailModal
        open={isDetailModalOpen}
        transformer={selectedTransformer}
        readOnly={isViewer}
        onClose={handleCloseDetailModal}
        onUpdateOilTests={handleUpdateOilTests}
        onUpdateDocuments={handleUpdateDocuments}
        onDgaPreferencesSaved={handleDgaPreferencesSaved}
      />

      <FloorPlanMetadataDialog
        open={isFloorPlanDialogOpen}
        floorPlanDraft={floorPlanDialogDraft}
        transformers={transformers}
        detectedTransformerIds={floorPlanDialogDraft?.detectedTransformerIds || []}
        onClose={() => {
          setIsFloorPlanDialogOpen(false);
          setFloorPlanDialogDraft(null);
        }}
        onSave={handleSaveFloorPlan}
        onShowNotice={showAppNotice}
      />

      <FloorPlanDetailModal
        floorPlan={floorDetailFloorPlan}
        transformers={transformers}
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

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-[960px]">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4 text-[var(--primary)]" />
                  Settings
                </DialogTitle>
                <DialogDescription>
                  Manage your account
                  {isAdmin ? ', users, and per-user asset access.' : '.'}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-1.5 text-sm">
                <UserCircle2 className="h-5 w-5 text-[var(--muted)]" />
                <div className="leading-tight">
                  <div className="font-semibold">{currentUser?.full_name || currentUser?.username}</div>
                  <div className="text-xs text-[var(--muted)]">@{currentUser?.username} · {currentUser?.role}</div>
                </div>
                <Button size="sm" variant="outline" onClick={handleSignOut} className="ml-2">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
            {isAdmin ? (
              <Roles currentUser={currentUser} onClose={() => setIsSettingsOpen(false)} />
            ) : (
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
        </DialogContent>
      </Dialog>
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

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (event) => {
      onMapClick(event);
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
