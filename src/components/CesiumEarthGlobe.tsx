import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  ArcGisMapServerImageryProvider,
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  Entity,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  SingleTileImageryProvider,
  UrlTemplateImageryProvider,
  Viewer,
  Math as CesiumMath,
  Rectangle,
  Ion,
  createOsmBuildingsAsync,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { CesiumSoilLayer } from './CesiumSoilLayer';

type EarthSite = {
  id?: string;
  name: string;
  lat: number;
  lon: number;
  color?: string;
  category?: string;
  isCity?: boolean;
  altitude?: number;
  [key: string]: any;
};

type Props = {
  sites: EarthSite[];
  selectedSite?: EarthSite | null;
  showCountryBorders?: boolean;
  countryBorderPaths?: Array<{ points: number[][]; name?: string }>;
  imagerySource?: 'satellite' | 'blue-marble' | 'land-ocean';
  onSiteClick: (site: EarthSite) => void;
  onGlobeClick?: (coords: { lat: number; lng: number }) => void;
  onZoom?: (altitude: number) => void;
  triangleEdges?: Array<{ startLat: number; startLng: number; endLat: number; endLng: number; triangleNames: string[] }>;
  showAlignmentTriangles?: boolean;
  showBuildings?: boolean;
  onBuildingsStatus?: (status: string) => void;
  showSoilLayer?: boolean;
  soilDepth?: number;
  reliefExaggeration?: number;
  onSoilStatus?: (status: string) => void;
};

const siteId = (site: EarthSite) => `np-earth-site:${site.id ?? site.name}:${Number(site.lat)}:${Number(site.lon)}`;

export const CesiumEarthGlobe = forwardRef<any, Props>(({
  sites,
  selectedSite,
  showCountryBorders = true,
  countryBorderPaths = [],
  imagerySource = 'satellite',
  onSiteClick,
  onGlobeClick,
  onZoom,
  triangleEdges = [],
  showAlignmentTriangles = false,
  showBuildings = false,
  onBuildingsStatus,
  showSoilLayer = false,
  soilDepth = 39,
  reliefExaggeration = 3,
  onSoilStatus,
}, forwardedRef) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [viewerReady, setViewerReady] = React.useState(false);
  const buildingsRef = useRef<any>(null);
  const autoRotateRef = useRef(false);
  useImperativeHandle(forwardedRef, () => ({
    pointOfView: (pov?: { lat?: number; lng?: number; altitude?: number }, duration = 0) => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return pov ? undefined : {};
      const p = viewer.camera.positionCartographic;
      if (pov && Number.isFinite(pov.lat) && Number.isFinite(pov.lng)) {
        const altitude = Math.max(100, Number(pov.altitude ?? 2) * 6371000);
        viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(Number(pov.lng), Number(pov.lat), altitude), orientation: { heading: 0, pitch: CesiumMath.toRadians(-55), roll: 0 }, duration: Math.max(0, duration / 1000) });
        return;
      }
      if (pov && Number.isFinite(pov.altitude)) {
        const altitude = Math.max(100, Number(pov.altitude) * 6371000);
        viewer.camera.flyTo({ destination: Cartesian3.fromRadians(p.longitude, p.latitude, altitude), orientation: { heading: viewer.camera.heading, pitch: viewer.camera.pitch, roll: viewer.camera.roll }, duration: Math.max(0, duration / 1000) });
        return;
      }
      return { lat: CesiumMath.toDegrees(p.latitude), lng: CesiumMath.toDegrees(p.longitude), altitude: p.height / 6371000 };
    },
    controls: () => ({ get autoRotate() { return autoRotateRef.current; }, set autoRotate(value: boolean) { autoRotateRef.current = Boolean(value); } }),
    renderer: () => ({ domElement: viewerRef.current?.canvas }),
  }), []);
  const callbacksRef = useRef({ onSiteClick, onGlobeClick, onZoom, onBuildingsStatus });
  callbacksRef.current = { onSiteClick, onGlobeClick, onZoom, onBuildingsStatus };
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const selectedRef = useRef(selectedSite);
  selectedRef.current = selectedSite;
  const borderPathsRef = useRef(countryBorderPaths);
  borderPathsRef.current = countryBorderPaths;
  const showBordersRef = useRef(showCountryBorders);
  showBordersRef.current = showCountryBorders;
  const triangleEdgesRef = useRef(triangleEdges);
  triangleEdgesRef.current = triangleEdges;
  const showTrianglesRef = useRef(showAlignmentTriangles);
  showTrianglesRef.current = showAlignmentTriangles;

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let viewer: Viewer | null = null;
    let pickHandler: ScreenSpaceEventHandler | null = null;
      const borderEntities: Entity[] = [];

    const start = async () => {
      viewer = new Viewer(hostRef.current!, {
        animation: false,
        timeline: false,
        geocoder: false,
        baseLayerPicker: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
        baseLayer: false,
        requestRenderMode: true,
      });
      viewerRef.current = viewer;
      setViewerReady(false);
      const controller = viewer.scene.screenSpaceCameraController;
      controller.enableInputs = true;
      controller.enableRotate = true;
      controller.enableTilt = true;
      controller.enableLook = true;
      controller.enableTranslate = true;
      controller.enableZoom = true;
      viewer.scene.globe.show = true;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.backgroundColor = Color.fromCssColorString('#030814');

      try {
        if (imagerySource === 'satellite') {
          const provider = await ArcGisMapServerImageryProvider.fromUrl(
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
          );
          if (disposed || !viewer || viewer.isDestroyed()) return;
          viewer.imageryLayers.addImageryProvider(provider);
        } else if (imagerySource === 'blue-marble') {
          const provider = await SingleTileImageryProvider.fromUrl(
            'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            { rectangle: Rectangle.MAX_VALUE }
          );
          if (disposed || !viewer || viewer.isDestroyed()) return;
          viewer.imageryLayers.addImageryProvider(provider);
        } else {
          const provider = new UrlTemplateImageryProvider({
            url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2020-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
            maximumLevel: 8,
          });
          if (disposed || !viewer || viewer.isDestroyed()) return;
          imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
        }
      } catch (error) {
        console.warn('[NeuroPulse] Cesium Earth imagery failed; using ellipsoid globe:', error);
      }
      if (disposed || !viewer || viewer.isDestroyed()) return;
      setViewerReady(true);

      const syncSites = () => {
        if (!viewer || viewer.isDestroyed()) return;
        const nextIds = new Set<string>();
        for (const site of sitesRef.current) {
          if (!site || !site.name || !Number.isFinite(Number(site.lat)) || !Number.isFinite(Number(site.lon)) || Math.abs(Number(site.lat)) > 90 || Math.abs(Number(site.lon)) > 180) continue;
          const id = siteId(site);
          nextIds.add(id);
          const selected = selectedRef.current && siteId(selectedRef.current) === id;
          const old = viewer.entities.getById(id);
          if (old) viewer.entities.remove(old);
          viewer.entities.add({
            id,
            name: site.name,
            properties: { neuroPulseSite: true, siteId: site.id ?? site.name },
            position: Cartesian3.fromDegrees(Number(site.lon), Number(site.lat), Math.max(0, Number(site.altitude) || 0) + (selected ? 100 : 40)),
            point: {
              pixelSize: selected ? 16 : site.isCity ? 12 : 13,
              color: Color.fromCssColorString(selected ? '#ffffff' : site.color || (site.isCity ? '#7dd3fc' : '#fbbf24')),
              outlineColor: Color.fromCssColorString(selected ? '#22d3ee' : '#07111f'),
              outlineWidth: selected ? 3 : 2,
            },
            label: {
              text: site.name,
              show: selected || site.showLabel === true,
              font: selected ? 'bold 14px sans-serif' : '12px sans-serif',
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 3,
              style: 2,
              pixelOffset: new Cartesian2(0, -14),
            },
          });
        }
        for (const entity of [...viewer.entities.values]) {
          if (entity.id.startsWith('np-earth-site:') && !nextIds.has(entity.id)) viewer.entities.remove(entity);
        }
        viewer.scene.requestRender();
      };

      const syncBorders = () => {
        if (!viewer || viewer.isDestroyed()) return;
        borderEntities.splice(0).forEach(entity => viewer!.entities.remove(entity));
        if (showBordersRef.current) {
          borderPathsRef.current.forEach((path, index) => {
            if (!path.points || path.points.length < 2) return;
            const positions = path.points
              .filter(point => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
              .map(point => Cartesian3.fromDegrees(point[1], point[0], 12000));
            if (positions.length < 2) return;
            borderEntities.push(viewer!.entities.add({
              id: `np-country-border:${index}:${path.name || 'boundary'}`,
              polyline: { positions, width: 1.2, material: Color.WHITE.withAlpha(0.68), clampToGround: false },
            }));
          });
        }
        viewer.scene.requestRender();
      };

      syncSites();
      syncBorders();
      const current = selectedRef.current;
      if (current && Number.isFinite(current.lat) && Number.isFinite(current.lon)) {
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(current.lon, current.lat, 1800000),
          orientation: { heading: 0, pitch: CesiumMath.toRadians(-55), roll: 0 },
          duration: 0,
        });
      } else {
        viewer.camera.setView({
          destination: Cartesian3.fromDegrees(15, 22, 22000000),
          orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
        });
      }

      pickHandler = new ScreenSpaceEventHandler(viewer.canvas);
      pickHandler.setInputAction((movement: { position: Cartesian2 }) => {
        if (!viewer || viewer.isDestroyed()) return;
        // Cesium can return an Entity, a primitive wrapper, or a string id
        // depending on which part of a point/label was hit. Inspect both the
        // direct pick and the drill-pick stack, and use the entity property as
        // a fallback instead of silently treating a valid site as empty space.
        const picks = [
          viewer.scene.pick(movement.position),
          ...viewer.scene.drillPick(movement.position, 24),
        ] as any[];
        const seen = new Set<string>();
        for (const item of picks) {
          const candidates = [item?.id, item?.primitive?.id, item?.collection?.get?.(item?.id)];
          for (const candidate of candidates) {
            const id = candidate instanceof Entity
              ? candidate.id
              : typeof candidate === 'string'
                ? candidate
                : typeof candidate?.id === 'string'
                  ? candidate.id
                  : '';
            if (id && seen.has(id)) continue;
            if (id) seen.add(id);
            let site: EarthSite | undefined;
            if (id.startsWith('np-earth-site:')) {
              site = sitesRef.current.find(candidateSite => siteId(candidateSite) === id);
            }
            if (!site && candidate?.properties?.neuroPulseSite) {
              const markerValue = candidate.properties.siteId?.getValue?.() ?? candidate.properties.siteId;
              site = sitesRef.current.find(candidateSite => String(candidateSite.id ?? candidateSite.name) === String(markerValue));
            }
            if (site) {
              callbacksRef.current.onSiteClick(site);
              return;
            }
          }
        }
        const ray = viewer.camera.getPickRay(movement.position);
        const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
        if (!cartesian) return;
        const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
        if (cartographic) callbacksRef.current.onGlobeClick?.({
          lat: CesiumMath.toDegrees(cartographic.latitude),
          lng: CesiumMath.toDegrees(cartographic.longitude),
        });
      }, ScreenSpaceEventType.LEFT_CLICK);

      viewer.camera.changed.addEventListener(() => {
        if (autoRotateRef.current) viewer!.scene.camera.rotate(Cartesian3.UNIT_Z, 0.00003);
        if (!viewer || viewer.isDestroyed()) return;
        callbacksRef.current.onZoom?.(viewer.camera.positionCartographic.height);
      });
      callbacksRef.current.onZoom?.(viewer.camera.positionCartographic.height);
    };

    void start();
    return () => {
      disposed = true;
      setViewerReady(false);
      if (pickHandler && !pickHandler.isDestroyed()) pickHandler.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, [imagerySource]);


  useEffect(() => {
    const viewer = viewerRef.current;
    let cancelled = false;
    let tileset: any = null;
    if (!showBuildings) {
      if (buildingsRef.current && viewer && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(buildingsRef.current);
      }
      buildingsRef.current = null;
      callbacksRef.current.onBuildingsStatus?.('Buildings off');
      return;
    }
    if (!viewerReady || !viewer || viewer.isDestroyed()) return;
    const ionToken = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN?.trim();
    if (!ionToken) {
      callbacksRef.current.onBuildingsStatus?.('Cesium ion token required for global 3D buildings');
      return;
    }
    Ion.defaultAccessToken = ionToken;
    callbacksRef.current.onBuildingsStatus?.('Loading global OpenStreetMap 3D buildings…');
    void (async () => {
      try {
        tileset = await createOsmBuildingsAsync();
        if (cancelled || !viewer || viewer.isDestroyed()) {
          tileset.destroy?.();
          return;
        }
        buildingsRef.current = tileset;
        viewer.scene.primitives.add(tileset);
        viewer.scene.requestRender();
        callbacksRef.current.onBuildingsStatus?.('Global 3D buildings loaded · OpenStreetMap');
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          callbacksRef.current.onBuildingsStatus?.('3D buildings failed to load: ' + message);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (tileset && viewer && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(tileset);
        if (buildingsRef.current === tileset) buildingsRef.current = null;
      }
    };
  }, [showBuildings, viewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const current = selectedSite;
    if (current && Number.isFinite(current.lat) && Number.isFinite(current.lon)) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(current.lon, current.lat, 1800000),
        orientation: { heading: 0, pitch: CesiumMath.toRadians(-55), roll: 0 },
        duration: 0.85,
      });
    }
    viewer.scene.requestRender();
  }, [selectedSite?.id, selectedSite?.name, selectedSite?.lat, selectedSite?.lon]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const existing = new Set(sites.map(siteId));
    for (const entity of [...viewer.entities.values]) {
      if (entity.id.startsWith('np-earth-site:') && !existing.has(entity.id)) viewer.entities.remove(entity);
    }
    for (const site of sites) {
      if (!site || !site.name || !Number.isFinite(Number(site.lat)) || !Number.isFinite(Number(site.lon)) || Math.abs(Number(site.lat)) > 90 || Math.abs(Number(site.lon)) > 180) continue;
      const id = siteId(site);
      const selected = selectedSite && siteId(selectedSite) === id;
      const entity = viewer.entities.getById(id);
      if (entity) viewer.entities.remove(entity);
      viewer.entities.add({
        id, name: site.name, properties: { neuroPulseSite: true, siteId: site.id ?? site.name },
        position: Cartesian3.fromDegrees(Number(site.lon), Number(site.lat), Math.max(0, Number(site.altitude) || 0) + (selected ? 100 : 40)),
        point: { pixelSize: selected ? 13 : site.isCity ? 8 : 9, color: Color.fromCssColorString(selected ? '#ffffff' : site.color || (site.isCity ? '#7dd3fc' : '#fbbf24')), outlineColor: Color.fromCssColorString(selected ? '#22d3ee' : '#07111f'), outlineWidth: selected ? 3 : 2 },
        label: { text: site.name, show: selected || site.showLabel === true, font: selected ? 'bold 14px sans-serif' : '12px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 3, style: 2, pixelOffset: new Cartesian2(0, -14) },
      });
    }
    viewer.scene.requestRender();
  }, [sites, selectedSite]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const entities = viewer.entities.values.filter(entity => entity.id.startsWith('np-country-border:'));
    entities.forEach(entity => viewer.entities.remove(entity));
    if (showCountryBorders) {
      countryBorderPaths.forEach((path, index) => {
        const positions = path.points.filter(point => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])).map(point => Cartesian3.fromDegrees(point[1], point[0], 12000));
        if (positions.length >= 2) viewer.entities.add({ id: `np-country-border:${index}:${path.name || 'boundary'}`, polyline: { positions, width: 1.2, material: Color.WHITE.withAlpha(0.68), clampToGround: false } });
      });
    }
    viewer.scene.requestRender();
  }, [showCountryBorders, countryBorderPaths]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    for (const entity of [...viewer.entities.values]) {
      if (entity.id.startsWith('np-triangulation-edge:')) viewer.entities.remove(entity);
    }
    if (showAlignmentTriangles) {
      triangleEdges.forEach((edge, index) => {
        if (![edge.startLat, edge.startLng, edge.endLat, edge.endLng].every(Number.isFinite)) return;
        viewer.entities.add({
          id: `np-triangulation-edge:${index}`,
          polyline: {
            positions: [
              Cartesian3.fromDegrees(edge.startLng, edge.startLat, 5000),
              Cartesian3.fromDegrees(edge.endLng, edge.endLat, 5000),
            ],
            width: 2,
            material: Color.fromCssColorString('#22d3ee').withAlpha(0.92),
            arcType: ArcType.GEODESIC,
          },
        });
      });
    }
    viewer.scene.requestRender();
  }, [triangleEdges, showAlignmentTriangles]);

  return <>
    <div ref={hostRef} className="absolute inset-0 h-full w-full" aria-label="Cesium interactive Earth globe" />
    <CesiumSoilLayer
      viewer={viewerReady ? viewerRef.current : null}
      sites={sites}
      selectedSite={selectedSite}
      enabled={showSoilLayer}
      depth={soilDepth}
      reliefExaggeration={reliefExaggeration}
      onStatus={onSoilStatus}
    />
  </>;
});

CesiumEarthGlobe.displayName = 'CesiumEarthGlobe';
