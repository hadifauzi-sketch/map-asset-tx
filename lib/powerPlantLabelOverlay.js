import { fuelColor, plantRadius, plantSummary } from './powerPlants.js';
import { layoutPowerPlantLabels } from './powerPlantLabelLayout.js';

/** Crisp DOM text shared by Leaflet and Cesium; all coordinates are CSS pixels. */
export function createPowerPlantLabelOverlay({ container, project, onSelect, obstacleRoot = container,
  mountContainer = container, getOrigin }) {
  const host = document.createElement('div');
  host.className = 'power-plant-label-overlay';
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', 'Power station labels');
  mountContainer.append(host);
  let entries = [];
  let frame = null;
  let destroyed = false;
  let enabled = true;

  function update() {
    if (destroyed || !enabled) return;
    const bounds = container.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    // Leaflet panes move during a pan. Keep this viewport-sized overlay aligned
    // with container pixels while remaining inside Leaflet's stacking order.
    host.style.width = `${bounds.width}px`;
    host.style.height = `${bounds.height}px`;
    if (getOrigin) {
      const origin = getOrigin();
      host.style.transform = `translate(${origin.x}px, ${origin.y}px)`;
    }
    const obstacles = [...obstacleRoot.querySelectorAll(
      '.g3d-panel, .g3d-rail, .g3d-dock, .g3d-topbar, .g3d-feature-card, .plant-legend, .leaflet-control, .leaflet-popup, .dc-tracker'
    )].filter((node) => node.getClientRects().length).map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.left - bounds.left, y: rect.top - bounds.top, width: rect.width, height: rect.height };
    });
    const visible = [];
    for (const entry of entries) {
      const point = project(entry.plant);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
        || point.x < 0 || point.y < 0 || point.x > bounds.width || point.y > bounds.height) continue;
      visible.push({
        id: entry.id, x: point.x, y: point.y,
        width: entry.label.offsetWidth, height: entry.label.offsetHeight,
        radius: point.radius ?? plantRadius(entry.plant.capacityMw),
        priority: entry.plant.capacityMw || 0,
        entry,
      });
    }
    const placements = layoutPowerPlantLabels(visible, { width: bounds.width, height: bounds.height, obstacles });
    for (const entry of entries) {
      if (!placements.has(entry.id)) {
        entry.label.style.visibility = 'hidden';
        entry.line.style.visibility = 'hidden';
      }
    }
    for (const item of visible) {
      const box = placements.get(item.id);
      if (!box) continue;
      const { label, line } = item.entry;
      label.style.transform = `translate(${Math.round(box.x)}px, ${Math.round(box.y)}px)`;
      label.style.visibility = 'visible';
      // Connect displaced cards to their exact geographic pin.
      const endX = Math.max(box.x, Math.min(item.x, box.x + box.width));
      const endY = Math.max(box.y, Math.min(item.y, box.y + box.height));
      const dx = endX - item.x;
      const dy = endY - item.y;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const start = item.radius + 2;
        line.style.width = `${Math.max(0, length - start)}px`;
        line.style.transform = `translate(${item.x + dx / length * start}px, ${item.y + dy / length * start}px) rotate(${Math.atan2(dy, dx)}rad)`;
        line.style.visibility = 'visible';
      }
    }
  }

  function scheduleUpdate() {
    if (destroyed || frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; update(); });
  }

  const resizeObserver = new ResizeObserver(scheduleUpdate);
  resizeObserver.observe(container);
  // Panels, legend collapse and theme changes can happen without a camera move.
  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(obstacleRoot, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'open'] });
  document.fonts?.ready.then(scheduleUpdate);

  return {
    update,
    setVisible(visible) {
      enabled = visible;
      host.hidden = !visible;
      if (visible) scheduleUpdate();
    },
    setPlants(plants) {
      host.replaceChildren();
      entries = plants.map((plant, index) => {
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'power-plant-map-label';
        label.style.setProperty('--plant-fuel', fuelColor(plant.fuel));
        const name = document.createElement('strong');
        name.textContent = plant.name || 'Power station';
        const detail = document.createElement('span');
        detail.textContent = plantSummary(plant);
        label.append(name, detail);
        for (const type of ['pointerdown', 'mousedown', 'dblclick', 'touchstart']) {
          label.addEventListener(type, (event) => event.stopPropagation());
        }
        label.addEventListener('click', (event) => {
          event.stopPropagation();
          onSelect?.(plant);
        });
        const line = document.createElement('div');
        line.className = 'power-plant-label-leader';
        line.setAttribute('aria-hidden', 'true');
        host.append(line, label);
        return { id: index, plant, label, line };
      });
      scheduleUpdate();
    },
    destroy() {
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      observer.disconnect();
      host.remove();
      entries = [];
    },
  };
}
