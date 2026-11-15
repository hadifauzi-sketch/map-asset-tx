# Data centre sources

The default **Malaysia tracker** uses `data-centres-malaysia.json`, independently published by [SEAFIC](https://seafic.org/data-center-mapping/). It contains 105 campuses, 142 phase records and 47 mapped campus positions (October 2026). See `malaysia-data-centres-ATTRIBUTION.md` for its CC BY 4.0 attribution and transformation details. Refresh it with `npm run data:centres:malaysia`.

The **Global directory** remains available separately. It contains the Ringmast4r data described below. Its Malaysia subset has 129 facility listings but only 28 source coordinate pairs. This is why replacing the Malaysia tracker with the global directory removed some map pins. Named facilities and anonymous campuses are not merged or matched by proximity. Source selection, record provenance and attribution are shared between 2D and 3D.

## Global directory

Data centers (c) Ringmast4r - Global-Data-Center-Map

Source: https://github.com/Ringmast4r/Global-Data-Center-Map

The exact upstream licence is included in `data-centres-LICENSE.txt`. Reuse and redistribution require visible attribution. The application displays a linked `© Ringmast4r` credit in both map views, the panel and facility details. CSV exports retain the source name and URL.

`data-centres-global.json` is imported from the repository's deduplicated `datacenters.json`, pinned to the commit recorded in its metadata. It contains 18,110 facilities and 6,131 valid source coordinate pairs. Malaysia has 129 facilities, 28 with coordinates. The layer starts with Malaysia selected and includes a worldwide view.

Records without coordinates remain in the directory and are not assigned inferred pins. Numeric coordinate strings are converted to numbers. Source country names and ISO codes are normalised where recognised; original country values are retained. Invalid or unidentified country labels appear as `Not recorded`. This produces a different country grouping from the repository README's headline statistics.

The source licence says positions can be building locations, city/state centres or country centroids. This dataset does not provide a reliable precision field, so the app uses dashed outlines and does not label a point as plot-confirmed. Empty coordinates stay null. Source positions are retained without geocoding or guessing corrections.

Capacity and status are only populated where the repository supplies them. Malaysia's entries have neither field. No figures or records from the previous source are carried over. Markers have a uniform size; there is no aggregate MW total because the source has partial reporting and no campus/phase accounting scheme.

Refresh with `npm run data:centres`. For a reproducible offline import:

```
node scripts/build-data-centres.mjs --input datacenters.json --ref COMMIT_SHA --license LICENSE
```

The app provides its own Overview, Directory and Appearance layout, independent of the source websites.
