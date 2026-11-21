"""Terrain-RGB elevation tiles (MapLibre / Mapbox `raster-dem`) from Copernicus GLO-30.

    npm run globe:terrain-dem
    python scripts/terrain/build_terrain_dem.py data/dem public/data/terrain-dem [--max-zoom 12] [--encoding mapbox]

Reads the GLO-30 tiles that `npm run globe:terrain` downloaded into data/dem
(downloads them first if the folder is empty) and writes:

    tiles.json            TileJSON: tile URL, zoom range, bounds, attribution
    <z>/<x>/<y>.png       256 px Web Mercator (XYZ) tiles, heights encoded as RGB

Zoom 12 is ~38 m per pixel at the equator, close to the 30 m source; MapLibre
over-zooms past it. Lower zooms are 2 x 2 averages of the zoom below. Tiles
cover the whole bounding box of the downloaded land, sea included (sea tiles
are a few hundred bytes), so MapLibre never requests a missing tile.

Encodings (both read natively by MapLibre's raster-dem source):
    mapbox     height = -10000 + (R * 65536 + G * 256 + B) * 0.1
    terrarium  height = R * 256 + G + B / 256 - 32768

Use in MapLibre GL JS (tileSize must be 256 for these tiles):

    map.addSource('dem', {
      type: 'raster-dem',
      url: '/data/terrain-dem/tiles.json',
      tileSize: 256,
      encoding: 'mapbox',
    });
    map.setTerrain({ source: 'dem', exaggeration: 1 });

Heights are the same EGM2008 metres used by the Cesium offline terrain.
Needs: numpy, Pillow, tifffile, imagecodecs.
"""

import argparse
import io
import json
import math
import os
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dem import ATTRIBUTION, DemMosaic, cell_ranges, parse_tile_name  # noqa: E402

TILE = 256
WINDOW_ZOOM = 9  # each worker builds one zoom-9 tile and every tile below it
DEFAULT_CELLS = "99,1,104,6;109,0,115,4;115,4,119,7"  # same as build_terrain.py


# ── Web Mercator ────────────────────────────────────────────────────────────

def lon_to_x(lon, zoom):
    return (lon + 180.0) / 360.0 * (2 ** zoom)


def lat_to_y(lat, zoom):
    rad = math.radians(lat)
    return (1.0 - math.log(math.tan(rad) + 1.0 / math.cos(rad)) / math.pi) / 2.0 * (2 ** zoom)


def tile_range(bounds, zoom):
    west, south, east, north = bounds
    last = 2 ** zoom - 1
    x0 = max(0, int(math.floor(lon_to_x(west, zoom))))
    x1 = min(last, int(math.ceil(lon_to_x(east, zoom))) - 1)
    y0 = max(0, int(math.floor(lat_to_y(north, zoom))))
    y1 = min(last, int(math.ceil(lat_to_y(south, zoom))) - 1)
    return x0, x1, y0, y1


def pixel_centres(tile_x0, tile_y0, tiles_across, zoom):
    """Longitudes of the pixel columns and latitudes of the pixel rows of a block of tiles."""
    world = TILE * (2 ** zoom)
    pixels = np.arange(tiles_across * TILE) + 0.5
    lon = (tile_x0 * TILE + pixels) / world * 360.0 - 180.0
    y = (tile_y0 * TILE + pixels) / world
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1.0 - 2.0 * y))))
    return lon, lat


# ── Encoding ────────────────────────────────────────────────────────────────

def encode_rgb(heights, encoding):
    if encoding == "terrarium":
        value = np.clip(heights + 32768.0, 0.0, 65535.996)
        red = np.floor(value / 256.0)
        green = np.floor(value - red * 256.0)
        blue = np.floor((value - np.floor(value)) * 256.0)
        rgb = np.stack([red, green, blue], axis=-1)
    else:  # mapbox Terrain-RGB
        value = np.clip(np.round((heights + 10000.0) * 10.0), 0, 2 ** 24 - 1).astype(np.int64)
        rgb = np.stack([(value >> 16) & 255, (value >> 8) & 255, value & 255], axis=-1)
    return rgb.astype(np.uint8)


def write_png(out_dir, zoom, x, y, heights, encoding):
    directory = os.path.join(out_dir, str(zoom), str(x))
    os.makedirs(directory, exist_ok=True)
    buffer = io.BytesIO()
    Image.fromarray(encode_rgb(heights, encoding), "RGB").save(buffer, format="PNG", compress_level=6)
    with open(os.path.join(directory, f"{y}.png"), "wb") as handle:
        handle.write(buffer.getvalue())


def halve(grid):
    """2 x 2 mean: one zoom level down."""
    rows, cols = grid.shape
    return grid.reshape(rows // 2, 2, cols // 2, 2).mean(axis=(1, 3))


# ── Workers: one zoom-9 window -> zooms 9..max ──────────────────────────────

STATE = {}


def init_worker(dem_dir, max_zoom, out_dir, encoding, bounds):
    STATE.update(mosaic=DemMosaic(dem_dir, cache_size=4), max_zoom=max_zoom, out_dir=out_dir,
                 encoding=encoding, bounds=bounds)


def build_window(window):
    wx, wy = window
    max_zoom = STATE["max_zoom"]
    out_dir = STATE["out_dir"]
    encoding = STATE["encoding"]
    bounds = STATE["bounds"]
    depth = max_zoom - WINDOW_ZOOM
    across = 2 ** depth
    lon, lat = pixel_centres(wx * across, wy * across, across, max_zoom)
    grid = STATE["mosaic"].sample(lon[None, :], lat[:, None]).astype(np.float32)

    count = 0
    for zoom in range(max_zoom, WINDOW_ZOOM - 1, -1):
        per_side = 2 ** (zoom - WINDOW_ZOOM)
        x0, x1, y0, y1 = tile_range(bounds, zoom)
        for row in range(per_side):
            for col in range(per_side):
                x, y = wx * per_side + col, wy * per_side + row
                if x0 <= x <= x1 and y0 <= y <= y1:
                    block = grid[row * TILE:(row + 1) * TILE, col * TILE:(col + 1) * TILE]
                    write_png(out_dir, zoom, x, y, block, encoding)
                    count += 1
        if zoom > WINDOW_ZOOM:
            grid = halve(grid)
    return (wx, wy), grid, count  # grid is now the 256 x 256 zoom-9 tile


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dem_dir", help="GLO-30 GeoTIFF folder (e.g. data/dem)")
    parser.add_argument("out_dir", help="tile output (e.g. public/data/terrain-dem)")
    parser.add_argument("--max-zoom", type=int, default=12, help="finest zoom (12 = ~38 m/px, 13 = ~19 m/px)")
    parser.add_argument("--encoding", choices=("mapbox", "terrarium"), default="mapbox")
    parser.add_argument("--cells", default=DEFAULT_CELLS, help="1-degree cells to use (same syntax as build_terrain.py)")
    parser.add_argument("--workers", type=int, default=max(1, min(6, (os.cpu_count() or 2) - 1)))
    parser.add_argument("--tile-url", help="tile URL template in tiles.json "
                        "(default: /<out_dir under public>/{z}/{x}/{y}.png)")
    args = parser.parse_args()
    if not args.tile_url:
        relative = os.path.relpath(os.path.abspath(args.out_dir), os.path.abspath("public"))
        if relative.startswith(".."):
            parser.error("--tile-url is required when out_dir is not inside ./public")
        args.tile_url = "/" + relative.replace(os.sep, "/") + "/{z}/{x}/{y}.png"
    if args.max_zoom < WINDOW_ZOOM:
        parser.error(f"--max-zoom must be at least {WINDOW_ZOOM}")
    started = time.time()

    wanted = cell_ranges(args.cells)
    os.makedirs(args.dem_dir, exist_ok=True)
    have = {key for key in (parse_tile_name(name) for name in os.listdir(args.dem_dir)) if key}
    if not have & wanted:
        from build_terrain import download_tiles

        print(f"No GLO-30 tiles in {args.dem_dir}: downloading", flush=True)
        download_tiles(args.dem_dir, wanted)
        have = {key for key in (parse_tile_name(name) for name in os.listdir(args.dem_dir)) if key}
    coverage = have & wanted
    if not coverage:
        raise SystemExit(f"No GLO-30 tiles in {args.dem_dir}")

    bounds = (
        min(c[0] for c in coverage), min(c[1] for c in coverage),
        max(c[0] for c in coverage) + 1, max(c[1] for c in coverage) + 1,
    )
    x0, x1, y0, y1 = tile_range(bounds, WINDOW_ZOOM)
    windows = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    print(f"{len(coverage)} land cells, bounds {bounds}; zooms 0-{args.max_zoom}, "
          f"{len(windows)} zoom-{WINDOW_ZOOM} windows, {args.workers} workers, {args.encoding} encoding", flush=True)

    os.makedirs(args.out_dir, exist_ok=True)
    level = {}
    total = 0
    with Pool(args.workers, initializer=init_worker,
              initargs=(args.dem_dir, args.max_zoom, args.out_dir, args.encoding, bounds)) as pool:
        for done, (key, grid, count) in enumerate(pool.imap_unordered(build_window, windows), start=1):
            level[key] = grid
            total += count
            if done % 25 == 0 or done == len(windows):
                print(f"  window {done}/{len(windows)} ({time.time() - started:.0f}s)", flush=True)

    # Zooms below the window level: average 2 x 2 children (missing = sea).
    zero = np.zeros((TILE, TILE), dtype=np.float32)
    for zoom in range(WINDOW_ZOOM - 1, -1, -1):
        parents = {}
        zx0, zx1, zy0, zy1 = tile_range(bounds, zoom)
        for x in range(zx0, zx1 + 1):
            for y in range(zy0, zy1 + 1):
                mosaic = np.block([
                    [level.get((2 * x, 2 * y), zero), level.get((2 * x + 1, 2 * y), zero)],
                    [level.get((2 * x, 2 * y + 1), zero), level.get((2 * x + 1, 2 * y + 1), zero)],
                ])
                parents[(x, y)] = halve(mosaic)
                write_png(args.out_dir, zoom, x, y, parents[(x, y)], args.encoding)
                total += 1
        level = parents

    tilejson = {
        "tilejson": "2.2.0",
        "name": "Copernicus GLO-30 Malaysia (Terrain-RGB)",
        "description": f"raster-dem, {args.encoding} encoding, 256 px tiles; built by scripts/terrain/build_terrain_dem.py",
        "version": "1.0.0",
        "scheme": "xyz",
        "tiles": [args.tile_url],
        "minzoom": 0,
        "maxzoom": args.max_zoom,
        "bounds": list(bounds),
        "attribution": ATTRIBUTION,
        "encoding": args.encoding,
        "tileSize": TILE,
    }
    with open(os.path.join(args.out_dir, "tiles.json"), "w", encoding="utf-8") as handle:
        json.dump(tilejson, handle, separators=(",", ":"))
    print(f"Done: {total:,} tiles in {time.time() - started:.0f}s -> {args.out_dir}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
