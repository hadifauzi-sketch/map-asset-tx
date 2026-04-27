import { normaliseTestTypeForStorage } from '../testTypeUtils';
import {
  extractVoltageLevels,
  getActionRangeLabel,
  getHealthyRangeLabel,
  getMonitorRangeLabel,
} from './iec60422Profiles';

const DEFAULT_GROUP_KEY = 'medium';
const DEFAULT_LIMIT_PROFILE_KEY = 'inService';

export const IEC_61203_2025_STANDARD = {
  id: 'iec-61203-2025',
  label: 'IEC 61203:2025',
  edition: '2.0',
  publishedOn: '2025-05',
  scope: 'Synthetic organic esters - guidelines for maintenance and use in electrical equipment',
  validationNote:
    'Stored as an in-app working profile from IEC 61203:2025 synthetic ester guidance. Verify against your licensed copy before treating the limits as a compliance gate.',
};

export const IEC_61203_COMMISSIONING_PARAMETER_ORDER = [
  'appearance',
  'color',
  'breakdown',
  'waterContent',
  'acidity',
  'powerFactor',
  'firePoint',
];

export const IEC_61203_IN_SERVICE_PARAMETER_ORDER = [
  'color',
  'appearance',
  'breakdown',
  'waterContent',
  'acidity',
  'powerFactor',
  'inhibitor',
  'firePoint',
  'interfacialTension',
];

export const IEC_61203_PARAMETER_ORDER = IEC_61203_IN_SERVICE_PARAMETER_ORDER;

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
  appearance: {
    key: 'appearance',
    label: 'Appearance',
    shortLabel: 'Appearance',
    unit: '',
    type: 'text',
    testBasis: 'Visual assessment',
  },
  color: {
    key: 'color',
    label: 'Colour',
    shortLabel: 'Colour',
    unit: 'ISO 2049',
    higherIsBetter: false,
    testBasis: 'ISO 2049 / ASTM D1500, or ISO 2211 Hazen for unused liquid',
  },
  breakdown: {
    key: 'breakdown',
    label: 'Breakdown voltage',
    shortLabel: 'BDV',
    unit: 'kV',
    higherIsBetter: true,
    testBasis: 'IEC 60156',
  },
  waterContent: {
    key: 'waterContent',
    label: 'Water content',
    shortLabel: 'Water',
    unit: 'mg/kg',
    higherIsBetter: false,
    testBasis: 'IEC 60814',
  },
  acidity: {
    key: 'acidity',
    label: 'Acidity',
    shortLabel: 'Acidity',
    unit: 'mg KOH/g',
    higherIsBetter: false,
    testBasis: 'IEC 62021-3',
  },
  powerFactor: {
    key: 'powerFactor',
    label: 'Dielectric dissipation factor at 90 deg C',
    shortLabel: 'DDF / PF',
    unit: '',
    higherIsBetter: false,
    testBasis: 'IEC 60247',
  },
  inhibitor: {
    key: 'inhibitor',
    label: 'Additive antioxidant content',
    shortLabel: 'Inhibitor',
    unit: '% of original',
    higherIsBetter: true,
    testBasis: 'IEC 60666 / manufacturer guidance',
    note: 'IEC 61203 Table 5 gives antioxidant content relative to the original value.',
  },
  firePoint: {
    key: 'firePoint',
    label: 'Fire point',
    shortLabel: 'Fire point',
    unit: 'deg C',
    higherIsBetter: true,
    testBasis: 'ISO 2592 or ASTM D92',
  },
  interfacialTension: {
    key: 'interfacialTension',
    label: 'Interfacial tension',
    shortLabel: 'IFT',
    unit: 'mN/m',
    higherIsBetter: true,
    testBasis: 'IEC 62961',
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

const CLEAR_APPEARANCE_ACCEPTED_VALUES = [
  'clear',
  'clear and pale',
  'clear pale',
  'clear, free from sediment',
  'clear free from sediment',
  'clear free from sediment matter',
  'clear, free from sediment and suspended matter',
  'clear free from sediment and suspended matter',
  'free from sediment',
  'without visible contamination',
  'no visible contamination',
  'pass',
];

const COMMISSIONING_BASE_LIMITS = {
  appearance: createTextLimit('appearance', {
    expectedLabel: 'Clear, free from sediment matter',
    actionLabel: 'Not clear or sediment present',
    acceptedValues: CLEAR_APPEARANCE_ACCEPTED_VALUES,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
  color: createLimit('color', {
    good: 1,
    caution: null,
    digits: 1,
    statusLabels: COMMISSIONING_STATUS_LABELS,
    note: 'IEC 61203 Table 3 also gives ISO 2211 Max. 300 Hazen for unused liquid colour.',
  }),
  acidity: createLimit('acidity', {
    good: 0.08,
    caution: null,
    digits: 2,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
  powerFactor: createLimit('powerFactor', {
    good: 0.1,
    caution: null,
    digits: 2,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
  firePoint: createLimit('firePoint', {
    good: 300,
    caution: null,
    digits: 0,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
};

export const IEC_61203_COMMISSIONING_VOLTAGE_GROUPS = {
  low: {
    key: 'low',
    code: 'C',
    label: 'Category C',
    shortLabel: '<= 72.5 kV',
    minKv: null,
    maxKv: 72.5,
    description: 'Synthetic ester in new equipment prior to first energization.',
    limits: {
      ...COMMISSIONING_BASE_LIMITS,
      breakdown: createLimit('breakdown', {
        good: 55,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      waterContent: createLimit('waterContent', {
        good: 200,
        caution: null,
        digits: 0,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
    },
  },
  medium: {
    key: 'medium',
    code: 'B',
    label: 'Category B',
    shortLabel: '72.5-170 kV',
    minKv: 72.5,
    maxKv: 170,
    description: 'Synthetic ester in new equipment prior to first energization.',
    limits: {
      ...COMMISSIONING_BASE_LIMITS,
      breakdown: createLimit('breakdown', {
        good: 60,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      waterContent: createLimit('waterContent', {
        good: 150,
        caution: null,
        digits: 0,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
    },
  },
  high: {
    key: 'high',
    code: 'A',
    label: 'Category A',
    shortLabel: '> 170 kV',
    minKv: 170,
    maxKv: null,
    description: 'Synthetic ester in new equipment prior to first energization.',
    limits: {
      ...COMMISSIONING_BASE_LIMITS,
      breakdown: createLimit('breakdown', {
        good: 60,
        caution: null,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
      waterContent: createLimit('waterContent', {
        good: 100,
        caution: null,
        digits: 0,
        statusLabels: COMMISSIONING_STATUS_LABELS,
      }),
    },
  },
};

const IN_SERVICE_COMMON_LIMITS = {
  color: createLimit('color', {
    good: 2,
    caution: 3.5,
    goodInclusive: false,
    cautionInclusive: false,
    digits: 1,
  }),
  appearance: createTextLimit('appearance', {
    expectedLabel: 'Clear, free from sediment and suspended matter',
    actionLabel: 'Lightly turbid or turbid',
    acceptedValues: CLEAR_APPEARANCE_ACCEPTED_VALUES,
  }),
  inhibitor: createLimit('inhibitor', {
    good: 60,
    caution: 40,
    digits: 0,
  }),
  firePoint: createLimit('firePoint', {
    good: 300,
    caution: null,
    digits: 0,
    note: 'IEC 61203 Table 5 notes this parameter is only applicable if K-class as defined in IEC 61039 is required.',
  }),
  interfacialTension: createLimit('interfacialTension', {
    good: 22,
    caution: 16,
    goodInclusive: false,
    digits: 0,
  }),
};

export const IEC_61203_IN_SERVICE_VOLTAGE_GROUPS = {
  low: {
    key: 'low',
    code: 'C',
    label: 'Category C',
    shortLabel: '<= 72.5 kV',
    minKv: null,
    maxKv: 72.5,
    description: 'Power transformers / reactors for MV/LV applications up to and including 72.5 kV.',
    limits: {
      ...IN_SERVICE_COMMON_LIMITS,
      breakdown: createLimit('breakdown', { good: 40, caution: 30, goodInclusive: false, digits: 0 }),
      waterContent: createLimit('waterContent', { good: 200, caution: 400, goodInclusive: false, digits: 0 }),
      acidity: createLimit('acidity', { good: 0.5, caution: 1.0, goodInclusive: false, digits: 2 }),
      powerFactor: createLimit('powerFactor', { good: 0.15, caution: 0.5, goodInclusive: false, digits: 2 }),
    },
  },
  medium: {
    key: 'medium',
    code: 'B',
    label: 'Category B',
    shortLabel: '72.5-170 kV',
    minKv: 72.5,
    maxKv: 170,
    description: 'Power transformers / reactors above 72.5 kV up to and including 170 kV.',
    limits: {
      ...IN_SERVICE_COMMON_LIMITS,
      breakdown: createLimit('breakdown', { good: 50, caution: 40, goodInclusive: false, digits: 0 }),
      waterContent: createLimit('waterContent', { good: 150, caution: 350, goodInclusive: false, digits: 0 }),
      acidity: createLimit('acidity', { good: 0.5, caution: 1.0, goodInclusive: false, digits: 2 }),
      powerFactor: createLimit('powerFactor', { good: 0.15, caution: 0.5, goodInclusive: false, digits: 2 }),
    },
  },
  high: {
    key: 'high',
    code: 'A',
    label: 'Category A',
    shortLabel: '> 170 kV',
    minKv: 170,
    maxKv: null,
    description: 'Power transformers / reactors above 170 kV or critical applications.',
    limits: {
      ...IN_SERVICE_COMMON_LIMITS,
      breakdown: createLimit('breakdown', { good: 60, caution: 50, goodInclusive: false, digits: 0 }),
      waterContent: createLimit('waterContent', { good: 100, caution: 300, goodInclusive: false, digits: 0 }),
      acidity: createLimit('acidity', { good: 0.15, caution: 0.3, goodInclusive: false, digits: 2 }),
      powerFactor: createLimit('powerFactor', { good: 0.15, caution: 0.3, goodInclusive: false, digits: 2 }),
    },
  },
};

export const IEC_61203_LIMIT_PROFILES = {
  inService: {
    key: 'inService',
    label: 'Routine / in-service synthetic ester',
    shortLabel: 'Routine',
    sourceLabel: 'IEC 61203:2025 Table 5',
    description: 'Synthetic ester already in service, assessed as Good / Fair / Poor.',
    voltageGroups: IEC_61203_IN_SERVICE_VOLTAGE_GROUPS,
    parameterOrder: IEC_61203_IN_SERVICE_PARAMETER_ORDER,
    statusLabels: IN_SERVICE_STATUS_LABELS,
    columnLabels: IN_SERVICE_STATUS_LABELS,
  },
  commissioning: {
    key: 'commissioning',
    label: 'Prior to first energization synthetic ester',
    shortLabel: 'Commissioning',
    sourceLabel: 'IEC 61203:2025 Table 3',
    description: 'Synthetic ester after filling in new electrical equipment prior to first energization.',
    voltageGroups: IEC_61203_COMMISSIONING_VOLTAGE_GROUPS,
    parameterOrder: IEC_61203_COMMISSIONING_PARAMETER_ORDER,
    statusLabels: COMMISSIONING_STATUS_LABELS,
    columnLabels: {
      healthy: 'Limit',
      monitor: 'Monitor',
      action: 'Outside limit',
      noData: 'No data',
    },
  },
};

export const IEC_61203_VOLTAGE_GROUPS = IEC_61203_IN_SERVICE_VOLTAGE_GROUPS;

const SAMPLE_VALUE_RESOLVERS = {
  appearance: (sample) => sample?.appearance ?? sample?.Appearance ?? '',
  color: (sample) => toNumber(sample?.color ?? sample?.Color),
  breakdown: (sample) => toNumber(sample?.breakdown ?? sample?.BDV),
  waterContent: (sample) => toNumber(sample?.waterContent ?? sample?.Moisture),
  acidity: (sample) => toNumber(sample?.acidity ?? sample?.Acidity),
  powerFactor: (sample) => toNumber(sample?.powerFactor ?? sample?.PowerFactor),
  inhibitor: (sample) => toNumber(sample?.inhibitor ?? sample?.Inhibitor),
  firePoint: (sample) => toNumber(sample?.firePoint ?? sample?.FirePoint),
  interfacialTension: (sample) => toNumber(sample?.interfacialTension ?? sample?.IFT),
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
    .replace(/[\u2013\u2014]/g, '-')
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

export function resolveIec61203LimitProfile(sampleOrTestType) {
  const testType = normaliseTestTypeForStorage(getTestTypeFromContext(sampleOrTestType));
  if (testType === 'Commissioning') {
    return IEC_61203_LIMIT_PROFILES.commissioning;
  }
  return IEC_61203_LIMIT_PROFILES[DEFAULT_LIMIT_PROFILE_KEY];
}

export function resolveIec61203Context(transformerOrVoltage, sampleOrTestType) {
  const voltageInput =
    transformerOrVoltage && typeof transformerOrVoltage === 'object'
      ? transformerOrVoltage.voltage
      : transformerOrVoltage;

  const limitProfile = resolveIec61203LimitProfile(sampleOrTestType);
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
    standard: IEC_61203_2025_STANDARD,
    limitProfile,
    limitProfileKey: limitProfile.key,
    limitProfileGroups: voltageGroups,
    parameterOrder: limitProfile.parameterOrder,
    testType,
    oilType: 'Synthetic Ester',
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

export function getIec61203Limits(transformerOrVoltage, sampleOrTestType) {
  return resolveIec61203Context(transformerOrVoltage, sampleOrTestType).profile.limits;
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

export function evaluateIec61203MetricWithLimit(metricKey, value, limit, context) {
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

export function getIec61203Assessment(sample, transformerOrVoltage) {
  const context = resolveIec61203Context(transformerOrVoltage, sample);
  const parameterOrder = context.parameterOrder || IEC_61203_PARAMETER_ORDER;
  const items = parameterOrder
    .map((metricKey) =>
      evaluateIec61203MetricWithLimit(
        metricKey,
        SAMPLE_VALUE_RESOLVERS[metricKey]?.(sample),
        context.profile.limits[metricKey],
        context,
      ),
    )
    .filter(Boolean);

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
