"""Offline Cesium terrain for Malaysia from Copernicus DEM GLO-30.

    npm run globe:terrain
    python scripts/terrain/build_terrain.py data/dem public/data/terrain [--max-level 13] [--cells ...]

1. Downloads the 1-degree GLO-30 tiles covering Malaysia into `data/dem`
   (skips files already there; tiles that do not exist are open sea).
2. Writes Cesium `heightmap-1.0` terrain into `public/data/terrain`:

       layer.json               tile scheme, exact availability, attribution
       <z>/<x>/<y>.terrain      65 x 65 heights, child mask, water byte

   Level 13 samples every ~38 m, close to the 30 m source. Deep-zoom tiles that
   are entirely sea are skipped (the parent is upsampled there instead).

The 3D view loads this terrain when there is no Cesium ion token. Rebuild the
local buildings afterwards (`npm run globe:buildings`) so each building's base
sits on this ground.

Needs: numpy, tifffile, imagecodecs (pip install tifffile imagecodecs).
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import Pool

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dem import (  # noqa: E402
    ATTRIBUTION,
    HEIGHTMAP_SIZE,
    SOURCE_URL,
    TerrainSampler,
    cell_ranges,
    parse_tile_name,
    tile_name,
)

# Peninsular Malaysia (+ Singapore), Sarawak (+ Brunei), Sabah.
DEFAULT_CELLS = "99,1,104,6;109,0,115,4;115,4,119,7"
WINDOW_LEVEL = 8  # workers build one level-8 tile (0.70 deg) and all its descendants
MISSING_FILE = "missing-sea-tiles.json"
INTERVALS = HEIGHTMAP_SIZE - 1


# ── Download ────────────────────────────────────────────────────────────────

def download_tiles(dem_dir, cells, workers=4):
    os.makedirs(dem_dir, exist_ok=True)
    missing_path = os.path.join(dem_dir, MISSING_FILE)
    known_missing = set()
    if os.path.exists(missing_path):
        with open(missing_path, encoding="utf-8") as handle:
            known_missing = {tuple(cell) for cell in json.load(handle)}

    def fetch(cell):
        name = tile_name(*cell)
        target = os.path.join(dem_dir, f"{name}.tif")
        if os.path.exists(target):
            return cell, "cached", 0
        if cell in known_missing:
            return cell, "sea", 0
        partial = target + ".part"
        for attempt in range(4):
            try:
                with urllib.request.urlopen(SOURCE_URL.format(name=name), timeout=120) as response, \
                        open(partial, "wb") as handle:
                    size = 0
                    while True:
                        chunk = response.read(1 << 20)
                        if not chunk:
                            break
                        handle.write(chunk)
                        size += len(chunk)
                os.replace(partial, target)
                return cell, "downloaded", size
            except urllib.error.HTTPError as error:
                if error.code in (403, 404):  # the bucket answers 403/404 for sea-only cells
                    return cell, "sea", 0
                last_error = error
            except (urllib.error.URLError, TimeoutError, OSError) as error:
                last_error = error
            time.sleep(2 * (attempt + 1))
        if os.path.exists(partial):
            os.remove(partial)
        return cell, f"failed: {last_error}", 0

    todo = sorted(cells)
    total_bytes = 0
    failed = []
    with ThreadPoolExecutor(workers) as pool:
        for done, (cell, status, size) in enumerate(pool.map(fetch, todo), start=1):
            total_bytes += size
            if status == "sea":
                known_missing.add(cell)
            elif status.startswith("failed"):
                failed.append(cell)
            if status != "cached":
                print(f"  [{done}/{len(todo)}] {tile_name(*cell)}: {status}"
                      f"{f' ({size / 1e6:.1f} MB)' if size else ''}", flush=True)
    with open(missing_path, "w", encoding="utf-8") as handle:
        json.dump(sorted(known_missing), handle)
    print(f"Download: {total_bytes / 1e6:.0f} MB new, {len(known_missing)} sea cells, {len(failed)} failed", flush=True)
    if failed:
        raise SystemExit(f"Could not download {len(failed)} tiles; run again to retry: {failed}")


# ── Tiling helpers ──────────────────────────────────────────────────────────

def tile_width(level):
    return 180.0 / (2 ** level)


def tiles_over_cell(level, cell):
    """Inclusive TMS x/y range of level tiles that overlap a 1-degree cell."""
    w = tile_width(level)
    lon0, lat0 = cell
    x0 = math.floor((lon0 + 180.0) / w)
    x1 = math.ceil((lon0 + 1 + 180.0) / w) - 1
    y0 = math.floor((lat0 + 90.0) / w)
    y1 = math.ceil((lat0 + 1 + 90.0) / w) - 1
    return x0, x1, y0, y1


def tiles_over_cells(level, cells):
    tiles = set()
    for cell in cells:
        x0, x1, y0, y1 = tiles_over_cell(level, cell)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                tiles.add((x, y))
    return tiles


def encode_tile(heights, child_mask):
    """heights: 65 x 65, row 0 = north edge."""
    encoded = np.clip(np.round((heights + 1000.0) * 5.0), 0, 65535).astype("<u2")
    water = 1 if not np.any(heights) else 0  # whole tile at sea level
    return encoded.tobytes() + bytes([child_mask, water])


def write_tile(out_dir, level, x, y, data):
    directory = os.path.join(out_dir, str(level), str(x))
    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(directory, f"{y}.terrain"), "wb") as handle:
        handle.write(data)


CHILD_BITS = ((0, 0, 1), (1, 0, 2), (0, 1, 4), (1, 1, 8))  # SW, SE, NW, NE (TMS y grows north)


def child_mask_of(x, y, exists):
    mask = 0
    for dx, dy, bit in CHILD_BITS:
        if (2 * x + dx, 2 * y + dy) in exists:
            mask |= bit
    return mask


# ── Workers: one level-8 window -> levels 8..max ────────────────────────────

STATE = {}


def init_worker(dem_dir, max_level, out_dir):
    STATE["sampler"] = TerrainSampler(dem_dir, max_level=max_level, cache_size=4)
    STATE["max_level"] = max_level
    STATE["out_dir"] = out_dir


def build_window(window):
    """Samples the window once at full resolution, then cuts every level from it."""
    wx, wy, candidates = window
    sampler = STATE["sampler"]
    max_level = STATE["max_level"]
    out_dir = STATE["out_dir"]
    depth = max_level - WINDOW_LEVEL
    span = INTERVALS * (2 ** depth)  # lattice steps across the window

    i = wx * span + np.arange(span + 1)
    j_north = (wy + 1) * span - np.arange(span + 1)  # row 0 = north edge
    grid = sampler.nodes(i[None, :], j_north[:, None])
    nonzero = grid != 0.0

    written = {}
    exists_below = set()
    for level in range(max_level, WINDOW_LEVEL - 1, -1):
        per_side = 2 ** (level - WINDOW_LEVEL)
        stride = 2 ** (max_level - level)
        step = INTERVALS * stride
        level_candidates = candidates.get(level, set())
        exists = set()
        for row in range(per_side):
            for col in range(per_side):
                x = wx * per_side + col
                y = (wy + 1) * per_side - 1 - row
                if (x, y) not in level_candidates:
                    continue
                r0, c0 = row * step, col * step
                # Deep tiles that are pure sea are skipped; parents always exist.
                if level > WINDOW_LEVEL and not nonzero[r0:r0 + step + 1, c0:c0 + step + 1].any():
                    continue
                heights = grid[r0:r0 + step + 1:stride, c0:c0 + step + 1:stride]
                mask = child_mask_of(x, y, exists_below) if level < max_level else 0
                write_tile(out_dir, level, x, y, encode_tile(heights, mask))
                exists.add((x, y))
        written[level] = sorted(exists)
        exists_below = exists
    return (wx, wy), written


# ── Main ────────────────────────────────────────────────────────────────────

def availability(written, max_level):
    """Per level, merge the written tiles into row runs for layer.json `available`."""
    available = []
    for level in range(max_level + 1):
        rows = {}
        for x, y in written.get(level, ()):
            rows.setdefault(y, []).append(x)
        ranges = []
        for y in sorted(rows):
            xs = sorted(rows[y])
            start = prev = xs[0]
            for x in xs[1:] + [None]:
                if x is not None and x == prev + 1:
                    prev = x
                    continue
                ranges.append({"startX": start, "startY": y, "endX": prev, "endY": y})
                if x is not None:
                    start = prev = x
        available.append(ranges)
    return available


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dem_dir", help="where the GLO-30 GeoTIFFs are cached (e.g. data/dem)")
    parser.add_argument("out_dir", help="terrain output (e.g. public/data/terrain)")
    parser.add_argument("--max-level", type=int, default=13, help="finest level (13 = ~38 m, 12 = ~76 m)")
    parser.add_argument("--cells", default=DEFAULT_CELLS,
                        help="1-degree cells 'lonMin,latMin,lonMax,latMax;...' (inclusive, default Malaysia)")
    parser.add_argument("--workers", type=int, default=max(1, min(6, (os.cpu_count() or 2) - 1)))
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args()
    if args.max_level < WINDOW_LEVEL:
        parser.error(f"--max-level must be at least {WINDOW_LEVEL}")
    started = time.time()

    wanted = cell_ranges(args.cells)
    if not args.skip_download:
        print(f"Downloading Copernicus GLO-30 for {len(wanted)} cells -> {args.dem_dir}", flush=True)
        download_tiles(args.dem_dir, wanted)

    coverage = {
        key for key in (parse_tile_name(name) for name in os.listdir(args.dem_dir)) if key and key in wanted
    }
    if not coverage:
        raise SystemExit(f"No GLO-30 tiles in {args.dem_dir}")
    print(f"{len(coverage)} land cells; building levels 0-{args.max_level} with {args.workers} workers", flush=True)

    candidates = {level: tiles_over_cells(level, coverage) for level in range(1, args.max_level + 1)}
    candidates[0] = {(0, 0), (1, 0)}

    grouped = {}
    for level in range(WINDOW_LEVEL, args.max_level + 1):
        shift = level - WINDOW_LEVEL
        for x, y in candidates[level]:
            grouped.setdefault((x >> shift, y >> shift), {}).setdefault(level, set()).add((x, y))
    windows = [(wx, wy, grouped[(wx, wy)]) for wx, wy in sorted(candidates[WINDOW_LEVEL])]

    os.makedirs(args.out_dir, exist_ok=True)
    written = {level: set() for level in range(args.max_level + 1)}
    with Pool(args.workers, initializer=init_worker, initargs=(args.dem_dir, args.max_level, args.out_dir)) as pool:
        for done, ((wx, wy), tiles) in enumerate(pool.imap_unordered(build_window, windows), start=1):
            for level, items in tiles.items():
                written[level].update(map(tuple, items))
            if done % 10 == 0 or done == len(windows):
                print(f"  window {done}/{len(windows)} ({time.time() - started:.0f}s)", flush=True)

    # Levels 0..7 are few: sample them straight from the DEM.
    sampler = TerrainSampler(args.dem_dir, max_level=args.max_level, cache_size=8)
    for level in range(WINDOW_LEVEL - 1, -1, -1):
        scale = 2 ** (args.max_level - level)
        offsets = np.arange(HEIGHTMAP_SIZE)
        for x, y in sorted(candidates[level]):
            i = (x * INTERVALS + offsets) * scale
            j = ((y + 1) * INTERVALS - offsets) * scale
            heights = sampler.nodes(i[None, :], j[:, None])
            mask = child_mask_of(x, y, written[level + 1])
            write_tile(args.out_dir, level, x, y, encode_tile(heights, mask))
            written[level].add((x, y))

    lons = [cell[0] for cell in coverage]
    lats = [cell[1] for cell in coverage]
    layer = {
        "tilejson": "2.1.0",
        "name": "Copernicus GLO-30 Malaysia",
        "description": "Offline terrain built by scripts/terrain/build_terrain.py",
        "version": "1.0.0",
        "format": "heightmap-1.0",
        "scheme": "tms",
        "tiles": ["{z}/{x}/{y}.terrain?v={version}"],
        "projection": "EPSG:4326",
        "bounds": [min(lons), min(lats), max(lons) + 1, max(lats) + 1],
        "minzoom": 0,
        "maxzoom": args.max_level,
        "attribution": ATTRIBUTION,
        "available": availability(written, args.max_level),
    }
    with open(os.path.join(args.out_dir, "layer.json"), "w", encoding="utf-8") as handle:
        json.dump(layer, handle, separators=(",", ":"))

    count = sum(len(tiles) for tiles in written.values())
    print(f"Done: {count:,} terrain tiles in {time.time() - started:.0f}s -> {args.out_dir}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
