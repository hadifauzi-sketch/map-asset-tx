import * as Cesium from 'cesium';
import { createPowerPlantLabelOverlay } from '../../lib/powerPlantLabelOverlay.js';
import { plantRadius } from '../../lib/powerPlants.js';

export function createGlobePowerPlantLabels(viewer, onSelect) {
  const positions = new Map();
  const occluder = new Cesium.EllipsoidalOccluder(viewer.scene.globe.ellipsoid, viewer.camera.positionWC);
  const overlay = createPowerPlantLabelOverlay({
    container: viewer.container,
    obstacleRoot: viewer.container.closest('.g3d') || viewer.container,
    onSelect,
    project(plant) {
      const position = positions.get(plant);
      occluder.cameraPosition = viewer.camera.positionWC;
      if (!position || !occluder.isPointVisible(position)) return null;
      const point = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
      if (!point) return null;
      return { x: point.x, y: point.y, radius: plantRadius(plant.capacityMw) * 1.25 };
    },
  });
  const removePostRender = viewer.scene.postRender.addEventListener(overlay.update);
  return {
    setPlants(plants) {
      positions.clear();
      plants.forEach((plant) => positions.set(plant, Cesium.Cartesian3.fromDegrees(plant.longitude, plant.latitude)));
      overlay.setPlants(plants);
    },
    destroy() {
      removePostRender();
      overlay.destroy();
      positions.clear();
    },
  };
}
