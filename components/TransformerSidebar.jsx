import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  FileText,
  MapPin,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  SunMedium,
  TestTubeDiagonal,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { compareMalaysianStates, getTransformerState } from '../lib/malaysiaStates';

function TransformerSidebar({
  transformers,
  onAddClick,
  onTransformerClick,
  onEditClick,
  onDeleteClick,
  onViewDetails,
  isAddMode,
  loading,
  selectedTransformerId,
  theme,
  onToggleTheme,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTransformers, setExpandedTransformers] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  const filteredTransformers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) {
      return transformers;
    }

    return transformers.filter((transformer) =>
      [transformer.txName, transformer.siteName, transformer.mnemonic, transformer.serialNumber, getTransformerState(transformer)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [searchTerm, transformers]);

  const groupedTransformers = useMemo(() => {
    const groups = new Map();

    filteredTransformers.forEach((transformer) => {
      const state = getTransformerState(transformer);

      if (!groups.has(state)) {
        groups.set(state, []);
      }

      groups.get(state).push(transformer);
    });

    return Array.from(groups.entries())
      .sort(([leftState], [rightState]) => compareMalaysianStates(leftState, rightState))
      .map(([state, items]) => ({
        state,
        items,
      }));
  }, [filteredTransformers]);

  const quickStats = useMemo(() => {
    const oilSamples = transformers.reduce((sum, transformer) => sum + (transformer.oilTests?.length || 0), 0);
    const documents = transformers.reduce((sum, transformer) => sum + (transformer.documents?.length || 0), 0);
    const sites = new Set(transformers.map((transformer) => transformer.siteName).filter(Boolean)).size;
    return [
      { label: 'Assets', value: transformers.length, icon: Zap },
      { label: 'Samples', value: oilSamples, icon: TestTubeDiagonal },
      { label: 'Docs', value: documents, icon: FileText },
      { label: 'Sites', value: sites, icon: MapPin },
    ];
  }, [transformers]);

  const toggleTransformerExpanded = (transformerId) => {
    setExpandedTransformers((current) => ({
      ...current,
      [transformerId]: !current[transformerId],
    }));
  };

  const toggleGroupExpanded = (state) => {
    setExpandedGroups((current) => ({
      ...current,
      [state]: current[state] === false,
    }));
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center justify-between bg-[var(--sidebar)] px-3 py-4">
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
          {loading ? <Badge variant="secondary" className="justify-center px-2 py-1 text-[10px]">Sync</Badge> : null}
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
    <div className="flex h-full min-h-0 flex-col bg-[var(--sidebar)]">
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
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{stat.label}</p>
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

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Find an asset
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, site, mnemonic, or serial"
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
            <p className="text-sm font-medium">Assets</p>
            <p className="text-sm text-[var(--muted)]">
              {filteredTransformers.length} of {transformers.length} visible in {groupedTransformers.length} state groups
            </p>
          </div>
          {loading ? <Badge variant="secondary">Syncing</Badge> : null}
        </div>

        {filteredTransformers.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-5 text-center">
              <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-md bg-[var(--card-muted)] text-[var(--muted)]">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {searchTerm ? 'No transformers matched that search.' : 'No transformers added yet.'}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {searchTerm ? 'Try a different keyword or clear the filter.' : 'Use the add button to place the first asset on the map.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {groupedTransformers.map((group) => {
              const isGroupExpanded = expandedGroups[group.state] !== false;

              return (
                <section key={group.state} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleGroupExpanded(group.state)}
                    aria-expanded={isGroupExpanded}
                    className="flex w-full items-center justify-between rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-2 text-left transition-colors hover:bg-[var(--card-strong)]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{group.state}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{group.items.length} assets</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{group.items.length}</Badge>
                      <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${isGroupExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isGroupExpanded ? (
                    <div className="space-y-3">
                      {group.items.map((transformer) => {
                        const isExpanded = !!expandedTransformers[transformer.id];
                        const isSelected = selectedTransformerId === transformer.id;
                        const transformerState = getTransformerState(transformer);

                        return (
                          <article
                            key={transformer.id}
                            className={`group rounded-md border p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 ${
                              isSelected
                                ? 'border-[color:var(--primary)] bg-[var(--primary-soft)] ring-1 ring-[color:var(--ring)]'
                                : 'border-[color:var(--border)] bg-[var(--card)]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => onTransformerClick(transformer)}
                              >
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
                                    <h2 className={`truncate text-sm font-semibold ${isSelected ? 'text-[var(--foreground)]' : ''}`}>
                                      {transformer.txName || 'Unnamed transformer'}
                                    </h2>
                                    <p className={`truncate text-sm ${isSelected ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
                                      {transformer.siteName || 'Unknown site'}
                                    </p>
                                  </div>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleTransformerExpanded(transformer.id)}
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
                                <div className="mt-4 flex items-center justify-between gap-3">
                                  <Badge variant="outline">{transformer.voltage || 'Voltage N/A'}</Badge>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">
                                      <TestTubeDiagonal className="h-3.5 w-3.5" />
                                      {transformer.oilTests?.length || 0}
                                    </Badge>
                                    <Badge variant="secondary">
                                      <FileText className="h-3.5 w-3.5" />
                                      {transformer.documents?.length || 0}
                                    </Badge>
                                  </div>
                                </div>

                                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                  <InfoPair label="State" value={transformerState} />
                                  <InfoPair label="Mnemonic" value={transformer.mnemonic || '-'} />
                                  <InfoPair label="Serial" value={transformer.serialNumber || '-'} />
                                  <InfoPair label="Load" value={transformer.loadMVA ? `${transformer.loadMVA} MVA` : '-'} />
                                  <InfoPair label="Year" value={transformer.yearBuilt || '-'} />
                                </dl>

                                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
                                  <div className="flex items-center gap-1">
                                    <IconAction label="View details" onClick={() => onViewDetails(transformer)}>
                                      <MapPin className="h-4 w-4" />
                                    </IconAction>
                                    <IconAction label="Edit transformer" onClick={() => onEditClick(transformer)}>
                                      <Pencil className="h-4 w-4" />
                                    </IconAction>
                                    <IconAction label="Delete transformer" onClick={() => onDeleteClick(transformer.id)} destructive>
                                      <Trash2 className="h-4 w-4" />
                                    </IconAction>
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </article>
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
