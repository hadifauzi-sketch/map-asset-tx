import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';

const MIN_REMOTE_QUERY_LENGTH = 3;
const REMOTE_RESULT_LIMIT = 6;
const REMOTE_DEBOUNCE_MS = 450;
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatOsmType(place) {
  if (place?.class === 'highway') {
    return 'Road';
  }
  if (place?.class === 'place') {
    return 'Place';
  }
  return titleCase(place?.type || place?.class || 'POI');
}

function getPlaceTitle(place) {
  const displayName = String(place?.display_name || '');
  return (
    place?.namedetails?.name ||
    place?.name ||
    displayName.split(',')[0]?.trim() ||
    'Map result'
  );
}

function getPlaceSubtitle(place, title) {
  const address = place?.address || {};
  const parts = [
    address.road,
    address.neighbourhood || address.suburb || address.village || address.town || address.city,
    address.state,
    address.country,
  ];
  const uniqueParts = [];

  parts.forEach((part) => {
    if (part && normalizeText(part) !== normalizeText(title) && !uniqueParts.some((existing) => normalizeText(existing) === normalizeText(part))) {
      uniqueParts.push(part);
    }
  });

  if (uniqueParts.length) {
    return uniqueParts.join(', ');
  }

  return String(place?.display_name || '').split(',').slice(1, 4).map((part) => part.trim()).filter(Boolean).join(', ');
}

function parseBoundingBox(boundingBox) {
  if (!Array.isArray(boundingBox) || boundingBox.length !== 4) {
    return null;
  }

  const parsed = boundingBox.map((value) => Number(value));
  return parsed.every(Number.isFinite) ? parsed : null;
}

function mapOsmResult(place) {
  const latitude = Number(place?.lat);
  const longitude = Number(place?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const title = getPlaceTitle(place);
  return {
    key: `osm-${place.osm_type || 'node'}-${place.osm_id || `${latitude}-${longitude}`}`,
    source: 'osm',
    title,
    subtitle: getPlaceSubtitle(place, title),
    badge: formatOsmType(place),
    position: [latitude, longitude],
    boundingBox: parseBoundingBox(place.boundingbox),
  };
}

async function fetchRemoteResults(query, mapRef, signal) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    limit: String(REMOTE_RESULT_LIMIT),
  });

  const bounds = mapRef?.current?.getBounds?.();
  if (bounds) {
    params.set(
      'viewbox',
      [
        bounds.getWest(),
        bounds.getNorth(),
        bounds.getEast(),
        bounds.getSouth(),
      ].join(',')
    );
  }

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoder returned ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload.map(mapOsmResult).filter(Boolean) : [];
}

function getResultIcon(result) {
  if (result.badge === 'Road') {
    return LocateFixed;
  }
  if (['Amenity', 'Office', 'Shop', 'Commercial'].includes(result.badge)) {
    return Building2;
  }
  return MapPin;
}

function GeoSearchControl({
  className,
  mapRef,
  onSelectPlace,
  onClearSelection,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState([]);
  const [remoteStatus, setRemoteStatus] = useState('idle');

  const results = useMemo(() => {
    const seen = new Set();
    return remoteResults
      .filter((result) => {
        const dedupeKey = normalizeText(`${result.title}-${result.subtitle}`);
        if (seen.has(dedupeKey)) {
          return false;
        }
        seen.add(dedupeKey);
        return true;
      })
      .slice(0, REMOTE_RESULT_LIMIT);
  }, [remoteResults]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!isExpanded || trimmedQuery.length < MIN_REMOTE_QUERY_LENGTH) {
      setRemoteResults([]);
      setRemoteStatus('idle');
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setRemoteStatus('loading');
      fetchRemoteResults(trimmedQuery, mapRef, controller.signal)
        .then((nextResults) => {
          setRemoteResults(nextResults);
          setRemoteStatus('done');
        })
        .catch((error) => {
          if (error?.name === 'AbortError') {
            return;
          }
          setRemoteResults([]);
          setRemoteStatus('error');
        });
    }, REMOTE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isExpanded, mapRef, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setIsExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const selectResult = useCallback(
    (result) => {
      if (!result) {
        return;
      }

      setQuery(result.title);
      setIsOpen(false);
      setIsExpanded(false);
      onSelectPlace?.(result);
    },
    [onSelectPlace]
  );

  const expandSearch = () => {
    setIsExpanded(true);
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const clearSearch = () => {
    setQuery('');
    setRemoteResults([]);
    setRemoteStatus('idle');
    setIsOpen(false);
    setIsExpanded(false);
    onClearSelection?.();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (results[activeIndex]) {
      selectResult(results[activeIndex]);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const trimmedQuery = query.trim();
  const canShowResults = isExpanded && isOpen && trimmedQuery.length >= MIN_REMOTE_QUERY_LENGTH;
  const showEmptyState = canShowResults && remoteStatus !== 'loading' && results.length === 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'geo-search-control pointer-events-auto relative shrink-0 transition-[width] duration-200',
        isExpanded ? 'w-full sm:w-[340px] lg:w-[420px]' : 'w-10',
        className
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {!isExpanded ? (
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border)]/60 bg-[color:var(--card-elevated)]/88 text-[var(--foreground)] shadow-[var(--shadow-card)] backdrop-blur-md transition-colors hover:bg-[var(--card-muted)]"
          onClick={expandSearch}
          aria-label="Search places, roads, companies, and POI"
          title="Search places"
        >
          <Search className="h-4 w-4" />
        </button>
      ) : (
        <form
          className="flex h-10 items-center gap-2 rounded-md border border-[color:var(--border)]/60 bg-[color:var(--card-elevated)]/88 px-3 shadow-[var(--shadow-card)] backdrop-blur-md"
          onSubmit={handleSubmit}
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search places, roads, companies, POI"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            aria-label="Search places, roads, companies, and POI"
            autoComplete="off"
          />
          {remoteStatus === 'loading' ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--muted)]" />
          ) : (
            <button
              type="button"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
              onClick={() => {
                if (query) {
                  clearSearch();
                } else {
                  setIsOpen(false);
                  setIsExpanded(false);
                }
              }}
              aria-label={query ? 'Clear search' : 'Close search'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      )}

      {canShowResults ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1200] max-h-[min(430px,calc(100vh-120px))] overflow-y-auto rounded-md border border-[color:var(--border)]/70 bg-[color:var(--card-elevated)]/96 p-1 shadow-[var(--shadow-dialog)] backdrop-blur-xl">
          {results.map((result, index) => {
            const ResultIcon = getResultIcon(result);
            const isActive = index === activeIndex;

            return (
              <button
                key={result.key}
                type="button"
                className={cn(
                  'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                  isActive ? 'bg-[var(--primary-soft)] text-[var(--foreground)]' : 'hover:bg-[var(--card-muted)]'
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectResult(result)}
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--card)] text-[var(--primary)]">
                  <ResultIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{result.title}</span>
                  {result.subtitle ? (
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{result.subtitle}</span>
                  ) : null}
                </span>
                <span className="ml-2 mt-1 shrink-0 rounded-md border border-[color:var(--border)]/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                  {result.badge}
                </span>
              </button>
            );
          })}

          {remoteStatus === 'loading' ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching OpenStreetMap...
            </div>
          ) : null}

          {showEmptyState ? (
            <div className="px-3 py-3 text-sm text-[var(--muted)]">No matching map result found.</div>
          ) : null}

          {remoteStatus === 'error' ? (
            <div className="px-3 py-2 text-xs text-[var(--danger-strong)]">Place search is not available right now.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default GeoSearchControl;
