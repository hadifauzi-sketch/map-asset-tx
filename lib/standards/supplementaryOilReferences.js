const STATUS_LABELS = {
  healthy: 'Healthy',
  monitor: 'Monitor',
  action: 'Action',
  noData: 'No data',
};

export const SUPPLEMENTARY_OIL_REFERENCE_ORDER = [
  'appearance',
  'inhibitor',
  'passivator',
  'fal2',
  'methanol',
];

const APPEARANCE_GOOD_VALUES = [
  'clear',
  'clear free from sediment and suspended matter',
  'clear, free from sediment and suspended matter',
  'clear free of sediment and suspended matter',
  'clear and bright',
  'bright and clear',
];

const APPEARANCE_ALERT_KEYWORDS = [
  'dull',
  'turbid',
  'cloudy',
  'hazy',
  'sediment',
  'suspended matter',
  'opaque',
];

export const SUPPLEMENTARY_OIL_REFERENCES = {
  appearance: {
    key: 'appearance',
    label: 'Appearance',
    shortLabel: 'Appearance',
    unit: '',
    type: 'text',
    sourceLabel: 'IEC 60422:2024 Table 3 / Table 5',
    testBasis: 'Visual inspection',
    healthyLabel: 'Clear, free from sediment and suspended matter',
    actionLabel: 'Dull, turbid, sediment or suspended matter observed',
  },
  inhibitor: {
    key: 'inhibitor',
    label: 'Inhibitor content',
    shortLabel: 'Inhibitor',
    unit: '%',
    higherIsBetter: true,
    good: 0.3,
    caution: 0.25,
    digits: 2,
    sourceLabel: 'IEC 60422:2024 Annex A.3 / Clause 13',
    testBasis: 'Practical re-inhibition band for aged oils',
    note:
      'The app stores measured inhibitor as % by weight, so this uses the typical 0.25%-0.35% aged-oil range instead of the Table 5 relative-to-original criterion.',
  },
  passivator: {
    key: 'passivator',
    label: 'Passivator content',
    shortLabel: 'Passivator',
    unit: 'mg/kg',
    higherIsBetter: true,
    good: 70,
    caution: 50,
    goodInclusive: false,
    digits: 0,
    sourceLabel: 'IEC 60422:2024 Table 5',
    testBasis: 'Passivator concentration in oil',
    note:
      'IEC treats >70 mg/kg as good only when stable. The app evaluates the captured concentration only; depletion rate still needs trend review.',
  },
  fal2: {
    key: 'fal2',
    label: '2-FAL',
    shortLabel: '2-FAL',
    unit: 'ppb',
    higherIsBetter: false,
    good: 100,
    caution: 1000,
    goodInclusive: false,
    digits: 0,
    sourceLabel: 'I.A.R. Gray guidance cited in open literature',
    testBasis: 'Paper ageing marker in oil',
    note:
      '0.1-1.0 ppm (100-1000 ppb) is treated as moderate deterioration / early warning. Values above 1.0 ppm are treated as action.',
  },
  methanol: {
    key: 'methanol',
    label: 'Methanol',
    shortLabel: 'Methanol',
    unit: 'ppm',
    higherIsBetter: false,
    good: 0.05,
    caution: 0.2,
    goodInclusive: false,
    digits: 3,
    sourceLabel: 'Jalbert et al. review (Energies 2019, Table 6)',
    testBasis: 'Cellulose degradation marker in oil',
    note:
      'Converted from Jalbert Table 6 bands of 0-50 ppb, 51-200 ppb, and >200 ppb into ppm for this app.',
  },
};

const SAMPLE_VALUE_RESOLVERS = {
  appearance: (sample) => sample?.appearance ?? '',
  inhibitor: (sample) => toNumber(sample?.inhibitor ?? sample?.Inhibitor),
  passivator: (sample) => toNumber(sample?.passivator ?? sample?.Passivator),
  fal2: (sample) => toNumber(sample?.fal2 ?? sample?.Furan),
  methanol: (sample) => toNumber(sample?.methanol ?? sample?.Methanol),
};

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).replace(/,/g, '.').trim();
  const direct = Number.parseFloat(normalized);
  if (Number.isFinite(direct)) {
    return direct;
  }

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:]/g, ' ')
    .replace(/\s+/g, ' ');
}

function isAppearanceHealthy(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  if (APPEARANCE_GOOD_VALUES.includes(normalized)) {
    return true;
  }

  if (APPEARANCE_ALERT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return false;
  }

  return normalized.includes('clear');
}

export function getSupplementaryReference(metricKey) {
  return SUPPLEMENTARY_OIL_REFERENCES[metricKey] || null;
}

export function getSupplementaryReferenceLineValue(metricKey) {
  const reference = getSupplementaryReference(metricKey);
  if (!reference || reference.type === 'text') {
    return null;
  }
  return reference.caution ?? reference.good ?? null;
}

export function getSupplementaryStatusSeverity(status) {
  if (status === 'healthy') return 10;
  if (status === 'monitor') return 50;
  if (status === 'action') return 85;
  return null;
}

function evaluateNumericMetric(metricKey, value, reference) {
  if (value === null) {
    return buildResult(metricKey, null, 'noData', reference);
  }

  if (reference.higherIsBetter) {
    const isHealthy = reference.goodInclusive === false ? value > reference.good : value >= reference.good;
    if (isHealthy) {
      return buildResult(metricKey, value, 'healthy', reference);
    }

    const isMonitor = reference.cautionInclusive === false ? value > reference.caution : value >= reference.caution;
    if (isMonitor) {
      return buildResult(metricKey, value, 'monitor', reference);
    }

    return buildResult(metricKey, value, 'action', reference);
  }

  const isHealthy = reference.goodInclusive === false ? value < reference.good : value <= reference.good;
  if (isHealthy) {
    return buildResult(metricKey, value, 'healthy', reference);
  }

  const isMonitor = reference.cautionInclusive === false ? value < reference.caution : value <= reference.caution;
  if (isMonitor) {
    return buildResult(metricKey, value, 'monitor', reference);
  }

  return buildResult(metricKey, value, 'action', reference);
}

function evaluateTextMetric(metricKey, value, reference) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return buildResult(metricKey, null, 'noData', reference);
  }

  if (metricKey === 'appearance' && isAppearanceHealthy(value)) {
    return buildResult(metricKey, String(value), 'healthy', reference);
  }

  return buildResult(metricKey, String(value), 'action', reference);
}

function buildResult(metricKey, value, status, reference) {
  return {
    key: metricKey,
    value,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    badgeVariant:
      status === 'healthy' ? 'success' : status === 'monitor' ? 'warning' : status === 'action' ? 'danger' : 'secondary',
    severity: getSupplementaryStatusSeverity(status),
    reference,
    healthyRangeLabel: getSupplementaryHealthyRangeLabel(reference),
    monitorRangeLabel: getSupplementaryMonitorRangeLabel(reference),
    actionRangeLabel: getSupplementaryActionRangeLabel(reference),
  };
}

export function evaluateSupplementaryOilMetric(metricKey, sample) {
  const reference = getSupplementaryReference(metricKey);
  if (!reference) {
    return null;
  }

  const value = SAMPLE_VALUE_RESOLVERS[metricKey]?.(sample);
  if (reference.type === 'text') {
    return evaluateTextMetric(metricKey, value, reference);
  }

  return evaluateNumericMetric(metricKey, value, reference);
}

export function getSupplementaryOilAssessment(sample) {
  const items = SUPPLEMENTARY_OIL_REFERENCE_ORDER.map((metricKey) =>
    evaluateSupplementaryOilMetric(metricKey, sample),
  ).filter(Boolean);

  const summary = items.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      if (item.status === 'healthy') accumulator.healthy += 1;
      if (item.status === 'monitor') accumulator.monitor += 1;
      if (item.status === 'action') accumulator.action += 1;
      if (item.status === 'noData') accumulator.noData += 1;
      return accumulator;
    },
    { total: 0, healthy: 0, monitor: 0, action: 0, noData: 0 },
  );

  return {
    items,
    summary,
    metrics: items.reduce((accumulator, item) => {
      accumulator[item.key] = item;
      return accumulator;
    }, {}),
  };
}

export function formatSupplementaryValue(value, reference, fallback = '-') {
  if (reference?.type === 'text') {
    return value ? String(value) : fallback;
  }

  const numericValue = toNumber(value);
  if (numericValue === null) {
    return fallback;
  }

  const digits = typeof reference?.digits === 'number' ? reference.digits : 0;
  return numericValue.toFixed(digits);
}

export function getSupplementaryHealthyRangeLabel(reference) {
  if (!reference) return '-';
  if (reference.type === 'text') {
    return reference.healthyLabel || 'Accepted';
  }
  if (reference.higherIsBetter) {
    return `${reference.goodInclusive === false ? '>' : '>='} ${formatSupplementaryValue(reference.good, reference)}`;
  }
  return `${reference.goodInclusive === false ? '<' : '<='} ${formatSupplementaryValue(reference.good, reference)}`;
}

export function getSupplementaryMonitorRangeLabel(reference) {
  if (!reference) return '-';
  if (reference.type === 'text') {
    return 'Not used';
  }
  if (reference.higherIsBetter) {
    return `${formatSupplementaryValue(reference.caution, reference)} to ${reference.goodInclusive === false ? '<=' : '<'} ${formatSupplementaryValue(reference.good, reference)}`;
  }
  return `${reference.goodInclusive === false ? '>=' : '>'} ${formatSupplementaryValue(reference.good, reference)} to ${formatSupplementaryValue(reference.caution, reference)}`;
}

export function getSupplementaryActionRangeLabel(reference) {
  if (!reference) return '-';
  if (reference.type === 'text') {
    return reference.actionLabel || 'Outside preferred appearance';
  }
  if (reference.higherIsBetter) {
    return `${reference.cautionInclusive === false ? '<=' : '<'} ${formatSupplementaryValue(reference.caution, reference)}`;
  }
  return `${reference.cautionInclusive === false ? '>=' : '>'} ${formatSupplementaryValue(reference.caution, reference)}`;
}
