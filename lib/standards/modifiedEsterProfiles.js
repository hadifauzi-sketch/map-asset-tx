import { normaliseTestTypeForStorage } from '../testTypeUtils';
import {
  extractVoltageLevels,
  getActionRangeLabel,
  getHealthyRangeLabel,
  getMonitorRangeLabel,
} from './iec60422Profiles';

const DEFAULT_GROUP_KEY = 'medium';
const DEFAULT_LIMIT_PROFILE_KEY = 'inService';

export const MODIFIED_ESTER_STANDARD = {
  id: 'modified-ester-working-limits',
  label: 'Modified / Blended Ester Working Limits',
  edition: '1.0',
  publishedOn: null,
  scope: 'Modified / blended ester insulating oil condition assessment',
  validationNote:
    'Stored as an in-app working profile using strict numeric modified / blended ester limits based on IEC 60422, IEC 61099, and IEC 62770 guidance. Verify against your site standard before treating the limits as a compliance gate.',
};

export const MODIFIED_ESTER_PARAMETER_ORDER = [
  'waterContent',
  'acidity',
  'breakdown',
  'powerFactor',
  'resistivity',
];

const IN_SERVICE_STATUS_LABELS = {
  healthy: 'Good',
  monitor: 'Fair',
  action: 'Poor',
  noData: 'No data',
};

const COMMISSIONING_STATUS_LABELS = {
  healthy: 'Good',
  monitor: 'Fair',
  action: 'Poor',
  noData: 'No data',
};

const METRIC_META = {
  waterContent: {
    key: 'waterContent',
    label: 'Moisture (KF)',
    shortLabel: 'Moisture',
    unit: 'ppm',
    higherIsBetter: false,
    testBasis: 'Karl Fischer moisture content',
  },
  acidity: {
    key: 'acidity',
    label: 'Acidity (TAN)',
    shortLabel: 'Acidity',
    unit: 'mg KOH/g',
    higherIsBetter: false,
    testBasis: 'Total acid number',
  },
  breakdown: {
    key: 'breakdown',
    label: 'Breakdown voltage',
    shortLabel: 'BDV',
    unit: 'kV',
    higherIsBetter: true,
    testBasis: 'IEC 60156',
  },
  powerFactor: {
    key: 'powerFactor',
    label: 'Power factor / tan delta at 90 deg C',
    shortLabel: 'PF',
    unit: '',
    higherIsBetter: false,
    testBasis: 'Dielectric dissipation factor at 90 deg C',
  },
  resistivity: {
    key: 'resistivity',
    label: 'Resistivity at 90 deg C',
    shortLabel: 'Resistivity',
    unit: 'GOhm-m',
    higherIsBetter: true,
    testBasis: 'Resistivity at 90 deg C',
    note: 'The app stores this as GOhm-m; 1 GOhm-m equals 1 x 10^9 Ohm-m.',
  },
};

function createLimit(metricKey, overrides) {
  return {
    ...METRIC_META[metricKey],
    statusLabels: IN_SERVICE_STATUS_LABELS,
    ...overrides,
  };
}

const IN_SERVICE_LIMITS = {
  waterContent: createLimit('waterContent', {
    good: 200,
    caution: 400,
    goodInclusive: false,
    digits: 0,
  }),
  acidity: createLimit('acidity', {
    good: 0.1,
    caution: 0.3,
    goodInclusive: false,
    digits: 2,
  }),
  breakdown: createLimit('breakdown', {
    good: 50,
    caution: 40,
    goodInclusive: false,
    digits: 0,
  }),
  powerFactor: createLimit('powerFactor', {
    good: 0.05,
    caution: 0.1,
    goodInclusive: false,
    digits: 2,
  }),
  resistivity: createLimit('resistivity', {
    good: 1,
    caution: 0.5,
    goodInclusive: false,
    digits: 1,
  }),
};

const COMMISSIONING_LIMITS = {
  waterContent: createLimit('waterContent', {
    good: 100,
    caution: 200,
    goodInclusive: false,
    digits: 0,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
  acidity: createLimit('acidity', {
    good: 0.06,
    caution: 0.1,
    goodInclusive: false,
    digits: 2,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
  breakdown: createLimit('breakdown', {
    good: 60,
    caution: 50,
    digits: 0,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
  powerFactor: createLimit('powerFactor', {
    good: 0.03,
    caution: 0.05,
    goodInclusive: false,
    digits: 2,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
  resistivity: createLimit('resistivity', {
    good: 5,
    caution: 1,
    digits: 1,
    statusLabels: COMMISSIONING_STATUS_LABELS,
  }),
};

function createVoltageGroups(limits, description) {
  return {
    low: {
      key: 'low',
      code: 'All',
      label: 'All voltage classes',
      shortLabel: '<= 72.5 kV',
      minKv: null,
      maxKv: 72.5,
      description,
      limits,
    },
    medium: {
      key: 'medium',
      code: 'All',
      label: 'All voltage classes',
      shortLabel: '72.5-170 kV',
      minKv: 72.5,
      maxKv: 170,
      description,
      limits,
    },
    high: {
      key: 'high',
      code: 'All',
      label: 'All voltage classes',
      shortLabel: '> 170 kV',
      minKv: 170,
      maxKv: null,
      description,
      limits,
    },
  };
}

export const MODIFIED_ESTER_IN_SERVICE_VOLTAGE_GROUPS = createVoltageGroups(
  IN_SERVICE_LIMITS,
  'Modified / blended ester in-service profile. Limits are not voltage split.',
);

export const MODIFIED_ESTER_COMMISSIONING_VOLTAGE_GROUPS = createVoltageGroups(
  COMMISSIONING_LIMITS,
  'Modified / blended ester prior-to-energization profile. Limits are not voltage split.',
);

export const MODIFIED_ESTER_LIMIT_PROFILES = {
  inService: {
    key: 'inService',
    label: 'Routine / in-service modified ester',
    shortLabel: 'Routine',
    sourceLabel: 'Modified / blended ester in-service limits (IEC 60422 / IEC 61099 / IEC 62770 basis)',
    description: 'Modified / blended ester already in service, assessed as Good / Fair / Poor.',
    voltageGroups: MODIFIED_ESTER_IN_SERVICE_VOLTAGE_GROUPS,
    parameterOrder: MODIFIED_ESTER_PARAMETER_ORDER,
    statusLabels: IN_SERVICE_STATUS_LABELS,
    columnLabels: IN_SERVICE_STATUS_LABELS,
  },
  commissioning: {
    key: 'commissioning',
    label: 'Prior to energization modified ester',
    shortLabel: 'Commissioning',
    sourceLabel: 'Modified / blended ester prior-to-energization limits (IEC 60422 / IEC 61099 / IEC 62770 basis)',
    description: 'Modified / blended ester before first energization, assessed as Good / Fair / Poor.',
    voltageGroups: MODIFIED_ESTER_COMMISSIONING_VOLTAGE_GROUPS,
    parameterOrder: MODIFIED_ESTER_PARAMETER_ORDER,
    statusLabels: COMMISSIONING_STATUS_LABELS,
    columnLabels: COMMISSIONING_STATUS_LABELS,
  },
};

export const MODIFIED_ESTER_VOLTAGE_GROUPS = MODIFIED_ESTER_IN_SERVICE_VOLTAGE_GROUPS;

const SAMPLE_VALUE_RESOLVERS = {
  waterContent: (sample) => toNumber(sample?.waterContent ?? sample?.Moisture),
  acidity: (sample) => toNumber(sample?.acidity ?? sample?.Acidity),
  breakdown: (sample) => toNumber(sample?.breakdown ?? sample?.BDV),
  powerFactor: (sample) => toNumber(sample?.powerFactor ?? sample?.PowerFactor),
  resistivity: (sample) => toNumber(sample?.resistivity ?? sample?.Resistivity),
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

function getTestTypeFromContext(sampleOrTestType) {
  if (typeof sampleOrTestType === 'string') {
    return sampleOrTestType;
  }

  if (sampleOrTestType && typeof sampleOrTestType === 'object') {
    return sampleOrTestType.testType ?? sampleOrTestType.type ?? sampleOrTestType.test_type ?? '';
  }

  return '';
}

export function resolveModifiedEsterLimitProfile(sampleOrTestType) {
  const testType = normaliseTestTypeForStorage(getTestTypeFromContext(sampleOrTestType));
  if (testType === 'Commissioning') {
    return MODIFIED_ESTER_LIMIT_PROFILES.commissioning;
  }
  return MODIFIED_ESTER_LIMIT_PROFILES[DEFAULT_LIMIT_PROFILE_KEY];
}

export function resolveModifiedEsterContext(transformerOrVoltage, sampleOrTestType) {
  const voltageInput =
    transformerOrVoltage && typeof transformerOrVoltage === 'object'
      ? transformerOrVoltage.voltage
      : transformerOrVoltage;

  const limitProfile = resolveModifiedEsterLimitProfile(sampleOrTestType);
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
    standard: MODIFIED_ESTER_STANDARD,
    limitProfile,
    limitProfileKey: limitProfile.key,
    limitProfileGroups: voltageGroups,
    parameterOrder: limitProfile.parameterOrder,
    testType,
    oilType: 'Modified Ester',
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

export function getModifiedEsterLimits(transformerOrVoltage, sampleOrTestType) {
  return resolveModifiedEsterContext(transformerOrVoltage, sampleOrTestType).profile.limits;
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

export function evaluateModifiedEsterMetricWithLimit(metricKey, value, limit, context) {
  if (!limit) {
    return null;
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

export function getModifiedEsterAssessment(sample, transformerOrVoltage) {
  const context = resolveModifiedEsterContext(transformerOrVoltage, sample);
  const parameterOrder = context.parameterOrder || MODIFIED_ESTER_PARAMETER_ORDER;
  const items = parameterOrder
    .map((metricKey) =>
      evaluateModifiedEsterMetricWithLimit(
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
