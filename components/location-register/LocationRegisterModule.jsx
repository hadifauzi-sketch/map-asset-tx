import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { AlertTriangle, MapPin, Power, RefreshCw, RotateCcw } from 'lucide-react';
import { createTransformerDraft } from '../../lib/transformerDraft';
import {
  getCurrentLocation,
  isLocationSecureContext,
  isLocationSupported,
  startLocationWatch,
  stopLocationWatch,
} from '../../lib/locationService';
import TransformerFormFields from '../transformer/TransformerFormFields';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const PREVIEW_FALLBACK_CENTER = [4.2105, 108.9758];
const PREVIEW_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const PREVIEW_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

function formatCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(6) : '--';
}

function formatAccuracy(value) {
  return Number.isFinite(value) ? `${Math.round(value)} m` : '--';
}

function formatLastUpdate(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return 'Waiting';
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getStatusVariant(status) {
  if (status === 'live') {
    return 'success';
  }
  if (status === 'searching') {
    return 'warning';
  }
  if (status === 'error' || status === 'unsupported') {
    return 'danger';
  }
  return 'secondary';
}

function getStatusLabel(status) {
  if (status === 'live') {
    return 'GPS live';
  }
  if (status === 'searching') {
    return 'Searching';
  }
  if (status === 'error') {
    return 'GPS error';
  }
  if (status === 'unsupported') {
    return 'Unavailable';
  }
  return 'Ready';
}

function hasValidPosition(position) {
  const latitude = Number(position?.[0]);
  const longitude = Number(position?.[1]);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function LocationMetric({ label, value, hint }) {
  return (
    <Card className="bg-[var(--card-elevated)]/80">
      <CardContent className="space-y-1.5 p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <p className="text-base font-semibold text-[var(--foreground)]">{value}</p>
        {hint ? <p className="text-xs text-[var(--muted)]">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function PreviewMapUpdater({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.75 });
  }, [center, map, zoom]);

  return null;
}

function LocationRegisterModule({ open, onClose, onSave, onFocusPosition }) {
  const watchIdRef = useRef(null);
  const liveSyncRef = useRef(true);
  const [formData, setFormData] = useState(() => createTransformerDraft());
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationSnapshot, setLocationSnapshot] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    liveSyncRef.current = liveSyncEnabled;
  }, [liveSyncEnabled]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current != null) {
      stopLocationWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const applySnapshotToDraft = useCallback((snapshot) => {
    if (!snapshot) {
      return;
    }

    setFormData((current) => ({
      ...current,
      position: [snapshot.latitude, snapshot.longitude],
    }));
  }, []);

  const handleLocationSuccess = useCallback(
    (snapshot) => {
      setLocationSnapshot(snapshot);
      setLocationStatus('live');
      setLocationError('');

      if (liveSyncRef.current) {
        applySnapshotToDraft(snapshot);
      }
    },
    [applySnapshotToDraft]
  );

  const startWatching = useCallback(() => {
    if (!isLocationSupported()) {
      setLocationStatus('unsupported');
      setLocationError('This browser does not support live location services.');
      return;
    }

    stopWatching();
    setLocationStatus('searching');
    setLocationError('');

    try {
      watchIdRef.current = startLocationWatch({
        onSuccess: handleLocationSuccess,
        onError: (message) => {
          setLocationStatus('error');
          setLocationError(message);
        },
        options: {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 12000,
        },
      });
    } catch (error) {
      setLocationStatus('error');
      setLocationError(error?.message || 'Unable to start live GPS tracking.');
    }
  }, [handleLocationSuccess, stopWatching]);

  useEffect(() => {
    if (!open) {
      stopWatching();
      return undefined;
    }

    setFormData(createTransformerDraft());
    setLocationStatus(isLocationSupported() ? 'idle' : 'unsupported');
    setLocationSnapshot(null);
    setLocationError('');
    setLiveSyncEnabled(true);
    setIsRefreshing(false);
    setIsSubmitting(false);
    liveSyncRef.current = true;

    startWatching();

    return () => {
      stopWatching();
    };
  }, [open, startWatching, stopWatching]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleRefreshLocation = async () => {
    if (!isLocationSupported()) {
      setLocationStatus('unsupported');
      setLocationError('This browser does not support live location services.');
      return;
    }

    setIsRefreshing(true);
    setLocationStatus((current) => (current === 'live' ? current : 'searching'));
    setLocationError('');

    try {
      const snapshot = await getCurrentLocation({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000,
      });
      handleLocationSuccess(snapshot);
    } catch (error) {
      setLocationStatus('error');
      setLocationError(error?.message || 'Unable to refresh the live position.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleLiveSync = () => {
    setLiveSyncEnabled((current) => {
      const nextValue = !current;

      if (nextValue && locationSnapshot) {
        applySnapshotToDraft(locationSnapshot);
      }

      return nextValue;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.siteName.trim()) {
      window.alert('Please enter a site name.');
      return;
    }
    if (!formData.txName.trim()) {
      window.alert('Please enter a transformer name.');
      return;
    }
    if (!formData.voltage.trim()) {
      window.alert('Please enter a voltage.');
      return;
    }
    if (!hasValidPosition(formData.position)) {
      window.alert('Wait for a valid GPS fix before saving this asset.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave?.(createTransformerDraft(formData));
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewCenter = hasValidPosition(formData.position) ? formData.position : PREVIEW_FALLBACK_CENTER;
  const previewZoom = hasValidPosition(formData.position)
    ? locationSnapshot?.accuracy <= 25
      ? 19
      : locationSnapshot?.accuracy <= 80
      ? 18
      : 17
    : 6;
  const accuracyRadius = useMemo(() => {
    if (!Number.isFinite(locationSnapshot?.accuracy)) {
      return 30;
    }

    return Math.min(Math.max(locationSnapshot.accuracy, 12), 250);
  }, [locationSnapshot?.accuracy]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="mobile-fullscreen-dialog max-w-6xl p-0">
        <DialogHeader className="pr-12">
          <DialogTitle>Location Register Module</DialogTitle>
          <DialogDescription>
            Register a transformer from your phone or laptop using the browser&apos;s live GPS location.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mobile-dialog-form">
          <div className="mobile-dialog-scroll space-y-5 px-4 py-4 sm:px-5 sm:py-5">
            <section className="overflow-hidden rounded-[20px] border border-[color:var(--border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary-soft),transparent_20%),transparent),var(--card-elevated)]">
              <div className="grid gap-5 p-4 lg:grid-cols-[1.1fr_0.9fr] lg:p-5">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getStatusVariant(locationStatus)}>{getStatusLabel(locationStatus)}</Badge>
                      <Badge variant={liveSyncEnabled ? 'secondary' : 'outline'}>
                        {liveSyncEnabled ? 'Live sync on' : 'Locked to current spot'}
                      </Badge>
                      <Badge variant="outline">Phone + laptop ready</Badge>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">Capture the asset exactly where you are standing</h3>
                      <p className="text-sm leading-6 text-[var(--muted)]">
                        This module listens to the browser GPS in real time, keeps the transformer position updated, and lets you lock the current spot before saving.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startWatching}
                      className="min-w-[150px] justify-center"
                    >
                      <Power className="h-4 w-4" />
                      Restart live GPS
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRefreshLocation}
                      disabled={isRefreshing}
                      className="min-w-[140px] justify-center"
                    >
                      <RefreshCw className={`h-4 w-4${isRefreshing ? ' animate-spin' : ''}`} />
                      Refresh fix
                    </Button>
                    <Button
                      type="button"
                      variant={liveSyncEnabled ? 'secondary' : 'outline'}
                      onClick={handleToggleLiveSync}
                      className="min-w-[160px] justify-center"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {liveSyncEnabled ? 'Lock current spot' : 'Resume live sync'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onFocusPosition?.(formData.position, 18)}
                      disabled={!hasValidPosition(formData.position)}
                      className="min-w-[150px] justify-center"
                    >
                      <MapPin className="h-4 w-4" />
                      Show on main map
                    </Button>
                  </div>

                  {!isLocationSecureContext() ? (
                    <div className="rounded-md border border-[color:var(--warning-soft)] bg-[var(--warning-soft)]/50 px-3 py-2 text-sm text-[var(--warning-strong)]">
                      Browser GPS needs a secure page. Use this app on HTTPS or on localhost during development.
                    </div>
                  ) : null}

                  {locationError ? (
                    <div className="rounded-md border border-[color:var(--danger-soft)] bg-[var(--danger-soft)]/55 px-3 py-3 text-sm text-[var(--danger-strong)]">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{locationError}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <LocationMetric
                      label="Locked latitude"
                      value={formatCoordinate(Number(formData.position?.[0]))}
                      hint={liveSyncEnabled ? 'Following the live GPS feed' : 'Frozen until live sync resumes'}
                    />
                    <LocationMetric
                      label="Locked longitude"
                      value={formatCoordinate(Number(formData.position?.[1]))}
                      hint={locationSnapshot ? 'Ready to save into the transformer record' : 'Waiting for the first fix'}
                    />
                    <LocationMetric
                      label="Accuracy"
                      value={formatAccuracy(locationSnapshot?.accuracy)}
                      hint="Smaller is better for field registration"
                    />
                    <LocationMetric
                      label="Last update"
                      value={formatLastUpdate(locationSnapshot?.timestamp)}
                      hint={locationStatus === 'live' ? 'GPS feed is active now' : 'Will update when a position arrives'}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Live preview</p>
                      <p className="text-sm text-[var(--muted)]">
                        The preview marker follows the locked asset coordinates that will be saved.
                      </p>
                    </div>
                    <Badge variant="outline">{hasValidPosition(formData.position) ? 'Position ready' : 'Awaiting fix'}</Badge>
                  </div>
                  <div className="overflow-hidden rounded-[18px] border border-[color:var(--border)] bg-[var(--card)] shadow-[var(--shadow-card)]">
                    <div className="h-[280px] w-full">
                      <MapContainer center={previewCenter} zoom={previewZoom} className="h-full w-full" zoomControl={false}>
                        <TileLayer attribution={PREVIEW_TILE_ATTRIBUTION} url={PREVIEW_TILE_URL} />
                        <PreviewMapUpdater center={previewCenter} zoom={previewZoom} />
                        {hasValidPosition(formData.position) ? (
                          <>
                            <Circle
                              center={formData.position}
                              radius={accuracyRadius}
                              pathOptions={{
                                color: '#0f766e',
                                weight: 1.5,
                                fillColor: '#0f766e',
                                fillOpacity: 0.14,
                              }}
                            />
                            <CircleMarker
                              center={formData.position}
                              radius={9}
                              pathOptions={{
                                color: '#ffffff',
                                weight: 3,
                                fillColor: '#0f766e',
                                fillOpacity: 1,
                              }}
                            />
                          </>
                        ) : null}
                      </MapContainer>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-[20px] border border-[color:var(--border)] bg-[var(--card)]/92 p-4 shadow-[var(--shadow-card)] sm:p-5">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Asset identity</p>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">Transformer information</h3>
                <p className="text-sm text-[var(--muted)]">
                  Fill in the asset details, then save it with the GPS coordinates captured above.
                </p>
              </div>
              <TransformerFormFields formData={formData} onChange={handleChange} />
            </section>
          </div>

          <DialogFooter className="mt-auto">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasValidPosition(formData.position)}>
              {isSubmitting ? 'Saving location asset...' : 'Save asset from live location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LocationRegisterModule;
