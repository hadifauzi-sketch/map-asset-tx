import { normaliseTestTypeForStorage } from '../testTypeUtils';
import { resolveAtOperatingTempValue } from '../waterContentCorrection';

const DEFAULT_GROUP_KEY = 'medium';
const DEFAULT_LIMIT_PROFILE_KEY = 'inService';

export const IEC_60422_2024_STANDARD = {
  id: 'iec-60422-2024',
  label: 'IEC 60422:2024',
  edition: '5.0',
  publishedOn: '2024-07-18',
  scope: 'Mineral insulating oils in electrical equipment - supervision and maintenance guidance',
  validationNote:
    'Stored as an in-app working profile so the limits can be reused across dashboards and oil-test results. Verify against your licensed IEC 60422:2024 copy before treating the limits as a compliance gate.',
};

export const IEC_60422_PARAMETER_ORDER = [
  'breakdown',
  'waterContent',
  'acidity',
  'powerFactor',
  'interfacialTension',
  'color',
  'copperCorrosive',
  'dbds',
  'pcb',
];

const IN_SERVICE_STATUS_LABELS = {
  healthy: 'Good',
  monitor: 'Fair',
  action: 'Poor',
  noData: 'No data',
};

const COMMISSIONING_STATUS_LABELS = {
  healthy: 'Pass',
  monitor: 'Monitor',
  action: 'Outside limit',
  noData: 'No data',
};

const METRIC_META = {
  breakdown: {
    key: 'breakdown',
    label: 'Breakdown voltage',
    shortLabel: 'BDV',
    unit: 'kV',
    higherIsBetter: true,
    testBasis: 'IEC 60156, 2.5 mm gap',
  },
  waterContent: {
    key: 'waterContent',
    label: 'Water content',
    shortLabel: 'Water',
    unit: 'ppm',
    higherIsBetter: false,
    testBasis: 'IEC 60814',
  },
  acidity: {
    key: 'acidity',
    label: 'Acidity',
    shortLabel: 'Acidity',
    unit: 'mg KOH/g',
    higherIsBetter: false,
    testBasis: 'IEC 62021-2 or IEC 62021-1',
  },
  powerFactor: {
    key: 'powerFactor',
    label: 'Dielectric dissipation factor / power factor',
    shortLabel: 'DDF / PF',
    unit: '',
    higherIsBetter: false,
    testBasis: 'IEC 60247 at 90 C and 40 Hz to 60 Hz',
  },
  interfacialTension: {
    key: 'interfacialTension',
    label: 'Interfacial tension',
    shortLabel: 'IFT',
    unit: 'mN/m',
    higherIsBetter: true,
    testBasis: 'IEC 62961 or ASTM D971',
  },
  color: {
    key: 'color',
    label: 'Colour',
    shortLabel: 'Colour',
    unit: 'ISO 2049',
    higherIsBetter: false,
    testBasis: 'ISO 2049 or ASTM D1500',
  },
  copperCorrosive: {
    key: 'copperCorrosive',
    label: 'Corrosive sulphur',
    shortLabel: 'Sulphur',
    unit: '',
    type: 'text',
    testBasis: 'IEC 62535 / DIN 51353',
  },
  dbds: {
    key: 'dbds',
    label: 'DBDS content',
    shortLabel: 'DBDS',
    unit: 'mg/kg',
    higherIsBetter: false,
    testBasis: 'IEC 62697-1',
  },
  pcb: {
    key: 'pcb',
    label: 'Total PCBs content',
    shortLabel: 'PCBs',
    unit: 'mg/kg',
    higherIsBetter: false,
    testBasis: 'IEC 61619',
  },
};

function createLimit(metricKey, overrides) {
  return {
    ...METRIC_META[metricKey],
    statusLabels: IN_SERVICE_STATUS_LABELS,
    ...overrides,
  };
}

function createTextLimit(metricKey, overrides) {
  return createLimit(metricKey, {
    type: 'text',
    good: null,
    caution: null,
    ...overrides,
  });
}

const NON_CORROSIVE_ACCEPTED_VALUES = [
  'no',
  'none',
  '0',
  'false',
  'negative',
  'pass',
  'passed',
  'absent',
  'not detected',
  'non-corrosive',
  'non corrosive',
  'not corrosive',
  'not potentially corrosive',
  '1a',
  '1b',
];

export const IEC_60422_IN_SERVICE_VOLTAGE_GROUPS = {
  low: {
    key: 'low',
    code: 'C',
    label: 'Up to 72.5 kV',
    shortLabel: '<= 72.5 kV',
    minKv: null,
    maxKv: 72.5,
    description: 'Distribution and lower-voltage transformer class',
    limits: {
      color: createLimit('color', { good: 2, caution: 6, goodInclusive: false, digits: 1 }),
      breakdown: createLimit('breakdown', { good: 40, caution: 30, goodInclusive: false }),
      waterContent: createLimit('waterContent', { good: 30, caution: 40, goodInclusive: false }),
      acidity: createLimit('acidity', { good: 0.15, caution: 0.3, goodInclusive: false, digits: 2 }),
      powerFactor: createLimit('powerFactor', { good: 0.1, caution: 0.5, goodInclusive: false, digits: 2 }),
      interfacialTension: createLimit('interfacialTension', { good: 25, caution: 20, goodInclusive: false }),
      copperCorrosive: createTextLimit('copperCorrosive', {
        expectedLabel: 'Non-corrosive and not potentially corrosive',
        actionLabel: 'Corrosive or potentially corrosive',
        acceptedValues: NON_CORROSIVE_ACCEPTED_VALUES,
      }),
      pcb: createLimit('pcb', { good: 2, caution: null, goodInclusive: false, digits: 1 }),
    },
  },
  medium: {
    key: 'medium',
    code: 'B',
    label: '72.5 to 170 kV',
    shortLabel: '72.5-170 kV',
    minKv: 72.5,
    maxKv: 170,
    description: 'Sub-transmission and transmission transformer class',
    limits: {
      color: createLimit('color', { good: 2, caution: 6, goodInclusive: false, digits: 1 }),
      breakdown: createLimit('breakdown', { good: 50, caution: 40, goodInclusive: false }),
      waterContent: createLimit('waterContent', { good: 20, caution: 30, goodInclusive: false }),
      acidity: createLimit('acidity', { good: 0.1, caution: 0.2, goodInclusive: false, digits: 2 }),
      powerFactor: createLimit('powerFactor', { good: 0.1, caution: 0.5, goodInclusive: false, digits: 2 }),
      interfacialTension: createLimit('interfacialTension', { good: 25, caution: 20, goodInclusive: false }),
      copperCorrosive: createTextLimit('copperCorrosive', {
        expectedLabel: 'Non-corrosive and not potentially corrosive',
        actionLabel: 'Corrosive or potentially corrosive',
        acceptedValues: NON_CORROSIVE_ACCEPTED_VALUES,
      }),
      pcb: createLimit('pcb', { good: 2, caution: null, goodInclusive: false, digits: 1 }),
    },
  },
  high: {
    key: 'high',
    code: 'A',
    label: 'Above 170 kV',
    shortLabel: '> 170 kV',
    minKv: 170,
    maxKv: null,
    description: 'EHV transformer class',
    limits: {
      color: createLimit('color', { good: 2, caution: 6, goodInclusive: false, digits: 1 }),
      breakdown: createLimit('breakdown', { good: 60, caution: 50, goodInclusive: false }),
      waterContent: createLimit('waterContent', { good: 15, caution: 20, goodInclusive: false }),
      acidity: createLimit('acidity', { good: 0.1, caution: 0.15, goodInclusive: false, digits: 2 }),
      powerFactor: createLimit('powerFactor', { good: 0.1, caution: 0.2, goodInclusive: false, digits: 2 }),
      interfacialTension: createLimit('interfacialTension', { good: 25, caution: 20, goodInclusive: false }),
      copperCorrosive: createTextLimit('copperCorrosive', {
        expectedLabel: 'Non-corrosive and not potentially corrosive',
        actionLabel: 'Corrosive or potentially corrosive',
        acceptedValues: NON_CORROSIVE_ACCEPTED_VALUES,
      }),
      pcb: createLimit('pcb', { good: 2, caution: null, goodInclusive: false, digits: 1 }),
    },
  },
};

export const IEC_60422_COMMISSIONING_VOLTAGE_GROUPS = {
  low: {
    ...IEC_60422_IN_SERVICE_VOLTAGE_GROUPS.low,
    limits: {
      color: createLimit('color', {
        good: 2,
        caution: null,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      breakdown: createLimit('breakdown', {
        good: 55,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      waterContent: createLimit('waterContent', {
        good: 20,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
        note: 'For transformers under 72.5 kV class, IEC notes that the maximum water content can be agreed between supplier and user depending on local circumstances.',
      }),
      acidity: createLimit('acidity', {
        good: 0.03,
        caution: null,
        digits: 2,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      powerFactor: createLimit('powerFactor', {
        good: 0.015,
        caution: null,
        digits: 3,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      interfacialTension: createLimit('interfacialTension', {
        good: 35,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      copperCorrosive: createTextLimit('copperCorrosive', {
        expectedLabel: 'Non-corrosive',
        actionLabel: 'Corrosive',
        acceptedValues: NON_CORROSIVE_ACCEPTED_VALUES,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      dbds: createLimit('dbds', {
        good: 5,
        caution: null,
        goodInclusive: false,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      pcb: createLimit('pcb', {
        good: 2,
        caution: null,
        goodInclusive: false,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
    },
  },
  medium: {
    ...IEC_60422_IN_SERVICE_VOLTAGE_GROUPS.medium,
    limits: {
      color: createLimit('color', {
        good: 2,
        caution: null,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      breakdown: createLimit('breakdown', {
        good: 60,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      waterContent: createLimit('waterContent', {
        good: 10,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      acidity: createLimit('acidity', {
        good: 0.03,
        caution: null,
        digits: 2,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      powerFactor: createLimit('powerFactor', {
        good: 0.015,
        caution: null,
        digits: 3,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      interfacialTension: createLimit('interfacialTension', {
        good: 35,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      copperCorrosive: createTextLimit('copperCorrosive', {
        expectedLabel: 'Non-corrosive',
        actionLabel: 'Corrosive',
        acceptedValues: NON_CORROSIVE_ACCEPTED_VALUES,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      dbds: createLimit('dbds', {
        good: 5,
        caution: null,
        goodInclusive: false,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      pcb: createLimit('pcb', {
        good: 2,
        caution: null,
        goodInclusive: false,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
    },
  },
  high: {
    ...IEC_60422_IN_SERVICE_VOLTAGE_GROUPS.high,
    limits: {
      color: createLimit('color', {
        good: 2,
        caution: null,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      breakdown: createLimit('breakdown', {
        good: 60,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      waterContent: createLimit('waterContent', {
        good: 10,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      acidity: createLimit('acidity', {
        good: 0.03,
        caution: null,
        digits: 2,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      powerFactor: createLimit('powerFactor', {
        good: 0.01,
        caution: null,
        digits: 3,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      interfacialTension: createLimit('interfacialTension', {
        good: 35,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      copperCorrosive: createTextLimit('copperCorrosive', {
        expectedLabel: 'Non-corrosive',
        actionLabel: 'Corrosive',
        acceptedValues: NON_CORROSIVE_ACCEPTED_VALUES,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      dbds: createLimit('dbds', {
        good: 5,
        caution: null,
        goodInclusive: false,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      pcb: createLimit('pcb', {
        good: 2,
        caution: null,
        goodInclusive: false,
        digits: 1,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
    },
  },
};

export const IEC_60422_LIMIT_PROFILES = {
  inService: {
    key: 'inService',
    label: 'Routine / in-service oil',
    shortLabel: 'Routine',
    sourceLabel: 'IEC 60422:2024 Table 5',
    description: 'Transformer and reactor oil already in service, assessed as Good / Fair / Poor.',
    voltageGroups: IEC_60422_IN_SERVICE_VOLTAGE_GROUPS,
    statusLabels: IN_SERVICE_STATUS_LABELS,
    columnLabels: IN_SERVICE_STATUS_LABELS,
  },
  commissioning: {
    key: 'commissioning',
    label: 'Commissioning / prior to first energization',
    shortLabel: 'Commissioning',
    sourceLabel: 'IEC 60422:2024 Table 3',
    description: 'Mineral insulating oil after filling in new electrical equipment before first energization at site.',
    voltageGroups: IEC_60422_COMMISSIONING_VOLTAGE_GROUPS,
    statusLabels: COMMISSIONING_STATUS_LABELS,
    columnLabels: {
      healthy: 'Limit',
      monitor: 'Monitor',
      action: 'Outside limit',
      noData: 'No data',
    },
  },
};

export const IEC_60422_VOLTAGE_GROUPS = IEC_60422_IN_SERVICE_VOLTAGE_GROUPS;

const SAMPLE_VALUE_RESOLVERS = {
  breakdown: (sample) => toNumber(sample?.breakdown ?? sample?.BDV),
  waterContent: (sample) => {
    const raw = toNumber(sample?.waterContent ?? sample?.Moisture);
    if (raw === null) return null;
    const basis = sample?.waterContentBasis ?? sample?.water_content_basis ?? null;
    const samplingTemperatureC = sample?.waterContentTemperature ?? sample?.water_content_temperature ?? null;
    return resolveAtOperatingTempValue({ value: raw, basis, samplingTemperatureC });
  },
  acidity: (sample) => toNumber(sample?.acidity ?? sample?.Acidity),
  powerFactor: (sample) => toNumber(sample?.powerFactor ?? sample?.PowerFactor),
  interfacialTension: (sample) => toNumber(sample?.interfacialTension ?? sample?.IFT),
  color: (sample) => toNumber(sample?.color ?? sample?.Color),
  copperCorrosive: (sample) => sample?.copperCorrosive ?? sample?.CopperCorrosive ?? '',
  dbds: (sample) => toNumber(sample?.dbds ?? sample?.DBDS),
  pcb: (sample) => toNumber(sample?.pcb ?? sample?.PCB),
};

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const text = String(value).replace(/,/g, '.').trim();
  const directParse = Number.parseFloat(text);
  if (Number.isFinite(directParse)) {
    return directParse;
  }

  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTextValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function hasTextValue(value) {
  return normalizeTextValue(value) !== '';
}

function isAcceptedTextValue(value, limit) {
  const normalizedValue = normalizeTextValue(value);
  const acceptedValues = Array.isArray(limit?.acceptedValues) ? limit.acceptedValues : [];
  return acceptedValues.some((acceptedValue) => normalizedValue === normalizeTextValue(acceptedValue));
}

function getTestTypeFromContext(sampleOrTestType) {
  if (typeof sampleOrTestType === 'string') {
    return sampleOrTestType;
  }

  if (sampleOrTestType && typeof sampleOrTestType === 'object') {
    return sampleOrTestType.testType ?? sampleOrTestType.type ?? sampleOrTestType.test_type ?? '';
  }

  return '';
}

export function resolveIec60422LimitProfile(sampleOrTestType) {
  const testType = normaliseTestTypeForStorage(getTestTypeFromContext(sampleOrTestType));
  if (testType === 'Commissioning') {
    return IEC_60422_LIMIT_PROFILES.commissioning;
  }
  return IEC_60422_LIMIT_PROFILES[DEFAULT_LIMIT_PROFILE_KEY];
}

export function extractVoltageLevels(voltageValue) {
  if (voltageValue === null || voltageValue === undefined) {
    return [];
  }

  const matches = String(voltageValue)
    .replace(/,/g, '.')
    .match(/\d+(?:\.\d+)?/g);

  if (!matches) {
    return [];
  }

  return matches
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function resolveIec60422Context(transformerOrVoltage, sampleOrTestType) {
  const voltageInput =
    transformerOrVoltage && typeof transformerOrVoltage === 'object'
      ? transformerOrVoltage.voltage
      : transformerOrVoltage;

  const limitProfile = resolveIec60422LimitProfile(sampleOrTestType);
  const voltageGroups = limitProfile.voltageGroups;
  const voltageLevels = extractVoltageLevels(voltageInput);
  const highestVoltageKv = voltageLevels.length ? Math.max(...voltageLevels) : null;

  let groupKey = DEFAULT_GROUP_KEY;
  let resolvedFromVoltage = true;

  if (highestVoltageKv === null) {
    resolvedFromVoltage = false;
  } else if (highestVoltageKv <= 72.5) {
    groupKey = 'low';
  } else if (highestVoltageKv <= 170) {
    groupKey = 'medium';
  } else {
    groupKey = 'high';
  }

  const profile = voltageGroups[groupKey];
  const testType = normaliseTestTypeForStorage(getTestTypeFromContext(sampleOrTestType));

  return {
    standard: IEC_60422_2024_STANDARD,
    limitProfile,
    limitProfileKey: limitProfile.key,
    limitProfileGroups: voltageGroups,
    testType,
    groupKey,
    profile,
    voltageInput: voltageInput || '',
    voltageLevels,
    highestVoltageKv,
    resolvedFromVoltage,
    usedFallback: !resolvedFromVoltage,
    fallbackProfile: DEFAULT_GROUP_KEY,
  };
}

export function getIec60422Limits(transformerOrVoltage, sampleOrTestType) {
  return resolveIec60422Context(transformerOrVoltage, sampleOrTestType).profile.limits;
}

export function evaluateIec60422Metric(metricKey, value, transformerOrVoltage, sampleOrTestType) {
  const context = resolveIec60422Context(transformerOrVoltage, sampleOrTestType);
  const limit = context.profile.limits[metricKey];
  return evaluateIec60422MetricWithLimit(metricKey, value, limit, context);
}

function isWithinGoodLimit(numericValue, limit) {
  if (limit.higherIsBetter) {
    return limit.goodInclusive === false ? numericValue > limit.good : numericValue >= limit.good;
  }
  return limit.goodInclusive === false ? numericValue < limit.good : numericValue <= limit.good;
}

function isWithinCautionLimit(numericValue, limit) {
  if (limit.caution === null || limit.caution === undefined) {
    return false;
  }

  if (limit.higherIsBetter) {
    return limit.cautionInclusive === false ? numericValue > limit.caution : numericValue >= limit.caution;
  }
  return limit.cautionInclusive === false ? numericValue < limit.caution : numericValue <= limit.caution;
}

function buildMetricResult(metricKey, value, status, limit, context, overrides = {}) {
  const labels = limit.statusLabels || context.limitProfile?.statusLabels || IN_SERVICE_STATUS_LABELS;
  const badgeVariant =
    overrides.badgeVariant ||
    (status === 'healthy' ? 'success' : status === 'monitor' ? 'warning' : status === 'action' ? 'danger' : 'secondary');

  return {
    key: metricKey,
    value,
    status,
    statusLabel: overrides.statusLabel || labels[status] || status,
    badgeVariant,
    severity: overrides.severity ?? null,
    limit,
    context,
    healthyRangeLabel: getHealthyRangeLabel(limit),
    monitorRangeLabel: getMonitorRangeLabel(limit),
    actionRangeLabel: getActionRangeLabel(limit),
  };
}

function evaluateTextMetric(metricKey, value, limit, context) {
  if (!hasTextValue(value)) {
    return buildMetricResult(metricKey, null, 'no-data', limit, context);
  }

  if (isAcceptedTextValue(value, limit)) {
    return buildMetricResult(metricKey, String(value), 'healthy', limit, context, {
      severity: 10,
    });
  }

  return buildMetricResult(metricKey, String(value), 'action', limit, context, {
    severity: 85,
  });
}

function evaluateIec60422MetricWithLimit(metricKey, value, limit, context) {
  if (!limit) {
    return null;
  }

  if (limit.type === 'text') {
    return evaluateTextMetric(metricKey, value, limit, context);
  }

  const numericValue = toNumber(value);

  if (numericValue === null) {
    return buildMetricResult(metricKey, null, 'no-data', limit, context);
  }

  if (isWithinGoodLimit(numericValue, limit)) {
    return buildMetricResult(metricKey, numericValue, 'healthy', limit, context, {
      severity: 10,
    });
  }

  if (isWithinCautionLimit(numericValue, limit)) {
    return buildMetricResult(metricKey, numericValue, 'monitor', limit, context, {
      severity: 50,
    });
  }

  return buildMetricResult(metricKey, numericValue, 'action', limit, context, {
    severity: 85,
  });
}

export function getIec60422Assessment(sample, transformerOrVoltage) {
  const context = resolveIec60422Context(transformerOrVoltage, sample);
  const items = IEC_60422_PARAMETER_ORDER.map((metricKey) =>
    evaluateIec60422MetricWithLimit(
      metricKey,
      SAMPLE_VALUE_RESOLVERS[metricKey]?.(sample),
      context.profile.limits[metricKey],
      context,
    ),
  ).filter(Boolean);

  const summary = items.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      if (item.status === 'healthy') accumulator.healthy += 1;
      if (item.status === 'monitor') accumulator.monitor += 1;
      if (item.status === 'action') accumulator.action += 1;
      if (item.status === 'no-data') accumulator.noData += 1;
      return accumulator;
    },
    { total: 0, healthy: 0, monitor: 0, action: 0, noData: 0 },
  );

  return {
    ...context,
    sampleDate: sample?.testDate || sample?.date || null,
    items,
    summary,
    metrics: items.reduce((accumulator, item) => {
      accumulator[item.key] = item;
      return accumulator;
    }, {}),
  };
}

export function formatIecValue(value, limit, fallback = '-') {
  if (limit?.type === 'text') {
    return hasTextValue(value) ? String(value) : fallback;
  }

  const numericValue = toNumber(value);
  if (numericValue === null) {
    return fallback;
  }
  const digits = getDigits(limit);
  return numericValue.toFixed(digits);
}

function getComparatorLabel(limit, thresholdKey) {
  const inclusive = limit[`${thresholdKey}Inclusive`] !== false;
  if (limit.higherIsBetter) {
    return inclusive ? '>=' : '>';
  }
  return inclusive ? '<=' : '<';
}

export function getHealthyRangeLabel(limit) {
  if (!limit) return '-';
  if (limit.type === 'text') {
    return limit.expectedLabel || 'Accepted';
  }
  return `${getComparatorLabel(limit, 'good')} ${formatIecValue(limit.good, limit)}`;
}

export function getMonitorRangeLabel(limit) {
  if (!limit) return '-';
  if (limit.type === 'text' || limit.caution === null || limit.caution === undefined) {
    return 'Not used';
  }

  if (limit.higherIsBetter) {
    const upperComparator = limit.goodInclusive === false ? '<=' : '<';
    const lowerComparator = limit.cautionInclusive === false ? '>' : '>=';
    return `${lowerComparator} ${formatIecValue(limit.caution, limit)} to ${upperComparator} ${formatIecValue(limit.good, limit)}`;
  }

  const lowerComparator = limit.goodInclusive === false ? '>=' : '>';
  const upperComparator = limit.cautionInclusive === false ? '<' : '<=';
  return `${lowerComparator} ${formatIecValue(limit.good, limit)} to ${upperComparator} ${formatIecValue(limit.caution, limit)}`;
}

export function getActionRangeLabel(limit) {
  if (!limit) return '-';
  if (limit.type === 'text') {
    return limit.actionLabel || `Not ${limit.expectedLabel || 'accepted'}`;
  }

  const boundaryKey = limit.caution === null || limit.caution === undefined ? 'good' : 'caution';
  const boundaryValue = limit[boundaryKey];

  if (limit.higherIsBetter) {
    const comparator = boundaryKey === 'good' && limit.goodInclusive === false ? '<=' : '<';
    return `${comparator} ${formatIecValue(boundaryValue, limit)}`;
  }

  const comparator = boundaryKey === 'good' && limit.goodInclusive === false ? '>=' : '>';
  return `${comparator} ${formatIecValue(boundaryValue, limit)}`;
}

function getDigits(limit) {
  if (!limit) {
    return 1;
  }
  if (typeof limit.digits === 'number') {
    return limit.digits;
  }
  if (limit.unit === 'mg KOH/g') {
    return 2;
  }
  if (limit.key === 'powerFactor') {
    return 3;
  }
  if (limit.unit === 'ppm' || limit.unit === 'kV' || limit.unit === 'mN/m') {
    return 0;
  }
  return 1;
}
