import { useEffect } from 'react';
import { HelpCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react';
import { AppTooltip } from './ui/app-tooltip';
import SOPFlowchartFlow from './SOPFlowchartFlow';

function SOPStandaloneInner() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  // Set page title
  useEffect(() => {
    document.title = 'SOP Flowchart — Asset Tx Map V2';
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn({ duration: 200 }); }
      else if (e.key === '-')             { e.preventDefault(); zoomOut({ duration: 200 }); }
      else if (e.key === '0')             { e.preventDefault(); fitView({ duration: 300, padding: 0.1 }); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, fitView]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px', flexShrink: 0,
        background: '#161b22', borderBottom: '1px solid #30363d',
      }}>
        {/* Logo / Title */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(129,140,248,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HelpCircle size={14} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f1f5f9',
              fontFamily: 'system-ui,-apple-system,sans-serif', lineHeight: 1.2 }}>
              Standard Operating Procedure
            </p>
            <p style={{ margin: 0, fontSize: 10.5, color: '#4b5563',
              fontFamily: 'system-ui,-apple-system,sans-serif' }}>
              Asset Tx Map V2 · Full workflow flowchart
            </p>
          </div>
        </div>

        {/* Zoom controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 1,
          background: '#1e293b', border: '1px solid #30363d',
          borderRadius: 7, padding: '3px 4px',
        }}>
          <AppTooltip content="Zoom out (Ctrl −)">
            <button
              onClick={() => zoomOut({ duration: 200 })}
              aria-label="Zoom out (Ctrl minus)"
              style={btnStyle}
              onMouseEnter={btnHover} onMouseLeave={btnLeave}
            >
              <ZoomOut size={13} />
            </button>
          </AppTooltip>
          <AppTooltip content="Fit view (Ctrl 0)">
            <button
              onClick={() => fitView({ duration: 300, padding: 0.1 })}
              aria-label="Fit view (Ctrl 0)"
              style={{ ...btnStyle, minWidth: 46, fontFamily: 'monospace', fontSize: 11 }}
              onMouseEnter={btnHover} onMouseLeave={btnLeave}
            >
              {Math.round((zoom ?? 1) * 100)}%
            </button>
          </AppTooltip>
          <AppTooltip content="Zoom in (Ctrl +)">
            <button
              onClick={() => zoomIn({ duration: 200 })}
              aria-label="Zoom in (Ctrl plus)"
              style={btnStyle}
              onMouseEnter={btnHover} onMouseLeave={btnLeave}
            >
              <ZoomIn size={13} />
            </button>
          </AppTooltip>
        </div>

        {/* Keyboard hint */}
        <span style={{ fontSize: 10, color: '#2d3a4a',
          fontFamily: 'system-ui,-apple-system,sans-serif', flexShrink: 0 }}>
          Scroll: zoom&nbsp;·&nbsp;Drag: pan&nbsp;·&nbsp;Click node: details
        </span>
      </div>

      {/* ── Flow canvas ── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SOPFlowchartFlow />
      </div>
    </div>
  );
}

const btnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#94a3b8', borderRadius: 5, padding: '4px 6px',
  transition: 'background 0.12s, color 0.12s', height: 26,
};
const btnHover  = (e) => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#e2e8f0'; };
const btnLeave  = (e) => { e.currentTarget.style.background = 'none';    e.currentTarget.style.color = '#94a3b8'; };

export default function SOPStandalonePage() {
  return (
    <ReactFlowProvider>
      <SOPStandaloneInner />
    </ReactFlowProvider>
  );
}
