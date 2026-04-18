import React, { useState, useMemo, useCallback, useEffect } from 'react';

// ─── Gas constants ────────────────────────────────────────────────────────────
const GAS_COLORS = {
  H2: '#3b82f6', CH4: '#22c55e', C2H6: '#f59e0b',
  C2H4: '#ef4444', C2H2: '#8b5cf6', CO: '#06b6d4', CO2: '#ec4899',
};
const GAS_NAMES = {
  H2: 'Hydrogen', CH4: 'Methane', C2H6: 'Ethane', C2H4: 'Ethylene',
  C2H2: 'Acetylene', CO: 'Carbon Monoxide', CO2: 'Carbon Dioxide',
  O2: 'Oxygen', N2: 'Nitrogen',
};
const FAULT_DESC = {
  PD:   { name: 'Partial Discharge',      color: '#3b82f6' },
  T1:   { name: 'Thermal < 300°C',        color: '#22c55e' },
  T2:   { name: 'Thermal 300–700°C',      color: '#eab308' },
  T3:   { name: 'Thermal > 700°C',        color: '#f97316' },
  'T2-H': { name: 'Thermal in Oil 300–700°C', color: '#eab308' },
  'T3-H': { name: 'Thermal in Oil > 700°C',   color: '#f97316' },
  D1:   { name: 'Low Energy Discharge',   color: '#ef4444' },
  D2:   { name: 'High Energy Discharge',  color: '#dc2626' },
  DT:   { name: 'Mixed Fault',            color: '#8b5cf6' },
  S:    { name: 'Stray Gassing',          color: '#06b6d4' },
  O:    { name: 'Overheating',            color: '#84cc16' },
  C:    { name: 'Carbonization',          color: '#f59e0b' },
  ND:   { name: 'Not Determined',         color: '#94a3b8' },
};
const STATUS_DESC = {
  1: { name: 'Normal',  color: '#22c55e', bg: '#22c55e20' },
  2: { name: 'Caution', color: '#f59e0b', bg: '#f59e0b20' },
  3: { name: 'Warning', color: '#ef4444', bg: '#ef444420' },
};

// ─── Heptagon constants ───────────────────────────────────────────────────────
const HEPTAGON_GASES_ORDER = ['CO', 'CO2', 'C2H4', 'H2', 'CH4', 'C2H2', 'C2H6'];
const WEIGHTING_FACTORS = { H2: 3.5, CH4: 2.9167, C2H6: 5.3846, C2H4: 7.0, C2H2: 116.6667, CO: 1.0, CO2: 0.14 };
const HEPTAGON_NORMAL_LIMITS = { H2: 100, CH4: 120, C2H4: 50, C2H6: 65, C2H2: 3, CO: 350, CO2: 2500 };
const HEPTAGON_FAULT_COLORS = {
  Normal: '#22c55e', HCCD: '#dc2626', MCCD: '#f97316', LCCD: '#eab308',
  T1: '#06b6d4', T2: '#3b82f6', T3: '#6366f1', PD: '#a855f7',
  D1: '#ec4899', D2: '#f43f5e', TD: '#8b5cf6',
};
const HEPTAGON_FAULT_DESCRIPTIONS = {
  Normal: 'Normal operation — no significant fault detected.',
  HCCD: 'High Concentration Cellulose Degradation — CO dominant (>60%), CO₂ <25%.',
  MCCD: 'Medium Concentration Cellulose Degradation — CO 45–60%, CO₂ 25–50%.',
  LCCD: 'Low Concentration Cellulose Degradation — CO 18–45%, CO₂ >50%.',
  T1: 'Thermal Fault T1 (<300°C) — mainly CH₄ and C₂H₆ with minor ethylene.',
  T2: 'Thermal Fault T2 (300–700°C) — significant C₂H₄ with CH₄.',
  T3: 'Thermal Fault T3 (>700°C) — dominated by C₂H₄ with high H₂.',
  PD: 'Partial Discharge — mainly H₂ with small CH₄ and trace C₂H₂.',
  D1: 'Low Energy Discharge — H₂ >60% with C₂H₂ <50%.',
  D2: 'High Energy Discharge — C₂H₂ >50% with high H₂.',
  TD: 'Thermal & Electrical Fault — mixed thermal and discharge mechanisms.',
};

// ─── Utility ──────────────────────────────────────────────────────────────────
const parseGas = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };

function getAgeLimits(age, o2n2) {
  if (o2n2 <= 0.2) {
    if (age === null || age < 1)
      return { table1: { H2:100, CH4:90, C2H6:90, C2H4:50, C2H2:2, CO:350, CO2:2500 }, table2: { H2:200, CH4:180, C2H6:180, C2H4:100, C2H2:4, CO:570, CO2:4000 } };
    if (age < 10)
      return { table1: { H2:75, CH4:45, C2H6:30, C2H4:20, C2H2:1, CO:350, CO2:2500 }, table2: { H2:150, CH4:90, C2H6:60, C2H4:40, C2H2:2, CO:570, CO2:4000 } };
    if (age < 30)
      return { table1: { H2:100, CH4:90, C2H6:90, C2H4:50, C2H2:2, CO:500, CO2:3500 }, table2: { H2:200, CH4:180, C2H6:180, C2H4:100, C2H2:4, CO:800, CO2:5500 } };
    return { table1: { H2:999999, CH4:110, C2H6:150, C2H4:90, C2H2:2, CO:700, CO2:4500 }, table2: { H2:999999, CH4:220, C2H6:300, C2H4:180, C2H2:4, CO:1000, CO2:7000 } };
  }
  return { table1: { H2:100, CH4:120, C2H6:65, C2H4:50, C2H2:1, CO:500, CO2:5000 }, table2: { H2:200, CH4:240, C2H6:130, C2H4:100, C2H2:2, CO:800, CO2:7500 } };
}

function calcStatus(gv, age, o2n2) {
  const limits = getAgeLimits(age, o2n2);
  let s2 = false, s1 = false;
  const t = parseGas(gv.H2)+parseGas(gv.CH4)+parseGas(gv.C2H6)+parseGas(gv.C2H4)+parseGas(gv.C2H2)+parseGas(gv.CO);
  ['H2','CH4','C2H6','C2H4','C2H2','CO','CO2'].forEach(g => {
    const v = parseGas(gv[g]);
    if (v > limits.table2[g]) s2 = true;
    if (v > limits.table1[g]) s1 = true;
  });
  if (t > 1920) return 3;
  if (t > 720) return s2 ? 3 : 2;
  return s2 ? 3 : s1 ? 2 : 1;
}

function calcDuval1(gv) {
  const ch4 = parseGas(gv.CH4), c2h4 = parseGas(gv.C2H4), c2h2 = parseGas(gv.C2H2), total = ch4+c2h4+c2h2;
  if (total === 0) return null;
  const pctCH4 = (ch4/total)*100, pctC2H4 = (c2h4/total)*100, pctC2H2 = (c2h2/total)*100;
  let faultZone = 'T1';
  if (pctCH4 >= 98) faultZone = 'PD';
  else if (pctC2H4 >= 50 && pctC2H2 < 15) faultZone = 'T3';
  else if (pctC2H2 >= 13) faultZone = pctC2H4 < 23 ? 'D1' : 'D2';
  else if (pctC2H2 >= 4) faultZone = 'DT';
  else if (pctC2H4 >= 20) faultZone = 'T2';
  return { pctCH4, pctC2H4, pctC2H2, faultZone };
}

function calcDuval4(gv) {
  const h2 = parseGas(gv.H2), ch4 = parseGas(gv.CH4), c2h6 = parseGas(gv.C2H6), total = h2+ch4+c2h6;
  if (total === 0) return null;
  const pctH2 = (h2/total)*100, pctCH4 = (ch4/total)*100, pctC2H6 = (c2h6/total)*100;
  let faultZone = 'S';
  if (pctH2 >= 90) faultZone = 'PD';
  else if (pctCH4 >= 64) faultZone = 'C';
  else if (pctC2H6 >= 52) faultZone = 'O';
  return { pctH2, pctCH4, pctC2H6, faultZone };
}

function calcDuval5(gv) {
  const ch4 = parseGas(gv.CH4), c2h4 = parseGas(gv.C2H4), c2h6 = parseGas(gv.C2H6), total = ch4+c2h4+c2h6;
  if (total === 0) return null;
  const pctCH4 = (ch4/total)*100, pctC2H4 = (c2h4/total)*100, pctC2H6 = (c2h6/total)*100;
  let faultZone = 'ND';
  if (pctCH4 >= 98) faultZone = 'PD';
  else if (pctC2H4 >= 50) faultZone = 'T3-H';
  else if (pctCH4 >= 35 && pctCH4 <= 75 && pctC2H4 >= 10 && pctC2H4 < 40) faultZone = 'C';
  else if (pctC2H4 >= 20) faultZone = 'T2-H';
  else if (pctC2H6 >= 50) faultZone = 'S';
  else if (pctCH4 >= 40) faultZone = 'O';
  return { pctCH4, pctC2H4, pctC2H6, faultZone };
}

function calcPentagon(gv) {
  const h2 = parseGas(gv.H2), ch4 = parseGas(gv.CH4), c2h6 = parseGas(gv.C2H6),
        c2h4 = parseGas(gv.C2H4), c2h2 = parseGas(gv.C2H2),
        total = h2+ch4+c2h6+c2h4+c2h2;
  if (total === 0) return null;
  const pctH2=(h2/total)*100, pctCH4=(ch4/total)*100, pctC2H6=(c2h6/total)*100,
        pctC2H4=(c2h4/total)*100, pctC2H2=(c2h2/total)*100;
  let faultZone = 'S';
  if (pctH2 > 85) faultZone = 'PD';
  else if (pctC2H2 > 20) faultZone = pctC2H4 > 20 ? 'D2' : 'D1';
  else if (pctC2H4 > 50) faultZone = 'T3-H';
  else if (pctCH4 > 45 && pctC2H4 >= 10 && pctC2H4 < 30) faultZone = 'C';
  else if (pctC2H4 > 20) faultZone = 'T2-H';
  else if (pctC2H6 > 35 && pctCH4 < 50) faultZone = 'O';
  else if (pctCH4 > 50) faultZone = 'T1';
  return { pctH2, pctCH4, pctC2H6, pctC2H4, pctC2H2, faultZone };
}

// ─── Heptagon analysis ────────────────────────────────────────────────────────
function computeWeightedPercentages(gases) {
  let total = 0;
  const weighted = {};
  for (const gas of HEPTAGON_GASES_ORDER) {
    const val = (parseFloat(gases[gas]) || 0) * WEIGHTING_FACTORS[gas];
    weighted[gas] = val;
    total += val;
  }
  if (total === 0) return null;
  const pct = {};
  for (const gas of HEPTAGON_GASES_ORDER) pct[gas] = (weighted[gas] / total) * 100;
  return pct;
}

function checkExceedsNormal(gases) {
  const exceeded = [];
  for (const [gas, limit] of Object.entries(HEPTAGON_NORMAL_LIMITS)) {
    const val = parseFloat(gases[gas]) || 0;
    if (val > limit) exceeded.push({ gas, value: val, limit });
  }
  return exceeded;
}

function determineFault(pct) {
  if (!pct) return 'Normal';
  const { CO: co, CO2: co2, C2H4: c2h4, H2: h2, CH4: ch4, C2H2: c2h2, C2H6: c2h6 } = pct;
  if (co > 60 && co2 <= 25) return 'HCCD';
  if (co >= 45 && co <= 60 && co2 > 25 && co2 <= 50) return 'MCCD';
  if (co >= 18 && co < 45 && co2 > 50) return 'LCCD';
  if (c2h2 > 50 && h2 > 60 && c2h6 <= 75 && co < 50) return 'D2';
  if (h2 > 60 && c2h2 <= 50 && c2h2 > 5) return 'D1';
  if (c2h6 >= 90 && c2h2 < 50 && h2 > 60) return 'D1';
  if (h2 > 60 && ch4 <= 40 && c2h2 <= 40 && c2h4 <= 40) return 'PD';
  if (c2h4 > 75 && h2 <= 54 && ch4 < 40) return 'T3';
  if (c2h4 <= 75 && c2h4 > 50 && h2 <= 54 && ch4 >= 25) return 'T3';
  if (c2h4 > 50 && c2h4 <= 75 && h2 <= 30 && ch4 >= 25 && ch4 <= 66) return 'T2';
  if (c2h4 <= 50 && h2 > 30 && h2 <= 54 && ch4 < 25) return 'T2';
  if (c2h4 <= 50 && h2 <= 30 && ch4 <= 66) return 'T1';
  if (c2h4 > 40 && c2h2 > 10 && h2 > 30) return 'TD';
  if (c2h4 > 50) return 'T2';
  if (ch4 > 40 && c2h4 > 20) return 'T1';
  if (co > 30 && co2 > 30) return 'LCCD';
  if (co > 40) return 'MCCD';
  return 'Normal';
}

// ─── Heptagon SVG chart ───────────────────────────────────────────────────────
function getHeptagonPoints(cx, cy, r, n = 7) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = -(Math.PI * 2 * i) / n - Math.PI / 2;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

function HeptagonChart({ percentages, fault }) {
  const cx = 250, cy = 250, R = 200;
  const outerPts = getHeptagonPoints(cx, cy, R);
  const outerPath = outerPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const ringPaths = rings.map(s => {
    const pts = getHeptagonPoints(cx, cy, R * s);
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
  });
  let dataPath = '', dataPoints = [];
  if (percentages) {
    dataPoints = HEPTAGON_GASES_ORDER.map((gas, i) => {
      const frac = Math.min(percentages[gas] / 100, 1);
      const angle = -(Math.PI * 2 * i) / 7 - Math.PI / 2;
      return [cx + R * frac * Math.cos(angle), cy + R * frac * Math.sin(angle)];
    });
    dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
  }
  const labelPts = getHeptagonPoints(cx, cy, R + 30);
  const gasLabels = ['CO', 'CO₂', 'C₂H₄', 'H₂', 'CH₄', 'C₂H₂', 'C₂H₆'];
  const faultColor = HEPTAGON_FAULT_COLORS[fault] || '#6b7280';

  return (
    <svg viewBox="0 0 500 500" style={{ width: '100%', maxWidth: 420, margin: '0 auto', display: 'block' }}>
      <defs>
        <filter id="hept-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {ringPaths.map((path, i) => (
        <path key={i} d={path} fill="none" stroke={i === rings.length - 1 ? '#555' : '#333'} strokeWidth={i === rings.length - 1 ? 1.5 : 0.5} strokeDasharray={i < rings.length - 1 ? '3,3' : 'none'} />
      ))}
      {outerPts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="#444" strokeWidth="0.5" />)}
      <path d={outerPath} fill="none" stroke="#555" strokeWidth="1.5" />
      {rings.map((s, i) => (
        <text key={i} x={cx + 8} y={cy - R * s + 4} fontSize="8" fill="#666" fontFamily="monospace">{Math.round(s * 100)}%</text>
      ))}
      {percentages && (
        <>
          <path d={dataPath} fill={faultColor} fillOpacity="0.18" stroke={faultColor} strokeWidth="2.5" filter="url(#hept-glow)" />
          {dataPoints.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="5" fill={faultColor} stroke="white" strokeWidth="2" />)}
        </>
      )}
      <circle cx={cx} cy={cy} r="3" fill="#666" />
      {labelPts.map((p, i) => (
        <text key={i} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700" fill="#ccc" fontFamily="monospace">{gasLabels[i]}</text>
      ))}
      {percentages && HEPTAGON_GASES_ORDER.map((gas, i) => {
        const frac = Math.min(percentages[gas] / 100, 1);
        if (frac < 0.05) return null;
        const angle = -(Math.PI * 2 * i) / 7 - Math.PI / 2;
        return (
          <text key={gas} x={cx + R * frac * Math.cos(angle)} y={cy + R * frac * Math.sin(angle) - 12} textAnchor="middle" fontSize="9" fill={faultColor} fontWeight="700" fontFamily="monospace">
            {percentages[gas].toFixed(1)}%
          </text>
        );
      })}
    </svg>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card = ({ children, style }) => (
  <div style={{ background: '#1e1e1e', borderRadius: 14, border: '1px solid #333', padding: 20, ...style }}>
    {children}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DGAAnalysisModal({ initialGases, initialTransformer }) {
  const [gasValues, setGasValues] = useState({
    H2: String(initialGases?.H2 ?? ''),
    CH4: String(initialGases?.CH4 ?? ''),
    C2H6: String(initialGases?.C2H6 ?? ''),
    C2H4: String(initialGases?.C2H4 ?? ''),
    C2H2: String(initialGases?.C2H2 ?? ''),
    CO: String(initialGases?.CO ?? ''),
    CO2: String(initialGases?.CO2 ?? ''),
    O2: String(initialGases?.O2 ?? ''),
    N2: String(initialGases?.N2 ?? ''),
  });

  const transformerInfo = {
    siteLocation: initialTransformer?.location || '',
    mnemonic: initialTransformer?.mnemonic || '',
    serialNumber: initialTransformer?.serialNo || '',
    manufacturer: initialTransformer?.manufacturer || '',
    voltage: initialTransformer?.voltage || '',
    mvaRating: initialTransformer?.rating || '',
    yearBuilt: initialTransformer?.yearMfg || '',
    sampleDate: initialTransformer?.sampleDate || '',
  };

  const [activeTab, setActiveTab] = useState('input');
  const [activeDuvalSub, setActiveDuvalSub] = useState('T1');

  // ── Derived ──
  const o2n2Ratio = useMemo(() => {
    const o2 = parseGas(gasValues.O2), n2 = parseGas(gasValues.N2);
    return n2 === 0 ? 0 : o2 / n2;
  }, [gasValues.O2, gasValues.N2]);

  const tdcg = useMemo(() =>
    parseGas(gasValues.H2)+parseGas(gasValues.CH4)+parseGas(gasValues.C2H6)+
    parseGas(gasValues.C2H4)+parseGas(gasValues.C2H2)+parseGas(gasValues.CO),
    [gasValues]
  );

  const transformerAge = useMemo(() => {
    if (!transformerInfo.yearBuilt) return null;
    const y = parseInt(transformerInfo.yearBuilt);
    return isNaN(y) ? null : new Date().getFullYear() - y;
  }, [transformerInfo.yearBuilt]);

  const ageLimits = useMemo(() => getAgeLimits(transformerAge, o2n2Ratio), [transformerAge, o2n2Ratio]);
  const dgaStatus = useMemo(() => calcStatus(gasValues, transformerAge, o2n2Ratio), [gasValues, transformerAge, o2n2Ratio]);

  const duvalT1 = useMemo(() => calcDuval1(gasValues), [gasValues]);
  const duvalT4 = useMemo(() => calcDuval4(gasValues), [gasValues]);
  const duvalT5 = useMemo(() => calcDuval5(gasValues), [gasValues]);
  const duvalP1 = useMemo(() => calcPentagon(gasValues), [gasValues]);

  const rogersRatios = useMemo(() => {
    const ch4 = parseGas(gasValues.CH4), h2 = parseGas(gasValues.H2),
          c2h4 = parseGas(gasValues.C2H4), c2h6 = parseGas(gasValues.C2H6),
          c2h2 = parseGas(gasValues.C2H2);
    if (h2 === 0 || c2h4 === 0 || c2h6 === 0) return null;
    const r1 = c2h2/c2h4, r2 = ch4/h2, r3 = c2h4/c2h6;
    let diagnosis = 'Undetermined';
    if (r1 < 0.1 && r2 >= 0.1 && r2 <= 1.0 && r3 < 1.0) diagnosis = 'Normal Aging';
    else if (r1 < 0.1 && r2 < 0.1) diagnosis = 'Partial Discharge';
    else if (r1 >= 0.1 && r1 <= 3.0 && r3 > 3.0) diagnosis = 'Arcing Fault';
    else if (r1 < 0.1 && r2 > 1.0 && r3 <= 3.0) diagnosis = 'Thermal < 700°C';
    else if (r1 < 0.1 && r2 > 1.0 && r3 > 3.0) diagnosis = 'Thermal > 700°C';
    return { r1, r2, r3, diagnosis };
  }, [gasValues]);

  const co2coRatio = useMemo(() => {
    const co = parseGas(gasValues.CO), co2 = parseGas(gasValues.CO2);
    if (co === 0) return null;
    const ratio = co2/co;
    return { ratio, interpretation: ratio < 3 ? 'Thermal fault in cellulose' : 'Normal', severity: ratio < 3 ? 'warning' : 'normal' };
  }, [gasValues]);

  const gasAnalysis = useMemo(() => {
    const msgs = { H2:'Hydrogen – partial discharge or overheating', CH4:'Methane – low-temp decomposition', C2H6:'Ethane – thermal 200–400°C', C2H4:'Ethylene – high-temp fault', C2H2:'Acetylene – CRITICAL: arcing!', CO:'CO – cellulose degradation' };
    return ['H2','CH4','C2H6','C2H4','C2H2','CO'].reduce((acc, g) => {
      const v = parseGas(gasValues[g]);
      if (v > ageLimits.table1[g]) {
        acc.push({ gas: g, level: v > ageLimits.table2[g] ? 'High' : 'Elevated', message: msgs[g], color: v > ageLimits.table2[g] ? '#ef4444' : '#f59e0b' });
      }
      return acc;
    }, []);
  }, [gasValues, ageLimits]);

  const ieeeAssessment = useMemo(() => {
    const fault = duvalT1?.faultZone;
    let condition, action, interval, recommendations = [];
    if (dgaStatus === 1) { condition = 'Normal'; action = 'Continue operation'; interval = 'Annual'; recommendations = ['Maintain routine schedule']; }
    else if (dgaStatus === 2) { condition = 'Caution'; action = 'Increase monitoring'; interval = 'Quarterly'; recommendations = ['Increase sampling frequency', 'Review history']; }
    else { condition = 'Warning'; action = 'Investigation required'; interval = 'Monthly'; recommendations = ['Engineering review', 'Consider load reduction', 'Inspection needed']; }
    if (fault === 'D1' || fault === 'D2') recommendations.push('Check connections');
    if (fault === 'T3') recommendations.push('Inspect for hot spots');
    if (fault === 'PD') recommendations.push('Check insulation');
    return { condition, action, interval, recommendations };
  }, [dgaStatus, duvalT1]);

  // ── Heptagon ──
  const heptagonExceeded = useMemo(() => checkExceedsNormal(gasValues), [gasValues]);
  const heptagonPct = useMemo(() => computeWeightedPercentages(gasValues), [gasValues]);
  const heptagonFault = useMemo(() => {
    if (heptagonExceeded.length === 0) return 'Normal';
    return determineFault(heptagonPct);
  }, [heptagonExceeded, heptagonPct]);
  const heptagonFaultColor = HEPTAGON_FAULT_COLORS[heptagonFault] || '#6b7280';

  const handleGasChange = useCallback((g, v) => setGasValues(p => ({ ...p, [g]: v })), []);

  // ── Tabs ──
  const tabs = [
    { id: 'input',      label: 'Input',      icon: '📝' },
    { id: 'duval',      label: 'Duval',      icon: '🔺' },
    { id: 'heptagon',   label: 'Heptagon',   icon: '⬡' },
    { id: 'assessment', label: 'Assessment', icon: '📋' },
  ];

  const duvalConfigs = {
    T1: { src: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Duval_Triangle_1.png', data: duvalT1, vb: '0 0 1005 1024', calc: d => ({ x:(d.pctCH4/100)*500+(d.pctC2H4/100)*972+(d.pctC2H2/100)*28, y:(d.pctCH4/100)*55+(d.pctC2H4/100)*928+(d.pctC2H2/100)*928 }) },
    T4: { src: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Duval_Triangle_4.png', data: duvalT4, vb: '0 0 1005 1024', calc: d => ({ x:(d.pctH2/100)*500+(d.pctCH4/100)*972+(d.pctC2H6/100)*28, y:(d.pctH2/100)*55+(d.pctCH4/100)*928+(d.pctC2H6/100)*928 }) },
    T5: { src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Duval_Triangle_5.png', data: duvalT5, vb: '0 0 1005 1024', calc: d => ({ x:(d.pctCH4/100)*500+(d.pctC2H4/100)*972+(d.pctC2H6/100)*28, y:(d.pctCH4/100)*55+(d.pctC2H4/100)*928+(d.pctC2H6/100)*928 }) },
    P1: { src: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Duval_Pentagram_3.png', data: duvalP1, vb: '0 0 976 822', calc: d => {
      const cx=488,cy=433,r=224,ang=[90,18,-54,-126,162].map(a=>a*Math.PI/180),pcts=[d.pctH2,d.pctC2H2,d.pctC2H4,d.pctC2H6,d.pctCH4];
      let px=cx,py=cy;
      pcts.forEach((p,i)=>{px+=(p/100)*r*0.85*Math.cos(ang[i]);py-=(p/100)*r*0.85*Math.sin(ang[i]);});
      return {x:px,y:py};
    }},
  };
  const duvalLegendKeys = { T1:['PD','T1','T2','T3','D1','D2','DT'], T4:['PD','S','O','C'], T5:['PD','S','O','C','T2-H','T3-H'], P1:['PD','S','O','C','T1','T2-H','T3-H','D1','D2'] };

  return (
    <div style={{ minHeight: '100%', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', color: '#e0e0e0' }}>

      {/* ── Tab bar ── */}
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #333', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', padding: '0 20px' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '13px 20px', background: 'transparent', border: 'none',
              borderBottom: activeTab === t.id ? '3px solid #00d4aa' : '3px solid transparent',
              color: activeTab === t.id ? '#00d4aa' : '#888',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>

        {/* ══════════ INPUT TAB ══════════ */}
        {activeTab === 'input' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>

            {/* Transformer Info */}
            <Card>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e0e0e0' }}>⚡ Transformer Info</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Site', transformerInfo.siteLocation], ['Serial No.', transformerInfo.serialNumber],
                  ['Mnemonic', transformerInfo.mnemonic], ['MVA', transformerInfo.mvaRating],
                  ['Voltage', transformerInfo.voltage], ['Year Built', transformerInfo.yearBuilt],
                  ['Sample Date', transformerInfo.sampleDate], ['Manufacturer', transformerInfo.manufacturer],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
                    <div style={{ padding: '8px 10px', background: '#2a2a2a', borderRadius: 8, fontSize: 13, color: '#ccc', border: '1px solid #444' }}>
                      {value || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Gas Values */}
            <Card>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e0e0e0' }}>🧪 Gas Values (ppm)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {['H2','CH4','C2H6','C2H4','C2H2','CO','CO2','O2','N2'].map(g => (
                  <div key={g} style={{ background: '#2a2a2a', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: GAS_COLORS[g] || '#94a3b8' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0' }}>{g}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#777', marginBottom: 5 }}>{GAS_NAMES[g]}</div>
                    <input
                      type="number"
                      value={gasValues[g]}
                      onChange={e => handleGasChange(g, e.target.value)}
                      placeholder="0"
                      style={{ width: '100%', padding: '8px', background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, fontSize: 14, fontFamily: 'monospace', boxSizing: 'border-box', color: '#e0e0e0' }}
                    />
                  </div>
                ))}
              </div>
              {/* Summary */}
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ padding: 12, background: '#2a2a2a', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>O₂/N₂</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: o2n2Ratio <= 0.2 ? '#22c55e' : '#f59e0b' }}>{o2n2Ratio.toFixed(3)}</div>
                </div>
                <div style={{ padding: 12, background: o2n2Ratio <= 0.2 ? '#22c55e15' : '#f59e0b15', borderRadius: 10, border: `1px solid ${o2n2Ratio <= 0.2 ? '#22c55e40' : '#f59e0b40'}` }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Type</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: o2n2Ratio <= 0.2 ? '#22c55e' : '#f59e0b' }}>{o2n2Ratio <= 0.2 ? 'Sealed' : 'Breathing'}</div>
                </div>
                <div style={{ padding: 12, background: tdcg > 720 ? '#f59e0b15' : '#22c55e15', borderRadius: 10, border: `1px solid ${tdcg > 720 ? '#f59e0b40' : '#22c55e40'}` }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>TDCG</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: tdcg > 720 ? '#f59e0b' : '#22c55e' }}>{tdcg} <span style={{ fontSize: 11, fontWeight: 400 }}>ppm</span></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => setActiveTab('duval')} style={{ flex: 1, padding: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔺 Duval Analysis</button>
                <button onClick={() => setActiveTab('heptagon')} style={{ flex: 1, padding: 12, background: 'linear-gradient(135deg, #00d4aa, #0099cc)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⬡ Heptagon</button>
                <button onClick={() => setActiveTab('assessment')} style={{ flex: 1, padding: 12, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📋 Assessment</button>
              </div>
            </Card>
          </div>
        )}

        {/* ══════════ DUVAL TAB ══════════ */}
        {activeTab === 'duval' && (
          <div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[['T1','Triangle 1'],['T4','Triangle 4'],['T5','Triangle 5'],['P1','Pentagon']].map(([id, label]) => (
                <button key={id} onClick={() => setActiveDuvalSub(id)} style={{
                  padding: '10px 20px',
                  background: activeDuvalSub === id ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#1e1e1e',
                  border: activeDuvalSub === id ? 'none' : '1px solid #444',
                  borderRadius: 10, color: activeDuvalSub === id ? '#fff' : '#999',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              {/* Chart */}
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {(() => {
                  const c = duvalConfigs[activeDuvalSub];
                  if (!c.data) return (
                    <div style={{ padding: 60, textAlign: 'center', color: '#555', fontSize: 14 }}>Enter gas values in the Input tab to see analysis</div>
                  );
                  const pt = c.calc(c.data);
                  const f = FAULT_DESC[c.data.faultZone];
                  return (
                    <div>
                      <div style={{ position: 'relative', margin: 14, borderRadius: 10, overflow: 'hidden', background: '#fff', border: '2px solid #333' }}>
                        <img src={c.src} alt={`Duval ${activeDuvalSub}`} style={{ width: '100%', display: 'block' }} />
                        <svg viewBox={c.vb} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                          <circle cx={pt.x} cy={pt.y} r="24" fill={f?.color} stroke="#fff" strokeWidth="6" />
                          <circle cx={pt.x} cy={pt.y} r="10" fill="#fff" />
                        </svg>
                      </div>
                      <div style={{ margin: '0 14px 14px', padding: 14, background: '#2a2a2a', borderRadius: 10, borderLeft: `5px solid ${f?.color || '#94a3b8'}` }}>
                        <span style={{ padding: '5px 12px', background: f?.color, borderRadius: 6, fontWeight: 700, color: '#fff', marginRight: 12, fontSize: 14 }}>{c.data.faultZone}</span>
                        <span style={{ fontWeight: 600, fontSize: 15, color: '#e0e0e0' }}>{f?.name}</span>
                      </div>
                    </div>
                  );
                })()}
              </Card>

              {/* Legend + percentages */}
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#e0e0e0' }}>Legend</h3>
                {(duvalLegendKeys[activeDuvalSub] || []).map(k => (
                  <div key={k} style={{ padding: '10px 12px', background: '#2a2a2a', borderRadius: 8, borderLeft: `4px solid ${FAULT_DESC[k]?.color || '#94a3b8'}`, marginBottom: 8, fontSize: 13, color: '#ccc' }}>
                    <span style={{ fontWeight: 700, color: FAULT_DESC[k]?.color, marginRight: 8 }}>{k}</span>{FAULT_DESC[k]?.name}
                  </div>
                ))}
                {/* Gas % summary */}
                {(() => {
                  const d = duvalConfigs[activeDuvalSub]?.data;
                  if (!d) return null;
                  const entries = activeDuvalSub === 'T1' ? [['CH₄',d.pctCH4],['C₂H₄',d.pctC2H4],['C₂H₂',d.pctC2H2]] :
                    activeDuvalSub === 'T4' ? [['H₂',d.pctH2],['CH₄',d.pctCH4],['C₂H₆',d.pctC2H6]] :
                    activeDuvalSub === 'T5' ? [['CH₄',d.pctCH4],['C₂H₄',d.pctC2H4],['C₂H₆',d.pctC2H6]] :
                    [['H₂',d.pctH2],['CH₄',d.pctCH4],['C₂H₆',d.pctC2H6],['C₂H₄',d.pctC2H4],['C₂H₂',d.pctC2H2]];
                  return (
                    <div style={{ marginTop: 14, padding: 12, background: '#2a2a2a', borderRadius: 10 }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600 }}>Gas Percentages</div>
                      {entries.map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #333' }}>
                          <span style={{ color: '#bbb', fontSize: 12 }}>{label}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3b82f6', fontSize: 12 }}>{val.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>
            </div>
          </div>
        )}

        {/* ══════════ HEPTAGON TAB ══════════ */}
        {activeTab === 'heptagon' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Chart + fault result */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card>
                <HeptagonChart percentages={heptagonPct} fault={heptagonFault} />
              </Card>

              {heptagonPct && (
                <Card style={{ borderColor: `${heptagonFaultColor}44` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg, ${heptagonFaultColor}, ${heptagonFaultColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 20px ${heptagonFaultColor}40` }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{heptagonFault}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0' }}>{heptagonFault === 'Normal' ? 'Normal Operation' : `Fault: ${heptagonFault}`}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Heptagon DGA — Gouda et al. (2018)</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#999', lineHeight: 1.6, padding: '10px 12px', background: '#1a1a1a', borderRadius: 8, borderLeft: `3px solid ${heptagonFaultColor}` }}>
                    {HEPTAGON_FAULT_DESCRIPTIONS[heptagonFault]}
                  </p>
                  {heptagonExceeded.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>⚠ Gases Exceeding Normal Limits</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {heptagonExceeded.map(({ gas, value, limit }) => (
                          <div key={gas} style={{ padding: '5px 10px', background: '#2a1515', border: '1px solid #5c2020', borderRadius: 8, fontSize: 11, fontFamily: 'monospace' }}>
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>{gas}</span>
                            <span style={{ color: '#999' }}> = {value} ppm</span>
                            <span style={{ color: '#666' }}> (lim: {limit})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Right: weighted % table + legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {heptagonPct && (
                <Card>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#e0e0e0' }}>Weighted Percentages</h3>
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #333' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#1a1a1a' }}>
                          <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#888' }}>Gas</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#888' }}>ppm</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#888' }}>×Weight</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#888' }}>Rel.%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {HEPTAGON_GASES_ORDER.map((gas, i) => {
                          const pctVal = heptagonPct[gas];
                          const gasLabel = gas.replace('C2H', 'C₂H');
                          return (
                            <tr key={gas} style={{ borderTop: '1px solid #2a2a2a', background: i % 2 === 0 ? '#1e1e1e' : '#252525' }}>
                              <td style={{ padding: '6px 10px', fontWeight: 700, fontFamily: 'monospace', color: '#e0e0e0' }}>{gasLabel}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#999' }}>{parseFloat(gasValues[gas]) || 0}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#666', fontSize: 10 }}>×{WEIGHTING_FACTORS[gas]}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: heptagonFaultColor }}>{pctVal.toFixed(2)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Fault zone legend */}
              <Card>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#e0e0e0' }}>Fault Zone Legend</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {Object.entries(HEPTAGON_FAULT_COLORS).map(([key, color]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 6, background: heptagonFault === key ? `${color}15` : 'transparent', border: heptagonFault === key ? `1px solid ${color}33` : '1px solid transparent' }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>{key}</span>
                      <span style={{ fontSize: 10, color: '#666' }}>
                        {key === 'Normal' ? 'Normal' : key === 'HCCD' ? 'High Cell.Deg.' : key === 'MCCD' ? 'Med.Cell.Deg.' : key === 'LCCD' ? 'Low Cell.Deg.' :
                         key === 'T1' ? '<300°C' : key === 'T2' ? '300-700°C' : key === 'T3' ? '>700°C' :
                         key === 'PD' ? 'Part.Disch.' : key === 'D1' ? 'Low Energy' : key === 'D2' ? 'High Energy' : 'Therm+Elec.'}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#1a1a1a', borderRadius: 8, fontSize: 10, color: '#555', lineHeight: 1.5, fontStyle: 'italic' }}>
                  Reference: Gouda, El-Hoshy &amp; El-Tamaly (2018). "Proposed heptagon graph for DGA interpretation." IET GTD, 12(2), 490–498.
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══════════ ASSESSMENT TAB ══════════ */}
        {activeTab === 'assessment' && (
          <div style={{ display: 'grid', gap: 16 }}>

            {/* IEEE Assessment */}
            <Card style={{ borderLeft: `4px solid ${STATUS_DESC[dgaStatus].color}` }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#e0e0e0' }}>📋 IEEE C57.104 Assessment</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
                <div style={{ padding: 14, background: STATUS_DESC[dgaStatus].bg, borderRadius: 12, border: `1px solid ${STATUS_DESC[dgaStatus].color}40` }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Condition</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: STATUS_DESC[dgaStatus].color }}>{ieeeAssessment.condition}</div>
                </div>
                <div style={{ padding: 14, background: '#2a2a2a', borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Action</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>{ieeeAssessment.action}</div>
                </div>
                <div style={{ padding: 14, background: '#2a2a2a', borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Interval</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>{ieeeAssessment.interval}</div>
                </div>
              </div>
              <div style={{ padding: 14, background: '#2a2a2a', borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#ccc' }}>Recommendations</div>
                {ieeeAssessment.recommendations.map((r, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: '#1a1a1a', borderRadius: 8, marginBottom: 6, fontSize: 13, color: '#ccc' }}>• {r}</div>
                ))}
              </div>
            </Card>

            {/* Rogers + CO2/CO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#e0e0e0' }}>📐 Rogers Ratios</h3>
                {rogersRatios ? (
                  <div>
                    {[['R1 (C₂H₂/C₂H₄)', rogersRatios.r1], ['R2 (CH₄/H₂)', rogersRatios.r2], ['R3 (C₂H₄/C₂H₆)', rogersRatios.r3]].map(([l, v]) => (
                      <div key={l} style={{ padding: 10, background: '#2a2a2a', borderRadius: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{l}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>{v.toFixed(4)}</div>
                      </div>
                    ))}
                    <div style={{ padding: 12, background: '#3b82f615', borderRadius: 10, borderLeft: '4px solid #3b82f6' }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Diagnosis</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>{rogersRatios.diagnosis}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: '#555', fontSize: 13 }}>Enter values to calculate</div>
                )}
              </Card>
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#e0e0e0' }}>📊 CO₂/CO Ratio</h3>
                {co2coRatio ? (
                  <div>
                    <div style={{ padding: 10, background: '#2a2a2a', borderRadius: 10, marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Ratio</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>{co2coRatio.ratio.toFixed(2)}</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 10, background: co2coRatio.severity === 'warning' ? '#ef444420' : '#22c55e20', border: `1px solid ${co2coRatio.severity === 'warning' ? '#ef444440' : '#22c55e40'}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: co2coRatio.severity === 'warning' ? '#ef4444' : '#22c55e' }}>{co2coRatio.interpretation}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: '#555', fontSize: 13 }}>Enter CO / CO₂ values</div>
                )}
              </Card>
            </div>

            {/* AI Interpretation */}
            <Card style={{ background: '#0f1929', border: '1px solid #3b82f630' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#e0e0e0' }}>🤖 AI Interpretation</h3>
              <div style={{ padding: 14, background: '#0a0a0a', borderRadius: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#ccc' }}>
                  {(() => {
                    const insights = [];
                    if (dgaStatus === 1) insights.push('✅ The transformer is operating within normal parameters according to IEEE C57.104-2019 standards.');
                    else if (dgaStatus === 2) insights.push('⚠️ Elevated gas levels detected. The transformer requires increased monitoring frequency.');
                    else insights.push('🚨 Warning condition detected. Immediate investigation and engineering review recommended.');
                    if (duvalT1) {
                      const fi = FAULT_DESC[duvalT1.faultZone];
                      if (fi) insights.push(`🔺 Duval Triangle 1 indicates "${fi.name}" fault type.`);
                    }
                    if (heptagonPct && heptagonFault !== 'Normal') insights.push(`⬡ Heptagon analysis indicates: ${heptagonFault} — ${HEPTAGON_FAULT_DESCRIPTIONS[heptagonFault]}`);
                    if (co2coRatio) {
                      if (co2coRatio.ratio < 3) insights.push('📊 Low CO₂/CO ratio suggests possible thermal degradation of cellulose insulation.');
                      else if (co2coRatio.ratio > 10) insights.push('📊 CO₂/CO ratio indicates normal cellulose aging without significant thermal stress.');
                    }
                    if (rogersRatios) insights.push(`📐 Rogers Ratio analysis suggests: ${rogersRatios.diagnosis}.`);
                    if (transformerAge !== null) {
                      if (transformerAge < 10) insights.push(`📅 New transformer (${transformerAge} years) — stricter gas limits applied.`);
                      else if (transformerAge >= 30) insights.push(`📅 Aged transformer (${transformerAge} years) — lenient limits applied, closer monitoring advised.`);
                    }
                    insights.push(o2n2Ratio <= 0.2 ? '🔒 O₂/N₂ ratio indicates a sealed/conservator type transformer.' : '🌬️ O₂/N₂ ratio indicates a breathing type transformer.');
                    return insights.map((ins, i) => (
                      <div key={i} style={{ marginBottom: i < insights.length - 1 ? 8 : 0, padding: '9px 11px', background: '#1a1a1a', borderRadius: 8, borderLeft: '3px solid #00d4aa' }}>
                        {ins}
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: '#92400e20', borderRadius: 8, fontSize: 12, color: '#fbbf24', display: 'flex', alignItems: 'flex-start', gap: 7, border: '1px solid #92400e40' }}>
                <span>💡</span>
                <span>Based on IEEE C57.104-2019, Duval Triangle, Heptagon (Gouda 2018), and Rogers Ratio methods. Always consult qualified engineers for critical decisions.</span>
              </div>
            </Card>

            {/* Gas Analysis alerts */}
            {gasAnalysis.length > 0 && (
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#e0e0e0' }}>🔬 Gas Analysis</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {gasAnalysis.map((a, i) => (
                    <div key={i} style={{ padding: 12, background: '#2a2a2a', borderRadius: 12, borderLeft: `4px solid ${a.color}` }}>
                      <span style={{ padding: '3px 10px', background: a.color, borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, marginRight: 9 }}>{a.gas}</span>
                      <span style={{ fontWeight: 600, color: a.color, fontSize: 13 }}>{a.level}</span>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 5 }}>{a.message}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid #222', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#555' }}>
          DGA Analysis — IEEE C57.104-2019 | Heptagon Gouda et al. (2018) | Developed by{' '}
          <span style={{ color: '#00d4aa', fontWeight: 600 }}>CHM. Ts. Hadi Fauzi, MRSC</span>
        </div>
        <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>⚠️ For reference only — consult qualified Chemist and Engineers for critical decisions</div>
      </div>
    </div>
  );
}
