import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'
import { TooltipProvider } from './components/ui/tooltip'

// The standalone SOP page (#sop) pulls in the flowchart engine (@xyflow, dagre,
// d3). Loading it lazily keeps that out of the main app bundle.
const SOPStandalonePage = lazy(() => import('./components/SOPStandalonePage.jsx'))

const isSOP = window.location.hash === '#sop';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={180} skipDelayDuration={80}>
      {isSOP ? (
        <Suspense fallback={null}>
          <SOPStandalonePage />
        </Suspense>
      ) : (
        <App />
      )}
    </TooltipProvider>
  </React.StrictMode>,
)
