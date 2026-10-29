import React, { useEffect, useRef, useState } from 'react';
import {
  ArcGisMapServerImageryProvider,
  ScreenSpaceEventType,
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
  ConstantPositionProperty,
  CesiumTerrainProvider,
  TerrainProvider,
  EllipsoidTerrainProvider,
  Ion,
  Geometry,
  GeometryAttribute,
  GeometryInstance,
  PerInstanceColorAppearance,
  Primitive,
  PrimitiveType,
  Rectangle,
  Viewer,
} from 'cesium';
import { fromUrl } from 'geotiff';
import { CONSTELLATION_EDGES, REAL_CELESTIAL_STARS } from '../data/celestialStars';
import 'cesium/Build/Cesium/Widgets/widgets.css';

type MapSite = { id?: string; name: string; lat: number; lon: number; category?: string; color?: string; desc?: string };
type Props = {
  open: boolean;
  onClose?: () => void;
  selectedSite: MapSite | null;
  siteCatalogue?: MapSite[];
  onSelectSite?: (site: MapSite) => void;
};

type DemManifest = {
  dataset: string;
  resolutionMeters: number;
  files: string[];
};

const PREVIEW_GRID_SIZE = 129;
type CachedDemTile = { west: number; south: number; east: number; north: number; raster: ArrayLike<number>; noData: number };

function sampleTileElevation(site: MapSite, tiles: CachedDemTile[]): number {
  const tile = tiles.find(item => site.lon >= item.west && site.lon <= item.east && site.lat >= item.south && site.lat <= item.north);
  if (!tile) return 0;
  const x = Math.max(0, Math.min(PREVIEW_GRID_SIZE - 1, Math.round(((site.lon - tile.west) / (tile.east - tile.west)) * (PREVIEW_GRID_SIZE - 1))));
  const y = Math.max(0, Math.min(PREVIEW_GRID_SIZE - 1, Math.round(((tile.north - site.lat) / (tile.north - tile.south)) * (PREVIEW_GRID_SIZE - 1))));
  const value = Number(tile.raster[y * PREVIEW_GRID_SIZE + x]);
  return Number.isFinite(value) && (!Number.isFinite(tile.noData) || value !== tile.noData) ? value : 0;
}

function buildSoilPrimitive(tile: CachedDemTile, soilDepth: number): Primitive {
  const count = PREVIEW_GRID_SIZE * PREVIEW_GRID_SIZE;
  const positions = new Float64Array(count * 3);
  const indexValues: number[] = [];
  const validMask = new Uint8Array(count);
  let validVertices = 0;
  for (let y = 0; y < PREVIEW_GRID_SIZE; y++) {
    const latitude = tile.north - (y / (PREVIEW_GRID_SIZE - 1)) * (tile.north - tile.south);
    for (let x = 0; x < PREVIEW_GRID_SIZE; x++) {
      const index = y * PREVIEW_GRID_SIZE + x;
      const longitude = tile.west + (x / (PREVIEW_GRID_SIZE - 1)) * (tile.east - tile.west);
      const elevation = Number(tile.raster[index]);
      const valid = Number.isFinite(elevation) && (!Number.isFinite(tile.noData) || elevation !== tile.noData);
      if (valid) { validMask[index] = 1; validVertices++; }
      const point = Cartesian3.fromDegrees(longitude, latitude, valid ? elevation + soilDepth : 0);
      positions[index * 3] = point.x; positions[index * 3 + 1] = point.y; positions[index * 3 + 2] = point.z;
    }
  }
  if (validVertices < count * 0.9) throw new Error('Too many invalid elevation samples in a cached DEM tile.');
  for (let y = 0; y < PREVIEW_GRID_SIZE - 1; y++) for (let x = 0; x < PREVIEW_GRID_SIZE - 1; x++) {
    const a = y * PREVIEW_GRID_SIZE + x, b = a + 1, c = a + PREVIEW_GRID_SIZE, d = c + 1;
    if (validMask[a] && validMask[b] && validMask[c] && validMask[d]) indexValues.push(a, c, b, b, c, d);
  }
  const geometry = new Geometry({
    attributes: { position: new GeometryAttribute({ componentDatatype: ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values: positions }) } as never,
    indices: Uint32Array.from(indexValues), primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: BoundingSphere.fromVertices(positions),
  });
  return new Primitive({
    geometryInstances: new GeometryInstance({ geometry, attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString('#d9ad68').withAlpha(0.82)) } }),
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: true, closed: false, faceForward: true }),
    asynchronous: false, allowPicking: false,
  });
}


function safeTileUrl(filename: string): string {
  const normalized = filename.replace(/\\\\/g, '/').replace(/^\/+/, '');
  if (normalized.split('/').some(part => part === '..')) throw new Error('Invalid path in Copernicus DEM manifest.');
  return `/copernicus-dem/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

export const CesiumCopernicusPreview: React.FC<Props> = ({ open, onClose, selectedSite, siteCatalogue = [], onSelectSite }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [status, setStatus] = useState('Waiting for local Copernicus DEM tiles…');
  const [error, setError] = useState('');
  const [soilDepth, setSoilDepth] = useState(39);
  const [soilDepthDraft, setSoilDepthDraft] = useState(39);
  const [showSoilLayer, setShowSoilLayer] = useState(true);
  const [showSatellite, setShowSatellite] = useState(true);
  const soilPrimitivesRef = useRef<Primitive[]>([]);
  const terrainTilesRef = useRef<CachedDemTile[]>([]);
  const rebuildSoilRef = useRef<((depth: number) => void) | null>(null);
  const showSoilLayerRef = useRef(showSoilLayer);
  showSoilLayerRef.current = showSoilLayer;
  const showSatelliteRef = useRef(showSatellite);
  showSatelliteRef.current = showSatellite;
  const onSelectSiteRef = useRef(onSelectSite);
  onSelectSiteRef.current = onSelectSite;
  const siteCatalogueRef = useRef(siteCatalogue);
  siteCatalogueRef.current = siteCatalogue;
  const selectedSiteRef = useRef(selectedSite);
  selectedSiteRef.current = selectedSite;
  const overlayFlagsRef = useRef({ triangulation: false, constellations: false, angles: false });

  useEffect(() => {
    if (!open || !hostRef.current) return;
    let cancelled = false;
    let viewer: Viewer | null = null;
    const primitives: Primitive[] = [];

    const start = async () => {
      try {
        setError('');
        setStatus('Checking Cesium ion configuration…');
        const ionToken = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN?.trim();
        let terrainProvider: TerrainProvider = new EllipsoidTerrainProvider();

        if (ionToken) {
          Ion.defaultAccessToken = ionToken;
          try {
            terrainProvider = await CesiumTerrainProvider.fromIonAssetId(1);
            if (cancelled) return;
            setStatus('Cesium ion token accepted; initializing terrain and imagery…');
          } catch {
            // Do not expose token details. Keep the local DEM preview usable if ion access fails.
            if (cancelled) return;
            setStatus('Cesium ion terrain unavailable; continuing with ellipsoid terrain and local DEM data…');
          }
        } else {
          setStatus('No Cesium ion token found; using ellipsoid terrain and local DEM data.');
        }

        if (cancelled) return;
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
          terrainProvider,
          baseLayer: false,
          requestRenderMode: true,
        });
        viewerRef.current = viewer;
        const imagery = await ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        );
        if (cancelled) return;
        const imageryLayer = viewer.imageryLayers.addImageryProvider(imagery);
        imageryLayer.show = showSatelliteRef.current;

        const manifestResponse = await fetch('/copernicus-dem/manifest.json', { cache: 'no-store' });
        if (!manifestResponse.ok) {
          throw new Error('No local Copernicus DEM manifest was found. Run scripts/prepare-copernicus-dem.R first.');
        }
        const manifest = await manifestResponse.json() as DemManifest;
        if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
          throw new Error('The Copernicus DEM manifest contains no GeoTIFF tiles.');
        }

        let loaded = 0;
        terrainTilesRef.current = [];
        for (const filename of manifest.files) {
          if (cancelled) return;
          setStatus(`Reading measured ${manifest.dataset} tile ${loaded + 1} of ${manifest.files.length}…`);
          const tiff = await fromUrl(safeTileUrl(filename));
          const image = await tiff.getImage();
          const bbox = image.getBoundingBox();
          if (bbox.length !== 4 || !bbox.every(Number.isFinite)) {
            throw new Error(`Invalid geographic bounds in DEM tile: ${filename}`);
          }
          const west = bbox[0], south = bbox[1], east = bbox[2], north = bbox[3];
          const raster = await image.readRasters({
            width: PREVIEW_GRID_SIZE,
            height: PREVIEW_GRID_SIZE,
            interleave: true,
          }) as unknown as ArrayLike<number>;
          const count = PREVIEW_GRID_SIZE * PREVIEW_GRID_SIZE;
          if (raster.length !== count) throw new Error(`Incomplete elevation raster: ${filename}`);

          const rawNoData = typeof image.getGDALNoData === 'function' ? image.getGDALNoData() : undefined;
          const noData = rawNoData === null || rawNoData === undefined ? NaN : Number(rawNoData);
          const cachedTile: CachedDemTile = { west, south, east, north, raster, noData };
          terrainTilesRef.current.push(cachedTile);
          const primitive = buildSoilPrimitive(cachedTile, soilDepth);
          primitive.show = showSoilLayerRef.current;
          viewer.scene.primitives.add(primitive);
          primitives.push(primitive);
          soilPrimitivesRef.current = primitives;
          loaded++;
        }
        rebuildSoilRef.current = (depth: number) => {
          const activeViewer = viewerRef.current;
          if (!activeViewer || activeViewer.isDestroyed()) return;
          try {
            for (const oldPrimitive of soilPrimitivesRef.current) {
              if (!oldPrimitive.isDestroyed()) activeViewer.scene.primitives.remove(oldPrimitive);
            }
            const nextPrimitives: Primitive[] = [];
            for (const tile of terrainTilesRef.current) {
              const next = buildSoilPrimitive(tile, depth);
              next.show = showSoilLayerRef.current;
              activeViewer.scene.primitives.add(next);
              nextPrimitives.push(next);
            }
            soilPrimitivesRef.current = nextPrimitives;
            for (const site of siteCatalogueRef.current) {
              const entity = activeViewer.entities.getById(`neuropulse-site:${site.id ?? site.name}:${site.lat}:${site.lon}`);
              if (entity) entity.position = new ConstantPositionProperty(Cartesian3.fromDegrees(
                site.lon, site.lat, sampleTileElevation(site, terrainTilesRef.current) + (showSoilLayerRef.current ? depth : 0) + 250
              ));
            }
            const selected = selectedSiteRef.current;
            const selectedEntity = activeViewer.entities.getById('neuropulse-selected-site');
            if (selected && selectedEntity) selectedEntity.position = new ConstantPositionProperty(Cartesian3.fromDegrees(
              selected.lon, selected.lat, sampleTileElevation(selected, terrainTilesRef.current) + (showSoilLayerRef.current ? depth : 0) + 300
            ));
            drawGeometryOverlays();
            activeViewer.scene.requestRender();
            setStatus(`Visible sand/soil cover surface applied: +${depth} m across ${nextPrimitives.length} local GLO-90 tile(s). This is an offset surface scenario, not measured soil thickness.`);
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Unknown terrain mesh error.';
            setError(`Could not rebuild the soil/sand surface: ${message}`);
            setStatus('Soil/sand update failed; the existing globe remains available.');
          }
        };

        if (cancelled) return;
        // Plot every valid NeuroPulse site at its catalogue coordinates. Site labels stay visible;
        // their height is offset above the local DEM and the adjustable sand surface.
        const validSites = siteCatalogueRef.current.filter(site =>
          site && typeof site.name === 'string' && Number.isFinite(site.lat) && Number.isFinite(site.lon) &&
          Math.abs(site.lat) <= 90 && Math.abs(site.lon) <= 180
        );
        for (const site of validSites) {
          viewer.entities.add({
            id: `neuropulse-site:${site.id ?? site.name}:${site.lat}:${site.lon}`,
            name: site.name,
            properties: { siteId: site.id ?? site.name, latitude: site.lat, longitude: site.lon, category: site.category ?? 'Research site' },
            position: Cartesian3.fromDegrees(site.lon, site.lat, sampleTileElevation(site, terrainTilesRef.current) + (showSoilLayerRef.current ? soilDepth : 0) + 250),
            point: { pixelSize: 9, color: Color.fromCssColorString(site.color || '#57d7ff'), outlineColor: Color.WHITE.withAlpha(0.95), outlineWidth: 2 },
            label: {
              text: site.name,
              show: true,
              font: '14px sans-serif',
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 3,
              style: 2,
              pixelOffset: new Cartesian2(0, -16),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
        }
        const overlayEntities = new Set<string>();
        const clearOverlayEntities = () => {
          for (const id of overlayEntities) {
            const existing = viewer?.entities.getById(id);
            if (existing) viewer?.entities.remove(existing);
          }
          overlayEntities.clear();
        };
        const addOverlayEntity = (entity: Parameters<typeof viewer.entities.add>[0]) => {
          const added = viewer!.entities.add(entity);
          overlayEntities.add(added.id);
          return added;
        };
        const drawGeometryOverlays = () => {
          if (!viewer || viewer.isDestroyed()) return;
          clearOverlayEntities();
          const flags = overlayFlagsRef.current;
          const valid = siteCatalogueRef.current.filter(site => site && Number.isFinite(site.lat) && Number.isFinite(site.lon) && Math.abs(site.lat) <= 90 && Math.abs(site.lon) <= 180);
          if (flags.triangulation || flags.angles) {
            // Local nearest-neighbour triangles avoid an unbounded all-combinations mesh.
            const seen = new Set<string>();
            const triangles: [MapSite, MapSite, MapSite][] = [];
            const distance = (a: MapSite, b: MapSite) => {
              const rad = Math.PI / 180, dLat = (b.lat-a.lat)*rad, dLon = (b.lon-a.lon)*rad;
              const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
              return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0,1-h)));
            };
            for (const a of valid) {
              const nearest = valid.filter(b => b !== a).map(b => ({ site:b, d:distance(a,b) })).sort((x,y)=>x.d-y.d).slice(0,2).map(x=>x.site);
              if (nearest.length !== 2) continue;
              const tri: [MapSite,MapSite,MapSite] = [a,nearest[0],nearest[1]];
              const key = tri.map(s => `${s.id ?? s.name}:${s.lat.toFixed(5)}:${s.lon.toFixed(5)}`).sort().join('|');
              if (!seen.has(key)) { seen.add(key); triangles.push(tri); }
            }
            const surfacePosition = (site: MapSite) => Cartesian3.fromDegrees(
              site.lon, site.lat, sampleTileElevation(site, terrainTilesRef.current) + (showSoilLayerRef.current ? soilDepth : 0) + 350
            );
            triangles.forEach((tri, ti) => {
              const points = tri.map(surfacePosition);
              if (flags.triangulation) addOverlayEntity({
                id: `neuro-triangle-${ti}`,
                polyline: { positions: [...points, points[0]], width: 2, material: Color.fromCssColorString('#29e8ff'), arcType: 1, clampToGround: false }
              });
              if (flags.angles) {
                // Calculate interior angles in a local tangent plane from the actual site coordinates.
                const lat0 = tri.reduce((sum,s)=>sum+s.lat,0)/3 * Math.PI/180;
                const xy = tri.map(s => ({ x: s.lon*Math.PI/180*Math.cos(lat0)*6371000, y: s.lat*Math.PI/180*6371000 }));
                const angleAt = (p: {x:number;y:number}, q: {x:number;y:number}, r: {x:number;y:number}) => {
                  const u={x:q.x-p.x,y:q.y-p.y}, v={x:r.x-p.x,y:r.y-p.y};
                  const den=Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y);
                  return den ? Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y)/den)))*180/Math.PI : 0;
                };
                const angles = [angleAt(xy[0],xy[1],xy[2]),angleAt(xy[1],xy[0],xy[2]),angleAt(xy[2],xy[0],xy[1])];
                tri.forEach((site, vi) => addOverlayEntity({
                  id: `neuro-angle-${ti}-${vi}`,
                  position: Cartesian3.fromDegrees(site.lon,site.lat,sampleTileElevation(site,terrainTilesRef.current)+(showSoilLayerRef.current?soilDepth:0)+500),
                  label: { text: `${angles[vi].toFixed(1)}°`, font: '13px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 3, style: 2, disableDepthTestDistance: 0, showBackground: true, backgroundColor: Color.fromCssColorString('#061421').withAlpha(0.85) }
                }));
              }
            });
          }
          if (flags.constellations) {
            const stars = new Map(REAL_CELESTIAL_STARS.map(star => [star.id, star]));
            const radius = 9000000; // celestial reference sphere outside the Earth surface, not geographic site data
            const starPosition = (star: typeof REAL_CELESTIAL_STARS[number]) => {
              const ra = star.raHours * 15 * Math.PI / 180, dec = star.decDeg * Math.PI / 180;
              return new Cartesian3(radius * Math.cos(dec) * Math.cos(ra), radius * Math.cos(dec) * Math.sin(ra), radius * Math.sin(dec));
            };
            for (const [fromId,toId] of CONSTELLATION_EDGES) {
              const a=stars.get(fromId), b=stars.get(toId);
              if (!a || !b) continue;
              addOverlayEntity({
                id: `neuro-constellation-${fromId}-${toId}`,
                polyline: { positions: [starPosition(a),starPosition(b)], width: 2, material: Color.fromCssColorString('#a78bfa').withAlpha(0.9), arcType: 0, clampToGround: false }
              });
              addOverlayEntity({
                id: `neuro-constellation-star-${fromId}`,
                position: starPosition(a),
                point: { pixelSize: 5, color: Color.fromCssColorString(a.color), outlineColor: Color.WHITE, outlineWidth: 1 },
                label: { text: a.name, font: '11px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 2, style: 2, disableDepthTestDistance: 0 }
              });
              addOverlayEntity({
                id: `neuro-constellation-star-${toId}`,
                position: starPosition(b),
                point: { pixelSize: 5, color: Color.fromCssColorString(b.color), outlineColor: Color.WHITE, outlineWidth: 1 },
                label: { text: b.name, font: '11px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 2, style: 2, disableDepthTestDistance: 0 }
              });
            }
          }
          viewer.scene.requestRender();
        };
        const elevationToolHandler = (event: Event) => {
          const detail = (event as CustomEvent<{action?: string}>).detail;
          if (!detail?.action) return;
          if (detail.action === 'clear') overlayFlagsRef.current = { triangulation: false, constellations: false, angles: false };
          else if (detail.action === 'triangulate') overlayFlagsRef.current.triangulation = !overlayFlagsRef.current.triangulation;
          else if (detail.action === 'constellations') overlayFlagsRef.current.constellations = !overlayFlagsRef.current.constellations;
          else if (detail.action === 'angles') overlayFlagsRef.current.angles = !overlayFlagsRef.current.angles;
          else if (detail.action === 'water-level' || detail.action === 'water-opacity' || detail.action === 'screenshot') return;
          drawGeometryOverlays();
        };
        window.addEventListener('neuro-pulse-elevation-tool', elevationToolHandler);
        const clickHandler = viewer.screenSpaceEventHandler;
        const siteEntityFromPick = (position: { x: number; y: number }) => {
          const pickedItems = viewer?.scene.drillPick(position, 12) ?? [];
          const picked = pickedItems.find((item: any) => {
            const id = item?.id?.id ?? item?.id;
            return typeof id === 'string' && id.startsWith('neuropulse-site:');
          }) ?? viewer?.scene.pick(position);
          const entity = picked?.id;
          const props = entity?.properties;
          const siteId = props?.siteId?.getValue?.();
          const match = validSites.find(site =>
            (typeof siteId === 'string' && String(site.id ?? site.name) === siteId) ||
            (entity?.name && site.name === entity.name)
          );
          return match ? { match, entity } : null;
        };
        // Site names remain visible at all times; hover only changes the cursor.
        clickHandler.setInputAction((movement: { endPosition: { x: number; y: number } }) => {
          const result = siteEntityFromPick(movement.endPosition);
          if (viewer?.canvas) viewer.canvas.style.cursor = result ? 'pointer' : 'default';
        }, ScreenSpaceEventType.MOUSE_MOVE);
        clickHandler.setInputAction((movement: { position: { x: number; y: number } }) => {
          const result = siteEntityFromPick(movement.position);
          if (!result) return;
          const { match } = result;
          onSelectSiteRef.current?.(match);
          // Keep a close, overhead view centred on the exact site coordinate.
          viewer?.camera.flyTo({
            destination: Cartesian3.fromDegrees(match.lon, match.lat, 9000),
            orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
            duration: 1,
          });
        }, ScreenSpaceEventType.LEFT_CLICK);
        const focus = selectedSite;
        if (focus) {
          viewer.entities.add({
            id: 'neuropulse-selected-site',
            name: focus.name,
            position: Cartesian3.fromDegrees(focus.lon, focus.lat, sampleTileElevation(focus, terrainTilesRef.current) + (showSoilLayerRef.current ? soilDepth : 0) + 300),
            point: { pixelSize: 12, color: Color.CYAN, outlineColor: Color.WHITE, outlineWidth: 2 },
            label: { text: focus.name, font: '14px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 3, style: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          });
          viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(focus.lon, focus.lat, 9000),
            orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
            duration: 1,
          });
        } else {
          viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 22000000) });
        }
        setStatus(`Rendered ${loaded} real GeoTIFF tile(s) from ${manifest.dataset} at ${manifest.resolutionMeters} m source resolution. Mesh is resampled to ${PREVIEW_GRID_SIZE}×${PREVIEW_GRID_SIZE} vertices per tile for interactive display.`);
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : 'Unable to initialize Cesium Copernicus terrain preview.';
          setError(message);
          setStatus('Cesium terrain preview unavailable.');
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      for (const primitive of primitives) {
        try { primitive.destroy(); } catch { /* Cesium may already have destroyed it with the viewer. */ }
      }
      window.removeEventListener('neuro-pulse-elevation-tool', elevationToolHandler);
      viewer?.destroy();
      soilPrimitivesRef.current = [];
      terrainTilesRef.current = [];
      rebuildSoilRef.current = null;
      viewer = null;
      viewerRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (soilDepth > -1) rebuildSoilRef.current?.(soilDepth);
  }, [soilDepth]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedSite) return;
    const destination = Cartesian3.fromDegrees(selectedSite.lon, selectedSite.lat, 9000);
    const existing = viewer.entities.getById('neuropulse-selected-site');
    if (existing) viewer.entities.remove(existing);
    viewer.entities.add({
      id: 'neuropulse-selected-site', name: selectedSite.name,
      position: Cartesian3.fromDegrees(selectedSite.lon, selectedSite.lat, sampleTileElevation(selectedSite, terrainTilesRef.current) + (showSoilLayer ? soilDepth : 0) + 300),
      point: { pixelSize: 12, color: Color.CYAN, outlineColor: Color.WHITE, outlineWidth: 2 },
      label: { text: selectedSite.name, font: '14px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 3, style: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    });
    viewer.camera.flyTo({ destination, orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 }, duration: 1 });
  }, [selectedSite?.id, selectedSite?.name, selectedSite?.lat, selectedSite?.lon]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const layer = viewer.imageryLayers.length ? viewer.imageryLayers.get(0) : null;
    if (layer) layer.show = showSatellite;
  }, [showSatellite]);

  useEffect(() => {
    for (const primitive of soilPrimitivesRef.current) {
      if (!primitive.isDestroyed()) primitive.show = showSoilLayer;
    }
  }, [showSoilLayer]);

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-slate-950/95 p-2" role="region" aria-label="Cesium world with GLO-90 soil and sand layer">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-mono font-bold tracking-wider text-sky-200">CESIUMJS · GLO-90 GEOtiff + SOIL / SAND LAYER</div>
          <div className="mt-1 text-xs text-slate-300">{status}</div>
          {error && <div className="mt-2 max-w-4xl text-xs text-rose-300">{error}</div>}
        </div>
        {onClose && <button onClick={onClose} className="shrink-0 rounded border border-slate-600 px-3 py-2 text-xs font-mono text-slate-100 hover:bg-slate-800">BACK TO EARTH</button>}
      </div>
      <div className="mb-2 grid shrink-0 gap-2 rounded border border-slate-700 bg-slate-900/90 p-2 lg:grid-cols-[minmax(240px,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3"><label htmlFor="glo90-soil-depth" className="text-[10px] font-mono font-bold text-amber-100">SOIL / SAND COVER SCENARIO · {soilDepthDraft} m</label><span className="text-[9px] text-slate-400">0–100 m</span></div>
          <input id="glo90-soil-depth" aria-label="Soil or sand cover depth scenario in metres" type="range" min="0" max="100" step="1" value={soilDepthDraft} onChange={event => setSoilDepthDraft(Number(event.target.value))} className="mt-2 w-full accent-amber-400" />
          <div className="flex justify-between text-[9px] text-slate-500"><span>0 m · measured DEM surface</span><span>39 m · Giza reference assumption</span><span>100 m</span></div>
          <div className="mt-1 text-[9px] text-slate-400">The GLO-90 GeoTIFF provides ground elevation, not soil thickness. This slider adds a visible cover-depth scenario; 39 m is your Giza assumption and is not represented as globally measured soil data.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button type="button" onClick={() => setShowSatellite(value => !value)} aria-pressed={showSatellite} className={`rounded border px-3 py-2 text-[10px] font-mono font-bold ${showSatellite ? 'border-cyan-300 bg-cyan-950 text-cyan-100' : 'border-slate-600 text-slate-300'}`}>{showSatellite ? 'SATELLITE ON' : 'SATELLITE OFF'}</button>
          <button type="button" onClick={() => setShowSoilLayer(value => !value)} aria-pressed={showSoilLayer} className={`rounded border px-3 py-2 text-[10px] font-mono font-bold ${showSoilLayer ? 'border-amber-300 bg-amber-950 text-amber-100' : 'border-slate-600 text-slate-300'}`}>{showSoilLayer ? 'SOIL LAYER ON' : 'SOIL LAYER OFF'}</button>
          <button type="button" onClick={() => { setSoilDepthDraft(0); setSoilDepth(0); }} className="rounded border border-slate-600 px-3 py-2 text-[10px] font-mono text-slate-200 hover:bg-slate-800">RESET TO DEM</button>
          <button type="button" onClick={() => setSoilDepth(soilDepthDraft)} disabled={soilDepth === soilDepthDraft} className="rounded border border-emerald-400/70 bg-emerald-950/70 px-3 py-2 text-[10px] font-mono font-bold text-emerald-100 disabled:opacity-40">APPLY DEPTH</button>
        </div>
      </div>
      <div ref={hostRef} className="min-h-[220px] flex-1 overflow-hidden rounded border border-slate-700" />
      <div className="shrink-0 pt-1 text-[9px] text-slate-500">GLO-90 source elevations are retained as the ground reference; the displayed mesh is resampled to 129×129 vertices per tile. Satellite imagery is from Esri and its providers. Soil/sand thickness is an adjustable scenario, not a measured global dataset.</div>
    </div>
  );
};
