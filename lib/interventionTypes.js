// Vocabulary of maintenance events that change what the oil is, and therefore
// break the continuity of a trend line.
//
// `resets` is the important field: it names the chart series whose history is
// no longer comparable across the event. After a retrofill, comparing this
// month's H2 to last month's is meaningless — it is different oil. The trending
// charts use this to mark where a baseline restarted, so a step change reads as
// maintenance rather than as a developing fault.

export const INTERVENTION_TYPES = [
  {
    value: 'filtration',
    label: 'Oil filtration / reconditioning',
    code: 'FIL',
    color: '#0ea5e9',
    resets: ['Moisture', 'BDV', 'DGA', 'Furan'],
    hint: 'Physical treatment: vacuum dehydration and particle filtration. Water and BDV recover sharply, and dissolved gas and furans are stripped out. It does NOT remove acids or sludge — that needs reclamation.',
  },
  {
    value: 'reclamation',
    label: 'Reclamation / regeneration',
    code: 'REC',
    color: '#d946ef',
    resets: ['Acidity', 'IFT', 'Color'],
    hint: 'Chemical treatment (Fuller’s earth / clay): removes acids, sludge and soluble decay products. Acidity, IFT and colour restart from a fresh baseline.',
  },
  {
    value: 'degassing',
    label: 'Degassing / vacuum treatment',
    code: 'DEG',
    color: '#8b5cf6',
    resets: ['DGA'],
    hint: 'Strips dissolved gases. DGA restarts from near zero — do not read the drop as improvement.',
  },
  {
    value: 'top_up',
    label: 'Oil top-up',
    code: 'TOP',
    color: '#14b8a6',
    resets: ['Inhibitor', 'Furan'],
    hint: 'Dilutes the existing oil. Inhibitor and furan shift by dilution, not by condition.',
  },
  {
    value: 'retrofill',
    label: 'Oil replacement / retrofill',
    code: 'NEW',
    color: '#f97316',
    resets: ['DGA', 'Furan', 'Acidity', 'Color', 'Inhibitor', 'Moisture', 'IFT'],
    hint: 'New oil. Every oil-based series starts a fresh baseline; paper condition does not.',
  },
  {
    value: 'inhibitor_dosing',
    label: 'Inhibitor dosing (re-inhibit)',
    code: 'INH',
    color: '#10b981',
    resets: ['Inhibitor'],
    hint: 'DBPC content is restored by dosing, not by the oil recovering.',
  },
  {
    value: 'passivator_dosing',
    label: 'Passivator dosing',
    code: 'PAS',
    color: '#3b82f6',
    resets: ['Passivator'],
    hint: 'Passivator concentration is restored by dosing.',
  },
  {
    value: 'repair',
    label: 'Repair / untanking',
    code: 'REP',
    color: '#ef4444',
    resets: ['DGA', 'Moisture'],
    hint: 'Opening the tank exposes the oil to air; gases and moisture shift for handling reasons.',
  },
  {
    value: 'oltc_maintenance',
    label: 'OLTC maintenance',
    code: 'TAP',
    color: '#eab308',
    resets: [],
    hint: 'Recorded for context. Affects the diverter compartment rather than the main tank.',
  },
  {
    value: 'inspection',
    label: 'Inspection only',
    code: 'INS',
    color: '#94a3b8',
    resets: [],
    hint: 'No change to the oil — recorded so the date is on the timeline.',
  },
];

const TYPES_BY_VALUE = new Map(INTERVENTION_TYPES.map((type) => [type.value, type]));

export const DEFAULT_INTERVENTION_TYPE = 'filtration';

export function getInterventionType(value) {
  return (
    TYPES_BY_VALUE.get(String(value ?? '').trim()) || {
      value: String(value ?? 'other'),
      label: String(value ?? 'Other'),
      code: '—',
      color: '#94a3b8',
      resets: [],
      hint: '',
    }
  );
}

export function getInterventionLabel(value) {
  return getInterventionType(value).label;
}

/**
 * Does this event break the continuity of the given chart series?
 * `series` uses the keys produced by mapOilTestsToChartData (Moisture, BDV, …),
 * plus the pseudo-series 'DGA' covering every dissolved gas.
 */
export function interventionResets(value, series) {
  return getInterventionType(value).resets.includes(series);
}
