import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fromBlob } from 'geotiff';
import { ArrowLeft, LoaderCircle, Waves, Mountain, Database, RotateCcw } from 'lucide-react';

type Site = { name: string; lat: number; lon: number } | null;
type CatalogueSite = { name: string; lat: number; lon: number; category?: string; color?: string };
type Props = { selectedSite: Site; siteCatalogue: CatalogueSite[]; onBack: () => void };

const NOAA_DEM_URL = 'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/exportImage?bbox=-180,-90,180,90&bboxSR=4326&size=720,360&imageSR=4326&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image';
const NOAA_SOURCE = 'https://www.ncei.noaa.gov/products/etopo-global-relief-model';
const BASE_RADIUS = 100;
const HEIGHT_SCALE = 0.0015;
const HISTORY: Array<[number, number]> = [
  [-12000, -110], [-11000, -90], [-10000, -60], [-9000, -38],
  [-8000, -22], [-7000, -12], [-6000, -6], [-5000, -3],
  [-4000, -1.5], [-3000, -0.5], [-2000, 0], [0, 0], [1000, 0],
];

function estimatedHistoricalLevel(yearOffset: number): number {
  if (yearOffset <= HISTORY[0][0]) return HISTORY[0][1];
  for (let i = 1; i < HISTORY.length; i++) {
    const [year, level] = HISTORY[i];
    const [prevYear, prevLevel] = HISTORY[i - 1];
    if (yearOffset <= year) {
      const t = (yearOffset - prevYear) / (year - prevYear);
      return Math.round((prevLevel + (level - prevLevel) * t) * 10) / 10;
    }
  }
  return 0;
}

function elevationColor(height: number): THREE.Color {
  if (height < -4000) return new THREE.Color('#123a76').lerp(new THREE.Color('#287ea7'), Math.min(1, (height + 11000) / 7000));
  if (height < 0) return new THREE.Color('#287ea7').lerp(new THREE.Color('#65b7bd'), (height + 4000) / 4000);
  if (height < 1800) return new THREE.Color('#39764b').lerp(new THREE.Color('#a7a66b'), height / 1800);
  if (height < 4500) return new THREE.Color('#a7a66b').lerp(new THREE.Color('#887d75'), (height - 1800) / 2700);
  return new THREE.Color('#887d75').lerp(new THREE.Color('#f0eee9'), Math.min(1, (height - 4500) / 4000));
}

export const EarthElevation: React.FC<Props> = ({ selectedSite, siteCatalogue, onBack }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; earth: THREE.Group; water: THREE.Mesh; marker: THREE.Mesh | null; sitePoints: THREE.Group; geometry: THREE.BufferGeometry; heights: Float32Array; width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [yearOffset, setYearOffset] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [levelMode, setLevelMode] = useState<'historical' | 'custom'>('historical');
  const [terrainScale, setTerrainScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [datasetInfo, setDatasetInfo] = useState('Connecting to NOAA elevation service…');
  // Keep the latest slider values available to the asynchronous NOAA scene initializer.
  // Otherwise a slider move during loading can be overwritten by stale initial values.
  const seaLevelRef = useRef(seaLevel);
  const terrainScaleRef = useRef(terrainScale);
  seaLevelRef.current = seaLevel;
  terrainScaleRef.current = terrainScale;

  useEffect(() => {
    let cancelled = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let earthGroup: THREE.Group | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let water: THREE.Mesh | null = null;
    let marker: THREE.Mesh | null = null;
    let sitePoints: THREE.Group | null = null;
    let markerBuildFrame = 0;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let buildMarkers: (() => void) | null = null;
    let ledAtlasReady = false;
    const retroLedAtlas = new THREE.TextureLoader().load(
      new URL('../../Retro LED Tilesheet and Neon Earth Globe.png', import.meta.url).href,
      () => { ledAtlasReady = true; buildMarkers?.(); }
    );
    retroLedAtlas.colorSpace = THREE.SRGBColorSpace;
    retroLedAtlas.magFilter = THREE.NearestFilter;
    retroLedAtlas.minFilter = THREE.LinearMipmapLinearFilter;
    let heights = new Float32Array(0);
    let gridWidth = 0;
    let gridHeight = 0;
    let dragPointer: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const init = async () => {
      try {
        setLoading(true);
        setLoadError('');
        setDatasetInfo('Requesting real elevation values from NOAA NCEI…');
        // Read the export as a complete response. Some ArcGIS configurations do not
        // support the byte-range requests used by GeoTIFF's URL reader.
        const response = await fetch(NOAA_DEM_URL, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`NOAA elevation request failed (HTTP ${response.status}). Check NOAA service/network access and retry.`);
        const contentType = response.headers.get('content-type') || '';
        if (/json|html|xml/i.test(contentType)) {
          const detail = (await response.text()).slice(0, 240).replace(/\\s+/g, ' ');
          throw new Error(`NOAA returned a service message instead of a GeoTIFF: ${detail || contentType}`);
        }
        const rasterBlob = await response.blob();
        if (rasterBlob.size < 1024) throw new Error('NOAA returned an empty or incomplete elevation raster.');
        const tiff = await fromBlob(rasterBlob);
        if (cancelled) return;
        const image = await tiff.getImage();
        const raster = await image.readRasters({ width: 720, height: 360, interleave: true });
        if (cancelled) return;
        const values = raster as unknown as Float32Array;
        gridWidth = 720;
        gridHeight = 360;
        heights = new Float32Array(gridWidth * gridHeight);
        let validCount = 0;
        for (let i = 0; i < heights.length; i++) {
          const value = Number(values[i]);
          heights[i] = Number.isFinite(value) ? value : 0;
          if (Number.isFinite(value)) validCount++;
        }
        if (validCount < heights.length * 0.5) throw new Error('NOAA returned too few valid elevation samples.');

        const host = hostRef.current;
        if (!host) return;
        scene = new THREE.Scene();
        scene.background = new THREE.Color('#030814');
        camera = new THREE.PerspectiveCamera(42, Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight), 0.1, 1000);
        camera.position.set(0, 0, 250);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.replaceChildren(renderer.domElement);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';

        scene.add(new THREE.AmbientLight(0xffffff, 1.25));
        const sun = new THREE.DirectionalLight(0xffffff, 2.0);
        sun.position.set(-120, 100, 180);
        scene.add(sun);
        earthGroup = new THREE.Group();
        scene.add(earthGroup);

        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        for (let y = 0; y < gridHeight; y++) {
          const lat = (90 - (y / (gridHeight - 1)) * 180) * Math.PI / 180;
          for (let x = 0; x < gridWidth; x++) {
            const lon = ((x / (gridWidth - 1)) * 360 - 180) * Math.PI / 180;
            const elevation = heights[y * gridWidth + x];
            // Flood any terrain below the selected water datum: those vertices sit at
            // the water surface and turn ocean blue, so the slider changes the globe itself.
            const activeSeaLevel = seaLevelRef.current;
            const activeTerrainScale = terrainScaleRef.current;
            const submerged = elevation < activeSeaLevel;
            const visibleHeight = submerged ? activeSeaLevel : elevation;
            const radius = BASE_RADIUS + visibleHeight * HEIGHT_SCALE * activeTerrainScale;
            positions.push(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
            const color = submerged ? new THREE.Color('#168bd2') : elevationColor(elevation);
            colors.push(color.r, color.g, color.b);
          }
        }
        for (let y = 0; y < gridHeight - 1; y++) {
          for (let x = 0; x < gridWidth - 1; x++) {
            const a = y * gridWidth + x;
            const b = a + 1;
            const c = a + gridWidth;
            const d = c + 1;
            indices.push(a, b, c, b, d, c);
          }
        }
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 }));
        terrain.renderOrder = 1;
        earthGroup.add(terrain);

        const sitePoints = new THREE.Group();
        // Attach an empty marker layer immediately. LED atlas decoding and marker
        // creation happen after the globe is already visible, in small frame batches.
        earthGroup.add(sitePoints);

        water = new THREE.Mesh(
          new THREE.SphereGeometry(BASE_RADIUS + seaLevelRef.current * HEIGHT_SCALE * terrainScaleRef.current, 128, 64),
          new THREE.MeshStandardMaterial({ color: '#168bd2', transparent: true, opacity: 0.58, roughness: 0.28, metalness: 0.08, depthWrite: false, side: THREE.DoubleSide })
        );
        water.renderOrder = 2;
        earthGroup.add(water);

        marker = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff5263' }));
        marker.visible = false;
        earthGroup.add(marker);

        sceneRef.current = { renderer, scene, camera, earth: earthGroup, water, marker, sitePoints, geometry, heights, width: gridWidth, height: gridHeight };

        buildMarkers = () => {
          let index = 0;
          const buildBatch = () => {
            if (cancelled || !sitePoints || !earthGroup) return;
            const stop = Math.min(index + 120, siteCatalogue.length);
            for (; index < stop; index++) {
              const site = siteCatalogue[index];
              if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon)) continue;
              const sx = Math.max(0, Math.min(gridWidth - 1, Math.round(((site.lon + 180) / 360) * (gridWidth - 1))));
              const sy = Math.max(0, Math.min(gridHeight - 1, Math.round(((90 - site.lat) / 180) * (gridHeight - 1))));
              const elevation = heights[sy * gridWidth + sx] || 0;
              const lat = site.lat * Math.PI / 180;
              const lon = site.lon * Math.PI / 180;
              const radius = BASE_RADIUS + Math.max(elevation, seaLevelRef.current) * HEIGHT_SCALE * terrainScaleRef.current + 0.8;
              const raw = String(site.color || '').toLowerCase();
              const row = /orange|fb923c|f97316|red|ef4444|f87171/.test(raw) ? 0
                : /yellow|gold|facc15|fbbf24/.test(raw) ? 1
                : /blue|sky|60a5fa|38bdf8/.test(raw) || /city/i.test(site.category || '') ? 2
                : /green|34d399|10b981|22c55e/.test(raw) ? 3
                : /purple|violet|a78bfa|f472b6|fuchsia/.test(raw) ? 4 : 1;
              const tileTexture = retroLedAtlas.clone();
              tileTexture.repeat.set(0.5, 0.1);
              tileTexture.offset.set(0, (9 - row * 2) * 0.1);
              tileTexture.needsUpdate = true;
              const spriteMaterial = new THREE.SpriteMaterial({ map: tileTexture, transparent: true, alphaTest: 0.04, depthWrite: false });
              const sprite = new THREE.Sprite(spriteMaterial);
              sprite.userData.isRetroLedSprite = true;
              sprite.userData.ledTexture = tileTexture;
              sprite.userData.ledColorIndex = row;
              sprite.userData.ledPhase = Math.abs(Number(site.lat) * 13 + Number(site.lon) * 7) % 6.28;
              sprite.scale.set(2.8, 2.8, 1);
              sprite.position.set(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
              sitePoints.add(sprite);
            }
            if (index < siteCatalogue.length) markerBuildFrame = window.requestAnimationFrame(buildBatch);
          };
          markerBuildFrame = window.requestAnimationFrame(buildBatch);
        };
        // If the atlas loaded while NOAA was still downloading, start markers now.
        if (ledAtlasReady) buildMarkers();
        const onPointerDown = (event: PointerEvent) => { dragPointer = event.pointerId; lastX = event.clientX; lastY = event.clientY; renderer?.domElement.setPointerCapture(event.pointerId); };
        const onPointerMove = (event: PointerEvent) => {
          if (dragPointer !== event.pointerId || !earthGroup) return;
          earthGroup.rotation.y += (event.clientX - lastX) * 0.006;
          earthGroup.rotation.x = Math.max(-1.4, Math.min(1.4, earthGroup.rotation.x + (event.clientY - lastY) * 0.006));
          lastX = event.clientX; lastY = event.clientY;
        };
        const onPointerUp = (event: PointerEvent) => { dragPointer = null; try { renderer?.domElement.releasePointerCapture(event.pointerId); } catch { /* ignore */ } };
        const onWheel = (event: WheelEvent) => { event.preventDefault(); setZoom(current => Math.max(0.7, Math.min(2.2, current - Math.sign(event.deltaY) * 0.08))); };
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointercancel', onPointerUp);
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

        resizeObserver = new ResizeObserver(() => {
          if (!host || !renderer || !camera) return;
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        });
        resizeObserver.observe(host);
        const animate = () => {
          if (cancelled || !renderer || !scene || !camera) return;
          renderer.render(scene, camera);
          animationFrame = window.requestAnimationFrame(animate);
        };
        animate();
        setDatasetInfo('NOAA global elevation samples loaded · land and ocean floor are both height-mapped.');
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('NOAA Earth elevation load failed:', error);
        setLoadError(error instanceof Error ? error.message : 'Unable to load NOAA elevation data.');
        setDatasetInfo('NOAA elevation service did not return a usable height raster.');
        setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(markerBuildFrame);
      resizeObserver?.disconnect();
      if (sceneRef.current) {
        sceneRef.current.geometry.dispose();
        (sceneRef.current.water.geometry as THREE.BufferGeometry).dispose();
        (sceneRef.current.water.material as THREE.Material).dispose();
        if (sceneRef.current.marker) {
          (sceneRef.current.marker.geometry as THREE.BufferGeometry).dispose();
          (sceneRef.current.marker.material as THREE.Material).dispose();
        }
        sceneRef.current.sitePoints.children.forEach((child) => {
          const material = (child as THREE.Sprite).material as THREE.SpriteMaterial;
          material.map?.dispose();
          material.dispose();
        });
        retroLedAtlas.dispose();
        sceneRef.current.renderer.dispose();
        sceneRef.current.renderer.domElement.remove();
      } else {
        geometry?.dispose();
        renderer?.dispose();
      }
      sceneRef.current = null;
      earthGroup = null;
      water = null;
      marker = null;
      sitePoints = null;
      scene = null;
      camera = null;
    };
  }, [siteCatalogue]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    const positionAttribute = state.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttribute = state.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let y = 0; y < state.height; y++) {
      const lat = (90 - (y / (state.height - 1)) * 180) * Math.PI / 180;
      for (let x = 0; x < state.width; x++) {
        const lon = ((x / (state.width - 1)) * 360 - 180) * Math.PI / 180;
        const index = y * state.width + x;
        const elevation = state.heights[index];
        const submerged = elevation < seaLevel;
        const visibleHeight = submerged ? seaLevel : elevation;
        const radius = BASE_RADIUS + visibleHeight * HEIGHT_SCALE * terrainScale;
        positionAttribute.setXYZ(index, radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
        const color = submerged ? new THREE.Color('#168bd2') : elevationColor(elevation);
        colorAttribute.setXYZ(index, color.r, color.g, color.b);
      }
    }
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    state.geometry.computeVertexNormals();
    // Recalculate bounds after changing vertex positions so Three.js doesn't cull the raised globe.
    state.geometry.computeBoundingSphere();
    // Keep the visible water surface locked to the exact same datum as flooded terrain.
    state.water.geometry.dispose();
    state.water.geometry = new THREE.SphereGeometry(BASE_RADIUS + seaLevel * HEIGHT_SCALE * terrainScale, 128, 64);
  }, [terrainScale, seaLevel]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    let pointIndex = 0;
    for (const site of siteCatalogue) {
      if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon)) continue;
      const sprite = state.sitePoints.children[pointIndex] as THREE.Sprite | undefined;
      if (!sprite) break;
      const sx = Math.max(0, Math.min(state.width - 1, Math.round(((site.lon + 180) / 360) * (state.width - 1))));
      const sy = Math.max(0, Math.min(state.height - 1, Math.round(((90 - site.lat) / 180) * (state.height - 1))));
      const elevation = state.heights[sy * state.width + sx] || 0;
      const lat = site.lat * Math.PI / 180;
      const lon = site.lon * Math.PI / 180;
      const radius = BASE_RADIUS + Math.max(elevation, seaLevel) * HEIGHT_SCALE * terrainScale + 0.8;
      sprite.position.set(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
      pointIndex++;
    }
  }, [terrainScale, siteCatalogue, seaLevel]);


  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = sceneRef.current;
      if (!state) return;
      const now = performance.now() * 0.001;
      state.sitePoints.children.forEach((object) => {
        if (!object.userData.isRetroLedSprite) return;
        const phase = now * 2.2 + Number(object.userData.ledPhase || 0);
        const isOn = Math.sin(phase) > -0.05;
        const row = Number(object.userData.ledColorIndex ?? 1);
        const texture = object.userData.ledTexture as THREE.Texture | undefined;
        if (texture) texture.offset.y = (9 - (row * 2 + (isOn ? 1 : 0))) * 0.1;
        const material = (object as THREE.Sprite).material as THREE.SpriteMaterial;
        material.opacity = isOn ? 1 : 0.42;
        material.color.set(isOn ? '#ffffff' : '#9ca3af');
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.camera.position.z = 250 / zoom;
  }, [zoom]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || !selectedSite) {
      if (state?.marker) state.marker.visible = false;
      return;
    }
    const x = Math.max(0, Math.min(state.width - 1, Math.round(((selectedSite.lon + 180) / 360) * (state.width - 1))));
    const y = Math.max(0, Math.min(state.height - 1, Math.round(((90 - selectedSite.lat) / 180) * (state.height - 1))));
    const elevation = state.heights[y * state.width + x] || 0;
    const lat = selectedSite.lat * Math.PI / 180;
    const lon = selectedSite.lon * Math.PI / 180;
    const radius = BASE_RADIUS + Math.max(elevation, seaLevel) * HEIGHT_SCALE * terrainScale + 0.8;
    state.marker!.position.set(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
    state.marker!.visible = true;
  }, [selectedSite, seaLevel, terrainScale, loading]);

  const changeYear = (value: number) => {
    setYearOffset(value);
    setSeaLevel(estimatedHistoricalLevel(value));
    setLevelMode('historical');
  };
  const yearLabel = yearOffset < 0
    ? `${Math.abs(yearOffset).toLocaleString()} years before present`
    : yearOffset === 0 ? 'Present day' : `${yearOffset.toLocaleString()} years into future`;

  return (
    <div className="relative flex h-full min-h-[480px] w-full flex-col overflow-hidden rounded-xl border border-sky-500/30 bg-[#030814] text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 bg-slate-950/90 px-3 py-2">
        <div className="flex items-center gap-2">
          <Mountain className="h-4 w-4 text-emerald-300" />
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-emerald-200">EARTH · ELEVATION</div>
            <div className="text-[9px] font-mono text-slate-500">NOAA DEM · true terrain + bathymetry</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[9px] font-mono text-slate-500">DRAG TO ROTATE · WHEEL TO ZOOM</span>
          <button onClick={onBack} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] font-mono text-slate-300 hover:border-sky-400 hover:text-white"><ArrowLeft className="h-3 w-3" /> BACK TO EARTH</button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" aria-label="Interactive three-dimensional NOAA terrain globe" />
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 p-6 text-center"><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin text-sky-300" /><div className="text-sm font-mono text-sky-100">LOADING NOAA ELEVATION DATA</div><div className="mt-2 text-xs text-slate-400">{datasetInfo}</div></div></div>}
        {loadError && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/95 p-6"><div className="max-w-lg text-center"><Database className="mx-auto mb-3 h-8 w-8 text-rose-300" /><div className="text-sm font-mono font-bold text-rose-200">NOAA DATA COULD NOT BE LOADED</div><p className="mt-2 text-xs text-slate-300">{loadError}</p><p className="mt-2 text-[10px] text-slate-500">This view requires the live NOAA elevation service; it will not substitute a fake terrain model.</p><a className="mt-3 inline-block text-xs text-sky-300 underline" href={NOAA_SOURCE} target="_blank" rel="noreferrer">Open NOAA ETOPO data source ↗</a></div></div>}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 backdrop-blur">
          <div className="text-[9px] font-mono text-slate-400">GLOBAL SEA LEVEL</div>
          <div className="mt-1 text-lg font-mono font-bold text-sky-200">{seaLevel > 0 ? '+' : ''}{seaLevel.toFixed(1)} m</div>
          <div className="text-[9px] text-slate-500">{levelMode === 'historical' ? 'historical reference estimate' : 'custom scenario'}</div>
        </div>
        {selectedSite && <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-rose-400/50 bg-slate-950/85 px-3 py-2 text-[10px] font-mono text-rose-100">{selectedSite.name}<div className="text-[9px] text-slate-400">{selectedSite.lat.toFixed(4)}°, {selectedSite.lon.toFixed(4)}°</div></div>}
      </div>
      <div className="grid gap-3 border-t border-slate-700/80 bg-slate-950/95 p-3 xl:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2"><label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-300"><Waves className="h-3.5 w-3.5 text-sky-300" /> TIME · {yearLabel}</label><button onClick={() => changeYear(0)} className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-400 hover:text-white"><RotateCcw className="h-3 w-3" /> PRESENT</button></div>
          <input aria-label="Historical time offset" type="range" min="-12000" max="1000" step="100" value={yearOffset} onChange={event => changeYear(Number(event.target.value))} className="w-full accent-sky-400" />
          <div className="flex justify-between text-[9px] text-slate-500"><span>12,000 years ago</span><span>Present</span><span>+1,000 years</span></div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2"><label className="text-[10px] font-mono font-bold text-slate-300">WATER ELEVATION · {seaLevel > 0 ? '+' : ''}{seaLevel.toFixed(1)} m</label><button onClick={() => { setSeaLevel(0); setLevelMode('custom'); }} className="text-[9px] font-mono text-slate-400 hover:text-white">RESET TO 0 m</button></div>
          <input aria-label="Water elevation in metres" type="range" min="-120" max="1000" step="1" value={seaLevel} onChange={event => { setSeaLevel(Number(event.target.value)); setLevelMode('custom'); }} className="w-full accent-cyan-400" />
          <div className="flex justify-between text-[9px] text-slate-500"><span>-120 m</span><span>Current datum 0 m</span><span>+1,000 m hypothetical</span></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 xl:col-span-2">
          <div className="min-w-0 text-[9px] text-slate-500">{datasetInfo} <span className="mx-1">·</span> <a className="text-sky-300 underline" href={NOAA_SOURCE} target="_blank" rel="noreferrer">NOAA ETOPO / NCEI source</a></div>
          <label className="flex items-center gap-2 text-[9px] font-mono text-slate-400">TERRAIN RELIEF <input type="range" min="0.6" max="1.8" step="0.1" value={terrainScale} onChange={event => setTerrainScale(Number(event.target.value))} className="w-20 accent-emerald-400" /></label>
          <label className="flex items-center gap-2 text-[9px] font-mono text-slate-400">ZOOM <input type="range" min="0.7" max="2.2" step="0.1" value={zoom} onChange={event => setZoom(Number(event.target.value))} className="w-20 accent-sky-400" /></label>
        </div>
      </div>
    </div>
  );
};

export default EarthElevation;
