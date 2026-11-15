# Malaysia electricity infrastructure export

Coverage: Peninsular Malaysia, Sabah, Sarawak and Malaysian islands represented in the source. Data snapshot: 2026-11-14T21:20:41Z.

## Files
- malaysia_power_all.geojson: all 8,423 exported features with original geometry and source tags.
- malaysia_substation.geojson: 4,993 substation features (sites, not transformer counts).
- malaysia_transformer.geojson: 475 individually mapped transformer features.
- malaysia_line.geojson: 2,873 power=line features.
- malaysia_minor_line.geojson: 44 power=minor_line features.
- malaysia_cable.geojson: 38 power=cable features.
- malaysia_asset_markers.geojson: substations and transformers as point markers. Derived representative points are labelled; they are not surveyed transformer locations.
- malaysia_power_inventory.csv: searchable inventory; tags_json retains tags. Line geometry is in GeoJSON, not the CSV. Marker columns are blank for lines.
- metadata.json: provenance, counts and validation findings.
- malaysia_power_query.overpassql: an equivalent country-area query for future refreshes through Overpass. Area selection can differ at borders from spatial intersection.

## Import into your system
Coordinates are WGS84 longitude/latitude (EPSG:4326); GeoJSON coordinate order is [longitude, latitude]. Import the combined GeoJSON OR the individual layers, not both. The marker file is an alternative display of the same asset features and must not be counted as additional assets. Use osm_type + osm_id as the stable composite key; numeric IDs alone are not unique across OSM types. Names and ref values are not guaranteed unique.

Leaflet: use L.geoJSON(data) and layer controls for each category. MapLibre: add a GeoJSON source, then separate circle, fill and line layers filtered by power and geometry type. Serve data from your own app/server; do not issue a nationwide Overpass query on every page load. No base map tiles or OpenInfraMap style files are included.

Voltage values retain original OSM text, usually volts, sometimes multiple values separated by semicolons. Preserve the original field when deriving kV fields. Missing names, voltages, operators and ratings remain missing. No equipment serial numbers, test results, ownership verification or diagnostic assessments have been inferred.

## Scope and quality
Selection: power=substation, transformer, line, minor_line or cable intersecting Malaysia OSM administrative boundary; full geometry retained.
Full source geometry is retained; a cross-border feature can extend beyond Malaysia. The export includes the five power categories above, not every electrical object or decommissioned/proposed variants. Power plants, generators, towers, poles and switchgear are outside this package. Line counts are OSM geometry features/segments, not complete circuits or feeders.

OpenStreetMap is community-maintained and is not a complete or verified TNB/SEB/SESB asset register. An unmapped transformer is absent even when its substation is present. Actual on-site asset identity and electrical connectivity require verification. Your own asset records can be linked by a reviewed cross-reference table.

Geometry validation: 0 invalid geometries detected; see metadata.json. Source conversion errors are also recorded there. Original geometries are not silently repaired.

## Attribution and licence
Data © OpenStreetMap contributors, licensed under the Open Data Commons Open Database License (ODbL) 1.0.
Licence: https://opendatacommons.org/licenses/odbl/1-0/
Attribution: https://www.openstreetmap.org/copyright
Display “© OpenStreetMap contributors” with the attribution link on your map and retain the licence notice with redistributed data. Review the licence when distributing modified databases.

Source: https://download.geofabrik.de/asia/malaysia-singapore-brunei-261114.osm.pbf
OpenInfraMap data explanation: https://openinframap.org/about
