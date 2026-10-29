import React, { useEffect, useRef, useState } from 'react';
import {
  ArcGisMapServerImageryProvider,
  ScreenSpaceEventType,
  BoundingSphere,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
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
    geometryInstances: new GeometryInstance({ geometry, attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString('#c9a66b').withAlpha(0.48)) } }),
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: true, closed: false }),
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
          setStatus(`Soil/sand surface updated to ${depth} m over ${nextPrimitives.length} local GLO-90 GeoTIFF tile(s).`);
        };

        if (cancelled) return;
        // Plot the existing NeuroPulse catalogue on the same Cesium world. Markers retain
        // their exact catalogue coordinates; names are shown on selection to avoid a label cloud.
        const validSites = siteCatalogue.filter(site =>
          site && typeof site.name === 'string' && Number.isFinite(site.lat) && Number.isFinite(site.lon) &&
          Math.abs(site.lat) <= 90 && Math.abs(site.lon) <= 180
        );
        for (const site of validSites) {
          viewer.entities.add({
            id: `neuropulse-site:${site.id ?? site.name}:${site.lat}:${site.lon}`,
            name: site.name,
            properties: { siteId: site.id ?? site.name, latitude: site.lat, longitude: site.lon, category: site.category ?? 'Research site' },
            position: Cartesian3.fromDegrees(site.lon, site.lat, 120),
            point: { pixelSize: 5, color: Color.fromCssColorString(site.color || '#57d7ff'), outlineColor: Color.BLACK.withAlpha(0.9), outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          });
        }
        const clickHandler = viewer.screenSpaceEventHandler;
        clickHandler.setInputAction((movement: { position: { x: number; y: number } }) => {
          const picked = viewer?.scene.pick(movement.position);
          const entity = picked?.id;
          const props = entity?.properties;
          const siteId = props?.siteId?.getValue?.();
          if (typeof siteId !== 'string') return;
          const match = validSites.find(site => String(site.id ?? site.name) === siteId || site.name === entity.name);
          if (match) {
            onSelectSiteRef.current?.(match);
            viewer?.camera.flyTo({
              destination: Rectangle.fromDegrees(match.lon - 0.8, Math.max(-89, match.lat - 0.6), match.lon + 0.8, Math.min(89, match.lat + 0.6)),
              duration: 0.7,
            });
          }
        }, ScreenSpaceEventType.LEFT_CLICK);
        const focus = selectedSite;
        if (focus) {
          viewer.entities.add({
            id: 'neuropulse-selected-site',
            name: focus.name,
            position: Cartesian3.fromDegrees(focus.lon, focus.lat, 180),
            point: { pixelSize: 11, color: Color.CYAN, outlineColor: Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
            label: { text: focus.name, font: '13px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 3, style: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          });
          viewer.camera.flyTo({
            destination: Rectangle.fromDegrees(focus.lon - 0.8, Math.max(-89, focus.lat - 0.6), focus.lon + 0.8, Math.min(89, focus.lat + 0.6)),
            duration: 0.8,
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
      viewer?.destroy();
      soilPrimitivesRef.current = [];
      terrainTilesRef.current = [];
      rebuildSoilRef.current = null;
      viewer = null;
      viewerRef.current = null;
    };
  }, [open, siteCatalogue]);

  useEffect(() => {
    if (soilDepth > -1) rebuildSoilRef.current?.(soilDepth);
  }, [soilDepth]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedSite) return;
    const destination = Rectangle.fromDegrees(
      Math.max(-180, selectedSite.lon - 0.08), Math.max(-89, selectedSite.lat - 0.06),
      Math.min(180, selectedSite.lon + 0.08), Math.min(89, selectedSite.lat + 0.06)
    );
    const existing = viewer.entities.getById('neuropulse-selected-site');
    if (existing) viewer.entities.remove(existing);
    viewer.entities.add({
      id: 'neuropulse-selected-site', name: selectedSite.name,
      position: Cartesian3.fromDegrees(selectedSite.lon, selectedSite.lat, 180),
      point: { pixelSize: 11, color: Color.CYAN, outlineColor: Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: { text: selectedSite.name, font: '13px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 3, style: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    });
    viewer.camera.flyTo({ destination, duration: 1.2 });
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
