// Canvas-drawn marker images for the Cesium scene (pins, clusters).
// Images are cached per colour so thousands of billboards share a few textures.

const cache = new Map();
const SCALE = 2; // draw at 2x for crisp markers on high-DPI screens

function cached(key, draw) {
  if (!cache.has(key)) {
    cache.set(key, draw());
  }
  return cache.get(key);
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const context = canvas.getContext('2d');
  context.scale(SCALE, SCALE);
  return { canvas, context };
}

export const PIN_SIZE = { width: 30, height: 38 };

/** Teardrop pin with a bolt glyph, filled with the DGA status colour. */
export function getPinImage(color, selected = false) {
  return cached(`pin:${color}:${selected}`, () => {
    const { width, height } = PIN_SIZE;
    const { canvas, context } = createCanvas(width, height);
    const cx = width / 2;
    const radius = 12;
    const cy = radius + 2;

    context.beginPath();
    context.moveTo(cx, height - 1);
    context.bezierCurveTo(cx - 3, height - 10, cx - radius, cy + 9, cx - radius, cy);
    context.arc(cx, cy, radius, Math.PI, 0);
    context.bezierCurveTo(cx + radius, cy + 9, cx + 3, height - 10, cx, height - 1);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.lineWidth = selected ? 2.5 : 1.5;
    context.strokeStyle = selected ? '#5eead4' : 'rgba(255,255,255,0.92)';
    context.stroke();

    // Lightning bolt
    context.beginPath();
    context.moveTo(cx + 1.5, cy - 7);
    context.lineTo(cx - 4.5, cy + 1.2);
    context.lineTo(cx - 0.6, cy + 1.2);
    context.lineTo(cx - 1.8, cy + 7);
    context.lineTo(cx + 4.5, cy - 1.6);
    context.lineTo(cx + 0.6, cy - 1.6);
    context.closePath();
    context.fillStyle = '#ffffff';
    context.fill();

    return canvas;
  });
}

export const CLUSTER_SIZE = 40;

/** Round cluster badge: asset count inside a ring of the worst status colour. */
export function getClusterImage(count, color) {
  const label = count > 999 ? '999+' : String(count);
  return cached(`cluster:${label}:${color}`, () => {
    const { canvas, context } = createCanvas(CLUSTER_SIZE, CLUSTER_SIZE);
    const center = CLUSTER_SIZE / 2;

    context.beginPath();
    context.arc(center, center, center - 2, 0, Math.PI * 2);
    context.fillStyle = 'rgba(6, 24, 26, 0.88)';
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = color;
    context.stroke();

    context.fillStyle = '#ffffff';
    context.font = `700 ${label.length > 2 ? 11 : 13}px Inter, "Segoe UI", system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, center, center + 0.5);

    return canvas;
  });
}
