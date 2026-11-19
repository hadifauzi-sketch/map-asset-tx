// "Night" sensor look: four ways to show the Earth at night on the 3D globe.
//
//   lights         NASA VIIRS Black Marble city lights, nothing else.
//   lightsCity     Lights glowing over the (dimmed) base map, with roads + labels.
//   pollution      Estimated artificial sky glow, coloured like a light-pollution atlas.
//   pollutionCity  The same glow over the base map, with roads + labels.
//
// The light-pollution view is derived in the browser from the Black Marble
// radiance (public domain): each light source is spread with two Gaussian
// kernels (~6 km and ~25 km) to approximate how sky glow travels, then mapped
// through an atlas-style colour scale. It is an estimate for visual context,
// not a modelled sky-brightness (mag/arcsec²) product.
//
// Everything here is pure (no Cesium, no DOM) so it can be unit tested.

export const NIGHT_MODES = [
  { id: 'lights', label: 'Night', hint: 'City lights only' },
  { id: 'lightsCity', label: 'Night + city', hint: 'Lights over the map with roads and labels' },
  { id: 'pollution', label: 'Light pollution', hint: 'Estimated sky glow' },
  { id: 'pollutionCity', label: 'Pollution + city', hint: 'Sky glow with roads and labels' },
];

export const DEFAULT_NIGHT_MODE = 'lights';

export function getNightMode(id) {
  return NIGHT_MODES.find((mode) => mode.id === id) || NIGHT_MODES[0];
}

export const BLACK_MARBLE_TILE_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
export const BLACK_MARBLE_MAX_LEVEL = 8;
export const BLACK_MARBLE_CREDIT = 'NASA Earth Observatory / GIBS — VIIRS Black Marble 2016';

// Esri reference overlays (same family as the Esri Hybrid map source).
export const CITY_OVERLAYS = [
  {
    id: 'roads',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19,
    credit: 'Roads © Esri',
  },
  {
    id: 'labels',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19,
    credit: 'Labels © Esri',
  },
];

/**
 * Layer recipe for each mode; the scene turns this into Cesium imagery layers,
 * bottom to top. `dim` darkens whatever base map is underneath.
 */
export function nightModeRecipe(id) {
  switch (getNightMode(id).id) {
    case 'lightsCity':
      return { dim: 0.55, kind: 'lightsAlpha', alpha: 1, roadsAlpha: 0.45, labels: true };
    case 'pollution':
      return { dim: 0, kind: 'pollution', alpha: 1, roadsAlpha: 0, labels: false };
    case 'pollutionCity':
      // Per-pixel alpha in the tiles (overlayAlpha) lets the map show through dark skies.
      return { dim: 0.3, kind: 'pollutionOverlay', alpha: 1, roadsAlpha: 0.55, labels: true };
    case 'lights':
    default:
      return { dim: 0, kind: 'lights', alpha: 1, roadsAlpha: 0, labels: false };
  }
}

// Atlas-style scale from pristine to brightest. `t` is the glow index 0..1.
export const LIGHT_POLLUTION_SCALE = [
  { t: 0.0, color: [6, 8, 20], label: 'Pristine' },
  { t: 0.06, color: [24, 34, 92] },
  { t: 0.12, color: [32, 82, 196], label: 'Rural' },
  { t: 0.2, color: [38, 160, 214] },
  { t: 0.3, color: [74, 196, 120], label: 'Rural / suburban' },
  { t: 0.4, color: [214, 226, 62] },
  { t: 0.5, color: [250, 206, 44], label: 'Suburban' },
  { t: 0.6, color: [248, 136, 44] },
  { t: 0.7, color: [238, 52, 64], label: 'Urban' },
  { t: 0.82, color: [236, 64, 236] },
  { t: 0.92, color: [255, 182, 255] },
  { t: 1.0, color: [255, 255, 255], label: 'City centre' },
];

/** Colour for glow index t (0..1), linear between scale stops. */
export function lightPollutionColor(t) {
  const value = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  for (let index = 1; index < LIGHT_POLLUTION_SCALE.length; index += 1) {
    const upper = LIGHT_POLLUTION_SCALE[index];
    if (value <= upper.t) {
      const lower = LIGHT_POLLUTION_SCALE[index - 1];
      const f = (value - lower.t) / (upper.t - lower.t || 1);
      return lower.color.map((channel, i) => Math.round(channel + (upper.color[i] - channel) * f));
    }
  }
  return [...LIGHT_POLLUTION_SCALE[LIGHT_POLLUTION_SCALE.length - 1].color];
}

/** CSS linear-gradient for the legend bar. */
export function lightPollutionGradientCss() {
  const stops = LIGHT_POLLUTION_SCALE.map(
    ({ t, color }) => `rgb(${color.join(', ')}) ${Math.round(t * 100)}%`
  );
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** Ground size of one pixel (km) for a 256-px Web Mercator tile row. */
export function pixelSizeKm(level, tileY) {
  const n = 2 ** level;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 0.5)) / n)));
  return (40075.016 * Math.cos(latitude)) / (256 * n);
}

/** Black Marble RGB -> approximate linear radiance 0..1 (PNG values are gamma-encoded). */
export function blackMarbleRadiance(red, green) {
  // Unlit ground/ocean in the PNG sits around RGB (4, 5, 15): treat as zero.
  const v = Math.max(0, Math.max(red, green) - 6) / 249;
  return v ** 2.2;
}

// Running-sum box blur along rows then columns, `passes` times (≈ Gaussian).
export function boxBlur(source, width, height, radius, passes = 3) {
  const r = Math.max(0, Math.round(radius));
  let current = Float32Array.from(source);
  if (r < 1) {
    return current;
  }
  const scratch = new Float32Array(current.length);
  const span = 2 * r + 1;
  for (let pass = 0; pass < passes; pass += 1) {
    // Horizontal, edges clamped.
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      let sum = 0;
      for (let k = -r; k <= r; k += 1) {
        sum += current[row + Math.min(width - 1, Math.max(0, k))];
      }
      for (let x = 0; x < width; x += 1) {
        scratch[row + x] = sum / span;
        sum += current[row + Math.min(width - 1, x + r + 1)] - current[row + Math.max(0, x - r)];
      }
    }
    // Vertical.
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -r; k <= r; k += 1) {
        sum += scratch[Math.min(height - 1, Math.max(0, k)) * width + x];
      }
      for (let y = 0; y < height; y += 1) {
        current[y * width + x] = sum / span;
        sum +=
          scratch[Math.min(height - 1, y + r + 1) * width + x] - scratch[Math.max(0, y - r) * width + x];
      }
    }
  }
  return current;
}

// Glow model: weights for the local light, ~6 km halo and ~25 km sky glow,
// then a log curve so rural glow and city cores both stay readable.
export const GLOW_MODEL = {
  // Sky glow falls off steeply with distance (≈ d^-2.5, Walker's law): a sum
  // of Gaussians at growing widths approximates that. Black Marble's 8-bit
  // tiles clip every city core to white, so city size — not core brightness —
  // has to separate KL from Seremban; the wide kernels carry that.
  // Weights and the log range were fitted (rms ≈ 0.07 on the 0..1 scale) to
  // 16 reference points around KL, Seremban, Melaka, Pahang and the Strait,
  // read from a light-pollution atlas view of the same area. A light 1.5 km
  // term was then added back so small towns show as crisp spots.
  local: 0,
  kernels: [
    { sigmaKm: 1.5, weight: 0.3 },
    { sigmaKm: 5, weight: 1.0 },
    { sigmaKm: 15, weight: 0.73 },
    { sigmaKm: 40, weight: 0.44 },
  ],
  minLog: -2.3,
  maxLog: 0.94,
};

/**
 * Light-pollution colours for the centre tile of a 3×3 mosaic.
 * @param {Float32Array} radiance  (3·size)² linear radiance values, centre tile in the middle
 * @param {number} size            tile size in px (256)
 * @param {number} pixelKm         ground size of one pixel
 * @param {number} [alpha=255]     output alpha
 * @returns {Uint8ClampedArray}    size² RGBA
 */
export function computeGlowIndex(radiance, width, height, pixelKm, model = GLOW_MODEL) {
  const glow = Float32Array.from(radiance, (value) => value * model.local);
  model.kernels.forEach(({ sigmaKm, weight }) => {
    const blurred = boxBlur(radiance, width, height, sigmaKm / pixelKm);
    for (let i = 0; i < glow.length; i += 1) {
      glow[i] += weight * blurred[i];
    }
  });
  // Light-pollution atlases colour sky brightness on a log scale spanning
  // several orders of magnitude; map log10(glow) from minLog..maxLog to 0..1.
  const span = model.maxLog - model.minLog;
  for (let i = 0; i < glow.length; i += 1) {
    const value = (Math.log10(glow[i] + 1e-9) - model.minLog) / span;
    glow[i] = Math.min(1, Math.max(0, value));
  }
  return glow;
}

/**
 * Alpha for the "+ city" overlay: the darkest skies stay mostly see-through so
 * the map shows, brighter glow becomes solid.
 */
export function overlayAlpha(t) {
  // Pristine/rural blues stay see-through so the map reads under them;
  // from suburban (yellow) upward the colour is nearly solid.
  const k = Math.min(1, Math.max(0, t / 0.45));
  return Math.round(255 * (0.18 + 0.67 * k * k * (3 - 2 * k)));
}

/**
 * Light-pollution colours for the centre tile of a 3×3 mosaic.
 * @param {Float32Array} radiance  (3·size)² linear radiance values, centre tile in the middle
 * @param {number} size            tile size in px (256)
 * @param {number} pixelKm         ground size of one pixel
 * @param {{ overlay?: boolean, model?: object }} [options]  overlay = see-through dark skies
 * @returns {Uint8ClampedArray}    size² RGBA
 */
export function renderLightPollution(radiance, size, pixelKm, { overlay = false, model = GLOW_MODEL } = {}) {
  const width = size * 3;
  const index = computeGlowIndex(radiance, width, width, pixelKm, model);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = index[(y + size) * width + (x + size)];
      const [r, g, b] = lightPollutionColor(t);
      const o = (y * size + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = overlay ? overlayAlpha(t) : 255;
    }
  }
  return out;
}

/**
 * City lights with soft transparency, for drawing over a map: dark areas are
 * clear, lights keep their colour and glow. Input is the tile's own RGBA.
 */
export function renderLightsOverlay(rgba, size) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const o = i * 4;
    const red = rgba[o];
    const green = rgba[o + 1];
    const blue = rgba[o + 2];
    const v = Math.max(0, Math.max(red, green) - 10) / 245;
    // smoothstep(0.02, 0.55, v)
    const k = Math.min(1, Math.max(0, (v - 0.02) / 0.53));
    const a = k * k * (3 - 2 * k);
    // Lift lights toward warm white so they read over satellite imagery.
    out[o] = Math.min(255, red * 1.15 + 18);
    out[o + 1] = Math.min(255, green * 1.08 + 10);
    out[o + 2] = Math.min(255, blue * 0.9);
    out[o + 3] = Math.round(a * 255);
  }
  return out;
}
