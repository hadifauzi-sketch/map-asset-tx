import { MALAYSIA_DC_SOURCE, malaysiaBuildStatus, malaysiaCampus } from './malaysiaDataCentres.js';

export const DATA_CENTRE_SOURCE = 'https://github.com/Ringmast4r/Global-Data-Center-Map';
export const DATA_CENTRE_CREDIT = `<a href="${DATA_CENTRE_SOURCE}" target="_blank" rel="noopener noreferrer">© Ringmast4r</a>`;
export const DATA_CENTRE_SOURCES = {
  seafic: { id: 'seafic', label: 'SEAFIC', title: 'Malaysia tracker', url: MALAYSIA_DC_SOURCE,
    file: 'data/data-centres-malaysia.json', schemaVersion: 3, license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Site data © SEAFIC; compiled and designed by Seow E Kin Zane Ryan; location credit Ringmast4r; CC BY 4.0.',
    credit: `<a href="${MALAYSIA_DC_SOURCE}" target="_blank" rel="noopener noreferrer">© SEAFIC</a> · ${DATA_CENTRE_CREDIT}` },
  ringmast4r: { id: 'ringmast4r', label: 'Ringmast4r', title: 'Global directory', url: DATA_CENTRE_SOURCE,
    file: 'data/data-centres-global.json', schemaVersion: 2, license: 'Attribution required',
    licenseUrl: `${DATA_CENTRE_SOURCE}/blob/main/LICENSE`, credit: DATA_CENTRE_CREDIT,
    attribution: 'Data centers (c) Ringmast4r - Global-Data-Center-Map' },
};
export function dataCentreSource(value) {
  const id = typeof value === 'string' ? value : value?.source;
  return Object.hasOwn(DATA_CENTRE_SOURCES, id) ? DATA_CENTRE_SOURCES[id] : DATA_CENTRE_SOURCES.ringmast4r;
}
export const DC_STATUS = [
  { id: 'Operating', label: 'Operating', color: '#28cfa4' },
  { id: 'Under construction', label: 'Under construction', color: '#f1b754' },
  { id: 'Planned', label: 'Planned', color: '#62a9ff' },
  { id: 'Canceled', label: 'Canceled', color: '#f18496' },
  { id: 'Undisclosed', label: 'Undisclosed', color: '#8fa9bd' },
];
const STORAGE_KEY = 'tx-map-data-centres-v3';
const OPERATOR_COLORS = ['#40d6bc', '#8fa8ff', '#f2ba67', '#d99add', '#70c5f1', '#9bd48d', '#ef9299', '#c0b57c'];
export const DEFAULT_DC_SETTINGS = { source: 'seafic', enabled: false, panelOpen: false, colorBy: 'status', markerScale: 1,
  country: 'Malaysia', operator: '', status: '', state: '', location: 'all', query: '' };

export function readDataCentreSettings(storage = globalThis.localStorage) {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    const saved = JSON.parse(stored || storage?.getItem('tx-map-data-centres-v2') || storage?.getItem('tx-map-data-centres-v1') || '{}');
    const source = stored && saved.source === 'ringmast4r' ? 'ringmast4r' : 'seafic';
    return { ...DEFAULT_DC_SETTINGS, enabled: saved.enabled === true,
      source, ...(stored ? { country: source === 'seafic' ? 'Malaysia' : typeof saved.country === 'string' ? saved.country : 'Malaysia',
        operator: typeof saved.operator === 'string' ? saved.operator : '', query: typeof saved.query === 'string' ? saved.query : '',
        status: DC_STATUS.some((entry) => entry.id === saved.status) ? saved.status : '',
        state: typeof saved.state === 'string' ? saved.state : '',
        location: ['all', 'mapped', 'unmapped'].includes(saved.location) ? saved.location : 'all',
        colorBy: saved.colorBy === 'operator' && source === 'ringmast4r' ? 'operator' : 'status' } : {}),
      markerScale: Number.isFinite(saved.markerScale) ? Math.max(0.7, Math.min(1.6, saved.markerScale)) : 1 };
  } catch { return { ...DEFAULT_DC_SETTINGS }; }
}
export function writeDataCentreSettings(settings, storage = globalThis.localStorage) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify({ ...settings, panelOpen: false })); } catch { /* session only */ }
}
export function filterDataCentres(rows, settings) {
  const words = String(settings.query || '').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const selected = settings.status ? rows.flatMap((row) => {
    if (row.source !== 'seafic') return row.status === settings.status ? [row] : [];
    const phases = row.phases.filter((phase) => malaysiaBuildStatus(phase.status) === settings.status);
    return phases.length ? [malaysiaCampus(phases)] : [];
  }) : rows;
  return selected.filter((row) => (!settings.country || row.country === settings.country)
    && (!settings.operator || row.company === settings.operator)
    && (!settings.state || row.state === settings.state)
    && (settings.location === 'all' || (settings.location === 'mapped' ? row.mapped : !row.mapped))
    && (!words.length || words.every((word) => `${row.name} ${row.company} ${row.address} ${row.city} ${row.state} ${row.country}`.toLocaleLowerCase().includes(word))));
}
export function summarizeDataCentres(rows) {
  const operatorCounts = new Map();
  const statusCounts = new Map();
  const categoryCounts = new Map();
  let mapped = 0;
  let capacityReported = 0;
  let totalMw = 0;
  let phaseCount = 0;
  rows.forEach((row) => {
    if (row.mapped) mapped++;
    if (row.capacityMw !== null) { capacityReported++; totalMw += row.capacityMw; }
    if (!['Not recorded', 'Not disclosed'].includes(row.company)) operatorCounts.set(row.company, (operatorCounts.get(row.company) || 0) + 1);
    phaseCount += row.phases?.length || 0;
    const statuses = row.phases ? new Set(row.phases.map((phase) => malaysiaBuildStatus(phase.status))) : [row.status];
    for (const status of statuses) statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    for (const category of new Set(row.phases?.map((phase) => phase.category) || [])) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  });
  return { total: rows.length, mapped, unmapped: rows.length - mapped, capacityReported, totalMw, phaseCount,
    operators: operatorCounts.size,
    leadingOperators: [...operatorCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), statusCounts, categoryCounts };
}


/** SEAFIC campus categories, in table order. */
export const DC_CATEGORIES = [
  { id: 'AI-ready', label: 'AI-ready', short: 'AI-ready' },
  { id: 'Traditional', label: 'Traditional', short: 'Trad.' },
  { id: 'Mixed', label: 'Mixed', short: 'Mixed' },
  { id: 'Undisclosed', label: 'Undisclosed', short: 'Undiscl.' },
];

/**
 * Capacity and campus counts by build status, by category × status, by MW
 * basis and by state. Malaysia campuses are split by phase (a campus with
 * phases in two cells counts once in each); global facilities count as one
 * phase with their own status. MW uses `mw_net`, matching the source tracker.
 */
export function dataCentreBreakdown(rows) {
  const statusIds = DC_STATUS.map((entry) => entry.id);
  const blank = () => ({ mw: 0, ids: new Set() });
  const byStatus = new Map(statusIds.map((id) => [id, blank()]));
  const byCategory = new Map(DC_CATEGORIES.map(({ id }) => [id, { total: blank(), cells: new Map(statusIds.map((status) => [status, blank()])) }]));
  const basis = new Map();
  const states = new Map();
  const total = blank();
  let phaseCount = 0;
  const add = (bucket, rowId, mw) => { bucket.mw += mw; bucket.ids.add(rowId); };

  rows.forEach((row) => {
    if (row.state) states.set(row.state, (states.get(row.state) || 0) + 1);
    const parts = row.phases?.length
      ? row.phases.map((phase) => ({ status: malaysiaBuildStatus(phase.status), mw: Number(phase.mw_net) || 0,
        category: phase.category || 'Undisclosed', basis: phase.mw_basis || 'Not recorded' }))
      : [{ status: row.status, mw: Number(row.capacityMw) || 0, category: 'Undisclosed', basis: row.capacityMw === null ? 'Not recorded' : 'Reported' }];
    phaseCount += row.phases?.length || 0;
    parts.forEach((part) => {
      const status = byStatus.has(part.status) ? part.status : 'Undisclosed';
      const category = byCategory.get(part.category) || byCategory.get('Undisclosed');
      add(byStatus.get(status), row.id, part.mw);
      add(category.total, row.id, part.mw);
      add(category.cells.get(status), row.id, part.mw);
      add(total, row.id, part.mw);
      if (!basis.has(part.basis)) basis.set(part.basis, blank());
      add(basis.get(part.basis), row.id, part.mw);
    });
  });

  const out = (bucket) => ({ mw: bucket.mw, campuses: bucket.ids.size });
  return {
    total: out(total),
    phaseCount,
    statuses: DC_STATUS.map((entry) => ({ ...entry, ...out(byStatus.get(entry.id)) })),
    categories: DC_CATEGORIES.map((entry) => {
      const { total: categoryTotal, cells } = byCategory.get(entry.id);
      return { ...entry, ...out(categoryTotal), cells: Object.fromEntries(statusIds.map((id) => [id, out(cells.get(id))])) };
    }),
    statusTotals: Object.fromEntries(statusIds.map((id) => [id, out(byStatus.get(id))])),
    basis: [...basis].map(([label, bucket]) => ({ label, ...out(bucket) })).sort((a, b) => b.mw - a.mw || b.campuses - a.campuses),
    states: [...states].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}
export function dataCentreCountryOptions(rows) {
  const counts = new Map();
  rows.forEach((row) => counts.set(row.country, (counts.get(row.country) || 0) + 1));
  return [...(rows[0]?.source === 'seafic' ? [] : [{ value: '', label: 'Worldwide' }]), ...[...counts].sort((a, b) => a[0] === 'Malaysia' ? -1 : b[0] === 'Malaysia' ? 1
    : a[0] === 'Not recorded' ? 1 : b[0] === 'Not recorded' ? -1 : a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: `${value} · ${count.toLocaleString()}` }))];
}
export function dataCentreColor(facility, colorBy = 'status') {
  if (colorBy === 'operator') {
    let hash = 0;
    for (const char of facility.company || '') hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    return OPERATOR_COLORS[hash % OPERATOR_COLORS.length];
  }
  return DC_STATUS.find((entry) => entry.id === facility.status)?.color || '#8fa9bd';
}
export function formatDataCentreMw(value) {
  return value === null || value === undefined ? 'Undisclosed' : `${Number(value).toLocaleString('en-MY', { maximumFractionDigits: 1 })} MW`;
}
export function dataCentreMarkerSvg(facility, colorBy, scale = 1) {
  const size = Math.round(20 * scale);
  const half = size / 2;
  const color = dataCentreColor(facility, colorBy);
  return { size, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${half}" cy="${half}" r="${half - 1}" fill="#062b2b" fill-opacity=".9"/><circle cx="${half}" cy="${half}" r="${half - 3}" fill="${color}" stroke="#e6fff9" stroke-width="1.5"${facility.approximate ? ' stroke-dasharray="3 2"' : ''}/></svg>` };
}
export function describeDataCentre(facility) {
  const source = dataCentreSource(facility);
  return { kind: 'Data centre', title: facility.name, layout: 'list', color: dataCentreColor(facility), dataCentre: facility, rows: [
    ['Facility', facility.name], ['Operator', facility.company], ['Country', facility.country], ['City', facility.city],
    ['State / region', facility.state], ['Address', facility.address], ['Status', facility.status],
    ['Reported capacity', formatDataCentreMw(facility.capacityMw)],
    ['Location', facility.mapped ? (facility.approximate ? `Approximate · ${facility.precision}` : `Plot confirmed · ${facility.precision}`) : 'No coordinates supplied'],
    ['Source country', facility.sourceCountry && facility.country !== facility.sourceCountry ? facility.sourceCountry : ''],
  ], link: { href: source.url, label: source.label } };
}
const csvValue = (value) => {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export function dataCentresCsv(rows) {
  return [['Facility', 'Operator', 'Country', 'City', 'State / region', 'Address', 'Status', 'Capacity MW', 'Latitude', 'Longitude', 'Source', 'Source URL', 'Licence', 'Capacity basis', 'Attribution'],
    ...rows.map((row) => [row.name, row.company, row.country, row.city, row.state, row.address, row.status,
      row.capacityMw, row.latitude, row.longitude, dataCentreSource(row).label, dataCentreSource(row).url, dataCentreSource(row).license,
      row.source === 'seafic' ? 'Net built/contracted MW beyond listed phases' : 'Reported MW', dataCentreSource(row).attribution]),
  ].map((row) => row.map(csvValue).join(',')).join('\r\n');
}
