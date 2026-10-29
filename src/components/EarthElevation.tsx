import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { COPERNICUS_DATASET, loadCopernicusGlobalSamples, resampleCopernicusGrid } from '../lib/copernicusDem';
import { ArrowLeft, LoaderCircle, Waves, Mountain, Database, RotateCcw, Triangle, Stars, Ruler, Camera, Eye, EyeOff, Map as MapIcon } from 'lucide-react';
import { CONSTELLATION_LINE_SHAPES } from '../data/constellationLineData';
import { FreeStreetImageryPanel } from './FreeStreetImageryPanel';

type Site = { name: string; lat: number; lon: number } | null;
type CatalogueSite = { name: string; lat: number; lon: number; category?: string; color?: string };
type EarthSiteSelection = { name: string; lat: number; lon: number; category?: string; color?: string };
type Props = {
  selectedSite: Site;
  siteCatalogue: CatalogueSite[];
  onBack: () => void;
  onAssignChannel?: (channel: 'a' | 'b' | 'c', latitude: number, longitude: number) => void;
  onSelectSite?: (site: EarthSiteSelection) => void;
};

const DEM_WIDTH = 1080;
const DEM_HEIGHT = 540;
const NOAA_SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-180,-85,180,85&bboxSR=4326&imageSR=4326&size=2048,1024&format=jpg&transparent=false&f=image';
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

export const EarthElevation: React.FC<Props> = ({ selectedSite, siteCatalogue, onBack, onAssignChannel, onSelectSite }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectSiteRef = useRef(onSelectSite);
  onSelectSiteRef.current = onSelectSite;
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; earth: THREE.Group; water: THREE.Mesh; marker: THREE.Mesh | null; sitePoints: THREE.Group; geometry: THREE.BufferGeometry; terrainMaterial: THREE.MeshStandardMaterial; heights: Float32Array; width: number; height: number; geometryOverlay: THREE.Group; constellationOverlay: THREE.Group; countryBorders: THREE.Group } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [yearOffset, setYearOffset] = useState(0);
  const [seaLevel, setSeaLevel] = useState(0);
  const [waterOpacity, setWaterOpacity] = useState(0.58);
  const [levelMode, setLevelMode] = useState<'historical' | 'custom'>('historical');
  const [terrainScale, setTerrainScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [datasetInfo, setDatasetInfo] = useState('Connecting to Copernicus DEM GLO-90…');
  const [surfaceMode, setSurfaceMode] = useState<'satellite' | 'relief'>('relief');
  const [surfaceTextureLoaded, setSurfaceTextureLoaded] = useState(false);
  const [surfaceTextureError, setSurfaceTextureError] = useState(false);
  const [showTriangulation, setShowTriangulation] = useState(false);
  const [showConstellationLines, setShowConstellationLines] = useState(false);
  const [showAngleLabels, setShowAngleLabels] = useState(false);
  const [showCountryBorders, setShowCountryBorders] = useState(true);
  const [overlayMessage, setOverlayMessage] = useState('Select a geometry tool to begin.');
  const surfaceTextureRef = useRef<THREE.Texture | null>(null);
  const surfaceModeRef = useRef(surfaceMode);
  surfaceModeRef.current = surfaceMode;
  // Keep the latest slider values available to the asynchronous Copernicus scene initializer.
  // Otherwise a slider move during loading can be overwritten by stale initial values.
  const seaLevelRef = useRef(seaLevel);
  const terrainScaleRef = useRef(terrainScale);
  seaLevelRef.current = seaLevel;
  terrainScaleRef.current = terrainScale;

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      NOAA_SATELLITE_URL,
      texture => {
        if (cancelled) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        surfaceTextureRef.current = texture;
        setSurfaceTextureLoaded(true);
        setSurfaceMode('satellite');
      },
      undefined,
      () => {
        if (!cancelled) {
          setSurfaceTextureError(true);
          setSurfaceMode('relief');
        }
      }
    );
    return () => {
      cancelled = true;
      surfaceTextureRef.current?.dispose();
      surfaceTextureRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const demAbortController = new AbortController();
    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let earthGroup: THREE.Group | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let water: THREE.Mesh | null = null;
    let marker: THREE.Mesh | null = null;
    let sitePoints: THREE.Group | null = null;
    let geometryOverlay: THREE.Group | null = null;
    let constellationOverlay: THREE.Group | null = null;
    let countryBorders: THREE.Group | null = null;
    let markerBuildFrame = 0;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let buildMarkers: (() => void) | null = null;
    // Load and slice the user's transparent archaeology/science tilesheet.
    const atlasTiles: THREE.CanvasTexture[] = [];
    const atlasUrl = 'https://raw.githubusercontent.com/1ma9icman1/NeuroPulse/main/Archaeology%20and%20Science%20Icon%20Grid.png';
    const loadIconAtlas = async () => {
      try {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = atlasUrl;
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Icon tilesheet failed to load')); });
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas unavailable for icon tilesheet');
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // The authored 1254×1254 sheet is an 8-column × 8-row atlas (64 icons).
        // Fixed cell boundaries prevent transparent glow pixels from joining neighboring icons.
        const columns = 8, rows = 8;
        for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
          const cellX = Math.floor(col * image.naturalWidth / columns);
          const cellY = Math.floor(row * image.naturalHeight / rows);
          const cellRight = Math.floor((col + 1) * image.naturalWidth / columns);
          const cellBottom = Math.floor((row + 1) * image.naturalHeight / rows);
          // The source can be an opaque PNG even when its filename ends in .png.
          // Remove white/near-white matte pixels throughout this tile, not only at its edges.
          // Fade anti-aliased pale pixels instead of leaving a white fringe around the icon.
          for (let y = cellY; y < cellBottom; y++) for (let x = cellX; x < cellRight; x++) {
            const offset = (y * canvas.width + x) * 4;
            const red = pixels[offset], green = pixels[offset + 1], blue = pixels[offset + 2];
            const brightest = Math.max(red, green, blue);
            const darkest = Math.min(red, green, blue);
            const spread = brightest - darkest;
            if (brightest > 218 && spread < 32) {
              const matteStrength = Math.min(1, Math.max(0, (brightest - 218) / 30));
              pixels[offset + 3] = Math.round(pixels[offset + 3] * (1 - matteStrength));
            }
          }
          let minX = cellRight, minY = cellBottom, maxX = cellX - 1, maxY = cellY - 1;
          for (let y = cellY; y < cellBottom; y++) for (let x = cellX; x < cellRight; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] > 12) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          }
          const tileCanvas = document.createElement('canvas'); tileCanvas.width = 128; tileCanvas.height = 128;
          const tileCtx = tileCanvas.getContext('2d');
          if (tileCtx && maxX >= minX && maxY >= minY) {
            const sw = maxX - minX + 1, sh = maxY - minY + 1;
            const scale = Math.min(112 / sw, 112 / sh), dw = sw * scale, dh = sh * scale;
            ctx.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0);
            tileCtx.drawImage(canvas, minX, minY, sw, sh, (128 - dw) / 2, (128 - dh) / 2, dw, dh);
          }
          const texture = new THREE.CanvasTexture(tileCanvas);
          texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
          atlasTiles.push(texture);
        }
        console.info('[NeuroPulse] Loaded archaeology/science icon atlas:',atlasTiles.length,'tiles');
      } catch (error) { console.warn('[NeuroPulse] Icon tilesheet unavailable; fallback markers active:',error); }
    };
    const atlasIndexFor = (category = '', name = '') => {
      const value=(category+' '+name).toLowerCase();
      const categories=[
        /pyramid|temple|ziggurat|monument|megalith|structure/,
        /city|settlement|village|urban/,
        /stone|crystal|rock|mineral/,
        /cave|cavern|grotto|underground/,
        /mound|burial|tumulus|tomb|dolmen|barrow/,
        /water|spring|lake|river|well|ocean|sea/,
        /sound|audio|acoustic|frequency|music|resonance|hz/,
        /star|astronom|observatory|alignment|celestial|constellation/,
        /ruin|archaeolog|historic|ancient|site/,
        /mountain|volcano|elevation|terrain/,
        /artifact|tool|pottery|metalwork/,
        /geometry|triangle|angle/,
      ];
      const index=categories.findIndex(pattern=>pattern.test(value));
      return index<0?Math.min(8,Math.max(0,atlasTiles.length-1)):index;
    };
    function createSiteIconTexture(category = '', name = ''): THREE.CanvasTexture {
      const atlasIndex=atlasIndexFor(category,name);
      if (atlasTiles[atlasIndex]) return atlasTiles[atlasIndex];
      // Fallback only if the authored image cannot be loaded or parsed.
      const value=(category+' '+name).toLowerCase();
      let glyph='◆';
      if (/sound|audio|acoustic|frequency|music|resonance|hz/.test(value)) glyph='♫';
      else if (/pyramid|temple|ziggurat|monument|megalith/.test(value)) glyph='▲';
      else if (/cave|cavern|grotto|underground/.test(value)) glyph='◒';
      else if (/stone|crystal|rock|mineral/.test(value)) glyph='⬟';
      else if (/mound|burial|tumulus|tomb|dolmen|barrow/.test(value)) glyph='⬢';
      else if (/city|settlement|village|urban/.test(value)) glyph='⌂';
      else if (/star|astronom|observatory|alignment|celestial/.test(value)) glyph='✦';
      else if (/water|spring|lake|river|well|ocean/.test(value)) glyph='≈';
      else if (/ruin|archaeolog|historic|site/.test(value)) glyph='⌖';
      const iconCanvas=document.createElement('canvas'); iconCanvas.width=128; iconCanvas.height=128;
      const ctx=iconCanvas.getContext('2d')!; ctx.clearRect(0,0,128,128); ctx.beginPath(); ctx.arc(64,64,54,0,Math.PI*2);
      ctx.fillStyle='rgba(8,17,32,0.9)'; ctx.fill(); ctx.lineWidth=5; ctx.strokeStyle='#7dd3fc'; ctx.stroke();
      ctx.font='bold 72px "Segoe UI Symbol", "Arial Unicode MS", sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#f8fafc'; ctx.fillText(glyph,64,66);
      const texture=new THREE.CanvasTexture(iconCanvas); texture.colorSpace=THREE.SRGBColorSpace; return texture;
    }
    let heights = new Float32Array(0);
    let gridWidth = 0;
    let gridHeight = 0;
    let dragPointer: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const init = async () => {
      try {
        await loadIconAtlas();
        if (cancelled) return;
        setLoading(true);
        setLoadError('');
        setDatasetInfo(`Loading measured elevations from ${COPERNICUS_DATASET}…`);
        const sampled = await loadCopernicusGlobalSamples(demAbortController.signal, (completed, total, fromCache) => {
          if (cancelled) return;
          if (fromCache || completed === total || completed % 1200 < 100) {
            const percent = Math.round((completed / total) * 100);
            setDatasetInfo(fromCache
              ? `Loaded cached Copernicus GLO-90 raster samples (${total.toLocaleString()} values).`
              : `Sampling Copernicus GLO-90: ${completed.toLocaleString()} / ${total.toLocaleString()} values (${percent}%).`);
          }
        });
        if (cancelled) return;
        setDatasetInfo('Resampling measured Copernicus elevations to the existing globe mesh…');
        gridWidth = DEM_WIDTH;
        gridHeight = DEM_HEIGHT;
        heights = new Float32Array(resampleCopernicusGrid(sampled.values, gridWidth, gridHeight));
        if (!heights.length || heights.some(value => !Number.isFinite(value))) {
          throw new Error('Copernicus DEM returned missing or invalid elevation samples.');
        }

        const host = hostRef.current;
        if (!host) return;
        scene = new THREE.Scene();
        scene.background = new THREE.Color('#030814');
        camera = new THREE.PerspectiveCamera(42, Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight), 0.1, 1000);
        camera.position.set(0, 0, 250);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
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
        geometryOverlay = new THREE.Group();
        constellationOverlay = new THREE.Group();
        countryBorders = new THREE.Group();
        countryBorders.visible = showCountryBorders;
        earthGroup.add(geometryOverlay, constellationOverlay, countryBorders);
        scene.add(earthGroup);

        const positions: number[] = [];
        const colors: number[] = [];
        const uvs: number[] = [];
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
            const oceanCell = elevation === 0; // Copernicus documents ocean areas as zero-valued/no-tile cells.
            const submerged = oceanCell || elevation < activeSeaLevel;
            const visibleHeight = submerged ? activeSeaLevel : elevation;
            const radius = BASE_RADIUS + visibleHeight * HEIGHT_SCALE * activeTerrainScale;
            positions.push(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
            const color = submerged
              ? (surfaceModeRef.current === 'satellite' ? new THREE.Color('#9ac4dc') : new THREE.Color('#287ea7'))
              : surfaceModeRef.current === 'satellite' ? new THREE.Color('#ffffff') : elevationColor(elevation);
            colors.push(color.r, color.g, color.b);
            // Geographic equirectangular mapping: west/east across U, north/south across V.
            uvs.push(x / (gridWidth - 1), 1 - y / (gridHeight - 1));
          }
        }
        for (let y = 0; y < gridHeight - 1; y++) {
          for (let x = 0; x < gridWidth - 1; x++) {
            const a = y * gridWidth + x;
            const b = a + 1;
            const c = a + gridWidth;
            const d = c + 1;
            // Latitude rows run north-to-south, so reverse the winding to keep normals facing outward.
            indices.push(a, c, b, b, c, d);
          }
        }
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
        const terrain = new THREE.Mesh(geometry, terrainMaterial);
        terrain.renderOrder = 1;
        earthGroup.add(terrain);

        const sitePoints = new THREE.Group();
        // Attach the category-icon marker layer immediately; build markers in small frame batches.
        earthGroup.add(sitePoints);

        water = new THREE.Mesh(
          new THREE.SphereGeometry(BASE_RADIUS + seaLevelRef.current * HEIGHT_SCALE * terrainScaleRef.current, 128, 64),
          new THREE.MeshStandardMaterial({ color: '#168bd2', transparent: true, opacity: waterOpacity, roughness: 0.28, metalness: 0.08, depthWrite: false, side: THREE.DoubleSide })
        );
        water.renderOrder = 2;
        earthGroup.add(water);

        marker = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff5263' }));
        marker.visible = false;
        earthGroup.add(marker);

        sceneRef.current = { renderer, scene, camera, earth: earthGroup, water, marker, sitePoints, geometry, terrainMaterial, heights, width: gridWidth, height: gridHeight, geometryOverlay, constellationOverlay, countryBorders };

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
              const iconTexture = createSiteIconTexture(site.category || '', site.name || '');
              const spriteMaterial = new THREE.SpriteMaterial({
                map: iconTexture, transparent: true, depthWrite: false, toneMapped: false
              });
              const sprite = new THREE.Sprite(spriteMaterial);
                            sprite.userData.site = { name: site.name, lat: site.lat, lon: site.lon, category: site.category, color: site.color };
              sprite.userData.siteIconTexture = iconTexture;
              
              
              sprite.scale.set(2.7, 2.7, 1);
              sprite.position.set(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
              sitePoints.add(sprite);
            }
            if (index < siteCatalogue.length) markerBuildFrame = window.requestAnimationFrame(buildBatch);
          };
          markerBuildFrame = window.requestAnimationFrame(buildBatch);
        };
        // If the atlas loaded while Copernicus elevation data was loading, start markers now.
        buildMarkers();
        let pointerStartX = 0;
        let pointerStartY = 0;
        const clickRaycaster = new THREE.Raycaster();
        const clickPointer = new THREE.Vector2();
        const onPointerDown = (event: PointerEvent) => {
          dragPointer = event.pointerId;
          pointerStartX = lastX = event.clientX;
          pointerStartY = lastY = event.clientY;
          renderer?.domElement.setPointerCapture(event.pointerId);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (dragPointer !== event.pointerId || !earthGroup) return;
          earthGroup.rotation.y += (event.clientX - lastX) * 0.006;
          earthGroup.rotation.x = Math.max(-1.4, Math.min(1.4, earthGroup.rotation.x + (event.clientY - lastY) * 0.006));
          lastX = event.clientX; lastY = event.clientY;
        };
        const onPointerUp = (event: PointerEvent) => {
          const wasClick = dragPointer === event.pointerId && Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) < 5;
          if (event.type === 'pointerup' && wasClick && renderer && camera && sitePoints) {
            const rect = renderer.domElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              clickPointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
              clickRaycaster.setFromCamera(clickPointer, camera);
              const hit = clickRaycaster.intersectObjects(sitePoints.children, true).find(item => item.object.userData.site);
              if (hit?.object.userData.site) onSelectSiteRef.current?.(hit.object.userData.site as EarthSiteSelection);
            }
          }
          dragPointer = null;
          try { renderer?.domElement.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
        };
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
        setDatasetInfo('Copernicus GLO-90 samples loaded. Zero-valued ocean cells follow the dataset convention; no bathymetry is invented.');
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Copernicus Earth elevation load failed:', error);
        setLoadError(error instanceof Error ? error.message : 'Unable to load Copernicus elevation data.');
        setDatasetInfo('Copernicus elevation sampling did not return a usable global raster.');
        setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
      demAbortController.abort();
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(markerBuildFrame);
      resizeObserver?.disconnect();
      if (sceneRef.current) {
        sceneRef.current.geometry.dispose();
        sceneRef.current.terrainMaterial.dispose();
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
    state.terrainMaterial.map = surfaceMode === 'satellite' && surfaceTextureLoaded ? surfaceTextureRef.current : null;
    state.terrainMaterial.needsUpdate = true;
    const waterMaterial = state.water.material as THREE.MeshStandardMaterial;
    waterMaterial.opacity = waterOpacity;
    waterMaterial.transparent = waterOpacity < 1;
    waterMaterial.needsUpdate = true;
    const positionAttribute = state.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttribute = state.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let y = 0; y < state.height; y++) {
      const lat = (90 - (y / (state.height - 1)) * 180) * Math.PI / 180;
      for (let x = 0; x < state.width; x++) {
        const lon = ((x / (state.width - 1)) * 360 - 180) * Math.PI / 180;
        const index = y * state.width + x;
        const elevation = state.heights[index];
        const oceanCell = elevation === 0;
        const submerged = oceanCell || elevation < seaLevel;
        const visibleHeight = submerged ? seaLevel : elevation;
        const radius = BASE_RADIUS + visibleHeight * HEIGHT_SCALE * terrainScale;
        positionAttribute.setXYZ(index, radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
        const color = submerged
          ? (surfaceMode === 'satellite' ? new THREE.Color('#9ac4dc') : new THREE.Color('#287ea7'))
          : surfaceMode === 'satellite' ? new THREE.Color('#ffffff') : elevationColor(elevation);
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
  }, [terrainScale, seaLevel, surfaceMode, surfaceTextureLoaded, waterOpacity, loading]);

  // Right-column controls dispatch these events so the same research tools are available
  // in the elevation workspace without duplicating the global navigation menu.
  useEffect(() => {
    const onElevationTool = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'water-level') {
        const value = (event as CustomEvent<{ value?: number }>).detail?.value;
        if (typeof value === 'number' && Number.isFinite(value)) { setSeaLevel(value); setLevelMode('custom'); }
      } else if (action === 'water-opacity') {
        const value = (event as CustomEvent<{ value?: number }>).detail?.value;
        if (typeof value === 'number' && Number.isFinite(value)) setWaterOpacity(Math.max(0.05, Math.min(1, value)));
      } else if (action === 'triangulate') {
        setShowTriangulation(value => !value);
        setOverlayMessage('Earth-site neighbour mesh toggled.');
      } else if (action === 'constellations') {
        setShowConstellationLines(value => !value);
        setOverlayMessage('Celestial line overlay toggled.');
      } else if (action === 'angles') {
        setShowAngleLabels(value => !value);
        setOverlayMessage('Triangle angle labels toggled.');
      } else if (action === 'screenshot') {
        const state = sceneRef.current;
        if (!state) { setOverlayMessage('Earth renderer is not ready for capture yet.'); return; }
        try {
          state.renderer.render(state.scene, state.camera);
          const link = document.createElement('a');
          link.download = 'neuropulse-elevation-earth.png';
          link.href = state.renderer.domElement.toDataURL('image/png');
          link.click();
          setOverlayMessage('Elevation screenshot saved as PNG.');
        } catch (error) {
          console.error('Elevation screenshot failed:', error);
          setOverlayMessage('Screenshot failed. Try again after the terrain finishes loading.');
        }
      } else if (action === 'clear') {
        setShowTriangulation(false);
        setShowConstellationLines(false);
        setShowAngleLabels(false);
        setOverlayMessage('Geometry overlays cleared.');
      }
    };
    window.addEventListener('neuro-pulse-elevation-tool', onElevationTool);
    return () => window.removeEventListener('neuro-pulse-elevation-tool', onElevationTool);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('neuro-pulse-elevation-state', { detail: { seaLevel, waterOpacity } }));
  }, [seaLevel, waterOpacity]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || loading) return;
    const group = state.geometryOverlay;
    group.clear();
    if (!showTriangulation && !showAngleLabels) return;
    const valid = siteCatalogue.filter(site => Number.isFinite(site.lat) && Number.isFinite(site.lon)).slice(0, 90);
    const vectors = valid.map(site => {
      const sx = Math.max(0, Math.min(state.width - 1, Math.round(((site.lon + 180) / 360) * (state.width - 1))));
      const sy = Math.max(0, Math.min(state.height - 1, Math.round(((90 - site.lat) / 180) * (state.height - 1))));
      const elevation = state.heights[sy * state.width + sx] || 0;
      const lat = site.lat * Math.PI / 180;
      const lon = site.lon * Math.PI / 180;
      const radius = BASE_RADIUS + Math.max(elevation, seaLevel) * HEIGHT_SCALE * terrainScale + 1.8;
      return { site, p: new THREE.Vector3(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)) };
    });
    const edgeKeys = new Set<string>();
    const positions: number[] = [];
    vectors.forEach((entry, index) => {
      const nearest = vectors.map((other, otherIndex) => ({ other, otherIndex, d: entry.p.distanceToSquared(other.p) }))
        .filter(item => item.otherIndex !== index).sort((a,b) => a.d-b.d).slice(0, 2);
      nearest.forEach(({ other, otherIndex }) => {
        const key = [index, otherIndex].sort((a,b)=>a-b).join(':');
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        positions.push(entry.p.x, entry.p.y, entry.p.z, other.p.x, other.p.y, other.p.z);
      });
    });
    if (showTriangulation && positions.length) {
      // WebGL line width is effectively fixed to 1px on many browsers/GPU drivers.
      // Use real tube geometry so the site links remain visibly thick at normal zoom.
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: '#00bfff', transparent: true, opacity: 0.24, depthTest: false,
        depthWrite: false, toneMapped: false,
      });
      const coreMaterial = new THREE.MeshBasicMaterial({
        color: '#8ff4ff', transparent: true, opacity: 0.98, depthTest: false,
        depthWrite: false, toneMapped: false,
      });
      for (let i = 0; i + 5 < positions.length; i += 6) {
        const start = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        const end = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
        const direction = end.clone().sub(start);
        if (direction.lengthSq() < 1e-8) continue;
        const path = new THREE.LineCurve3(start, end);
        const glow = new THREE.Mesh(new THREE.TubeGeometry(path, 8, 0.52, 6, false), glowMaterial);
        glow.renderOrder = 8;
        glow.frustumCulled = false;
        group.add(glow);
        const core = new THREE.Mesh(new THREE.TubeGeometry(path, 8, 0.22, 6, false), coreMaterial);
        core.renderOrder = 9;
        core.frustumCulled = false;
        group.add(core);
      }
    }
    if (showAngleLabels) {
      vectors.slice(0, 28).forEach((entry, index) => {
        const nearest = vectors.map((other, otherIndex) => ({ other, otherIndex, d: entry.p.distanceToSquared(other.p) }))
          .filter(item => item.otherIndex !== index).sort((a,b)=>a.d-b.d).slice(0, 2);
        if (nearest.length !== 2) return;
        const a = nearest[0].other.p.clone().sub(entry.p).normalize();
        const b = nearest[1].other.p.clone().sub(entry.p).normalize();
        const angle = THREE.MathUtils.radToDeg(a.angleTo(b));
        const canvas = document.createElement('canvas');
        canvas.width = 160; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = 'rgba(3,10,24,0.92)'; ctx.fillRect(0,0,160,48);
        ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 2; ctx.strokeRect(1,1,158,46);
        ctx.fillStyle = '#f5d0fe'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(angle.toFixed(1) + '°',80,24);
        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:false, toneMapped:false }));
        sprite.position.copy(entry.p.clone().multiplyScalar(1.025));
        sprite.scale.set(8,2.4,1);
        sprite.renderOrder = 10;
        group.add(sprite);
      });
    }
    return () => { group.clear(); };
  }, [showTriangulation, showAngleLabels, siteCatalogue, seaLevel, terrainScale, loading]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || loading) return;
    state.countryBorders.visible = showCountryBorders;
  }, [showCountryBorders, loading]);

  useEffect(() => {
    let cancelled = false;
    const state = sceneRef.current;
    if (!state || loading) return;
    const group = state.countryBorders;
    group.clear();
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
      .then(response => {
        if (!response.ok) throw new Error('Country boundary dataset unavailable');
        return response.json();
      })
      .then((geojson: any) => {
        if (cancelled) return;
        const material = new THREE.LineBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0.88, depthWrite: false });
        const toVector = (lonValue: number, latValue: number) => {
          const lon = lonValue * Math.PI / 180;
          const lat = latValue * Math.PI / 180;
          const x = Math.max(0, Math.min(state.width - 1, Math.round(((lonValue + 180) / 360) * (state.width - 1))));
          const y = Math.max(0, Math.min(state.height - 1, Math.round(((90 - latValue) / 180) * (state.height - 1))));
          const elevation = state.heights[y * state.width + x] || 0;
          const radius = BASE_RADIUS + Math.max(elevation, seaLevelRef.current) * HEIGHT_SCALE * terrainScaleRef.current + 0.16;
          return new THREE.Vector3(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
        };
        const addRing = (coordinates: number[][]) => {
          if (coordinates.length < 2) return;
          const geometry = new THREE.BufferGeometry().setFromPoints(coordinates.map(coord => toVector(coord[0], coord[1])));
          const line = new THREE.Line(geometry, material);
          line.renderOrder = 8;
          group.add(line);
        };
        const visitGeometry = (geometry: any) => {
          if (!geometry) return;
          if (geometry.type === 'Polygon') geometry.coordinates.forEach((ring: number[][]) => addRing(ring));
          else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach((polygon: number[][][]) => polygon.forEach((ring: number[][]) => addRing(ring)));
          else if (geometry.type === 'GeometryCollection') geometry.geometries.forEach(visitGeometry);
        };
        (geojson.features || []).forEach((feature: any) => visitGeometry(feature.geometry));
      })
      .catch(error => console.warn('[NeuroPulse] Country borders could not be loaded:', error));
    return () => { cancelled = true; group.clear(); };
  }, [loading]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || loading) return;
    const group = state.constellationOverlay;
    group.clear();
    if (!showConstellationLines) return;
    // These are real constellation-line coordinates from the project's star atlas,
    // displayed as a separate celestial reference shell around the elevation globe.
    const preferred = new Set(['Orion','Ursa Major','Ursa Minor','Cassiopeia','Cygnus','Leo','Scorpius','Taurus','Crux','Pegasus','Andromeda','Gemini']);
    CONSTELLATION_LINE_SHAPES.filter(shape => preferred.has(shape.name)).forEach(shape => {
      shape.lines.forEach(line => {
        const points = line.map(([ra, dec]) => {
          const lat = dec * Math.PI / 180;
          const lon = ra * Math.PI / 180;
          const radius = BASE_RADIUS * 1.035;
          return new THREE.Vector3(radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
        });
        if (points.length < 2) return;
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: '#d8a7ff', transparent: true, opacity: 0.82, depthTest: false });
        const lineObject = new THREE.Line(geometry, material);
        lineObject.renderOrder = 9;
        group.add(lineObject);
      });
    });
    return () => { group.clear(); };
  }, [showConstellationLines, loading]);


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
            <div className="text-[9px] font-mono text-slate-500">COPERNICUS GLO-90 · REAL LAND ELEVATION</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[9px] font-mono text-slate-500">DRAG TO ROTATE · WHEEL TO ZOOM</span>
          <button onClick={onBack} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] font-mono text-slate-300 hover:border-sky-400 hover:text-white"><ArrowLeft className="h-3 w-3" /> BACK TO EARTH</button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" aria-label="Interactive three-dimensional Copernicus DEM globe" />
        <FreeStreetImageryPanel
          sites={siteCatalogue}
          selectedSite={selectedSite ? { name: selectedSite.name, lat: selectedSite.lat, lon: selectedSite.lon } : null}
          onSelectSite={site => onSelectSite?.({ name: site.name, lat: site.lat, lon: site.lon, category: site.category, color: site.color })}
        />
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 p-6 text-center"><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin text-sky-300" /><div className="text-sm font-mono text-sky-100">LOADING COPERNICUS GLO-90 ELEVATION</div><div className="mt-2 text-xs text-slate-400">{datasetInfo}</div></div></div>}
        {loadError && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/95 p-6"><div className="max-w-lg text-center"><Database className="mx-auto mb-3 h-8 w-8 text-rose-300" /><div className="text-sm font-mono font-bold text-rose-200">COPERNICUS DEM COULD NOT BE LOADED</div><p className="mt-2 text-xs text-slate-300">{loadError}</p><p className="mt-2 text-[10px] text-slate-500">This view requires measured Copernicus GLO-90 elevation samples; it will not substitute a fake terrain model.</p><a className="mt-3 inline-block text-xs text-sky-300 underline" href="https://registry.opendata.aws/copernicus-dem/" target="_blank" rel="noreferrer">Open Copernicus DEM data source ↗</a></div></div>}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 backdrop-blur">
          <div className="text-[9px] font-mono text-slate-400">GLOBAL SEA LEVEL</div>
          <div className="mt-1 text-lg font-mono font-bold text-sky-200">{seaLevel > 0 ? '+' : ''}{seaLevel.toFixed(1)} m</div>
          <div className="text-[9px] text-slate-500">{levelMode === 'historical' ? 'historical reference estimate' : 'custom scenario'}</div>
        </div>
        {selectedSite && <div className="absolute bottom-3 left-3 rounded-lg border border-rose-400/50 bg-slate-950/90 px-3 py-2 text-[10px] font-mono text-rose-100 shadow-lg">{selectedSite.name}<div className="text-[9px] text-slate-400">{selectedSite.lat.toFixed(4)}°, {selectedSite.lon.toFixed(4)}°</div><div className="mt-1 flex gap-1"><button type="button" onClick={() => onAssignChannel?.('a', selectedSite.lat, selectedSite.lon)} className="rounded border border-rose-400/60 px-2 py-0.5 text-[9px] hover:bg-rose-900/60" title="Assign this location to channel A">A</button><button type="button" onClick={() => onAssignChannel?.('b', selectedSite.lat, selectedSite.lon)} className="rounded border border-amber-400/60 px-2 py-0.5 text-[9px] hover:bg-amber-900/60" title="Assign this location to channel B">B</button><button type="button" onClick={() => onAssignChannel?.('c', selectedSite.lat, selectedSite.lon)} className="rounded border border-sky-400/60 px-2 py-0.5 text-[9px] hover:bg-sky-900/60" title="Assign this location to channel C">C</button></div></div>}
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
          <div className="flex items-center justify-between gap-2"><label htmlFor="water-transparency" className="text-[10px] font-mono font-bold text-slate-300">WATER TRANSPARENCY · {Math.round((1 - waterOpacity) * 100)}%</label><button type="button" onClick={() => setWaterOpacity(0.58)} className="text-[9px] font-mono text-slate-400 hover:text-white">RESET</button></div>
          <input id="water-transparency" aria-label="Water transparency" type="range" min="0.05" max="1" step="0.05" value={1 - waterOpacity} onChange={event => setWaterOpacity(1 - Number(event.target.value))} className="w-full accent-cyan-400" />
          <div className="flex justify-between text-[9px] text-slate-500"><span>Clear / transparent</span><span>Opaque</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:col-span-2">
          <span className="text-[9px] font-mono font-bold text-slate-400">SURFACE</span>
          <button type="button" onClick={() => setSurfaceMode('satellite')} disabled={!surfaceTextureLoaded} aria-pressed={surfaceMode === 'satellite'} className={`rounded border px-2 py-1 text-[9px] font-mono font-bold transition-colors ${surfaceMode === 'satellite' ? 'border-cyan-300 bg-cyan-900/70 text-cyan-100' : 'border-slate-700 text-slate-300 hover:border-cyan-500 disabled:opacity-40'}`}>SATELLITE TEXTURE</button>
          <button type="button" onClick={() => setSurfaceMode('relief')} aria-pressed={surfaceMode === 'relief'} className={`rounded border px-2 py-1 text-[9px] font-mono font-bold transition-colors ${surfaceMode === 'relief' ? 'border-emerald-300 bg-emerald-900/70 text-emerald-100' : 'border-slate-700 text-slate-300 hover:border-emerald-500'}`}>ELEVATION RELIEF</button>
          <button type="button" onClick={() => setShowCountryBorders(value => !value)} aria-pressed={showCountryBorders} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-mono font-bold transition-colors ${showCountryBorders ? 'border-amber-300 bg-amber-900/60 text-amber-100' : 'border-slate-700 text-slate-300 hover:border-amber-500'}`}><MapIcon className="h-3 w-3" /> COUNTRY BORDERS {showCountryBorders ? 'ON' : 'OFF'}</button>
          <span className="text-[9px] text-slate-500">{surfaceTextureError ? 'Satellite service unavailable · shaded relief active' : surfaceMode === 'satellite' ? 'World imagery draped over Copernicus GLO-90 samples' : 'Elevation-colored, hill-shaded terrain'}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 xl:col-span-2">
          <div className="min-w-0 text-[9px] text-slate-500">{datasetInfo} <span className="mx-1">·</span> <a className="text-sky-300 underline" href="https://registry.opendata.aws/copernicus-dem/" target="_blank" rel="noreferrer">Copernicus DEM GLO-90</a><span className="mx-1">via</span><a className="text-sky-300 underline" href="https://open-meteo.com/en/docs/elevation-api" target="_blank" rel="noreferrer">Open-Meteo elevation API</a><span className="mx-1">·</span> <span>Imagery © Esri and its data providers</span></div>
          <label className="flex items-center gap-2 text-[9px] font-mono text-slate-400">TERRAIN RELIEF <input type="range" min="0.6" max="1.8" step="0.1" value={terrainScale} onChange={event => setTerrainScale(Number(event.target.value))} className="w-20 accent-emerald-400" /></label>
          <label className="flex items-center gap-2 text-[9px] font-mono text-slate-400">ZOOM <input type="range" min="0.7" max="2.2" step="0.1" value={zoom} onChange={event => setZoom(Number(event.target.value))} className="w-20 accent-sky-400" /></label>
        </div>
      </div>
    </div>
  );
};

export default EarthElevation;
