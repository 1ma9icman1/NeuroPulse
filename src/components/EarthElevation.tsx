import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fromUrl } from 'geotiff';
import { ArrowLeft, LoaderCircle, Waves, Mountain, Database, RotateCcw } from 'lucide-react';

type Site = { name: string; lat: number; lon: number } | null;
type CatalogueSite = { name: string; lat: number; lon: number; category?: string; color?: string };
type Props = { selectedSite: Site; siteCatalogue: CatalogueSite[]; onBack: () => void };

const NOAA_DEM_URL = 'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/exportImage?bbox=-180,-90,180,90&bboxSR=4326&size=720,360&imageSR=4326&format=tiff&pixelType=F32&f=image';
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
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; earth: THREE.Group; water: THREE.Mesh; marker: THREE.Mesh | null; sitePoints: THREE.Points; geometry: THREE.BufferGeometry; heights: Float32Array; width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [yearOffset, setYearOffset] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [levelMode, setLevelMode] = useState<'historical' | 'custom'>('historical');
  const [terrainScale, setTerrainScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [datasetInfo, setDatasetInfo] = useState('Connecting to NOAA elevation service…');

  useEffect(() => {
    let cancelled = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let earthGroup: THREE.Group | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let water: THREE.Mesh | null = null;
    let marker: THREE.Mesh | null = null;
    let sitePoints: THREE.Points | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
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
        const tiff = await fromUrl(NOAA_DEM_URL);
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
            const radius = BASE_RADIUS + elevation * HEIGHT_SCALE * terrainScale;
            positions.push(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
            const color = elevationColor(elevation);
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

        const sitePositions: number[] = [];
        const siteColors: number[] = [];
        for (const site of siteCatalogue) {
          if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon)) continue;
          const sx = Math.max(0, Math.min(gridWidth - 1, Math.round(((site.lon + 180) / 360) * (gridWidth - 1))));
          const sy = Math.max(0, Math.min(gridHeight - 1, Math.round(((90 - site.lat) / 180) * (gridHeight - 1))));
          const elevation = heights[sy * gridWidth + sx] || 0;
          const lat = site.lat * Math.PI / 180;
          const lon = site.lon * Math.PI / 180;
          const radius = BASE_RADIUS + Math.max(elevation, 0) * HEIGHT_SCALE * terrainScale + 0.35;
          sitePositions.push(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
          const color = new THREE.Color(site.color || (/city/i.test(site.category || '') ? '#60a5fa' : /acoustic|frequency/i.test(site.category || '') ? '#fb923c' : '#facc15'));
          siteColors.push(color.r, color.g, color.b);
        }
        const siteGeometry = new THREE.BufferGeometry();
        siteGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sitePositions, 3));
        siteGeometry.setAttribute('color', new THREE.Float32BufferAttribute(siteColors, 3));
        sitePoints = new THREE.Points(siteGeometry, new THREE.PointsMaterial({ size: 1.45, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95 }));
        sitePoints.renderOrder = 3;
        earthGroup.add(sitePoints);

        water = new THREE.Mesh(
          new THREE.SphereGeometry(BASE_RADIUS, 128, 64),
          new THREE.MeshStandardMaterial({ color: '#168bd2', transparent: true, opacity: 0.58, roughness: 0.28, metalness: 0.08, depthWrite: false, side: THREE.DoubleSide })
        );
        water.renderOrder = 2;
        earthGroup.add(water);

        marker = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff5263' }));
        marker.visible = false;
        earthGroup.add(marker);

        sceneRef.current = { renderer, scene, camera, earth: earthGroup, water, marker, sitePoints, geometry, heights, width: gridWidth, height: gridHeight };
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
      resizeObserver?.disconnect();
      if (sceneRef.current) {
        sceneRef.current.geometry.dispose();
        (sceneRef.current.water.geometry as THREE.BufferGeometry).dispose();
        (sceneRef.current.water.material as THREE.Material).dispose();
        if (sceneRef.current.marker) {
          (sceneRef.current.marker.geometry as THREE.BufferGeometry).dispose();
          (sceneRef.current.marker.material as THREE.Material).dispose();
        }
        sceneRef.current.sitePoints.geometry.dispose();
        (sceneRef.current.sitePoints.material as THREE.Material).dispose();
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
    for (let y = 0; y < state.height; y++) {
      const lat = (90 - (y / (state.height - 1)) * 180) * Math.PI / 180;
      for (let x = 0; x < state.width; x++) {
        const lon = ((x / (state.width - 1)) * 360 - 180) * Math.PI / 180;
        const elevation = state.heights[y * state.width + x];
        const radius = BASE_RADIUS + elevation * HEIGHT_SCALE * terrainScale;
        positionAttribute.setXYZ(y * state.width + x, radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
      }
    }
    positionAttribute.needsUpdate = true;
    state.geometry.computeVertexNormals();
  }, [terrainScale]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    const siteAttribute = state.sitePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    let pointIndex = 0;
    for (const site of siteCatalogue) {
      if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon)) continue;
      if (pointIndex >= siteAttribute.count) break;
      const sx = Math.max(0, Math.min(state.width - 1, Math.round(((site.lon + 180) / 360) * (state.width - 1))));
      const sy = Math.max(0, Math.min(state.height - 1, Math.round(((90 - site.lat) / 180) * (state.height - 1))));
      const elevation = state.heights[sy * state.width + sx] || 0;
      const lat = site.lat * Math.PI / 180;
      const lon = site.lon * Math.PI / 180;
      const radius = BASE_RADIUS + Math.max(elevation, seaLevel) * HEIGHT_SCALE * terrainScale + 0.35;
      siteAttribute.setXYZ(pointIndex, radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
      pointIndex++;
    }
    siteAttribute.needsUpdate = true;
  }, [terrainScale, siteCatalogue, seaLevel]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.water.geometry.dispose();
    state.water.geometry = new THREE.SphereGeometry(BASE_RADIUS + seaLevel * HEIGHT_SCALE * terrainScale, 128, 64);
  }, [seaLevel, terrainScale]);

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
