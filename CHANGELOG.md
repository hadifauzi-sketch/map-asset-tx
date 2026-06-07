# Changelog

## 4.0.1 - Weather Intelligence Update

### Added

- Open-Meteo weather tool on the map toolbar.
- Weather history panel with date selection, oil sample date dropdown, and selected-site weather records.
- Weather map overlay with toggles for Temperature, Humidity, Rain, Condition, Wind speed, and Dewpoint.
- Hourly weather chart drawer showing 12 AM through 11 PM for the selected site and date.
- Cursor-following chart tooltip with Temp, Dewpoint, Humidity, time, and condition.
- Hourly weather chips with condition icons for Sunny, Cloudy, Rain, Drizzle, Fog, Storm, and Snow.

### Changed

- Weather panel now opens at the bottom right by default and can be dragged around the map.
- Hourly weather chart can be collapsed, expanded, dragged, and shown without vertical panel scrolling.
- Weather date picker follows the app's themed calendar UI.
- Sample date selection now uses oil test dates from the selected transformer and defaults the lookup time to 12:00 PM.
- Weather toolbar button is icon-only to match the surrounding map tools.
- Sidebar company/floor asset counts now clarify visible assets versus assigned assets.

### Fixed

- Weather history modal no longer lists every weather asset when a site is selected.
- Company and floor hierarchy messaging now helps identify assigned assets hidden by filters or Supabase permissions.
- Weather chart tooltip now follows the cursor while reading the nearest hourly point.

### Notes

- Weather data uses the `openmeteo` npm package and Open-Meteo archive/forecast APIs.
- If Open-Meteo returns `Minutely API request limit exceeded`, wait one minute and refresh the weather panel.

## 4.0.0 - Major Release

- App-wide animation refresh with framer-motion.
- New shared tooltip, combobox, and date picker UI.
- Guided onboarding tour, SOP flowchart, and app information dialogs.
- Oil test form, DGA analysis, sidebar, comparison, floor plan, company boundary, document, and image workflow improvements.
