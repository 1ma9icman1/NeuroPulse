import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  ArcGisMapServerImageryProvider,
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
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

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
};

const siteId = (site: EarthSite) => `np-earth-site:${site.id ?? site.name}:${site.lat}:${site.lon}`;

export const CesiumEarthGlobe = forwardRef<any, Props>(({
  sites,
  selectedSite,
  showCountryBorders = true,
  countryBorderPaths = [],
  imagerySource = 'satellite',
  onSiteClick,
  onGlobeClick,
  onZoom,
}, forwardedRef) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const autoRotateRef = useRef(false);
  useImperativeHandle(forwardedRef, () => ({
    pointOfView: (pov?: { lat?: number; lng?: number; altitude?: number }, duration = 0) => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return pov ? undefined : {};
      if (pov && Number.isFinite(pov.lat) && Number.isFinite(pov.lng)) {
        const altitude = Math.max(100, Number(pov.altitude ?? 2) * 6371000);
        viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(Number(pov.lng), Number(pov.lat), altitude), orientation: { heading: 0, pitch: CesiumMath.toRadians(-55), roll: 0 }, duration: Math.max(0, duration / 1000) });
        return;
      }
      const p = viewer.camera.positionCartographic;
      return { lat: CesiumMath.toDegrees(p.latitude), lng: CesiumMath.toDegrees(p.longitude), altitude: p.height / 6371000 };
    },
    controls: () => ({ get autoRotate() { return autoRotateRef.current; }, set autoRotate(value: boolean) { autoRotateRef.current = Boolean(value); } }),
    renderer: () => ({ domElement: viewerRef.current?.canvas }),
  }), []);
  const callbacksRef = useRef({ onSiteClick, onGlobeClick, onZoom });
  callbacksRef.current = { onSiteClick, onGlobeClick, onZoom };
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const selectedRef = useRef(selectedSite);
  selectedRef.current = selectedSite;
  const borderPathsRef = useRef(countryBorderPaths);
  borderPathsRef.current = countryBorderPaths;
  const showBordersRef = useRef(showCountryBorders);
  showBordersRef.current = showCountryBorders;

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let viewer: Viewer | null = null;
    let pickHandler: ScreenSpaceEventHandler | null = null;
    const siteEntities = new Map<string, Entity>();
    const borderEntities: Entity[] = [];
    let imageryLayer: any = null;

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
          imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
        } else if (imagerySource === 'blue-marble') {
          const provider = await SingleTileImageryProvider.fromUrl(
            'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            { rectangle: Rectangle.MAX_VALUE }
          );
          if (disposed || !viewer || viewer.isDestroyed()) return;
          imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
        } else {
          const provider = await UrlTemplateImageryProvider.fromUrl(
            'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg',
            { url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2020-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg' } as any
          );
          if (disposed || !viewer || viewer.isDestroyed()) return;
          imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
        }
      } catch (error) {
        console.warn('[NeuroPulse] Cesium Earth imagery failed; using ellipsoid globe:', error);
      }
      if (disposed || !viewer || viewer.isDestroyed()) return;

      const syncSites = () => {
        if (!viewer || viewer.isDestroyed()) return;
        const nextIds = new Set<string>();
        for (const site of sitesRef.current) {
          if (!site || !site.name || !Number.isFinite(site.lat) || !Number.isFinite(site.lon) || Math.abs(site.lat) > 90 || Math.abs(site.lon) > 180) continue;
          const id = siteId(site);
          nextIds.add(id);
          const selected = selectedRef.current && siteId(selectedRef.current) === id;
          const old = siteEntities.get(id);
          if (old) viewer.entities.remove(old);
          const entity = viewer.entities.add({
            id,
            name: site.name,
            properties: { neuroPulseSite: true, siteId: site.id ?? site.name },
            position: Cartesian3.fromDegrees(site.lon, site.lat, Math.max(0, Number(site.altitude) || 0) + (selected ? 100 : 40)),
            point: {
              pixelSize: selected ? 13 : site.isCity ? 8 : 9,
              color: Color.fromCssColorString(selected ? '#ffffff' : site.color || (site.isCity ? '#7dd3fc' : '#fbbf24')),
              outlineColor: Color.fromCssColorString(selected ? '#22d3ee' : '#07111f'),
              outlineWidth: selected ? 3 : 2,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: site.name,
              show: selected || site.isCity,
              font: selected ? 'bold 14px sans-serif' : '12px sans-serif',
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 3,
              style: 2,
              pixelOffset: new Cartesian2(0, -14),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          siteEntities.set(id, entity);
        }
        for (const [id, entity] of siteEntities) {
          if (!nextIds.has(id)) {
            viewer.entities.remove(entity);
            siteEntities.delete(id);
          }
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
        const picked = viewer.scene.drillPick(movement.position, 12);
        for (const item of picked as any[]) {
          const entity = item?.id instanceof Entity ? item.id : item?.primitive?.id instanceof Entity ? item.primitive.id : null;
          const id = entity?.id;
          if (typeof id !== 'string' || !id.startsWith('np-earth-site:')) continue;
          const site = sitesRef.current.find(candidate => siteId(candidate) === id);
          if (site) {
            callbacksRef.current.onSiteClick(site);
            return;
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
      if (pickHandler && !pickHandler.isDestroyed()) pickHandler.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, [imagerySource]);

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
    for (const [id, entity] of [...(viewer.entities.values.map(entity => [entity.id, entity]) as Array<[string, Entity]>)] ) {
      if (id.startsWith('np-earth-site:') && !existing.has(id)) viewer.entities.remove(entity);
    }
    for (const site of sites) {
      if (!site || !site.name || !Number.isFinite(site.lat) || !Number.isFinite(site.lon) || Math.abs(site.lat) > 90 || Math.abs(site.lon) > 180) continue;
      const id = siteId(site);
      const selected = selectedSite && siteId(selectedSite) === id;
      const entity = viewer.entities.getById(id);
      if (entity) viewer.entities.remove(entity);
      viewer.entities.add({
        id, name: site.name, properties: { neuroPulseSite: true, siteId: site.id ?? site.name },
        position: Cartesian3.fromDegrees(site.lon, site.lat, Math.max(0, Number(site.altitude) || 0) + (selected ? 100 : 40)),
        point: { pixelSize: selected ? 13 : site.isCity ? 8 : 9, color: Color.fromCssColorString(selected ? '#ffffff' : site.color || (site.isCity ? '#7dd3fc' : '#fbbf24')), outlineColor: Color.fromCssColorString(selected ? '#22d3ee' : '#07111f'), outlineWidth: selected ? 3 : 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: { text: site.name, show: selected || site.isCity, font: selected ? 'bold 14px sans-serif' : '12px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 3, style: 2, pixelOffset: new Cartesian2(0, -14), disableDepthTestDistance: Number.POSITIVE_INFINITY },
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

  return <div ref={hostRef} className="absolute inset-0 h-full w-full" aria-label="Cesium interactive Earth globe" />;
};
