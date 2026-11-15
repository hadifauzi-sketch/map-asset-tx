import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  LayoutList,
  ListTree,
  MapPin,
  MapPinOff,
  Search,
  SquareDashed,
  X,
} from 'lucide-react';
import { STATUS_META, STATUS_ORDER, formatDate, hasValidPosition } from '../../lib/globe3d/assetSummary';
import { buildHierarchy, filterHierarchy } from '../../lib/assetHierarchy';
import { cn } from '../../lib/utils';

const EXPANDED_STORAGE_KEY = 'g3d-txlist-expanded-v1';
const VIEW_STORAGE_KEY = 'g3d-txlist-view-v1';

const SORT_OPTIONS = [
  { id: 'severity', label: 'Severity' },
  { id: 'name', label: 'Name' },
  { id: 'sample', label: 'Latest sample' },
];

const stateKey = (state) => `s:${state}`;
const companyKey = (state, company) => `c:${state}::${company}`;
const areaKey = (state, company, areaId) => `a:${state}::${company}::${areaId}`;

function readStored(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — the view still works, it just won't persist */
  }
}

function latestTestDate(transformer) {
  const dates = (transformer.oilTests || []).map((test) => test.testDate).filter(Boolean).sort();
  return dates[dates.length - 1] || null;
}

function emptySummary() {
  return { total: 0, critical: 0, warning: 0, normal: 0 };
}

function addToSummary(summary, status) {
  summary.total += 1;
  summary[status] += 1;
  return summary;
}

/** Thin stacked bar: share of critical / warning / normal in a group. */
function StatusMeter({ summary }) {
  if (!summary.total) {
    return null;
  }
  return (
    <span className="g3d-tree-meter" aria-hidden="true">
      {STATUS_ORDER.map((status) =>
        summary[status] ? (
          <span
            key={status}
            style={{ flexGrow: summary[status], background: STATUS_META[status].color }}
          />
        ) : null
      )}
    </span>
  );
}

/** Compact "● 3  ● 1" counts; normal is implied by the total. */
function StatusCounts({ summary }) {
  return (
    <span className="g3d-tree-counts">
      {summary.critical ? (
        <span className="g3d-tree-count" title={`${summary.critical} critical`}>
          <span className="g3d-dot" style={{ background: STATUS_META.critical.color }} aria-hidden="true" />
          {summary.critical}
        </span>
      ) : null}
      {summary.warning ? (
        <span className="g3d-tree-count" title={`${summary.warning} warning`}>
          <span className="g3d-dot" style={{ background: STATUS_META.warning.color }} aria-hidden="true" />
          {summary.warning}
        </span>
      ) : null}
      <span className="g3d-tree-total" title={`${summary.total} transformers`}>
        {summary.total}
      </span>
    </span>
  );
}

function AssetRow({ transformer, status, sampleDate, isSelected, showLocation, onSelect }) {
  const located = hasValidPosition(transformer);
  const details = [
    showLocation ? transformer.siteName : null,
    transformer.voltage,
    transformer.loadMVA ? `${transformer.loadMVA} MVA` : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={isSelected}
      data-asset-id={String(transformer.id)}
      className={cn('g3d-txrow-row', isSelected && 'is-selected')}
      onClick={() => onSelect(transformer.id)}
    >
      <span
        className={cn('g3d-txrow-status', `is-${status}`)}
        style={{ '--status-color': STATUS_META[status].color }}
        title={STATUS_META[status].label}
      />
      <span className="g3d-txrow-main">
        <span className="g3d-txrow-title">
          {transformer.txName || 'Unnamed transformer'}
          {transformer.mnemonic ? <span className="g3d-txrow-tag">{transformer.mnemonic}</span> : null}
        </span>
        <span className="g3d-txrow-sub">{details.join(' · ') || 'No rating details'}</span>
      </span>
      <span className="g3d-txrow-meta">
        <span className={cn(!sampleDate && 'is-missing')}>{sampleDate ? formatDate(sampleDate) : 'No sample'}</span>
        {located ? null : (
          <span className="g3d-txrow-nogps" title="No GPS position — not shown on the globe">
            <MapPinOff aria-hidden="true" />
            No GPS
          </span>
        )}
      </span>
    </button>
  );
}

function GroupHeader({ level, icon: Icon, label, summary, expanded, onToggle, hint }) {
  return (
    <button
      type="button"
      className={cn('g3d-tree-header', `is-level-${level}`, expanded && 'is-expanded')}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <ChevronRight className="g3d-tree-chevron" aria-hidden="true" />
      {Icon ? <Icon className="g3d-tree-icon" aria-hidden="true" /> : null}
      <span className="g3d-tree-label">
        <span className="g3d-tree-name" title={label}>
          {label}
        </span>
        {hint ? <span className="g3d-tree-hint">{hint}</span> : null}
      </span>
      <StatusCounts summary={summary} />
      <StatusMeter summary={summary} />
    </button>
  );
}

/**
 * Left panel: the fleet as State → Company → Area → Transformer, the same
 * hierarchy as the 2D sidebar, with status roll-ups on every group.
 */
export default function TxListPanel({
  transformers,
  statusById,
  selectedId,
  onSelect,
  floorPlans = [],
  companyBoundaries = [],
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState(() => readStored(VIEW_STORAGE_KEY, { mode: 'tree', sort: 'severity' }));
  const [expanded, setExpanded] = useState(() => readStored(EXPANDED_STORAGE_KEY, {}));
  // While searching or filtering, groups open by default and toggles live here,
  // so the saved layout comes back untouched once the filter is cleared.
  const [filterExpanded, setFilterExpanded] = useState({});
  const listRef = useRef(null);

  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = Boolean(normalizedQuery) || statusFilter !== 'all';

  useEffect(() => writeStored(VIEW_STORAGE_KEY, view), [view]);
  useEffect(() => writeStored(EXPANDED_STORAGE_KEY, expanded), [expanded]);
  useEffect(() => setFilterExpanded({}), [normalizedQuery, statusFilter]);

  const statusOf = useCallback((transformer) => statusById.get(transformer.id) || 'normal', [statusById]);

  const sampleDateById = useMemo(() => {
    const map = new Map();
    transformers.forEach((transformer) => map.set(transformer.id, latestTestDate(transformer)));
    return map;
  }, [transformers]);

  const counts = useMemo(() => {
    const result = { all: transformers.length, critical: 0, warning: 0, normal: 0 };
    transformers.forEach((transformer) => {
      result[statusOf(transformer)] += 1;
    });
    return result;
  }, [transformers, statusOf]);

  const compareAssets = useCallback(
    (left, right) => {
      if (view.sort === 'sample') {
        const difference = String(sampleDateById.get(right.id) || '').localeCompare(String(sampleDateById.get(left.id) || ''));
        if (difference !== 0) return difference;
      } else if (view.sort === 'severity') {
        const difference = STATUS_ORDER.indexOf(statusOf(left)) - STATUS_ORDER.indexOf(statusOf(right));
        if (difference !== 0) return difference;
      }
      return String(left.txName || '').localeCompare(String(right.txName || ''), undefined, { numeric: true });
    },
    [view.sort, sampleDateById, statusOf]
  );

  const statusFiltered = useMemo(
    () => (statusFilter === 'all' ? transformers : transformers.filter((transformer) => statusOf(transformer) === statusFilter)),
    [transformers, statusFilter, statusOf]
  );

  // Tree: shared hierarchy, then drop empty groups (boundaries / floor plans
  // without any visible asset) and attach status roll-ups for every level.
  const tree = useMemo(() => {
    const groups = filterHierarchy(buildHierarchy(statusFiltered, floorPlans, companyBoundaries), normalizedQuery);
    const severityRank = (summary) => [summary.critical, summary.warning];

    return groups
      .map((stateGroup) => {
        const stateSummary = emptySummary();
        const companies = stateGroup.companies
          .map((companyGroup) => {
            const companySummary = emptySummary();
            const areas = companyGroup.floorPlans
              .filter((floorPlan) => floorPlan.transformers.length > 0)
              .map((floorPlan) => {
                const areaSummary = emptySummary();
                floorPlan.transformers.forEach((transformer) => {
                  const status = statusOf(transformer);
                  addToSummary(areaSummary, status);
                  addToSummary(companySummary, status);
                  addToSummary(stateSummary, status);
                });
                return {
                  id: floorPlan.id,
                  name: floorPlan.name || 'Unnamed area',
                  summary: areaSummary,
                  transformers: [...floorPlan.transformers].sort(compareAssets),
                };
              });
            companyGroup.ungroupedTransformers.forEach((transformer) => {
              const status = statusOf(transformer);
              addToSummary(companySummary, status);
              addToSummary(stateSummary, status);
            });
            return {
              name: companyGroup.companyName,
              hasBoundary: Boolean(companyGroup.companyBoundary),
              summary: companySummary,
              areas,
              transformers: [...companyGroup.ungroupedTransformers].sort(compareAssets),
            };
          })
          .filter((company) => company.summary.total > 0)
          .sort((left, right) => {
            if (view.sort === 'severity') {
              const [leftCritical, leftWarning] = severityRank(left.summary);
              const [rightCritical, rightWarning] = severityRank(right.summary);
              if (rightCritical !== leftCritical) return rightCritical - leftCritical;
              if (rightWarning !== leftWarning) return rightWarning - leftWarning;
            }
            return left.name.localeCompare(right.name);
          });
        return { state: stateGroup.state, summary: stateSummary, companies };
      })
      .filter((stateGroup) => stateGroup.summary.total > 0);
  }, [statusFiltered, floorPlans, companyBoundaries, normalizedQuery, statusOf, compareAssets, view.sort]);

  // Flat: one sorted table of everything that passes the filters.
  const flatList = useMemo(() => {
    if (view.mode !== 'flat') return [];
    return tree
      .flatMap((stateGroup) =>
        stateGroup.companies.flatMap((company) => [
          ...company.areas.flatMap((area) => area.transformers),
          ...company.transformers,
        ])
      )
      .sort(compareAssets);
  }, [view.mode, tree, compareAssets]);

  const visibleCount = useMemo(
    () => tree.reduce((sum, stateGroup) => sum + stateGroup.summary.total, 0),
    [tree]
  );

  // Where each asset lives in the full (unfiltered) tree, to reveal a selection.
  const pathById = useMemo(() => {
    const paths = new Map();
    buildHierarchy(transformers, floorPlans, companyBoundaries).forEach((stateGroup) => {
      stateGroup.companies.forEach((companyGroup) => {
        const base = [stateKey(stateGroup.state), companyKey(stateGroup.state, companyGroup.companyName)];
        companyGroup.floorPlans.forEach((floorPlan) => {
          floorPlan.transformers.forEach((transformer) => {
            paths.set(String(transformer.id), [...base, areaKey(stateGroup.state, companyGroup.companyName, floorPlan.id)]);
          });
        });
        companyGroup.ungroupedTransformers.forEach((transformer) => paths.set(String(transformer.id), base));
      });
    });
    return paths;
  }, [transformers, floorPlans, companyBoundaries]);

  const isOpen = useCallback(
    (key) => {
      if (isFiltering) {
        return filterExpanded[key] ?? true;
      }
      // Default layout: states open, companies and areas folded.
      return expanded[key] ?? key.startsWith('s:');
    },
    [isFiltering, filterExpanded, expanded]
  );

  const toggle = useCallback(
    (key) => {
      const setter = isFiltering ? setFilterExpanded : setExpanded;
      setter((current) => ({ ...current, [key]: !isOpen(key) }));
    },
    [isFiltering, isOpen]
  );

  const setAll = useCallback(
    (open) => {
      const next = {};
      tree.forEach((stateGroup) => {
        next[stateKey(stateGroup.state)] = open;
        stateGroup.companies.forEach((company) => {
          next[companyKey(stateGroup.state, company.name)] = open;
          company.areas.forEach((area) => {
            next[areaKey(stateGroup.state, company.name, area.id)] = open;
          });
        });
      });
      (isFiltering ? setFilterExpanded : setExpanded)((current) => ({ ...current, ...next }));
    },
    [tree, isFiltering]
  );

  // A pin clicked on the globe opens its groups and scrolls its row into view.
  useEffect(() => {
    if (selectedId == null) return undefined;
    const path = pathById.get(String(selectedId));
    if (path && view.mode === 'tree') {
      const open = Object.fromEntries(path.map((key) => [key, true]));
      setExpanded((current) => (path.every((key) => current[key] === true) ? current : { ...current, ...open }));
      setFilterExpanded((current) => (path.every((key) => current[key] !== false) ? current : { ...current, ...open }));
    }
    const frame = window.requestAnimationFrame(() => {
      const row = listRef.current?.querySelector(`[data-asset-id="${CSS.escape(String(selectedId))}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, pathById, view.mode]);

  const renderRow = (transformer, showLocation = false) => (
    <AssetRow
      key={transformer.id}
      transformer={transformer}
      status={statusOf(transformer)}
      sampleDate={sampleDateById.get(transformer.id)}
      isSelected={String(selectedId) === String(transformer.id)}
      showLocation={showLocation}
      onSelect={onSelect}
    />
  );

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  return (
    <div className="g3d-panel-body g3d-txlist">
      <div className="g3d-txlist-controls">
        <div className="g3d-search">
          <Search className="g3d-search-icon" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tx, company, area, serial…"
            aria-label="Search transformers"
          />
          {query ? (
            <button type="button" className="g3d-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="g3d-status-tabs" role="group" aria-label="Filter by DGA status">
          {['all', ...STATUS_ORDER].map((status) => (
            <button
              key={status}
              type="button"
              className={cn('g3d-status-tab', statusFilter === status && 'is-active')}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              style={status !== 'all' ? { '--status-color': STATUS_META[status].color } : undefined}
            >
              <span className="g3d-status-tab-count">{counts[status]}</span>
              <span className="g3d-status-tab-label">
                {status !== 'all' ? <span className="g3d-dot" aria-hidden="true" /> : null}
                {status === 'all' ? 'All' : STATUS_META[status].label}
              </span>
            </button>
          ))}
        </div>

        <div className="g3d-txlist-toolbar">
          <label className="g3d-txlist-sort">
            <span>Sort</span>
            <select
              value={view.sort}
              onChange={(event) => setView((current) => ({ ...current, sort: event.target.value }))}
              aria-label="Sort transformers"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="g3d-segmented" role="group" aria-label="List layout">
            <button
              type="button"
              className={cn(view.mode === 'tree' && 'is-active')}
              aria-pressed={view.mode === 'tree'}
              onClick={() => setView((current) => ({ ...current, mode: 'tree' }))}
              title="Group by state, company and area"
            >
              <ListTree aria-hidden="true" />
              Grouped
            </button>
            <button
              type="button"
              className={cn(view.mode === 'flat' && 'is-active')}
              aria-pressed={view.mode === 'flat'}
              onClick={() => setView((current) => ({ ...current, mode: 'flat' }))}
              title="One sorted list"
            >
              <LayoutList aria-hidden="true" />
              List
            </button>
          </div>

          {view.mode === 'tree' ? (
            <div className="g3d-txlist-fold">
              <button type="button" onClick={() => setAll(true)} title="Expand all groups" aria-label="Expand all groups">
                <ChevronsUpDown aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setAll(false)} title="Collapse all groups" aria-label="Collapse all groups">
                <ChevronsDownUp aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="g3d-txlist-summary" aria-live="polite">
        <span>
          Showing <strong>{visibleCount}</strong> of {transformers.length}
          {view.mode === 'tree' && tree.length ? ` · ${tree.length} ${tree.length === 1 ? 'state' : 'states'}` : ''}
        </span>
        {isFiltering ? (
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="g3d-tree" role="tree" aria-label="Transformers" ref={listRef}>
        {visibleCount === 0 ? (
          <div className="g3d-txlist-empty">
            <SquareDashed aria-hidden="true" />
            <p>{transformers.length === 0 ? 'No transformers loaded yet.' : 'No transformer matches these filters.'}</p>
            {isFiltering ? (
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {view.mode === 'flat'
          ? flatList.map((transformer) => renderRow(transformer, true))
          : tree.map((stateGroup) => {
              const sKey = stateKey(stateGroup.state);
              const stateOpen = isOpen(sKey);
              return (
                <section key={sKey} className="g3d-tree-group is-state">
                  <GroupHeader
                    level={0}
                    icon={MapPin}
                    label={stateGroup.state}
                    hint={`${stateGroup.companies.length} ${stateGroup.companies.length === 1 ? 'company' : 'companies'}`}
                    summary={stateGroup.summary}
                    expanded={stateOpen}
                    onToggle={() => toggle(sKey)}
                  />
                  {stateOpen ? (
                    <div className="g3d-tree-children" role="group">
                      {stateGroup.companies.map((company) => {
                        const cKey = companyKey(stateGroup.state, company.name);
                        const companyOpen = isOpen(cKey);
                        return (
                          <div key={cKey} className="g3d-tree-group is-company">
                            <GroupHeader
                              level={1}
                              icon={Building2}
                              label={company.name}
                              hint={company.areas.length ? `${company.areas.length} ${company.areas.length === 1 ? 'area' : 'areas'}` : null}
                              summary={company.summary}
                              expanded={companyOpen}
                              onToggle={() => toggle(cKey)}
                            />
                            {companyOpen ? (
                              <div className="g3d-tree-children" role="group">
                                {company.areas.map((area) => {
                                  const aKey = areaKey(stateGroup.state, company.name, area.id);
                                  const areaOpen = isOpen(aKey);
                                  return (
                                    <div key={aKey} className="g3d-tree-group is-area">
                                      <GroupHeader
                                        level={2}
                                        icon={SquareDashed}
                                        label={area.name}
                                        summary={area.summary}
                                        expanded={areaOpen}
                                        onToggle={() => toggle(aKey)}
                                      />
                                      {areaOpen ? (
                                        <div className="g3d-tree-children" role="group">
                                          {area.transformers.map((transformer) => renderRow(transformer))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                                {company.transformers.map((transformer) => renderRow(transformer))}
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
    </div>
  );
}
