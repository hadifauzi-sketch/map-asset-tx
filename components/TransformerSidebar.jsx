import React, { useMemo, useState } from 'react';
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
  SunMedium,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { compareMalaysianStates, getTransformerState } from '../lib/malaysiaStates';

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

function TransformerSidebar({
  transformers,
  floorPlans = [],
  onAddClick,
  onDrawFloorClick,
  onTransformerClick,
  onEditClick,
  onDeleteClick,
  onViewDetails,
  onFloorPlanClick,
  onEditFloorPlanInfo,
  onEditFloorPlan,
  onDeleteFloorPlan,
  isAddMode,
  isFloorDrawingMode,
  loading,
  selectedTransformerId,
  selectedFloorPlanId,
  theme,
  onToggleTheme,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStates, setExpandedStates] = useState({});
  const [expandedCompanies, setExpandedCompanies] = useState({});
  const [expandedFloorPlans, setExpandedFloorPlans] = useState({});
  const [expandedTransformers, setExpandedTransformers] = useState({});

  const hierarchy = useMemo(() => buildHierarchy(transformers, floorPlans), [floorPlans, transformers]);
  const filteredHierarchy = useMemo(() => filterHierarchy(hierarchy, searchTerm), [hierarchy, searchTerm]);

  const quickStats = useMemo(() => {
    const companyCount = new Set(
      [...transformers.map((transformer) => transformer.siteName), ...floorPlans.map((floorPlan) => floorPlan.companyName)]
        .filter(Boolean)
        .map((value) => String(value).trim())
    ).size;
    const statesCount = new Set(
      [...transformers.map((transformer) => getTransformerState(transformer)), ...floorPlans.map((floorPlan) => floorPlan.state)]
        .filter(Boolean)
        .map((value) => String(value).trim())
    ).size;

    return [
      { label: 'Assets', value: transformers.length, icon: Zap },
      { label: 'Floors', value: floorPlans.length, icon: Layers3 },
      { label: 'Companies', value: companyCount, icon: Building2 },
      { label: 'States', value: statesCount, icon: MapPin },
    ];
  }, [floorPlans, transformers]);

  const visibleAssetCount = countVisibleAssets(filteredHierarchy);
  const visibleFloorCount = countVisibleFloors(filteredHierarchy);

  const toggleExpandedValue = (setter, key) => {
    setter((current) => ({
      ...current,
      [key]: current[key] === false,
    }));
  };

  const toggleTransformerExpanded = (transformerId) => {
    setExpandedTransformers((current) => ({
      ...current,
      [transformerId]: !current[transformerId],
    }));
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
              onClick={onDrawFloorClick}
              aria-label={isFloorDrawingMode ? 'Floor drawing armed' : 'Draw floor overlay'}
              title={isFloorDrawingMode ? 'Floor drawing armed' : 'Draw floor overlay'}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                <Pencil className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
                {isFloorDrawingMode ? 'Draw' : 'Floor'}
              </span>
            </button>

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
          </div>

          <div className="flex w-full flex-col gap-2">
            {quickStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex w-full flex-col items-center gap-1 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2 py-2 text-center transition-colors hover:bg-[var(--card-muted)]"
                  aria-label={`${stat.label}: ${stat.value}`}
                  title={`${stat.label}: ${stat.value}`}
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">{stat.value}</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    {stat.label}
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
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--sidebar)]/88 backdrop-blur-xl">
      <header className="shrink-0 border-b border-[color:var(--border)] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge variant="secondary" className="uppercase tracking-[0.14em]">
              Asset map
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold">Transformer control room</h1>
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
            return (
              <Card key={stat.label} className="bg-[var(--card-elevated)]">
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
              </Card>
            );
          })}
        </div>
      </header>

      <section className="shrink-0 border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex flex-col gap-3">
          <Button
            className="w-full justify-center"
            variant={isAddMode ? 'secondary' : 'default'}
            onClick={onAddClick}
          >
            <Plus className="h-4 w-4" />
            {isAddMode ? 'Map placement armed' : 'Add transformer'}
          </Button>

          <Button
            className="w-full justify-center"
            variant={isFloorDrawingMode ? 'secondary' : 'outline'}
            onClick={onDrawFloorClick}
          >
            <Pencil className="h-4 w-4" />
            {isFloorDrawingMode ? 'Floor pen armed' : 'Draw floor overlay'}
          </Button>

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
                className="pl-9"
              />
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
              const isStateExpanded = expandedStates[stateKey] !== false;

              return (
                <section key={stateGroup.state} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleExpandedValue(setExpandedStates, stateKey)}
                    aria-expanded={isStateExpanded}
                    className="flex w-full items-center justify-between rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-2 text-left transition-colors hover:bg-[var(--card-strong)]"
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
                        const isCompanyExpanded = expandedCompanies[companyKey] !== false;
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
                              className="flex w-full items-center justify-between rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-left transition-colors hover:bg-[var(--card-elevated)]"
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
                                  const isFloorExpanded = expandedFloorPlans[floorKey] !== false;
                                  const isFloorSelected = selectedFloorPlanId === floorPlan.id;

                                  return (
                                    <article
                                      key={floorPlan.id}
                                      className={`rounded-md border p-3 shadow-[var(--shadow-card)] ${
                                        isFloorSelected
                                          ? 'border-[color:var(--primary)] bg-[var(--primary-soft)] ring-1 ring-[color:var(--ring)]'
                                          : 'border-[color:var(--border)] bg-[var(--card)]'
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
    </div>
  );
}

function TransformerListCard({
  transformer,
  isSelected,
  isExpanded,
  onToggleExpanded,
  onClick,
  onViewDetails,
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
              <IconAction label="Edit transformer" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </IconAction>
              <IconAction label="Delete transformer" destructive onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </IconAction>
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
