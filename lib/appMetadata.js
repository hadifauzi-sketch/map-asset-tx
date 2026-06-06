export const APP_METADATA = {
  name: 'Transformer Asset Management System',
  currentVersion: '4.0.0',
  currentReleaseSeries: '4.0',
  authorName: 'ChM. Ts. Hadi Fauzi, MRSC',
  authorRole: 'Developer and workflow designer',
  authorUrl: 'https://www.linkedin.com/in/chm-hadi-fauzi/',
  summary:
    'Cloud-based transformer asset management for map-based asset tracking, oil test review, DGA analysis, document handling, and access-controlled collaboration.',
  focusNote: 'TX Asset Management for Reliable and Proactive Maintenance.',
};

export const APP_RELEASE_NOTES = [
  {
    version: '4.0',
    items: [
      'Smooth animations - App-wide framer-motion transitions on modals, overlays, panels, and collapsible sections.',
      'Tooltip system - Unified AppTooltip wired to every action button across sidebar, documents, images, and DGA views.',
      'Combobox - Searchable keyboard-navigable dropdown replaces all native selects in oil test form, image category, document assignment, DGA workbench, and import review.',
      'Date Picker - Custom calendar with quick-pick presets and 3-level drill-down: click header for month grid, click year for 12-year grid.',
      'App icon - Clean simple icon displayed in the browser tab and app header.',
      'Guided onboarding tour - Step-by-step spotlight tour for new users; auto-launches on first sign-in, replayable from Settings.',
      'SOP Flowchart - Standard Operating Procedure workflow diagram accessible from the sidebar.',
      'App Info Dialog - About and disclaimer screens at sign-in and post-login for first-time users.',
      'Assessment section - Renamed from Additional Notes, moved directly after Test Information in the oil test form.',
      'Animated DGA modals - View test and DGA Analysis overlays use framer-motion spring-eased enter/exit transitions.',
      'Sidebar new look - Refreshed color scheme, user info strip, tooltip-wrapped controls, and SOP quick-access button.',
      'Transformer compare - Select multiple assets and compare DGA gases and oil test metrics side by side.',
      'Company boundary drawing - Draw, reshape, and label company polygons on the map with metadata capture.',
      'Floor plan mapping - Attach and overlay internal floor plan images on the map with name and scale metadata.',
      'Collapsible panels - DGA gas limits table and IEC 60422 parameters table toggle open/closed by clicking the header row.',
      'Document compartment assignment - Move documents between compartments via inline Combobox in the document list.',
      'Image category Combobox - Category picker on upload and on existing images upgraded from native select.',
    ],
  },
  {
    version: '3.9',
    items: [
      'Company parent boundaries - Draw, reshape, and label main company polygons on the map.',
      'Boundary metadata - Capture company name, state, and notes per parent boundary.',
      'Sidebar hierarchy updates - Company boundaries appear as Main parents with counts and quick actions.',
      'Transformer compare - Select multiple assets and compare DGA and oil test metrics in one view.',
    ],
  },
  {
    version: '3.8',
    items: [
      'Asset owner classification - Tag each transformer as TNB or Non-TNB in the add and edit form.',
      'Owner visibility filter - Toggle TNB, Non-TNB, or All from Settings to filter map and lists.',
      'Owner badges everywhere - Owner labels appear in cards, marker popups, and detail views.',
      'Map place search - Search roads, companies, and POI with a pinned OpenStreetMap result.',
    ],
  },
  {
    version: '3.7',
    items: [
      'DGA assessment panel - Per-gas limits, statuses, and references beside each oil test sample.',
      'Life estimate snapshot - Oil test summaries surface DP and life used at a glance.',
      'IFT and water emphasis - Quick summaries now highlight interfacial tension and moisture.',
      'Duval zoom view - Expandable Duval diagrams with modal detail in the health dashboard.',
      'Cleaner test overview - Consolidated results layout for faster scanning.',
    ],
  },
];

export const APP_DISCLAIMER = [
  'This application is a beta or trial release and is still under active testing. Any calculations, analysis results, and recommendations should be independently reviewed before operational use.',
  'The app is built with open-source technologies, including JavaScript, TypeScript, SQL databases, OpenStreetMap, and Leaflet. IEC, IEEE, and journal-based methods remain subject to their original licensed or paid sources.',
  'The app design and workflow were developed by ChM. Ts. Hadi Fauzi, MRSC.',
  'This application is still being verified by engineers, chemists, and technical experts before release. If you find any issue or bug, please contact the developer.',
];
