// Full-screen "sensor look" presets, applied as a Cesium PostProcessStage.
// Each fragment shader reads the rendered frame from `colorTexture`.

const HEADER = /* glsl */ `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float vignette(vec2 uv, float strength) {
  vec2 d = uv - 0.5;
  return clamp(1.0 - dot(d, d) * strength, 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;

export const VISUAL_PRESETS = [
  { id: 'normal', label: 'Normal', hint: 'True colour', shader: null },
  {
    // Earth at Night: NASA VIIRS Black Marble city lights, draped over the
    // globe as imagery layers (not a shader). Four modes — lights only, lights
    // over the map with roads/labels, light-pollution glow, glow + roads/labels —
    // see lib/globe3d/nightModes.js. Public GIBS WMTS, no key.
    id: 'night',
    label: 'Night',
    hint: 'Black Marble',
    shader: null,
    night: true,
  },
  {
    id: 'nvg',
    label: 'NVG',
    hint: 'Night vision',
    shader: `${HEADER}
void main(void) {
  vec3 rgb = texture(colorTexture, v_textureCoordinates).rgb;
  float l = pow(luma(rgb), 0.75) * 1.25;
  float grain = (hash(v_textureCoordinates * 900.0) - 0.5) * 0.08;
  vec3 tone = vec3(0.10, 1.0, 0.30) * (l + grain);
  out_FragColor = vec4(tone * vignette(v_textureCoordinates, 2.2), 1.0);
}`,
  },
  {
    id: 'flir',
    label: 'FLIR',
    hint: 'Thermal palette',
    shader: `${HEADER}
vec3 iron(float t) {
  vec3 c0 = vec3(0.02, 0.0, 0.12);
  vec3 c1 = vec3(0.45, 0.0, 0.55);
  vec3 c2 = vec3(0.92, 0.25, 0.10);
  vec3 c3 = vec3(1.0, 0.78, 0.10);
  vec3 c4 = vec3(1.0, 1.0, 0.92);
  if (t < 0.25) return mix(c0, c1, t * 4.0);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) * 4.0);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) * 4.0);
  return mix(c3, c4, (t - 0.75) * 4.0);
}
void main(void) {
  vec3 rgb = texture(colorTexture, v_textureCoordinates).rgb;
  float l = smoothstep(0.03, 0.9, luma(rgb));
  out_FragColor = vec4(iron(l), 1.0);
}`,
  },
  {
    id: 'crt',
    label: 'CRT',
    hint: 'Scanlines',
    shader: `${HEADER}
void main(void) {
  vec2 uv = v_textureCoordinates;
  vec2 off = (uv - 0.5) * 0.0025;
  float r = texture(colorTexture, uv + off).r;
  float g = texture(colorTexture, uv).g;
  float b = texture(colorTexture, uv - off).b;
  float scan = 0.86 + 0.14 * sin(gl_FragCoord.y * 3.14159);
  vec3 tone = vec3(r, g, b) * scan * vec3(0.92, 1.04, 1.0);
  out_FragColor = vec4(tone * vignette(uv, 1.8), 1.0);
}`,
  },
  {
    id: 'noir',
    label: 'Noir',
    hint: 'High-contrast mono',
    shader: `${HEADER}
void main(void) {
  vec3 rgb = texture(colorTexture, v_textureCoordinates).rgb;
  float l = smoothstep(0.08, 0.82, luma(rgb));
  out_FragColor = vec4(vec3(l) * vignette(v_textureCoordinates, 1.6), 1.0);
}`,
  },
];

export const DEFAULT_VISUAL_PRESET = 'normal';

export function getVisualPreset(presetId) {
  return VISUAL_PRESETS.find((preset) => preset.id === presetId) || VISUAL_PRESETS[0];
}
