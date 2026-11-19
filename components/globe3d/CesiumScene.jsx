import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { STATUS_META, STATUS_ORDER, hasValidPosition } from '../../lib/globe3d/assetSummary';
import { getBuildingStyle } from '../../lib/globe3d/buildingStyles';
import { getMapSource } from '../../lib/globe3d/mapSources';
import { getVisualPreset } from '../../lib/globe3d/visualPresets';
import {
  BLACK_MARBLE_CREDIT,
  BLACK_MARBLE_MAX_LEVEL,
  BLACK_MARBLE_TILE_URL,
  CITY_OVERLAYS,
  nightModeRecipe,
} from '../../lib/globe3d/nightModes';
import { NightGlowImageryProvider } from './nightGlowProvider';
import { CLUSTER_SIZE, PIN_SIZE, getClusterImage, getPinImage } from './sceneGraphics';
import { createReferenceLayers } from './sceneLayers';
import { describePowerPlant } from '../../lib/powerPlants';
import { addDataCentreLayer } from './dataCentreLayer';

const MALAYSIA_RECTANGLE = Cesium.Rectangle.fromDegrees(99.2, 0.6, 119.6, 7.8);
const LABEL_FONT = '600 12px Inter, "Segoe UI", system-ui, sans-serif';
const OBLIQUE_PITCH = Cesium.Math.toRadians(-38);
const TOP_DOWN_PITCH = Cesium.Math.toRadians(-90);
const TEAL = Cesium.Color.fromCssColorString('#2dd4bf');
const AMBER = Cesium.Color.fromCssColorString('#f59e0b');

function toCartesian(position, height = 0) {
  return Cesium.Cartesian3.fromDegrees(Number(position[1]), Number(position[0]), height);
}

function statusColor(status) {
  return (STATUS_META[status] || STATUS_META.normal).color;
}

function buildImageryProvider(definition) {
  return new Cesium.UrlTemplateImageryProvider({
    url: definition.url,
    subdomains: definition.subdomains,
    maximumLevel: definition.maximumLevel,
    credit: definition.credit,
  });
}

/** One black pixel stretched over the globe; its layer alpha dims the base map. */
function createDimmerProvider() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, 1, 1);
  return new Cesium.SingleTileImageryProvider({ url: canvas.toDataURL(), tileWidth: 1, tileHeight: 1 });
}

/** Circle of [lon, lat] pairs around a point, radius in metres. */
function circlePositions(position, radiusM, steps = 72) {
  const latitude = Number(position[0]);
  const longitude = Number(position[1]);
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos(Cesium.Math.toRadians(latitude)));
  const degrees = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    degrees.push(longitude + dLon * Math.cos(angle), latitude + dLat * Math.sin(angle));
  }
  return Cesium.Cartesian3.fromDegreesArray(degrees);
}

/**
 * Rectangle that frames every positioned transformer inside the part of the
 * canvas not covered by the side panels, so no pin starts hidden behind one.
 */
function fleetRectangle(positioned, container) {
  const latitudes = positioned.map((item) => Number(item.position[0]));
  const longitudes = positioned.map((item) => Number(item.position[1]));
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const padLat = Math.max((north - south) * 0.25, 0.05);
  const spanLon = Math.max(east - west, 0.1) * 1.3;

  // Share of the width each side panel covers (ignored on narrow screens,
  // where panels overlay the map and only one is open at a time).
  const root = container?.parentElement;
  const width = root?.clientWidth || 0;
  let left = 0;
  let right = 0;
  if (width >= 900) {
    const rootLeft = root.getBoundingClientRect().left;
    const leftPanel = root.querySelector('.g3d-side-left')?.getBoundingClientRect();
    const rightPanel = root.querySelector('.g3d-side-right')?.getBoundingClientRect();
    left = leftPanel ? Math.min(Math.max((leftPanel.right - rootLeft) / width, 0), 0.35) : 0;
    right = rightPanel ? Math.min(Math.max((rootLeft + width - rightPanel.left) / width, 0), 0.35) : 0;
  }
  const totalLon = spanLon / (1 - left - right);
  const centerLon = (west + east) / 2;

  return Cesium.Rectangle.fromDegrees(
    Math.max(centerLon - spanLon / 2 - totalLon * left, -180),
    Math.max(south - padLat, -89),
    Math.min(centerLon + spanLon / 2 + totalLon * right, 180),
    Math.min(north + padLat, 89)
  );
}

function polygonCentroid(points) {
  const sum = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

/**
 * The Cesium globe. All map state arrives as props; camera moves are exposed
 * through the ref (flyToAsset, resetView, northUp, toggleTilt, zoom, flyTo).
 */
const CesiumScene = forwardRef(function CesiumScene(
  {
    transformers,
    statusById,
    selectedTransformer,
    companyBoundaries,
    floorPlans,
    dataCentreTracker,
    layers,
    hiddenFuels,
    rainRadarOptions,
    mapSource,
    visualPreset,
    nightMode,
    buildingStyle,
    ionToken,
    googleKey,
    onSelect,
    onHover,
    onFeaturePick,
    onCamera,
    onCursor,
    onLayerStatus,
  },
  ref
) {
  const containerRef = useRef(null);
  const creditRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [buildingsTileset, setBuildingsTileset] = useState(null);
  const hasFramedAssetsRef = useRef(false);
  const pinEntitiesRef = useRef(new Map());
  const transformersRef = useRef(transformers);
  transformersRef.current = transformers;

  // Latest callbacks without re-binding Cesium event handlers.
  const callbacksRef = useRef({});
  callbacksRef.current = { onSelect, onHover, onFeaturePick, onCamera, onCursor, onLayerStatus };
  const report = (id, status) => callbacksRef.current.onLayerStatus?.(id, status);

  // ── Viewer lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    const instance = new Cesium.Viewer(containerRef.current, {
      baseLayer: false,
      baseLayerPicker: false,
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      creditContainer: creditRef.current,
      requestRenderMode: true,
      maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      msaaSamples: 2,
    });

    const { scene, camera } = instance;
    scene.globe.depthTestAgainstTerrain = true;
    scene.globe.baseColor = Cesium.Color.fromCssColorString('#06181a');
    scene.screenSpaceCameraController.minimumZoomDistance = 30;
    scene.screenSpaceCameraController.maximumZoomDistance = 30000000;
    instance.clock.currentTime = Cesium.JulianDate.now();
    camera.setView({ destination: MALAYSIA_RECTANGLE });
    camera.percentageChanged = 0.01;

    const emitCamera = () => {
      const cartographic = camera.positionCartographic;
      callbacksRef.current.onCamera?.({
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        height: cartographic.height,
        heading: Cesium.Math.toDegrees(camera.heading),
        pitch: Cesium.Math.toDegrees(camera.pitch),
      });
    };
    camera.changed.addEventListener(emitCamera);
    emitCamera();

    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

    handler.setInputAction((click) => {
      const picked = scene.pick(click.position);
      if (!Cesium.defined(picked)) {
        callbacksRef.current.onFeaturePick?.(null);
        return;
      }

      // Cluster badge: zoom to its members.
      if (Array.isArray(picked.id)) {
        const positions = picked.id
          .map((entity) => entity.position?.getValue(instance.clock.currentTime))
          .filter(Boolean);
        if (positions.length > 0) {
          const sphere = Cesium.BoundingSphere.fromPoints(positions);
          camera.flyToBoundingSphere(sphere, {
            duration: 1.2,
            offset: new Cesium.HeadingPitchRange(camera.heading, OBLIQUE_PITCH, Math.max(sphere.radius * 3.2, 1500)),
          });
        }
        return;
      }

      // Grid primitives (points, labels, ground polylines) carry { refInfo } as their id.
      if (picked.id?.refInfo && !(picked.id instanceof Cesium.Entity)) {
        callbacksRef.current.onFeaturePick?.(picked.id.refInfo);
        return;
      }

      if (picked.id instanceof Cesium.Entity) {
        const entity = picked.id;
        if (entity.txId !== undefined) {
          callbacksRef.current.onFeaturePick?.(null);
          callbacksRef.current.onSelect?.(entity.txId);
          return;
        }
        const refInfo = entity.properties?.refInfo?.getValue();
        if (refInfo) {
          callbacksRef.current.onFeaturePick?.(refInfo);
        }
        return;
      }

      // A building (or any 3D Tiles feature): show its properties.
      if (picked instanceof Cesium.Cesium3DTileFeature) {
        const rows = [];
        const read = (key) => {
          try {
            return picked.getProperty(key);
          } catch {
            return undefined;
          }
        };
        const height = read('cesium#estimatedHeight');
        [
          ['Type', read('building')],
          ['Height', Number.isFinite(Number(height)) ? `${Number(height).toFixed(0)} m` : ''],
          ['Levels', read('building:levels')],
          ['Street', read('addr:street')],
          ['Operator', read('operator')],
        ].forEach((row) => rows.push(row));
        const name = read('name');
        // Photorealistic meshes (Google 3D) carry no properties — nothing to show.
        const hasDetails = Boolean(name) || rows.some(([, value]) => value !== undefined && value !== null && value !== '');
        callbacksRef.current.onFeaturePick?.(
          hasDetails ? { kind: 'Building', title: name || 'Building', rows } : null
        );
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    let lastHoverAt = 0;
    handler.setInputAction((movement) => {
      const now = performance.now();
      if (now - lastHoverAt < 70) {
        return;
      }
      lastHoverAt = now;

      const cartesian = camera.pickEllipsoid(movement.endPosition, scene.globe.ellipsoid);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        callbacksRef.current.onCursor?.({
          latitude: Cesium.Math.toDegrees(cartographic.latitude),
          longitude: Cesium.Math.toDegrees(cartographic.longitude),
        });
      } else {
        callbacksRef.current.onCursor?.(null);
      }

      const picked = scene.pick(movement.endPosition);
      const entity = picked?.id instanceof Cesium.Entity ? picked.id : null;
      const dataCentre = entity?.properties?.refInfo?.getValue()?.dataCentre;
      const isInteractive = Boolean(entity) || Array.isArray(picked?.id) || Boolean(picked?.id?.refInfo);
      scene.canvas.style.cursor = isInteractive ? 'pointer' : '';
      callbacksRef.current.onHover?.(
        entity?.txId !== undefined
          ? { txId: entity.txId, x: movement.endPosition.x, y: movement.endPosition.y }
          : dataCentre ? { dataCentre, x: movement.endPosition.x, y: movement.endPosition.y } : null
      );
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    const clearHover = () => callbacksRef.current.onHover?.(null);
    scene.canvas.addEventListener('mouseleave', clearHover);
    camera.moveStart.addEventListener(clearHover);

    setViewer(instance);

    return () => {
      scene.canvas.removeEventListener('mouseleave', clearHover);
      camera.moveStart.removeEventListener(clearHover);
      handler.destroy();
      camera.changed.removeEventListener(emitCamera);
      setViewer(null);
      setBuildingsTileset(null);
      hasFramedAssetsRef.current = false;
      if (!instance.isDestroyed()) {
        instance.destroy();
      }
    };
  }, []);

  // ── Camera API ──────────────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => {
      const getViewTarget = () => {
        if (!viewer) {
          return null;
        }
        const { scene, camera } = viewer;
        const center = new Cesium.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
        const target = camera.pickEllipsoid(center, scene.globe.ellipsoid);
        if (!target) {
          return null;
        }
        return { target, range: Cesium.Cartesian3.distance(camera.positionWC, target) };
      };

      const orbitTo = (heading, pitch) => {
        const view = getViewTarget();
        if (!view) {
          return;
        }
        viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(view.target, 1), {
          duration: 0.9,
          offset: new Cesium.HeadingPitchRange(heading, pitch, view.range),
        });
      };

      const frameAssets = (duration = 1.6) => {
        if (!viewer) {
          return;
        }
        const positioned = (transformersRef.current || []).filter(hasValidPosition);
        if (positioned.length === 0) {
          viewer.camera.flyTo({ destination: MALAYSIA_RECTANGLE, duration });
          return;
        }
        viewer.camera.flyTo({ destination: fleetRectangle(positioned, containerRef.current), duration });
      };

      return {
        flyToAsset(transformer) {
          if (!viewer || !hasValidPosition(transformer)) {
            return;
          }
          viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(toCartesian(transformer.position), 40), {
            duration: 1.8,
            offset: new Cesium.HeadingPitchRange(viewer.camera.heading, OBLIQUE_PITCH, 900),
          });
        },
        flyTo(latitude, longitude, range = 2500) {
          if (!viewer) {
            return;
          }
          viewer.camera.flyToBoundingSphere(
            new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(longitude, latitude), 40),
            { duration: 1.8, offset: new Cesium.HeadingPitchRange(0, OBLIQUE_PITCH, range) }
          );
        },
        resetView: () => frameAssets(),
        fitDataCentres(facilities) {
          const positions = facilities.filter((campus) => campus.mapped)
            .map((campus) => Cesium.Cartesian3.fromDegrees(campus.longitude, campus.latitude));
          if (!viewer || !positions.length) return;
          const sphere = Cesium.BoundingSphere.fromPoints(positions);
          viewer.camera.flyToBoundingSphere(sphere, { duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, TOP_DOWN_PITCH, Math.max(4000, sphere.radius * 3.5)) });
        },
        northUp() {
          if (viewer) {
            orbitTo(0, viewer.camera.pitch);
          }
        },
        toggleTilt() {
          if (!viewer) {
            return;
          }
          const isTopDown = viewer.camera.pitch < Cesium.Math.toRadians(-75);
          orbitTo(viewer.camera.heading, isTopDown ? OBLIQUE_PITCH : TOP_DOWN_PITCH);
        },
        zoom(direction) {
          if (!viewer) {
            return;
          }
          const amount = viewer.camera.positionCartographic.height * 0.45;
          if (direction > 0) {
            viewer.camera.zoomIn(amount);
          } else {
            viewer.camera.zoomOut(amount * 1.8);
          }
          viewer.scene.requestRender();
        },
      };
    },
    [viewer]
  );

  // ── API keys ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }
  }, [ionToken]);

  // ── Base map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) {
      return undefined;
    }

    let cancelled = false;
    const added = [];
    let googleTileset = null;
    let source = getMapSource(mapSource);

    const missingKey =
      (source.requires === 'cesiumIon' && !ionToken) || (source.requires === 'googleMaps' && !googleKey);
    if (missingKey) {
      source = getMapSource('esriSatellite');
    }

    const addLayer = (layer, index) => {
      viewer.imageryLayers.add(layer, index);
      added.push(layer);
    };

    viewer.scene.globe.show = true;

    if (source.kind === 'url') {
      addLayer(new Cesium.ImageryLayer(buildImageryProvider(source)), 0);
      if (source.overlay) {
        addLayer(new Cesium.ImageryLayer(buildImageryProvider(source.overlay)), 1);
      }
    } else if (source.kind === 'local') {
      addLayer(
        Cesium.ImageryLayer.fromProviderAsync(
          Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'))
        ),
        0
      );
    } else if (source.kind === 'ion') {
      addLayer(Cesium.ImageryLayer.fromProviderAsync(Cesium.IonImageryProvider.fromAssetId(source.assetId)), 0);
    } else if (source.kind === 'google3d') {
      // Keep satellite imagery underneath so the globe is not blank while tiles stream in.
      addLayer(new Cesium.ImageryLayer(buildImageryProvider(getMapSource('esriSatellite'))), 0);
      Cesium.createGooglePhotorealistic3DTileset({ key: googleKey, onlyUsingWithGoogleGeocoder: true })
        .then((tileset) => {
          if (cancelled || viewer.isDestroyed()) {
            tileset.destroy();
            return;
          }
          googleTileset = viewer.scene.primitives.add(tileset);
          viewer.scene.globe.show = false;
          viewer.scene.requestRender();
        })
        .catch((error) => {
          console.error('Google Photorealistic 3D Tiles failed to load:', error);
          report('mapSource', { state: 'error', text: 'Google 3D Tiles failed — check the API key' });
        });
    }

    report('mapSource', null);
    viewer.scene.requestRender();

    return () => {
      cancelled = true;
      if (viewer.isDestroyed()) {
        return;
      }
      added.forEach((layer) => viewer.imageryLayers.remove(layer, true));
      if (googleTileset) {
        viewer.scene.primitives.remove(googleTileset);
      }
      viewer.scene.globe.show = true;
    };
  }, [viewer, mapSource, ionToken, googleKey]);

  // ── Terrain ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) {
      return undefined;
    }

    let cancelled = false;
    if (layers.terrain && ionToken) {
      report('terrain', { state: 'loading', text: 'Loading…' });
      Cesium.createWorldTerrainAsync()
        .then((provider) => {
          if (cancelled || viewer.isDestroyed()) {
            return;
          }
          viewer.terrainProvider = provider;
          report('terrain', { state: 'ok', text: 'Active' });
          viewer.scene.requestRender();
        })
        .catch((error) => {
          console.error('World terrain failed to load:', error);
          if (!cancelled) {
            report('terrain', { state: 'error', text: 'Failed — check the Cesium ion token' });
          }
        });
    } else {
      report('terrain', null);
    }

    return () => {
      cancelled = true;
      if (!viewer.isDestroyed()) {
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      }
    };
  }, [viewer, layers.terrain, ionToken]);

  // ── 3D buildings ────────────────────────────────────────────────────────
  // With a Cesium ion token: Cesium OSM Buildings (worldwide, terrain-aware).
  // Without one: the local Malaysia tileset in public/data/buildings3d, built
  // from OpenStreetMap by scripts/buildings3d (sits on the ellipsoid, which is
  // what the globe uses when there is no ion terrain).
  const buildingsEnabled = Boolean(layers.buildings && getMapSource(mapSource).kind !== 'google3d');
  const buildingsSource = ionToken ? 'ion' : 'local';
  useEffect(() => {
    if (!viewer || !buildingsEnabled) {
      report('buildings', null);
      return undefined;
    }

    let cancelled = false;
    let tileset = null;
    let localCredit = null;
    report('buildings', { state: 'loading', text: 'Loading…' });

    const load =
      buildingsSource === 'ion'
        ? Cesium.createOsmBuildingsAsync()
        : Cesium.Cesium3DTileset.fromUrl(`${import.meta.env.BASE_URL}data/buildings3d/tileset.json`, {
            maximumScreenSpaceError: 16,
            cacheBytes: 768 * 1024 * 1024,
          });

    load
      .then((created) => {
        if (cancelled || viewer.isDestroyed()) {
          created.destroy();
          return;
        }
        tileset = viewer.scene.primitives.add(created);
        if (buildingsSource === 'local') {
          localCredit = new Cesium.Credit('Buildings © OpenStreetMap contributors (ODbL)', true);
          viewer.creditDisplay.addStaticCredit(localCredit);
        }
        setBuildingsTileset(tileset);
        report('buildings', {
          state: 'ok',
          text:
            buildingsSource === 'ion'
              ? 'Cesium OSM Buildings · click a building'
              : 'Local OSM tiles · zoom in under ~7 km',
        });
        viewer.scene.requestRender();
      })
      .catch((error) => {
        console.error('3D buildings failed to load:', error);
        if (!cancelled) {
          report('buildings', {
            state: 'error',
            text:
              buildingsSource === 'ion'
                ? 'Failed — check the Cesium ion token'
                : 'Local tiles missing — run npm run globe:buildings',
          });
        }
      });

    return () => {
      cancelled = true;
      setBuildingsTileset(null);
      if (!viewer.isDestroyed()) {
        if (tileset) viewer.scene.primitives.remove(tileset);
        if (localCredit) viewer.creditDisplay.removeStaticCredit(localCredit);
        viewer.scene.requestRender();
      }
    };
  }, [viewer, buildingsEnabled, buildingsSource]);

  // 3D Tiles feature styling.
  const selectedPosition = hasValidPosition(selectedTransformer) ? selectedTransformer.position : null;
  const selectedLatitude = selectedPosition ? Number(selectedPosition[0]) : null;
  const selectedLongitude = selectedPosition ? Number(selectedPosition[1]) : null;
  useEffect(() => {
    if (!viewer || !buildingsTileset || buildingsTileset.isDestroyed()) {
      return;
    }
    const definition = getBuildingStyle(buildingStyle).build(
      selectedLatitude !== null ? [selectedLatitude, selectedLongitude] : null
    );
    buildingsTileset.style = new Cesium.Cesium3DTileStyle(definition);
    viewer.scene.requestRender();
  }, [viewer, buildingsTileset, buildingStyle, selectedLatitude, selectedLongitude]);

  // ── Sun lighting ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer) {
      return;
    }
    viewer.clock.currentTime = Cesium.JulianDate.now();
    viewer.scene.globe.enableLighting = Boolean(layers.lighting);
    viewer.scene.requestRender();
  }, [viewer, layers.lighting]);

  // ── Visual preset (post-process shader and/or imagery layer) ────────────
  useEffect(() => {
    if (!viewer) {
      return undefined;
    }
    const preset = getVisualPreset(visualPreset);

    // The Night preset drapes imagery layers over the base map, bottom to top:
    // optional dimmer, the night layer for the chosen mode, roads, labels.
    // Added on top of the stack; the base-map effect inserts at index 0/1, so a
    // later base-map switch keeps these layers above it.
    // (ImageryLayerCollection.add() returns undefined, so keep our own refs.)
    const imageryLayers = [];
    const addLayer = (layer, alpha = 1) => {
      layer.alpha = alpha;
      viewer.imageryLayers.add(layer);
      imageryLayers.push(layer);
    };
    if (preset.night) {
      const recipe = nightModeRecipe(nightMode);
      if (recipe.dim > 0) {
        addLayer(new Cesium.ImageryLayer(createDimmerProvider()), recipe.dim);
      }
      addLayer(
        new Cesium.ImageryLayer(
          recipe.kind === 'lights'
            ? buildImageryProvider({
                url: BLACK_MARBLE_TILE_URL,
                maximumLevel: BLACK_MARBLE_MAX_LEVEL,
                credit: BLACK_MARBLE_CREDIT,
              })
            : new NightGlowImageryProvider({ kind: recipe.kind })
        ),
        recipe.alpha
      );
      CITY_OVERLAYS.forEach((overlay) => {
        const alpha = overlay.id === 'roads' ? recipe.roadsAlpha : recipe.labels ? 1 : 0;
        if (alpha > 0) {
          addLayer(new Cesium.ImageryLayer(buildImageryProvider(overlay)), alpha);
        }
      });
    }

    const stage = preset.shader
      ? viewer.scene.postProcessStages.add(
          new Cesium.PostProcessStage({ name: `tx-preset-${preset.id}-${Date.now()}`, fragmentShader: preset.shader })
        )
      : null;
    viewer.scene.requestRender();

    return () => {
      if (!viewer.isDestroyed()) {
        if (stage) viewer.scene.postProcessStages.remove(stage);
        imageryLayers.forEach((layer) => viewer.imageryLayers.remove(layer, true));
        viewer.scene.requestRender();
      }
    };
  }, [viewer, visualPreset, nightMode]);

  // ── Transformer pins ────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer || !layers.transformers) {
      return undefined;
    }

    const dataSource = new Cesium.CustomDataSource('transformers');
    const positioned = (transformers || []).filter(hasValidPosition);
    const pinEntities = new Map();
    pinEntitiesRef.current = pinEntities;

    positioned.forEach((transformer) => {
      const status = statusById?.get(transformer.id) || 'normal';
      const entity = dataSource.entities.add({
        position: toCartesian(transformer.position),
        billboard: {
          image: getPinImage(statusColor(status)),
          width: PIN_SIZE.width,
          height: PIN_SIZE.height,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          show: Boolean(layers.assetLabels),
          text: transformer.txName || 'Unnamed transformer',
          font: LABEL_FONT,
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(6, 24, 26, 0.8)'),
          backgroundPadding: new Cesium.Cartesian2(7, 4),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(18, -12),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 120000),
        },
      });
      entity.txId = transformer.id;
      entity.txStatus = status;
      pinEntities.set(String(transformer.id), entity);
    });

    dataSource.clustering.enabled = true;
    dataSource.clustering.pixelRange = 36;
    dataSource.clustering.minimumClusterSize = 3;
    const removeClusterListener = dataSource.clustering.clusterEvent.addEventListener((members, cluster) => {
      const worst = STATUS_ORDER.find((status) => members.some((member) => member.txStatus === status)) || 'normal';
      cluster.label.show = false;
      cluster.billboard.show = true;
      cluster.billboard.id = cluster.label.id;
      cluster.billboard.image = getClusterImage(members.length, statusColor(worst));
      cluster.billboard.width = CLUSTER_SIZE;
      cluster.billboard.height = CLUSTER_SIZE;
      cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
      cluster.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
      cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    });

    viewer.dataSources.add(dataSource);
    viewer.scene.requestRender();

    // First time assets arrive: frame them without animation.
    if (!hasFramedAssetsRef.current && positioned.length > 0) {
      hasFramedAssetsRef.current = true;
      viewer.camera.setView({ destination: fleetRectangle(positioned, containerRef.current) });
    }

    return () => {
      removeClusterListener();
      pinEntitiesRef.current = new Map();
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource, true);
        viewer.scene.requestRender();
      }
    };
  }, [viewer, transformers, statusById, layers.transformers, layers.assetLabels]);

  // ── Selected transformer highlight ──────────────────────────────────────
  const selectedId = selectedTransformer?.id ?? null;
  const selectedStatus = selectedId !== null ? statusById?.get(selectedId) || 'normal' : null;
  const selectedName = selectedTransformer?.txName || '';
  const showAssetLabels = Boolean(layers.assetLabels);
  useEffect(() => {
    if (!viewer || selectedLatitude === null) {
      return undefined;
    }

    const position = [selectedLatitude, selectedLongitude];
    const dataSource = new Cesium.CustomDataSource('selection');
    const pin = dataSource.entities.add({
      position: toCartesian(position),
      billboard: {
        image: getPinImage(statusColor(selectedStatus), true),
        width: PIN_SIZE.width * 1.35,
        height: PIN_SIZE.height * 1.35,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        eyeOffset: new Cesium.Cartesian3(0, 0, -5),
      },
      label: {
        text: selectedName || 'Selected transformer',
        font: '700 13px Inter, "Segoe UI", system-ui, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#042f2e'),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(94, 234, 212, 0.96)'),
        backgroundPadding: new Cesium.Cartesian2(8, 5),
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(24, -18),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        eyeOffset: new Cesium.Cartesian3(0, 0, -5),
      },
    });
    pin.txId = selectedId;

    // The highlighted label replaces the regular one for this transformer.
    const basePin = pinEntitiesRef.current.get(String(selectedId));
    if (basePin?.label) {
      basePin.label.show = false;
    }

    [60, 150].forEach((radius, index) => {
      dataSource.entities.add({
        polyline: {
          positions: circlePositions(position, radius),
          width: index === 0 ? 3 : 1.5,
          material: TEAL.withAlpha(index === 0 ? 0.95 : 0.55),
          clampToGround: true,
        },
      });
    });

    viewer.dataSources.add(dataSource);
    viewer.scene.requestRender();

    return () => {
      if (basePin?.label) {
        basePin.label.show = showAssetLabels;
      }
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource, true);
        viewer.scene.requestRender();
      }
    };
  }, [viewer, selectedId, selectedLatitude, selectedLongitude, selectedStatus, selectedName, transformers, statusById, showAssetLabels, layers.transformers]);

  // ── Company boundaries + site areas ─────────────────────────────────────
  useEffect(() => {
    if (!viewer) {
      return undefined;
    }

    const dataSource = new Cesium.CustomDataSource('areas');
    const addArea = (points, name, color, kind) => {
      if (!Array.isArray(points) || points.length < 3) {
        return;
      }
      const degrees = points.flatMap((point) => [Number(point[1]), Number(point[0])]);
      const ring = [...degrees, degrees[0], degrees[1]];
      dataSource.entities.add({
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(degrees),
          material: color.withAlpha(0.14),
          classificationType: Cesium.ClassificationType.BOTH,
        },
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(ring),
          width: 2,
          material: color.withAlpha(0.95),
          clampToGround: true,
        },
        properties: { refInfo: { kind, title: name || kind, rows: [] } },
      });
      if (name) {
        dataSource.entities.add({
          position: toCartesian(polygonCentroid(points)),
          label: {
            text: name,
            font: LABEL_FONT,
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString('#06181a'),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 40000),
          },
        });
      }
    };

    if (layers.companyBoundaries) {
      (companyBoundaries || []).forEach((boundary) =>
        addArea(boundary.points, boundary.companyName, TEAL, 'Company boundary')
      );
    }
    if (layers.floorPlans) {
      (floorPlans || []).forEach((plan) => addArea(plan.points, plan.name, AMBER, 'Site area'));
    }

    viewer.dataSources.add(dataSource);
    viewer.scene.requestRender();

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource, true);
        viewer.scene.requestRender();
      }
    };
  }, [viewer, companyBoundaries, floorPlans, layers.companyBoundaries, layers.floorPlans]);

  // ── Reference feeds ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewer || !dataCentreTracker?.settings.enabled) return undefined;
    return addDataCentreLayer(viewer, dataCentreTracker.facilities, dataCentreTracker.settings);
  }, [viewer, dataCentreTracker?.facilities, dataCentreTracker?.settings.enabled,
    dataCentreTracker?.settings.colorBy, dataCentreTracker?.settings.markerScale, dataCentreTracker?.settings.source]);

  const referenceRef = useRef(null);
  const activeReferenceRef = useRef(new Set());
  useEffect(() => {
    if (!viewer) {
      return undefined;
    }

    const handlers = createReferenceLayers(viewer, (id, status) =>
      callbacksRef.current.onLayerStatus?.(id, status),
      (plant) => callbacksRef.current.onFeaturePick?.(describePowerPlant(plant))
    );
    referenceRef.current = handlers;
    const active = activeReferenceRef.current;

    const onMoveEnd = () => {
      active.forEach((id) => handlers[id]?.onCameraIdle?.());
    };
    viewer.camera.moveEnd.addEventListener(onMoveEnd);

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(onMoveEnd);
        active.forEach((id) => handlers[id]?.disable());
      }
      active.clear();
      referenceRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    const handlers = referenceRef.current;
    if (!viewer || !handlers) {
      return;
    }
    const active = activeReferenceRef.current;
    Object.keys(handlers).forEach((id) => {
      const shouldBeOn = Boolean(layers[id]);
      if (shouldBeOn && !active.has(id)) {
        active.add(id);
        handlers[id].enable();
      } else if (!shouldBeOn && active.has(id)) {
        active.delete(id);
        handlers[id].disable();
      }
    });
  }, [viewer, layers]);

  // Fuel types switched off in the power plant legend tab.
  useEffect(() => {
    referenceRef.current?.powerPlants?.setHiddenFuels(hiddenFuels || []);
  }, [viewer, hiddenFuels]);

  // Rain radar tab: frame, opacity, smoothing, auto-refresh.
  useEffect(() => {
    referenceRef.current?.rainRadar?.setOptions(rainRadarOptions || {});
  }, [viewer, rainRadarOptions]);

  return (
    <>
      <div ref={containerRef} className="g3d-scene" />
      <div ref={creditRef} className="g3d-credits" />
    </>
  );
});

export default CesiumScene;
