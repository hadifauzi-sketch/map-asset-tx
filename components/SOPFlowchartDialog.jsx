import { useEffect } from 'react';
import { ExternalLink, HelpCircle, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react';
import { AppTooltip } from './ui/app-tooltip';
import { Button } from './ui/button';
import SOPFlowchartFlow from './SOPFlowchartFlow';

function SOPFlowchartDialogInner({ open, onClose }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  const handleOpenNewTab = () => {
    window.open(window.location.origin + '/#sop', '_blank', 'noopener,noreferrer');
    onClose();
  };

  // Keyboard shortcuts: Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 fit, Esc close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn({ duration: 200 }); }
      else if (e.key === '-')             { e.preventDefault(); zoomOut({ duration: 200 }); }
      else if (e.key === '0')             { e.preventDefault(); fitView({ duration: 300, padding: 0.1 }); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, zoomIn, zoomOut, fitView]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2500] flex flex-col"
      style={{ background: '#0d1117' }}
      role="dialog"
      aria-modal="true"
      aria-label="Standard Operating Procedure Flowchart"
    >
      {/* ── Header ── */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5"
        style={{ background: '#161b22', borderColor: '#30363d' }}
      >
        {/* Title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight" style={{ color: '#e2e8f0' }}>
              Standard Operating Procedure
            </p>
            <p className="hidden text-xs leading-tight sm:block" style={{ color: '#8b949e' }}>
              Scroll: zoom&nbsp;·&nbsp;Drag: pan&nbsp;·&nbsp;Click node: details&nbsp;·&nbsp;Ctrl+0: fit
            </p>
          </div>
        </div>

        {/* Zoom controls */}
        <div
          className="flex items-center gap-0.5 rounded-md border p-1"
          style={{ background: '#1e293b', borderColor: '#30363d' }}
        >
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            aria-label="Zoom out (Ctrl minus)"
            onClick={() => zoomOut({ duration: 200 })} title="Zoom out (Ctrl −)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <AppTooltip content="Fit view (Ctrl 0)">
            <button
              type="button"
              className="min-w-[3.25rem] rounded px-1.5 py-0.5 text-center font-mono text-xs transition-colors hover:bg-[#2d3748]"
              style={{ color: '#e2e8f0' }}
              onClick={() => fitView({ duration: 300, padding: 0.1 })}
              aria-label="Fit view (Ctrl 0)"
            >
              {Math.round((zoom ?? 1) * 100)}%
            </button>
          </AppTooltip>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            aria-label="Zoom in (Ctrl plus)"
            onClick={() => zoomIn({ duration: 200 })} title="Zoom in (Ctrl +)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Open in new tab */}
        <Button
          variant="outline" size="icon" className="h-8 w-8 shrink-0"
          onClick={handleOpenNewTab}
          aria-label="Open in new tab (standalone view)"
          title="Open in new tab (standalone view)"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>

        {/* Close — return to main page */}
        <Button
          variant="outline" size="icon" className="h-8 w-8 shrink-0"
          aria-label="Close (Esc)"
          onClick={onClose} title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Flow canvas ── */}
      <div className="min-h-0 flex-1">
        <SOPFlowchartFlow />
      </div>
    </div>
  );
}

function SOPFlowchartDialog({ open, onClose }) {
  return (
    <ReactFlowProvider>
      <SOPFlowchartDialogInner open={open} onClose={onClose} />
    </ReactFlowProvider>
  );
}

export default SOPFlowchartDialog;
