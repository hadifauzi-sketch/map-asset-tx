import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  FileText,
  FlaskConical,
  Gauge,
  HeartPulse,
  Image as ImageIcon,
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
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { isImageDocument } from '../lib/documentUtils';
import {
  IEC_60422_VOLTAGE_GROUPS,
  getHealthyRangeLabel,
} from '../lib/standards/iec60422Profiles';
import {
  getOilQualityAssessment,
  getOilQualitySupplementaryAssessment,
} from '../lib/standards/oilQualityAssessment';
import {
  getSupplementaryReferenceLineValue,
  getSupplementaryStatusSeverity,
} from '../lib/standards/supplementaryOilReferences';
import { analyzeSample, FAULT_METADATA, FAULT_SEVERITY, getFaultMethodsData } from '../lib/dga/diagnostics';
import { getStandardLabelForOilType, getStandardOptionsForOilType } from '../lib/dga/appConfig';

const CHART_TEXT_COLOR = 'var(--foreground)';
const CHART_AXIS_COLOR = 'color-mix(in srgb, var(--foreground) 58%, var(--border) 42%)';
const CHART_GRID_COLOR = 'color-mix(in srgb, var(--foreground) 12%, transparent)';
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

// --- Map a single oil test to chart-friendly object ---
function mapTest(test) {
  const d = new Date(test?.testDate);
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
    DPFuran: toNumber(test?.estimatedDpFuran),
    DPMethanol: toNumber(test?.estimatedDpMethanol),
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

// --- Sparkline component ---
function Sparkline({ data, dataKey, color = '#0d9488', height = 36, referenceValue }) {
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
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#spark-${dataKey})`}
          isAnimationActive={false}
          dot={false}
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
    <div className="flex flex-col items-center justify-center w-full">
      <svg viewBox="0 -8 220 188" width="100%" height="auto" style={{ maxWidth: 280 }}>
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
          fontSize="34"
          fontWeight="700"
          fill={bucket.color}
        >
          {score !== null && score !== undefined ? score : '-'}
        </text>
        <text x={cx} y={cy + 58} textAnchor="middle" fontSize="10" fill={CHART_AXIS_COLOR}>
          out of 100
        </text>
      </svg>
      <Badge variant={bucket.tone} className="mt-1 text-sm">
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

// Fault severity colour bands
const SEVERITY_COLOR = ['#6b7280', '#22c55e', '#eab308', '#f97316', '#ef4444'];
const SEVERITY_LABEL = ['No data', 'Low concern', 'Monitor', 'Action', 'Critical'];

// --- Fault Methods Radar ---
function FaultMethodsRadar({ latest }) {
  if (!latest) return null;
  const methods = getFaultMethodsData(latest?.raw || latest);
  if (!methods) {
    return (
      <p className="py-6 text-center text-xs text-[var(--muted)]">
        Insufficient gas data — five combustible gases (H₂, CH₄, C₂H₆, C₂H₄, C₂H₂) required.
      </p>
    );
  }

  const maxSeverity = Math.max(...methods.map((m) => m.severity));
  const strokeColor = SEVERITY_COLOR[maxSeverity] || SEVERITY_COLOR[0];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={methods} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke={CHART_GRID_COLOR} />
        <PolarAngleAxis
          dataKey="method"
          tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 4]}
          tickCount={5}
          tick={{ fill: CHART_AXIS_COLOR, fontSize: 9 }}
          stroke={CHART_GRID_COLOR}
        />
        <Radar
          name="Severity"
          dataKey="severity"
          stroke={strokeColor}
          fill={strokeColor}
          fillOpacity={0.28}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(value, _name, props) => {
            const { zone, fullName } = props.payload;
            const faultLabel = zone ? (FAULT_METADATA[zone]?.label ?? zone) : 'No data / not applicable';
            return [`${faultLabel} (score ${value})`, fullName];
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// --- DGA limits bar (latest vs caution / warning) ---
function DgaLimitsBars({ latest, cautionLimits = DGA_CAUTION_LIMITS, warningLimits = DGA_WARNING_LIMITS }) {
  if (!latest) return null;
  const data = DGA_GAS_KEYS.map((g) => ({
    gas: g,
    value: latest[g] ?? 0,
    caution: cautionLimits[g] ?? 0,
    severity: gasSeverity(g, latest[g], cautionLimits, warningLimits),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 6 }}>
        <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
        <XAxis dataKey="gas" stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }} />
        <YAxis stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 11 }} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(value, name) => [`${value} ppm`, name === 'value' ? 'Latest' : 'Caution limit']}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_TEXT_COLOR }} />
        <Bar dataKey="caution" name="Caution limit" fill="#94a3b8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="value" name="Latest" radius={[3, 3, 0, 0]}>
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

// --- Trend chart for selected metrics ---
function TrendChart({ data, lines }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
        <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }} />
        <YAxis stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_TEXT_COLOR }} />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls
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
  const oilReferences = iecAssessment?.profile?.limits || DEFAULT_ACTIVE_OIL_REFERENCES;

  // Compartment name and asset age
  const yearBuilt = toNumber(transformer?.yearBuilt);
  const assetAge = yearBuilt ? new Date().getFullYear() - yearBuilt : null;

  const dgaLimits = useMemo(
    () => buildActiveDgaLimits(transformer, latest?.raw, assetAge),
    [transformer, latest, assetAge],
  );
  const { cautionLimits, warningLimits, standardLabel, standardKey } = dgaLimits;

  const healthScore = useMemo(
    () => computeHealthScore(latest, oilReferences, cautionLimits, warningLimits),
    [latest, oilReferences, cautionLimits, warningLimits],
  );
  const insights = useMemo(
    () => buildInsights(mapped, latest, previous, oilReferences, cautionLimits, warningLimits, standardLabel, supplementaryMetrics),
    [mapped, latest, previous, oilReferences, cautionLimits, warningLimits, standardLabel, supplementaryMetrics],
  );

  const documentCount = useMemo(
    () => (documents || []).filter((d) => !isImageDocument(d)).length,
    [documents],
  );
  const imageCount = useMemo(
    () => (documents || []).filter((d) => isImageDocument(d)).length,
    [documents],
  );

  // Trend metrics for the multi-line chart
  const trendData = mapped.map((t) => ({
    date: t.date,
    H2: t.H2,
    TDCG: t.TDCG,
    Moisture: t.Moisture,
    BDV: t.BDV,
    Acidity: t.Acidity,
    Furan: t.Furan,
  }));

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

  const bucket = healthBucket(healthScore);
  const dpValue = latest.DPFuran ?? latest.DPMethanol ?? null;
  const dpBadge = (() => {
    if (dpValue === null) return null;
    if (dpValue >= 700) return { label: 'New / healthy', tone: 'success' };
    if (dpValue >= 500) return { label: 'Mid-life', tone: 'success' };
    if (dpValue >= 350) return { label: 'Aged', tone: 'warning' };
    return { label: 'End of life', tone: 'danger' };
  })();

  return (
    <div className="space-y-5">
      {/* === Hero banner === */}
      <Card>
        <CardContent className="grid gap-5 p-5 md:grid-cols-[280px_1fr]">
          <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-[var(--card-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Health Index
            </p>
            <HealthGauge score={healthScore} />
            <p className="mt-1 text-center text-xs text-[var(--muted)]">
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
                icon={Sparkles}
                label="Status"
                value={bucket.label}
                helper={
                  healthScore !== null && healthScore !== undefined
                    ? `Score ${healthScore}/100`
                    : 'Insufficient data'
                }
              />
              <KpiTile
                icon={Layers}
                label="Samples"
                value={mapped.length.toString()}
                helper={`Latest ${formatRelativeDate(latest.raw?.testDate)}`}
              />
              <KpiTile
                icon={ThermometerSun}
                label="Asset age"
                value={assetAge !== null ? assetAge.toString() : '-'}
                unit={assetAge !== null ? 'yrs' : ''}
                helper={yearBuilt ? `Built ${yearBuilt}` : 'Year unknown'}
              />
              <KpiTile
                icon={Zap}
                label="Rating"
                value={`${transformer?.voltage || '-'} · ${transformer?.loadMVA || '-'} MVA`}
                helper={transformer?.maker ? `Maker: ${transformer.maker}` : ''}
              />
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
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
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
          <CardContent>
            <DgaLimitsBars latest={latest} cautionLimits={cautionLimits} warningLimits={warningLimits} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[var(--muted)] sm:grid-cols-3">
              {DGA_GAS_KEYS.map((g) => (
                <div key={g} className="flex items-center justify-between rounded-md bg-[var(--card-muted)] px-2.5 py-1.5">
                  <span className="font-semibold">{g}</span>
                  <span className="font-mono">{formatNumber(latest[g], 1)} / {cautionLimits[g] ?? '-'} ppm</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Caution limits track the workspace standard for this transformer. Change it from the DGA Analysis modal to update markers and this view.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--primary-strong)]" />
              Fault Methods Radar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FaultMethodsRadar latest={latest} />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Each axis represents one diagnostic method. Score 0 = no data, 1 = low concern, 2 = monitor, 3 = action, 4 = critical.
            </p>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <OilTile
              icon={Zap}
              label="Breakdown Voltage"
              unit="kV"
              latest={latest.BDV}
              previous={previous?.BDV}
              statusKey="breakdown"
              data={mapped}
              dataKey="BDV"
              referenceValue={getReferenceLineValue(oilReferences.breakdown)}
              oilReferences={oilReferences}
            />
            <OilTile
              icon={Waves}
              label="Moisture"
              unit="ppm"
              latest={latest.Moisture}
              previous={previous?.Moisture}
              statusKey="waterContent"
              data={mapped}
              dataKey="Moisture"
              referenceValue={getReferenceLineValue(oilReferences.waterContent)}
              inverse
              oilReferences={oilReferences}
            />
            <OilTile
              icon={FlaskConical}
              label="Acidity"
              unit="mgKOH/g"
              latest={latest.Acidity}
              previous={previous?.Acidity}
              statusKey="acidity"
              data={mapped}
              dataKey="Acidity"
              referenceValue={getReferenceLineValue(oilReferences.acidity)}
              inverse
              oilReferences={oilReferences}
            />
            <OilTile
              icon={Droplets}
              label="IFT"
              unit="mN/m"
              latest={latest.IFT}
              previous={previous?.IFT}
              statusKey="interfacialTension"
              data={mapped}
              dataKey="IFT"
              referenceValue={getReferenceLineValue(oilReferences.interfacialTension)}
              oilReferences={oilReferences}
            />
            <OilTile
              icon={Gauge}
              label="Tan δ / PF"
              unit=""
              latest={latest.PowerFactor}
              previous={previous?.PowerFactor}
              statusKey="powerFactor"
              data={mapped}
              dataKey="PowerFactor"
              referenceValue={getReferenceLineValue(oilReferences.powerFactor)}
              inverse
              oilReferences={oilReferences}
            />
            <OilTile
              icon={Sparkles}
              label="Inhibitor"
              unit="%"
              latest={latest.Inhibitor}
              previous={previous?.Inhibitor}
              statusOverride={getSupplementaryStatusSeverity(supplementaryMetrics.inhibitor?.status)}
              data={mapped}
              dataKey="Inhibitor"
              referenceValue={getSupplementaryReferenceLineValue('inhibitor')}
            />
            <OilTile
              icon={ShieldCheck}
              label="Passivator"
              unit="mg/kg"
              latest={latest.Passivator}
              previous={previous?.Passivator}
              statusOverride={getSupplementaryStatusSeverity(supplementaryMetrics.passivator?.status)}
              data={mapped}
              dataKey="Passivator"
              referenceValue={getSupplementaryReferenceLineValue('passivator')}
            />
            <OilTile
              icon={ThermometerSun}
              label="2-FAL (Furan)"
              unit="ppb"
              latest={latest.Furan}
              previous={previous?.Furan}
              statusOverride={getSupplementaryStatusSeverity(supplementaryMetrics.fal2?.status)}
              data={mapped}
              dataKey="Furan"
              referenceValue={getSupplementaryReferenceLineValue('fal2')}
            />
            <OilTile
              icon={FileText}
              label="Methanol"
              unit="ppm"
              latest={latest.Methanol}
              previous={previous?.Methanol}
              statusOverride={getSupplementaryStatusSeverity(supplementaryMetrics.methanol?.status)}
              data={mapped}
              dataKey="Methanol"
              referenceValue={getSupplementaryReferenceLineValue('methanol')}
            />
            <OilTile
              icon={HeartPulse}
              label={dpValue !== null ? 'DP estimate' : 'DP estimate'}
              unit=""
              latest={dpValue}
              previous={previous?.DPFuran ?? previous?.DPMethanol}
              statusOverride={
                dpValue === null
                  ? null
                  : dpValue < 350
                    ? 90
                    : dpValue < 500
                      ? 60
                      : dpValue < 700
                        ? 25
                        : 5
              }
              data={mapped}
              dataKey={latest.DPFuran !== null ? 'DPFuran' : 'DPMethanol'}
              referenceValue={500}
              extraBadge={dpBadge}
              inverse
            />
          </div>
        </CardContent>
      </Card>

      {/* === Records summary === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--primary-strong)]" />
            Records Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryRow icon={FlaskConical} label="Oil tests" value={mapped.length} />
            <SummaryRow icon={FileText} label="Documents" value={documentCount} />
            <SummaryRow icon={ImageIcon} label="Images" value={imageCount} />
            <SummaryRow
              icon={ThermometerSun}
              label="Last sample"
              value={formatDate(latest.raw?.testDate)}
              helper={formatRelativeDate(latest.raw?.testDate)}
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
  oilReferences = DEFAULT_ACTIVE_OIL_REFERENCES,
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
          {value === null || value === undefined ? '-' : formatNumber(value, 2)}
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
        <Sparkline data={data} dataKey={dataKey} referenceValue={referenceValue} />
      </div>
      {previous !== null && previous !== undefined ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Prev: {formatNumber(previous, 2)} {unit}
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

function SummaryRow({ icon: Icon, label, value, helper }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-[var(--card-muted)] px-4 py-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-strong)]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
        {helper ? <p className="text-[11px] text-[var(--muted)]">{helper}</p> : null}
      </div>
    </div>
  );
}

export default TransformerHealthDashboard;
