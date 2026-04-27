import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Building2,
  ChevronDown,
  Layers3,
  MapPin,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  SunMedium,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { compareMalaysianStates, getTransformerState } from '../lib/malaysiaStates';

const EXPANDED_STATES_STORAGE_KEY = 'transformer-asset-map-expanded-states';
const EXPANDED_COMPANIES_STORAGE_KEY = 'transformer-asset-map-expanded-companies';
const EXPANDED_AREAS_STORAGE_KEY = 'transformer-asset-map-expanded-areas';

function readStoredExpansionMap(storageKey) {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  } catch (error) {
    return {};
  }
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesTransformer(transformer, search) {
  if (!search) {
    return true;
  }

  return [
    transformer.txName,
    transformer.siteName,
    transformer.mnemonic,
    transformer.serialNumber,
    transformer.voltage,
    getTransformerState(transformer),
  ]
    .filter(Boolean)
    .some((value) => normalizeText(value).includes(search));
}

function matchesFloorPlan(floorPlan, search) {
  if (!search) {
    return true;
  }

  return [floorPlan.name, floorPlan.companyName, floorPlan.state]
    .filter(Boolean)
    .some((value) => normalizeText(value).includes(search));
}

function sortTransformers(transformers) {
  return [...transformers].sort((left, right) => {
    const companyDifference = String(left.siteName || '').localeCompare(String(right.siteName || ''));
    if (companyDifference !== 0) {
      return companyDifference;
    }
    return String(left.txName || '').localeCompare(String(right.txName || ''));
  });
}

function buildHierarchy(transformers, floorPlans) {
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
          floorPlans: [...companyGroup.floorPlans].sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))),
          ungroupedTransformers: sortTransformers(companyGroup.ungroupedTransformers),
        }))
        .sort((left, right) => left.companyName.localeCompare(right.companyName)),
    }))
    .sort((left, right) => compareMalaysianStates(left.state, right.state));
}

function filterHierarchy(stateGroups, searchTerm) {
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

          const floorPlans = companyGroup.floorPlans
            .map((floorPlan) => {
              const floorMatches = matchesFloorPlan(floorPlan, search);
              const transformers = floorPlan.transformers.filter(
                (transformer) =>
                  stateMatches || companyMatches || floorMatches || matchesTransformer(transformer, search)
              );

              if (!stateMatches && !companyMatches && !floorMatches && transformers.length === 0) {
                return null;
              }

              return {
                ...floorPlan,
                transformers,
              };
            })
            .filter(Boolean);

          const ungroupedTransformers = companyGroup.ungroupedTransformers.filter(
            (transformer) => stateMatches || companyMatches || matchesTransformer(transformer, search)
          );

          if (!stateMatches && !companyMatches && floorPlans.length === 0 && ungroupedTransformers.length === 0) {
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

function countVisibleAssets(stateGroups) {
  return stateGroups.reduce(
    (stateTotal, stateGroup) =>
      stateTotal +
      stateGroup.companies.reduce(
        (companyTotal, companyGroup) =>
          companyTotal +
          companyGroup.floorPlans.reduce(
            (floorTotal, floorPlan) => floorTotal + floorPlan.transformers.length,
            0
          ) +
          companyGroup.ungroupedTransformers.length,
        0
      ),
    0
  );
}

function countVisibleFloors(stateGroups) {
  return stateGroups.reduce(
    (stateTotal, stateGroup) =>
      stateTotal +
      stateGroup.companies.reduce(
        (companyTotal, companyGroup) => companyTotal + companyGroup.floorPlans.length,
        0
      ),
    0
  );
}

function getCollapsedStatLabel(statKey, label) {
  if (statKey === 'areas') {
    return 'AREA/SUB';
  }
  if (statKey === 'companies') {
    return 'CO/PARENT';
  }
  return label;
}

function TransformerSidebar({
  transformers,
  floorPlans = [],
  currentUser = null,
  canManageAssets = true,
  onAddClick,
  onLocationRegisterClick,
  onTransformerClick,
  onEditClick,
  onDeleteClick,
  onViewDetails,
  onFloorPlanClick,
  onEditFloorPlanInfo,
  onEditFloorPlan,
  onDeleteFloorPlan,
  isAddMode,
  isLocationRegisterOpen = false,
  loading,
  selectedTransformerId,
  selectedFloorPlanId,
  theme,
  onToggleTheme,
  onOpenSettings,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStates, setExpandedStates] = useState(() => readStoredExpansionMap(EXPANDED_STATES_STORAGE_KEY));
  const [expandedCompanies, setExpandedCompanies] = useState(() =>
    readStoredExpansionMap(EXPANDED_COMPANIES_STORAGE_KEY)
  );
  const [expandedFloorPlans, setExpandedFloorPlans] = useState(() => readStoredExpansionMap(EXPANDED_AREAS_STORAGE_KEY));
  const [expandedTransformers, setExpandedTransformers] = useState({});
  const [isAssetsModalOpen, setIsAssetsModalOpen] = useState(false);
  const [isAreasModalOpen, setIsAreasModalOpen] = useState(false);
  const [isCompanyParentModalOpen, setIsCompanyParentModalOpen] = useState(false);
  const [isStatesModalOpen, setIsStatesModalOpen] = useState(false);

  const hierarchy = useMemo(() => buildHierarchy(transformers, floorPlans), [floorPlans, transformers]);
  const filteredHierarchy = useMemo(() => filterHierarchy(hierarchy, searchTerm), [hierarchy, searchTerm]);
  const sortedAreas = useMemo(
    () =>
      [...floorPlans].sort((left, right) => {
        const stateDifference = compareMalaysianStates(left.state, right.state);
        if (stateDifference !== 0) {
          return stateDifference;
        }
        const companyDifference = String(left.companyName || '').localeCompare(String(right.companyName || ''));
        if (companyDifference !== 0) {
          return companyDifference;
        }
        return String(left.name || '').localeCompare(String(right.name || ''));
      }),
    [floorPlans]
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
  const areaSubstationAssets = useMemo(
    () =>
      [...transformers].sort((left, right) => {
        const transformerNameDifference = String(left.txName || '').localeCompare(String(right.txName || ''));
        if (transformerNameDifference !== 0) {
          return transformerNameDifference;
        }
        const mnemonicDifference = String(left.mnemonic || '').localeCompare(String(right.mnemonic || ''));
        if (mnemonicDifference !== 0) {
          return mnemonicDifference;
        }
        return String(left.serialNumber || '').localeCompare(String(right.serialNumber || ''));
      }),
    [transformers]
  );
  const companyParentList = useMemo(() => {
    const registry = new Map();
    const ensureEntry = (rawName) => {
      const name = String(rawName || '').trim();
      if (!name) {
        return null;
      }
      if (!registry.has(name)) {
        registry.set(name, { name, areaCount: 0, assetCount: 0 });
      }
      return registry.get(name);
    };

    floorPlans.forEach((floorPlan) => {
      const entry = ensureEntry(floorPlan.companyName);
      if (entry) {
        entry.areaCount += 1;
      }
    });

    transformers.forEach((transformer) => {
      const entry = ensureEntry(transformer.siteName);
      if (entry) {
        entry.assetCount += 1;
      }
    });

    return Array.from(registry.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [floorPlans, transformers]);
  const statesList = useMemo(
    () =>
      hierarchy.map((stateGroup) => {
        const areaCount = stateGroup.companies.reduce(
          (total, companyGroup) => total + companyGroup.floorPlans.length,
          0
        );
        const assetCount = stateGroup.companies.reduce(
          (total, companyGroup) =>
            total +
            companyGroup.floorPlans.reduce(
              (floorTotal, floorPlan) => floorTotal + floorPlan.transformers.length,
              0
            ) +
            companyGroup.ungroupedTransformers.length,
          0
        );

        return {
          name: stateGroup.state,
          areaCount,
          assetCount,
        };
      }),
    [hierarchy]
  );

  const quickStats = useMemo(() => {
    return [
      { key: 'assets', label: 'Assets', value: transformers.length, icon: Zap },
      { key: 'areas', label: 'Areas/Substation', value: floorPlans.length, icon: Layers3 },
      { key: 'companies', label: 'Company/Parent', value: companyParentList.length, icon: Building2 },
      { key: 'states', label: 'States', value: statesList.length, icon: MapPin },
    ];
  }, [companyParentList.length, floorPlans.length, statesList.length, transformers.length]);

  const visibleAssetCount = countVisibleAssets(filteredHierarchy);
  const visibleFloorCount = countVisibleFloors(filteredHierarchy);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(EXPANDED_STATES_STORAGE_KEY, JSON.stringify(expandedStates));
  }, [expandedStates]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(EXPANDED_COMPANIES_STORAGE_KEY, JSON.stringify(expandedCompanies));
  }, [expandedCompanies]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(EXPANDED_AREAS_STORAGE_KEY, JSON.stringify(expandedFloorPlans));
  }, [expandedFloorPlans]);

  const toggleExpandedValue = (setter, key) => {
    setter((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const toggleTransformerExpanded = (transformerId) => {
    setExpandedTransformers((current) => ({
      ...current,
      [transformerId]: !current[transformerId],
    }));
  };

  const openAssetsModal = () => setIsAssetsModalOpen(true);
  const closeAssetsModal = () => setIsAssetsModalOpen(false);
  const handleAssetSelect = (transformer) => {
    const searchToken = String(
      transformer?.txName || transformer?.mnemonic || transformer?.serialNumber || ''
    ).trim();
    if (searchToken) {
      setSearchTerm(searchToken);
    }

    const assignedFloorPlan = floorPlanByTransformerId.get(String(transformer?.id));
    const stateName = assignedFloorPlan?.state || getTransformerState(transformer) || 'Unassigned';
    const companyName = assignedFloorPlan?.companyName || transformer?.siteName || 'Unassigned company';
    const stateKey = `state:${stateName}`;
    const companyKey = `company:${stateName}:${companyName}`;

    setExpandedStates((current) => ({
      ...current,
      [stateKey]: true,
    }));
    setExpandedCompanies((current) => ({
      ...current,
      [companyKey]: true,
    }));
    if (assignedFloorPlan?.id) {
      const floorKey = `floor:${assignedFloorPlan.id}`;
      setExpandedFloorPlans((current) => ({
        ...current,
        [floorKey]: true,
      }));
    }

    onTransformerClick(transformer);
    closeAssetsModal();
  };
  const openAreasModal = () => setIsAreasModalOpen(true);
  const closeAreasModal = () => setIsAreasModalOpen(false);
  const handleAreaSelect = (area) => {
    onFloorPlanClick(area);
    closeAreasModal();
  };
  const openCompanyParentModal = () => setIsCompanyParentModalOpen(true);
  const closeCompanyParentModal = () => setIsCompanyParentModalOpen(false);
  const handleCompanyParentSelect = (companyParentName) => {
    setSearchTerm(companyParentName);
    closeCompanyParentModal();
  };
  const openStatesModal = () => setIsStatesModalOpen(true);
  const closeStatesModal = () => setIsStatesModalOpen(false);
  const handleStateSelect = (stateName) => {
    setSearchTerm(stateName);
    closeStatesModal();
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center justify-between bg-[color:var(--sidebar)]/88 px-3 py-4 backdrop-blur-xl">
        <div className="flex w-full flex-col items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="h-11 w-11"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>

          <div className="flex w-full flex-col items-center gap-2 border-y border-[color:var(--border)] py-3">
            {canManageAssets ? (
              <>
                <button
                  type="button"
                  className="flex w-full flex-col items-center gap-1 rounded-md px-2 py-2 text-center text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                  onClick={onAddClick}
                  aria-label={isAddMode ? 'Map placement armed' : 'Add transformer'}
                  title={isAddMode ? 'Map placement armed' : 'Add transformer'}
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
                    {isAddMode ? 'Place' : 'Add'}
                  </span>
                </button>
                <button
                  type="button"
                  className="flex w-full flex-col items-center gap-1 rounded-md px-2 py-2 text-center text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                  onClick={onLocationRegisterClick}
                  aria-label={isLocationRegisterOpen ? 'Location register open' : 'Open location register'}
                  title={isLocationRegisterOpen ? 'Location register open' : 'Open location register'}
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
                    {isLocationRegisterOpen ? 'GPS On' : 'GPS'}
                  </span>
                </button>
              </>
            ) : (
              <Badge variant="outline" className="justify-center px-2 py-1 text-[10px]">
                Viewer
              </Badge>
            )}

            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={onOpenSettings}
              aria-label="Open settings"
              title={currentUser ? `Open settings for ${currentUser.username}` : 'Open settings'}
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex w-full flex-col gap-2">
            {quickStats.map((stat) => {
              const Icon = stat.icon;
              const isAssetsStat = stat.key === 'assets';
              const isAreasStat = stat.key === 'areas';
              const isCompanyParentStat = stat.key === 'companies';
              const isStatesStat = stat.key === 'states';
              const sharedClassName =
                'flex w-full flex-col items-center gap-1 overflow-hidden rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2 py-2 text-center transition-colors hover:bg-[var(--card-muted)]';

              if (isAssetsStat || isAreasStat || isCompanyParentStat || isStatesStat) {
                const onClick = isAssetsStat
                  ? openAssetsModal
                  : isAreasStat
                    ? openAreasModal
                    : isCompanyParentStat
                      ? openCompanyParentModal
                      : openStatesModal;
                const ariaLabel = isAssetsStat
                  ? `Assets: ${stat.value}. Open assets list`
                  : isAreasStat
                    ? `Areas/Substation: ${stat.value}. Open areas list`
                    : isCompanyParentStat
                      ? `Company/Parent: ${stat.value}. Open company/parent list`
                      : `States: ${stat.value}. Open states list`;
                const title = isAssetsStat
                  ? 'Open assets list'
                  : isAreasStat
                    ? 'Open areas/substation list'
                    : isCompanyParentStat
                      ? 'Open company/parent list'
                      : 'Open states list';
                return (
                  <button
                    key={stat.key}
                    type="button"
                    className={`${sharedClassName} cursor-pointer`}
                    onClick={onClick}
                    aria-label={ariaLabel}
                    title={title}
                  >
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{stat.value}</span>
                    <span className="max-w-full whitespace-normal break-words text-[8px] font-medium uppercase leading-tight tracking-[0.08em] text-[var(--muted)]">
                      {getCollapsedStatLabel(stat.key, stat.label)}
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={stat.key}
                  className={sharedClassName}
                  aria-label={`${stat.label}: ${stat.value}`}
                  title={`${stat.label}: ${stat.value}`}
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">{stat.value}</span>
                  <span className="max-w-full whitespace-normal break-words text-[8px] font-medium uppercase leading-tight tracking-[0.08em] text-[var(--muted)]">
                    {getCollapsedStatLabel(stat.key, stat.label)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          {loading ? (
            <Badge variant="secondary" className="justify-center px-2 py-1 text-[10px]">
              Sync
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <AssetsListDialog
          open={isAssetsModalOpen}
          assets={areaSubstationAssets}
          selectedAssetId={selectedTransformerId}
          onClose={closeAssetsModal}
          onSelectAsset={handleAssetSelect}
          canManageAssets={canManageAssets}
          onViewDetails={(asset) => { onViewDetails(asset); closeAssetsModal(); }}
          onEdit={(asset) => { onEditClick(asset); closeAssetsModal(); }}
          onDelete={(assetId) => { onDeleteClick(assetId); closeAssetsModal(); }}
        />
        <AreasListDialog
          open={isAreasModalOpen}
          areas={sortedAreas}
          selectedAreaId={selectedFloorPlanId}
          onClose={closeAreasModal}
          onSelectArea={handleAreaSelect}
        />
        <CompanyParentListDialog
          open={isCompanyParentModalOpen}
          companyParents={companyParentList}
          onClose={closeCompanyParentModal}
          onSelectCompanyParent={handleCompanyParentSelect}
        />
        <StatesListDialog
          open={isStatesModalOpen}
          states={statesList}
          onClose={closeStatesModal}
          onSelectState={handleStateSelect}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--sidebar)]/88 backdrop-blur-xl">
      <header className="shrink-0 border-b border-[color:var(--border)] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge
              variant="secondary"
              className="max-w-full truncate px-2.5 py-1 text-[11px] font-medium tracking-[0.02em]"
              title={currentUser?.username || currentUser?.full_name || 'Asset map'}
            >
              {currentUser?.full_name || currentUser?.username || 'Asset map'}
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold">TX Asset Management</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onOpenSettings}
              aria-label="Open settings"
              title={currentUser ? `Open settings for ${currentUser.username}` : 'Open settings'}
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {quickStats.map((stat) => {
            const Icon = stat.icon;
            const isAssetsStat = stat.key === 'assets';
            const isAreasStat = stat.key === 'areas';
            const isCompanyParentStat = stat.key === 'companies';
            const isStatesStat = stat.key === 'states';
            const cardBody = (
              <CardContent className="space-y-1.5 p-3">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    {stat.label}
                  </p>
                  <p className="text-xl font-semibold leading-none">{stat.value}</p>
                </div>
              </CardContent>
            );

            if (isAssetsStat || isAreasStat || isCompanyParentStat || isStatesStat) {
              const onClick = isAssetsStat
                ? openAssetsModal
                : isAreasStat
                  ? openAreasModal
                  : isCompanyParentStat
                    ? openCompanyParentModal
                    : openStatesModal;
              const ariaLabel = isAssetsStat
                ? `Assets: ${stat.value}. Open assets list`
                : isAreasStat
                  ? `Areas/Substation: ${stat.value}. Open areas list`
                  : isCompanyParentStat
                    ? `Company/Parent: ${stat.value}. Open company/parent list`
                    : `States: ${stat.value}. Open states list`;
              const title = isAssetsStat
                ? 'Open assets list'
                : isAreasStat
                  ? 'Open areas/substation list'
                  : isCompanyParentStat
                    ? 'Open company/parent list'
                    : 'Open states list';
              return (
                <Card key={stat.key} className="bg-[var(--card-elevated)]">
                  <button
                    type="button"
                    className="w-full rounded-[inherit] text-left transition-colors hover:bg-[var(--card-muted)]"
                    onClick={onClick}
                    aria-label={ariaLabel}
                    title={title}
                  >
                    {cardBody}
                  </button>
                </Card>
              );
            }

            return (
              <Card key={stat.key} className="bg-[var(--card-elevated)]">
                {cardBody}
              </Card>
            );
          })}
        </div>
      </header>

      <section className="shrink-0 border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex flex-col gap-3">
          {canManageAssets ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className="w-full justify-center"
                variant={isAddMode ? 'secondary' : 'default'}
                onClick={onAddClick}
              >
                <Plus className="h-4 w-4" />
                {isAddMode ? 'Map placement armed' : 'Transformer'}
              </Button>
              <Button
                className="w-full justify-center"
                variant={isLocationRegisterOpen ? 'secondary' : 'outline'}
                onClick={onLocationRegisterClick}
              >
                <MapPin className="h-4 w-4" />
                {isLocationRegisterOpen ? 'Location register open' : 'GPS register'}
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="justify-center px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em]">
              Viewer mode
            </Badge>
          )}

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Find an asset or floor
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by floor, company, or transformer"
                className="pl-9 pr-9"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  X
                </button>
              ) : null}
            </div>
          </label>
        </div>
      </section>

      <div
        className="sidebar-scroll min-h-0 flex-1 overflow-y-scroll overscroll-contain px-5 py-5"
        onWheelCapture={(event) => {
          event.stopPropagation();
          if (typeof event.nativeEvent.stopImmediatePropagation === 'function') {
            event.nativeEvent.stopImmediatePropagation();
          }
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Floor hierarchy</p>
            <p className="text-sm text-[var(--muted)]">
              {visibleAssetCount} assets and {visibleFloorCount} floors visible in {filteredHierarchy.length} state groups
            </p>
          </div>
          {loading ? <Badge variant="secondary">Syncing</Badge> : null}
        </div>

        {filteredHierarchy.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-5 text-center">
              <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-md bg-[var(--card-muted)] text-[var(--muted)]">
                <Layers3 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {searchTerm ? 'No floors or transformers matched that search.' : 'No floors saved yet.'}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {searchTerm
                    ? 'Try a different keyword or clear the filter.'
                    : 'Use the draw floor button to sketch a plant boundary on the map.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredHierarchy.map((stateGroup) => {
              const stateKey = `state:${stateGroup.state}`;
              const isStateExpanded = Boolean(expandedStates[stateKey]);

              return (
                <section key={stateGroup.state} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleExpandedValue(setExpandedStates, stateKey)}
                    aria-expanded={isStateExpanded}
                    className="flex w-full items-center justify-between rounded-md border border-emerald-300/60 bg-emerald-50/70 px-3 py-2 text-left transition-colors hover:bg-emerald-100/80 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:hover:bg-emerald-900/45"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{stateGroup.state}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                        {stateGroup.companies.length} companies
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{stateGroup.companies.length}</Badge>
                      <ChevronDown
                        className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${
                          isStateExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isStateExpanded ? (
                    <div className="space-y-3 pl-1">
                      {stateGroup.companies.map((companyGroup) => {
                        const companyKey = `company:${stateGroup.state}:${companyGroup.companyName}`;
                        const isCompanyExpanded = Boolean(expandedCompanies[companyKey]);
                        const companyAssetCount =
                          companyGroup.floorPlans.reduce(
                            (sum, floorPlan) => sum + floorPlan.transformers.length,
                            0
                          ) + companyGroup.ungroupedTransformers.length;

                        return (
                          <section key={companyKey} className="space-y-3">
                            <button
                              type="button"
                              onClick={() => toggleExpandedValue(setExpandedCompanies, companyKey)}
                              aria-expanded={isCompanyExpanded}
                              className="flex w-full items-center justify-between rounded-md border border-sky-300/60 bg-sky-50/65 px-3 py-2 text-left transition-colors hover:bg-sky-100/80 dark:border-sky-900/60 dark:bg-sky-950/30 dark:hover:bg-sky-900/40"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                                  {companyGroup.companyName}
                                </p>
                                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                                  {companyGroup.floorPlans.length} floors · {companyAssetCount} assets
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{companyAssetCount}</Badge>
                                <ChevronDown
                                  className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${
                                    isCompanyExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                            </button>

                            {isCompanyExpanded ? (
                              <div className="space-y-3 pl-2">
                                {companyGroup.floorPlans.map((floorPlan) => {
                                  const floorKey = `floor:${floorPlan.id}`;
                                  const isFloorExpanded = Boolean(expandedFloorPlans[floorKey]);
                                  const isFloorSelected = selectedFloorPlanId === floorPlan.id;

                                  return (
                                    <article
                                      key={floorPlan.id}
                                      className={`rounded-md border p-3 shadow-[var(--shadow-card)] ${
                                        isFloorSelected
                                          ? 'border-[color:var(--primary)] bg-[var(--primary-soft)] ring-1 ring-[color:var(--ring)]'
                                          : 'border-violet-300/60 bg-violet-50/45 dark:border-violet-900/50 dark:bg-violet-950/20'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <button
                                          type="button"
                                          className="min-w-0 flex-1 text-left"
                                          onClick={() => onFloorPlanClick(floorPlan)}
                                        >
                                          <div className="flex items-center gap-2">
                                            <div
                                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
                                                isFloorSelected
                                                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                                                  : 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                                              }`}
                                            >
                                              <Layers3 className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                                                {floorPlan.name || 'Unnamed floor'}
                                              </p>
                                              <p className="text-xs text-[var(--muted)]">
                                                {floorPlan.transformers.length} transformers inside
                                              </p>
                                            </div>
                                          </div>
                                        </button>

                                        <div className="flex items-center gap-1">
                                          {canManageAssets ? (
                                            <>
                                              <IconAction
                                                label="Edit floor info"
                                                onClick={() => onEditFloorPlanInfo(floorPlan)}
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </IconAction>
                                              <IconAction
                                                label="Reshape floor boundary"
                                                onClick={() => onEditFloorPlan(floorPlan)}
                                              >
                                                <Layers3 className="h-4 w-4" />
                                              </IconAction>
                                              <IconAction
                                                label="Delete floor plan"
                                                destructive
                                                onClick={() => onDeleteFloorPlan(floorPlan.id)}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </IconAction>
                                            </>
                                          ) : null}
                                          <button
                                            type="button"
                                            onClick={() => toggleExpandedValue(setExpandedFloorPlans, floorKey)}
                                            aria-label={isFloorExpanded ? 'Collapse floor contents' : 'Expand floor contents'}
                                            aria-expanded={isFloorExpanded}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                                          >
                                            <ChevronDown
                                              className={`h-4 w-4 transition-transform duration-200 ${
                                                isFloorExpanded ? 'rotate-180' : ''
                                              }`}
                                            />
                                          </button>
                                        </div>
                                      </div>

                                      {isFloorExpanded ? (
                                        <div className="mt-3 space-y-3 border-t border-[color:var(--border)] pt-3">
                                          {floorPlan.transformers.length ? (
                                            floorPlan.transformers.map((transformer) => (
                                              <TransformerListCard
                                                key={transformer.id}
                                                transformer={transformer}
                                                isSelected={selectedTransformerId === transformer.id}
                                                isExpanded={!!expandedTransformers[transformer.id]}
                                                onToggleExpanded={() => toggleTransformerExpanded(transformer.id)}
                                                onClick={() => onTransformerClick(transformer)}
                                                onViewDetails={() => onViewDetails(transformer)}
                                                canManageAssets={canManageAssets}
                                                onEdit={() => onEditClick(transformer)}
                                                onDelete={() => onDeleteClick(transformer.id)}
                                              />
                                            ))
                                          ) : (
                                            <p className="rounded-md bg-[var(--card-muted)] px-3 py-3 text-sm text-[var(--muted)]">
                                              No transformer is assigned to this floor yet.
                                            </p>
                                          )}
                                        </div>
                                      ) : null}
                                    </article>
                                  );
                                })}

                                {companyGroup.ungroupedTransformers.length ? (
                                  <section className="space-y-2 rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card)]/65 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-[var(--foreground)]">
                                          Ungrouped assets
                                        </p>
                                        <p className="text-xs text-[var(--muted)]">
                                          Transformers without a saved floor boundary
                                        </p>
                                      </div>
                                      <Badge variant="outline">{companyGroup.ungroupedTransformers.length}</Badge>
                                    </div>

                                    <div className="space-y-2">
                                      {companyGroup.ungroupedTransformers.map((transformer) => (
                                        <TransformerListCard
                                          key={transformer.id}
                                          transformer={transformer}
                                          isSelected={selectedTransformerId === transformer.id}
                                          isExpanded={!!expandedTransformers[transformer.id]}
                                          onToggleExpanded={() => toggleTransformerExpanded(transformer.id)}
                                          onClick={() => onTransformerClick(transformer)}
                                          onViewDetails={() => onViewDetails(transformer)}
                                          canManageAssets={canManageAssets}
                                          onEdit={() => onEditClick(transformer)}
                                          onDelete={() => onDeleteClick(transformer.id)}
                                        />
                                      ))}
                                    </div>
                                  </section>
                                ) : null}
                              </div>
                            ) : null}
                          </section>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
      <AssetsListDialog
        open={isAssetsModalOpen}
        assets={areaSubstationAssets}
        selectedAssetId={selectedTransformerId}
        onClose={closeAssetsModal}
        onSelectAsset={handleAssetSelect}
        canManageAssets={canManageAssets}
        onViewDetails={(asset) => { onViewDetails(asset); closeAssetsModal(); }}
        onEdit={(asset) => { onEditClick(asset); closeAssetsModal(); }}
        onDelete={(assetId) => { onDeleteClick(assetId); closeAssetsModal(); }}
      />
      <AreasListDialog
        open={isAreasModalOpen}
        areas={sortedAreas}
        selectedAreaId={selectedFloorPlanId}
        onClose={closeAreasModal}
        onSelectArea={handleAreaSelect}
      />
      <CompanyParentListDialog
        open={isCompanyParentModalOpen}
        companyParents={companyParentList}
        onClose={closeCompanyParentModal}
        onSelectCompanyParent={handleCompanyParentSelect}
      />
      <StatesListDialog
        open={isStatesModalOpen}
        states={statesList}
        onClose={closeStatesModal}
        onSelectState={handleStateSelect}
      />
    </div>
  );
}

function AssetsListDialog({ open, assets, selectedAssetId, onClose, onSelectAsset, canManageAssets, onViewDetails, onEdit, onDelete }) {
  const [query, setQuery] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null); // { asset, x, y }
  const ctxRef = React.useRef(null);

  // Reset search + context menu when modal opens/closes
  React.useEffect(() => {
    if (open) { setQuery(''); setCtxMenu(null); }
  }, [open]);

  // Close context menu on outside click or Escape
  React.useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setCtxMenu(null); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ctxMenu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      (a.txName || '').toLowerCase().includes(q) ||
      (a.mnemonic || '').toLowerCase().includes(q) ||
      (a.serialNumber || '').toLowerCase().includes(q)
    );
  }, [assets, query]);

  const handleContextMenu = (e, asset) => {
    e.preventDefault();
    // Clamp so popup doesn't go off-screen
    const PW = 260, PH = 320;
    const x = Math.min(e.clientX, window.innerWidth - PW - 8);
    const y = Math.min(e.clientY, window.innerHeight - PH - 8);
    setCtxMenu({ asset, x, y });
  };

  const highlight = (text) => {
    const q = query.trim();
    if (!q || !text) return text || '-';
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded bg-[var(--primary)]/30 px-0.5 text-[var(--primary-strong)]">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
        <DialogContent className="mobile-form-dialog max-w-3xl p-0">
          <DialogHeader>
            <DialogTitle>All Assets</DialogTitle>
            <DialogDescription>
              {assets.length} assets available. Select one to focus it and show it in the sidebar.
            </DialogDescription>
          </DialogHeader>

          {/* Search bar */}
          <div className="border-b border-[color:var(--border)] px-4 pb-3 pt-1 sm:px-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, mnemonic, or serial number…"
                className="h-9 w-full rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {query ? (
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                {filtered.length} of {assets.length} assets match
              </p>
            ) : null}
          </div>

          <div className="mobile-dialog-scroll px-4 py-4 sm:px-5 sm:py-5">
            <p className="mb-2 text-[11px] text-[var(--muted)]">
              Right-click an asset for a quick info preview.
            </p>
            {assets.length === 0 ? (
              <p className="rounded-md bg-[var(--card-muted)] px-3 py-3 text-sm text-[var(--muted)]">
                No assets available yet.
              </p>
            ) : filtered.length === 0 ? (
              <p className="rounded-md bg-[var(--card-muted)] px-3 py-3 text-center text-sm text-[var(--muted)]">
                No assets match <span className="font-semibold text-[var(--foreground)]">"{query}"</span>.
              </p>
            ) : (
              <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {filtered.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  const isCtx = ctxMenu?.asset?.id === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => onSelectAsset(asset)}
                      onContextMenu={(e) => handleContextMenu(e, asset)}
                      className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-[color:var(--primary)] bg-[var(--primary-soft)]'
                          : isCtx
                          ? 'border-[color:var(--primary)]/50 bg-[var(--card-muted)]'
                          : 'border-[color:var(--border)] bg-[var(--card)] hover:bg-[var(--card-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {highlight(asset.txName || 'Unnamed transformer')}
                          </p>
                          <p className="truncate text-xs text-[var(--muted)]">
                            Mnemonic: {highlight(asset.mnemonic || '-')} · Serial: {highlight(asset.serialNumber || '-')}
                          </p>
                        </div>
                        {isSelected ? <Badge variant="secondary">Selected</Badge> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Right-click infotip — portalled to body so it sits above the Dialog overlay */}
      {ctxMenu ? ReactDOM.createPortal(
        <div
          ref={ctxRef}
          className="fixed z-[9999] w-[260px] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >

          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Transformer</p>
              <p className="truncate text-sm font-bold text-[var(--foreground)]">{ctxMenu.asset.txName || 'Unnamed'}</p>
            </div>
            {ctxMenu.asset.voltage ? (
              <span className="mt-0.5 flex-shrink-0 rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary-strong)]">
                {ctxMenu.asset.voltage}
              </span>
            ) : null}
          </div>

          {/* Detail rows */}
          <dl className="divide-y divide-[color:var(--border)] px-3 py-1 text-xs">
            {[
              ['Site',     ctxMenu.asset.siteName],
              ['State',    ctxMenu.asset.state],
              ['Mnemonic', ctxMenu.asset.mnemonic],
              ['Serial',   ctxMenu.asset.serialNumber],
              ['Load',     ctxMenu.asset.loadMVA ? `${ctxMenu.asset.loadMVA} MVA` : null],
              ['Maker',    ctxMenu.asset.maker],
              ['Built',    ctxMenu.asset.yearBuilt],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-2 py-1.5">
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="text-right font-medium text-[var(--foreground)]">{val || '—'}</dd>
              </div>
            ))}
          </dl>

          {/* Stats */}
          <div className="flex gap-3 border-t border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-2 text-[11px] text-[var(--muted)]">
            <span>{ctxMenu.asset.oilTests?.length || 0} oil tests</span>
            <span>{ctxMenu.asset.documents?.length || 0} documents</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5 border-t border-[color:var(--border)] px-3 py-2.5">
            <button
              type="button"
              onClick={() => { setCtxMenu(null); onViewDetails?.(ctxMenu.asset); }}
              className="flex-1 rounded-md bg-[var(--primary)] px-2 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
            >
              Details
            </button>
            {canManageAssets ? (
              <>
                <button
                  type="button"
                  onClick={() => { setCtxMenu(null); onEdit?.(ctxMenu.asset); }}
                  className="flex-1 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--card-muted)]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setCtxMenu(null); onDelete?.(ctxMenu.asset.id); }}
                  className="flex-1 rounded-md bg-red-600/80 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600"
                >
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function AreasListDialog({ open, areas, selectedAreaId, onClose, onSelectArea }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="mobile-form-dialog max-w-3xl p-0">
        <DialogHeader>
          <DialogTitle>All Areas/Substations</DialogTitle>
          <DialogDescription>
            {areas.length} areas/substations available in this app. Select one to focus it on the map.
          </DialogDescription>
        </DialogHeader>

        <div className="mobile-dialog-scroll px-4 py-4 sm:px-5 sm:py-5">
          {areas.length === 0 ? (
            <p className="rounded-md bg-[var(--card-muted)] px-3 py-3 text-sm text-[var(--muted)]">
              No areas saved yet.
            </p>
          ) : (
            <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
              {areas.map((area) => {
                const isSelected = selectedAreaId === area.id;
                const assignedAssetCount = Array.isArray(area.transformerIds) ? area.transformerIds.length : 0;

                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => onSelectArea(area)}
                    className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-[color:var(--primary)] bg-[var(--primary-soft)]'
                        : 'border-[color:var(--border)] bg-[var(--card)] hover:bg-[var(--card-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                          {area.name || 'Unnamed area'}
                        </p>
                        <p className="truncate text-sm text-[var(--muted)]">
                          {area.companyName || 'Unknown company'}
                          {area.state ? ` - ${area.state}` : ''}
                        </p>
                      </div>
                      <Badge variant={isSelected ? 'secondary' : 'outline'}>
                        {assignedAssetCount} assets
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompanyParentListDialog({ open, companyParents, onClose, onSelectCompanyParent }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="mobile-form-dialog max-w-2xl p-0">
        <DialogHeader>
          <DialogTitle>All Company/Parent</DialogTitle>
          <DialogDescription>
            {companyParents.length} company/parent names available in this app. Select one to filter the sidebar list.
          </DialogDescription>
        </DialogHeader>

        <div className="mobile-dialog-scroll px-4 py-4 sm:px-5 sm:py-5">
          {companyParents.length === 0 ? (
            <p className="rounded-md bg-[var(--card-muted)] px-3 py-3 text-sm text-[var(--muted)]">
              No company/parent names available yet.
            </p>
          ) : (
            <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
              {companyParents.map((companyParent) => (
                <button
                  key={companyParent.name}
                  type="button"
                  onClick={() => onSelectCompanyParent(companyParent.name)}
                  className="w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-3 text-left transition-colors hover:bg-[var(--card-muted)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{companyParent.name}</p>
                    <Badge variant="outline">
                      {companyParent.areaCount} areas · {companyParent.assetCount} assets
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatesListDialog({ open, states, onClose, onSelectState }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="mobile-form-dialog max-w-2xl p-0">
        <DialogHeader>
          <DialogTitle>All States</DialogTitle>
          <DialogDescription>
            {states.length} states available in this app. Select one to filter the sidebar list.
          </DialogDescription>
        </DialogHeader>

        <div className="mobile-dialog-scroll px-4 py-4 sm:px-5 sm:py-5">
          {states.length === 0 ? (
            <p className="rounded-md bg-[var(--card-muted)] px-3 py-3 text-sm text-[var(--muted)]">
              No states available yet.
            </p>
          ) : (
            <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
              {states.map((state) => (
                <button
                  key={state.name}
                  type="button"
                  onClick={() => onSelectState(state.name)}
                  className="w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-3 text-left transition-colors hover:bg-[var(--card-muted)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{state.name}</p>
                    <Badge variant="outline">
                      {state.areaCount} areas · {state.assetCount} assets
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransformerListCard({
  transformer,
  isSelected,
  isExpanded,
  onToggleExpanded,
  onClick,
  onViewDetails,
  canManageAssets = true,
  onEdit,
  onDelete,
}) {
  const transformerState = getTransformerState(transformer);

  return (
    <article
      className={`group rounded-md border p-3 transition-all duration-200 hover:-translate-y-0.5 ${
        isSelected
          ? 'border-[color:var(--primary)] bg-[var(--primary-soft)] ring-1 ring-[color:var(--ring)]'
          : 'border-[color:var(--border)] bg-[var(--card)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onClick}>
          <div className="flex items-center gap-2">
            <div
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
                isSelected
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
              }`}
            >
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[var(--foreground)]">
                {transformer.txName || 'Unnamed transformer'}
              </h2>
              <p className="truncate text-sm text-[var(--muted)]">
                {transformer.siteName || 'Unknown site'}
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={isExpanded ? 'Collapse transformer details' : 'Expand transformer details'}
          aria-expanded={isExpanded}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
            isSelected
              ? 'border-[color:var(--primary)] text-[var(--primary-strong)] hover:bg-[var(--card)]'
              : 'border-[color:var(--border)] text-[var(--muted)] hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isExpanded ? (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Badge variant="outline">{transformer.voltage || 'Voltage N/A'}</Badge>
            <Badge variant="secondary">{transformerState}</Badge>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <InfoPair label="Mnemonic" value={transformer.mnemonic || '-'} />
            <InfoPair label="Serial" value={transformer.serialNumber || '-'} />
            <InfoPair label="Load" value={transformer.loadMVA ? `${transformer.loadMVA} MVA` : '-'} />
            <InfoPair label="Year" value={transformer.yearBuilt || '-'} />
          </dl>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
            <div className="flex items-center gap-1">
              <IconAction label="View details" onClick={onViewDetails}>
                <MapPin className="h-4 w-4" />
              </IconAction>
              {canManageAssets ? (
                <>
                  <IconAction label="Edit transformer" onClick={onEdit}>
                    <Pencil className="h-4 w-4" />
                  </IconAction>
                  <IconAction label="Delete transformer" destructive onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                  </IconAction>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}

function InfoPair({ label, value }) {
  return (
    <div className="space-y-1 rounded-md bg-[var(--card-muted)] px-3 py-2">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{label}</dt>
      <dd className="truncate text-sm font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function IconAction({ label, onClick, destructive = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
        destructive
          ? 'border-[color:var(--danger-soft)] text-[var(--danger-strong)] hover:bg-[var(--danger-soft)]'
          : 'border-[color:var(--border)] text-[var(--muted)] hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]'
      }`}
    >
      {children}
    </button>
  );
}

export default TransformerSidebar;
