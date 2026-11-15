# 3D Globe View

A CesiumJS view of the transformer fleet, opened with the **3D** button next to
the Map / Satellite / Hybrid switcher on the 2D map. **2D map** (top right)
returns to Leaflet. Both views show the same data.

## What is on screen

| Area | What it does |
|------|--------------|
| Left rail → **Tx list** | Search, filter by DGA status, grouped by state. Click a row to fly to the transformer. |
| Left rail → **Data layers** | On/off switch per layer, plus the 3D building styling presets. |
| Right → **DGA & oil result** | Latest gases vs. limits with trend, Duval primary fault, oil quality assessment. *Open full details* opens the normal transformer record. |
| Bottom dock | Location / Tx name / `lat, lon` search · home, north-up, tilt, zoom · visual presets and map source. |
| Top right | API keys, light/dark theme, back to 2D. |

Pin colour is the same DGA status as the 2D markers: it follows the gas limit
standard saved per transformer (critical at ≥ 110 % of a limit, warning at ≥ 105 %).

## API keys

Everything works without keys on Esri and OSM imagery. Keys add:

| Key | Unlocks | Where to get it |
|-----|---------|-----------------|
| Cesium ion token | 3D buildings (OSM Buildings 3D Tiles), world terrain, Bing aerial | https://ion.cesium.com/tokens (free tier) |
| Google Maps Platform key | Google Photorealistic 3D Tiles — enable the **Map Tiles API** | Google Cloud console |

Enter them in **3D view → key icon**. They are saved in this browser's
localStorage only. To give every user a default, set `VITE_CESIUM_ION_TOKEN` /
`VITE_GOOGLE_MAPS_API_KEY` in `.env` (and in Vercel). Either way the key is
visible to anyone using the app, so restrict it by HTTP referrer / allowed URL
in the provider's console.

**Other keys** in the same dialog stores extra named keys for layers added
later; read one with `resolveApiKey(settings, 'NAME')`.

## Adding or removing a layer

1. `lib/globe3d/layerRegistry.js` — one entry per switch (id, group, label, icon, `requires`, `defaultOn`).
2. `components/globe3d/sceneLayers.js` — a handler with `enable()` / `disable()` under the same id.
   `createFeedLayer` covers the common case: fetch a list, draw one entity per item.
3. `lib/globe3d/liveFeeds.js` — the fetch itself.

The **Reference feeds** group (power stations, substations, rain radar,
earthquakes) is sample content. To remove one, delete its registry
entry and its handler; nothing else refers to it.

### Where each reference feed comes from

| Layer | Source |
|-------|--------|
| Power stations | `public/data/power-plants-mys.json`, built from the WRI Global Power Plant Database (v1.3.0, 2021) by `npm run globe:plants`. Pass other ISO3 codes to the script for more countries. |
| Substations | OpenStreetMap via Overpass, for the current view only — zoom in first. |
| Rain radar | RainViewer, latest frame. |
| Earthquakes | USGS, M2.5+ over the past 7 days. |

A feed must allow browser (CORS) requests. OpenSky's flight API does not, which
is why there is no flights layer; a feed like that needs a small server-side
proxy.

While **Google 3D** is the map source, the OpenStreetMap place search in the
dock is switched off (Tx name and `lat, lon` still work): Google's terms only
allow Photorealistic 3D Tiles alongside Google's own geocoder.

## Building styling (3D Tiles)

Presets live in `lib/globe3d/buildingStyles.js` as plain Cesium styling-language
objects (`color` + `conditions`). Useful OSM Buildings properties:
`cesium#estimatedHeight`, `cesium#latitude`, `cesium#longitude`, `building`,
`name`. Add a preset by appending to `BUILDING_STYLES`.

## Files

```
components/globe3d/
  Globe3DView.jsx      shell: top bar, panels, dock, settings state
  CesiumScene.jsx      the Cesium viewer: imagery, terrain, buildings, pins, picking
  sceneLayers.js       reference-feed layer handlers
  sceneGraphics.js     canvas-drawn pins / cluster badges
  TxListPanel.jsx  DataLayersPanel.jsx  ResultPanel.jsx  BottomDock.jsx  ApiKeysDialog.jsx
  globe3d.css          teal dark / light theme, scoped under .g3d
lib/globe3d/
  layerRegistry.js  mapSources.js  buildingStyles.js  visualPresets.js
  settingsStore.js  assetSummary.js  liveFeeds.js
```

Cesium's workers and assets are copied to `/cesium` at build time
(`vite.config.mjs`), and the whole view is a lazy chunk so the 2D app does not
pay for it.
