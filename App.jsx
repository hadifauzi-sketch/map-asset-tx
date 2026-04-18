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
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  hybrid: {
    label: 'Hybrid',
    icon: Layers3,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
};

const SATELLITE_LABELS_LAYER = {
  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Labels &copy; Esri',
};

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

  const focusTransformer = (transformer, zoom = 15) => {
    setSelectedTransformer(transformer);
    setMapCenter(transformer.position);
    setMapZoom(zoom);
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
  };

  const handleUpdateDocuments = (transformerId, documents) => {
    setTransformers((current) =>
      current.map((transformer) =>
        transformer.id === transformerId ? { ...transformer, documents } : transformer
      )
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
                    <CardContent className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                          Focused Asset
                        </p>
                        <h2 className="truncate text-sm font-semibold">{selectedTransformer.txName || 'Unnamed Transformer'}</h2>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {selectedTransformer.siteName || 'Unknown site'}
                          {selectedTransformer.mnemonic ? ` - ${selectedTransformer.mnemonic}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                          {selectedTransformer.voltage || 'Voltage N/A'}
                        </Badge>
                        <Button size="sm" className="h-8 px-3 text-xs" onClick={() => handleViewDetails(selectedTransformer)}>
                          Open
                        </Button>
                      </div>
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
