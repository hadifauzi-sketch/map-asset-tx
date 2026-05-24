const COMPANY_BOUNDARY_STORAGE_KEY = 'asset-tx-map-company-boundary-v1';

function createId(prefix = 'company-boundary') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePoint(point) {
  if (!Array.isArray(point) || point.length < 2) {
    return null;
  }

  const latitude = Number.parseFloat(point[0]);
  const longitude = Number.parseFloat(point[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return [latitude, longitude];
}

function readCompanyBoundaryStorage() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(COMPANY_BOUNDARY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read company boundary storage:', error);
    return [];
  }
}

export function normalizeCompanyBoundary(boundary) {
  const normalizedPoints = Array.isArray(boundary?.points)
    ? boundary.points.map((point) => normalizePoint(point)).filter(Boolean)
    : [];

  return {
    id: String(boundary?.id || createId()),
    companyName: String(boundary?.companyName || '').trim(),
    state: String(boundary?.state || '').trim(),
    notes: String(boundary?.notes || '').trim(),
    points: normalizedPoints,
    createdAt: boundary?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getAllCompanyBoundaries() {
  return readCompanyBoundaryStorage()
    .map((boundary) => normalizeCompanyBoundary(boundary))
    .filter((boundary) => boundary.points.length >= 3)
    .sort((left, right) => left.companyName.localeCompare(right.companyName));
}

export function replaceCompanyBoundaries(nextBoundaries) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      COMPANY_BOUNDARY_STORAGE_KEY,
      JSON.stringify(nextBoundaries.map((boundary) => normalizeCompanyBoundary(boundary)))
    );
  } catch (error) {
    console.error('Failed to write company boundary storage:', error);
  }
}

export function deleteCompanyBoundaryById(boundaryId) {
  const nextBoundaries = getAllCompanyBoundaries().filter((boundary) => boundary.id !== boundaryId);
  replaceCompanyBoundaries(nextBoundaries);
  return nextBoundaries;
}

export function createDraftCompanyBoundary(overrides = {}) {
  return {
    id: overrides.id || null,
    companyName: overrides.companyName || '',
    state: overrides.state || '',
    notes: overrides.notes || '',
    points: Array.isArray(overrides.points) ? overrides.points.map((point) => normalizePoint(point)).filter(Boolean) : [],
    createdAt: overrides.createdAt || null,
  };
}
