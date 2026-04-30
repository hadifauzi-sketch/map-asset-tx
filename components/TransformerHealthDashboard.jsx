import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  FileText,
  FlaskConical,
  Gauge,
  HeartPulse,
  Layers,
  ShieldCheck,
  Sparkles,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { DuvalDiagram } from './dga-workbench/DuvalDiagram';
import {
  IEC_60422_VOLTAGE_GROUPS,
  getActionRangeLabel,
  getHealthyRangeLabel,
  getMonitorRangeLabel,
} from '../lib/standards/iec60422Profiles';
import {
  getOilQualityAssessment,
  getOilQualitySupplementaryAssessment,
} from '../lib/standards/oilQualityAssessment';
import { normaliseOilType } from '../lib/oilTypeUtils';
import { getPaperTypeLabel } from '../lib/paperTypeUtils';
import {
  getSupplementaryActionRangeLabel,
  getSupplementaryHealthyRangeLabel,
  getSupplementaryMonitorRangeLabel,
  getSupplementaryReference,
  getSupplementaryReferenceLineValue,
  getSupplementaryStatusSeverity,
} from '../lib/standards/supplementaryOilReferences';
import { analyzeSample, FAULT_METADATA } from '../lib/dga/diagnostics';
import { getStandardLabelForOilType, getStandardOptionsForOilType } from '../lib/dga/appConfig';

const CHART_TEXT_COLOR = 'var(--foreground)';
const CHART_MUTED_COLOR = 'color-mix(in srgb, var(--foreground) 68%, var(--muted) 32%)';
const CHART_AXIS_COLOR = 'color-mix(in srgb, var(--foreground) 58%, var(--border) 42%)';
const CHART_GRID_COLOR = 'color-mix(in srgb, var(--foreground) 12%, transparent)';
const REFERENCE_LIFE_YEARS = 40;
const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--foreground)',
  fontSize: 12,
};

// IEEE C57.104-2008 Condition 1 limits (mineral oil, ppm) - default caution thresholds
const DGA_CAUTION_LIMITS = {
  H2: 100,
  CH4: 120,
  C2H6: 65,
  C2H4: 50,
  C2H2: 1,
  CO: 350,
};

// IEEE C57.104-2008 Condition 2 limits (warning) ppm
const DGA_WARNING_LIMITS = {
  H2: 700,
  CH4: 400,
  C2H6: 100,
  C2H4: 100,
  C2H2: 9,
  CO: 570,
};

const DGA_GAS_KEYS = ['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO'];
const DGA_TREND_LINES = [
  { dataKey: 'C2H2', name: 'Acetylene (C2H2)', color: '#f97316' },
  { dataKey: 'CO', name: 'CO', color: '#f59e0b' },
  { dataKey: 'C2H6', name: 'Ethane (C2H6)', color: '#8b5cf6' },
  { dataKey: 'C2H4', name: 'Ethylene (C2H4)', color: '#ef4444' },
  { dataKey: 'H2', name: 'Hydrogen (H2)', color: '#10b981' },
  { dataKey: 'CH4', name: 'Methane (CH4)', color: '#3b82f6' },
  { dataKey: 'TDCG', name: 'TDCG', color: '#94a3b8', dashed: true },
];
const DGA_GAS_KEY_LOOKUP = { H2: 'h2', CH4: 'ch4', C2H6: 'c2h6', C2H4: 'c2h4', C2H2: 'c2h2', CO: 'co' };

function resolveGasLimitStandardKey(transformer) {
  const oilType = transformer?.oilType || 'mineral';
  const options = getStandardOptionsForOilType(oilType);
  const candidate = transformer?.gasLimitStandard;
  if (options.some((option) => option.value === candidate)) {
    return { standard: candidate, oilType };
  }
  return { standard: options[0]?.value ?? 'IEEE_2019', oilType };
}

function buildActiveDgaLimits(transformer, latestRaw, assetAge) {
  if (!latestRaw) {
    return {
      cautionLimits: DGA_CAUTION_LIMITS,
      warningLimits: DGA_WARNING_LIMITS,
      standardKey: 'IEEE_2008',
      standardLabel: 'IEEE C57.104-2008',
      oilType: 'mineral',
    };
  }

  const { standard, oilType } = resolveGasLimitStandardKey(transformer);

  if (standard === 'IEEE_2008' && oilType === 'mineral') {
    return {
      cautionLimits: DGA_CAUTION_LIMITS,
      warningLimits: DGA_WARNING_LIMITS,
      standardKey: standard,
      standardLabel: getStandardLabelForOilType(standard, oilType),
      oilType,
    };
  }

  const sampleAge = (() => {
    if (assetAge !== null && assetAge !== undefined && Number.isFinite(assetAge)) {
      return String(assetAge);
    }
    const yearBuilt = parseInt(transformer?.yearBuilt, 10);
    const sampleYear = parseInt(String(latestRaw?.testDate || '').slice(0, 4), 10);
    if (Number.isFinite(yearBuilt) && Number.isFinite(sampleYear)) {
      return String(Math.max(0, sampleYear - yearBuilt));
    }
    return '';
  })();

  const sample = {
    date: String(latestRaw?.testDate || '').slice(0, 10),
    h2: latestRaw?.h2,
    ch4: latestRaw?.ch4,
    c2h6: latestRaw?.c2h6,
    c2h4: latestRaw?.c2h4,
    c2h2: latestRaw?.c2h2,
    co: latestRaw?.co,
    co2: latestRaw?.co2,
    o2: latestRaw?.o2,
    n2: latestRaw?.n2,
    transformerAge: sampleAge,
  };

  let analysis;
  try {
    analysis = analyzeSample(sample, standard, oilType);
  } catch (error) {
    console.error('Dashboard: failed to derive DGA limits', error);
    return {
      cautionLimits: DGA_CAUTION_LIMITS,
      warningLimits: DGA_WARNING_LIMITS,
      standardKey: 'IEEE_2008',
      standardLabel: getStandardLabelForOilType('IEEE_2008', oilType),
      oilType,
    };
  }

  const cautionLimits = {};
  const warningLimits = {};
  DGA_GAS_KEYS.forEach((upperKey) => {
    const lowerKey = DGA_GAS_KEY_LOOKUP[upperKey];
    const detail = analysis?.gasLimitDetails?.[lowerKey];
    const limit = Number(detail?.activeLimit);
    if (Number.isFinite(limit) && limit > 0) {
      cautionLimits[upperKey] = limit;
      warningLimits[upperKey] = Math.round(limit * 1.5);
    } else {
      cautionLimits[upperKey] = DGA_CAUTION_LIMITS[upperKey];
      warningLimits[upperKey] = DGA_WARNING_LIMITS[upperKey];
    }
  });

  return {
    cautionLimits,
    warningLimits,
    standardKey: standard,
    standardLabel: getStandardLabelForOilType(standard, oilType),
    oilType,
  };
}

// Oil quality references (mineral oil, in-service, IEEE C57.106 / IEC 60422 typical)
const OIL_QUALITY_REFERENCES = {
  breakdown: { good: 55, caution: 40, unit: 'kV', higherIsBetter: true, label: 'Breakdown Voltage' },
  waterContent: { good: 15, caution: 25, unit: 'ppm', higherIsBetter: false, label: 'Moisture' },
  acidity: { good: 0.1, caution: 0.2, unit: 'mgKOH/g', higherIsBetter: false, label: 'Acidity' },
  interfacialTension: { good: 28, caution: 22, unit: 'mN/m', higherIsBetter: true, label: 'IFT' },
  powerFactor: { good: 0.5, caution: 1.0, unit: '%', higherIsBetter: false, label: 'Tan δ / PF' },
};

const DEFAULT_ACTIVE_OIL_REFERENCES = IEC_60422_VOLTAGE_GROUPS.medium.limits;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(/,/g, '.').trim();
  const direct = parseFloat(normalized);
  if (Number.isFinite(direct)) return direct;
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

function safe(value, fallback = '-') {
  if (value === null || value === undefined || value === '' || Number.isNaN(value)) {
    return fallback;
  }
  return value;
}

function formatNumber(value, digits = 1) {
  const n = toNumber(value);
  if (n === null) return '-';
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  return n.toFixed(digits);
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelativeDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const diffDays = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'in the future';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.round(diffDays / 30)} months ago`;
  return `${(diffDays / 365).toFixed(1)} years ago`;
}

function getOilTypeSnapshot(latest, transformer) {
  const sourceValue = latest?.raw?.oilType ?? transformer?.oilType ?? '';
  const normalized = normaliseOilType(sourceValue);
  const rawLower = String(sourceValue || normalized).trim().toLowerCase();
  const normalizedLower = normalized.toLowerCase();

  if (!normalized) {
    return { value: 'Unknown', helper: 'No oil type recorded' };
  }

  if (normalizedLower.includes('silicon')) {
    return { value: 'Silicon Oil', helper: 'Recorded transformer oil type' };
  }

  if (['soybean', 'rapeseed', 'sunflower'].includes(rawLower)) {
    return { value: 'Natural Ester', helper: `DGA oil profile: ${normalized}` };
  }

  if (rawLower === 'synthetic') {
    return { value: 'Synthetic Ester', helper: 'Ester insulation liquid' };
  }

  if (
    normalizedLower.includes('ester') ||
    ['soybean', 'rapeseed', 'sunflower', 'synthetic'].includes(rawLower)
  ) {
    const esterType =
      normalizedLower.includes('synthetic') ? 'Synthetic Ester'
        : normalizedLower.includes('modified') ? 'Modified Ester'
          : normalizedLower.includes('natural') ? 'Natural Ester'
            : normalized;
    return {
      value: esterType,
      helper: 'Ester insulation liquid',
    };
  }

  if (normalizedLower.includes('mineral') || rawLower === 'mineral') {
    return { value: 'Mineral Oil', helper: 'Mineral insulation oil' };
  }

  return { value: normalized, helper: 'Recorded transformer oil type' };
}

function getDpSeverity(dpValue) {
  if (dpValue === null || dpValue === undefined) return null;
  if (dpValue < 350) return 90;
  if (dpValue < 500) return 60;
  if (dpValue < 700) return 25;
  return 5;
}

function getDpBadge(dpValue) {
  if (dpValue === null || dpValue === undefined) return null;
  if (dpValue >= 700) return { label: 'New / healthy', tone: 'success' };
  if (dpValue >= 500) return { label: 'Mid-life', tone: 'success' };
  if (dpValue >= 350) return { label: 'Aged', tone: 'warning' };
  return { label: 'End of life', tone: 'danger' };
}

function calcLifeUsedFromDp(...dpValues) {
  const dp = dpValues
    .map((value) => toNumber(value))
    .find((value) => Number.isFinite(value) && value > 0) ?? null;
  if (dp === null) return null;
  return Math.min(100, Math.max(0, Math.round(((1000 - dp) / 800) * 100)));
}

function calculateDpFromFuranValue(fal2) {
  const val = toNumber(fal2);
  if (!val || val <= 0) return null;
  const dp = 402.47 - 220.87 * Math.log10(val);
  return dp > 0 ? Math.round(dp) : null;
}

function calculateDpFromMethanolValue(methanol) {
  const val = toNumber(methanol);
  if (!val || val <= 0) return null;
  const dp = (3.837 - Math.log10(val)) / 0.00283;
  return dp > 0 ? Math.round(dp) : null;
}

function getLifetimeUsagePctFromAge(ageYears, referenceLifeYears = REFERENCE_LIFE_YEARS) {
  if (!Number.isFinite(ageYears)) return null;
  return Math.min(100, Math.round((Math.max(ageYears, 0) / referenceLifeYears) * 100));
}

function getLifetimeUsagePctForDate(yearBuilt, targetDate, referenceLifeYears = REFERENCE_LIFE_YEARS) {
  if (!Number.isFinite(yearBuilt)) return null;
  const d = targetDate instanceof Date ? targetDate : new Date(targetDate);
  if (Number.isNaN(d.getTime())) return null;
  return getLifetimeUsagePctFromAge(d.getFullYear() - yearBuilt, referenceLifeYears);
}

function getLifetimeUsageSeverity(usagePct) {
  if (usagePct === null || usagePct === undefined) return null;
  if (usagePct >= 90) return 90;
  if (usagePct >= 75) return 60;
  if (usagePct >= 50) return 25;
  return 5;
}

function getMetricSnapshot(records, dataKey) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      latestRecord: null,
      latestValue: null,
      previousRecord: null,
      previousValue: null,
    };
  }

  const withValue = records.filter((record) => toNumber(record?.[dataKey]) !== null);
  const latestRecord = withValue.length ? withValue[withValue.length - 1] : null;
  const previousRecord = withValue.length > 1 ? withValue[withValue.length - 2] : null;

  return {
    latestRecord,
    latestValue: latestRecord ? toNumber(latestRecord[dataKey]) : null,
    previousRecord,
    previousValue: previousRecord ? toNumber(previousRecord[dataKey]) : null,
  };
}

// --- Map a single oil test to chart-friendly object ---
function mapTest(test) {
  const d = new Date(test?.testDate);
  const dpFuran = toNumber(test?.estimatedDpFuran) ?? calculateDpFromFuranValue(test?.fal2);
  const dpMethanol = toNumber(test?.estimatedDpMethanol) ?? calculateDpFromMethanolValue(test?.methanol);
  const tdcg =
    toNumber(test?.tdcg) ??
    [test?.h2, test?.ch4, test?.c2h2, test?.c2h4, test?.c2h6, test?.co]
      .map(toNumber)
      .filter((v) => v !== null)
      .reduce((sum, v) => sum + v, 0);

  return {
    raw: test,
    rawDate: Number.isNaN(d.getTime()) ? null : d,
    date: Number.isNaN(d.getTime())
      ? '-'
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    H2: toNumber(test?.h2) ?? 0,
    CH4: toNumber(test?.ch4) ?? 0,
    C2H6: toNumber(test?.c2h6) ?? 0,
    C2H4: toNumber(test?.c2h4) ?? 0,
    C2H2: toNumber(test?.c2h2) ?? 0,
    CO: toNumber(test?.co) ?? 0,
    CO2: toNumber(test?.co2) ?? 0,
    TDCG: tdcg || 0,
    BDV: toNumber(test?.breakdown),
    Moisture: toNumber(test?.waterContent),
    Acidity: toNumber(test?.acidity),
    IFT: toNumber(test?.interfacialTension),
    Appearance: test?.appearance ?? '',
    Color: toNumber(test?.color),
    PowerFactor: toNumber(test?.powerFactor),
    Resistivity: toNumber(test?.resistivity),
    Inhibitor: toNumber(test?.inhibitor),
    Density: toNumber(test?.density),
    Viscosity40: toNumber(test?.viscosity40),
    FlashPoint: toNumber(test?.flashPoint),
    FirePoint: toNumber(test?.firePoint),
    DBDS: toNumber(test?.dbds),
    PCB: toNumber(test?.pcb),
    Passivator: toNumber(test?.passivator),
    Furan: toNumber(test?.fal2),
    Methanol: toNumber(test?.methanol),
    DPFuran: dpFuran,
    DPMethanol: dpMethanol,
    CopperCorrosive: test?.copperCorrosive,
  };
}

// --- DGA scoring (0=good, 100=critical) per gas ---
function gasSeverity(gas, value, cautionLimits = DGA_CAUTION_LIMITS, warningLimits = DGA_WARNING_LIMITS) {
  if (value === null || value === undefined) return null;
  const caution = cautionLimits[gas];
  const warning = warningLimits[gas];
  if (!caution || !warning) return null;
  if (value <= caution * 0.5) return 0; // very good
  if (value <= caution) return 25; // normal
  if (value <= warning) return 60; // caution
  return 90; // critical
}

function severityLabel(score) {
  if (score === null || score === undefined) return { label: 'No data', tone: 'secondary' };
  if (score < 20) return { label: 'Healthy', tone: 'success' };
  if (score < 40) return { label: 'Normal', tone: 'success' };
  if (score < 65) return { label: 'Caution', tone: 'warning' };
  return { label: 'Critical', tone: 'danger' };
}

function oilParamSeverity(key, value, oilReferences = DEFAULT_ACTIVE_OIL_REFERENCES) {
  const ref = oilReferences[key];
  if (!ref || ref.type === 'text' || value === null || value === undefined) return null;
  const numericValue = toNumber(value);
  if (numericValue === null) return null;

  if (ref.higherIsBetter) {
    if (ref.goodInclusive === false ? numericValue > ref.good : numericValue >= ref.good) return 10;
    if (ref.caution === null || ref.caution === undefined) return 85;
    if (ref.cautionInclusive === false ? numericValue > ref.caution : numericValue >= ref.caution) return 50;
    return 85;
  }
  if (ref.goodInclusive === false ? numericValue < ref.good : numericValue <= ref.good) return 10;
  if (ref.caution === null || ref.caution === undefined) return 85;
  if (ref.cautionInclusive === false ? numericValue < ref.caution : numericValue <= ref.caution) return 50;
  return 85;
}

function formatOilReferenceLimit(limit) {
  if (!limit) return '-';
  const range = getHealthyRangeLabel(limit);
  return limit.unit ? `${range} ${limit.unit}` : range;
}

function getReferenceLineValue(limit) {
  if (!limit || limit.type === 'text') return null;
  return limit.caution ?? limit.good ?? null;
}

// Estimate overall transformer health (0-100, higher is better)
function computeHealthScore(latest, oilReferences = DEFAULT_ACTIVE_OIL_REFERENCES, cautionLimits = DGA_CAUTION_LIMITS, warningLimits = DGA_WARNING_LIMITS) {
  if (!latest) return null;
  const components = [];

  // DGA components
  DGA_GAS_KEYS.forEach((gas) => {
    const sev = gasSeverity(gas, latest[gas], cautionLimits, warningLimits);
    if (sev !== null) components.push({ key: `dga_${gas}`, severity: sev, weight: gas === 'C2H2' ? 1.5 : 1 });
  });

  // Oil quality components
  Object.keys(oilReferences).forEach((key) => {
    const value = key === 'powerFactor' ? latest.PowerFactor : latest[oilKeyMap(key)];
    const sev = oilParamSeverity(key, value, oilReferences);
    if (sev !== null) components.push({ key: `oil_${key}`, severity: sev, weight: 1 });
  });

  // DP from furan / methanol (lower DP = worse)
  const dp = latest.DPFuran ?? latest.DPMethanol;
  if (dp !== null && dp !== undefined) {
    let dpSev = 0;
    if (dp >= 700) dpSev = 5;
    else if (dp >= 500) dpSev = 25;
    else if (dp >= 350) dpSev = 60;
    else dpSev = 90;
    components.push({ key: 'dp', severity: dpSev, weight: 1.5 });
  }

  if (!components.length) return null;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weightedSeverity = components.reduce((s, c) => s + c.severity * c.weight, 0) / totalWeight;
  return Math.max(0, Math.min(100, Math.round(100 - weightedSeverity)));
}

function oilKeyMap(key) {
  switch (key) {
    case 'breakdown': return 'BDV';
    case 'waterContent': return 'Moisture';
    case 'acidity': return 'Acidity';
    case 'interfacialTension': return 'IFT';
    case 'powerFactor': return 'PowerFactor';
    case 'resistivity': return 'Resistivity';
    case 'color': return 'Color';
    case 'density': return 'Density';
    case 'viscosity40': return 'Viscosity40';
    case 'viscosity40Variation': return 'Viscosity40Variation';
    case 'inhibitor': return 'Inhibitor';
    case 'firePoint': return 'FirePoint';
    case 'flashPoint': return 'FlashPoint';
    case 'dbds': return 'DBDS';
    case 'pcb': return 'PCB';
    default: return key;
  }
}

function healthBucket(score) {
  if (score === null || score === undefined) return { label: 'Unknown', tone: 'secondary', color: 'var(--muted)' };
  if (score >= 85) return { label: 'Excellent', tone: 'success', color: '#16a34a' };
  if (score >= 70) return { label: 'Good', tone: 'success', color: '#65a30d' };
  if (score >= 50) return { label: 'Fair', tone: 'warning', color: '#f59e0b' };
  if (score >= 30) return { label: 'Poor', tone: 'danger', color: '#ef4444' };
  return { label: 'Critical', tone: 'danger', color: '#b91c1c' };
}

function appendUnitToRange(range, unit) {
  if (!range || range === '-') return '-';
  if (range === 'Not used') return range;
  if (!unit || range.includes(unit)) return range;
  return `${range} ${unit}`;
}

function buildOilLimitInfo(reference, profileLabel) {
  if (!reference) return null;
  return {
    title: profileLabel || reference.sourceLabel || 'Active oil profile',
    source: reference.sourceLabel || null,
    healthy: appendUnitToRange(getHealthyRangeLabel(reference), reference.unit),
    monitor: appendUnitToRange(getMonitorRangeLabel(reference), reference.unit),
    action: appendUnitToRange(getActionRangeLabel(reference), reference.unit),
  };
}

function buildSupplementaryLimitInfo(reference) {
  if (!reference) return null;
  return {
    title: reference.sourceLabel || `${reference.shortLabel || reference.label} reference`,
    source: reference.testBasis || null,
    healthy: appendUnitToRange(getSupplementaryHealthyRangeLabel(reference), reference.unit),
    monitor: appendUnitToRange(getSupplementaryMonitorRangeLabel(reference), reference.unit),
    action: appendUnitToRange(getSupplementaryActionRangeLabel(reference), reference.unit),
  };
}

function formatTooltipMetricValue(value, unit, precision) {
  const formatted = formatNumber(value, precision);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatSparklinePointDate(point, fallbackLabel) {
  const candidate = point?.raw?.testDate ?? point?.rawDate ?? point?.testDate ?? point?.date;
  const formatted = formatDate(candidate);
  return formatted !== '-' ? formatted : (fallbackLabel ?? '-');
}

function SparklineTooltip({ active, payload, label, unit, precision, resultLabel, limitInfo }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const value = payload[0]?.value;
  if (value === null || value === undefined) return null;

  return (
    <div className="min-w-[190px] rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)] shadow-lg">
      <p className="font-semibold">{formatSparklinePointDate(point, label)}</p>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="text-[var(--muted)]">{resultLabel || 'Result'}</span>
        <span className="font-semibold">{formatTooltipMetricValue(value, unit, precision)}</span>
      </div>
      {limitInfo ? (
        <div className="mt-2 border-t border-[color:var(--border)] pt-2">
          <p className="font-medium text-[var(--foreground)]">{limitInfo.title}</p>
          {limitInfo.healthy ? (
            <p className="mt-1 text-[var(--muted)]">Healthy: {limitInfo.healthy}</p>
          ) : null}
          {limitInfo.monitor && limitInfo.monitor !== 'Not used' ? (
            <p className="text-[var(--muted)]">Monitor: {limitInfo.monitor}</p>
          ) : null}
          {limitInfo.action ? (
            <p className="text-[var(--muted)]">Action: {limitInfo.action}</p>
          ) : null}
          {limitInfo.source ? (
            <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">{limitInfo.source}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// --- Sparkline component ---
function Sparkline({
  data,
  dataKey,
  color = '#0d9488',
  height = 36,
  referenceValue,
  unit = '',
  precision = 2,
  resultLabel,
  limitInfo,
}) {
  if (!data || data.length < 2) {
    return <div style={{ height, fontSize: 11, color: 'var(--muted)' }}>not enough samples</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.42} />
            <stop offset="100%" stopColor={color} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        {referenceValue !== undefined && referenceValue !== null ? (
          <ReferenceLine y={referenceValue} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
        ) : null}
        <Tooltip
          content={(
            <SparklineTooltip
              unit={unit}
              precision={precision}
              resultLabel={resultLabel}
              limitInfo={limitInfo}
            />
          )}
          cursor={{ stroke: CHART_AXIS_COLOR, strokeWidth: 1, strokeDasharray: '3 3' }}
          wrapperStyle={{ zIndex: 60, outline: 'none' }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#spark-${dataKey})`}
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 3.5, stroke: 'var(--card)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// --- Health gauge (semi-circular) ---
function HealthGauge({ score }) {
  const bucket = healthBucket(score);
  const value = score ?? 0;
  const angle = 180 - (value / 100) * 180;
  const cx = 110;
  const cy = 120;
  const r = 86;
  const needleLen = 70;
  const rad = (Math.PI * angle) / 180;
  const x = cx + needleLen * Math.cos(rad);
  const y = cy - needleLen * Math.sin(rad);

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <svg viewBox="0 -8 220 188" width="100%" height="auto" style={{ maxWidth: 210 }}>
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="65%" stopColor="#65a30d" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={CHART_GRID_COLOR}
          strokeWidth="20"
          strokeLinecap="round"
        />
        {/* Gradient arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* End-tick labels */}
        <text x={cx - r} y={cy + 18} textAnchor="middle" fontSize="10" fill={CHART_AXIS_COLOR}>0</text>
        <text x={cx} y={cy - r - 14} textAnchor="middle" fontSize="10" fill={CHART_AXIS_COLOR}>50</text>
        <text x={cx + r} y={cy + 18} textAnchor="middle" fontSize="10" fill={CHART_AXIS_COLOR}>100</text>

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={x}
          y2={y}
          stroke={bucket.color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="7" fill={CHART_TEXT_COLOR} />
        <circle cx={cx} cy={cy} r="3" fill={bucket.color} />

        {/* Big score (clearly below the needle pivot, no overlap) */}
        <text
          x={cx}
          y={cy + 45}
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fill={bucket.color}
        >
          {score !== null && score !== undefined ? score : '-'}
        </text>
        <text x={cx} y={cy + 58} textAnchor="middle" fontSize="10" fill={CHART_AXIS_COLOR}>
          out of 100
        </text>
      </svg>
      <Badge variant={bucket.tone} className="mt-0 text-xs">
        {bucket.label}
      </Badge>
    </div>
  );
}

// --- Status pill ---
function StatusPill({ status }) {
  const tone = severityLabel(status);
  return <Badge variant={tone.tone}>{tone.label}</Badge>;
}

// --- KPI Tile ---
function KpiTile({ icon: Icon, label, value, unit, trend, status, helper }) {
  let TrendIcon = null;
  let trendColor = 'var(--muted)';
  if (trend === 'up') {
    TrendIcon = TrendingUp;
    trendColor = '#ef4444';
  } else if (trend === 'down') {
    TrendIcon = TrendingDown;
    trendColor = '#16a34a';
  } else if (trend === 'up-good') {
    TrendIcon = TrendingUp;
    trendColor = '#16a34a';
  } else if (trend === 'down-bad') {
    TrendIcon = TrendingDown;
    trendColor = '#ef4444';
  }

  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
        </div>
        {status ? <StatusPill status={status} /> : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-[var(--foreground)]">{value}</p>
        {unit ? <p className="text-xs text-[var(--muted)]">{unit}</p> : null}
        {TrendIcon ? <TrendIcon className="h-4 w-4" style={{ color: trendColor }} /> : null}
      </div>
      {helper ? <p className="mt-1 text-xs text-[var(--muted)]">{helper}</p> : null}
    </div>
  );
}

function buildLatestDuvalCards(analysis, oilType = 'mineral') {
  const methodByKey = Object.fromEntries((analysis?.methods ?? []).map((method) => [method.key, method]));
  const baseTriangleKey = {
    mineral: 'triangle1',
    soybean: 'triangle3_soybean',
    rapeseed: 'triangle3_rapeseed',
    sunflower: 'triangle3_sunflower',
    synthetic: 'triangle3_synthetic',
  }[oilType] ?? 'triangle1';
  const pentagonKey = {
    mineral: 'pentagon',
    soybean: 'pentagon3_soybean',
    rapeseed: 'pentagon3_rapeseed',
    sunflower: 'pentagon3_sunflower',
    synthetic: 'pentagon3_synthetic',
  }[oilType] ?? 'pentagon';

  const followUpKey =
    oilType === 'mineral'
      ? methodByKey.triangle4?.zone
        ? 'triangle4'
        : methodByKey.triangle5?.zone
          ? 'triangle5'
          : null
      : methodByKey.triangle6?.zone
        ? 'triangle6'
        : null;

  return [baseTriangleKey, followUpKey, pentagonKey]
    .filter(Boolean)
    .map((key) => {
      const method = methodByKey[key] ?? null;
      const zone = method?.zone ?? null;

      return {
        id: key,
        type: key.startsWith('pentagon') ? 'pentagon' : 'triangle',
        diagramKey: key.startsWith('pentagon') ? null : key,
        title: method?.title ?? key,
        zone,
        label: zone ? (FAULT_METADATA[zone]?.label ?? zone) : 'Pending',
      };
    });
}

function LifetimeUsageCard({ assetAge, yearBuilt, sampleDate, dpFuran, dpMethanol }) {
  const [source, setSource] = useState('furan');
  const age = Number.isFinite(assetAge) ? Math.max(assetAge, 0) : null;
  const sourceOptions = [
    {
      key: 'furan',
      label: 'Furan',
      sourceLabel: 'DP from 2-FAL',
      summaryLabel: 'DP estimated from 2-FAL',
      dpLabel: 'DP 2-FAL',
      missingSummary: 'Add a 2-FAL result or DP from Furan to calculate this estimate.',
      dp: dpFuran,
    },
    {
      key: 'methanol',
      label: 'Methanol',
      sourceLabel: 'DP from Methanol',
      summaryLabel: 'DP estimated from Methanol',
      dpLabel: 'DP Methanol',
      missingSummary: 'Add a Methanol result or DP from Methanol to calculate this estimate.',
      dp: dpMethanol,
    },
  ];
  const sourceConfig = sourceOptions.find((option) => option.key === source) ?? sourceOptions[0];
  const selectedDp = toNumber(sourceConfig.dp);
  const selectedDpValue = Number.isFinite(selectedDp) && selectedDp > 0 ? selectedDp : null;
  const dpLifePct = calcLifeUsedFromDp(selectedDpValue);
  const usagePct = dpLifePct;
  const tone =
    usagePct === null
      ? { label: `${sourceConfig.label} unavailable`, variant: 'secondary', color: '#94a3b8' }
      : usagePct >= 90
        ? { label: 'Near end of reference life', variant: 'danger', color: '#ef4444' }
        : usagePct >= 75
          ? { label: 'Late-life asset', variant: 'warning', color: '#f59e0b' }
          : { label: 'Within reference life', variant: 'success', color: '#14b8a6' };

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = usagePct === null ? circumference : circumference * (1 - usagePct / 100);
  const summary =
    dpLifePct !== null
      ? `Paper insulation life used based on ${sourceConfig.summaryLabel} (DP approx. ${selectedDpValue}).`
      : `${sourceConfig.sourceLabel} is unavailable. ${sourceConfig.missingSummary}`;

  const sourceLabel = sourceConfig.sourceLabel;
  const nextSource = source === 'furan' ? 'methanol' : 'furan';
  const nextSourceLabel = sourceOptions.find((option) => option.key === nextSource)?.label ?? 'alternate source';
  const toggleSource = () => setSource((current) => (current === 'furan' ? 'methanol' : 'furan'));
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSource();
    }
  };

  return (
    <Card
      className="flex h-full cursor-pointer select-none flex-col transition hover:border-[color:var(--primary)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--background)]"
      role="button"
      tabIndex={0}
      aria-label={`Estimated lifetime use from ${sourceConfig.label}. Activate to switch to ${nextSourceLabel}.`}
      onClick={toggleSource}
      onKeyDown={handleKeyDown}
    >
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[var(--primary-strong)]" />
          Estimated Lifetime Use
        </CardTitle>
        <div
          className="grid grid-cols-2 gap-1 rounded-md bg-[var(--card-muted)] p-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
          aria-hidden="true"
        >
          {sourceOptions.map((option) => {
            const optionDp = toNumber(option.dp);
            const isAvailable = Number.isFinite(optionDp) && optionDp > 0;
            const isActive = option.key === source;
            return (
              <span
                key={option.key}
                className={`rounded px-2 py-1 text-center transition ${
                  isActive
                    ? 'bg-[var(--card)] text-[var(--primary-strong)] shadow-sm'
                    : isAvailable
                      ? 'text-[var(--muted)]'
                      : 'text-[var(--muted)] opacity-45'
                }`}
              >
                {option.label}
              </span>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center gap-3">
        <div className="relative flex h-[160px] w-[160px] items-center justify-center">
          <svg viewBox="0 0 172 172" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id="lifetime-usage-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="65%" stopColor={tone.color} />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            <circle
              cx="86"
              cy="86"
              r={radius}
              fill="none"
              stroke="color-mix(in srgb, var(--foreground) 10%, transparent)"
              strokeWidth="14"
            />
            <circle
              cx="86"
              cy="86"
              r={radius}
              fill="none"
              stroke={usagePct === null ? 'color-mix(in srgb, var(--foreground) 18%, transparent)' : 'url(#lifetime-usage-gradient)'}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              transform="rotate(-90 86 86)"
            />
            <circle
              cx="86"
              cy="86"
              r="38"
              fill="color-mix(in srgb, var(--card) 82%, transparent)"
              stroke="color-mix(in srgb, var(--foreground) 8%, transparent)"
              strokeWidth="1"
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-3xl font-semibold text-[var(--foreground)]">{usagePct ?? '--'}%</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">life used</div>
          </div>
        </div>

        <Badge variant={tone.variant}>{tone.label}</Badge>

        <p className="max-w-[240px] text-center text-xs leading-5 text-[var(--muted)]">
          {summary}
        </p>

        <div className="grid w-full grid-cols-2 gap-2">
          <Mini label={sourceConfig.dpLabel} value={selectedDpValue ?? '-'} unit="" />
          <Mini label="Age" value={age !== null ? age : '-'} unit={age !== null ? 'yrs' : ''} />
          <div className="col-span-2 rounded-md bg-[var(--card)] px-2 py-1.5">
            <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
              <span>Source</span>
              <span>{sourceLabel}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
              <span>Reference life</span>
              <span>{REFERENCE_LIFE_YEARS} yrs</span>
            </div>
            {yearBuilt ? (
              <div className="mt-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                <span>Built</span>
                <span>{yearBuilt}</span>
              </div>
            ) : null}
            {sampleDate ? (
              <p className="mt-1 text-[11px] text-[var(--muted)]">As of {formatDate(sampleDate)}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FaultMethodsRadar({ latest, standard, oilType = 'mineral' }) {
  if (!latest) return null;

  let analysis;
  try {
    analysis = analyzeSample(latest?.raw || latest, standard, oilType);
  } catch (error) {
    console.error('Dashboard: failed to build Duval snapshot', error);
    return (
      <p className="py-4 text-sm text-[var(--muted)]">
        Latest Duval snapshot is not available right now.
      </p>
    );
  }

  if (analysis.requiredGasCount < 5) {
    return (
      <p className="py-4 text-sm text-[var(--muted)]">
        Add H2, CH4, C2H6, C2H4, and C2H2 to show the latest Duval snapshot.
      </p>
    );
  }

  const cards = buildLatestDuvalCards(analysis, oilType);
  const sampleId = 'latest';
  const completedSamples = [{ id: sampleId, analysis }];

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {cards.map((card) => (
        <div key={card.id} className="rounded-xl border border-[color:var(--border)] bg-[var(--card-muted)] p-3">
          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              {card.title}
            </p>
            <p className="mt-2 text-base font-semibold text-[var(--foreground)]">{card.label}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{card.zone ? `Zone ${card.zone}` : 'Pending'}</p>
          </div>

          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--card)] p-2">
            <div className="flex justify-center">
              <DuvalDiagram
                type={card.type}
                diagramKey={card.diagramKey ?? undefined}
                oilType={oilType}
                currentZone={card.zone}
                completedSamples={completedSamples}
                latestId={sampleId}
                selectedId={sampleId}
                size="default"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
// --- DGA limits bar (latest vs caution / warning) ---
function DgaLimitsBars({ latest, cautionLimits = DGA_CAUTION_LIMITS, warningLimits = DGA_WARNING_LIMITS, height = 220 }) {
  if (!latest) return null;
  const data = DGA_GAS_KEYS.map((g) => ({
    gas: g,
    value: latest[g] ?? 0,
    caution: cautionLimits[g] ?? 0,
    severity: gasSeverity(g, latest[g], cautionLimits, warningLimits),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 6 }}>
        <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
        <XAxis dataKey="gas" stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }} />
        <YAxis stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--foreground)', fontSize: 12 }}
          formatter={(value, _name, entry) => [
            `${value} ppm`,
            entry?.dataKey === 'value' ? 'Current DGA result' : 'Caution limit',
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_TEXT_COLOR }} />
        <Bar dataKey="caution" name="Caution limit" fill="#94a3b8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="value" name="Current DGA result" radius={[3, 3, 0, 0]}>
          {data.map((row, idx) => {
            let fill = '#16a34a';
            if (row.severity >= 80) fill = '#dc2626';
            else if (row.severity >= 50) fill = '#f59e0b';
            else if (row.severity >= 25) fill = '#65a30d';
            return <Cell key={idx} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
// --- DGA trending chart with clickable legend ---
function DgaTrendingChart({ data, height = 220 }) {
  const HIDDEN_BY_DEFAULT = new Set(['CO', 'TDCG']);
  const [visible, setVisible] = React.useState(() =>
    Object.fromEntries(DGA_TREND_LINES.map((line) => [line.dataKey, !HIDDEN_BY_DEFAULT.has(line.dataKey)])),
  );

  const handleLegendClick = (entry) => {
    const dataKey = entry?.dataKey;
    if (!dataKey) return;
    setVisible((prev) => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
        <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="date"
          stroke={CHART_AXIS_COLOR}
          tick={{ fill: CHART_TEXT_COLOR, fontSize: 10 }}
          tickMargin={10}
        />
        <YAxis stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Legend
          verticalAlign="top"
          height={42}
          onClick={handleLegendClick}
          wrapperStyle={{ fontSize: 12, color: CHART_TEXT_COLOR, cursor: 'pointer' }}
          formatter={(value, entry) => {
            const dataKey = entry?.dataKey;
            return (
              <span
                style={{
                  opacity: visible[dataKey] ? 1 : 0.42,
                  color: visible[dataKey] ? CHART_TEXT_COLOR : CHART_MUTED_COLOR,
                  fontWeight: 600,
                }}
              >
                {value}
              </span>
            );
          }}
        />
        {DGA_TREND_LINES.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls
            hide={!visible[line.dataKey]}
            strokeDasharray={line.dashed ? '5 5' : undefined}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// --- Insight builder ---
function buildInsights(
  mapped,
  latest,
  previous,
  oilReferences = DEFAULT_ACTIVE_OIL_REFERENCES,
  cautionLimits = DGA_CAUTION_LIMITS,
  warningLimits = DGA_WARNING_LIMITS,
  standardLabel = 'IEEE C57.104-2008',
  supplementaryMetrics = {},
) {
  if (!latest) return [];
  const items = [];

  // DGA gas alerts
  DGA_GAS_KEYS.forEach((gas) => {
    const value = latest[gas];
    if (value === null || value === undefined) return;
    const caution = cautionLimits[gas];
    const warning = warningLimits[gas];
    if (caution && value > warning) {
      items.push({
        tone: 'critical',
        title: `${gas} above warning limit`,
        message: `Latest ${gas} = ${value} ppm exceeds ${standardLabel} warning threshold (${warning} ppm). Investigate immediately.`,
      });
    } else if (caution && value > caution) {
      items.push({
        tone: 'caution',
        title: `${gas} above caution limit`,
        message: `Latest ${gas} = ${value} ppm exceeds ${standardLabel} caution threshold (${caution} ppm).`,
      });
    }
  });

  // Trending — compare with previous
  if (previous) {
    ['H2', 'C2H2', 'C2H4', 'TDCG'].forEach((gas) => {
      const cur = latest[gas];
      const prev = previous[gas];
      if (cur && prev && prev > 0) {
        const pct = ((cur - prev) / prev) * 100;
        if (pct > 50 && cur > 10) {
          items.push({
            tone: 'caution',
            title: `${gas} trending up`,
            message: `${gas} increased ${pct.toFixed(0)}% from previous sample (${prev} → ${cur} ppm).`,
          });
        }
      }
    });
  }

  // Oil quality alerts
  [
    { key: 'breakdown', value: latest.BDV, title: 'Low breakdown voltage', label: 'Breakdown voltage', unit: 'kV' },
    { key: 'waterContent', value: latest.Moisture, title: 'High moisture', label: 'Water content', unit: 'ppm' },
    { key: 'acidity', value: latest.Acidity, title: 'Elevated acidity', label: 'Acidity', unit: 'mg KOH/g' },
  ].forEach(({ key, value, title, label, unit }) => {
    const severity = oilParamSeverity(key, value, oilReferences);
    if (severity !== null && severity >= 80) {
      items.push({
        tone: 'caution',
        title,
        message: `${label} ${value} ${unit} is outside the active IEC oil limit (${formatOilReferenceLimit(oilReferences[key])}).`,
      });
    }
  });

  const inhibitorMetric = supplementaryMetrics?.inhibitor;
  if (inhibitorMetric?.status === 'action') {
    items.push({
      tone: 'caution',
      title: 'Inhibitor depleted',
      message: `Inhibitor ${latest.Inhibitor}% is below the working re-inhibition band.`,
    });
  } else if (inhibitorMetric?.status === 'monitor') {
    items.push({
      tone: 'caution',
      title: 'Inhibitor near refill band',
      message: `Inhibitor ${latest.Inhibitor}% is entering the watch band for aged oil.`,
    });
  }

  const passivatorMetric = supplementaryMetrics?.passivator;
  if (passivatorMetric?.status === 'action') {
    items.push({
      tone: 'caution',
      title: 'Low passivator reserve',
      message: `Passivator ${latest.Passivator} mg/kg is below the 50 mg/kg working threshold.`,
    });
  }

  const furanMetric = supplementaryMetrics?.fal2;
  if (furanMetric?.status === 'action') {
    items.push({
      tone: 'critical',
      title: '2-FAL indicates advanced paper ageing',
      message: `2-FAL ${latest.Furan} ppb is above the 1000 ppb action threshold.`,
    });
  } else if (furanMetric?.status === 'monitor') {
    items.push({
      tone: 'caution',
      title: '2-FAL early warning',
      message: `2-FAL ${latest.Furan} ppb is in the 100-1000 ppb watch band.`,
    });
  }

  const methanolMetric = supplementaryMetrics?.methanol;
  if (methanolMetric?.status === 'action') {
    items.push({
      tone: 'critical',
      title: 'Methanol indicates extensive deterioration',
      message: `Methanol ${latest.Methanol} ppm is above the 0.20 ppm action threshold.`,
    });
  } else if (methanolMetric?.status === 'monitor') {
    items.push({
      tone: 'caution',
      title: 'Methanol early ageing signal',
      message: `Methanol ${latest.Methanol} ppm is in the 0.05-0.20 ppm watch band.`,
    });
  }

  // DP / Furan
  const dp = latest.DPFuran ?? latest.DPMethanol;
  if (dp !== null && dp !== undefined) {
    if (dp < 350) {
      items.push({
        tone: 'critical',
        title: 'End-of-life paper insulation',
        message: `Estimated DP ≈ ${dp}. Cellulose strength is severely degraded — plan strategic action.`,
      });
    } else if (dp < 500) {
      items.push({
        tone: 'caution',
        title: 'Aged paper insulation',
        message: `Estimated DP ≈ ${dp}. Mid-life ageing region; monitor closely.`,
      });
    }
  }

  // Corrosive sulphur
  if (latest.CopperCorrosive && String(latest.CopperCorrosive).toLowerCase() !== 'no' && String(latest.CopperCorrosive) !== '0') {
    items.push({
      tone: 'critical',
      title: 'Corrosive sulphur detected',
      message: 'Latest copper corrosion test result is positive. Passivator dosing or oil change required.',
    });
  }

  if (!items.length) {
    items.push({
      tone: 'good',
      title: 'No anomalies detected',
      message: 'All measured parameters are within healthy reference ranges based on the latest sample.',
    });
  }
  return items.slice(0, 8);
}

const INSIGHT_STYLES = {
  good: { icon: CheckCircle2, color: '#16a34a', bg: 'var(--success-soft)' },
  caution: { icon: AlertTriangle, color: '#f59e0b', bg: 'var(--warning-soft)' },
  critical: { icon: AlertTriangle, color: '#dc2626', bg: 'var(--danger-soft)' },
};

function InsightItem({ insight }) {
  const style = INSIGHT_STYLES[insight.tone] || INSIGHT_STYLES.good;
  const Icon = style.icon;
  return (
    <div
      className="flex items-start gap-3 rounded-md border border-[color:var(--border)] p-3"
      style={{ background: style.bg }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: style.color }} />
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{insight.title}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{insight.message}</p>
      </div>
    </div>
  );
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================
function TransformerHealthDashboard({
  transformer,
  oilTests = [],
  documents = [],
  compartmentLabel = '',
}) {
  const mapped = useMemo(() => {
    if (!oilTests || oilTests.length === 0) return [];
    return [...oilTests]
      .map(mapTest)
      .filter((t) => t.rawDate)
      .sort((a, b) => a.rawDate - b.rawDate);
  }, [oilTests]);

  const latest = mapped.length ? mapped[mapped.length - 1] : null;
  const previous = mapped.length > 1 ? mapped[mapped.length - 2] : null;
  const iecAssessment = useMemo(
    () => getOilQualityAssessment(latest?.raw || latest, transformer),
    [latest, transformer],
  );
  const supplementaryAssessment = useMemo(
    () => getOilQualitySupplementaryAssessment(latest?.raw || latest),
    [latest],
  );
  const supplementaryMetrics = supplementaryAssessment?.metrics || {};
  const supplementaryReferences = {
    inhibitor: getSupplementaryReference('inhibitor'),
    passivator: getSupplementaryReference('passivator'),
    fal2: getSupplementaryReference('fal2'),
    methanol: getSupplementaryReference('methanol'),
  };
  const oilReferences = iecAssessment?.profile?.limits || DEFAULT_ACTIVE_OIL_REFERENCES;
  const activeOilProfileLabel = [
    iecAssessment?.standard?.label || 'Active oil profile',
    iecAssessment?.limitProfile?.shortLabel,
    iecAssessment?.profile?.shortLabel,
  ].filter(Boolean).join(' - ');

  // Compartment name and asset age
  const yearBuilt = toNumber(transformer?.yearBuilt);
  const assetAge = yearBuilt ? new Date().getFullYear() - yearBuilt : null;

  const dgaLimits = useMemo(
    () => buildActiveDgaLimits(transformer, latest?.raw, assetAge),
    [transformer, latest, assetAge],
  );
  const { cautionLimits, warningLimits, standardLabel, standardKey, oilType } = dgaLimits;

  const healthScore = useMemo(
    () => computeHealthScore(latest, oilReferences, cautionLimits, warningLimits),
    [latest, oilReferences, cautionLimits, warningLimits],
  );
  const insights = useMemo(
    () => buildInsights(mapped, latest, previous, oilReferences, cautionLimits, warningLimits, standardLabel, supplementaryMetrics),
    [mapped, latest, previous, oilReferences, cautionLimits, warningLimits, standardLabel, supplementaryMetrics],
  );

  const trendData = useMemo(
    () =>
      mapped.map((t) => ({
        date: t.date,
        H2: t.H2,
        CH4: t.CH4,
        C2H6: t.C2H6,
        C2H4: t.C2H4,
        C2H2: t.C2H2,
        CO: t.CO,
        TDCG: t.TDCG,
      })),
    [mapped],
  );

  // Dataless state
  if (!latest) {
    return (
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-[var(--primary-strong)]" />
              Transformer Health Map Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[color:var(--border)] bg-[var(--card-muted)] p-10 text-center">
              <FlaskConical className="h-8 w-8 text-[var(--muted)]" />
              <p className="text-sm font-semibold text-[var(--foreground)]">No oil-test data available yet</p>
              <p className="text-xs text-[var(--muted)]">
                The dashboard becomes active once oil test records are added for the {compartmentLabel || 'selected'} compartment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const oilTypeSnapshot = getOilTypeSnapshot(latest, transformer);
  const oilSnapshots = {
    BDV: getMetricSnapshot(mapped, 'BDV'),
    Moisture: getMetricSnapshot(mapped, 'Moisture'),
    Acidity: getMetricSnapshot(mapped, 'Acidity'),
    IFT: getMetricSnapshot(mapped, 'IFT'),
    PowerFactor: getMetricSnapshot(mapped, 'PowerFactor'),
    Resistivity: getMetricSnapshot(mapped, 'Resistivity'),
    DBDS: getMetricSnapshot(mapped, 'DBDS'),
    Inhibitor: getMetricSnapshot(mapped, 'Inhibitor'),
    Passivator: getMetricSnapshot(mapped, 'Passivator'),
    Furan: getMetricSnapshot(mapped, 'Furan'),
    Methanol: getMetricSnapshot(mapped, 'Methanol'),
    DPFuran: getMetricSnapshot(mapped, 'DPFuran'),
    DPMethanol: getMetricSnapshot(mapped, 'DPMethanol'),
  };
  const getSupplementaryStatusForRecord = (record, metricKey) => {
    if (!record) return null;
    return getSupplementaryStatusSeverity(
      getOilQualitySupplementaryAssessment(record.raw || record)?.metrics?.[metricKey]?.status,
    );
  };
  const dpFuranValue = oilSnapshots.DPFuran.latestValue;
  const dpMethanolValue = oilSnapshots.DPMethanol.latestValue;
  const dpFuranBadge = getDpBadge(dpFuranValue);
  const dpMethanolBadge = getDpBadge(dpMethanolValue);
  const lifetimeSnapshotData = mapped.map((test) => ({
    ...test,
    LifetimeUsagePct:
      calcLifeUsedFromDp(test.DPFuran, test.DPMethanol) ??
      getLifetimeUsagePctForDate(yearBuilt, test.rawDate),
  }));
  const lifetimeSnapshot = getMetricSnapshot(lifetimeSnapshotData, 'LifetimeUsagePct');

  return (
    <div className="space-y-5">
      {/* === Hero banner === */}
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-md bg-[var(--card-muted)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Health Index
            </p>
            <HealthGauge score={healthScore} />
            <p className="mt-1 max-w-[180px] text-center text-[11px] leading-4 text-[var(--muted)]">
              Composite of DGA, oil quality and paper aging
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Transformer
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
                {transformer?.txName || 'Transformer'}
                <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                  {transformer?.mnemonic ? `· ${transformer.mnemonic}` : ''}
                </span>
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {transformer?.siteName || 'Unknown site'}
                {transformer?.serialNumber ? ` · S/N ${transformer.serialNumber}` : ''}
                {compartmentLabel ? ` · ${compartmentLabel}` : ''}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile
                icon={Droplets}
                label="Oil type"
                value={oilTypeSnapshot.value}
                helper={oilTypeSnapshot.helper}
              />
              <KpiTile
                icon={Layers}
                label="Samples"
                value={mapped.length.toString()}
                helper={`Latest ${formatRelativeDate(latest.raw?.testDate)}`}
              />
              <KpiTile
                icon={FileText}
                label="Type of paper"
                value={getPaperTypeLabel(transformer?.paperType) || '-'}
                helper={transformer?.paperType ? 'Insulation paper' : 'Not specified'}
              />
              <KpiTile
                icon={Zap}
                label="Rating"
                value={`${transformer?.voltage || '-'} · ${transformer?.loadMVA || '-'} MVA`}
                helper={transformer?.maker ? `Maker: ${transformer.maker}` : ''}
              />
            </div>
            <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
              <span className="font-semibold text-[var(--foreground)]">Disclaimer:</span>{' '}
              The Health Index is an advisory calculation from DGA, oil quality and paper aging data. It is not an
              official TNB Labs test certificate; always refer to the signed original certificate and verify
              authenticity with TNB Labs.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === Insights === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--primary-strong)]" />
            Diagnostic Insights
            <span className="ml-2 text-xs font-normal text-[var(--muted)]">
              Auto-generated from latest sample · {formatDate(latest.raw?.testDate)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {insights.map((insight, idx) => (
              <InsightItem key={idx} insight={insight} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* === DGA Section === */}
      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,0.86fr)_280px_minmax(0,0.96fr)]">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[var(--primary-strong)]" />
              DGA Snapshot vs caution limits
              <span className="ml-1 rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {standardLabel}
              </span>
              {standardKey === 'IEEE_2019' ? (
                <span className="text-[11px] font-normal text-[var(--muted)]">
                  age & O2/N2 ratio aware
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <DgaLimitsBars latest={latest} cautionLimits={cautionLimits} warningLimits={warningLimits} height={170} />
            <div className="mt-4 border-t border-[color:var(--border)] pt-4">
              <DgaTrendingChart data={trendData} height={214} />
            </div>
          </CardContent>
        </Card>
        <LifetimeUsageCard
          assetAge={assetAge}
          yearBuilt={yearBuilt}
          sampleDate={latest.raw?.testDate}
          dpFuran={latest.DPFuran}
          dpMethanol={latest.DPMethanol}
        />
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--primary-strong)]" />
              Latest Fault Snapshot
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                Latest sample · {formatDate(latest.raw?.testDate)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <FaultMethodsRadar latest={latest} standard={standardKey} oilType={oilType} />
          </CardContent>
        </Card>
      </div>

      {/* === Oil Quality Tiles === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-[var(--primary-strong)]" />
            Oil Quality &amp; Paper Aging
            {iecAssessment?.profile ? (
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                Active oil profile: {iecAssessment.standard?.label || 'IEC'} - {iecAssessment.limitProfile?.shortLabel || 'Routine'} - {iecAssessment.profile.shortLabel}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <OilTile
              icon={Zap}
              label="Breakdown Voltage"
              unit="kV"
              latest={oilSnapshots.BDV.latestValue}
              previous={oilSnapshots.BDV.previousValue}
              statusKey="breakdown"
              data={mapped}
              dataKey="BDV"
              referenceValue={getReferenceLineValue(oilReferences.breakdown)}
              oilReferences={oilReferences}
              referenceProfileLabel={activeOilProfileLabel}
            />
            <OilTile
              icon={Waves}
              label="Moisture"
              unit="ppm"
              latest={oilSnapshots.Moisture.latestValue}
              previous={oilSnapshots.Moisture.previousValue}
              statusKey="waterContent"
              data={mapped}
              dataKey="Moisture"
              referenceValue={getReferenceLineValue(oilReferences.waterContent)}
              inverse
              oilReferences={oilReferences}
              referenceProfileLabel={activeOilProfileLabel}
            />
            <OilTile
              icon={FlaskConical}
              label="Acidity"
              unit="mgKOH/g"
              latest={oilSnapshots.Acidity.latestValue}
              previous={oilSnapshots.Acidity.previousValue}
              statusKey="acidity"
              data={mapped}
              dataKey="Acidity"
              referenceValue={getReferenceLineValue(oilReferences.acidity)}
              inverse
              oilReferences={oilReferences}
              referenceProfileLabel={activeOilProfileLabel}
            />
            <OilTile
              icon={Droplets}
              label="IFT"
              unit="mN/m"
              latest={oilSnapshots.IFT.latestValue}
              previous={oilSnapshots.IFT.previousValue}
              statusKey="interfacialTension"
              data={mapped}
              dataKey="IFT"
              referenceValue={getReferenceLineValue(oilReferences.interfacialTension)}
              oilReferences={oilReferences}
              referenceProfileLabel={activeOilProfileLabel}
            />
            <OilTile
              icon={Gauge}
              label="Tan δ / PF"
              unit=""
              latest={oilSnapshots.PowerFactor.latestValue}
              previous={oilSnapshots.PowerFactor.previousValue}
              statusKey="powerFactor"
              data={mapped}
              dataKey="PowerFactor"
              referenceValue={getReferenceLineValue(oilReferences.powerFactor)}
              inverse
              oilReferences={oilReferences}
              referenceProfileLabel={activeOilProfileLabel}
            />
            <OilTile
              icon={Activity}
              label="Resistivity"
              unit={oilReferences.resistivity?.unit || ''}
              latest={oilSnapshots.Resistivity.latestValue}
              previous={oilSnapshots.Resistivity.previousValue}
              statusKey="resistivity"
              data={mapped}
              dataKey="Resistivity"
              referenceValue={getReferenceLineValue(oilReferences.resistivity)}
              oilReferences={oilReferences}
              referenceProfileLabel={activeOilProfileLabel}
            />
            <OilTile
              icon={AlertTriangle}
              label="DBDS"
              unit={oilReferences.dbds?.unit || 'mg/kg'}
              latest={oilSnapshots.DBDS.latestValue}
              previous={oilSnapshots.DBDS.previousValue}
              statusKey="dbds"
              data={mapped}
              dataKey="DBDS"
              referenceValue={getReferenceLineValue(oilReferences.dbds)}
              inverse
              oilReferences={oilReferences}
              referenceProfileLabel={activeOilProfileLabel}
            />
            <OilTile
              icon={Sparkles}
              label="Inhibitor"
              unit="%"
              latest={oilSnapshots.Inhibitor.latestValue}
              previous={oilSnapshots.Inhibitor.previousValue}
              statusOverride={getSupplementaryStatusForRecord(oilSnapshots.Inhibitor.latestRecord, 'inhibitor')}
              data={mapped}
              dataKey="Inhibitor"
              referenceValue={getSupplementaryReferenceLineValue('inhibitor')}
              tooltipReference={supplementaryReferences.inhibitor}
            />
            <OilTile
              icon={ShieldCheck}
              label="Passivator"
              unit="mg/kg"
              latest={oilSnapshots.Passivator.latestValue}
              previous={oilSnapshots.Passivator.previousValue}
              statusOverride={getSupplementaryStatusForRecord(oilSnapshots.Passivator.latestRecord, 'passivator')}
              data={mapped}
              dataKey="Passivator"
              referenceValue={getSupplementaryReferenceLineValue('passivator')}
              tooltipReference={supplementaryReferences.passivator}
            />
            <OilTile
              icon={ThermometerSun}
              label="2-FAL (Furan)"
              unit="ppb"
              latest={oilSnapshots.Furan.latestValue}
              previous={oilSnapshots.Furan.previousValue}
              statusOverride={getSupplementaryStatusForRecord(oilSnapshots.Furan.latestRecord, 'fal2')}
              data={mapped}
              dataKey="Furan"
              referenceValue={getSupplementaryReferenceLineValue('fal2')}
              tooltipReference={supplementaryReferences.fal2}
            />
            <OilTile
              icon={FileText}
              label="Methanol"
              unit="ppm"
              latest={oilSnapshots.Methanol.latestValue}
              previous={oilSnapshots.Methanol.previousValue}
              statusOverride={getSupplementaryStatusForRecord(oilSnapshots.Methanol.latestRecord, 'methanol')}
              data={mapped}
              dataKey="Methanol"
              referenceValue={getSupplementaryReferenceLineValue('methanol')}
              tooltipReference={supplementaryReferences.methanol}
            />
            <OilTile
              icon={HeartPulse}
              label="DP from Furan"
              unit=""
              latest={dpFuranValue}
              previous={oilSnapshots.DPFuran.previousValue}
              statusOverride={getDpSeverity(dpFuranValue)}
              data={mapped}
              dataKey="DPFuran"
              referenceValue={500}
              extraBadge={dpFuranBadge}
              tooltipLimitInfo={{
                title: 'DP interpretation',
                healthy: '>= 700',
                monitor: '500 to < 700',
                action: '< 500',
                source: 'DP estimated from 2-FAL',
              }}
              inverse
              precision={0}
            />
            <OilTile
              icon={HeartPulse}
              label="DP from Methanol"
              unit=""
              latest={dpMethanolValue}
              previous={oilSnapshots.DPMethanol.previousValue}
              statusOverride={getDpSeverity(dpMethanolValue)}
              data={mapped}
              dataKey="DPMethanol"
              referenceValue={500}
              extraBadge={dpMethanolBadge}
              tooltipLimitInfo={{
                title: 'DP interpretation',
                healthy: '>= 700',
                monitor: '500 to < 700',
                action: '< 500',
                source: 'DP estimated from Methanol',
              }}
              inverse
              precision={0}
            />
            <OilTile
              icon={Gauge}
              label="Lifetime Usage"
              unit="%"
              latest={lifetimeSnapshot.latestValue}
              previous={lifetimeSnapshot.previousValue}
              statusOverride={getLifetimeUsageSeverity(lifetimeSnapshot.latestValue)}
              data={lifetimeSnapshotData}
              dataKey="LifetimeUsagePct"
              referenceValue={75}
              tooltipLimitInfo={{
                title: 'Lifetime usage bands',
                healthy: '< 75 %',
                monitor: '75 to < 90 %',
                action: '>= 90 %',
                source: 'Calculated from selected DP estimate where available',
              }}
              precision={0}
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--muted)]">
        Reference thresholds: {standardLabel} (DGA), selected oil-type profile (oil quality), supplementary appearance /
        inhibitor / passivator / 2-FAL / methanol working references, and Dong &amp; Jalbert correlations (DP estimation). Indicators are
        advisory and should be reviewed by an asset specialist before action.
      </p>
    </div>
  );
}

// --- Oil tile (KPI card with sparkline) ---
function OilTile({
  icon,
  label,
  unit,
  latest,
  previous,
  statusKey,
  statusOverride,
  data,
  dataKey,
  referenceValue,
  inverse = false,
  extraBadge,
  precision = 2,
  oilReferences = DEFAULT_ACTIVE_OIL_REFERENCES,
  referenceProfileLabel,
  tooltipReference,
  tooltipLimitInfo,
}) {
  const value = latest;
  let severity = null;
  if (statusOverride !== undefined && statusOverride !== null) {
    severity = statusOverride;
  } else if (statusKey) {
    severity = oilParamSeverity(statusKey, value, oilReferences);
  }

  let trend = null;
  if (value !== null && previous !== null && previous !== undefined) {
    if (value > previous) trend = inverse ? 'up' : 'up-good';
    else if (value < previous) trend = inverse ? 'down-bad' : 'down';
  }

  const tone = severityLabel(severity);
  const activeReference = tooltipReference ?? (statusKey ? oilReferences?.[statusKey] : null);
  const sparklineLimitInfo =
    tooltipLimitInfo ??
    buildOilLimitInfo(activeReference, referenceProfileLabel) ??
    (referenceValue !== undefined && referenceValue !== null
      ? { title: 'Reference line', healthy: formatTooltipMetricValue(referenceValue, unit, precision) }
      : null);

  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon ? React.createElement(icon, { className: 'h-4 w-4 text-[var(--primary-strong)]' }) : null}
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
        </div>
        {severity !== null ? <Badge variant={tone.tone}>{tone.label}</Badge> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-xl font-semibold text-[var(--foreground)]">
          {value === null || value === undefined ? '-' : formatNumber(value, precision)}
        </p>
        {unit ? <p className="text-xs text-[var(--muted)]">{unit}</p> : null}
        {trend === 'up' ? <TrendingUp className="h-4 w-4 text-[#ef4444]" /> : null}
        {trend === 'up-good' ? <TrendingUp className="h-4 w-4 text-[#16a34a]" /> : null}
        {trend === 'down' ? <TrendingDown className="h-4 w-4 text-[#16a34a]" /> : null}
        {trend === 'down-bad' ? <TrendingDown className="h-4 w-4 text-[#ef4444]" /> : null}
      </div>
      {extraBadge ? (
        <div className="mt-1">
          <Badge variant={extraBadge.tone}>{extraBadge.label}</Badge>
        </div>
      ) : null}
      <div className="mt-2">
        <Sparkline
          data={data}
          dataKey={dataKey}
          referenceValue={referenceValue}
          unit={unit}
          precision={precision}
          resultLabel={label}
          limitInfo={sparklineLimitInfo}
        />
      </div>
      {previous !== null && previous !== undefined ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Prev: {formatNumber(previous, precision)} {unit}
        </p>
      ) : null}
    </div>
  );
}

function Mini({ label, value, unit }) {
  return (
    <div className="rounded-md bg-[var(--card)] px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="text-xs font-semibold text-[var(--foreground)]">
        {value} <span className="text-[10px] font-normal text-[var(--muted)]">{unit}</span>
      </p>
    </div>
  );
}


export default TransformerHealthDashboard;
