export const MALAYSIA_DC_SOURCE = 'https://seafic.org/data-center-mapping/';
const STATUS_ORDER = ['Operating', 'Under construction', 'Planned', 'Canceled', 'Undisclosed'];

export function malaysiaBuildStatus(status) {
  if (status === 'Operational') return 'Operating';
  if (status === 'Under construction') return status;
  if (['Announced', 'Approved/land acquired', 'Power agreement signed'].includes(status)) return 'Planned';
  if (status === 'Cancelled/Stalled') return 'Canceled';
  return 'Undisclosed';
}

/** Preserve source phase accounting and the same first mapped pin as SEAFIC. */
export function malaysiaCampus(phases) {
  const first = phases[0];
  const placed = phases.filter((phase) => phase.mapped);
  const position = placed[0];
  const precise = placed.find((phase) => phase.location_precision === 'Parcel');
  const location = precise || position;
  const statuses = new Set(phases.map((phase) => malaysiaBuildStatus(phase.status)));
  const reported = phases.some((phase) => Number.isFinite(phase.mw));
  return {
    id: `seafic-${first.project.toLowerCase().replace(/\s+/g, '-')}`, name: first.project,
    source: 'seafic', recordType: 'campus', company: 'Not disclosed', country: 'Malaysia', sourceCountry: 'Malaysia',
    city: '', state: first.state || '', address: '', street: '', postcode: '',
    status: STATUS_ORDER.find((status) => statuses.has(status)) || 'Undisclosed',
    capacityMw: reported ? phases.reduce((sum, phase) => sum + phase.mw_net, 0) : null,
    mapped: Boolean(position), latitude: position?.latitude ?? null, longitude: position?.longitude ?? null,
    approximate: Boolean(position && !precise), precision: location?.location_precision || 'No public coordinates',
    locationChecked: location?.coord_checked || '', phases,
  };
}

export function groupMalaysiaCampuses(phases) {
  const groups = new Map();
  phases.forEach((phase) => {
    if (!groups.has(phase.project)) groups.set(phase.project, []);
    groups.get(phase.project).push(phase);
  });
  return [...groups.values()].map(malaysiaCampus);
}
