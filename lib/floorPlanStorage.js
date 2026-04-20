const FLOOR_PLAN_STORAGE_KEY = 'asset-tx-map-floor-plan-v1';

function createId(prefix = 'floor') {
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

function readFloorPlanStorage() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(FLOOR_PLAN_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read floor-plan storage:', error);
    return [];
  }
}

export function normalizeFloorPlan(plan) {
  const normalizedPoints = Array.isArray(plan?.points)
    ? plan.points.map((point) => normalizePoint(point)).filter(Boolean)
    : [];

  return {
    id: String(plan?.id || createId()),
    name: String(plan?.name || '').trim(),
    companyName: String(plan?.companyName || '').trim(),
    state: String(plan?.state || '').trim(),
    points: normalizedPoints,
    transformerIds: Array.isArray(plan?.transformerIds)
      ? Array.from(new Set(plan.transformerIds.filter(Boolean).map((value) => String(value))))
      : [],
    createdAt: plan?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getAllFloorPlans() {
  return readFloorPlanStorage()
    .map((plan) => normalizeFloorPlan(plan))
    .filter((plan) => plan.points.length >= 3)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function replaceFloorPlans(nextFloorPlans) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      FLOOR_PLAN_STORAGE_KEY,
      JSON.stringify(nextFloorPlans.map((plan) => normalizeFloorPlan(plan)))
    );
  } catch (error) {
    console.error('Failed to write floor-plan storage:', error);
  }
}

export function deleteFloorPlanById(floorPlanId) {
  const nextFloorPlans = getAllFloorPlans().filter((plan) => plan.id !== floorPlanId);
  replaceFloorPlans(nextFloorPlans);
  return nextFloorPlans;
}

export function getPolygonCentroid(points = []) {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }

  const totals = points.reduce(
    (accumulator, point) => ({
      latitude: accumulator.latitude + point[0],
      longitude: accumulator.longitude + point[1],
    }),
    { latitude: 0, longitude: 0 }
  );

  return [totals.latitude / points.length, totals.longitude / points.length];
}

export function isPointInsidePolygon(position, polygonPoints = []) {
  if (!Array.isArray(position) || position.length < 2 || polygonPoints.length < 3) {
    return false;
  }

  const x = Number(position[1]);
  const y = Number(position[0]);

  let isInside = false;
  for (let index = 0, previousIndex = polygonPoints.length - 1; index < polygonPoints.length; previousIndex = index, index += 1) {
    const xi = Number(polygonPoints[index][1]);
    const yi = Number(polygonPoints[index][0]);
    const xj = Number(polygonPoints[previousIndex][1]);
    const yj = Number(polygonPoints[previousIndex][0]);

    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

export function findTransformersInsidePolygon(transformers = [], polygonPoints = []) {
  return transformers.filter((transformer) => isPointInsidePolygon(transformer.position, polygonPoints));
}

export function createDraftFloorPlan(overrides = {}) {
  return {
    id: overrides.id || null,
    name: overrides.name || '',
    companyName: overrides.companyName || '',
    state: overrides.state || '',
    points: Array.isArray(overrides.points) ? overrides.points.map((point) => normalizePoint(point)).filter(Boolean) : [],
    transformerIds: Array.isArray(overrides.transformerIds) ? overrides.transformerIds.map((value) => String(value)) : [],
    createdAt: overrides.createdAt || null,
  };
}
