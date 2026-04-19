import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  AlertTriangle,
  FileText,
  Layers3,
  Map as MapIcon,
  MapPin,
  Menu,
  Power,
  Satellite,
  TestTubeDiagonal,
  X,
} from 'lucide-react';
import TransformerMarker from './components/TransformerMarker';
import TransformerSidebar from './components/TransformerSidebar';
import TransformerModal from './components/TransformerModal';
import TransformerDetailModal from './components/TransformerDetailModal';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import { analyzeSample } from './lib/dga/diagnostics';
import { cn } from './lib/utils';
import { transformerService } from './lib/transformerService';
import { isSupabaseConfigured } from './lib/supabaseClient';
import './App.css';

const DEFAULT_CENTER = [3.139, 101.6869];
const DEFAULT_ZOOM = 11;
const THEME_STORAGE_KEY = 'transformer-asset-map-theme';
const MAP_BASE_LAYER_STORAGE_KEY = 'transformer-asset-map-base-layer';

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
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isSidebarInteracting, setIsSidebarInteracting] = useState(false);

  const activateSidebarInteraction = () => {
    setIsSidebarInteracting(true);
  };

  const deactivateSidebarInteraction = () => {
    setIsSidebarInteracting(false);
  };

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

    loadTransformers();
  }, []);

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

    const sortedOilTests = [...oilTests].sort((left, right) => {
      const dateDiff = getDateTimestamp(left.testDate) - getDateTimestamp(right.testDate);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return getDateTimestamp(left.createdAt) - getDateTimestamp(right.createdAt);
    });

    const latestTest = sortedOilTests[sortedOilTests.length - 1];

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
    deactivateSidebarInteraction();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const loadTransformers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await transformerService.getAll();
      setTransformers(data);
    } catch (err) {
      console.error('Failed to load transformers:', err);
      setError('Failed to load transformers. Please check your database connection and Supabase policies.');
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (event) => {
    if (!isAddMode) {
      return;
    }

    const newTransformer = {
      position: [event.latlng.lat, event.latlng.lng],
      siteName: '',
      state: '',
      txName: '',
      mnemonic: '',
      serialNumber: '',
      voltage: '',
      loadMVA: '',
      maker: '',
      yearBuilt: '',
    };
    setEditingTransformer(newTransformer);
    setIsModalOpen(true);
    setIsAddMode(false);
  };

  const handleAddTransformer = async (transformerData) => {
    try {
      setLoading(true);
      if (editingTransformer?.id) {
        await transformerService.update(editingTransformer.id, transformerData);
      } else {
        await transformerService.create(transformerData);
      }

      await loadTransformers();
      setIsModalOpen(false);
      setEditingTransformer(null);
    } catch (err) {
      console.error('Failed to save transformer:', err);
      window.alert('Failed to save transformer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTransformer = (transformer) => {
    setEditingTransformer(transformer);
    setIsModalOpen(true);
  };

  const handleDeleteTransformer = async (id) => {
    const confirmed = window.confirm(
      'Delete this transformer and all of its oil tests and documents? This action cannot be undone.'
    );
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await transformerService.delete(id);
      if (selectedTransformer?.id === id) {
        setSelectedTransformer(null);
        setIsDetailModalOpen(false);
      }
      await loadTransformers();
    } catch (err) {
      console.error('Failed to delete transformer:', err);
      window.alert('Failed to delete transformer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerDragEnd = async (id, newPosition) => {
    try {
      await transformerService.updatePosition(id, newPosition);
      setTransformers((current) =>
        current.map((transformer) =>
          transformer.id === id ? { ...transformer, position: newPosition } : transformer
        )
      );
    } catch (err) {
      console.error('Failed to update position:', err);
      window.alert('Failed to update position. Please try again.');
    }
  };

  const handleViewDetails = (transformer) => {
    setSelectedTransformer(transformer);
    setIsDetailModalOpen(true);
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
  };

  const activeBaseLayer = MAP_BASE_LAYERS[mapBaseLayer];

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

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex h-screen overflow-hidden">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-[1200] h-screen w-full max-w-[380px] shrink-0 overflow-hidden bg-[var(--background)] transition-all duration-300 lg:static',
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
            onAddClick={() => {
              setIsAddMode(true);
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setSidebarOpen(false);
              }
            }}
            onTransformerClick={(transformer) => focusTransformer(transformer)}
            onEditClick={handleEditTransformer}
            onDeleteClick={handleDeleteTransformer}
            onViewDetails={handleViewDetails}
            isAddMode={isAddMode}
            loading={loading}
            selectedTransformerId={selectedTransformer?.id ?? null}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
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

        <main className="relative h-screen min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-x-0 top-0 z-[1000] p-4 pointer-events-none">
            <div className="flex items-start justify-between gap-3">
              <div className="pointer-events-auto flex flex-wrap items-center gap-2">
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
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--card-elevated)]/92 p-1 shadow-[var(--shadow-card)] backdrop-blur">
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

              {selectedTransformer ? (
                <div className="pointer-events-auto hidden w-full max-w-[340px] shrink-0 lg:block">
                  <Card className="border-[color:var(--border)]/70 bg-[color:var(--card-elevated)]/72 shadow-[var(--shadow-card)] backdrop-blur-md">
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                            Focused Asset
                          </p>
                          <h2 className="truncate text-sm font-semibold">{selectedTransformer.txName || 'Unnamed Transformer'}</h2>
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
                            <p className="pt-1 text-[10px] text-[var(--muted)]">{focusedAssetFaultSummary.message}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                          <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                            {selectedTransformer.voltage || 'Voltage N/A'}
                          </Badge>
                          <Button size="sm" className="h-8 px-3 text-xs" onClick={() => handleViewDetails(selectedTransformer)}>
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
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          </div>

          <div className="h-screen w-full">
            <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full" zoomControl={false}>
              <TileLayer attribution={activeBaseLayer.attribution} url={activeBaseLayer.url} />
              {mapBaseLayer === 'hybrid' ? (
                <TileLayer attribution={SATELLITE_LABELS_LAYER.attribution} url={SATELLITE_LABELS_LAYER.url} />
              ) : null}
              <MapUpdater center={mapCenter} zoom={mapZoom} />
              <MapInteractionController sidebarActive={isSidebarInteracting} />
              <MapClickHandler onMapClick={handleMapClick} />
              {transformers.map((transformer) => (
                <TransformerMarker
                  key={transformer.id}
                  transformer={transformer}
                  icon={createTransformerIcon()}
                  isSelected={selectedTransformer?.id === transformer.id}
                  onDragEnd={handleMarkerDragEnd}
                  onEdit={handleEditTransformer}
                  onDelete={handleDeleteTransformer}
                  onViewDetails={handleViewDetails}
                  onSelect={setSelectedTransformer}
                />
              ))}
            </MapContainer>
          </div>

          {isAddMode ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[1000] flex justify-center">
              <div className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-4 rounded-md border border-[color:var(--warning-soft)] bg-[color:var(--card-elevated)]/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Click anywhere on the map to place a transformer.</p>
                  <p className="text-sm text-[var(--muted)]">The location opens the asset form immediately after placement.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsAddMode(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {error && isSupabaseConfigured ? (
            <div className="absolute bottom-4 right-4 z-[1000] w-[calc(100%-2rem)] max-w-[28rem]">
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
        onSave={handleAddTransformer}
        onClose={closeTransformerModal}
      />

      <TransformerDetailModal
        open={isDetailModalOpen}
        transformer={selectedTransformer}
        onClose={handleCloseDetailModal}
        onUpdateOilTests={handleUpdateOilTests}
        onUpdateDocuments={handleUpdateDocuments}
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
          onMouseLeave={() => setHoveredIndex(null)}
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
              onMouseEnter={() => setHoveredIndex(point.index)}
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
                  onMouseEnter={() => setHoveredIndex(point.index)}
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
        onMouseLeave={() => setHoveredIndex(null)}
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
                  onMouseEnter={() => setHoveredIndex(point.index)}
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
