import React, { lazy, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GitCompareArrows,
  Hexagon,
  HelpCircle,
  Layers3,
  MapPin,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  SunMedium,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { AppTooltip } from './ui/app-tooltip';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import MountWhenOpened from './MountWhenOpened';
import SidebarAssetContextMenu from './SidebarAssetContextMenu';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  StatusCounts,
  StatusMeter,
  getAssetStatus,
  summarizeStatuses,
} from './assetTree';
import { getAssetOwnerLabel } from '../lib/assetOwner';
import { compareMalaysianStates, getTransformerState } from '../lib/malaysiaStates';
import {
  buildHierarchy,
  filterHierarchy,
  matchesFloorPlan,
  matchesTransformer,
  normalizeText,
  sortTransformers,
} from '../lib/assetHierarchy';

// Opened on demand from the sidebar; split out of the main bundle.
const AssetCardGalleryModal = lazy(() => import('./AssetCardGalleryModal'));
const CompareTX = lazy(() => import('./compareTX'));

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

function dedupeAndSortTransformers(transformers) {
  const registry = new Map();
  transformers.forEach((transformer) => {
    if (!transformer?.id) {
      return;
    }
    registry.set(String(transformer.id), transformer);
  });

  return sortTransformers(Array.from(registry.values()));
}

function getCompanyGroupAssets(companyGroup) {
  const floorAssets = companyGroup.floorPlans.flatMap((floorPlan) => floorPlan.transformers || []);
  return dedupeAndSortTransformers([...floorAssets, ...(companyGroup.ungroupedTransformers || [])]);
}

function countAssignedTransformerIds(floorPlan) {
  return new Set((floorPlan?.transformerIds || []).filter(Boolean).map(String)).size;
}

function countCompanyAssignedAssets(companyGroup) {
  const assignedIds = new Set();
  companyGroup.floorPlans.forEach((floorPlan) => {
    (floorPlan.transformerIds || []).forEach((transformerId) => {
      if (transformerId) {
        assignedIds.add(String(transformerId));
      }
    });
  });
  (companyGroup.ungroupedTransformers || []).forEach((transformer) => {
    if (transformer?.id) {
      assignedIds.add(String(transformer.id));
    }
  });
  return assignedIds.size;
}

function formatAssetVisibilityLabel(visibleCount, assignedCount, noun = 'asset') {
  if (assignedCount > visibleCount) {
    return `${visibleCount}/${assignedCount} ${noun}s visible`;
  }
  return pluralize(visibleCount, noun);
}

function getFloorPlanAssets(floorPlan, transformers) {
  const transformerIds = new Set((floorPlan?.transformerIds || []).map(String));
  if (!transformerIds.size) {
    return [];
  }

  return sortTransformers(transformers.filter((transformer) => transformerIds.has(String(transformer.id))));
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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
  companyBoundaries = [],
  // Map<transformerId, 'critical' | 'warning' | 'normal'> — same status as the map pins.
  statusById = null,
  currentUser = null,
  canManageAssets = true,
  onAddClick,
  onLocationRegisterClick,
  onTransformerClick,
  onEditClick,
  onDeleteClick,
  onViewDetails,
  onFloorPlanClick,
  onCompanyBoundaryClick,
  onEditCompanyBoundaryInfo,
  onEditCompanyBoundary,
  onDeleteCompanyBoundary,
  onEditFloorPlanInfo,
  onEditFloorPlan,
  onDeleteFloorPlan,
  isAddMode,
  isLocationRegisterOpen = false,
  loading,
  selectedTransformerId,
  selectedCompanyBoundaryId,
  selectedFloorPlanId,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenAssetManagement,
  onOpenSOP,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
  searchFocusRequest = 0,
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
  const [assetGroupContextMenu, setAssetGroupContextMenu] = useState(null);
  const [assetCardGroup, setAssetCardGroup] = useState(null);
  const [isAssetCardGalleryOpen, setIsAssetCardGalleryOpen] = useState(false);
  const assetCardCloseTimerRef = useRef(null);
  const [compareAssetIds, setCompareAssetIds] = useState([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isMobileTopHidden, setIsMobileTopHidden] = useState(false);
  const searchInputRef = useRef(null);
  const lastSidebarScrollTopRef = useRef(0);

  const hierarchy = useMemo(
    () => buildHierarchy(transformers, floorPlans, companyBoundaries),
    [companyBoundaries, floorPlans, transformers]
  );
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

    companyBoundaries.forEach((boundary) => {
      ensureEntry(boundary.companyName);
    });

    transformers.forEach((transformer) => {
      const entry = ensureEntry(transformer.siteName);
      if (entry) {
        entry.assetCount += 1;
      }
    });

    return Array.from(registry.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [companyBoundaries, floorPlans, transformers]);
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

  const selectedCompareAssets = useMemo(
    () => transformers.filter((transformer) => compareAssetIds.includes(String(transformer.id))),
    [compareAssetIds, transformers]
  );

  const visibleAssetCount = countVisibleAssets(filteredHierarchy);
  const visibleFloorCount = countVisibleFloors(filteredHierarchy);
  const compareReady = selectedCompareAssets.length >= 2;

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

  useEffect(() => {
    if (!searchFocusRequest || typeof window === 'undefined') {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [searchFocusRequest]);

  useEffect(() => {
    const availableIds = new Set(transformers.map((transformer) => String(transformer.id)));
    setCompareAssetIds((current) => {
      const next = current.filter((id) => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [transformers]);

  const toggleExpandedValue = (setter, key) => {
    setter((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  // Expand / collapse every visible state, company and area in one go.
  const setHierarchyExpanded = (open) => {
    const states = {};
    const companies = {};
    const floors = {};
    filteredHierarchy.forEach((stateGroup) => {
      states[`state:${stateGroup.state}`] = open;
      stateGroup.companies.forEach((companyGroup) => {
        companies[`company:${stateGroup.state}:${companyGroup.companyName}`] = open;
        companyGroup.floorPlans.forEach((floorPlan) => {
          floors[`floor:${floorPlan.id}`] = open;
        });
      });
    });
    setExpandedStates((current) => ({ ...current, ...states }));
    setExpandedCompanies((current) => ({ ...current, ...companies }));
    setExpandedFloorPlans((current) => ({ ...current, ...floors }));
  };

  const toggleTransformerExpanded = (transformerId) => {
    setExpandedTransformers((current) => ({
      ...current,
      [transformerId]: !current[transformerId],
    }));
  };
  const toggleCompareAsset = (transformer) => {
    const assetId = String(transformer?.id ?? '');
    if (!assetId) {
      return;
    }

    setCompareAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    );
  };
  const clearCompareAssets = () => {
    setCompareAssetIds([]);
    setIsCompareModalOpen(false);
  };

  const openAssetsModal = () => setIsAssetsModalOpen(true);
  const closeAssetsModal = () => setIsAssetsModalOpen(false);
  const focusAssetInHierarchy = (transformer) => {
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

    onTransformerClick?.(transformer);
  };
  const handleAssetSelect = (transformer) => {
    focusAssetInHierarchy(transformer);
    closeAssetsModal();
  };
  const openAssetGroupContextMenu = (event, group) => {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 280;
    const menuHeight = 174;
    const x = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8));
    const y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8));

    setAssetGroupContextMenu({
      ...group,
      assets: dedupeAndSortTransformers(group.assets || []),
      x,
      y,
    });
  };
  const openAssetCardsFromMenu = (group) => {
    if (assetCardCloseTimerRef.current != null) {
      window.clearTimeout(assetCardCloseTimerRef.current);
      assetCardCloseTimerRef.current = null;
    }
    setAssetCardGroup({
      ...group,
      assets: dedupeAndSortTransformers(group.assets || []),
    });
    setIsAssetCardGalleryOpen(true);
    setAssetGroupContextMenu(null);
  };
  const closeAssetCards = () => {
    setIsAssetCardGalleryOpen(false);
    assetCardCloseTimerRef.current = window.setTimeout(() => {
      setAssetCardGroup(null);
      assetCardCloseTimerRef.current = null;
    }, 550);
  };
  const handleAssetCardFocus = (asset) => {
    focusAssetInHierarchy(asset);
    closeAssetCards();
  };
  const handleAssetCardDetails = (asset) => {
    closeAssetCards();
    onViewDetails?.(asset);
  };
  const handleAssetCardEdit = (asset) => {
    closeAssetCards();
    onEditClick?.(asset);
  };
  const handleAssetCardDelete = (assetId) => {
    closeAssetCards();
    onDeleteClick?.(assetId);
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

  const assetCardGalleryOverlay = (
    <>
      <SidebarAssetContextMenu
        menu={assetGroupContextMenu}
        onClose={() => setAssetGroupContextMenu(null)}
        onShowCards={openAssetCardsFromMenu}
      />
      <MountWhenOpened open={isAssetCardGalleryOpen}>
        <AssetCardGalleryModal
          open={isAssetCardGalleryOpen}
        group={assetCardGroup}
        selectedAssetId={selectedTransformerId}
        canManageAssets={canManageAssets}
        onClose={closeAssetCards}
        onFocusAsset={handleAssetCardFocus}
        onViewDetails={handleAssetCardDetails}
        onEditAsset={handleAssetCardEdit}
        onDeleteAsset={handleAssetCardDelete}
        />
      </MountWhenOpened>
      <MountWhenOpened open={isCompareModalOpen}>
        <CompareTX
          open={isCompareModalOpen}
        assets={selectedCompareAssets}
        groupTitle="Sidebar compare"
        groupSubtitle="Latest oil test and DGA assessment from the selected transformer assets."
        onClose={() => setIsCompareModalOpen(false)}
        />
      </MountWhenOpened>
    </>
  );

  useEffect(() => {
    setIsMobileTopHidden(false);
    lastSidebarScrollTopRef.current = 0;
  }, [searchTerm, filteredHierarchy.length]);

  const handleHierarchyScroll = (event) => {
    const scrollElement = event.currentTarget;
    const nextScrollTop = Math.max(0, scrollElement.scrollTop);
    const previousScrollTop = lastSidebarScrollTopRef.current;
    const scrollDelta = nextScrollTop - previousScrollTop;
    const hasScrollableContent = scrollElement.scrollHeight > scrollElement.clientHeight + 24;

    if (!hasScrollableContent || nextScrollTop <= 12) {
      setIsMobileTopHidden(false);
      lastSidebarScrollTopRef.current = nextScrollTop;
      return;
    }

    if (Math.abs(scrollDelta) >= 8) {
      setIsMobileTopHidden(scrollDelta > 0);
      lastSidebarScrollTopRef.current = nextScrollTop;
    }
  };

  if (collapsed) {
    return (
      <div className="h-full">
        {/* Mobile (< lg): show expand + close only */}
        <div className="flex h-full flex-col items-center justify-between bg-[color:var(--sidebar)]/62 px-4 py-4 backdrop-blur-xl lg:hidden">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            title="Close sidebar"
            className="h-11 w-11"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop (lg+): icon-only collapsed sidebar */}
        <div className="hidden h-full flex-col items-center justify-between bg-[color:var(--sidebar)]/62 px-3 py-4 backdrop-blur-xl lg:flex">
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
                  <AppTooltip content={isAddMode ? 'Map placement armed' : 'Add transformer'}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-center gap-1 rounded-md px-2 py-2 text-center text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                      onClick={onAddClick}
                      aria-label={isAddMode ? 'Map placement armed' : 'Add transformer'}
                    >
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                        <Plus className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
                        {isAddMode ? 'Place' : 'Add'}
                      </span>
                    </button>
                  </AppTooltip>
                  <AppTooltip content={isLocationRegisterOpen ? 'Location register open' : 'Open location register'}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-center gap-1 rounded-md px-2 py-2 text-center text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                      onClick={onLocationRegisterClick}
                      aria-label={isLocationRegisterOpen ? 'Location register open' : 'Open location register'}
                    >
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
                        {isLocationRegisterOpen ? 'GPS On' : 'GPS'}
                      </span>
                    </button>
                  </AppTooltip>
                </>
              ) : (
                <Badge variant="outline" className="justify-center px-2 py-1 text-[10px]">
                  Viewer
                </Badge>
              )}

              {onOpenAssetManagement ? (
                <AppTooltip content="Asset Management">
                  <button
                    type="button"
                    className="flex w-full flex-col items-center gap-1 rounded-md px-2 py-2 text-center text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                    onClick={onOpenAssetManagement}
                    aria-label="Open Asset Management"
                  >
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em]">Asset</span>
                  </button>
                </AppTooltip>
              ) : null}

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
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                onClick={onOpenSOP}
                aria-label="Standard Operating Procedure"
                title="Standard Operating Procedure Flowchart"
              >
                <HelpCircle className="h-4 w-4" />
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
                    <AppTooltip key={stat.key} content={title}>
                      <button
                        type="button"
                        className={`${sharedClassName} cursor-pointer`}
                        onClick={onClick}
                        aria-label={ariaLabel}
                      >
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold text-[var(--foreground)]">{stat.value}</span>
                        <span className="max-w-full whitespace-normal break-words text-[8px] font-medium uppercase leading-tight tracking-[0.08em] text-[var(--muted)]">
                          {getCollapsedStatLabel(stat.key, stat.label)}
                        </span>
                      </button>
                    </AppTooltip>
                  );
                }

                return (
                  <AppTooltip key={stat.key} content={`${stat.label}: ${stat.value}`}>
                    <div
                      className={sharedClassName}
                      aria-label={`${stat.label}: ${stat.value}`}
                    >
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-[var(--foreground)]">{stat.value}</span>
                      <span className="max-w-full whitespace-normal break-words text-[8px] font-medium uppercase leading-tight tracking-[0.08em] text-[var(--muted)]">
                        {getCollapsedStatLabel(stat.key, stat.label)}
                      </span>
                    </div>
                  </AppTooltip>
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
          {assetCardGalleryOverlay}
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-shell flex h-full min-h-0 flex-col bg-[color:var(--sidebar)]/62 backdrop-blur-xl">
      <div className={`sidebar-mobile-chrome${isMobileTopHidden ? ' is-hidden' : ''}`}>
        <header className="border-b border-[color:var(--border)] px-4 pb-3 pt-3 lg:pt-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--primary-soft)] text-[var(--primary-strong)] ring-1 ring-inset ring-[color:var(--border)]">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">TX Asset Management</h1>
              <p
                className="truncate text-[11px] leading-tight text-[var(--muted)]"
                title={currentUser?.username || currentUser?.full_name || 'Asset map'}
              >
                {currentUser?.full_name || currentUser?.username || 'Asset map'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <div className="sidebar-glass-fill flex items-center rounded-[9px] border border-[color:var(--border)] bg-[var(--card)] p-0.5">
                <button
                  type="button"
                  className="hidden h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)] lg:grid"
                  onClick={onToggleCollapsed}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  data-tour="settings-btn"
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                  onClick={onOpenSettings}
                  aria-label="Open settings"
                  title={currentUser ? `Open settings for ${currentUser.username}` : 'Open settings'}
                >
                  <SettingsIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  data-tour="sop-btn"
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                  onClick={onOpenSOP}
                  aria-label="Standard Operating Procedure"
                  title="Standard Operating Procedure Flowchart"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  data-tour="theme-btn"
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                  onClick={onToggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <SunMedium className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 lg:hidden"
                onClick={onCloseMobile}
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            data-tour="quick-stats"
            className="sidebar-glass-fill mt-3 grid grid-cols-4 divide-x divide-[color:var(--border)] overflow-hidden rounded-[10px] border border-[color:var(--border)] bg-[var(--card-elevated)]"
          >
            {quickStats.map((stat) => {
              const Icon = stat.icon;
              const statAction = {
                assets: { onClick: openAssetsModal, title: 'Open assets list', short: 'Assets' },
                areas: { onClick: openAreasModal, title: 'Open areas/substation list', short: 'Areas' },
                companies: { onClick: openCompanyParentModal, title: 'Open company/parent list', short: 'Companies' },
                states: { onClick: openStatesModal, title: 'Open states list', short: 'States' },
              }[stat.key];

              return (
                <AppTooltip key={stat.key} content={`${stat.label} — ${statAction?.title || stat.label}`}>
                  <button
                    type="button"
                    className="group flex min-w-0 flex-col gap-1 px-2.5 py-2 text-left transition-colors hover:bg-[var(--card-muted)]"
                    onClick={statAction?.onClick}
                    aria-label={`${stat.label}: ${stat.value}. ${statAction?.title || ''}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 shrink-0 text-[var(--primary-strong)]" />
                      <span className="text-[16px] font-semibold leading-none tabular-nums text-[var(--foreground)]">
                        {stat.value}
                      </span>
                    </span>
                    <span className="truncate text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--muted)] group-hover:text-[var(--foreground)]">
                      {statAction?.short || stat.label}
                    </span>
                  </button>
                </AppTooltip>
              );
            })}
          </div>
        </header>

        <section className="border-b border-[color:var(--border)] px-4 py-3 lg:border-b-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              {canManageAssets ? (
                <>
                  <AppTooltip content="Add transformer manually into the map">
                    <Button
                      data-tour="add-transformer"
                      size="sm"
                      className="min-w-0 flex-1 justify-center"
                      variant={isAddMode ? 'secondary' : 'default'}
                      onClick={onAddClick}
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className="truncate">{isAddMode ? 'Placing…' : 'Transformer'}</span>
                    </Button>
                  </AppTooltip>
                  <AppTooltip content="Add transformer at site by phone or handheld">
                    <Button
                      data-tour="gps-register"
                      size="sm"
                      className={`shrink-0 justify-center${isLocationRegisterOpen ? '' : ' sidebar-glass-fill'}`}
                      variant={isLocationRegisterOpen ? 'secondary' : 'outline'}
                      onClick={onLocationRegisterClick}
                    >
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{isLocationRegisterOpen ? 'GPS active' : 'GPS'}</span>
                    </Button>
                  </AppTooltip>
                </>
              ) : (
                <Badge variant="outline" className="h-9 flex-1 justify-center px-3 text-[11px] font-medium uppercase tracking-[0.12em]">
                  Viewer mode
                </Badge>
              )}

              {onOpenAssetManagement ? (
                <AppTooltip content="Asset Management — assign per-user asset access">
                  <Button
                    data-tour="asset-management"
                    variant="outline"
                    size="sm"
                    className="sidebar-glass-fill shrink-0 justify-center"
                    onClick={onOpenAssetManagement}
                    aria-label="Asset Management"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Asset</span>
                  </Button>
                </AppTooltip>
              ) : null}
            </div>

            <label data-tour="search" className="relative block">
              <span className="sr-only">Find an asset or floor</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search floor, company or TX"
                title="Search by floor, company or transformer"
                className="sidebar-glass-fill h-9! pl-9 pr-9"
              />
              {searchTerm ? (
                <AppTooltip content="Clear search">
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </AppTooltip>
              ) : null}
            </label>

            {selectedCompareAssets.length ? (
              <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] p-2.5 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="gap-1.5">
                    <GitCompareArrows className="h-3.5 w-3.5" />
                    {selectedCompareAssets.length} selected
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={compareReady ? 'default' : 'outline'}
                      disabled={!compareReady}
                      onClick={() => setIsCompareModalOpen(true)}
                    >
                      <GitCompareArrows className="h-3.5 w-3.5" />
                      Compare
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={clearCompareAssets}>
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div
        data-tour="floor-hierarchy"
        className="sidebar-scroll min-h-0 flex-1 overflow-y-scroll overscroll-contain px-4 py-3"
        onScroll={handleHierarchyScroll}
        onWheelCapture={(event) => {
          event.stopPropagation();
          if (typeof event.nativeEvent.stopImmediatePropagation === 'function') {
            event.nativeEvent.stopImmediatePropagation();
          }
        }}
      >
        <div className="atree-head">
          <div className="atree-head-text">
            <p className="atree-title">Asset hierarchy</p>
            <p className="atree-subtitle">
              {visibleAssetCount} assets · {visibleFloorCount} areas · {filteredHierarchy.length} states
            </p>
          </div>
          {loading ? <Badge variant="secondary">Syncing</Badge> : null}
          {filteredHierarchy.length ? (
            <div className="atree-fold">
              <AppTooltip content="Expand all">
                <button type="button" onClick={() => setHierarchyExpanded(true)} aria-label="Expand all groups">
                  <ChevronsUpDown aria-hidden="true" />
                </button>
              </AppTooltip>
              <AppTooltip content="Collapse all">
                <button type="button" onClick={() => setHierarchyExpanded(false)} aria-label="Collapse all groups">
                  <ChevronsDownUp aria-hidden="true" />
                </button>
              </AppTooltip>
            </div>
          ) : null}
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
          <div className="atree" role="tree" aria-label="Asset hierarchy">
            {filteredHierarchy.map((stateGroup) => {
              const stateKey = `state:${stateGroup.state}`;
              const isStateExpanded = Boolean(expandedStates[stateKey]);
              const sourceStateGroup = hierarchy.find((group) => group.state === stateGroup.state);
              const stateAssets = (sourceStateGroup?.companies || stateGroup.companies).flatMap((group) =>
                getCompanyGroupAssets(group)
              );
              const stateSummary = summarizeStatuses(stateAssets, statusById);

              return (
                <section key={stateGroup.state} className="atree-state">
                  <button
                    type="button"
                    onClick={() => toggleExpandedValue(setExpandedStates, stateKey)}
                    aria-expanded={isStateExpanded}
                    className={`atree-row is-state ${isStateExpanded ? 'is-open' : ''}`}
                  >
                    <ChevronRight className="atree-chevron" aria-hidden="true" />
                    <MapPin className="atree-icon" aria-hidden="true" />
                    <span className="atree-label">
                      <span className="atree-name" title={stateGroup.state}>{stateGroup.state}</span>
                      <span className="atree-hint">{pluralize(stateGroup.companies.length, 'company', 'companies')}</span>
                    </span>
                    <StatusCounts summary={stateSummary} />
                    <StatusMeter summary={stateSummary} />
                  </button>

                  {isStateExpanded ? (
                    <div className="atree-children" role="group">
                      {stateGroup.companies.map((companyGroup) => {
                        const companyKey = `company:${stateGroup.state}:${companyGroup.companyName}`;
                        const isCompanyExpanded = Boolean(expandedCompanies[companyKey]);
                        const sourceCompanyGroup =
                          sourceStateGroup?.companies.find(
                            (group) => group.companyName === companyGroup.companyName
                          ) || companyGroup;
                        const companyAssets = getCompanyGroupAssets(sourceCompanyGroup);
                        const companyAssetCount = companyAssets.length;
                        const companyAssignedAssetCount = countCompanyAssignedAssets(sourceCompanyGroup);
                        const companyAssetLabel = formatAssetVisibilityLabel(
                          companyAssetCount,
                          companyAssignedAssetCount
                        );
                        const companyBadgeLabel =
                          companyAssignedAssetCount > companyAssetCount
                            ? `${companyAssetCount}/${companyAssignedAssetCount}`
                            : companyAssetCount;
                        const companyBoundary = sourceCompanyGroup.companyBoundary || companyGroup.companyBoundary;
                        const isCompanyBoundarySelected = selectedCompanyBoundaryId === companyBoundary?.id;
                        const companySummary = summarizeStatuses(companyAssets, statusById);
                        const areaCount = sourceCompanyGroup.floorPlans.length;

                        return (
                          <div key={companyKey} className="atree-company">
                            <button
                              type="button"
                              onClick={() => toggleExpandedValue(setExpandedCompanies, companyKey)}
                              onContextMenu={(event) => {
                                openAssetGroupContextMenu(event, {
                                  typeLabel: 'Company/Parent',
                                  title: companyGroup.companyName,
                                  subtitle: `${stateGroup.state} - ${pluralize(sourceCompanyGroup.floorPlans.length, 'floor')} - ${companyAssetLabel}`,
                                  assets: companyAssets,
                                });
                              }}
                              aria-expanded={isCompanyExpanded}
                              className={`atree-row is-company ${isCompanyExpanded ? 'is-open' : ''} ${
                                isCompanyBoundarySelected ? 'is-selected' : ''
                              }`}
                            >
                              <ChevronRight className="atree-chevron" aria-hidden="true" />
                              <Building2 className="atree-icon" aria-hidden="true" />
                              <span className="atree-label">
                                <span className="atree-name" title={companyGroup.companyName}>
                                  {companyGroup.companyName}
                                </span>
                                {areaCount ? <span className="atree-hint">{pluralize(areaCount, 'area')}</span> : null}
                                {companyBoundary ? (
                                  <span className={`atree-tag ${isCompanyBoundarySelected ? 'is-active' : ''}`}>Main</span>
                                ) : null}
                              </span>
                              <StatusCounts summary={companySummary} totalLabel={companyBadgeLabel} />
                            </button>

                            {isCompanyExpanded ? (
                              <div className="atree-children" role="group">
                                {companyBoundary ? (
                                  <div className={`atree-line ${isCompanyBoundarySelected ? 'is-selected' : ''}`}>
                                    <button
                                      type="button"
                                      className="atree-row is-area"
                                      onClick={() => onCompanyBoundaryClick?.(companyBoundary)}
                                      title="Show the main company boundary on the map"
                                    >
                                      <span aria-hidden="true" />
                                      <Hexagon className="atree-icon" aria-hidden="true" />
                                      <span className="atree-label">
                                        <span className="atree-name">Main company boundary</span>
                                        <span className="atree-hint">{companyBoundary.points.length} pts</span>
                                      </span>
                                    </button>
                                    {canManageAssets ? (
                                      <span className="atree-actions">
                                        <TreeAction label="Edit company boundary info" onClick={() => onEditCompanyBoundaryInfo?.(companyBoundary)}>
                                          <Pencil aria-hidden="true" />
                                        </TreeAction>
                                        <TreeAction label="Reshape company boundary" onClick={() => onEditCompanyBoundary?.(companyBoundary)}>
                                          <Layers3 aria-hidden="true" />
                                        </TreeAction>
                                        <TreeAction label="Delete company boundary" destructive onClick={() => onDeleteCompanyBoundary?.(companyBoundary.id)}>
                                          <Trash2 aria-hidden="true" />
                                        </TreeAction>
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}

                                {companyGroup.floorPlans.map((floorPlan) => {
                                  const floorKey = `floor:${floorPlan.id}`;
                                  const isFloorExpanded = Boolean(expandedFloorPlans[floorKey]);
                                  const isFloorSelected = selectedFloorPlanId === floorPlan.id;
                                  const sourceFloorPlan =
                                    floorPlans.find((plan) => plan.id === floorPlan.id) || floorPlan;
                                  const floorAssets = getFloorPlanAssets(sourceFloorPlan, transformers);
                                  const floorAssignedAssetCount = countAssignedTransformerIds(sourceFloorPlan);
                                  const floorHasHiddenAssets = floorAssignedAssetCount > floorAssets.length;
                                  const floorSummary = summarizeStatuses(floorAssets, statusById);

                                  return (
                                    <div
                                      key={floorPlan.id}
                                      className="atree-area"
                                      onContextMenu={(event) =>
                                        openAssetGroupContextMenu(event, {
                                          typeLabel: 'Area/Substation',
                                          title: floorPlan.name || 'Unnamed floor',
                                          subtitle: `${floorPlan.companyName || companyGroup.companyName || 'Unknown company'} - ${floorPlan.state || stateGroup.state || 'State N/A'} - ${formatAssetVisibilityLabel(floorAssets.length, floorAssignedAssetCount)}`,
                                          assets: floorAssets,
                                        })
                                      }
                                    >
                                      <div className={`atree-line ${isFloorSelected ? 'is-selected' : ''}`}>
                                        <button
                                          type="button"
                                          onClick={() => toggleExpandedValue(setExpandedFloorPlans, floorKey)}
                                          aria-label={isFloorExpanded ? 'Collapse area' : 'Expand area'}
                                          aria-expanded={isFloorExpanded}
                                          className={`atree-toggle ${isFloorExpanded ? 'is-open' : ''}`}
                                        >
                                          <ChevronRight className="atree-chevron" aria-hidden="true" />
                                        </button>
                                        <button
                                          type="button"
                                          className="atree-row is-area"
                                          onClick={() => onFloorPlanClick(floorPlan)}
                                          title="Show this area on the map"
                                        >
                                          <Layers3 className="atree-icon" aria-hidden="true" />
                                          <span className="atree-label">
                                            <span className="atree-name" title={floorPlan.name || 'Unnamed floor'}>
                                              {floorPlan.name || 'Unnamed floor'}
                                            </span>
                                          </span>
                                          <StatusCounts
                                            summary={floorSummary}
                                            totalLabel={
                                              floorHasHiddenAssets
                                                ? `${floorPlan.transformers.length}/${floorAssignedAssetCount}`
                                                : floorPlan.transformers.length
                                            }
                                          />
                                        </button>
                                        {canManageAssets ? (
                                          <span className="atree-actions">
                                            <TreeAction label="Edit floor info" onClick={() => onEditFloorPlanInfo(floorPlan)}>
                                              <Pencil aria-hidden="true" />
                                            </TreeAction>
                                            <TreeAction label="Reshape floor boundary" onClick={() => onEditFloorPlan(floorPlan)}>
                                              <Layers3 aria-hidden="true" />
                                            </TreeAction>
                                            <TreeAction label="Delete floor plan" destructive onClick={() => onDeleteFloorPlan(floorPlan.id)}>
                                              <Trash2 aria-hidden="true" />
                                            </TreeAction>
                                          </span>
                                        ) : null}
                                      </div>

                                      {isFloorExpanded ? (
                                        <div className="atree-children" role="group">
                                          {floorPlan.transformers.length ? (
                                            floorPlan.transformers.map((transformer) => (
                                              <TransformerListCard
                                                key={transformer.id}
                                                transformer={transformer}
                                                status={getAssetStatus(statusById, transformer)}
                                                isSelected={selectedTransformerId === transformer.id}
                                                isExpanded={!!expandedTransformers[transformer.id]}
                                                onToggleExpanded={() => toggleTransformerExpanded(transformer.id)}
                                                onClick={() => onTransformerClick(transformer)}
                                                onViewDetails={() => onViewDetails(transformer)}
                                                canManageAssets={canManageAssets}
                                                compareSelected={compareAssetIds.includes(String(transformer.id))}
                                                onToggleCompare={() => toggleCompareAsset(transformer)}
                                                onEdit={() => onEditClick(transformer)}
                                                onDelete={() => onDeleteClick(transformer.id)}
                                              />
                                            ))
                                          ) : (
                                            <p className="atree-empty-note">
                                              {floorHasHiddenAssets
                                                ? `${floorAssignedAssetCount} transformers are assigned in Supabase, but none are visible for this account.`
                                                : 'No transformer is assigned to this floor yet.'}
                                            </p>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}

                                {companyGroup.ungroupedTransformers.length ? (
                                  <>
                                    {companyGroup.floorPlans.length ? (
                                      <p className="atree-subhead">
                                        Not in an area · {companyGroup.ungroupedTransformers.length}
                                      </p>
                                    ) : null}
                                    {companyGroup.ungroupedTransformers.map((transformer) => (
                                      <TransformerListCard
                                        key={transformer.id}
                                        transformer={transformer}
                                        status={getAssetStatus(statusById, transformer)}
                                        isSelected={selectedTransformerId === transformer.id}
                                        isExpanded={!!expandedTransformers[transformer.id]}
                                        onToggleExpanded={() => toggleTransformerExpanded(transformer.id)}
                                        onClick={() => onTransformerClick(transformer)}
                                        onViewDetails={() => onViewDetails(transformer)}
                                        canManageAssets={canManageAssets}
                                        compareSelected={compareAssetIds.includes(String(transformer.id))}
                                        onToggleCompare={() => toggleCompareAsset(transformer)}
                                        onEdit={() => onEditClick(transformer)}
                                        onDelete={() => onDeleteClick(transformer.id)}
                                      />
                                    ))}
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
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
      {assetCardGalleryOverlay}
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
              ['Owner',    getAssetOwnerLabel(ctxMenu.asset.ownerType)],
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
  status = 'normal',
  isSelected,
  isExpanded,
  onToggleExpanded,
  onClick,
  onViewDetails,
  canManageAssets = true,
  compareSelected = false,
  onToggleCompare,
  onEdit,
  onDelete,
}) {
  const assetOwnerLabel = getAssetOwnerLabel(transformer.ownerType);
  const ratingLine = [transformer.voltage, transformer.loadMVA ? `${transformer.loadMVA} MVA` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      role="treeitem"
      aria-selected={isSelected}
      className={`atree-tx ${isSelected ? 'is-selected' : ''} ${compareSelected ? 'is-compare compare-breathing-card' : ''} ${
        isExpanded ? 'is-expanded' : ''
      }`}
    >
      <div className="atree-tx-line">
        <button type="button" className="atree-tx-main" onClick={onClick}>
          <span
            className={`atree-tx-status is-${status}`}
            style={{ '--status-color': STATUS_COLORS[status] || STATUS_COLORS.normal }}
            title={STATUS_LABELS[status] || STATUS_LABELS.normal}
          />
          <span className="atree-tx-text">
            <span className="atree-tx-title">
              {transformer.txName || 'Unnamed transformer'}
              {transformer.mnemonic ? <span className="atree-tag">{transformer.mnemonic}</span> : null}
              {compareSelected ? <span className="atree-tag is-active compare-breathing-badge">Compare</span> : null}
            </span>
            <span className="atree-tx-sub">{ratingLine || transformer.siteName || 'No rating details'}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={isExpanded ? 'Collapse transformer details' : 'Expand transformer details'}
          aria-expanded={isExpanded}
          className="atree-tx-expand"
        >
          <ChevronDown aria-hidden="true" />
        </button>
      </div>

      {isExpanded ? (
        <div className="atree-tx-details">
          <dl className="atree-tx-facts">
            <div>
              <dt>Serial</dt>
              <dd title={transformer.serialNumber || '-'}>{transformer.serialNumber || '-'}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd title={assetOwnerLabel}>{assetOwnerLabel}</dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd>{transformer.yearBuilt || '-'}</dd>
            </div>
            <div>
              <dt>Site</dt>
              <dd title={transformer.siteName || '-'}>{transformer.siteName || '-'}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{getTransformerState(transformer)}</dd>
            </div>
            <div>
              <dt>Mnemonic</dt>
              <dd>{transformer.mnemonic || '-'}</dd>
            </div>
          </dl>
          <span className="atree-actions">
            <TreeAction label="View details" onClick={onViewDetails}>
              <MapPin aria-hidden="true" />
            </TreeAction>
            {canManageAssets ? (
              <TreeAction label="Edit transformer" onClick={onEdit}>
                <Pencil aria-hidden="true" />
              </TreeAction>
            ) : null}
            <TreeAction
              label={compareSelected ? 'Remove transformer from compare' : 'Add transformer to compare'}
              active={compareSelected}
              onClick={onToggleCompare}
            >
              <GitCompareArrows aria-hidden="true" />
            </TreeAction>
            {canManageAssets ? (
              <TreeAction label="Delete transformer" destructive onClick={onDelete}>
                <Trash2 aria-hidden="true" />
              </TreeAction>
            ) : null}
          </span>
        </div>
      ) : null}
    </article>
  );
}

/** Small borderless icon button used inside the compact hierarchy rows. */
function TreeAction({ label, onClick, destructive = false, active = false, children }) {
  return (
    <AppTooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={`atree-action ${destructive ? 'is-danger' : ''} ${active ? 'is-active' : ''}`}
      >
        {children}
      </button>
    </AppTooltip>
  );
}

export default TransformerSidebar;
