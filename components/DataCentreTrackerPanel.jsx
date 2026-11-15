import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Globe2, ListFilter, LocateFixed, MapPin, RotateCcw, Search, Server, SlidersHorizontal, X } from 'lucide-react';
import { Combobox } from './ui/combobox';
import { Switch } from './ui/switch';
import { cn } from '../lib/utils';
import { DC_STATUS, dataCentreBreakdown, dataCentreColor, dataCentreCountryOptions, dataCentreSource, dataCentresCsv, filterDataCentres, formatDataCentreMw, summarizeDataCentres } from '../lib/dataCentres';
import { malaysiaBuildStatus } from '../lib/malaysiaDataCentres';
import './dataCentres.css';

const TABS = [{ id: 'overview', label: 'Overview', icon: Globe2 }, { id: 'directory', label: 'Directory', icon: ListFilter }, { id: 'appearance', label: 'Appearance', icon: SlidersHorizontal }];
const PAGE_SIZE = 40;
const count = (value) => value.toLocaleString();
const mwText = (value) => `${Math.round(value).toLocaleString()} MW`;
// Column headings for the category × build-status table.
const STATUS_SHORT = { Operating: 'Oper.', 'Under construction': 'Constr.', Planned: 'Pipeline', Canceled: 'Canc.', Undisclosed: 'Undiscl.' };
const STATUS_COLOR = Object.fromEntries(DC_STATUS.map((entry) => [entry.id, entry.color]));
const STATUS_RANK = Object.fromEntries(DC_STATUS.map((entry, index) => [entry.id, index]));
const SORT_OPTIONS = [{ value: 'mw', label: 'Largest MW' }, { value: 'name', label: 'Name A–Z' }, { value: 'status', label: 'Build status' }];

/** MW per build status across a campus's phases, for the row's mix bar. */
function phaseMix(facility) {
  const totals = new Map();
  (facility.phases || []).forEach((phase) => {
    const status = malaysiaBuildStatus(phase.status);
    totals.set(status, (totals.get(status) || 0) + (Number(phase.mw_net) || 0));
  });
  return DC_STATUS.filter((entry) => totals.get(entry.id) > 0).map((entry) => ({ ...entry, mw: totals.get(entry.id) }));
}

export default function DataCentreTrackerPanel({ tracker, onClose, onFlyTo, onFit, className }) {
  const { data, settings, setSettings, status, retry, facilities } = tracker;
  const [tab, setTab] = useState('overview');
  const [page, setPage] = useState(1);
  const scrollRef = useRef(null);
  const id = useId();
  const summary = useMemo(() => summarizeDataCentres(facilities), [facilities]);
  const [unit, setUnit] = useState('mw');
  // Status bar + table ignore the status filter (so every status stays visible and
  // the selected one is highlighted); state chips ignore the state filter likewise.
  const overview = useMemo(() => dataCentreBreakdown(filterDataCentres(data?.rows || [], { ...settings, status: '' })),
    [data, settings.country, settings.operator, settings.state, settings.location, settings.query]);
  const stateChips = useMemo(() => dataCentreBreakdown(filterDataCentres(data?.rows || [], { ...settings, state: '' })).states,
    [data, settings.country, settings.operator, settings.status, settings.location, settings.query]);
  const source = dataCentreSource(settings.source || 'seafic');
  const isMalaysiaTracker = source.id === 'seafic';
  const countries = useMemo(() => dataCentreCountryOptions(data?.rows || []), [data]);
  const patch = (next) => setSettings((current) => ({ ...current, ...next }));
  const reset = () => patch({ operator: '', status: '', state: '', location: 'all', query: '' });
  const hasFilters = Boolean(settings.operator || settings.status || settings.state || settings.query || settings.location !== 'all');
  const filterLabel = [settings.state, settings.status, settings.operator,
    settings.location !== 'all' ? (settings.location === 'mapped' ? 'With coordinates' : 'Without coordinates') : '',
    settings.query ? `“${settings.query}”` : ''].filter(Boolean).join(' · ');
  // Malaysia tracker reads in MW; the global directory has too little MW data, so it counts facilities.
  const metric = (bucket) => (isMalaysiaTracker ? bucket.mw : bucket.campuses);
  const metricTotal = metric(overview.total);
  const tableStatuses = DC_STATUS.filter((entry) => entry.id !== 'Undisclosed' || overview.statusTotals.Undisclosed.campuses > 0);
  const cell = (bucket) => {
    const value = unit === 'mw' ? Math.round(bucket.mw) : bucket.campuses;
    return value ? count(value) : '–';
  };
  const toggleStatus = (statusId) => patch({ status: settings.status === statusId ? '' : statusId });
  const coverage = summary.total ? Math.round(summary.mapped / summary.total * 100) : 0;
  // Location switch counts ignore the location filter so all three stay meaningful.
  const locationCounts = useMemo(() => {
    const rows = filterDataCentres(data?.rows || [], { ...settings, location: 'all' });
    const mapped = rows.filter((row) => row.mapped).length;
    return { all: rows.length, mapped, unmapped: rows.length - mapped };
  }, [data, settings.country, settings.operator, settings.status, settings.state, settings.query]);
  const [sort, setSort] = useState('mw');
  const sorted = useMemo(() => {
    const list = [...facilities];
    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
    const byMw = (a, b) => (b.capacityMw ?? -1) - (a.capacityMw ?? -1);
    if (sort === 'name') list.sort(byName);
    else if (sort === 'status') list.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || byMw(a, b) || byName(a, b));
    else list.sort((a, b) => byMw(a, b) || byName(a, b));
    return list;
  }, [facilities, sort]);
  useEffect(() => { setPage(1); }, [facilities, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);
  const chooseSource = (sourceId) => patch({ source: sourceId, country: sourceId === 'seafic' ? 'Malaysia' : '', operator: '', status: '', state: '', location: 'all', query: '', colorBy: 'status' });
  const scope = (country) => chooseSource(country === 'Malaysia' ? 'seafic' : 'ringmast4r');
  const download = () => {
    const url = URL.createObjectURL(new Blob(['\ufeff', dataCentresCsv(sorted)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'data-centres.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const changePage = (next) => { setPage(next); scrollRef.current?.scrollTo({ top: 0 }); };

  return <section className={cn('dc-tracker', className)} aria-label="Data centre directory">
    <header className="dc-header">
      <span className="dc-brand-icon"><Server aria-hidden="true" /></span>
      <div><span className="dc-eyebrow">INFRASTRUCTURE EXPLORER</span><h2>Data centres</h2></div>
      <button type="button" className="dc-icon-button" onClick={onClose} aria-label="Close data centre settings"><X /></button>
    </header>
    <div className="dc-toolbar"><span><i className={settings.enabled ? 'is-on' : ''} /> Layer visibility</span>
      <Switch checked={settings.enabled} onCheckedChange={(enabled) => patch({ enabled })} aria-label="Data centres layer" /></div>
    <nav className="dc-tabs" role="tablist" aria-label="Data centre tools">{TABS.map(({ id: key, label, icon: Icon }) =>
      <button key={key} type="button" role="tab" id={`${id}-${key}`} aria-selected={tab === key} aria-controls={`${id}-content`}
        tabIndex={tab === key ? 0 : -1} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}
        onKeyDown={(event) => {
          const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!direction) return;
          event.preventDefault();
          const next = (TABS.findIndex((item) => item.id === key) + direction + TABS.length) % TABS.length;
          setTab(TABS[next].id);
          event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
        }}><Icon aria-hidden="true" />{label}</button>)}</nav>

    <div className="dc-tracker-scroll" ref={scrollRef}>
      <div className="dc-source-selector" role="group" aria-label="Data source">
        <button type="button" aria-pressed={isMalaysiaTracker} onClick={() => chooseSource('seafic')}><strong>Malaysia tracker</strong><small>SEAFIC · campus &amp; phase data</small></button>
        <button type="button" aria-pressed={!isMalaysiaTracker} onClick={() => chooseSource('ringmast4r')}><strong>Global directory</strong><small>Ringmast4r · named facilities</small></button>
      </div>
      {status.state === 'loading' || status.state === 'idle' ? <div className="dc-empty" role="status"><Server /><p>Loading facilities…</p></div> : null}
      {status.state === 'error' ? <div className="dc-empty" role="alert"><p>{status.text}</p><button type="button" onClick={retry}>Try again</button></div> : null}
      {data ? <>
        <div className="dc-scope">
          <div className="dc-scope-heading"><span>Explore a region</span><div className="dc-quick-scope">
            <button type="button" aria-pressed={isMalaysiaTracker} onClick={() => scope('Malaysia')}>Malaysia</button>
            <button type="button" aria-pressed={!isMalaysiaTracker && !settings.country} onClick={() => scope('')}>Worldwide</button></div></div>
          <Combobox value={settings.country} options={countries} onValueChange={(country) => patch({ country, operator: '', state: '' })} />
          <label className="dc-search"><Search aria-hidden="true" /><span className="sr-only">Search facilities, operators or addresses</span>
            <input type="search" value={settings.query} onChange={(event) => patch({ query: event.target.value })} placeholder="Find a facility, operator or address" /></label>
          {hasFilters ? <div className="dc-filter-summary"><span title={filterLabel}>{filterLabel}</span>
            <button type="button" onClick={reset}><RotateCcw /> Clear filters</button></div> : null}
        </div>

        <div id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="dc-tab-content">
          {tab === 'overview' ? <>
            {/* Headline: total + build-status mix. Rows filter the map by status. */}
            <section className="dc-hero" aria-label={isMalaysiaTracker ? 'Capacity by build-out status' : 'Facilities by reported status'}>
              <div className="dc-hero-top">
                <span className="dc-kicker">{isMalaysiaTracker ? 'Net capacity' : 'Facilities listed'} · {settings.state || settings.country || 'Worldwide'}</span>
                <button type="button" className="dc-link" onClick={() => setTab('directory')}>Browse all <ArrowUpRight /></button>
              </div>
              <strong className="dc-hero-value">{isMalaysiaTracker
                ? <>{count(Math.round(overview.total.mw))}<small>MW</small></>
                : count(summary.total)}</strong>
              <p className="dc-hero-sub">{isMalaysiaTracker
                ? `${count(overview.total.campuses)} campuses · ${count(overview.phaseCount)} phase records`
                : `${count(summary.operators)} operators in this view`}</p>
              <div className="dc-stack" role="img" aria-label={overview.statuses.filter((entry) => metric(entry) > 0)
                .map((entry) => `${entry.label} ${isMalaysiaTracker ? mwText(entry.mw) : count(entry.campuses)}`).join(', ')}>
                {overview.statuses.filter((entry) => metric(entry) > 0).map((entry) => <span key={entry.id}
                  className={cn(settings.status && settings.status !== entry.id && 'is-dim')}
                  style={{ flexGrow: metric(entry), background: entry.color }} />)}
              </div>
              <ul className="dc-status-rows">
                {overview.statuses.filter((entry) => entry.campuses > 0 || settings.status === entry.id).map((entry) => {
                  const share = metricTotal ? metric(entry) / metricTotal * 100 : 0;
                  const selected = settings.status === entry.id;
                  return <li key={entry.id}><button type="button" aria-pressed={selected} disabled={!entry.campuses && !selected}
                    className={cn(settings.status && !selected && 'is-dim')} onClick={() => toggleStatus(entry.id)}
                    title={selected ? 'Show every status' : `Show only ${entry.label.toLowerCase()} on the map`}>
                    <i className="dc-dot" style={{ background: entry.color }} />
                    <span className="dc-status-name">{entry.label}</span>
                    <span className="dc-status-meta">{count(entry.campuses)} {isMalaysiaTracker ? 'sites' : ''}</span>
                    <strong>{isMalaysiaTracker ? mwText(entry.mw) : count(entry.campuses)}</strong>
                    <span className="dc-status-share">{share >= 1 || !share ? Math.round(share) : '<1'}%</span>
                  </button></li>;
                })}
              </ul>
              {isMalaysiaTracker && overview.basis.some((entry) => entry.mw > 0) ? <p className="dc-basis">
                <span>MW basis</span>{overview.basis.filter((entry) => entry.mw > 0).map((entry) =>
                  <span key={entry.label}><b>{count(Math.round(entry.mw))}</b> {entry.label.toLowerCase()}</span>)}
              </p> : null}
            </section>

            {isMalaysiaTracker ? <section className="dc-card">
              <div className="dc-card-heading"><h3>Breakdown</h3>
                <div className="dc-segmented" role="group" aria-label="Table unit">
                  <button type="button" aria-pressed={unit === 'mw'} onClick={() => setUnit('mw')}>MW</button>
                  <button type="button" aria-pressed={unit === 'campuses'} onClick={() => setUnit('campuses')}>Campuses</button>
                </div></div>
              <div className="dc-table-scroll" tabIndex={0} aria-label="Category by build-out status table">
                <table className="dc-matrix">
                  <thead><tr><th scope="col">Category</th>
                    {tableStatuses.map((entry) => <th key={entry.id} scope="col"><button type="button" aria-pressed={settings.status === entry.id}
                      onClick={() => toggleStatus(entry.id)} title={`${entry.label}: click to filter`}>
                      <i className="dc-dot" style={{ background: entry.color }} />{STATUS_SHORT[entry.id]}</button></th>)}
                    <th scope="col" className="is-total">Total</th></tr></thead>
                  <tbody>{overview.categories.map((category) => <tr key={category.id}><th scope="row">{category.short}</th>
                    {tableStatuses.map((entry) => <td key={entry.id} className={cn(settings.status === entry.id && 'is-selected')}>{cell(category.cells[entry.id])}</td>)}
                    <td className="is-total">{cell(category)}</td></tr>)}</tbody>
                  <tfoot><tr><th scope="row">Total</th>
                    {tableStatuses.map((entry) => <td key={entry.id} className={cn(settings.status === entry.id && 'is-selected')}>{cell(overview.statusTotals[entry.id])}</td>)}
                    <td className="is-total">{cell(overview.total)}</td></tr></tfoot>
                </table>
              </div>
              <p className="dc-help">Built or contracted MW beyond listed phases. In campus counts, a campus with phases in several cells is counted in each. Campus IDs are anonymous in the public tracker; updated {data.metadata.sourceUpdated}.</p>
            </section> : <section className="dc-card"><div className="dc-card-heading"><h3>Leading operators</h3><span>View facilities</span></div>
              <ul className="dc-operator-list">{summary.leadingOperators.slice(0, 7).map(([company, total]) => <li key={company}><button type="button"
                onClick={() => { patch({ operator: company }); setTab('directory'); }}><span className="dc-operator-mark" style={{ background: dataCentreColor({ company }, 'operator') }} />
                <span>{company}</span><strong>{count(total)}</strong><ChevronRight /></button></li>)}</ul>
            </section>}

            <section className="dc-card">
              <div className="dc-card-heading"><h3>Location coverage</h3><span>{coverage}% mapped</span></div>
              <div className="dc-coverage" role="img" aria-label={`${coverage}% have coordinates`}><span style={{ width: `${coverage}%` }} /></div>
              <div className="dc-location-grid">
                <button type="button" className="dc-location-stat" onClick={() => { patch({ location: 'mapped' }); setTab('directory'); }}>
                  <LocateFixed /><span><strong>{count(summary.mapped)}</strong><small>With coordinates</small></span><ChevronRight /></button>
                <button type="button" className="dc-location-stat" onClick={() => { patch({ location: 'unmapped' }); setTab('directory'); }}>
                  <ListFilter /><span><strong>{count(summary.unmapped)}</strong><small>Directory only</small></span><ChevronRight /></button>
              </div>
              <button type="button" className="dc-fit-button" disabled={!summary.mapped || !settings.enabled} onClick={onFit}><LocateFixed /> Frame mapped results <ArrowUpRight /></button>
              <p className="dc-help">{!settings.enabled ? 'Turn on layer visibility above to see these on the map.' : isMalaysiaTracker
                ? 'Solid rings mark confirmed plots; dashed rings mark park or street locations. Unlocated campuses stay in the totals.'
                : 'Only records with source coordinates appear on the map. Coordinates can represent a city or region.'}</p>
            </section>

            {settings.country && (stateChips.length > 1 || settings.state) ? <section className="dc-card">
              <div className="dc-card-heading"><h3>{isMalaysiaTracker ? 'By state' : 'By region'}</h3>
                {settings.state ? <button type="button" className="dc-link" onClick={() => patch({ state: '' })}>Clear <X /></button>
                  : <span>{isMalaysiaTracker ? 'Campuses' : 'Facilities'}</span>}</div>
              <div className="dc-chips">{stateChips.slice(0, 16).map(([state, total]) => <button key={state} type="button"
                aria-pressed={settings.state === state} onClick={() => patch({ state: settings.state === state ? '' : state })}>
                {state}<span>{count(total)}</span></button>)}</div>
            </section> : null}
          </> : null}

          {tab === 'directory' ? <>
            {/* Filters: same status colours and counts as the overview. */}
            <div className="dc-dir-controls">
              <div className="dc-segmented dc-segmented-wide" role="group" aria-label="Location">
                {[['all', 'All', locationCounts.all], ['mapped', 'On map', locationCounts.mapped], ['unmapped', 'Directory only', locationCounts.unmapped]].map(([value, label, total]) =>
                  <button key={value} type="button" aria-pressed={settings.location === value} onClick={() => patch({ location: value })}>{label}<span>{count(total)}</span></button>)}
              </div>
              <div className="dc-chips dc-status-chips" role="group" aria-label="Build status">
                {overview.statuses.filter((entry) => entry.campuses > 0 || settings.status === entry.id).map((entry) => <button key={entry.id} type="button"
                  aria-pressed={settings.status === entry.id} onClick={() => toggleStatus(entry.id)}>
                  <i className="dc-dot" style={{ background: entry.color }} />{entry.label}<span>{count(entry.campuses)}</span></button>)}
              </div>
            </div>

            <div className="dc-results-bar">
              <div className="dc-results-title">
                <h3>{count(summary.total)} {isMalaysiaTracker ? (summary.total === 1 ? 'campus' : 'campuses') : (summary.total === 1 ? 'facility' : 'facilities')}</h3>
                <small>{summary.capacityReported ? `${mwText(summary.totalMw)} reported` : 'No capacity reported'}</small>
              </div>
              <div className="dc-sort"><span className="sr-only">Sort results</span><Combobox value={sort} options={SORT_OPTIONS} onValueChange={setSort} /></div>
              <button type="button" className="dc-export" onClick={download} disabled={!facilities.length} title="Download these results as CSV"><Download /> CSV</button>
            </div>

            <ol className="dc-directory">{pageRows.map((facility) => {
              const color = dataCentreColor(facility, settings.colorBy);
              const mix = isMalaysiaTracker ? phaseMix(facility) : [];
              const mixTotal = mix.reduce((sum, entry) => sum + entry.mw, 0);
              return <li key={facility.id} className="dc-facility" style={{ '--facility-color': color }}>
                <details>
                  <summary>
                    <span className="dc-facility-symbol"><Server /></span>
                    <span className="dc-facility-main">
                      <strong>{facility.name}</strong>
                      <span className="dc-facility-meta">
                        <span className="dc-badge" style={{ '--badge-color': STATUS_COLOR[facility.status] || STATUS_COLOR.Undisclosed }}><i />{facility.status}</span>
                        <span className="dc-facility-place">{isMalaysiaTracker ? `${facility.state || 'State n/a'} · ${facility.phases.length} ${facility.phases.length === 1 ? 'phase' : 'phases'}` : facility.company}</span>
                      </span>
                      {mixTotal > 0 ? <span className="dc-mix" role="img" aria-label={`Phase mix: ${mix.map((entry) => `${entry.label} ${mwText(entry.mw)}`).join(', ')}`}>
                        {mix.map((entry) => <span key={entry.id} style={{ flexGrow: entry.mw, background: entry.color }} title={`${entry.label} · ${mwText(entry.mw)}`} />)}
                      </span> : null}
                    </span>
                    <span className="dc-facility-mw">{facility.capacityMw !== null
                      ? <><strong>{count(Math.round(facility.capacityMw))}</strong><small>MW</small></>
                      : <small>MW n/a</small>}</span>
                    <ChevronDown className="dc-facility-chevron" />
                  </summary>

                  <div className="dc-facility-body">
                    <dl className="dc-facts">
                      {!isMalaysiaTracker ? <div className="is-wide"><dt>Address</dt><dd>{facility.address || 'Not provided'}</dd></div> : null}
                      <div><dt>{isMalaysiaTracker ? 'State' : 'Region'}</dt><dd>{facility.state || facility.city || '—'}</dd></div>
                      <div><dt>Country</dt><dd>{facility.country}</dd></div>
                      <div><dt>Reported MW</dt><dd>{formatDataCentreMw(facility.capacityMw)}</dd></div>
                      <div><dt>Location</dt><dd>{facility.mapped ? (isMalaysiaTracker ? facility.precision : 'Source position') : 'No coordinates'}</dd></div>
                      {facility.mapped ? <div className="is-wide"><dt>Coordinates</dt><dd className="dc-mono">{facility.latitude.toFixed(5)}, {facility.longitude.toFixed(5)}
                        {isMalaysiaTracker && facility.locationChecked ? <small>Checked {facility.locationChecked}</small> : null}</dd></div> : null}
                    </dl>
                    {isMalaysiaTracker && facility.phases.length ? <div className="dc-phases">
                      <table>
                        <thead><tr><th scope="col">Record</th><th scope="col">Status</th><th scope="col">Category</th><th scope="col" className="is-num">MW</th></tr></thead>
                        <tbody>{facility.phases.map((phase) => <tr key={phase.record_id}>
                          <th scope="row">{phase.record_id}{phase.status_date ? <small>{phase.status_date}</small> : null}</th>
                          <td><span className="dc-phase-status"><i style={{ background: STATUS_COLOR[malaysiaBuildStatus(phase.status)] }} />{phase.status}</span></td>
                          <td>{phase.category || '—'}</td>
                          <td className="is-num">{Number.isFinite(phase.mw) ? count(Math.round(phase.mw_net)) : '—'}{Number.isFinite(phase.mw) && phase.mw_net !== phase.mw ? <small>of {count(phase.mw)}</small> : null}</td>
                        </tr>)}</tbody>
                      </table>
                    </div> : null}
                  </div>
                </details>
                <div className="dc-facility-bottom">
                  <span>{facility.mapped ? (facility.approximate ? 'Approximate position' : 'Confirmed position') : 'Listed without coordinates'}</span>
                  {facility.mapped ? <button type="button" disabled={!settings.enabled} onClick={() => onFlyTo(facility)}
                    title={settings.enabled ? 'Fly to this site' : 'Turn on layer visibility to view on the map'} aria-label={`View ${facility.name} on map`}><MapPin /> View on map</button> : null}
                </div>
              </li>;
            })}</ol>

            {pages > 1 ? <div className="dc-pagination">
              <button type="button" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)} aria-label="Previous results"><ChevronLeft /></button>
              <span>{count(pageStart + 1)}–{count(Math.min(pageStart + PAGE_SIZE, sorted.length))} of {count(sorted.length)}</span>
              <button type="button" disabled={currentPage === pages} onClick={() => changePage(currentPage + 1)} aria-label="Next results"><ChevronRight /></button>
            </div> : null}
          </> : null}

          {tab === 'appearance' ? <>
            <section className="dc-card"><div className="dc-card-heading"><h3>Marker colour</h3></div><div className="dc-appearance-options">
              {[{ value: 'status', label: 'Reported status', text: 'Operating, construction, planned or undisclosed' }, ...(!isMalaysiaTracker ? [{ value: 'operator', label: 'Operator', text: 'Consistent colours for each operator' }] : [])].map((option) =>
                <button key={option.value} type="button" aria-pressed={settings.colorBy === option.value} onClick={() => patch({ colorBy: option.value })}>
                  <span><strong>{option.label}</strong><small>{option.text}</small></span>{settings.colorBy === option.value ? <Check /> : <span className="dc-radio" />}</button>)}
            </div>{settings.colorBy === 'status' ? <div className="dc-colour-key">{DC_STATUS.map((entry) => <span key={entry.id}><i className="dc-dot" style={{ background: entry.color }} />{entry.label}</span>)}</div> : null}</section>
            <section className="dc-card"><div className="dc-card-heading"><h3>Marker size</h3><span>{Math.round(settings.markerScale * 100)}%</span></div>
              <label className="dc-size-setting"><span className="sr-only">Marker size</span><input type="range" min="0.7" max="1.6" step="0.1" value={settings.markerScale} onChange={(event) => patch({ markerScale: Number(event.target.value) })} /></label>
              <p className="dc-help">{isMalaysiaTracker ? 'Solid outlines identify confirmed plots. Dashed outlines identify approximate park or street positions.' : 'Markers use a uniform size. Dashed outlines indicate that exact building-level precision is not confirmed.'}</p></section>
            <section className="dc-card"><h3>Shared between views</h3><p className="dc-help">Your region, search, filters and marker style stay the same when switching between 2D and 3D.</p></section>
          </> : null}
          {!facilities.length ? <div className="dc-empty" role="status"><Search /><p>No matching facilities</p><button type="button" onClick={reset}>Clear filters</button></div> : null}
        </div>
      </> : null}
    </div>
    {data ? <footer className="dc-source"><a href={data.metadata.sourceUrl} target="_blank" rel="noopener noreferrer">© {source.label} <ArrowUpRight /></a>
      {isMalaysiaTracker ? <a href={`${import.meta.env.BASE_URL}data/malaysia-data-centres-ATTRIBUTION.md`} target="_blank" rel="noopener noreferrer">Sources &amp; credits</a> : null}
      <a href={data.metadata.licenseUrl} target="_blank" rel="noopener noreferrer">Licence</a></footer> : null}
  </section>;
}
