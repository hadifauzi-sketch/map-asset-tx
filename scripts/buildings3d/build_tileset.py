"""Phase 2 of the local 3D buildings build: footprints -> 3D Tiles (b3dm).

    python -I scripts/buildings3d/build_tileset.py data/osm/buildings-extract.npz public/data/buildings3d [--workers N]

Writes a 3D Tiles 1.0 tileset the 3D view can stream with no Cesium ion token:

    tileset.json                      root: one child per 1-degree cell
    cells/<lon>_<lat>/tileset.json    external tileset: 0.1-degree blocks -> leaf tiles
    cells/<lon>_<lat>/<x>_<y>.b3dm    ~2 km leaf tile, extruded buildings

Leaf tiles appear when the camera is within a few km, so the browser only
ever holds the buildings near the view.

Geometry: each footprint (outer ring) is extruded from min_height to its top:
`height`, else `building:levels` x 3.2 m, else a default by building type.
With `--dem data/dem` each building is lifted onto the offline Copernicus
terrain (lowest ground under its footprint); without it, it sits at 0 m.
Walls get flat normals; roofs are flat. Positions are quantised to 16 bits per
tile (KHR_mesh_quantization, ~4 cm), normals to 8 bits.

Per-building properties (batch table) match the Cesium OSM Buildings names the
app's building styles and click card already read: name, building,
cesium#estimatedHeight, building:levels, cesium#latitude, cesium#longitude.

Data © OpenStreetMap contributors, ODbL 1.0.
"""

import argparse
import json
import math
import os
import struct
import sys
import time
from multiprocessing import Pool

import mapbox_earcut as earcut
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "terrain"))
from dem import TerrainSampler  # noqa: E402

LEAF_DEG = 0.02
BLOCK_DEG = 0.1
LEVEL_HEIGHT = 3.2
LEAF_PARENT_ERROR = 150.0  # leaves load within roughly 7 km
CELL_ERROR = 600.0
ROOT_ERROR = 100000.0

DEFAULT_HEIGHT = {
    "industrial": 10.0, "warehouse": 10.0, "factory": 10.0, "manufacture": 10.0, "hangar": 12.0,
    "commercial": 9.0, "retail": 8.0, "office": 12.0, "supermarket": 8.0, "mall": 15.0,
    "apartments": 18.0, "hotel": 18.0, "hospital": 15.0, "university": 12.0, "college": 12.0,
    "school": 9.0, "mosque": 10.0, "church": 10.0, "temple": 8.0, "stadium": 20.0,
    "shed": 3.0, "roof": 4.0, "garage": 3.0, "garages": 3.0, "carport": 3.0, "hut": 3.0,
    "kiosk": 3.0, "toilets": 3.0, "service": 4.0, "transformer_tower": 6.0,
}
FALLBACK_HEIGHT = 6.0

# WGS84
A = 6378137.0
E2 = 6.69437999014e-3


def ecef(lon_deg, lat_deg, h):
    lon = np.radians(lon_deg)
    lat = np.radians(lat_deg)
    sin_lat = np.sin(lat)
    cos_lat = np.cos(lat)
    n = A / np.sqrt(1.0 - E2 * sin_lat * sin_lat)
    x = (n + h) * cos_lat * np.cos(lon)
    y = (n + h) * cos_lat * np.sin(lon)
    z = (n * (1.0 - E2) + h) * sin_lat
    return np.stack([x, y, z], axis=-1)


def enu_basis(lon_deg, lat_deg):
    lon = math.radians(lon_deg)
    lat = math.radians(lat_deg)
    east = np.array([-math.sin(lon), math.cos(lon), 0.0])
    north = np.array([-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)])
    up = np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
    return east, north, up


def pad(data, boundary=8, fill=b" "):
    remainder = len(data) % boundary
    return data if remainder == 0 else data + fill * (boundary - remainder)


# ── Heights ─────────────────────────────────────────────────────────────────

def building_heights(height, min_height, levels, type_id, types):
    default = np.array([DEFAULT_HEIGHT.get(name, FALLBACK_HEIGHT) for name in types], dtype=np.float32)
    top = np.where(np.isfinite(height), height, np.where(np.isfinite(levels), levels * LEVEL_HEIGHT, default[type_id]))
    top = np.clip(top, 2.5, 700.0)
    base = np.where(np.isfinite(min_height) & (min_height < top - 1.0), min_height, 0.0)
    return base.astype(np.float64), top.astype(np.float64)


# ── Mesh for one leaf tile ─────────────────────────────────────────────────

def build_tile_mesh(lon, lat, offsets, base, top):
    """lon/lat: float64 vertices of all rings in the tile; offsets: ring starts (len B+1)."""
    count = len(offsets) - 1
    lengths = np.diff(offsets)
    building_of_vertex = np.repeat(np.arange(count), lengths)

    # Orient every ring counter-clockwise (seen from above).
    next_index = np.arange(len(lon)) + 1
    next_index[offsets[1:] - 1] = offsets[:-1]
    cross = lon * lat[next_index] - lon[next_index] * lat
    signed_area = np.add.reduceat(cross, offsets[:-1])
    clockwise = signed_area < 0
    if clockwise.any():
        position_in_ring = np.arange(len(lon)) - np.repeat(offsets[:-1], lengths)
        reversed_index = np.repeat(offsets[:-1], lengths) + (np.repeat(lengths, lengths) - 1 - position_in_ring)
        flip = np.repeat(clockwise, lengths)
        order = np.where(flip, reversed_index, np.arange(len(lon)))
        lon = lon[order]
        lat = lat[order]

    center_lon = float(lon.mean())
    center_lat = float(lat.mean())
    east, north, up = enu_basis(center_lon, center_lat)

    vertex_base = base[building_of_vertex]
    vertex_top = top[building_of_vertex]
    base_xyz = ecef(lon, lat, vertex_base)
    top_xyz = ecef(lon, lat, vertex_top)

    # Walls: 4 vertices per edge (flat shading).
    m_per_deg = 111320.0
    dx = (lon[next_index] - lon) * m_per_deg * math.cos(math.radians(center_lat))
    dy = (lat[next_index] - lat) * m_per_deg
    length = np.hypot(dx, dy)
    keep = length > 0.05
    edge = np.nonzero(keep)[0]
    nxt = next_index[edge]
    wall_pos = np.stack([base_xyz[edge], base_xyz[nxt], top_xyz[nxt], top_xyz[edge]], axis=1).reshape(-1, 3)
    normal_enu_x = dy[edge] / length[edge]
    normal_enu_y = -dx[edge] / length[edge]
    wall_normal = (np.outer(normal_enu_x, east) + np.outer(normal_enu_y, north))
    wall_normal = np.repeat(wall_normal, 4, axis=0)
    wall_batch = np.repeat(building_of_vertex[edge], 4)
    quad = np.arange(len(edge), dtype=np.int64)[:, None] * 4
    wall_index = (quad + np.array([0, 1, 2, 0, 2, 3])).reshape(-1)

    # Roofs: flat, ear-cut per building, then forced to face up.
    roof_start = len(wall_pos)
    roof_parts = []
    for b in range(count):
        start, end = offsets[b], offsets[b + 1]
        ring = np.stack([lon[start:end], lat[start:end]], axis=1)
        triangles = earcut.triangulate_float64(ring, np.array([end - start], dtype=np.uint32))
        if len(triangles):
            roof_parts.append(triangles.astype(np.int64) + start)
    roof_index = np.concatenate(roof_parts) if roof_parts else np.zeros(0, dtype=np.int64)
    if len(roof_index):
        tri = roof_index.reshape(-1, 3)
        area = (lon[tri[:, 1]] - lon[tri[:, 0]]) * (lat[tri[:, 2]] - lat[tri[:, 0]]) - (
            lon[tri[:, 2]] - lon[tri[:, 0]]
        ) * (lat[tri[:, 1]] - lat[tri[:, 0]])
        tri[area < 0] = tri[area < 0][:, [0, 2, 1]]
        roof_index = tri.reshape(-1) + roof_start

    positions = np.concatenate([wall_pos, top_xyz])
    normals = np.concatenate([wall_normal, np.tile(up, (len(top_xyz), 1))])
    batch_ids = np.concatenate([wall_batch, building_of_vertex]).astype(np.float32)
    indices = np.concatenate([wall_index, roof_index])
    return positions, normals, batch_ids, indices


# ── glTF / b3dm writers ─────────────────────────────────────────────────────

def make_glb(positions, normals, batch_ids, indices):
    center = (positions.min(axis=0) + positions.max(axis=0)) / 2.0
    local = positions - center
    low = local.min(axis=0)
    span = np.maximum(local.max(axis=0) - low, 1e-6)
    quantized = np.round((local - low) / span * 65535.0).astype(np.uint16)
    position_bytes = np.zeros((len(quantized), 4), dtype=np.uint16)
    position_bytes[:, :3] = quantized
    normal_bytes = np.zeros((len(normals), 4), dtype=np.int8)
    normal_bytes[:, :3] = np.clip(np.round(normals * 127.0), -127, 127).astype(np.int8)
    index_type = np.uint16 if len(positions) < 65535 else np.uint32

    chunks = [
        position_bytes.tobytes(),
        normal_bytes.tobytes(),
        batch_ids.astype(np.float32).tobytes(),
        pad(indices.astype(index_type).tobytes(), 4, b"\0"),
    ]
    views = []
    offset = 0
    for i, chunk in enumerate(chunks):
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(chunk)}
        if i < 3:
            view["byteStride"] = 8 if i == 0 else 4
            view["target"] = 34962
        else:
            view["target"] = 34963
        views.append(view)
        offset += len(chunk)
    binary = b"".join(chunks)

    q_min = [0, 0, 0]
    q_max = [int(v) for v in quantized.max(axis=0)]
    gltf = {
        "asset": {"version": "2.0", "generator": "asset-tx buildings3d"},
        "extensionsUsed": ["KHR_mesh_quantization"],
        "extensionsRequired": ["KHR_mesh_quantization"],
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{
            "mesh": 0,
            "translation": [float(v) for v in low],
            "scale": [float(v) for v in span],
        }],
        "meshes": [{"primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "_BATCHID": 2},
            "indices": 3,
            "material": 0,
            "mode": 4,
        }]}],
        "materials": [{
            "pbrMetallicRoughness": {"baseColorFactor": [0.92, 0.93, 0.92, 1.0], "metallicFactor": 0.0, "roughnessFactor": 1.0},
        }],
        "accessors": [
            {"bufferView": 0, "componentType": 5123, "normalized": True, "count": len(quantized), "type": "VEC3",
             "min": [v / 65535.0 for v in q_min], "max": [v / 65535.0 for v in q_max]},
            {"bufferView": 1, "componentType": 5120, "normalized": True, "count": len(normals), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(batch_ids), "type": "SCALAR"},
            {"bufferView": 3, "componentType": 5123 if index_type is np.uint16 else 5125, "count": len(indices), "type": "SCALAR"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
    }
    json_chunk = pad(json.dumps(gltf, separators=(",", ":")).encode(), 4, b" ")
    bin_chunk = pad(binary, 4, b"\0")
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    glb = struct.pack("<4sII", b"glTF", 2, total)
    glb += struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk
    glb += struct.pack("<I4s", len(bin_chunk), b"BIN\0") + bin_chunk
    return glb, center


def pad_from(data, offset, fill=b" "):
    """Pad so that `offset + len(result)` lands on an 8-byte boundary of the file."""
    remainder = (offset + len(data)) % 8
    return data if remainder == 0 else data + fill * (8 - remainder)


def make_b3dm(glb, rtc_center, batch_length, properties, numeric):
    # The spec measures alignment from the start of the file, header included,
    # so every section (and the embedded glb) starts on an 8-byte boundary.
    header_length = 28
    feature_json = pad_from(json.dumps({"BATCH_LENGTH": batch_length, "RTC_CENTER": [float(v) for v in rtc_center]},
                                       separators=(",", ":")).encode(), header_length)
    batch = dict(properties)
    binary = b""
    for key, values in numeric.items():
        batch[key] = {"byteOffset": len(binary), "componentType": "FLOAT", "type": "SCALAR"}
        binary = pad(binary + values.astype(np.float32).tobytes(), 8, b"\0")
    batch_json = pad_from(json.dumps(batch, separators=(",", ":"), ensure_ascii=False).encode(),
                          header_length + len(feature_json))
    total = header_length + len(feature_json) + len(batch_json) + len(binary) + len(glb)
    header = struct.pack("<4sIIIIII", b"b3dm", 1, total, len(feature_json), 0, len(batch_json), len(binary))
    return header + feature_json + batch_json + binary + glb


# ── Tiling ──────────────────────────────────────────────────────────────────

def region(lon_min, lat_min, lon_max, lat_max, h_min, h_max):
    return [math.radians(lon_min), math.radians(lat_min), math.radians(lon_max), math.radians(lat_max),
            float(h_min), float(h_max)]


DATA = {}


def init_worker(extract_path, dem_dir=None, terrain_max_level=13):
    DATA["terrain"] = TerrainSampler(dem_dir, max_level=terrain_max_level, cache_size=2) if dem_dir else None
    data = np.load(extract_path)
    DATA["coords"] = data["coords"]
    DATA["offsets"] = data["offsets"]
    types = json.loads(str(data["types"]))
    DATA["types"] = types
    DATA["names"] = json.loads(str(data["names"]))
    DATA["type_id"] = data["type_id"]
    DATA["name_id"] = data["name_id"]
    DATA["levels"] = data["levels"]
    DATA["base"], DATA["top"] = building_heights(
        data["height"], data["min_height"], data["levels"], data["type_id"], types
    )


def build_cell(job):
    """Writes every leaf tile + the external tileset of one 1-degree cell."""
    cell_key, buildings, out_dir = job
    coords, offsets = DATA["coords"], DATA["offsets"]
    cell_dir = os.path.join(out_dir, "cells", cell_key)
    os.makedirs(cell_dir, exist_ok=True)

    leaf_x = DATA_LEAF(buildings, 0)
    blocks = {}
    for (lx, ly), members in leaf_x.items():
        bx, by = math.floor(lx * LEAF_DEG / BLOCK_DEG + 1e-9), math.floor(ly * LEAF_DEG / BLOCK_DEG + 1e-9)
        members = np.asarray(members)
        starts = offsets[members]
        ends = offsets[members + 1]
        lengths = ends - starts
        vertex_index = np.concatenate([np.arange(s, e) for s, e in zip(starts, ends)])
        lon = coords[vertex_index * 2].astype(np.float64) / 1e7
        lat = coords[vertex_index * 2 + 1].astype(np.float64) / 1e7
        ring_offsets = np.concatenate([[0], np.cumsum(lengths)])
        height_above_ground = DATA["top"][members]
        base = DATA["base"][members]
        top = height_above_ground
        if DATA["terrain"] is not None:
            # Sit each building on the offline terrain: the lowest ground under
            # its footprint, so no corner floats on a slope.
            ground = np.minimum.reduceat(DATA["terrain"].ground(lon, lat), ring_offsets[:-1])
            base = base + ground
            top = top + ground
        positions, normals, batch_ids, indices = build_tile_mesh(lon, lat, ring_offsets, base, top)
        if len(indices) == 0:
            continue
        glb, rtc = make_glb(positions, normals, batch_ids, indices)

        centroid_lon = np.add.reduceat(lon, ring_offsets[:-1]) / lengths
        centroid_lat = np.add.reduceat(lat, ring_offsets[:-1]) / lengths
        names = DATA["names"]
        types = DATA["types"]
        properties = {
            "name": [names[i] if i >= 0 else "" for i in DATA["name_id"][members]],
            "building": [types[i] for i in DATA["type_id"][members]],
        }
        levels = DATA["levels"][members]
        numeric = {
            "cesium#estimatedHeight": height_above_ground,
            "building:levels": np.where(np.isfinite(levels), levels, 0.0),
            "cesium#longitude": centroid_lon,
            "cesium#latitude": centroid_lat,
        }
        file_name = f"{lx}_{ly}.b3dm"
        with open(os.path.join(cell_dir, file_name), "wb") as handle:
            handle.write(make_b3dm(glb, rtc, len(members), properties, numeric))

        leaf = {
            "boundingVolume": {"region": region(lon.min(), lat.min(), lon.max(), lat.max(), float(base.min()), float(top.max()))},
            "geometricError": 0.0,
            "content": {"uri": file_name},
            "_count": int(len(members)),
        }
        blocks.setdefault((bx, by), []).append(leaf)

    children = []
    total = 0
    for (bx, by), leaves in sorted(blocks.items()):
        regions = np.array([leaf["boundingVolume"]["region"] for leaf in leaves])
        count = sum(leaf.pop("_count") for leaf in leaves)
        total += count
        children.append({
            "boundingVolume": {"region": [float(regions[:, 0].min()), float(regions[:, 1].min()), float(regions[:, 2].max()),
                                          float(regions[:, 3].max()), float(regions[:, 4].min()), float(regions[:, 5].max())]},
            "geometricError": LEAF_PARENT_ERROR,
            "refine": "ADD",
            "children": leaves,
        })
    if not children:
        return None
    regions = np.array([child["boundingVolume"]["region"] for child in children])
    cell_region = [float(regions[:, 0].min()), float(regions[:, 1].min()), float(regions[:, 2].max()),
                   float(regions[:, 3].max()), float(regions[:, 4].min()), float(regions[:, 5].max())]
    cell_tileset = {
        "asset": {"version": "1.0", "gltfUpAxis": "Z"},
        "geometricError": CELL_ERROR,
        "root": {"boundingVolume": {"region": cell_region}, "geometricError": CELL_ERROR, "refine": "ADD", "children": children},
    }
    with open(os.path.join(cell_dir, "tileset.json"), "w", encoding="utf-8") as handle:
        json.dump(cell_tileset, handle, separators=(",", ":"))
    return {"key": cell_key, "region": cell_region, "count": total}


def DATA_LEAF(buildings, _):
    """Group building indices of a cell into leaf tiles by centroid."""
    coords, offsets = DATA["coords"], DATA["offsets"]
    groups = {}
    for b in buildings:
        start, end = offsets[b], offsets[b + 1]
        lon = coords[start * 2:end * 2:2].mean() / 1e7
        lat = coords[start * 2 + 1:end * 2:2].mean() / 1e7
        key = (math.floor(lon / LEAF_DEG), math.floor(lat / LEAF_DEG))
        groups.setdefault(key, []).append(b)
    return groups


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("extract")
    parser.add_argument("out_dir")
    # Each worker holds the whole extract (+ DEM tiles with --dem): keep the
    # default small so many-core machines do not run out of memory.
    parser.add_argument("--workers", type=int, default=max(1, min(6, (os.cpu_count() or 2) - 1)))
    parser.add_argument("--bbox", help="lon_min,lat_min,lon_max,lat_max (optional subset)")
    parser.add_argument("--dem", help="Copernicus GLO-30 folder (npm run globe:terrain): ground each building on it")
    parser.add_argument("--terrain-max-level", type=int, default=13, help="finest level of the offline terrain")
    args = parser.parse_args()
    started = time.time()
    dem_dir = args.dem if args.dem and os.path.isdir(args.dem) and any(
        name.endswith(".tif") for name in os.listdir(args.dem)) else None
    if args.dem and not dem_dir:
        print(f"No GLO-30 tiles in {args.dem}: buildings stay on the ellipsoid (run npm run globe:terrain first)",
              flush=True)

    data = np.load(args.extract)
    coords, offsets = data["coords"], data["offsets"]
    lengths = np.diff(offsets)
    first = offsets[:-1]
    # Approximate centroid via first vertex for cell assignment (exact centroid used for leaves).
    lon0 = coords[first * 2] / 1e7
    lat0 = coords[first * 2 + 1] / 1e7
    selected = np.arange(len(first))
    if args.bbox:
        w, s, e, n = (float(v) for v in args.bbox.split(","))
        selected = selected[(lon0 >= w) & (lon0 <= e) & (lat0 >= s) & (lat0 <= n)]
    cell_x = np.floor(lon0[selected]).astype(int)
    cell_y = np.floor(lat0[selected]).astype(int)
    order = np.lexsort((cell_y, cell_x))
    jobs = []
    keys = np.stack([cell_x[order], cell_y[order]], axis=1)
    boundaries = np.nonzero(np.any(np.diff(keys, axis=0) != 0, axis=1))[0] + 1
    for group in np.split(order, boundaries):
        if len(group) == 0:
            continue
        cx, cy = int(cell_x[group[0]]), int(cell_y[group[0]])
        jobs.append((f"{cx}_{cy}", selected[group], args.out_dir))
    jobs.sort(key=lambda job: -len(job[1]))
    print(f"{len(selected):,} buildings in {len(jobs)} cells, {args.workers} workers", flush=True)

    os.makedirs(args.out_dir, exist_ok=True)
    cells = []
    with Pool(args.workers, initializer=init_worker,
              initargs=(args.extract, dem_dir, args.terrain_max_level)) as pool:
        for done, result in enumerate(pool.imap_unordered(build_cell, jobs), start=1):
            if result:
                cells.append(result)
            print(f"  cell {done}/{len(jobs)} {result['key'] if result else '-'} "
                  f"{result['count'] if result else 0:,} buildings ({time.time() - started:.0f}s)", flush=True)

    cells.sort(key=lambda cell: cell["key"])
    regions = np.array([cell["region"] for cell in cells])
    root = {
        "asset": {"version": "1.0", "gltfUpAxis": "Z", "tilesetVersion": "osm-buildings-my"},
        "properties": {
            "source": "© OpenStreetMap contributors (ODbL)",
            "buildings": int(sum(c["count"] for c in cells)),
            # The 3D view reads this: grounded tiles need the matching offline
            # terrain (or a downward shift when terrain is off).
            "ground": "copernicus-glo30" if dem_dir else "ellipsoid",
        },
        "geometricError": ROOT_ERROR,
        "root": {
            "boundingVolume": {"region": [float(regions[:, 0].min()), float(regions[:, 1].min()), float(regions[:, 2].max()),
                                          float(regions[:, 3].max()), float(regions[:, 4].min()), float(regions[:, 5].max())]},
            "geometricError": ROOT_ERROR,
            "refine": "ADD",
            "children": [
                {"boundingVolume": {"region": cell["region"]}, "geometricError": CELL_ERROR,
                 "content": {"uri": f"cells/{cell['key']}/tileset.json"}}
                for cell in cells
            ],
        },
    }
    with open(os.path.join(args.out_dir, "tileset.json"), "w", encoding="utf-8") as handle:
        json.dump(root, handle, separators=(",", ":"))
    print(f"Done: {root['properties']['buildings']:,} buildings in {time.time() - started:.0f}s -> {args.out_dir}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
