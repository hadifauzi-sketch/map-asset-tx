import * as Cesium from 'cesium';
import { dataCentreSource, dataCentreMarkerSvg, describeDataCentre } from '../../lib/dataCentres.js';

export function addDataCentreLayer(viewer, facilities, settings) {
  const source = new Cesium.CustomDataSource('data-centres');
  const credit = new Cesium.Credit(dataCentreSource(settings.source).credit, true);
  source.entities.suspendEvents();
  facilities.filter((campus) => campus.mapped).forEach((campus) => {
    const { size, svg } = dataCentreMarkerSvg(campus, settings.colorBy, settings.markerScale);
    source.entities.add({
      id: `data-centre-${campus.id}`, name: campus.name,
      position: Cesium.Cartesian3.fromDegrees(campus.longitude, campus.latitude),
      billboard: { image: `data:image/svg+xml,${encodeURIComponent(svg)}`, width: size, height: size,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      properties: { refInfo: describeDataCentre(campus) },
    });
  });
  source.entities.resumeEvents();
  source.clustering.enabled = true;
  source.clustering.pixelRange = 30;
  source.clustering.minimumClusterSize = 2;
  const removeClusterListener = source.clustering.clusterEvent.addEventListener((entities, cluster) => {
    cluster.label.show = false;
    cluster.point.show = false;
    cluster.billboard.show = true;
    cluster.billboard.id = entities;
    cluster.billboard.width = 36;
    cluster.billboard.height = 36;
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
    cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="17" fill="#083c3b" stroke="#38dec6" stroke-width="2"/><text x="18" y="23" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="13" font-weight="700" fill="#edfffb">${entities.length}</text></svg>`;
    cluster.billboard.image = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });
  viewer.dataSources.add(source);
  viewer.creditDisplay.addStaticCredit(credit);
  viewer.scene.requestRender();
  return () => {
    removeClusterListener();
    if (!viewer.isDestroyed()) {
      viewer.creditDisplay.removeStaticCredit(credit);
      viewer.dataSources.remove(source, true);
      viewer.scene.requestRender();
    }
  };
}
