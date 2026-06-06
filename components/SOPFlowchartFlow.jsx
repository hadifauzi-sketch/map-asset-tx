import { useMemo, useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Video } from 'lucide-react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  useViewport,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/base.css';
import { AppTooltip } from './ui/app-tooltip';

// ── Section metadata ─────────────────────────────────────────────────────────
const SEC = {
  S1:  { color: '#818cf8', label: 'Auth' },
  S2:  { color: '#38bdf8', label: 'Dashboard' },
  S3:  { color: '#34d399', label: 'Register' },
  S4:  { color: '#fbbf24', label: 'Draw' },
  S5:  { color: '#a78bfa', label: 'Asset' },
  S6A: { color: '#f87171', label: 'Oil Tests' },
  S6B: { color: '#67e8f9', label: 'Docs' },
  S6C: { color: '#fb7185', label: 'Health' },
  S6D: { color: '#86efac', label: 'DGA' },
  S6E: { color: '#93c5fd', label: 'Trending' },
  S7:  { color: '#d8b4fe', label: 'Compare' },
  S8:  { color: '#6ee7b7', label: 'Gallery' },
};

// Node widths/heights fed to dagre
const DIM = {
  process:  { w: 220, h: 70 },
  decision: { w: 152, h: 62 },
  success:  { w: 220, h: 52 },
  warning:  { w: 220, h: 52 },
  terminal: { w: 116, h: 38 },
  action:   { w: 168, h: 58 },
};

// ── Custom node components ───────────────────────────────────────────────────
const hStyle = (color) => ({
  background: color,
  width: 7,
  height: 7,
  border: '1.5px solid #0d1117',
});

function ProcessNode({ data }) {
  const sec = SEC[data.section];
  const color = sec?.color ?? '#64748b';
  const [title, ...sub] = data.label.split('\n');
  return (
    <div style={{
      background: 'linear-gradient(135deg,#161b22 0%,#1c2433 100%)',
      border: `1px solid ${color}2a`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      padding: '9px 12px',
      width: DIM.process.w,
      minHeight: DIM.process.h,
      boxShadow: '0 2px 6px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.04)',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      {sec && (
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.09em', color, opacity: 0.7, marginBottom: 3 }}>
          {sec.label}
        </div>
      )}
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.35 }}>{title}</div>
      {sub.length > 0 && (
        <div style={{ fontSize: 10, color: '#8b97ab', marginTop: 3, lineHeight: 1.4 }}>
          {sub.join('\n')}
        </div>
      )}
      <Handle type="target" position={Position.Top} style={hStyle(color)} />
      <Handle type="source" position={Position.Bottom} style={hStyle(color)} />
    </div>
  );
}

function DecisionNode({ data }) {
  const sec = SEC[data.section];
  const color = sec?.color ?? '#94a3b8';
  const [l1, l2] = data.label.split('\n');
  return (
    <div style={{
      background: '#161e2b',
      border: `1.5px solid ${color}55`,
      borderRadius: 8,
      padding: '10px 10px 9px',
      width: DIM.decision.w,
      textAlign: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,.4)',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ fontSize: 14, color, marginBottom: 2, lineHeight: 1 }}>◇</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3 }}>{l1}</div>
      {l2 && <div style={{ fontSize: 10, color: '#7c8fa8', marginTop: 2 }}>{l2}</div>}
      <Handle type="target" position={Position.Top} style={hStyle(color)} />
      <Handle type="source" position={Position.Bottom} style={hStyle(color)} />
      <Handle type="source" position={Position.Left} id="left" style={hStyle(color)} />
      <Handle type="source" position={Position.Right} id="right" style={hStyle(color)} />
    </div>
  );
}

function SuccessNode({ data }) {
  const [title, ...sub] = data.label.split('\n');
  return (
    <div style={{
      background: 'linear-gradient(135deg,#052e16,#063b1e)',
      border: '1px solid #16a34a44',
      borderLeft: '3px solid #22c55e',
      borderRadius: 8,
      padding: '9px 12px',
      width: DIM.success.w,
      minHeight: DIM.success.h,
      boxShadow: '0 2px 6px rgba(0,0,0,.4),0 0 10px rgba(34,197,94,.06)',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#bbf7d0', lineHeight: 1.35 }}>{title}</div>
      {sub.map((s, i) => <div key={i} style={{ fontSize: 10, color: '#4ade80', marginTop: 2 }}>{s}</div>)}
      <Handle type="target" position={Position.Top} style={hStyle('#22c55e')} />
      <Handle type="source" position={Position.Bottom} style={hStyle('#22c55e')} />
    </div>
  );
}

function WarningNode({ data }) {
  const [title, ...sub] = data.label.split('\n');
  return (
    <div style={{
      background: 'linear-gradient(135deg,#2d1500,#3d1c00)',
      border: '1px solid #d9770644',
      borderLeft: '3px solid #f59e0b',
      borderRadius: 8,
      padding: '9px 12px',
      width: DIM.warning.w,
      minHeight: DIM.warning.h,
      boxShadow: '0 2px 6px rgba(0,0,0,.4)',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#fde68a', lineHeight: 1.35 }}>{title}</div>
      {sub.map((s, i) => <div key={i} style={{ fontSize: 10, color: '#fbbf24', marginTop: 2 }}>{s}</div>)}
      <Handle type="target" position={Position.Top} style={hStyle('#f59e0b')} />
      <Handle type="source" position={Position.Bottom} style={hStyle('#f59e0b')} />
    </div>
  );
}

function TerminalNode({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#1e293b,#2d3f57)',
      border: '2px solid #818cf8',
      borderRadius: 999,
      padding: '8px 22px',
      width: DIM.terminal.w,
      textAlign: 'center',
      boxShadow: '0 0 14px rgba(129,140,248,.25)',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#c7d2fe', letterSpacing: '0.06em' }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={hStyle('#818cf8')} />
    </div>
  );
}

function ActionNode({ data }) {
  const sec = SEC[data.section];
  const color = sec?.color ?? '#64748b';
  const [l1, l2] = data.label.split('\n');
  return (
    <div style={{
      background: `linear-gradient(135deg,${color}18,${color}0a)`,
      border: `1.5px solid ${color}66`,
      borderRadius: 10,
      padding: '10px 12px',
      width: DIM.action.w,
      textAlign: 'center',
      boxShadow: `0 0 12px ${color}18,0 2px 6px rgba(0,0,0,.35)`,
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>{l1}</div>
      {l2 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{l2}</div>}
      <Handle type="target" position={Position.Top} style={hStyle(color)} />
      <Handle type="source" position={Position.Bottom} style={hStyle(color)} />
    </div>
  );
}

const nodeTypes = {
  process: ProcessNode,
  decision: DecisionNode,
  success: SuccessNode,
  warning: WarningNode,
  terminal: TerminalNode,
  action: ActionNode,
};

// ── Node definitions ─────────────────────────────────────────────────────────
const RAW_NODES = [
  // Terminal
  { id: 'STARTNODE', type: 'terminal', data: { label: '▶  START' } },

  // S1 Authentication
  { id: 'LAUNCH',    type: 'process',  data: { label: 'Open Browser\nAsset Tx Map V2', section: 'S1' } },
  { id: 'SESSCK',    type: 'decision', data: { label: 'Session\nActive?', section: 'S1' } },
  { id: 'SIGNINPAGE',type: 'process',  data: { label: 'Sign-In Page\nEnter Email + Password', section: 'S1' } },
  { id: 'AUTHRES',   type: 'decision', data: { label: 'Auth\nSuccess?', section: 'S1' } },
  { id: 'DISCLAIM',  type: 'process',  data: { label: 'Acknowledge Disclaimer\nUsage Notice · Required Each Login', section: 'S1' } },
  { id: 'ROLELOAD',  type: 'process',  data: { label: 'Load User Role\nViewer  ·  Editor', section: 'S1' } },
  { id: 'IDLEQ',     type: 'decision', data: { label: 'Session Idle\n> 8 Hours?', section: 'S1' } },

  // S2 Dashboard
  { id: 'DASH',      type: 'process',  data: { label: 'Leaflet Map View\nTransformer Markers + Cluster Groups', section: 'S2' } },
  { id: 'SBR',       type: 'process',  data: { label: 'Sidebar Navigation\nCompany → Floor → Asset Hierarchy', section: 'S2' } },
  { id: 'QSTATS',    type: 'process',  data: { label: 'Quick Stats Bar\nTotal Assets · Oil Samples · Sites', section: 'S2' } },
  { id: 'MLAYER',    type: 'process',  data: { label: 'Map Layer Toggle\nStreets  ·  Satellite  ·  Hybrid', section: 'S2' } },
  { id: 'GSEARCH',   type: 'process',  data: { label: 'Geo-Search Control\nFind Location by Address', section: 'S2' } },
  { id: 'OWNFLT',    type: 'process',  data: { label: 'Asset Owner Filter\nAll  ·  TNB  ·  IPP  ·  Industry', section: 'S2' } },

  // Branch actions from Dashboard
  { id: 'ACTREG',    type: 'action',   data: { label: '➕  Register\nNew Transformer', section: 'S3' } },
  { id: 'ACTDRAW',   type: 'action',   data: { label: '🏢  Draw Company\nor Floor Plan', section: 'S4' } },
  { id: 'ACTOPEN',   type: 'action',   data: { label: '📋  Open Existing\nTransformer Asset', section: 'S5' } },
  { id: 'ACTCOMP',   type: 'action',   data: { label: '⚖️  Compare\nTransformers', section: 'S7' } },
  { id: 'ACTGALL',   type: 'action',   data: { label: '🖼️  Asset\nCard Gallery', section: 'S8' } },

  // S3 Registration
  { id: 'REGMETH',   type: 'decision', data: { label: 'How to\nRegister?', section: 'S3' } },
  { id: 'MANFORM',   type: 'process',  data: { label: 'Fill Registration Form\nSite · TX Name · Voltage · Serial · MVA', section: 'S3' } },
  { id: 'GPSMOD',    type: 'process',  data: { label: 'Location Register Module\nActivate GPS · Capture Live Coords', section: 'S3' } },
  { id: 'GPSCONFIRM',type: 'process',  data: { label: 'GPS Position Confirmed\nLatitude / Longitude / Accuracy', section: 'S3' } },
  { id: 'MAPPLACE',  type: 'process',  data: { label: 'Map Marker Placement\nDrag Marker to Refine Position', section: 'S3' } },
  { id: 'PDFQ',      type: 'decision', data: { label: 'Import PDF\nfor Auto-Fill?', section: 'S3' } },
  { id: 'PDFDROP',   type: 'process',  data: { label: 'Upload PDF Test Report\nOCR Engine Auto-Extracts Data', section: 'S3' } },
  { id: 'OILRV',     type: 'process',  data: { label: 'Review Imported Oil Tests\nVerify  ·  Edit  ·  Remove Rows', section: 'S3' } },
  { id: 'OILAPR',    type: 'decision', data: { label: 'Confirm\nImported Tests?', section: 'S3' } },
  { id: 'WITHTESTS', type: 'process',  data: { label: 'Transformer + Oil Tests\nQueued for Save', section: 'S3' } },
  { id: 'NOTEST',    type: 'process',  data: { label: 'Transformer Only\nOil Tests Not Imported', section: 'S3' } },
  { id: 'VALID',     type: 'decision', data: { label: 'All Required Fields\nComplete?', section: 'S3' } },
  { id: 'WARNNOTICE',type: 'warning',  data: { label: '⚠️  Missing Required Field\nSite Name / TX Name / Voltage', section: 'S3' } },
  { id: 'DUPLCK',    type: 'decision', data: { label: 'Serial Number\nConflict?', section: 'S3' } },
  { id: 'DUPWARN',   type: 'warning',  data: { label: '⚠️  Duplicate Serial Number\nOpen Existing Asset Instead', section: 'S3' } },
  { id: 'SAVETX',    type: 'success',  data: { label: '✅  Transformer Saved\nMarker Appears on Map', section: 'S3' } },

  // S4 Draw
  { id: 'DRWTYPE',   type: 'decision', data: { label: 'What to\nDraw?', section: 'S4' } },
  { id: 'DRAWCO',    type: 'process',  data: { label: 'Draw Company Polygon\nClick Points on Map to Trace', section: 'S4' } },
  { id: 'COMETAFORM',type: 'process',  data: { label: 'Set Company Metadata\nName  ·  Owner Type  ·  Description', section: 'S4' } },
  { id: 'SAVECOMP',  type: 'success',  data: { label: '✅  Company Boundary Saved\nOverlay Visible on Map', section: 'S4' } },
  { id: 'DRAWFP',    type: 'process',  data: { label: 'Draw Floor Plan Polygon\nClick Points on Map to Trace', section: 'S4' } },
  { id: 'FPMETAFORM',type: 'process',  data: { label: 'Set Floor Plan Metadata\nName  ·  Level  ·  Building Info', section: 'S4' } },
  { id: 'ASSIGNTX',  type: 'process',  data: { label: 'Assign Transformers to Floor\nAuto-Linked from Polygon', section: 'S4' } },
  { id: 'RESHAPEQ',  type: 'decision', data: { label: 'Adjust\nBoundary?', section: 'S4' } },
  { id: 'RESHAPE',   type: 'process',  data: { label: 'Reshape Polygon\nDrag Vertex Points to Refine', section: 'S4' } },
  { id: 'SAVEFP',    type: 'success',  data: { label: '✅  Floor Plan Saved\nTransformers Linked', section: 'S4' } },

  // S5 Asset Detail
  { id: 'DETMODAL',  type: 'process',  data: { label: 'Transformer Detail Modal\nAsset Info  ·  Specs  ·  GPS  ·  Edit', section: 'S5' } },
  { id: 'SECTAB',    type: 'decision', data: { label: 'Navigate to\nSection', section: 'S5' } },
  { id: 'SOT',       type: 'action',   data: { label: '🧪  Oil Test Section', section: 'S6A' } },
  { id: 'SDC',       type: 'action',   data: { label: '📎  Document Section', section: 'S6B' } },
  { id: 'SHD',       type: 'action',   data: { label: '❤️  Health Dashboard', section: 'S6C' } },
  { id: 'SDW',       type: 'action',   data: { label: '🔬  DGA Workbench', section: 'S6D' } },
  { id: 'STR',       type: 'action',   data: { label: '📈  Data Trending', section: 'S6E' } },

  // S6A Oil Tests
  { id: 'OILMETH',   type: 'decision', data: { label: 'Input\nMethod', section: 'S6A' } },
  { id: 'OILFORM',   type: 'process',  data: { label: 'Fill Oil Test Form\nSample Date  ·  Test Type (DGA / Full)', section: 'S6A' } },
  { id: 'DGAINPUT',  type: 'process',  data: { label: 'Enter DGA Gas Values (ppm)\nH2  CH4  C2H6  C2H4  C2H2  CO  CO2', section: 'S6A' } },
  { id: 'OILPARAMS', type: 'process',  data: { label: 'Enter Oil Quality Parameters\nBDV  ·  Moisture  ·  Acidity  ·  IFT  ·  Furan', section: 'S6A' } },
  { id: 'OCRPDF',    type: 'process',  data: { label: 'Upload PDF Test Report\nTesseract OCR Auto-Reads Values', section: 'S6A' } },
  { id: 'OCREDIT',   type: 'process',  data: { label: 'Review Extracted Values\nCorrect Any OCR Misread Fields', section: 'S6A' } },
  { id: 'TDCG',      type: 'process',  data: { label: 'Auto-Calculate TDCG\nTotal Dissolved Combustible Gas', section: 'S6A' } },
  { id: 'OILSAVE',   type: 'success',  data: { label: '✅  Oil Test Saved\nStatus: Healthy · Monitor · Action', section: 'S6A' } },

  // S6B Documents
  { id: 'DOCUP',     type: 'process',  data: { label: 'Upload Document File\nPDF  ·  Word  ·  Excel  ·  Image', section: 'S6B' } },
  { id: 'DOCSAVE',   type: 'success',  data: { label: '✅  File Stored in Supabase\nLinked to Transformer Record', section: 'S6B' } },

  // S6C Health Dashboard
  { id: 'HGAUGE',    type: 'process',  data: { label: 'Health Score Gauge\n0 – 100 Composite Score', section: 'S6C' } },
  { id: 'KPITILES',  type: 'process',  data: { label: 'Oil Quality KPI Tiles\nBDV  ·  Moisture  ·  Acidity  ·  IFT', section: 'S6C' } },
  { id: 'INSIGHTS',  type: 'process',  data: { label: 'Insights & Alerts Panel\nCaution / Critical Items Flagged', section: 'S6C' } },
  { id: 'LIFETILE',  type: 'process',  data: { label: 'Lifetime Usage Card\nDP via Furan · Remaining Life %', section: 'S6C' } },
  { id: 'FAULTRADAR',type: 'process',  data: { label: 'Fault Methods Summary\nDuval  ·  Rogers  ·  IEC Cards', section: 'S6C' } },

  // S6D DGA Workbench
  { id: 'DGAMETH',   type: 'decision', data: { label: 'Analysis\nMethod', section: 'S6D' } },
  { id: 'HEPT',      type: 'process',  data: { label: 'Heptagon DGA Plot\n7-Gas Polygon Visualization', section: 'S6D' } },
  { id: 'PENT',      type: 'process',  data: { label: 'Pentagon DGA Plot\n5-Zone Analysis', section: 'S6D' } },
  { id: 'DUVAL',     type: 'process',  data: { label: 'Duval Triangle Plot\nFault Zone Mapping', section: 'S6D' } },
  { id: 'OILTYPE',   type: 'decision', data: { label: 'Select\nOil Type', section: 'S6D' } },
  { id: 'GASSTD',    type: 'process',  data: { label: 'Apply Gas Limit Standard\nIEEE C57.104  ·  IEC 60599  ·  CIGRE', section: 'S6D' } },
  { id: 'FAULTDIAG', type: 'process',  data: { label: 'Fault Diagnosis Result\nFault Zone  ·  Severity  ·  Gas Status', section: 'S6D' } },
  { id: 'DGAHISTORY',type: 'process',  data: { label: 'DGA Trend on Polygon\nAll Historical Samples Overlaid', section: 'S6D' } },

  // S6E Trending
  { id: 'GASCHART',  type: 'process',  data: { label: 'DGA Gas Trend Charts\nH2  CH4  C2H6  C2H4  C2H2  CO  CO2', section: 'S6E' } },
  { id: 'OILCHART',  type: 'process',  data: { label: 'Oil Parameter Trends\nBDV  ·  Moisture  ·  Acidity  ·  IFT', section: 'S6E' } },
  { id: 'CORRCHART', type: 'process',  data: { label: 'Corrosion & Additive Charts\nDBDS  ·  Passivator  ·  Tan Delta', section: 'S6E' } },
  { id: 'HISTTABLE', type: 'process',  data: { label: 'Full History Table\nAll Test Records · Paginated · Sortable', section: 'S6E' } },

  // S7 Compare
  { id: 'CSELECT',   type: 'process',  data: { label: 'Select Assets to Compare\nPick Multiple Transformers', section: 'S7' } },
  { id: 'CSBSVIEW',  type: 'process',  data: { label: 'Side-by-Side Comparison\nLatest Oil Test per Transformer', section: 'S7' } },
  { id: 'CDGACOMP',  type: 'process',  data: { label: 'DGA Gas Comparison\nExceeded Limits Highlighted', section: 'S7' } },
  { id: 'COILCOMP',  type: 'process',  data: { label: 'Oil Metrics Comparison\nBDV  ·  Acidity  ·  IFT  ·  Moisture', section: 'S7' } },
  { id: 'CSTATUS',   type: 'process',  data: { label: 'Status Assessment Panels\nHealthy  ·  Monitor  ·  Action', section: 'S7' } },
  { id: 'COPEN',     type: 'process',  data: { label: 'Open Asset from Compare\nClick Card → Detail Modal', section: 'S7' } },

  // S8 Gallery
  { id: 'GALLVIEW',  type: 'process',  data: { label: 'Asset Card Gallery\nGrid of All Transformer Cards', section: 'S8' } },
  { id: 'GALLFILT',  type: 'process',  data: { label: 'Filter & Sort Cards\nBy Owner · DGA Status · Search', section: 'S8' } },
  { id: 'GALLCARD',  type: 'process',  data: { label: 'Asset Summary Card\nDGA Status  ·  GPS  ·  Gas Readings', section: 'S8' } },
  { id: 'GALLOPEN',  type: 'process',  data: { label: 'Open Asset Detail\nClick Card → Detail Modal', section: 'S8' } },
];

// ── Edge definitions ──────────────────────────────────────────────────────────
const EDGE_DEFAULTS = {
  type: 'smoothstep',
  style: { stroke: '#2e3f55', strokeWidth: 1.5 },
  labelStyle: { fill: '#8b97ab', fontSize: 9.5, fontFamily: 'system-ui,-apple-system,sans-serif' },
  labelBgStyle: { fill: '#141c27', fillOpacity: 0.92 },
  labelBgPadding: [4, 3],
  labelBgBorderRadius: 4,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#2e3f55', width: 14, height: 14 },
};

function e(id, source, target, label) {
  return label ? { id, source, target, label, ...EDGE_DEFAULTS } : { id, source, target, ...EDGE_DEFAULTS };
}

const RAW_EDGES = [
  // S1 Auth
  e('e01', 'STARTNODE', 'LAUNCH'),
  e('e02', 'LAUNCH',    'SESSCK'),
  e('e03', 'SESSCK',    'ROLELOAD',   'Yes — Active'),
  e('e04', 'SESSCK',    'SIGNINPAGE', 'No'),
  e('e05', 'SIGNINPAGE','AUTHRES'),
  e('e06', 'AUTHRES',   'SIGNINPAGE', 'Failed'),
  e('e07', 'AUTHRES',   'DISCLAIM',   'OK'),
  e('e08', 'DISCLAIM',  'ROLELOAD'),
  e('e09', 'ROLELOAD',  'IDLEQ'),
  e('e10', 'IDLEQ',     'SIGNINPAGE', 'Idle > 8h'),
  e('e11', 'IDLEQ',     'DASH',       'Active'),

  // S2 Dashboard features
  e('e12', 'DASH', 'SBR'),
  e('e13', 'DASH', 'QSTATS'),
  e('e14', 'DASH', 'MLAYER'),
  e('e15', 'DASH', 'GSEARCH'),
  e('e16', 'DASH', 'OWNFLT'),

  // Dashboard action branches
  e('e17', 'DASH', 'ACTREG'),
  e('e18', 'DASH', 'ACTDRAW'),
  e('e19', 'DASH', 'ACTOPEN'),
  e('e20', 'DASH', 'ACTCOMP'),
  e('e21', 'DASH', 'ACTGALL'),

  // S3 Registration
  e('e22', 'ACTREG',    'REGMETH'),
  e('e23', 'REGMETH',   'MANFORM',    '① Manual'),
  e('e24', 'REGMETH',   'GPSMOD',     '② GPS'),
  e('e25', 'GPSMOD',    'GPSCONFIRM'),
  e('e26', 'GPSCONFIRM','MAPPLACE'),
  e('e27', 'MANFORM',   'MAPPLACE'),
  e('e28', 'MAPPLACE',  'PDFQ'),
  e('e29', 'PDFQ',      'PDFDROP',    'Yes — Drop PDF'),
  e('e30', 'PDFQ',      'VALID',      'No'),
  e('e31', 'PDFDROP',   'OILRV'),
  e('e32', 'OILRV',     'OILAPR'),
  e('e33', 'OILAPR',    'WITHTESTS',  'Approve'),
  e('e34', 'OILAPR',    'NOTEST',     'Skip Tests'),
  e('e35', 'WITHTESTS', 'VALID'),
  e('e36', 'NOTEST',    'VALID'),
  e('e37', 'VALID',     'WARNNOTICE', '⚠️ Missing'),
  e('e38', 'WARNNOTICE','MANFORM'),
  e('e39', 'VALID',     'DUPLCK',     'OK'),
  e('e40', 'DUPLCK',    'DUPWARN',    'Duplicate'),
  e('e41', 'DUPWARN',   'MANFORM'),
  e('e42', 'DUPLCK',    'SAVETX',     'No Conflict'),
  e('e43', 'SAVETX',    'ACTOPEN'),

  // S4 Draw
  e('e44', 'ACTDRAW',   'DRWTYPE'),
  e('e45', 'DRWTYPE',   'DRAWCO',     'Company'),
  e('e46', 'DRAWCO',    'COMETAFORM'),
  e('e47', 'COMETAFORM','SAVECOMP'),
  e('e48', 'DRWTYPE',   'DRAWFP',     'Floor Plan'),
  e('e49', 'DRAWFP',    'FPMETAFORM'),
  e('e50', 'FPMETAFORM','ASSIGNTX'),
  e('e51', 'ASSIGNTX',  'RESHAPEQ'),
  e('e52', 'RESHAPEQ',  'RESHAPE',    'Yes — Reshape'),
  e('e53', 'RESHAPE',   'SAVEFP'),
  e('e54', 'RESHAPEQ',  'SAVEFP',     'No'),

  // S5 Asset Detail
  e('e55', 'ACTOPEN',   'DETMODAL'),
  e('e56', 'DETMODAL',  'SECTAB'),
  e('e57', 'SECTAB',    'SOT'),
  e('e58', 'SECTAB',    'SDC'),
  e('e59', 'SECTAB',    'SHD'),
  e('e60', 'SECTAB',    'SDW'),
  e('e61', 'SECTAB',    'STR'),

  // S6A Oil Tests
  e('e62', 'SOT',       'OILMETH'),
  e('e63', 'OILMETH',   'OILFORM',    '① Manual'),
  e('e64', 'OILFORM',   'DGAINPUT'),
  e('e65', 'DGAINPUT',  'OILPARAMS'),
  e('e66', 'OILPARAMS', 'TDCG'),
  e('e67', 'OILMETH',   'OCRPDF',     '② PDF Upload'),
  e('e68', 'OCRPDF',    'OCREDIT'),
  e('e69', 'OCREDIT',   'TDCG'),
  e('e70', 'TDCG',      'OILSAVE'),

  // S6B Documents
  e('e71', 'SDC',       'DOCUP'),
  e('e72', 'DOCUP',     'DOCSAVE'),

  // S6C Health
  e('e73', 'SHD',       'HGAUGE'),
  e('e74', 'HGAUGE',    'KPITILES'),
  e('e75', 'KPITILES',  'INSIGHTS'),
  e('e76', 'INSIGHTS',  'LIFETILE'),
  e('e77', 'LIFETILE',  'FAULTRADAR'),

  // S6D DGA
  e('e78', 'SDW',       'DGAMETH'),
  e('e79', 'DGAMETH',   'HEPT',       'Heptagon'),
  e('e80', 'DGAMETH',   'PENT',       'Pentagon'),
  e('e81', 'DGAMETH',   'DUVAL',      'Duval Triangle'),
  e('e82', 'HEPT',      'OILTYPE'),
  e('e83', 'PENT',      'OILTYPE'),
  e('e84', 'DUVAL',     'OILTYPE'),
  e('e85', 'OILTYPE',   'GASSTD',     'Select Standard'),
  e('e86', 'GASSTD',    'FAULTDIAG'),
  e('e87', 'FAULTDIAG', 'DGAHISTORY'),

  // S6E Trending
  e('e88', 'STR',       'GASCHART'),
  e('e89', 'GASCHART',  'OILCHART'),
  e('e90', 'OILCHART',  'CORRCHART'),
  e('e91', 'CORRCHART', 'HISTTABLE'),

  // S7 Compare
  e('e92', 'ACTCOMP',   'CSELECT'),
  e('e93', 'CSELECT',   'CSBSVIEW'),
  e('e94', 'CSBSVIEW',  'CDGACOMP'),
  e('e95', 'CDGACOMP',  'COILCOMP'),
  e('e96', 'COILCOMP',  'CSTATUS'),
  e('e97', 'CSTATUS',   'COPEN'),
  e('e98', 'COPEN',     'DETMODAL'),

  // S8 Gallery
  e('e99',  'ACTGALL',  'GALLVIEW'),
  e('e100', 'GALLVIEW', 'GALLFILT'),
  e('e101', 'GALLFILT', 'GALLCARD'),
  e('e102', 'GALLCARD', 'GALLOPEN'),
  e('e103', 'GALLOPEN', 'DETMODAL'),
];

// ── Dagre auto-layout ─────────────────────────────────────────────────────────
function buildLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 58, ranksep: 52, marginx: 40, marginy: 40 });

  nodes.forEach((n) => {
    const d = DIM[n.type] ?? DIM.process;
    g.setNode(n.id, { width: d.w, height: d.h });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target, {}, edge.id);
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    const d = DIM[n.type] ?? DIM.process;
    return { ...n, position: { x: pos.x - d.w / 2, y: pos.y - d.h / 2 } };
  });
}

// ── Legend strip ─────────────────────────────────────────────────────────────
const LEGEND = [
  { color: '#818cf8', label: '🔐 Auth' },
  { color: '#38bdf8', label: '🗺️ Dashboard' },
  { color: '#34d399', label: '➕ Register' },
  { color: '#fbbf24', label: '🏢 Draw' },
  { color: '#a78bfa', label: '📋 Asset Detail' },
  { color: '#f87171', label: '🧪 Oil Tests' },
  { color: '#67e8f9', label: '📎 Docs' },
  { color: '#fb7185', label: '❤️ Health' },
  { color: '#86efac', label: '🔬 DGA' },
  { color: '#93c5fd', label: '📈 Trending' },
  { color: '#d8b4fe', label: '⚖️ Compare' },
  { color: '#6ee7b7', label: '🖼️ Gallery' },
  { color: '#22c55e', label: '✅ Saved', round: true },
  { color: '#f59e0b', label: '⚠️ Warning', round: true },
  { color: '#64748b', label: '◇ Decision', round: true },
];

// ── Node detail modal (click any node to open) ───────────────────────────────
function NodeDetailModal({ node, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
  }, [node]);

  const requestClose = () => setIsVisible(false);

  // Capture-phase Esc so it closes the modal first, not the parent dialog
  useEffect(() => {
    if (!node) return;
    const handler = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setIsVisible(false); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [node]);

  if (!node) return null;

  const sec = SEC[node.data?.section];
  const [title, ...sub] = (node.data?.label ?? '').split('\n');
  const color = sec?.color ?? '#64748b';

  return (
    <AnimatePresence onExitComplete={onClose}>
    {isVisible && (
    <motion.div
      className="app-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.38, ease: 'easeIn' } }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}
      onClick={requestClose}
    >
      <motion.div
        className="app-modal-surface"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
        exit={{ opacity: 0, scale: 0.93, y: 20, transition: { duration: 0.42, ease: [0.4, 0, 1, 1] } }}
        style={{
          width: 460, maxWidth: '90vw',
          background: '#161b22', border: `1px solid ${color}33`,
          borderRadius: 14, overflow: 'hidden',
          boxShadow: `0 24px 64px rgba(0,0,0,.75), 0 0 0 1px rgba(0,0,0,.3), 0 0 24px ${color}18`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '14px 16px 12px',
          background: `linear-gradient(135deg,#1a2030,#1e2840)`,
          borderBottom: `1px solid ${color}22`,
        }}>
          {/* Section badge */}
          {sec && (
            <div style={{
              flexShrink: 0, marginTop: 1,
              padding: '2px 8px', borderRadius: 4,
              background: color + '1a', border: `1px solid ${color}44`,
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.09em', color,
            }}>
              {sec.label}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.35 }}>
              {title}
            </p>
            {sub.length > 0 && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                {sub.join('  ·  ')}
              </p>
            )}
          </div>
          <AppTooltip content="Close (Esc)">
            <button
              onClick={requestClose}
              style={{
                flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                color: '#475569', padding: '2px 3px', borderRadius: 4, lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
              aria-label="Close (Esc)"
            >
              <X size={15} />
            </button>
          </AppTooltip>
        </div>

        {/* ── Media placeholder ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 14, padding: '36px 24px',
          background: '#0d1117', minHeight: 190,
          borderBottom: '1px solid #1a2030',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#161b22', border: '1px dashed #2d3a4a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Video size={22} style={{ color: '#2d3a4a' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 500, color: '#334155' }}>
              No media attached
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#1e2d40', maxWidth: 280, lineHeight: 1.55 }}>
              Images and video guides for this step will be available here
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '8px 16px', background: '#111827', textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 10, color: '#1f2d3d' }}>
            Click outside or press Esc to close
          </p>
        </div>
      </motion.div>
    </motion.div>
    )}
    </AnimatePresence>
  );
}

export default function SOPFlowchartFlow({ onViewportChange }) {
  const layoutedNodes = useMemo(() => buildLayout(RAW_NODES, RAW_EDGES), []);
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117' }}>
      <style>{`
        .sop-rf .react-flow__controls-button{background:#161b22;border:1px solid #30363d;color:#94a3b8;fill:#94a3b8}
        .sop-rf .react-flow__controls-button:hover{background:#1e293b;color:#e2e8f0;fill:#e2e8f0}
        .sop-rf .react-flow__controls-button svg{fill:inherit}
        .sop-rf .react-flow__node{cursor:pointer}
        .sop-rf .react-flow__node:hover > div{outline:1px solid rgba(129,140,248,0.35);outline-offset:2px}
      `}</style>
      <div className="sop-rf" style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={layoutedNodes}
          edges={RAW_EDGES}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1, minZoom: 0.08 }}
          minZoom={0.08}
          maxZoom={2.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={(_, node) => setSelectedNode(node)}
          onMoveEnd={(_, vp) => onViewportChange?.(vp.zoom)}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#0d1117' }}
        >
          <Background variant="dots" color="#1e2d40" gap={22} size={1.5} />
          <Controls
            showInteractive={false}
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,.5)',
              overflow: 'hidden',
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem',
        padding: '0.5rem 1rem', borderTop: '1px solid #1e2d40',
        background: '#111827', flexShrink: 0,
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.09em', color: '#4b5563', marginRight: 2 }}>
          Steps
        </span>
        {LEGEND.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
            <div style={{
              width: 8, height: 8, background: item.color,
              borderRadius: item.round ? '50%' : 2, flexShrink: 0,
            }} />
            {item.label}
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#2d3a4a' }}>
          Click any node to view details
        </span>
      </div>

      {/* Node detail modal */}
      <NodeDetailModal node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
