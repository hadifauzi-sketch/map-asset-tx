"""Phase 1 of the local 3D buildings build: OSM extract -> building footprints.

    python -I scripts/buildings3d/extract_buildings.py data/osm/<extract>.osm.pbf data/osm/buildings-extract.npz

Reads every closed way / multipolygon tagged building=* (except building=no)
from a Geofabrik .osm.pbf and writes one compact .npz:

    coords      int32 [N*2]  outer-ring vertices, lon/lat in 1e-7 degrees,
                             closing vertex dropped (holes are not kept)
    offsets     int64 [B+1]  vertex index where each building starts
    height      float32[B]   OSM `height` in metres (NaN when missing)
    min_height  float32[B]   OSM `min_height` (NaN when missing)
    levels      float32[B]   OSM `building:levels` (NaN when missing)
    type_id     uint16 [B]   index into `types` (the building=* value)
    name_id     int32  [B]   index into `names`, -1 when unnamed
    osm_id      int64  [B]   way id (>0) or -relation id (<0)
    types/names              JSON string arrays

A multipolygon with several outer rings becomes one record per outer ring.
Data © OpenStreetMap contributors, ODbL 1.0.
"""

import json
import math
import re
import sys
import time

import numpy as np
import osmium

NUMBER = re.compile(r"-?\d+(?:\.\d+)?")


def parse_metres(value):
    """'12', '12 m', '12.5m', '40\\'' (feet) -> metres, else NaN."""
    if not value:
        return math.nan
    match = NUMBER.search(value)
    if not match:
        return math.nan
    number = float(match.group(0))
    if "'" in value or "ft" in value.lower():
        number *= 0.3048
    return number if 0 < number < 1000 else math.nan


def parse_levels(value):
    if not value:
        return math.nan
    match = NUMBER.search(value)
    if not match:
        return math.nan
    number = float(match.group(0))
    return number if 0 < number < 200 else math.nan


class BuildingHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.coords = []  # python ints, flattened lon,lat
        self.offsets = [0]
        self.height = []
        self.min_height = []
        self.levels = []
        self.type_id = []
        self.name_id = []
        self.osm_id = []
        self.types = {}
        self.names = {}
        self.skipped = 0
        self.started = time.time()

    def _intern(self, table, value):
        index = table.get(value)
        if index is None:
            index = table[value] = len(table)
        return index

    def area(self, area):
        tags = area.tags
        building = tags.get("building")
        if not building or building == "no":
            return
        height = parse_metres(tags.get("height"))
        min_height = parse_metres(tags.get("min_height"))
        levels = parse_levels(tags.get("building:levels"))
        type_index = self._intern(self.types, building)
        name = tags.get("name") or tags.get("name:en") or tags.get("name:ms")
        name_index = self._intern(self.names, name) if name else -1
        osm_id = area.orig_id() if area.from_way() else -area.orig_id()

        try:
            for ring in area.outer_rings():
                ring_coords = []
                for node in ring:
                    location = node.location
                    ring_coords.append(int(round(location.lon * 1e7)))
                    ring_coords.append(int(round(location.lat * 1e7)))
                if len(ring_coords) >= 8 and ring_coords[:2] == ring_coords[-2:]:
                    ring_coords = ring_coords[:-2]
                if len(ring_coords) < 6:
                    self.skipped += 1
                    continue
                self.coords.extend(ring_coords)
                self.offsets.append(len(self.coords) // 2)
                self.height.append(height)
                self.min_height.append(min_height)
                self.levels.append(levels)
                self.type_id.append(type_index)
                self.name_id.append(name_index)
                self.osm_id.append(osm_id)
        except osmium.InvalidLocationError:
            self.skipped += 1
            return

        count = len(self.osm_id)
        if count % 250000 == 0:
            print(f"  {count:,} buildings  ({time.time() - self.started:.0f}s)", flush=True)


def main(source, target):
    handler = BuildingHandler()
    print(f"Reading {source}", flush=True)
    handler.apply_file(source, locations=True, idx="flex_mem")
    count = len(handler.osm_id)
    print(f"{count:,} buildings, {len(handler.coords) // 2:,} vertices, {handler.skipped:,} skipped", flush=True)

    np.savez(
        target,
        coords=np.asarray(handler.coords, dtype=np.int32),
        offsets=np.asarray(handler.offsets, dtype=np.int64),
        height=np.asarray(handler.height, dtype=np.float32),
        min_height=np.asarray(handler.min_height, dtype=np.float32),
        levels=np.asarray(handler.levels, dtype=np.float32),
        type_id=np.asarray(handler.type_id, dtype=np.uint16),
        name_id=np.asarray(handler.name_id, dtype=np.int32),
        osm_id=np.asarray(handler.osm_id, dtype=np.int64),
        types=np.asarray(json.dumps(list(handler.types))),
        names=np.asarray(json.dumps(list(handler.names), ensure_ascii=False)),
    )
    print(f"Wrote {target} in {time.time() - handler.started:.0f}s", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
