import { isPointInsidePolygon } from './floorPlanStorage';

export const EMPTY_ASSET_PLACEMENT = Object.freeze({ companyName: '', areaName: '' });

/**
 * Resolves the drawn area (floor plan) and company / parent boundary an asset sits in.
 *
 * The explicit floor-plan assignment wins, because that is what the user ticked in the
 * "Transformers inside this Area" list and what is persisted in `floor_plans.transformer_ids`.
 * When an asset was never ticked into an area we fall back to whichever polygon geometrically
 * contains it, so a newly added asset still reports its company and area straight away.
 */
export function resolveAssetPlacement(transformer, floorPlans = [], companyBoundaries = []) {
  if (!transformer) {
    return { ...EMPTY_ASSET_PLACEMENT };
  }

  const assetId = String(transformer.id ?? '');

  const areaPlan =
    floorPlans.find((plan) =>
      (plan?.transformerIds ?? []).some((transformerId) => String(transformerId) === assetId)
    ) ||
    floorPlans.find((plan) => isPointInsidePolygon(transformer.position, plan?.points ?? [])) ||
    null;

  const parentBoundary =
    companyBoundaries.find((boundary) =>
      isPointInsidePolygon(transformer.position, boundary?.points ?? [])
    ) || null;

  return {
    companyName: areaPlan?.companyName || parentBoundary?.companyName || '',
    areaName: areaPlan?.name || '',
  };
}
