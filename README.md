# Transformer Asset Management System (Supabase Edition)

A comprehensive cloud-based transformer substation asset management application with **PostgreSQL database** and **cloud storage** via Supabase.

---

## Version 4.1 - Map Right-Click & Mobile Polish

Version 4.1 introduces a right-click map context menu for fast location actions, plus targeted mobile usability fixes across the Settings, DGA, Duval, and Compare dialogs. The sidebar quick-stats grid is also tightened so more content fits above the fold on smaller screens.

### Map Right-Click Context Menu

- Right-click anywhere on the map to open a location-aware context menu.
- Menu header displays the latitude and longitude of the right-clicked point to six decimal places.
- `Show address` — opens an info notice with the formatted coordinates for quick reference.
- `Add asset TX here` — opens the transformer form pre-filled with the clicked coordinates (disabled in read-only mode).
- `Open this on Google Maps` — launches the coordinate in a new browser tab on Google Maps.
- `Share this location` — uses the native share sheet when available, otherwise copies the Google Maps link to the clipboard and confirms with a success notice.
- `Search the Asset` — opens the sidebar (mobile or collapsed desktop) and auto-focuses the asset search input.
- Menu closes on outside click, on Escape, or after any action runs.
- Default browser context menu is suppressed on the map and app surfaces while signed in, but preserved on form inputs, textareas, dropdowns, and elements opted-in via `data-allow-browser-context-menu="true"`.

### Sidebar

- Asset search input now accepts a focus request from the map context menu and auto-selects existing text for fast replacement.
- Quick-stats grid (Assets, Companies, Floors, States) uses tighter padding, smaller icon shells, and reduced typography so all four cards fit comfortably on small screens.

### Notice Dialog

- Added a new `info` notice variant with a primary-color icon shell and panel gradient, used by `Show address` and other neutral confirmations.

### Combobox

- `Combobox` now supports `forwardRef` so parent components can attach refs for focus, measurement, or scroll behaviour.
- Dropdown portal z-index raised to 30000 so combobox menus always render above the map context menu and other overlays.

### Mobile Scrolling Fixes

- Settings dialog tagged as a mobile form dialog; the asset-owner visibility block now scrolls within a capped 45vh region instead of pushing the dialog off-screen.
- Admin Roles section in Settings scrolls vertically when the user list is long.
- DGA Analysis modal content area scrolls independently with overscroll containment.
- Duval Analysis modal switches to a flex column layout with a scrollable content region; auto-fit grids use `minmax(min(440px, 100%), 1fr)` and `minmax(min(320px, 100%), 1fr)` to prevent horizontal overflow on narrow viewports.
- Compare TX dialog tagged as a mobile form dialog so its content scrolls cleanly on phones.

### Form Fields

- Transformer add/edit form now drives the Paper Type selector through the shared `SelectField` `options` prop (including the `Not specified` placeholder) instead of inline `<option>` children, keeping the component API consistent across all selects.

### Top Map Overlay

- The mobile top bar consolidates the hamburger toggle, base-layer picker, and other quick controls into a single wrap-friendly row, saving vertical space on small screens.

---

## Version 4.0.1 - Weather And LST Intelligence Update

Version 4.0.1 adds an Open-Meteo weather workflow for oil sampling context, frontend-only NASA GIBS land surface temperature and urban heat overlays, plus asset visibility improvements for the sidebar hierarchy.

### Weather Tool

- Added an icon-only Weather tool to the map toolbar.
- Added Open-Meteo archive/forecast lookup for selected historical or current dates.
- Weather panel opens on the map as a draggable bottom-right overlay.
- Weather history is scoped to the selected site only, instead of listing every weather asset in the modal.
- Sample date dropdown now uses the selected transformer's oil test dates and automatically updates the weather date.
- Weather lookup defaults to 12:00 PM for the selected date.
- Weather fields now include Temperature, Humidity, Rain, Condition, Wind speed, and Dewpoint.
- Weather map overlay can be toggled independently from the panel.

### Hourly Weather Chart

- Added a collapsible bottom map drawer showing every hour from 12 AM until 11 PM.
- Chart displays temperature, dewpoint, and humidity trends for the selected site/date.
- Chart drawer is draggable and uses a fixed content box without vertical panel scrolling.
- Added cursor-following tooltip showing Temp, Dewpoint, Humidity, time, and condition.
- Hourly chips now show AM/PM time, temperature, and weather status icons such as Sunny, Cloudy, Rain, Drizzle, Fog, Storm, and Snow.

### Land Surface Temperature And Urban Heat

- Added an icon-only Land Surface Temperature tool beside the Weather tool in the map toolbar.
- Added public NASA GIBS MODIS Terra/Aqua day/night LST overlays for date-based regional heat context.
- Added public NASA GIBS VIIRS SNPP and NOAA-20 day/night LST overlays.
- Added static NASA GIBS 2013 Urban Heat Island summer day and summer night overlays.
- Added LST opacity control, date selection, sample-date shortcut, and split before/after comparison for daily LST layers.
- Static UHI layers disable date/sample/compare controls because they are fixed 2013 summer heat products.
- LST and UHI overlays run frontend-only through public NASA GIBS WMTS layers, with no Esri token or backend service required.

### Sidebar And Asset Visibility

- Improved company/floor asset counts so visible assets and assigned assets are clearer.
- Added visibility labels such as `visible/assigned` when Supabase permissions or filters hide assigned assets.
- Improved hierarchy messaging for floors with assigned assets that are not visible to the current account.

### Weather Notes

- Weather data is provided by Open-Meteo using the `openmeteo` npm package.
- Open-Meteo may return `Minutely API request limit exceeded`; wait one minute and refresh the weather panel if this happens.
- LST and UHI imagery is provided by NASA GIBS public WMTS services.

---

## 🏆 Version 4.0 — Major Release

> **The biggest update since the app launched.** Version 4.0 overhauls the entire user experience — smooth motion animations everywhere, a new sidebar look, guided onboarding tour, SOP workflow, smarter date and dropdown controls, transformer comparison, floor plan and company boundary drawing, and a clean app icon.

### Smooth Animations

✅ **App-wide motion** — Panels, modals, and overlays throughout the app now open and close with smooth spring-eased transitions powered by framer-motion  
✅ **Animated test modals** — View test and DGA Analysis overlays enter with a scale + fade and exit with a graceful slide-out  
✅ **Asset Card Gallery** — Grouped asset cards animate in and out with a timed close transition  
✅ **Collapsible panels** — DGA gas limits table and IEC 60422 parameters collapse and expand with a smooth chevron rotation  

### New Shared UI Components

✅ **Tooltip system** (`AppTooltip`) — Unified hover tooltips wired to every action button across the sidebar, document panel, image panel, and DGA views  
✅ **Combobox** — Searchable, keyboard-navigable dropdown replaces all native `<select>` elements — used in oil test form, image category, document assignment, DGA workbench, and import review  
✅ **Date Picker** — Custom calendar with quick-pick presets (Today, Tomorrow, In 3 days, In a week) and a **3-level drill-down**: click the month/year header to jump to a month grid, click the year to jump to a 12-year grid — no more arrow-clicking through months one at a time  
✅ **App icon** — Clean, simple icon displayed in the browser tab and app header for a more polished identity  

### Onboarding & Guidance

✅ **Guided spotlight tour** — Step-by-step feature tour highlights key areas (map, layers, tools) for new and returning users; auto-launches on first sign-in and can be replayed anytime from Settings  
✅ **SOP Flowchart** — Standard Operating Procedure workflow diagram accessible directly from the sidebar  
✅ **App Info Dialog** — About this app and disclaimer screens available from the sign-in page and settings  
✅ **Tour toggle in Settings** — Enable or disable auto-tour on sign-in, with a "Launch tour now" button  

### Oil Test Form

✅ **Date Picker integration** — Test date field now uses the new calendar picker with presets and drill-down month/year navigation  
✅ **Combobox for test type and oil type** — Searchable dropdowns replace the old selects  
✅ **Assessment section** — Renamed from "Additional Notes" and moved directly after Test Information for a more logical data-entry flow  

### DGA Analysis

✅ **Animated transitions** — View test and DGA Analysis panels use smooth framer-motion enter/exit animations  
✅ **Action buttons with tooltips** — Each test row now has a dedicated "View" button and "DGA Analysis" button with tooltip labels  
✅ **Calendar icon on test dates** — Date values in the test list display a calendar glyph for visual clarity  
✅ **DGA Workbench** — Oil type and gas standard selectors upgraded to Combobox; heptagon method buttons wrapped with descriptive tooltips  
✅ **Collapsible gas limits table** — Click the header row to collapse or expand the per-gas limit reference in the DGA Assessment panel  
✅ **Collapsible IEC 60422 panel** — Same collapsible pattern applied to the IEC 60422 oil quality parameters  

### Sidebar — New Look

✅ **Refreshed sidebar color scheme** — Updated palette and visual hierarchy make the sidebar feel lighter and more modern  
✅ **Tooltip-wrapped controls** — Add transformer and GPS/Location Register buttons show tooltip labels on hover  
✅ **SOP button** — Direct access to the SOP Flowchart from the main sidebar toolbar  
✅ **User info strip** — Username and role visible in the sidebar for quick context  

### Transformer Compare

✅ **Multi-asset comparison** — Select two or more transformers and compare their DGA gases, oil test results, and key metrics side by side in a single view  
✅ **Comparative DGA view** — Gas values highlighted with severity colors for fast visual comparison across assets  

### Floor Plan & Company Boundaries

✅ **Floor plan mapping** — Attach and overlay internal floor plan images on the map for substation layout reference  
✅ **Floor plan metadata** — Capture name, description, and scale per floor plan layer  
✅ **Company boundary drawing** — Draw, reshape, and label main company polygons directly on the map  
✅ **Boundary metadata** — Capture company name, state, and notes per boundary polygon  
✅ **Sidebar hierarchy** — Company boundaries appear as "Main" parent groups with asset counts and quick actions  

### Document & Image

✅ **Document compartment assignment** — Move a document to any compartment directly from the document list via Combobox  
✅ **Tooltips on document actions** — View and Download buttons now show tooltip labels  
✅ **Image category Combobox** — Category picker on upload and on existing images upgraded from native select  

### Sign-in Page

✅ **About and Disclaimer buttons** — Compact icon buttons at the sign-in footer open the App Info Dialog in About or Disclaimer mode  
✅ **Post-login disclaimer** — First-time users see the disclaimer immediately after credentials are accepted  

---

## 🚀 What's New in v3.9

✅ **Company parent boundaries** - Draw, reshape, and label main company polygons on the map  
✅ **Boundary metadata** - Capture company name, state, and notes per parent boundary  
✅ **Sidebar hierarchy updates** - Company boundaries appear as “Main” parents with counts + quick actions  
✅ **Transformer compare** - Select multiple assets and compare DGA + oil test metrics in one view  
✅ **Database support** - New `company_boundaries` table + indexes + RLS policy (Supabase migration)  

## 🚀 What's New in v3.8

✅ **Asset owner classification** - Tag each transformer as TNB or Non-TNB in the add/edit form  
✅ **Owner visibility filter** - Toggle TNB / Non-TNB / All from Settings to filter map + lists  
✅ **Owner badges everywhere** - Owner labels appear in cards, marker popups, and detail views  
✅ **Map place search** - Search roads, companies, and POI (OpenStreetMap) with a pinned result  
✅ **Database support** - New `owner_type` column + index for faster filtering (Supabase migration)  

## 🚀 What's New in v3.7

✅ **DGA assessment panel** - Per-gas limits, statuses, and references beside each oil test sample  
✅ **Life estimate snapshot** - Oil test summaries surface DP and life used at a glance  
✅ **IFT and water emphasis** - Quick summaries now highlight interfacial tension and moisture  
✅ **Duval zoom view** - Expandable Duval diagrams with modal detail in the health dashboard  
✅ **Cleaner test overview** - Consolidated results layout for faster scanning  

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Supabase account (free tier is fine)

### 1. Setup Supabase (5 minutes)

Follow the detailed guide: **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)**

Quick summary:
1. Create account at https://supabase.com
2. Create a new project
3. Run the SQL script to create tables
4. Create storage bucket for documents
5. Copy your API credentials

### 2. Install & Configure

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local and add your Supabase credentials
# VITE_SUPABASE_URL=your_project_url
# VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Run the App

```bash
npm run dev
```

Open http://localhost:3000

## 📋 Features

### Transformer Management
- **Add/Edit/Delete** transformers with complete details
- **GPS Tracking** with draggable map markers
- **Search & Filter** across all fields
- **Real-time Updates** across all devices

### Oil Test Tracking
- Complete physical and chemical test parameters
- DGA (Dissolved Gas Analysis) with all 7 gases
- Historical test records with trending
- Edit and delete capabilities

### Document Management
- **Cloud Storage** for PDFs and documents
- **Multiple file uploads** at once
- **View/Download** documents
- Support for PDF, Word, Excel, Images
- Up to 50MB per file

### Database Features
- **PostgreSQL** for reliable data storage
- **Foreign Keys** for data integrity
- **Indexes** for fast queries
- **Automatic Timestamps** for audit trails

## 📁 Project Structure

```
transformer-asset-map-supabase/
├── lib/
│   ├── supabaseClient.js          # Supabase configuration
│   ├── transformerService.js      # Transformer CRUD operations
│   ├── oilTestService.js          # Oil test CRUD operations
│   └── documentService.js         # Document upload/download
├── components/
│   ├── TransformerMarker.jsx      # Map markers
│   ├── TransformerSidebar.jsx     # Asset list
│   ├── TransformerModal.jsx       # Add/Edit forms
│   ├── TransformerDetailModal.jsx # Detail view
│   ├── OilTestSection.jsx         # Oil test management
│   └── DocumentSection.jsx        # Document management
├── App.jsx                         # Main application
├── App.css                         # Styling
├── .env.example                    # Environment template
└── SUPABASE_SETUP.md              # Setup instructions
```

## 🗄️ Database Schema

### Tables

**transformers**
- Complete transformer details
- GPS coordinates
- Timestamps for audit

**oil_tests**
- Physical and chemical tests
- DGA parameters
- Foreign key to transformers

**documents**
- File metadata
- Storage paths
- Foreign key to transformers

See `SUPABASE_SETUP.md` for complete SQL schema.

## 🔐 Security

- **Row Level Security (RLS)** enabled on all tables
- **Public policies** for easy access (can be restricted)
- **Storage policies** for file access control
- **Environment variables** for sensitive credentials
- **.env.local** excluded from Git

### Production Security Recommendations:
1. Enable Supabase Auth for user authentication
2. Restrict RLS policies to authenticated users only
3. Set up role-based access control
4. Use service role key only on backend
5. Enable SSL for all connections

## 📊 Data Management

### Viewing Data
Use Supabase Dashboard → Table Editor to view/edit data directly

### Exporting Data
```sql
-- In Supabase SQL Editor
COPY transformers TO STDOUT WITH CSV HEADER;
COPY oil_tests TO STDOUT WITH CSV HEADER;
```

### Backup
Supabase automatically backs up your database. You can also:
- Export data via SQL Editor
- Use Supabase CLI for automated backups
- Download storage files

## 🔧 Configuration

### Map Settings
Edit `App.jsx`:
```jsx
const [mapCenter, setMapCenter] = useState([3.1390, 101.6869]); // Your coordinates
const [mapZoom, setMapZoom] = useState(11); // Zoom level
```

### Theme Colors
Edit `App.css`:
```css
:root {
  --primary-color: #0f766e;
  --accent-color: #f59e0b;
  /* ... more variables ... */
}
```

### Storage Bucket
Edit `lib/documentService.js`:
```javascript
const BUCKET_NAME = 'transformer-documents'; // Your bucket name
```

## 🐛 Troubleshooting

### "Supabase is not configured"
- Check `.env.local` exists in project root
- Verify credentials are correct
- Restart dev server: `npm run dev`

### "relation does not exist"
- Run SQL schema from `SUPABASE_SETUP.md`
- Check table names are correct

### "Storage bucket not found"
- Create bucket in Supabase Dashboard → Storage
- Name it `transformer-documents`
- Set public bucket policy

### "Row Level Security" errors
- Check RLS policies are enabled
- Verify policies allow operations

### File upload fails
- Check bucket exists and is public
- Verify file size < 50MB
- Check storage policies

## 📈 Performance

- Supports **unlimited** transformers
- Efficient **indexed queries** for fast search
- **CDN delivery** for documents (Supabase handles this)
- **Connection pooling** by Supabase
- Optimized for **concurrent users**

## 🔄 Migration from LocalStorage Version

If you have data in the old LocalStorage version:

1. Export data from browser console:
```javascript
console.log(localStorage.getItem('transformers'));
```

2. Convert and import to Supabase via SQL Editor or create a migration script

## 🚀 Deployment

### Option 1: Vercel (Recommended)
```bash
npm run build
# Deploy dist/ folder to Vercel
# Add environment variables in Vercel dashboard
```

### Option 2: Netlify
```bash
npm run build
# Deploy dist/ folder to Netlify
# Add environment variables in Netlify settings
```

### Option 3: Traditional Hosting
```bash
npm run build
# Upload dist/ folder to your web server
```

**Important**: Add environment variables in your hosting platform settings.

## 📚 Additional Documentation

- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - Complete Supabase setup guide
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - How the app uses Supabase
- **[API_REFERENCE.md](API_REFERENCE.md)** - Service functions reference
- **[CHANGELOG.md](CHANGELOG.md)** - Release notes and version history

## 🆚 Comparison with LocalStorage Version

| Feature | LocalStorage | Supabase |
|---------|-------------|----------|
| Storage | Browser only | Cloud database |
| Access | Single device | Multiple devices |
| Collaboration | No | Yes (real-time) |
| Backup | Manual | Automatic |
| File Storage | Base64 (limited) | Cloud storage (50MB+) |
| Scalability | ~10MB limit | Unlimited |
| Production Ready | No | Yes |

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review `SUPABASE_SETUP.md` for setup issues
3. Check Supabase Dashboard for errors
4. Contact your laboratory IT team

## 📄 License

MIT License - Personal Use

---

**Version**: 4.1 (Supabase Edition)  
**Last Updated**: June 2026  
**Database**: PostgreSQL via Supabase  
**Storage**: Supabase Storage  
**Status**: Personal Project
