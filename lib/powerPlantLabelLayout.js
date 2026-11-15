const GAP = 7;

export function rectanglesOverlap(a, b, gap = GAP) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/** Place labels in screen pixels. Crowded labels yield space; their pins remain. */
export function layoutPowerPlantLabels(items, { width, height, obstacles = [] }) {
  const placed = new Map();
  const occupied = [...obstacles];
  const pins = items.map(({ x, y, radius = 7 }) => ({
    x: x - radius, y: y - radius, width: radius * 2, height: radius * 2,
  }));
  const ordered = [...items].sort((a, b) => (b.priority || 0) - (a.priority || 0)
    || String(a.id).localeCompare(String(b.id)));

  for (const item of ordered) {
    const { x, y, width: w, height: h, radius = 7 } = item;
    const offset = radius + 12;
    const candidates = [];
    // Prefer a short connection beside the pin, then fan out vertically.
    for (const shift of [0, -(h + GAP), h + GAP, -2 * (h + GAP), 2 * (h + GAP)]) {
      candidates.push({ x: x + offset, y: y - h / 2 + shift });
      candidates.push({ x: x - offset - w, y: y - h / 2 + shift });
    }
    candidates.splice(2, 0,
      { x: x - w / 2, y: y - offset - h },
      { x: x - w / 2, y: y + offset });

    const candidate = candidates.find((position) => {
      const box = { ...position, width: w, height: h };
      return box.x >= GAP && box.y >= GAP
        && box.x + w <= width - GAP && box.y + h <= height - GAP
        && !occupied.some((other) => rectanglesOverlap(box, other))
        && !pins.some((pin) => rectanglesOverlap(box, pin, 3));
    });
    if (!candidate) continue;
    const box = { ...candidate, width: w, height: h };
    placed.set(item.id, box);
    occupied.push(box);
  }
  return placed;
}
