# Malaysia solar and LSS map data

Coverage: all Malaysia, including Sabah and Sarawak. OpenStreetMap snapshot: 2026-11-14T21:20:41Z.

## Start here for your map
Use malaysia_solar_farm_candidates.geojson for the broad solar-farm/site layer, and malaysia_solar_generators_panels.geojson for the detailed mapped panel areas. Use malaysia_solar_farm_markers.geojson when you want clickable site markers. Draw the panel layer above the site boundaries. Retain capacity and name properties for popups.

The farm candidate layer contains 110 records: solar-tagged power=plant features excluding explicitly indicated rooftop and hybrid installations, plus standalone solar generators whose name identifies a solar farm/park or LSS and whose representative point is outside mapped solar-plant areas. These are mapping candidates, NOT verified LSS projects. Small or otherwise unsuitable plants can remain when tags are incomplete. No capacity threshold has been used to infer LSS programme eligibility.

## Files and counts
- malaysia_solar_plants.geojson: 108 solar-tagged plant/site records, including any smaller, rooftop or hybrid installations tagged as plants.
- malaysia_solar_generators_panels.geojson: 646 solar generator, panel-row or panel-cluster features. This file also includes rooftop systems. It is not a count of individual panels or solar farms. Use location and export_rooftop_indicated to filter.
- malaysia_solar_all.geojson: all 754 source solar-tagged features; an alternative to loading the two files above separately.
- malaysia_solar_farm_candidates.geojson: 110 candidate site records as defined above.
- malaysia_solar_farm_markers.geojson: alternative point display of the same candidates; these are not additional assets.
- malaysia_lss_name_matches.geojson: 12 records explicitly mentioning LSS, LSSPV, LSS4, or large-scale solar in source name/description fields. This is a subset and does not include every actual LSS project.
- malaysia_solar_name_review.geojson: 9 additional plant/generator records with solar-related names but without the qualifying solar tags. These may be hybrid facilities and remain separate for review.
- malaysia_solar_inventory.csv: all tagged solar and additional review records, with names, coordinates, operators and capacity values where provided.
- malaysia_solar_farm_candidates.csv: candidate site inventory for easier review.
- metadata.json: provenance, counts, capacity parsing and geometry validation results.

## Capacity: what the MW value means
34 plant records have an explicitly unit-tagged numeric electricity output value that could be converted to MW. Source values are preserved in plant:output:electricity or generator:output:electricity and export_capacity_raw. export_capacity_mw converts explicit W/kW/MW/GW units only. MWp is labelled peak; AC/DC is preserved only if explicit in the unit. A plain MW value does not establish whether it is AC or DC. Do not treat these values as live generation readings.

“yes” means electricity output is tagged but no numeric capacity is supplied. A unitless value such as “29.9” is left unconverted, rather than assumed to be MW. Missing or unparsed capacity is null, not zero. No capacity has been estimated from area or panel count, and name text has not been used to infer numeric capacity. Do not sum site capacities together with panel/generator capacities; they may describe the same installation.

## Integration
GeoJSON uses WGS84 [longitude, latitude]. Use full feature id (node/..., way/..., relation/...) as the database key. Do not import alternative layers as additional records: candidates, markers and LSS name matches overlap the full plant/generator layers. Polygon coordinates preserve mapped outlines. Original node coordinates are retained; CSV coordinates and derived marker points are representative points, not surveyed transformer locations.

Original source tags are preserved. Added fields use the export_ prefix except the standard osm_type, osm_id, osm_url and country_iso2 fields. export_spatial_parent_plant_ids is based on the generator's representative point falling inside mapped solar-plant areas; it is an inferred spatial link, not confirmed ownership or electrical connectivity. Arrays and JSON values are kept in GeoJSON; the CSV tags_json field retains source details. CSV text that could be interpreted as a formula is escaped with an apostrophe.

Geometry validation found 0 invalid geometries and 0 conversion errors. Original power geometries are not silently repaired. A relation may be represented as a GeometryCollection; use the marker layer if your frontend does not support that geometry type. These files supplement the earlier Malaysia substations, transformers and lines package; no previous package has been changed.

## Coverage and LSS status
OpenInfraMap displays OpenStreetMap data. This package extracts the mapped geometries and tags; it does not certify official LSS awards, commissioning dates, ownership, or operational status. The presence of power=plant is not evidence of LSS programme membership. Rooftop and hybrid flags rely on available names/tags and can be incomplete. Lifecycle-only objects such as proposed:power without power=plant/generator are outside this extraction. Community mapping can omit sites or describe one physical site using multiple records.

## Source and licence
Data © OpenStreetMap contributors, Open Data Commons Open Database License (ODbL) 1.0.
https://opendatacommons.org/licenses/odbl/1-0/
https://www.openstreetmap.org/copyright
Retain attribution and licence notices when displaying or redistributing the data.
Source: https://download.geofabrik.de/asia/malaysia-singapore-brunei-261114.osm.pbf
Map source explanation: https://openinframap.org/about
Tagging: https://wiki.openstreetmap.org/wiki/Tag:plant:source=solar
