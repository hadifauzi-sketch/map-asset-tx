"""Copernicus GLO-30 DEM access shared by the terrain and 3D-buildings builds.

Source tiles are the 1x1 degree Cloud Optimized GeoTIFFs from the public
Copernicus DEM bucket on AWS (no account needed):

    https://copernicus-dem-30m.s3.amazonaws.com/<name>/<name>.tif
    <name> = Copernicus_DSM_COG_10_N02_00_E101_00_DEM

Each tile is 3600 x 3600 float32, PixelIsPoint: pixel (0, 0) sits exactly on
(lon0, lat0 + 1) and steps are 1 arc-second east / south. Sea is stored as 0.
Heights are EGM2008 orthometric metres. They are used as-is (the few metres of
geoid offset do not matter when terrain, buildings and pins all come from this
one source, and it keeps the sea at 0 m like the bare globe).

Terrain tiles and building bases both read heights through `TerrainSampler`,
so a building's ground matches the terrain surface Cesium draws.
"""

import math
import os
import re
from collections import OrderedDict

import numpy as np

SOURCE_URL = "https://copernicus-dem-30m.s3.amazonaws.com/{name}/{name}.tif"
SAMPLES_PER_DEGREE = 3600
HEIGHTMAP_SIZE = 65  # heightmap-1.0 tiles are 65 x 65 samples
NAME_PATTERN = re.compile(r"Copernicus_DSM_COG_10_([NS])(\d{2})_00_([EW])(\d{3})_00_DEM\.tif$")

ATTRIBUTION = (
    "Terrain: Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH "
    "2014-2018, provided under COPERNICUS by the European Union and ESA"
)


def tile_name(lon0, lat0):
    ns = "N" if lat0 >= 0 else "S"
    ew = "E" if lon0 >= 0 else "W"
    return f"Copernicus_DSM_COG_10_{ns}{abs(lat0):02d}_00_{ew}{abs(lon0):03d}_00_DEM"


def parse_tile_name(file_name):
    match = NAME_PATTERN.search(file_name)
    if not match:
        return None
    ns, lat, ew, lon = match.groups()
    return (int(lon) * (1 if ew == "E" else -1), int(lat) * (1 if ns == "N" else -1))


def grid_spacing(max_level):
    """Degrees between heightmap samples at `max_level` (geographic tiling scheme)."""
    return 180.0 / (2 ** max_level) / (HEIGHTMAP_SIZE - 1)


class DemMosaic:
    """Bilinear lookup over the downloaded 1-degree tiles; no tile means sea (0 m)."""

    def __init__(self, dem_dir, cache_size=4):
        self.files = {}
        for file_name in os.listdir(dem_dir):
            key = parse_tile_name(file_name)
            if key:
                self.files[key] = os.path.join(dem_dir, file_name)
        self.cache_size = cache_size
        self.cache = OrderedDict()

    @property
    def cells(self):
        return set(self.files)

    def _tile(self, key):
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        import tifffile  # deferred so `--help` works without it

        data = tifffile.imread(self.files[key]).astype(np.float32, copy=False)
        data[~np.isfinite(data) | (data < -1000.0)] = 0.0
        self.cache[key] = data
        if len(self.cache) > self.cache_size:
            self.cache.popitem(last=False)
        return data

    def sample(self, lon, lat):
        lon, lat = np.broadcast_arrays(np.asarray(lon, dtype=np.float64), np.asarray(lat, dtype=np.float64))
        out = np.zeros(lon.shape, dtype=np.float64)
        lon0 = np.floor(lon).astype(np.int64)
        # ceil - 1 puts a point on a whole-degree latitude into the tile whose top row it is.
        lat0 = np.ceil(lat).astype(np.int64) - 1
        codes = (lon0 + 180) * 1000 + (lat0 + 90)
        unique, inverse = np.unique(codes.ravel(), return_inverse=True)
        inverse = inverse.reshape(lon.shape)
        last = SAMPLES_PER_DEGREE - 1
        for k, code in enumerate(unique):
            key = (int(code // 1000) - 180, int(code % 1000) - 90)
            if key not in self.files:
                continue
            mask = inverse == k
            tile = self._tile(key)
            col = (lon[mask] - key[0]) * SAMPLES_PER_DEGREE
            row = (key[1] + 1 - lat[mask]) * SAMPLES_PER_DEGREE
            c0 = np.clip(np.floor(col).astype(np.int64), 0, last)
            r0 = np.clip(np.floor(row).astype(np.int64), 0, last)
            fc = np.clip(col - c0, 0.0, 1.0)
            fr = np.clip(row - r0, 0.0, 1.0)
            c1 = np.minimum(c0 + 1, last)
            r1 = np.minimum(r0 + 1, last)
            top = tile[r0, c0] * (1.0 - fc) + tile[r0, c1] * fc
            bottom = tile[r1, c0] * (1.0 - fc) + tile[r1, c1] * fc
            out[mask] = top * (1.0 - fr) + bottom * fr
        return out


class TerrainSampler:
    """Heights on the global lattice of the finest terrain level.

    Lattice node (i, j) is at lon = -180 + i * d, lat = -90 + j * d. Terrain
    tiles take their samples from these nodes; `ground` interpolates between
    them, so buildings land on the same surface Cesium tessellates.
    """

    def __init__(self, dem_dir, max_level=13, cache_size=4):
        self.mosaic = DemMosaic(dem_dir, cache_size=cache_size)
        self.max_level = max_level
        self.spacing = grid_spacing(max_level)

    def nodes(self, i, j):
        i = np.asarray(i, dtype=np.int64)
        j = np.asarray(j, dtype=np.int64)
        return self.mosaic.sample(-180.0 + i * self.spacing, -90.0 + j * self.spacing)

    def ground(self, lon, lat):
        gx = (np.asarray(lon, dtype=np.float64) + 180.0) / self.spacing
        gy = (np.asarray(lat, dtype=np.float64) + 90.0) / self.spacing
        i0 = np.floor(gx).astype(np.int64)
        j0 = np.floor(gy).astype(np.int64)
        fx = gx - i0
        fy = gy - j0
        h00 = self.nodes(i0, j0)
        h10 = self.nodes(i0 + 1, j0)
        h01 = self.nodes(i0, j0 + 1)
        h11 = self.nodes(i0 + 1, j0 + 1)
        return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy


def cell_ranges(cells_arg):
    """'99,1,104,6;109,0,115,4' -> set of (lon0, lat0) 1-degree cells (inclusive)."""
    cells = set()
    for part in cells_arg.split(";"):
        part = part.strip()
        if not part:
            continue
        w, s, e, n = (int(math.floor(float(v))) for v in part.split(","))
        for lon0 in range(w, e + 1):
            for lat0 in range(s, n + 1):
                cells.add((lon0, lat0))
    return cells
