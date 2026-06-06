import React, { useState, useMemo, useCallback } from 'react';
import { Combobox } from './ui/combobox';
import { cn } from '../lib/utils';

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
const GAS_LABELS = {
  H2: 'H₂', CH4: 'CH₄', C2H6: 'C₂H₆', C2H4: 'C₂H₄', C2H2: 'C₂H₂',
  CO: 'CO', CO2: 'CO₂', O2: 'O₂', N2: 'N₂',
};
const FAULT_DESC = {
  PD:     { name: 'Partial Discharge',         color: '#3b82f6' },
  T1:     { name: 'Thermal < 300°C',           color: '#22c55e' },
  T2:     { name: 'Thermal 300–700°C',         color: '#eab308' },
  T3:     { name: 'Thermal > 700°C',           color: '#f97316' },
  'T2-H': { name: 'Thermal in Oil 300–700°C',  color: '#eab308' },
  'T3-H': { name: 'Thermal in Oil > 700°C',    color: '#f97316' },
  D1:     { name: 'Low Energy Discharge',      color: '#ef4444' },
  D2:     { name: 'High Energy Discharge',     color: '#dc2626' },
  DT:     { name: 'Mixed Fault',               color: '#8b5cf6' },
  S:      { name: 'Stray Gassing',             color: '#06b6d4' },
  O:      { name: 'Overheating',               color: '#84cc16' },
  C:      { name: 'Carbonization',             color: '#f59e0b' },
  ND:     { name: 'Not Determined',            color: '#94a3b8' },
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
      return { table1: { H2:100,CH4:90,C2H6:90,C2H4:50,C2H2:2,CO:350,CO2:2500 }, table2: { H2:200,CH4:180,C2H6:180,C2H4:100,C2H2:4,CO:570,CO2:4000 } };
    if (age < 10)
      return { table1: { H2:75,CH4:45,C2H6:30,C2H4:20,C2H2:1,CO:350,CO2:2500 }, table2: { H2:150,CH4:90,C2H6:60,C2H4:40,C2H2:2,CO:570,CO2:4000 } };
    if (age < 30)
      return { table1: { H2:100,CH4:90,C2H6:90,C2H4:50,C2H2:2,CO:500,CO2:3500 }, table2: { H2:200,CH4:180,C2H6:180,C2H4:100,C2H2:4,CO:800,CO2:5500 } };
    return { table1: { H2:999999,CH4:110,C2H6:150,C2H4:90,C2H2:2,CO:700,CO2:4500 }, table2: { H2:999999,CH4:220,C2H6:300,C2H4:180,C2H2:4,CO:1000,CO2:7000 } };
  }
  return { table1: { H2:100,CH4:120,C2H6:65,C2H4:50,C2H2:1,CO:500,CO2:5000 }, table2: { H2:200,CH4:240,C2H6:130,C2H4:100,C2H2:2,CO:800,CO2:7500 } };
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
  const ch4=parseGas(gv.CH4),c2h4=parseGas(gv.C2H4),c2h2=parseGas(gv.C2H2),total=ch4+c2h4+c2h2;
  if (total===0) return null;
  const pctCH4=(ch4/total)*100,pctC2H4=(c2h4/total)*100,pctC2H2=(c2h2/total)*100;
  let faultZone='T1';
  if (pctCH4>=98) faultZone='PD';
  else if (pctC2H4>=50&&pctC2H2<15) faultZone='T3';
  else if (pctC2H2>=13) faultZone=pctC2H4<23?'D1':'D2';
  else if (pctC2H2>=4) faultZone='DT';
  else if (pctC2H4>=20) faultZone='T2';
  return { pctCH4, pctC2H4, pctC2H2, faultZone };
}

function calcDuval4(gv) {
  const h2=parseGas(gv.H2),ch4=parseGas(gv.CH4),c2h6=parseGas(gv.C2H6),total=h2+ch4+c2h6;
  if (total===0) return null;
  const pctH2=(h2/total)*100,pctCH4=(ch4/total)*100,pctC2H6=(c2h6/total)*100;
  let faultZone='S';
  if (pctH2>=90) faultZone='PD';
  else if (pctCH4>=64) faultZone='C';
  else if (pctC2H6>=52) faultZone='O';
  return { pctH2, pctCH4, pctC2H6, faultZone };
}

function calcDuval5(gv) {
  const ch4=parseGas(gv.CH4),c2h4=parseGas(gv.C2H4),c2h6=parseGas(gv.C2H6),total=ch4+c2h4+c2h6;
  if (total===0) return null;
  const pctCH4=(ch4/total)*100,pctC2H4=(c2h4/total)*100,pctC2H6=(c2h6/total)*100;
  let faultZone='ND';
  if (pctCH4>=98) faultZone='PD';
  else if (pctC2H4>=50) faultZone='T3-H';
  else if (pctCH4>=35&&pctCH4<=75&&pctC2H4>=10&&pctC2H4<40) faultZone='C';
  else if (pctC2H4>=20) faultZone='T2-H';
  else if (pctC2H6>=50) faultZone='S';
  else if (pctCH4>=40) faultZone='O';
  return { pctCH4, pctC2H4, pctC2H6, faultZone };
}

function calcPentagon(gv) {
  const h2=parseGas(gv.H2),ch4=parseGas(gv.CH4),c2h6=parseGas(gv.C2H6),c2h4=parseGas(gv.C2H4),c2h2=parseGas(gv.C2H2),total=h2+ch4+c2h6+c2h4+c2h2;
  if (total===0) return null;
  const pctH2=(h2/total)*100,pctCH4=(ch4/total)*100,pctC2H6=(c2h6/total)*100,pctC2H4=(c2h4/total)*100,pctC2H2=(c2h2/total)*100;
  let faultZone='S';
  if (pctH2>85) faultZone='PD';
  else if (pctC2H2>20) faultZone=pctC2H4>20?'D2':'D1';
  else if (pctC2H4>50) faultZone='T3-H';
  else if (pctCH4>45&&pctC2H4>=10&&pctC2H4<30) faultZone='C';
  else if (pctC2H4>20) faultZone='T2-H';
  else if (pctC2H6>35&&pctCH4<50) faultZone='O';
  else if (pctCH4>50) faultZone='T1';
  return { pctH2, pctCH4, pctC2H6, pctC2H4, pctC2H2, faultZone };
}

// ─── Heptagon analysis ────────────────────────────────────────────────────────
function computeWeightedPercentages(gases) {
  let total = 0;
  const weighted = {};
  for (const gas of HEPTAGON_GASES_ORDER) {
    const val = (parseFloat(gases[gas]) || 0) * WEIGHTING_FACTORS[gas];
    weighted[gas] = val; total += val;
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
  const { CO:co, CO2:co2, C2H4:c2h4, H2:h2, CH4:ch4, C2H2:c2h2, C2H6:c2h6 } = pct;
  if (co>60&&co2<=25) return 'HCCD';
  if (co>=45&&co<=60&&co2>25&&co2<=50) return 'MCCD';
  if (co>=18&&co<45&&co2>50) return 'LCCD';
  if (c2h2>50&&h2>60&&c2h6<=75&&co<50) return 'D2';
  if (h2>60&&c2h2<=50&&c2h2>5) return 'D1';
  if (c2h6>=90&&c2h2<50&&h2>60) return 'D1';
  if (h2>60&&ch4<=40&&c2h2<=40&&c2h4<=40) return 'PD';
  if (c2h4>75&&h2<=54&&ch4<40) return 'T3';
  if (c2h4<=75&&c2h4>50&&h2<=54&&ch4>=25) return 'T3';
  if (c2h4>50&&c2h4<=75&&h2<=30&&ch4>=25&&ch4<=66) return 'T2';
  if (c2h4<=50&&h2>30&&h2<=54&&ch4<25) return 'T2';
  if (c2h4<=50&&h2<=30&&ch4<=66) return 'T1';
  if (c2h4>40&&c2h2>10&&h2>30) return 'TD';
  if (c2h4>50) return 'T2';
  if (ch4>40&&c2h4>20) return 'T1';
  if (co>30&&co2>30) return 'LCCD';
  if (co>40) return 'MCCD';
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
  const outerPath = outerPts.map((p, i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const ringPaths = rings.map(s => {
    const pts = getHeptagonPoints(cx, cy, R * s);
    return pts.map((p, i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
  });
  let dataPath = '', dataPoints = [];
  if (percentages) {
    dataPoints = HEPTAGON_GASES_ORDER.map((gas, i) => {
      const frac = Math.min(percentages[gas] / 100, 1);
      const angle = -(Math.PI * 2 * i) / 7 - Math.PI / 2;
      return [cx + R * frac * Math.cos(angle), cy + R * frac * Math.sin(angle)];
    });
    dataPath = dataPoints.map((p, i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
  }
  const labelPts = getHeptagonPoints(cx, cy, R + 30);
  const gasLabels = ['CO', 'CO₂', 'C₂H₄', 'H₂', 'CH₄', 'C₂H₂', 'C₂H₆'];
  const faultColor = HEPTAGON_FAULT_COLORS[fault] || '#6b7280';

  return (
    <svg viewBox="0 0 500 500" className="mx-auto block w-full max-w-[400px]">
      <defs>
        <filter id="hept-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {ringPaths.map((path, i) => (
        <path key={i} d={path} fill="none"
          stroke={i === rings.length - 1 ? 'var(--muted)' : 'var(--border)'}
          strokeWidth={i === rings.length - 1 ? 1.5 : 0.8}
          strokeDasharray={i < rings.length - 1 ? '3,3' : 'none'} />
      ))}
      {outerPts.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="var(--border)" strokeWidth="0.8" />
      ))}
      <path d={outerPath} fill="none" stroke="var(--muted)" strokeWidth="1.5" />
      {rings.map((s, i) => (
        <text key={i} x={cx+8} y={cy-R*s+4} fontSize="8" fill="var(--muted)" fontFamily="monospace">
          {Math.round(s*100)}%
        </text>
      ))}
      {percentages && (
        <>
          <path d={dataPath} fill={faultColor} fillOpacity="0.18" stroke={faultColor} strokeWidth="2.5" filter="url(#hept-glow)" />
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="5" fill={faultColor} stroke="var(--card)" strokeWidth="2" />
          ))}
        </>
      )}
      <circle cx={cx} cy={cy} r="3" fill="var(--muted)" />
      {labelPts.map((p, i) => (
        <text key={i} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central"
          fontSize="13" fontWeight="700" fill="var(--foreground)" fontFamily="monospace">
          {gasLabels[i]}
        </text>
      ))}
      {percentages && HEPTAGON_GASES_ORDER.map((gas, i) => {
        const frac = Math.min(percentages[gas] / 100, 1);
        if (frac < 0.05) return null;
        const angle = -(Math.PI * 2 * i) / 7 - Math.PI / 2;
        return (
          <text key={gas}
            x={cx + R * frac * Math.cos(angle)}
            y={cy + R * frac * Math.sin(angle) - 12}
            textAnchor="middle" fontSize="9" fill={faultColor} fontWeight="700" fontFamily="monospace">
            {percentages[gas].toFixed(1)}%
          </text>
        );
      })}
    </svg>
  );
}

// ─── Shared label style ───────────────────────────────────────────────────────
const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DGAAnalysisModal({ initialGases, initialTransformer }) {
  const [gasValues, setGasValues] = useState({
    H2:   String(initialGases?.H2   ?? ''),
    CH4:  String(initialGases?.CH4  ?? ''),
    C2H6: String(initialGases?.C2H6 ?? ''),
    C2H4: String(initialGases?.C2H4 ?? ''),
    C2H2: String(initialGases?.C2H2 ?? ''),
    CO:   String(initialGases?.CO   ?? ''),
    CO2:  String(initialGases?.CO2  ?? ''),
    O2:   String(initialGases?.O2   ?? ''),
    N2:   String(initialGases?.N2   ?? ''),
  });

  const transformerInfo = {
    siteLocation:  initialTransformer?.location     || '',
    mnemonic:      initialTransformer?.mnemonic     || '',
    serialNumber:  initialTransformer?.serialNo     || '',
    manufacturer:  initialTransformer?.manufacturer || '',
    voltage:       initialTransformer?.voltage      || '',
    mvaRating:     initialTransformer?.rating       || '',
    yearBuilt:     initialTransformer?.yearMfg      || '',
    sampleDate:    initialTransformer?.sampleDate   || '',
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
    [gasValues]);

  const transformerAge = useMemo(() => {
    if (!transformerInfo.yearBuilt) return null;
    const y = parseInt(transformerInfo.yearBuilt);
    return isNaN(y) ? null : new Date().getFullYear() - y;
  }, [transformerInfo.yearBuilt]);

  const ageLimits   = useMemo(() => getAgeLimits(transformerAge, o2n2Ratio), [transformerAge, o2n2Ratio]);
  const dgaStatus   = useMemo(() => calcStatus(gasValues, transformerAge, o2n2Ratio), [gasValues, transformerAge, o2n2Ratio]);
  const duvalT1     = useMemo(() => calcDuval1(gasValues), [gasValues]);
  const duvalT4     = useMemo(() => calcDuval4(gasValues), [gasValues]);
  const duvalT5     = useMemo(() => calcDuval5(gasValues), [gasValues]);
  const duvalP1     = useMemo(() => calcPentagon(gasValues), [gasValues]);

  const rogersRatios = useMemo(() => {
    const ch4=parseGas(gasValues.CH4),h2=parseGas(gasValues.H2),c2h4=parseGas(gasValues.C2H4),c2h6=parseGas(gasValues.C2H6),c2h2=parseGas(gasValues.C2H2);
    if (h2===0||c2h4===0||c2h6===0) return null;
    const r1=c2h2/c2h4,r2=ch4/h2,r3=c2h4/c2h6;
    let diagnosis='Undetermined';
    if (r1<0.1&&r2>=0.1&&r2<=1.0&&r3<1.0) diagnosis='Normal Aging';
    else if (r1<0.1&&r2<0.1) diagnosis='Partial Discharge';
    else if (r1>=0.1&&r1<=3.0&&r3>3.0) diagnosis='Arcing Fault';
    else if (r1<0.1&&r2>1.0&&r3<=3.0) diagnosis='Thermal < 700°C';
    else if (r1<0.1&&r2>1.0&&r3>3.0) diagnosis='Thermal > 700°C';
    return { r1, r2, r3, diagnosis };
  }, [gasValues]);

  const co2coRatio = useMemo(() => {
    const co=parseGas(gasValues.CO),co2=parseGas(gasValues.CO2);
    if (co===0) return null;
    const ratio=co2/co;
    return { ratio, interpretation: ratio<3?'Thermal fault in cellulose':'Normal', severity: ratio<3?'warning':'normal' };
  }, [gasValues]);

  const gasAnalysis = useMemo(() => {
    const msgs = {
      H2:'Hydrogen – partial discharge or overheating', CH4:'Methane – low-temp decomposition',
      C2H6:'Ethane – thermal 200–400°C', C2H4:'Ethylene – high-temp fault',
      C2H2:'Acetylene – CRITICAL: arcing!', CO:'CO – cellulose degradation',
    };
    return ['H2','CH4','C2H6','C2H4','C2H2','CO'].reduce((acc,g) => {
      const v=parseGas(gasValues[g]);
      if (v>ageLimits.table1[g]) acc.push({ gas:g, level: v>ageLimits.table2[g]?'High':'Elevated', message:msgs[g], color: v>ageLimits.table2[g]?'#ef4444':'#f59e0b' });
      return acc;
    }, []);
  }, [gasValues, ageLimits]);

  const ieeeAssessment = useMemo(() => {
    const fault = duvalT1?.faultZone;
    let condition, action, interval, recommendations=[];
    if (dgaStatus===1) { condition='Normal'; action='Continue operation'; interval='Annual'; recommendations=['Maintain routine schedule']; }
    else if (dgaStatus===2) { condition='Caution'; action='Increase monitoring'; interval='Quarterly'; recommendations=['Increase sampling frequency','Review history']; }
    else { condition='Warning'; action='Investigation required'; interval='Monthly'; recommendations=['Engineering review','Consider load reduction','Inspection needed']; }
    if (fault==='D1'||fault==='D2') recommendations.push('Check connections');
    if (fault==='T3') recommendations.push('Inspect for hot spots');
    if (fault==='PD') recommendations.push('Check insulation');
    return { condition, action, interval, recommendations };
  }, [dgaStatus, duvalT1]);

  // ── Heptagon ──
  const heptagonExceeded  = useMemo(() => checkExceedsNormal(gasValues), [gasValues]);
  const heptagonPct       = useMemo(() => computeWeightedPercentages(gasValues), [gasValues]);
  const heptagonFault     = useMemo(() => heptagonExceeded.length===0?'Normal':determineFault(heptagonPct), [heptagonExceeded, heptagonPct]);
  const heptagonFaultColor = HEPTAGON_FAULT_COLORS[heptagonFault] || '#6b7280';

  const handleGasChange = useCallback((g, v) => setGasValues(p => ({ ...p, [g]: v })), []);

  // ── Duval configs ──
  const duvalConfigs = {
    T1: { src:'https://upload.wikimedia.org/wikipedia/commons/3/3b/Duval_Triangle_1.png', data:duvalT1, vb:'0 0 1005 1024', calc:d=>({ x:(d.pctCH4/100)*500+(d.pctC2H4/100)*972+(d.pctC2H2/100)*28, y:(d.pctCH4/100)*55+(d.pctC2H4/100)*928+(d.pctC2H2/100)*928 }) },
    T4: { src:'https://upload.wikimedia.org/wikipedia/commons/9/97/Duval_Triangle_4.png', data:duvalT4, vb:'0 0 1005 1024', calc:d=>({ x:(d.pctH2/100)*500+(d.pctCH4/100)*972+(d.pctC2H6/100)*28, y:(d.pctH2/100)*55+(d.pctCH4/100)*928+(d.pctC2H6/100)*928 }) },
    T5: { src:'https://upload.wikimedia.org/wikipedia/commons/7/71/Duval_Triangle_5.png', data:duvalT5, vb:'0 0 1005 1024', calc:d=>({ x:(d.pctCH4/100)*500+(d.pctC2H4/100)*972+(d.pctC2H6/100)*28, y:(d.pctCH4/100)*55+(d.pctC2H4/100)*928+(d.pctC2H6/100)*928 }) },
    P1: { src:'https://upload.wikimedia.org/wikipedia/commons/7/76/Duval_Pentagram_3.png', data:duvalP1, vb:'0 0 976 822', calc:d=>{
      const cx=488,cy=433,r=224,ang=[90,18,-54,-126,162].map(a=>a*Math.PI/180),pcts=[d.pctH2,d.pctC2H2,d.pctC2H4,d.pctC2H6,d.pctCH4];
      let px=cx,py=cy;
      pcts.forEach((p,i)=>{px+=(p/100)*r*0.85*Math.cos(ang[i]);py-=(p/100)*r*0.85*Math.sin(ang[i]);});
      return {x:px,y:py};
    }},
  };
  const duvalLegendKeys = { T1:['PD','T1','T2','T3','D1','D2','DT'], T4:['PD','S','O','C'], T5:['PD','S','O','C','T2-H','T3-H'], P1:['PD','S','O','C','T1','T2-H','T3-H','D1','D2'] };
  const DUVAL_OPTIONS = [
    { value:'T1', label:'Triangle 1 — CH₄, C₂H₄, C₂H₂' },
    { value:'T4', label:'Triangle 4 — H₂, CH₄, C₂H₆' },
    { value:'T5', label:'Triangle 5 — CH₄, C₂H₄, C₂H₆' },
    { value:'P1', label:'Pentagon — H₂, CH₄, C₂H₆, C₂H₄, C₂H₂' },
  ];

  const statusCfg = STATUS_DESC[dgaStatus];

  const TABS = [
    { id:'input',      label:'Input' },
    { id:'duval',      label:'Duval' },
    { id:'heptagon',   label:'Heptagon' },
    { id:'assessment', label:'Assessment' },
  ];

  return (
    <div className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">

      {/* ── Tab bar ── */}
      <div className="sticky top-0 z-10 flex overflow-x-auto border-b border-[color:var(--border)] bg-[var(--card)] px-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex h-12 shrink-0 items-center border-b-2 px-4 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-[color:var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 p-4 md:p-5">

        {/* ══════════ INPUT TAB ══════════ */}
        {activeTab === 'input' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Transformer Info */}
            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
              <div className={cn(sectionLabel, 'mb-3')}>Transformer Info</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Site',         transformerInfo.siteLocation],
                  ['Serial No.',   transformerInfo.serialNumber],
                  ['Mnemonic',     transformerInfo.mnemonic],
                  ['MVA',          transformerInfo.mvaRating],
                  ['Voltage',      transformerInfo.voltage],
                  ['Year Built',   transformerInfo.yearBuilt],
                  ['Sample Date',  transformerInfo.sampleDate],
                  ['Manufacturer', transformerInfo.manufacturer],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-[var(--card)] px-3 py-2.5">
                    <div className={sectionLabel}>{label}</div>
                    <div className="mt-1 text-sm font-medium text-[var(--foreground)]">{value || '—'}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Gas Values */}
            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
              <div className={cn(sectionLabel, 'mb-3')}>Gas Values (ppm)</div>
              <div className="grid grid-cols-3 gap-2">
                {['H2','CH4','C2H6','C2H4','C2H2','CO','CO2','O2','N2'].map(g => (
                  <div key={g} className="rounded-md bg-[var(--card)] px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GAS_COLORS[g] || 'var(--muted)' }} />
                      <span className="text-xs font-bold text-[var(--foreground)]">{GAS_LABELS[g]}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--muted)]">{GAS_NAMES[g]}</div>
                    <input
                      type="number"
                      value={gasValues[g]}
                      onChange={e => handleGasChange(g, e.target.value)}
                      placeholder="0"
                      className="mt-2 flex h-8 w-full rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-2 py-1 font-mono text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                    />
                  </div>
                ))}
              </div>

              {/* Summary metrics */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md bg-[var(--card)] px-3 py-2.5">
                  <div className={sectionLabel}>O₂/N₂</div>
                  <div className={cn('mt-1 font-mono text-base font-semibold',
                    o2n2Ratio <= 0.2 ? 'text-[var(--success-strong)]' : 'text-[var(--warning-strong)]')}>
                    {o2n2Ratio.toFixed(3)}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {o2n2Ratio <= 0.2 ? 'Sealed' : 'Breathing'}
                  </div>
                </div>
                <div className="rounded-md bg-[var(--card)] px-3 py-2.5">
                  <div className={sectionLabel}>TDCG</div>
                  <div className={cn('mt-1 font-mono text-base font-semibold',
                    tdcg > 1920 ? 'text-[var(--danger-strong)]' : tdcg > 720 ? 'text-[var(--warning-strong)]' : 'text-[var(--success-strong)]')}>
                    {tdcg}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">ppm total</div>
                </div>
                <div className="rounded-md bg-[var(--card)] px-3 py-2.5">
                  <div className={sectionLabel}>IEEE Status</div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: statusCfg.color }}>
                    {statusCfg.name}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">Level {dgaStatus}</div>
                </div>
              </div>

              {/* Quick-nav */}
              <div className="mt-3 flex gap-2">
                {[['duval','Duval Analysis'],['heptagon','Heptagon'],['assessment','Assessment']].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setActiveTab(id)}
                    className="flex-1 rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--card-strong)]">
                    {label}
                  </button>
                ))}
              </div>
            </section>

          </div>
        )}

        {/* ══════════ DUVAL TAB ══════════ */}
        {activeTab === 'duval' && (
          <div className="space-y-4">

            {/* Combobox selector */}
            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
              <label className="space-y-2">
                <span className={sectionLabel}>Diagram</span>
                <Combobox
                  value={activeDuvalSub}
                  onValueChange={setActiveDuvalSub}
                  options={DUVAL_OPTIONS}
                  className="max-w-sm"
                />
              </label>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">

              {/* Chart */}
              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] overflow-hidden">
                {(() => {
                  const c = duvalConfigs[activeDuvalSub];
                  if (!c.data) return (
                    <div className="flex items-center justify-center px-4 py-16 text-sm text-[var(--muted)]">
                      Enter gas values in the Input tab to see analysis
                    </div>
                  );
                  const pt = c.calc(c.data);
                  const f  = FAULT_DESC[c.data.faultZone];
                  return (
                    <div className="p-4 space-y-3">
                      <div className="relative overflow-hidden rounded-md border border-[color:var(--border)] bg-white">
                        <img src={c.src} alt={`Duval ${activeDuvalSub}`} className="block w-full" />
                        <svg viewBox={c.vb} className="pointer-events-none absolute inset-0 h-full w-full">
                          <circle cx={pt.x} cy={pt.y} r="24" fill={f?.color} stroke="#fff" strokeWidth="6" />
                          <circle cx={pt.x} cy={pt.y} r="10" fill="#fff" />
                        </svg>
                      </div>
                      <div className="rounded-md bg-[var(--card)] px-4 py-3" style={{ borderLeft: `4px solid ${f?.color || '#94a3b8'}` }}>
                        <div className="flex items-center gap-2">
                          <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: f?.color }}>
                            {c.data.faultZone}
                          </span>
                          <span className="text-sm font-medium text-[var(--foreground)]">{f?.name}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </section>

              {/* Legend + percentages */}
              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4 space-y-3">
                <div className={sectionLabel}>Legend</div>
                <div className="space-y-1.5">
                  {(duvalLegendKeys[activeDuvalSub] || []).map(k => (
                    <div key={k} className="flex items-center gap-2 rounded-md bg-[var(--card)] px-3 py-2"
                         style={{ borderLeft: `3px solid ${FAULT_DESC[k]?.color || '#94a3b8'}` }}>
                      <span className="w-8 shrink-0 text-xs font-bold" style={{ color: FAULT_DESC[k]?.color }}>{k}</span>
                      <span className="text-xs text-[var(--muted)]">{FAULT_DESC[k]?.name}</span>
                    </div>
                  ))}
                </div>

                {(() => {
                  const d = duvalConfigs[activeDuvalSub]?.data;
                  if (!d) return null;
                  const entries = activeDuvalSub==='T1' ? [['CH₄',d.pctCH4],['C₂H₄',d.pctC2H4],['C₂H₂',d.pctC2H2]] :
                    activeDuvalSub==='T4' ? [['H₂',d.pctH2],['CH₄',d.pctCH4],['C₂H₆',d.pctC2H6]] :
                    activeDuvalSub==='T5' ? [['CH₄',d.pctCH4],['C₂H₄',d.pctC2H4],['C₂H₆',d.pctC2H6]] :
                    [['H₂',d.pctH2],['CH₄',d.pctCH4],['C₂H₆',d.pctC2H6],['C₂H₄',d.pctC2H4],['C₂H₂',d.pctC2H2]];
                  return (
                    <div>
                      <div className={cn(sectionLabel, 'mb-2')}>Gas Percentages</div>
                      <div className="rounded-md bg-[var(--card)] overflow-hidden">
                        {entries.map(([label, val], i) => (
                          <div key={label} className={cn('flex items-center justify-between px-3 py-2 text-xs', i>0&&'border-t border-[color:var(--border)]')}>
                            <span className="text-[var(--muted)]">{label}</span>
                            <span className="font-mono font-semibold text-[var(--primary)]">{val.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </section>

            </div>
          </div>
        )}

        {/* ══════════ HEPTAGON TAB ══════════ */}
        {activeTab === 'heptagon' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Left */}
            <div className="space-y-4">
              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
                <HeptagonChart percentages={heptagonPct} fault={heptagonFault} />
              </section>

              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: heptagonFaultColor }} />
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {heptagonFault === 'Normal' ? 'Normal Operation' : `Fault: ${heptagonFault}`}
                    </div>
                    <div className="text-xs text-[var(--muted)]">Heptagon DGA — Gouda et al. (2018)</div>
                  </div>
                </div>
                <p className="rounded-md bg-[var(--card)] px-3 py-2.5 text-xs leading-relaxed text-[var(--muted)]"
                   style={{ borderLeft: `3px solid ${heptagonFaultColor}` }}>
                  {HEPTAGON_FAULT_DESCRIPTIONS[heptagonFault]}
                </p>
                {heptagonExceeded.length > 0 && (
                  <div className="mt-3">
                    <div className={cn(sectionLabel, 'mb-2 text-[var(--danger-strong)]')}>Gases Exceeding Normal Limits</div>
                    <div className="flex flex-wrap gap-1.5">
                      {heptagonExceeded.map(({ gas, value, limit }) => (
                        <div key={gas} className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-2.5 py-1.5 font-mono text-xs">
                          <span className="font-bold text-[var(--danger-strong)]">{gas}</span>
                          <span className="text-[var(--muted)]"> {value} ppm</span>
                          <span className="text-[var(--muted)]/60"> / {limit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right */}
            <div className="space-y-4">
              {heptagonPct && (
                <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] overflow-hidden">
                  <div className="border-b border-[color:var(--border)] bg-[var(--card)] px-4 py-2.5">
                    <div className={sectionLabel}>Weighted Percentages</div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[color:var(--border)] bg-[var(--card)]">
                        <th className="px-4 py-2 text-left font-semibold text-[var(--muted)]">Gas</th>
                        <th className="px-4 py-2 text-right font-semibold text-[var(--muted)]">ppm</th>
                        <th className="px-4 py-2 text-right font-semibold text-[var(--muted)]">×W</th>
                        <th className="px-4 py-2 text-right font-semibold text-[var(--muted)]">Rel.%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {HEPTAGON_GASES_ORDER.map((gas, i) => (
                        <tr key={gas} className={cn('border-t border-[color:var(--border)]', i%2===0?'bg-[var(--card-muted)]':'bg-[var(--card)]')}>
                          <td className="px-4 py-2 font-mono font-semibold text-[var(--foreground)]">{gas.replace('C2H','C₂H')}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--muted)]">{parseFloat(gasValues[gas])||0}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--muted)]/60 text-[10px]">×{WEIGHTING_FACTORS[gas]}</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: heptagonFaultColor }}>{heptagonPct[gas].toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
                <div className={cn(sectionLabel, 'mb-3')}>Fault Zone Legend</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(HEPTAGON_FAULT_COLORS).map(([key, color]) => (
                    <div key={key}
                      className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                        heptagonFault===key ? 'bg-[var(--card)]' : 'bg-transparent')}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                      <span className="font-mono font-semibold text-[var(--foreground)]">{key}</span>
                      <span className="truncate text-[10px] text-[var(--muted)]">
                        {key==='Normal'?'Normal':key==='HCCD'?'High Cell.':key==='MCCD'?'Med.Cell.':key==='LCCD'?'Low Cell.':
                         key==='T1'?'<300°C':key==='T2'?'300-700°C':key==='T3'?'>700°C':
                         key==='PD'?'Part.Disch.':key==='D1'?'Low Energy':key==='D2'?'High Energy':'Therm+El.'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] italic leading-relaxed text-[var(--muted)]/60">
                  Gouda, El-Hoshy &amp; El-Tamaly (2018). IET GTD, 12(2), 490–498.
                </p>
              </section>
            </div>

          </div>
        )}

        {/* ══════════ ASSESSMENT TAB ══════════ */}
        {activeTab === 'assessment' && (
          <div className="space-y-4">

            {/* IEEE Assessment */}
            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
              <div className={cn(sectionLabel, 'mb-3')}>IEEE C57.104 Assessment</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
                <div className="rounded-md bg-[var(--card)] px-4 py-3" style={{ borderLeft: `4px solid ${statusCfg.color}` }}>
                  <div className={sectionLabel}>Condition</div>
                  <div className="mt-1 text-xl font-semibold" style={{ color: statusCfg.color }}>{ieeeAssessment.condition}</div>
                </div>
                <div className="rounded-md bg-[var(--card)] px-4 py-3">
                  <div className={sectionLabel}>Action</div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">{ieeeAssessment.action}</div>
                </div>
                <div className="rounded-md bg-[var(--card)] px-4 py-3">
                  <div className={sectionLabel}>Sampling Interval</div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">{ieeeAssessment.interval}</div>
                </div>
              </div>
              <div>
                <div className={cn(sectionLabel, 'mb-2')}>Recommendations</div>
                <div className="space-y-1.5">
                  {ieeeAssessment.recommendations.map((r, i) => (
                    <div key={i} className="rounded-md bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]">• {r}</div>
                  ))}
                </div>
              </div>
            </section>

            {/* Rogers + CO2/CO */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
                <div className={cn(sectionLabel, 'mb-3')}>Rogers Ratios</div>
                {rogersRatios ? (
                  <div className="space-y-2">
                    {[['R1 — C₂H₂/C₂H₄',rogersRatios.r1],['R2 — CH₄/H₂',rogersRatios.r2],['R3 — C₂H₄/C₂H₆',rogersRatios.r3]].map(([l,v]) => (
                      <div key={l} className="rounded-md bg-[var(--card)] px-3 py-2.5">
                        <div className={sectionLabel}>{l}</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-[var(--primary)]">{v.toFixed(4)}</div>
                      </div>
                    ))}
                    <div className="rounded-md bg-[var(--card)] px-3 py-2.5" style={{ borderLeft: '3px solid var(--primary)' }}>
                      <div className={sectionLabel}>Diagnosis</div>
                      <div className="mt-1 text-sm font-medium text-[var(--foreground)]">{rogersRatios.diagnosis}</div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-[var(--muted)]">Enter gas values to calculate</div>
                )}
              </section>

              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
                <div className={cn(sectionLabel, 'mb-3')}>CO₂/CO Ratio</div>
                {co2coRatio ? (
                  <div className="space-y-2">
                    <div className="rounded-md bg-[var(--card)] px-3 py-2.5">
                      <div className={sectionLabel}>Ratio value</div>
                      <div className="mt-1 font-mono text-2xl font-semibold text-[var(--primary)]">{co2coRatio.ratio.toFixed(2)}</div>
                    </div>
                    <div className="rounded-md bg-[var(--card)] px-3 py-2.5"
                         style={{ borderLeft: `3px solid ${co2coRatio.severity==='warning'?'var(--danger-strong)':'var(--success-strong)'}` }}>
                      <div className={sectionLabel}>Interpretation</div>
                      <div className={cn('mt-1 text-sm font-medium',
                        co2coRatio.severity==='warning' ? 'text-[var(--danger-strong)]' : 'text-[var(--success-strong)]')}>
                        {co2coRatio.interpretation}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-[var(--muted)]">Enter CO / CO₂ values</div>
                )}
              </section>
            </div>

            {/* AI Interpretation */}
            <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
              <div className={cn(sectionLabel, 'mb-3')}>AI Interpretation</div>
              <div className="space-y-1.5 mb-3">
                {(() => {
                  const insights = [];
                  if (dgaStatus===1) insights.push('✅ The transformer is operating within normal parameters according to IEEE C57.104-2019.');
                  else if (dgaStatus===2) insights.push('⚠️ Elevated gas levels detected. The transformer requires increased monitoring frequency.');
                  else insights.push('🚨 Warning condition detected. Immediate investigation and engineering review recommended.');
                  if (duvalT1) { const fi=FAULT_DESC[duvalT1.faultZone]; if (fi) insights.push(`🔺 Duval Triangle 1 indicates "${fi.name}" fault type.`); }
                  if (heptagonPct&&heptagonFault!=='Normal') insights.push(`⬡ Heptagon analysis: ${heptagonFault} — ${HEPTAGON_FAULT_DESCRIPTIONS[heptagonFault]}`);
                  if (co2coRatio) {
                    if (co2coRatio.ratio<3) insights.push('📊 Low CO₂/CO ratio suggests possible thermal degradation of cellulose insulation.');
                    else if (co2coRatio.ratio>10) insights.push('📊 CO₂/CO ratio indicates normal cellulose aging without significant thermal stress.');
                  }
                  if (rogersRatios) insights.push(`📐 Rogers Ratio analysis suggests: ${rogersRatios.diagnosis}.`);
                  if (transformerAge!==null) {
                    if (transformerAge<10) insights.push(`📅 New transformer (${transformerAge} years) — stricter gas limits applied.`);
                    else if (transformerAge>=30) insights.push(`📅 Aged transformer (${transformerAge} years) — lenient limits applied, closer monitoring advised.`);
                  }
                  insights.push(o2n2Ratio<=0.2 ? '🔒 O₂/N₂ ratio indicates a sealed/conservator type transformer.' : '🌬️ O₂/N₂ ratio indicates a breathing type transformer.');
                  return insights.map((ins, i) => (
                    <div key={i} className="rounded-md bg-[var(--card)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)]"
                         style={{ borderLeft: '3px solid var(--primary)' }}>
                      {ins}
                    </div>
                  ));
                })()}
              </div>
              <div className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted)]">
                💡 Based on IEEE C57.104-2019, Duval Triangle, Heptagon (Gouda 2018), and Rogers Ratio methods. Always consult qualified engineers for critical decisions.
              </div>
            </section>

            {/* Gas Analysis alerts */}
            {gasAnalysis.length > 0 && (
              <section className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-4 py-4">
                <div className={cn(sectionLabel, 'mb-3')}>Gas Analysis — Elevated Gases</div>
                <div className="space-y-2">
                  {gasAnalysis.map((a, i) => (
                    <div key={i} className="rounded-md bg-[var(--card)] px-3 py-2.5"
                         style={{ borderLeft: `4px solid ${a.color}` }}>
                      <div className="flex items-center gap-2">
                        <span className="rounded px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: a.color }}>{a.gas}</span>
                        <span className="text-xs font-semibold" style={{ color: a.color }}>{a.level}</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">{a.message}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}

      </div>

      {/* ── Footer ── */}
      <div className="border-t border-[color:var(--border)] px-4 py-3 text-center">
        <p className="text-xs text-[var(--muted)]">
          DGA Analysis — IEEE C57.104-2019 | Heptagon Gouda et al. (2018) | Developed by{' '}
          <span className="font-semibold text-[var(--primary)]">CHM. Ts. Hadi Fauzi, MRSC</span>
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--muted)]/60">
          ⚠️ For reference only — consult qualified Chemist and Engineers for critical decisions
        </p>
      </div>

    </div>
  );
}
