// Condensed DGA + oil-quality result for one transformer, used by the 3D view's
// result panel. All interpretation is delegated to the existing diagnostic
// modules so the 3D view always agrees with the 2D map and the detail modal:
//   - DGA limits follow the standard saved per transformer (dga_gas_limit_standard)
//   - oil quality follows IEC 60422 / the ester profiles by oil type

import { analyzeSample } from '../dga/diagnostics';
import { getStandardLabelForOilType, getStandardOptionsForOilType } from '../dga/appConfig';
import { getOilQualityAssessment } from '../standards/oilQualityAssessment';

export const STATUS_META = {
  normal: { label: 'Normal', color: '#16a34a' },
  warning: { label: 'Warning', color: '#eab308' },
  critical: { label: 'Critical', color: '#dc2626' },
};

export const STATUS_ORDER = ['critical', 'warning', 'normal'];

const DGA_GASES = [
  { key: 'h2', formula: 'H2', name: 'Hydrogen' },
  { key: 'ch4', formula: 'CH4', name: 'Methane' },
  { key: 'c2h6', formula: 'C2H6', name: 'Ethane' },
  { key: 'c2h4', formula: 'C2H4', name: 'Ethylene' },
  { key: 'c2h2', formula: 'C2H2', name: 'Acetylene' },
  { key: 'co', formula: 'CO', name: 'Carbon monoxide' },
  { key: 'co2', formula: 'CO2', name: 'Carbon dioxide' },
];

const OIL_QUALITY_KEYS = [
  'breakdown',
  'waterContent',
  'acidity',
  'interfacialTension',
  'powerFactor',
  'color',
];

const MAX_TREND_POINTS = 8;

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function getSortedOilTests(oilTests = []) {
  if (!Array.isArray(oilTests)) {
    return [];
  }
  return [...oilTests].sort((left, right) => {
    const dateDiff = getTimestamp(left.testDate) - getTimestamp(right.testDate);
    return dateDiff !== 0 ? dateDiff : getTimestamp(left.createdAt) - getTimestamp(right.createdAt);
  });
}

function findLatestWith(sortedTests, keys) {
  for (let index = sortedTests.length - 1; index >= 0; index -= 1) {
    const test = sortedTests[index];
    if (keys.some((key) => toNumber(test?.[key]) !== null || (key === 'color' && test?.color))) {
      return test;
    }
  }
  return null;
}

function getAgeAtSample(yearBuilt, sampleDate) {
  const builtYear = Number.parseInt(String(yearBuilt || '').slice(0, 4), 10);
  const sampleYear = new Date(sampleDate || Date.now()).getFullYear();
  if (!Number.isFinite(builtYear) || !Number.isFinite(sampleYear)) {
    return '';
  }
  return String(Math.max(0, sampleYear - builtYear));
}

export function resolveDgaPreferences(transformer) {
  const oilType = transformer?.oilType || 'mineral';
  const options = getStandardOptionsForOilType(oilType);
  const gasLimitStandard = options.some((option) => option.value === transformer?.gasLimitStandard)
    ? transformer.gasLimitStandard
    : options[0]?.value ?? 'IEEE_2019';
  return { oilType, gasLimitStandard };
}

// Same thresholds the 2D map markers use: ≥110 % of limit critical, ≥105 % warning.
function gasTone(value, limit) {
  if (value === null || limit === null || limit <= 0) {
    return 'none';
  }
  if (value >= limit * 1.1) {
    return 'critical';
  }
  if (value >= limit * 1.05) {
    return 'warning';
  }
  return 'normal';
}

export function formatDate(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatValue(value, digits) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return value ? String(value) : '—';
  }
  const resolvedDigits = digits ?? (Math.abs(numeric) >= 100 ? 0 : Math.abs(numeric) >= 10 ? 1 : 2);
  return numeric.toLocaleString(undefined, { maximumFractionDigits: resolvedDigits });
}

function buildDgaSummary(transformer, sortedTests) {
  const test = findLatestWith(sortedTests, ['h2', 'ch4', 'c2h6', 'c2h4', 'c2h2', 'co', 'co2']);
  if (!test) {
    return { ready: false, message: 'No DGA result recorded yet.' };
  }

  const { oilType, gasLimitStandard } = resolveDgaPreferences(transformer);
  const sampleDate = test.testDate || new Date().toISOString().slice(0, 10);
  const trendTests = sortedTests.slice(-MAX_TREND_POINTS);

  try {
    const analysis = analyzeSample(
      {
        date: sampleDate,
        h2: test.h2,
        ch4: test.ch4,
        c2h6: test.c2h6,
        c2h4: test.c2h4,
        c2h2: test.c2h2,
        co: test.co,
        co2: test.co2,
        o2: test.o2,
        n2: test.n2,
        transformerAge: getAgeAtSample(transformer?.yearBuilt, sampleDate),
      },
      gasLimitStandard,
      oilType
    );

    const gases = DGA_GASES.map((gas) => {
      const detail = analysis.gasLimitDetails?.[gas.key];
      const value = toNumber(test[gas.key]);
      const limit = toNumber(detail?.activeLimit);
      return {
        ...gas,
        value,
        limit,
        tone: gasTone(value, limit),
        ratio: value !== null && limit ? value / limit : null,
        trend: trendTests.map((entry) => toNumber(entry?.[gas.key])),
      };
    });

    return {
      ready: true,
      sampleDate,
      testType: test.testType || '',
      oilType,
      standardLabel: getStandardLabelForOilType(gasLimitStandard, oilType),
      gases,
      tdcg: toNumber(analysis.metrics?.tdcg) ?? toNumber(test.tdcg),
      co2CoRatio: toNumber(analysis.metrics?.co2CoRatio),
      // Duval methods need all five hydrocarbon gases.
      primaryFault: (analysis.requiredGasCount ?? 0) >= 5 ? analysis.primaryFault : null,
      insufficientForDuval: (analysis.requiredGasCount ?? 0) < 5,
    };
  } catch (error) {
    console.error('3D view: DGA analysis failed', error);
    return { ready: false, message: 'Unable to analyse the latest DGA sample.' };
  }
}

function buildOilSummary(transformer, sortedTests) {
  const test = findLatestWith(sortedTests, OIL_QUALITY_KEYS);
  if (!test) {
    return { ready: false, message: 'No oil quality result recorded yet.' };
  }

  try {
    const assessment = getOilQualityAssessment(test, transformer);
    const items = (assessment?.items || [])
      .filter((item) => item && item.status !== 'no-data')
      .map((item) => ({
        key: item.key,
        label: item.limit?.shortLabel || item.limit?.label || item.key,
        unit: item.limit?.unit || '',
        value: item.value,
        status: item.status,
        statusLabel: item.statusLabel || item.status,
        badgeVariant: item.badgeVariant || 'secondary',
        rangeLabel: item.healthyRangeLabel || '',
      }));

    if (items.length === 0) {
      return { ready: false, message: 'No oil quality result recorded yet.' };
    }

    return {
      ready: true,
      sampleDate: test.testDate,
      profileLabel: assessment?.profile?.shortLabel || assessment?.profile?.label || '',
      standardLabel: assessment?.profile?.standard || assessment?.standard || '',
      items,
      summary: assessment?.summary || null,
    };
  } catch (error) {
    console.error('3D view: oil quality assessment failed', error);
    return { ready: false, message: 'Unable to assess the latest oil quality sample.' };
  }
}

export function buildAssetSummary(transformer) {
  const sortedTests = getSortedOilTests(transformer?.oilTests);
  return {
    testCount: sortedTests.length,
    latestTestDate: sortedTests[sortedTests.length - 1]?.testDate || null,
    dga: buildDgaSummary(transformer, sortedTests),
    oil: buildOilSummary(transformer, sortedTests),
  };
}

export function hasValidPosition(transformer) {
  const [latitude, longitude] = transformer?.position || [];
  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180 &&
    !(Number(latitude) === 0 && Number(longitude) === 0)
  );
}
