import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'
import SOPStandalonePage from './components/SOPStandalonePage.jsx'
import { TooltipProvider } from './components/ui/tooltip'

const isSOP = window.location.hash === '#sop';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={180} skipDelayDuration={80}>
      {isSOP ? <SOPStandalonePage /> : <App />}
    </TooltipProvider>
  </React.StrictMode>,
)
