/**
 * Asset hierarchy shared by the 2D sidebar and the 3D Tx list:
 * State → Company (site / company boundary) → Area (floor plan) → Transformer.
 *
 * Moved verbatim from components/TransformerSidebar.jsx so both views group
 * and search assets identically.
 */
import { getAssetOwnerLabel } from './assetOwner.js';
import { compareMalaysianStates, getTransformerState } from './malaysiaStates.js';

export function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function matchesTransformer(transformer, search) {
  if (!search) {
    return true;
  }

  return [
    transformer.txName,
    transformer.siteName,
    transformer.mnemonic,
    transformer.serialNumber,
    transformer.voltage,
    getAssetOwnerLabel(transformer.ownerType),
    getTransformerState(transformer),
  ]
    .filter(Boolean)
    .some((value) => normalizeText(value).includes(search));
}

export function matchesFloorPlan(floorPlan, search) {
  if (!search) {
    return true;
  }

  return [floorPlan.name, floorPlan.companyName, floorPlan.state]
    .filter(Boolean)
    .some((value) => normalizeText(value).includes(search));
}

export function sortTransformers(transformers) {
  return [...transformers].sort((left, right) => {
    const companyDifference = String(left.siteName || '').localeCompare(String(right.siteName || ''));
    if (companyDifference !== 0) {
      return companyDifference;
    }
    return String(left.txName || '').localeCompare(String(right.txName || ''));
  });
}

export function buildHierarchy(transformers, floorPlans, companyBoundaries = []) {
  const transformerById = new Map();
  transformers.forEach((transformer) => {
    transformerById.set(String(transformer.id), transformer);
  });

  const floorPlanByTransformerId = new Map();
  const stateMap = new Map();

  const ensureStateGroup = (stateName) => {
    const stateKey = stateName || 'Unassigned';
    if (!stateMap.has(stateKey)) {
      stateMap.set(stateKey, {
        state: stateKey,
        companies: new Map(),
      });
    }
    return stateMap.get(stateKey);
  };

  const ensureCompanyGroup = (stateName, companyName) => {
    const stateGroup = ensureStateGroup(stateName);
    const companyKey = companyName || 'Unassigned company';
    if (!stateGroup.companies.has(companyKey)) {
      stateGroup.companies.set(companyKey, {
        companyName: companyKey,
        companyBoundary: null,
        floorPlans: [],
        ungroupedTransformers: [],
      });
    }
    return stateGroup.companies.get(companyKey);
  };

  floorPlans.forEach((floorPlan) => {
    const assignedTransformers = floorPlan.transformerIds
      .map((transformerId) => transformerById.get(String(transformerId)))
      .filter(Boolean);

    assignedTransformers.forEach((transformer) => {
      floorPlanByTransformerId.set(String(transformer.id), floorPlan.id);
    });

    const inferredCompanyName = assignedTransformers[0]?.siteName || '';
    const inferredState = assignedTransformers[0] ? getTransformerState(assignedTransformers[0]) : '';
    const companyGroup = ensureCompanyGroup(
      floorPlan.state || inferredState || 'Unassigned',
      floorPlan.companyName || inferredCompanyName || 'Unassigned company'
    );

    companyGroup.floorPlans.push({
      ...floorPlan,
      transformers: sortTransformers(assignedTransformers),
    });
  });

  companyBoundaries.forEach((boundary) => {
    const companyGroup = ensureCompanyGroup(
      boundary.state || 'Unassigned',
      boundary.companyName || 'Unassigned company'
    );
    companyGroup.companyBoundary = boundary;
  });

  transformers.forEach((transformer) => {
    if (floorPlanByTransformerId.has(String(transformer.id))) {
      return;
    }

    const companyGroup = ensureCompanyGroup(
      getTransformerState(transformer),
      transformer.siteName || 'Unassigned company'
    );
    companyGroup.ungroupedTransformers.push(transformer);
  });

  return Array.from(stateMap.values())
    .map((stateGroup) => ({
      state: stateGroup.state,
      companies: Array.from(stateGroup.companies.values())
        .map((companyGroup) => ({
          companyName: companyGroup.companyName,
          companyBoundary: companyGroup.companyBoundary,
          floorPlans: [...companyGroup.floorPlans].sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))),
          ungroupedTransformers: sortTransformers(companyGroup.ungroupedTransformers),
        }))
        .sort((left, right) => left.companyName.localeCompare(right.companyName)),
    }))
    .sort((left, right) => compareMalaysianStates(left.state, right.state));
}

export function filterHierarchy(stateGroups, searchTerm) {
  const search = normalizeText(searchTerm);
  if (!search) {
    return stateGroups;
  }

  return stateGroups
    .map((stateGroup) => {
      const stateMatches = normalizeText(stateGroup.state).includes(search);

      const companies = stateGroup.companies
        .map((companyGroup) => {
          const companyMatches = normalizeText(companyGroup.companyName).includes(search);
          const boundaryMatches = [
            companyGroup.companyBoundary?.companyName,
            companyGroup.companyBoundary?.state,
            companyGroup.companyBoundary?.notes,
          ]
            .filter(Boolean)
            .some((value) => normalizeText(value).includes(search));

          const floorPlans = companyGroup.floorPlans
            .map((floorPlan) => {
              const floorMatches = matchesFloorPlan(floorPlan, search);
              const transformers = floorPlan.transformers.filter(
                (transformer) =>
                  stateMatches || companyMatches || boundaryMatches || floorMatches || matchesTransformer(transformer, search)
              );

              if (!stateMatches && !companyMatches && !boundaryMatches && !floorMatches && transformers.length === 0) {
                return null;
              }

              return {
                ...floorPlan,
                transformers,
              };
            })
            .filter(Boolean);

          const ungroupedTransformers = companyGroup.ungroupedTransformers.filter(
            (transformer) => stateMatches || companyMatches || boundaryMatches || matchesTransformer(transformer, search)
          );

          if (!stateMatches && !companyMatches && !boundaryMatches && floorPlans.length === 0 && ungroupedTransformers.length === 0) {
            return null;
          }

          return {
            ...companyGroup,
            floorPlans,
            ungroupedTransformers,
          };
        })
        .filter(Boolean);

      if (!stateMatches && companies.length === 0) {
        return null;
      }

      return {
        ...stateGroup,
        companies,
      };
    })
    .filter(Boolean);
}
