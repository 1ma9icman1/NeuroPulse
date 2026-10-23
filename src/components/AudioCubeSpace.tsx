import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Globe3D from 'react-globe.gl';
import * as THREE from 'three';
import { createPortal } from 'react-dom';
import { SolarSystemView } from './SolarSystemView';
import type { EarthSiteSelection } from './EarthSiteExplorer';
import {
  CameraView,
  SpatialPosition,
  SpatialRoutingMode,
  TopPlaneOverlay,
  CelestialStar,
  TriangleInteriorAngles,
  EarthPoint,
  EarthConfig,
} from '../types';
import {
  Rotate3D,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Star,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Trash2,
  Sliders,
  Compass,
  Layers,
  Maximize,
  Minimize,
  Lock,
  Unlock,
  Pin,
  Check,
  Triangle,
  Glasses,
  MapPin,
  Plus,
  Play,
  Pause,
  X,
  Sparkles,
  Sun,
  Camera,
} from 'lucide-react';
import {
  REAL_CELESTIAL_STARS,
  STAR_ALIGNMENT_PRESETS,
  compute711Relation,
  computeTriangleInteriorAngles,
  Relation711Result,
} from '../data/celestialStars';
import { getPlanetSkyPositions, isPlanetEphemerisYearInPreferredRange } from '../data/planetaryEphemeris';
import { HYGStar, HYG_STAR_CATALOG_SOURCE, loadHYGStarCatalog } from '../data/allStarCatalog';
import { CONSTELLATION_LINE_SHAPES } from '../data/constellationLineData';
import { ACOUSTIC_SITE_EVIDENCE } from '../data/acousticSiteEvidence';
import { ANCIENT_STRUCTURE_DIMENSIONS } from '../data/ancientStructureDimensions';
import {
  DEFAULT_EARTH_POINTS,
  LEGACY_HISTORICAL_SITES,
  latLonToCartesian,
  cartesianToLatLon,
} from '../data/earthData';
import { calculateSubstellarPoint, fetchIersDut1Seconds, fetchPlaceImage, resolveStarAstrometry, EarthTarget, PlaceImage } from '../services/celestialEarthData';
import { SeaLevelDemTool } from './SeaLevelDemTool';


const calculateTimelineGmstDeg = (year: number): number => {
  const date = new Date(0);
  date.setUTCFullYear(year, 0, 1);
  date.setUTCHours(12, 0, 0, 0);
  const jd = date.getTime() / 86400000 + 2440587.5;
  const centuries = (jd - 2451545.0) / 36525.0;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    0.000387933 * centuries * centuries - centuries * centuries * centuries / 38710000;
  return ((gmst % 360) + 360) % 360;
};

interface AudioCubeSpaceProps {
  aPos: SpatialPosition;
  bPos: SpatialPosition;
  cPos: SpatialPosition;
  spatialMode: SpatialRoutingMode;
  cameraView: CameraView;
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
  aFreq: number;
  bFreq: number;
  cFreq: number;
  isRunning: boolean;
  positionPitchMode: boolean;
  onTogglePositionPitchMode: () => void;
  onUpdateAPos: (pos: SpatialPosition) => void;
  onUpdateBPos: (pos: SpatialPosition) => void;
  onUpdateCPos: (pos: SpatialPosition) => void;
  onUpdateSpatialMode: (mode: SpatialRoutingMode) => void;
  onUpdateCameraView: (view: CameraView) => void;
  onUpdateCameraAngles: (yaw: number, pitch: number) => void;
  onUpdateCameraZoom: (zoom: number) => void;
  onResetCamera: () => void;
  onSiteSelect: (site: EarthSiteSelection) => void;
  siteCatalogue?: Array<{ name: string; lat: number; lon: number; year?: number; category?: string; isCity?: boolean; color?: string; desc?: string; [key: string]: any }>;
  showChannelElevationControls?: boolean;
}

export const AudioCubeSpace: React.FC<AudioCubeSpaceProps> = ({
  aPos,
  bPos,
  cPos,
  spatialMode,
  cameraView,
  cameraYaw,
  cameraPitch,
  cameraZoom,
  aFreq,
  bFreq,
  cFreq,
  isRunning,
  positionPitchMode,
  onTogglePositionPitchMode,
  onUpdateAPos,
  onUpdateBPos,
  onUpdateCPos,
  onUpdateSpatialMode,
  onUpdateCameraView,
  onUpdateCameraAngles,
  onUpdateCameraZoom,
  onResetCamera,
  onSiteSelect,
  siteCatalogue = [],
  showChannelElevationControls = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const earthTextureRef = useRef<HTMLImageElement | null>(null);
  const earthSphereCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const earthSphereCacheKeyRef = useRef('');
  const [earthTextureLoaded, setEarthTextureLoaded] = useState(false);
  const isEarthModeActive = cameraView === 'top';
  const globeRef = useRef<any>(null);
  const [earthAtmosphere, setEarthAtmosphere] = useState(true);
  // Public, no-sign-in Earth imagery sources. The original globe and every existing overlay remain intact.
  const [earthImageryPanelOpen, setEarthImageryPanelOpen] = useState(false);
  const [earthImagerySource, setEarthImagerySource] = useState<'satellite' | 'blue-marble' | 'land-ocean'>('blue-marble');
  const earthImagerySources = {
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-180,-85,180,85&bboxSR=4326&imageSR=4326&size=2048,1024&format=jpg&transparent=false&f=image',
    'blue-marble': 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    'land-ocean': 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/land_ocean_ice_2048.png',
  };
  const [earthTextureUrl, setEarthTextureUrl] = useState<string>(earthImagerySources['blue-marble']);
  // Sea-level mode uses measured DEM elevations and ocean-connected flood fill.
  const [showSeaLevelOverlay, setShowSeaLevelOverlay] = useState(false);
  const [seaLevelFloodPolygons, setSeaLevelFloodPolygons] = useState<Array<{ layerType: 'sea-level-flood'; geometry: { type: 'Polygon'; coordinates: number[][][] } }>>([]);
  const activateSeaLevelOverlay = (enabled: boolean) => setShowSeaLevelOverlay(enabled);
  // When enabled, bring the tool to the top of the right dock so the button
  // visibly opens the panel instead of silently appending it below other tools.
  useEffect(() => {
    if (!showSeaLevelOverlay) return;
    const sidebar = document.querySelector('.atlas-right') as HTMLElement | null;
    const panel = sidebar?.querySelector('.atlas-sea-level-panel') as HTMLElement | null;
    if (!sidebar || !panel) return;
    sidebar.scrollTop = Math.max(0, panel.offsetTop - sidebar.offsetTop);
  }, [showSeaLevelOverlay]);
  const builtInEarthSites = [
    { name: 'Göbekli Tepe', lat: 37.223, lon: 38.922, year: -9600 },
    { name: 'Jericho', lat: 31.871, lon: 35.444, year: -9000 },
    { name: 'Çatalhöyük', lat: 37.668, lon: 32.828, year: -7100 },
    { name: 'Nabta Playa', lat: 22.507, lon: 30.733, year: -7000 },
    { name: 'Carnac Stones', lat: 47.584, lon: -3.079, year: -4500 },
    { name: 'Newgrange', lat: 53.694, lon: -6.475, year: -3200 },
    { name: 'Stonehenge', lat: 51.1789, lon: -1.8262, year: -3000 },
    { name: 'Great Pyramid of Giza', lat: 29.9792, lon: 31.1342, year: -2600 },
    { name: 'Mohenjo-daro', lat: 27.329, lon: 68.138, year: -2500 },
    { name: 'Petra', lat: 30.328, lon: 35.444, year: -300 },
    { name: 'Persepolis', lat: 29.935, lon: 52.891, year: -518 },
    { name: 'Teotihuacan', lat: 19.6925, lon: -98.8438, year: 100 },
    { name: 'Chichén Itzá', lat: 20.6843, lon: -88.5678, year: 600 },
    { name: 'Angkor Wat', lat: 13.4125, lon: 103.867, year: 1150 },
    { name: 'Great Zimbabwe', lat: -20.267, lon: 30.933, year: 1100 },
    { name: 'Nan Madol', lat: 6.844, lon: 158.333, year: 1200 },
    { name: 'Tenochtitlan', lat: 19.4326, lon: -99.1332, year: 1325 },
    { name: 'Machu Picchu', lat: -13.1631, lon: -72.545, year: 1450 },
    { name: 'Aksum Obelisks', lat: 14.131, lon: 38.718, year: 300 },
    { name: 'Lalibela Rock-Hewn Churches', lat: 12.031, lon: 39.047, year: 1200 },
    { name: 'Karnak Temple Complex', lat: 25.7188, lon: 32.6573, year: -2000 },
    { name: 'Abu Simbel', lat: 22.3372, lon: 31.6258, year: -1264 },
    { name: 'Dendera Temple', lat: 26.1417, lon: 32.6709, year: -225 },
    { name: 'Hattusa', lat: 40.0194, lon: 34.6158, year: -1600 },
    { name: 'Ephesus', lat: 37.939, lon: 27.341, year: -1000 },
    { name: 'Knossos Palace', lat: 35.298, lon: 25.163, year: -1900 },
    { name: 'Delphi Sanctuary', lat: 38.4824, lon: 22.501, year: -800 },
    { name: 'Mycenae', lat: 37.7308, lon: 22.756, year: -1600 },
    { name: 'Baalbek Temple Complex', lat: 34.0069, lon: 36.2039, year: -100 },
    { name: 'Ugarit', lat: 35.602, lon: 35.779, year: -1400 },
    { name: 'Hegra', lat: 26.787, lon: 37.953, year: 100 },
    { name: 'Taq Kasra', lat: 33.093, lon: 44.580, year: 540 },
    { name: 'Borobudur', lat: -7.6079, lon: 110.2038, year: 825 },
    { name: 'Prambanan', lat: -7.752, lon: 110.491, year: 850 },
    { name: 'Bagan Temples', lat: 21.1717, lon: 94.8585, year: 1000 },
    { name: 'Sukhothai Historical Park', lat: 17.007, lon: 99.823, year: 1238 },
    { name: 'Banteay Srei', lat: 13.599, lon: 103.963, year: 967 },
    { name: 'Sanchi Stupa', lat: 23.4793, lon: 77.7397, year: -250 },
    { name: 'Ajanta Caves', lat: 20.5519, lon: 75.7033, year: -200 },
    { name: 'Ellora Caves', lat: 20.0268, lon: 75.179, year: 600 },
    { name: 'Hampi', lat: 15.335, lon: 76.46, year: 1336 },
    { name: 'Great Serpent Mound', lat: 39.026, lon: -83.430, year: 1070 },
    { name: 'Cahokia Mounds', lat: 38.655, lon: -90.062, year: 1050 },
    { name: 'Mesa Verde Cliff Palace', lat: 37.167, lon: -108.475, year: 1190 },
    { name: 'Poverty Point', lat: 32.636, lon: -91.409, year: -1700 },
    { name: 'Caral', lat: -10.892, lon: -77.521, year: -2600 },
    { name: 'Sacsayhuamán', lat: -13.509, lon: -71.982, year: 1400 },
    { name: 'Tiwanaku', lat: -16.554, lon: -68.673, year: 500 },
    { name: 'Puma Punku', lat: -16.56, lon: -68.679, year: 536 },
    { name: 'Rapa Nui Moai', lat: -27.121, lon: -109.366, year: 1200 },
    { name: 'Tulum', lat: 20.214, lon: -87.429, year: 1200 },
    { name: 'Palenque', lat: 17.484, lon: -92.046, year: 226 },
    { name: 'Uxmal', lat: 20.359, lon: -89.771, year: 700 },
    { name: 'Monte Albán', lat: 17.043, lon: -96.767, year: -500 },
    { name: 'Copán', lat: 14.837, lon: -89.142, year: 400 },
    { name: 'Tikal', lat: 17.222, lon: -89.623, year: 300 },
    { name: 'Chavín de Huántar', lat: -9.593, lon: -77.178, year: -900 },
    { name: 'Hovenweep', lat: 37.383, lon: -109.071, year: 500 },
    { name: 'Ain Ghazal', lat: 31.987, lon: 35.938, year: -7250 },
    { name: 'Mehrgarh', lat: 29.384, lon: 67.623, year: -7000 },
    { name: 'Skara Brae', lat: 59.048, lon: -3.342, year: -3180 },
    { name: 'Maeshowe', lat: 58.996, lon: -3.188, year: -2800 },
    { name: 'Avebury Stone Circle', lat: 51.428, lon: -1.854, year: -2600 },
    { name: 'Callanish Standing Stones', lat: 58.198, lon: -6.745, year: -2900 },
    { name: 'Bryn Celli Ddu', lat: 53.211, lon: -4.236, year: -3000 },
    { name: 'Knowth Passage Tomb', lat: 53.709, lon: -6.493, year: -3200 },
    { name: 'Ggantija Temples', lat: 36.048, lon: 14.267, year: -3600 },
    { name: 'Tarxien Temples', lat: 35.869, lon: 14.511, year: -3150 },
    { name: 'Mnajdra Temples', lat: 35.827, lon: 14.436, year: -3600 },
    { name: 'Hagar Qim', lat: 35.827, lon: 14.440, year: -3600 },
    { name: 'Tell Brak', lat: 36.667, lon: 41.055, year: -6000 },
    { name: 'Uruk', lat: 31.324, lon: 45.637, year: -4000 },
    { name: 'Ur Ziggurat', lat: 30.962, lon: 46.103, year: -2100 },
    { name: 'Eridu', lat: 30.815, lon: 45.996, year: -5400 },
    { name: 'Amarna', lat: 27.646, lon: 30.896, year: -1346 },
    { name: 'Luxor Temple', lat: 25.699, lon: 32.639, year: -1400 },
    { name: 'Medinet Habu', lat: 25.720, lon: 32.601, year: -1180 },
    { name: 'Chaco Canyon Pueblo Bonito', lat: 36.060, lon: -107.961, year: 850 },
    { name: 'Hopewell Mound Group', lat: 39.368, lon: -83.087, year: -200 },
    { name: 'Etowah Mounds', lat: 34.125, lon: -84.801, year: 1000 },
    { name: 'Pachacamac', lat: -12.255, lon: -76.902, year: 200 },
    { name: 'Chan Chan', lat: -8.108, lon: -79.075, year: 850 },
    { name: 'Chankillo Archaeoastronomical Complex', lat: -9.557, lon: -78.228, year: -250 },
    { name: 'Kuelap', lat: -6.418, lon: -77.925, year: 500 },
    { name: 'El Tajin', lat: 20.448, lon: -97.377, year: 600 },
    { name: 'Tomb of the First Emperor', lat: 34.384, lon: 109.273, year: -210 },
    { name: 'Longmen Grottoes', lat: 34.558, lon: 112.471, year: 493 },
    { name: 'Yungang Grottoes', lat: 40.110, lon: 113.122, year: 460 },
    { name: 'My Son Sanctuary', lat: 15.764, lon: 108.123, year: 400 },
    { name: 'Sigiriya', lat: 7.957, lon: 80.760, year: 477 },
    { name: 'Anuradhapura', lat: 8.311, lon: 80.403, year: -377 },
    { name: 'Taxila', lat: 33.746, lon: 72.839, year: -600 },
    { name: 'Troy', lat: 39.957, lon: 26.239, year: -3000 },
    { name: 'Olympia Sanctuary', lat: 37.638, lon: 21.630, year: -776 },
    { name: 'Epidaurus Theatre', lat: 37.596, lon: 23.079, year: -340 },
    { name: 'Nuraghe Su Nuraxi', lat: 39.704, lon: 8.990, year: -1500 },
    { name: 'Hadrian Wall', lat: 55.024, lon: -2.290, year: 122 },

    { name: 'New York', lat: 40.7128, lon: -74.006, year: 2026, isCity: true },
    { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, year: 2026, isCity: true },
    { name: 'Mexico City', lat: 19.4326, lon: -99.1332, year: 2026, isCity: true },
    { name: 'London', lat: 51.5072, lon: -0.1276, year: 2026, isCity: true },
    { name: 'Paris', lat: 48.8566, lon: 2.3522, year: 2026, isCity: true },
    { name: 'Rome', lat: 41.9028, lon: 12.4964, year: 2026, isCity: true },
    { name: 'Cairo', lat: 30.0444, lon: 31.2357, year: 2026, isCity: true },
    { name: 'Nairobi', lat: -1.2921, lon: 36.8219, year: 2026, isCity: true },
    { name: 'Istanbul', lat: 41.0082, lon: 28.9784, year: 2026, isCity: true },
    { name: 'Delhi', lat: 28.6139, lon: 77.209, year: 2026, isCity: true },
    { name: 'Mumbai', lat: 19.076, lon: 72.8777, year: 2026, isCity: true },
    { name: 'Beijing', lat: 39.9042, lon: 116.4074, year: 2026, isCity: true },
    { name: 'Seoul', lat: 37.5665, lon: 126.978, year: 2026, isCity: true },
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503, year: 2026, isCity: true },
    { name: 'Sydney', lat: -33.8688, lon: 151.2093, year: 2026, isCity: true },
    { name: 'Auckland', lat: -36.8509, lon: 174.7645, year: 2026, isCity: true },
    { name: 'Moscow', lat: 55.7558, lon: 37.6173, year: 2026, isCity: true },
    { name: 'Reykjavik', lat: 64.1466, lon: -21.9426, year: 2026, isCity: true },
    { name: 'Honolulu', lat: 21.3099, lon: -157.8581, year: 2026, isCity: true },
    { name: 'Anchorage', lat: 61.2181, lon: -149.9003, year: 2026, isCity: true },
    { name: 'São Paulo', lat: -23.5505, lon: -46.6333, year: 2026, isCity: true },
    { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816, year: 2026, isCity: true },
    { name: 'Lima', lat: -12.0464, lon: -77.0428, year: 2026, isCity: true },
    { name: 'Bogotá', lat: 4.711, lon: -74.0721, year: 2026, isCity: true },
    { name: 'Toronto', lat: 43.6532, lon: -79.3832, year: 2026, isCity: true },
    { name: 'Vancouver', lat: 49.2827, lon: -123.1207, year: 2026, isCity: true },
    { name: 'Washington DC', lat: 38.9072, lon: -77.0369, year: 2026, isCity: true },
    { name: 'Madrid', lat: 40.4168, lon: -3.7038, year: 2026, isCity: true },
    { name: 'Athens', lat: 37.9838, lon: 23.7275, year: 2026, isCity: true },
    { name: 'Jerusalem', lat: 31.7683, lon: 35.2137, year: 2026, isCity: true },
    { name: 'Riyadh', lat: 24.7136, lon: 46.6753, year: 2026, isCity: true },
    { name: 'Tehran', lat: 35.6892, lon: 51.389, year: 2026, isCity: true },
    { name: 'Bangkok', lat: 13.7563, lon: 100.5018, year: 2026, isCity: true },
    { name: 'Singapore', lat: 1.3521, lon: 103.8198, year: 2026, isCity: true },
    { name: 'Hong Kong', lat: 22.3193, lon: 114.1694, year: 2026, isCity: true },
    { name: 'Shanghai', lat: 31.2304, lon: 121.4737, year: 2026, isCity: true },
    { name: 'Jakarta', lat: -6.2088, lon: 106.8456, year: 2026, isCity: true },
    { name: 'Cape Town', lat: -33.9249, lon: 18.4241, year: 2026, isCity: true },
    { name: 'Lagos', lat: 6.5244, lon: 3.3792, year: 2026, isCity: true },
    { name: 'Addis Ababa', lat: 8.9806, lon: 38.7578, year: 2026, isCity: true },
    { name: 'Melbourne', lat: -37.8136, lon: 144.9631, year: 2026, isCity: true },
    { name: 'Oslo', lat: 59.9139, lon: 10.7522, year: 2026, isCity: true },
    { name: 'Berlin', lat: 52.52, lon: 13.405, year: 2026, isCity: true },
    { name: 'Amsterdam', lat: 52.3676, lon: 4.9041, year: 2026, isCity: true },
    { name: 'Vienna', lat: 48.2082, lon: 16.3738, year: 2026, isCity: true },
    { name: 'Prague', lat: 50.0755, lon: 14.4378, year: 2026, isCity: true },
    { name: 'Warsaw', lat: 52.2297, lon: 21.0122, year: 2026, isCity: true },
    { name: 'Dubai', lat: 25.2048, lon: 55.2708, year: 2026, isCity: true },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639, year: 2026, isCity: true },
    { name: 'Dhaka', lat: 23.8103, lon: 90.4125, year: 2026, isCity: true },
    { name: 'Karachi', lat: 24.8607, lon: 67.0011, year: 2026, isCity: true },
    { name: 'Hanoi', lat: 21.0278, lon: 105.8342, year: 2026, isCity: true },
    { name: 'Manila', lat: 14.5995, lon: 120.9842, year: 2026, isCity: true },
    { name: 'Perth', lat: -31.9505, lon: 115.8605, year: 2026, isCity: true },
    { name: 'Edinburgh', lat: 55.9533, lon: -3.1883, year: 2026, isCity: true },
    { name: 'Lisbon', lat: 38.7223, lon: -9.1393, year: 2026, isCity: true },
    { name: 'Kyoto', lat: 35.0116, lon: 135.7681, year: 2026, isCity: true },
  ];

  // Feed every combined App catalogue record into the globe, retaining older globe-only
  // records as a fallback. The catalogue version wins for duplicate names because it
  // includes the fuller descriptions, categories and source metadata.
  const earthSites = (() => {
    const merged: any[] = [];
    const seen = new Set<string>();
    const normalizeName = (value: string) => value.toLocaleLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    for (const raw of [...(siteCatalogue as any[]), ...(builtInEarthSites as any[])]) {
      if (!raw || typeof raw.name !== 'string' ||
          !Number.isFinite(Number(raw.lat)) || !Number.isFinite(Number(raw.lon)) ||
          Number(raw.lat) < -90 || Number(raw.lat) > 90 ||
          Number(raw.lon) < -180 || Number(raw.lon) > 180) continue;
      const name = raw.name.trim();
      const key = normalizeName(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const category = String(raw.category ?? '').toLowerCase();
      const isCity = Boolean(raw.isCity) || category === 'city' || category === 'cities';
      const year = Number.isFinite(Number(raw.year)) ? Number(raw.year) : 0;
      merged.push({
        ...raw,
        id: raw.id ?? 'earth-' + key.replace(/\s+/g, '-'),
        name,
        lat: Number(raw.lat),
        lon: Number(raw.lon),
        year,
        isCity,
        color: raw.color ?? (isCity ? '#60a5fa' : category === 'astronomy' ? '#a78bfa' : category === 'acoustic' ? '#fb923c' : '#facc15'),
      });
    }
    return merged;
  })();
  // Start the Earth view centered on Poverty Point, Louisiana, in the southern United States.
  // Keep the camera at a regional scale so the US remains visible on startup.
  useEffect(() => {
    if (!isEarthModeActive || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: 32.6364, lng: -91.4062, altitude: Math.max(1.35, 2.05 - cameraZoom * 0.18) }, 650);
  }, [isEarthModeActive]);

  // Zoom changes adjust distance without moving the selected geographic center.
  useEffect(() => {
    if (!isEarthModeActive || !globeRef.current) return;
    globeRef.current.pointOfView({ altitude: Math.max(1.35, 2.05 - cameraZoom * 0.18) }, 250);
  }, [cameraZoom, isEarthModeActive]);

  useEffect(() => {
    setEarthTextureLoaded(false);
    earthTextureRef.current = null;
    earthSphereCacheKeyRef.current = '';

    const texture = new Image();
    texture.crossOrigin = 'anonymous';
    texture.onload = () => {
      // Verify canvas sampling is permitted before enabling the textured orbit-core renderer.
      try {
        const probe = document.createElement('canvas');
        probe.width = 1;
        probe.height = 1;
        const probeContext = probe.getContext('2d');
        if (!probeContext) throw new Error('Canvas 2D context unavailable');
        probeContext.drawImage(texture, 0, 0, 1, 1);
        probeContext.getImageData(0, 0, 1, 1);
        earthTextureRef.current = texture;
        earthSphereCacheKeyRef.current = '';
        setEarthTextureLoaded(true);
      } catch {
        // The WebGL globe can display cross-origin images that a 2D canvas cannot sample.
        // Fall back to the CORS-enabled Blue Marble texture for the shared globe and orbit core.
        if (earthTextureUrl !== 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg') {
          setEarthImagerySource('blue-marble');
          setEarthTextureUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
        } else {
          setEarthTextureLoaded(false);
        }
      }
    };
    texture.onerror = () => {
      // Do not leave the core as a featureless blue ball when an alternate image host fails.
      if (earthTextureUrl !== 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg') {
        setEarthImagerySource('blue-marble');
        setEarthTextureUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
      } else {
        setEarthTextureLoaded(false);
      }
    };
    texture.src = earthTextureUrl;
    return () => {
      texture.onload = null;
      texture.onerror = null;
    };
  }, [earthTextureUrl]);

  // Star Celestial Alignment Mode
  const [isStarModeActive, setIsStarModeActive] = useState<boolean>(true);
  const [showConstellationLines, setShowConstellationLines] = useState<boolean>(false);
  const IAU_CONSTELLATIONS = ["Andromeda","Antlia","Apus","Aquarius","Aquila","Ara","Aries","Auriga","Bootes","Caelum","Camelopardalis","Cancer","Canes Venatici","Canis Major","Canis Minor","Capricornus","Carina","Cassiopeia","Centaurus","Cepheus","Cetus","Chamaeleon","Circinus","Columba","Coma Berenices","Corona Australis","Corona Borealis","Corvus","Crater","Crux","Cygnus","Delphinus","Dorado","Draco","Equuleus","Eridanus","Fornax","Gemini","Grus","Hercules","Horologium","Hydra","Hydrus","Indus","Lacerta","Leo","Leo Minor","Lepus","Libra","Lupus","Lynx","Lyra","Mensa","Microscopium","Monoceros","Musca","Norma","Octans","Ophiuchus","Orion","Pavo","Pegasus","Perseus","Phoenix","Pictor","Pisces","Piscis Austrinus","Puppis","Pyxis","Reticulum","Sagitta","Sagittarius","Scorpius","Sculptor","Scutum","Serpens","Sextans","Taurus","Telescopium","Triangulum","Triangulum Australe","Tucana","Ursa Major","Ursa Minor","Vela","Virgo","Volans","Vulpecula"];
  const [constellationsEnabled, setConstellationsEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(IAU_CONSTELLATIONS.map((name) => [name, true])));
  const [showConstellationControls, setShowConstellationControls] = useState<boolean>(true);
  const [show110HzResearchComets, setShow110HzResearchComets] = useState<boolean>(false);
  const [showCities, setShowCities] = useState<boolean>(true);
  const [showAncientStructures, setShowAncientStructures] = useState<boolean>(true);
  const [showAcousticColorSystem, setShowAcousticColorSystem] = useState<boolean>(true);

  // Load the repository's LED sheet once. Each sprite shares the live texture so it
  // still appears when the browser finishes loading the PNG after markers are created.
  const retroLedAtlas = useMemo(() => {
    const texture = new THREE.TextureLoader().load(new URL('../../Retro LED Tilesheet and Neon Earth Globe.png', import.meta.url).href);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }, []);

  const makeRetroLed = useCallback((site: any) => {
    const group = new THREE.Group();
    const raw = String(site.color || '#facc15').toLowerCase();
    const row = /orange|fb923c|f97316|red|ef4444|f87171/.test(raw) ? 0
      : /yellow|gold|facc15|fbbf24/.test(raw) ? 1
      : /blue|sky|60a5fa|38bdf8/.test(raw) ? 2
      : /green|34d399|10b981|22c55e/.test(raw) ? 3
      : /purple|violet|a78bfa|f472b6|fuchsia/.test(raw) ? 4 : 1;
    // Use a camera-facing sprite, not a flat plane that can turn edge-on to the globe camera.
    // Each marker gets a cloned texture view so its UV crop cannot change other markers.
    // Ten vertical states: OFF/ON for red, yellow, blue, green, purple.
    // The right-hand column duplicates the artwork; deliberately use column one only.
    const tileTexture = retroLedAtlas.clone();
    tileTexture.repeat.set(0.5, 0.1);
    tileTexture.offset.set(0, (9 - row * 2) * 0.1);
    tileTexture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: tileTexture, transparent: true, alphaTest: 0.04, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.userData.isRetroLedSprite = true;
    sprite.userData.ledTexture = tileTexture;
    sprite.scale.set(2.0, 2.0, 1);
    group.add(sprite);
    group.scale.setScalar(1.0);
    group.userData.ledColorIndex = row;
    const beamColor = new THREE.Color(row === 0 ? '#ff302b' : row === 1 ? '#ffd52a' : row === 2 ? '#168dff' : row === 3 ? '#20ff58' : '#e13cff');
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.045, 75, 5, 1, true), new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 38;
    beam.userData.isLaserSpaceBeam = true;
    group.add(beam);
    const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 75, 4, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.65, depthWrite: false }));
    beamCore.position.y = 38;
    beamCore.userData.isLaserSpaceBeam = true;
    group.add(beamCore);
    group.userData.ledPhase = Math.abs(Number(site.lat) * 13 + Number(site.lon) * 7) % 6.28;
    return group;
  }, [retroLedAtlas]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const scene = globeRef.current?.scene?.();
      if (!scene) return;
      const now = performance.now() * 0.001;
      scene.traverse((object: any) => {
        const parent = object.parent;
        const phase = now * 2.2 + Number(parent?.userData?.ledPhase || 0);
        const isOn = Math.sin(phase) > -0.05;
        if (object.userData?.isRetroLedSprite) {
          const colorIndex = Number(parent?.userData?.ledColorIndex ?? 1);
          const texture = object.userData.ledTexture as THREE.Texture | undefined;
          if (texture) texture.offset.y = (9 - (colorIndex * 2 + (isOn ? 1 : 0))) * 0.1;
          const material = object.material as THREE.SpriteMaterial | undefined;
          if (material) {
            material.opacity = isOn ? 1 : 0.38;
            material.color.set(isOn ? '#ffffff' : '#9ca3af');
          }
          return;
        }
        if (!object.userData?.isLaserSpaceBeam) return;
        object.visible = !!parent?.userData?.showLaserSpaceOverlay;
        if (object.material) object.material.opacity = 0.2 + ((Math.sin(phase) + 1) * 0.5) * 0.5;
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, []);

  const [showAlignmentTriangles, setShowAlignmentTriangles] = useState<boolean>(false);
  const [showTriangleAngles, setShowTriangleAngles] = useState<boolean>(false);
  const [triangulationOverlay, setTriangulationOverlay] = useState<{ edges: Array<{ startLat: number; startLng: number; endLat: number; endLng: number }>; polygons: Array<{ name: string; geometry: { type: 'Polygon'; coordinates: number[][][] } }>; angleLabels: Array<{ name: string; lat: number; lon: number; label: string; isTriangleAngleLabel: true }>; siteCount: number }>({ edges: [], polygons: [], angleLabels: [], siteCount: 0 });
  const [showCosmicBeam, setShowCosmicBeam] = useState<boolean>(false);
  const [showLaserSpaceOverlay, setShowLaserSpaceOverlay] = useState<boolean>(false);
  const [showLaserStarIntersections, setShowLaserStarIntersections] = useState<boolean>(true);

  const [showLocationMenu, setShowLocationMenu] = useState<boolean>(false);
  const [showMeasuredSoundSites, setShowMeasuredSoundSites] = useState<boolean>(true);
  const [showSolfeggioReference, setShowSolfeggioReference] = useState<boolean>(false);
  const [showNear110BandOnly, setShowNear110BandOnly] = useState<boolean>(false);
  const setAllConstellations = (enabled: boolean) => setConstellationsEnabled(Object.fromEntries(IAU_CONSTELLATIONS.map((name) => [name, enabled])));
  const normalizeConstellationName = (name: string) => name.toLowerCase().replace('ö', 'o');
  const isConstellationEnabled = (name: string) => constellationsEnabled[name === 'Boötes' ? 'Bootes' : name] !== false;
  const hasConstellationGeometry = (name: string) => CONSTELLATION_LINE_SHAPES.some((shape) => normalizeConstellationName(shape.name) === normalizeConstellationName(name));
  // Historical sky timeline spanning the last 12,000 years.
  const [timelineYear, setTimelineYear] = useState<number>(new Date().getUTCFullYear());
  const timelinePlanetPositions = getPlanetSkyPositions(timelineYear);
  const planetEphemerisYearIsPreferred = isPlanetEphemerisYearInPreferredRange(timelineYear);
  const [isTimelineActive, setIsTimelineActive] = useState<boolean>(false);
  const timelineYearsAgo = new Date().getUTCFullYear() - timelineYear;
  const visibleEarthSites = [...earthSites.filter((site: any) => site.isCity ? showCities : site.year <= timelineYear).map((site: any) => ({ ...site, color: site.color ?? (site.isCity ? '#60a5fa' : String(site.category ?? '').toLowerCase() === 'astronomy' ? '#a78bfa' : String(site.category ?? '').toLowerCase() === 'acoustic' ? '#fb923c' : '#facc15'), size: site.isCity ? 0.10 : 0.12, altitude: 0.0015, layerCategory: site.isCity ? 'CITY' : String(site.category ?? 'ANCIENT / HISTORICAL SITE').toUpperCase() })), ...(showAncientStructures ? ANCIENT_STRUCTURE_DIMENSIONS.filter((structure) => !earthSites.some((site: any) => !site.isCity && Math.abs(site.lat - structure.lat) < 0.08 && Math.abs(site.lon - structure.lon) < 0.08)).map((structure) => ({ name: structure.name, lat: structure.lat, lon: structure.lon, year: -3500, color: '#facc15', size: 0.12, altitude: 0.0015, layerCategory: 'ANCIENT STRUCTURE HEIGHT', structuralHeightFt: structure.approximateHeightFt, heightBasis: structure.heightBasis, heightNote: structure.evidenceNote, numberSystem: structure.numberSystem, numberSystemNote: structure.numberSystemNote, orientationNote: structure.orientationNote, ritualContext: structure.ritualContext, isDimensionRecord: true })) : []), ...(timelineYear >= -4000 && showMeasuredSoundSites ? ACOUSTIC_SITE_EVIDENCE.filter((site) => !showNear110BandOnly || site.measuredFrequenciesHz.some((hz) => hz >= 108 && hz <= 114) || (site.measurementContext || '').includes('95–120 Hz')).map((site) => ({ name: site.name, lat: site.lat, lon: site.lon, year: -3500, color: '#fb923c', size: 0.14, altitude: 0.0015, evidenceStatus: site.status, layerCategory: site.status === 'published-measurement' ? 'MEASURED SOUND' : 'SOUND CANDIDATE', measuredFrequenciesHz: site.measuredFrequenciesHz, measurementSummary: site.measurementContext || site.summary, measuredHz: site.measuredFrequenciesHz.reduce((best, hz) => Math.abs(hz - 111) < Math.abs(best - 111) ? hz : best, site.measuredFrequenciesHz[0]) })) : []), ...(showAncientStructures ? LEGACY_HISTORICAL_SITES.filter((legacy) => !earthSites.some((site: any) => !site.isCity && site.name.toLowerCase() === legacy.name.toLowerCase()) && !ANCIENT_STRUCTURE_DIMENSIONS.some((structure) => structure.name.toLowerCase() === legacy.name.toLowerCase()) && !DEFAULT_EARTH_POINTS.some((point) => point.name.toLowerCase() === legacy.name.toLowerCase()) && timelineYear >= legacy.year).map((site) => ({ name: site.name, lat: site.lat, lon: site.lon, year: site.year, color: '#34d399', size: 0.115, altitude: 0.0015, layerCategory: 'HISTORICAL & ARCHAEOLOGICAL', historicalRecord: true, researchReason: 'Historical or archaeological reference location included for research context. Its presence on the globe is not evidence of a specific resonance or frequency; that requires site-specific measurements.' })) : [])];
  const triangleEdges = showAlignmentTriangles ? triangulationOverlay.edges : [];
  const trianglePolygons = showAlignmentTriangles ? triangulationOverlay.polygons : [];
  const repeatedTriangleAngles: Array<[string, number]> = [];

  // One-shot geographic triangulation: nearest-neighbour mesh across cities, monuments,
  // historic places, and acoustic locations. Results are held in state, not recalculated
  // on every render or animation frame.
  const triangulateEarthLocations = () => {
    const uniqueSites = new Map<string, any>();
    visibleEarthSites.forEach((site: any) => {
      if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon)) return;
      const key = String(site.name || '').trim().toLocaleLowerCase() + ':' + Number(site.lat).toFixed(5) + ':' + Number(site.lon).toFixed(5);
      if (site.name && !uniqueSites.has(key)) uniqueSites.set(key, site);
    });
    const sites = Array.from(uniqueSites.values());
    const distance = (a: any, b: any) => {
      const rad = Math.PI / 180;
      const dLat = (b.lat - a.lat) * rad;
      const dLon = (b.lon - a.lon) * rad;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    };
    const siteKey = (site: any) => String(site.name || '') + '|' + Number(site.lat).toFixed(5) + '|' + Number(site.lon).toFixed(5);
    const edgeMap = new Map<string, { startLat: number; startLng: number; endLat: number; endLng: number }>();
    const triangleMap = new Map<string, { name: string; geometry: { type: 'Polygon'; coordinates: number[][][] } }>();
    const angleLabels: Array<{ name: string; lat: number; lon: number; label: string; isTriangleAngleLabel: true }> = [];
    const nearestBySite = new Map<string, any[]>();
    sites.forEach((site: any) => {
      const nearest = sites.filter((other: any) => siteKey(other) !== siteKey(site))
        .map((other: any) => ({ site: other, distance: distance(site, other) }))
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 3).map((entry: any) => entry.site);
      nearestBySite.set(siteKey(site), nearest);
      nearest.forEach((other: any) => {
        const aKey = siteKey(site), bKey = siteKey(other);
        const key = [aKey, bKey].sort().join('::');
        if (!edgeMap.has(key)) edgeMap.set(key, { startLat: site.lat, startLng: site.lon, endLat: other.lat, endLng: other.lon });
      });
    });
    sites.forEach((site: any) => {
      const nearest = nearestBySite.get(siteKey(site)) || [];
      for (let i = 0; i < nearest.length; i++) for (let j = i + 1; j < nearest.length; j++) {
        const a = site, b = nearest[i], c = nearest[j];
        const keys = [siteKey(a), siteKey(b), siteKey(c)].sort();
        const key = keys.join('::');
        if (triangleMap.has(key)) continue;
        // Reject nearly-collinear triples so the overlay reads as a clean mesh.
        const x1 = (b.lon - a.lon) * Math.cos(a.lat * Math.PI / 180), y1 = b.lat - a.lat;
        const x2 = (c.lon - a.lon) * Math.cos(a.lat * Math.PI / 180), y2 = c.lat - a.lat;
        if (Math.abs(x1 * y2 - y1 * x2) < 0.00001) continue;
        triangleMap.set(key, {
          name: [a.name, b.name, c.name].join(' / '),
          geometry: { type: 'Polygon', coordinates: [[[a.lon, a.lat], [b.lon, b.lat], [c.lon, c.lat], [a.lon, a.lat]]] },
        });
        // Calculate the three interior angles on a local tangent plane and place their
        // compact readout at the triangle center. These labels are independently toggleable.
        const project = (p: any) => ({ x: (p.lon - a.lon) * Math.cos(a.lat * Math.PI / 180), y: p.lat - a.lat });
        const pa = project(a), pb = project(b), pc = project(c);
        const angleAt = (p: {x:number;y:number}, q: {x:number;y:number}, r: {x:number;y:number}) => {
          const u = { x: q.x - p.x, y: q.y - p.y }, v = { x: r.x - p.x, y: r.y - p.y };
          const denom = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
          if (!denom) return 0;
          return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / denom))) * 180 / Math.PI;
        };
        const angles = [angleAt(pa, pb, pc), angleAt(pb, pa, pc), angleAt(pc, pa, pb)];
        angleLabels.push({
          name: [a.name, b.name, c.name].join(' / '),
          lat: (a.lat + b.lat + c.lat) / 3,
          lon: (a.lon + b.lon + c.lon) / 3,
          label: angles.map((value) => `${Math.round(value)}°`).join(' · '),
          isTriangleAngleLabel: true,
        });
      }
    });
    setTriangulationOverlay({ edges: Array.from(edgeMap.values()), polygons: Array.from(triangleMap.values()), angleLabels, siteCount: sites.length });
    setShowAlignmentTriangles(true);
  };
  const [isStarPanelExpanded, setIsStarPanelExpanded] = useState<boolean>(false);
  // Keep the Star Search / alignment controls visibly open in the right sidebar when STARS is clicked.
  useEffect(() => {
    if (!isStarPanelExpanded) return;
    setIsStarModeActive(true);
    setIsCelestialDeckCollapsed(false);
    const revealStarControls = () => {
      const sidebar = document.querySelector('.atlas-right') as HTMLElement | null;
      const panel = sidebar?.querySelector('.atlas-star-alignment-panel') as HTMLElement | null;
      if (!sidebar || !panel) return;
      const panelTop = panel.getBoundingClientRect().top - sidebar.getBoundingClientRect().top + sidebar.scrollTop;
      sidebar.scrollTop = Math.max(0, panelTop - 8);
    };
    requestAnimationFrame(revealStarControls);
  }, [isStarPanelExpanded]);
  const [isCelestialDeckCollapsed, setIsCelestialDeckCollapsed] = useState<boolean>(false);
  const [showDetailedStarInfo, setShowDetailedStarInfo] = useState<boolean>(true);
  const [showAllStars, setShowAllStars] = useState(false);
  const [allStarCatalog, setAllStarCatalog] = useState<HYGStar[]>([]);
  const [allStarLoading, setAllStarLoading] = useState(false);
  const [allStarLoadError, setAllStarLoadError] = useState<string | null>(null);
  const [allStarsDistanceSlider, setAllStarsDistanceSlider] = useState(25);
  const [is24HourRotationActive, setIs24HourRotationActive] = useState(false);
  const [isSolarSystemMode, setIsSolarSystemMode] = useState(false);
  const [showSunCenterPrompt, setShowSunCenterPrompt] = useState(false);
  const [solarSystemEpochMs, setSolarSystemEpochMs] = useState(() => Date.now());
  const [dailyRotationDegrees, setDailyRotationDegrees] = useState(0);
  const dailyRotationDegreesRef = useRef(0);
  const dailyRotationSessionStartRef = useRef<number | null>(null);
  const dailyRotationBaseRef = useRef(0);

  const toggle24HourRotation = () => {
    if (is24HourRotationActive) {
      dailyRotationBaseRef.current = dailyRotationDegreesRef.current;
      dailyRotationSessionStartRef.current = null;
      setIs24HourRotationActive(false);
      return;
    }
    dailyRotationBaseRef.current = dailyRotationDegreesRef.current;
    dailyRotationSessionStartRef.current = performance.now();
    setIs24HourRotationActive(true);
  };

  // Continuous 24-hour rotation: accumulate the angle across every day and across
  // pauses; never wrap the simulation clock back to zero after 24 or 25 hours.
  useEffect(() => {
    if (!is24HourRotationActive) return;
    const tick = () => {
      const startedAt = dailyRotationSessionStartRef.current;
      if (startedAt === null) return;
      const angle = dailyRotationBaseRef.current + ((performance.now() - startedAt) / 24000) * 360;
      dailyRotationDegreesRef.current = angle;
      setDailyRotationDegrees(angle);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [is24HourRotationActive]);

  // Globe.gl can mount after React's first effect pass, so retry while the 24-hour
  // simulation is enabled. Three.js OrbitControls interprets autoRotateSpeed per frame;
  // this value yields one full turn per 24 hours at 60fps.
  useEffect(() => {
    if (!is24HourRotationActive || !isEarthModeActive) {
      const controls = globeRef.current?.controls?.();
      if (controls) { controls.autoRotate = false; controls.update?.(); }
      return;
    }
    const syncControls = () => {
      const controls = globeRef.current?.controls?.();
      if (!controls) return false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = -2.5;
      controls.update?.();
      return true;
    };
    syncControls();
    const timer = window.setInterval(syncControls, 500);
    return () => {
      window.clearInterval(timer);
      const controls = globeRef.current?.controls?.();
      if (controls) controls.autoRotate = false;
    };
  }, [is24HourRotationActive, isEarthModeActive]);
  const [earthLocateTarget, setEarthLocateTarget] = useState<EarthTarget | null>(null);
  const [earthLocateImage, setEarthLocateImage] = useState<PlaceImage | null>(null);
  const [earthLocateLoading, setEarthLocateLoading] = useState(false);
  const [earthLocateImageLoading, setEarthLocateImageLoading] = useState(false);
  const [earthMapView, setEarthMapView] = useState<'map' | 'terrain' | 'satellite'>('map');
  const [earthStreetViewFallback, setEarthStreetViewFallback] = useState(false);
  useEffect(() => {
    if (!earthLocateTarget) return;
    setEarthStreetViewFallback(false);
    // Street View can silently show a blank/error frame when no nearby panorama exists.
    // Fall back to a close satellite image instead of leaving an empty panel.
    const fallbackTimer = window.setTimeout(() => setEarthStreetViewFallback(true), 10000);
    return () => window.clearTimeout(fallbackTimer);
  }, [earthLocateTarget]);
  const [selectedEarthSite, setSelectedEarthSite] = useState<EarthSiteSelection | null>(null);
  const openEarthSite = (site: EarthSiteSelection) => {
    setSelectedEarthSite(site);
    onSiteSelect(site);
    onUpdateCameraView('top');
    window.setTimeout(() => globeRef.current?.pointOfView({ lat: site.lat, lng: site.lon, altitude: 0.48 }, 850), 150);
  };
  const handleLocateStarOnEarth = async (star: CelestialStar) => {
    setEarthLocateLoading(true);
    setEarthLocateImage(null);
    setEarthLocateTarget(null);
    const observationDate = new Date();
    if (isTimelineActive) observationDate.setUTCFullYear(timelineYear);
    try {
      const [astrometry, dut1Seconds] = await Promise.all([
        resolveStarAstrometry({ name: star.name, raDeg: star.raDeg, decDeg: star.decDeg }, observationDate),
        fetchIersDut1Seconds(observationDate),
      ]);
      const source = dut1Seconds === null ? astrometry.source : `${astrometry.source} + IERS Earth rotation`;
      const target = calculateSubstellarPoint(astrometry.raDeg, astrometry.decDeg, observationDate, source, dut1Seconds ?? 0);
      setEarthLocateTarget(target);
      setEarthLocateLoading(false);
      setEarthLocateImageLoading(true);
      onUpdateCameraView('top');
      window.setTimeout(() => {
        globeRef.current?.pointOfView({ lat: target.latitude, lng: target.longitude, altitude: 0.65 }, 900);
      }, 150);
      const image = await fetchPlaceImage(target.latitude, target.longitude, star.name);
      setEarthLocateImage(image);
    } catch (error) {
      console.error('Unable to locate star on Earth:', error);
      setEarthLocateTarget(null);
    } finally {
      setEarthLocateLoading(false);
      setEarthLocateImageLoading(false);
    }
  };
  const [selectedStarPreset, setSelectedStarPreset] = useState<string>('orion-sirius-meridian');
  const [starAId, setStarAId] = useState<string>('betelgeuse');
  const [starBId, setStarBId] = useState<string>('rigel');
  const [starCId, setStarCId] = useState<string>('sirius');

  // Active channel target for clicking and snapping to stars: 'a' | 'b' | 'c'
  const [snapTargetChannel, setSnapTargetChannel] = useState<'a' | 'b' | 'c'>('a');

  // Locked-to-star states: when true, channels stay firmly at their assigned celestial star positions
  const [lockedChannels, setLockedChannels] = useState<{ a: boolean; b: boolean; c: boolean }>({
    a: true,
    b: true,
    c: true,
  });
  const [isEarthAssignMode, setIsEarthAssignMode] = useState<boolean>(false);
  const [earthChannelTargets, setEarthChannelTargets] = useState<{
    a: { lat: number; lng: number } | null;
    b: { lat: number; lng: number } | null;
    c: { lat: number; lng: number } | null;
  }>({ a: null, b: null, c: null });

  // Recompute the inertial 3D position of each locked Earth-fixed site as the
  // historical simulation year changes; the map/globe marker stays at its lat/lng.
  useEffect(() => {
    const gmstDeg = calculateTimelineGmstDeg(timelineYear) + dailyRotationDegrees;
    (['a', 'b', 'c'] as const).forEach((channel) => {
      const target = earthChannelTargets[channel];
      if (!target || !lockedChannels[channel]) return;
      const position = latLonToCartesian(target.lat, target.lng, 3.42, gmstDeg, 23.439281);
      if (channel === 'a') onUpdateAPos(position);
      else if (channel === 'b') onUpdateBPos(position);
      else onUpdateCPos(position);
    });
    // Position callbacks are supplied inline by the parent; target/lock/time state
    // is sufficient to avoid an update loop when callbacks are re-created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineYear, earthChannelTargets, lockedChannels, dailyRotationDegrees]);

  const earthChannelMarkers = (['a', 'b', 'c'] as const).flatMap((channel) => {
    const target = earthChannelTargets[channel];
    if (!target) return [];
    const color = channel === 'a' ? '#00f0ff' : channel === 'b' ? '#ff007f' : '#fbbf24';
    return [{
      name: `CH-${channel.toUpperCase()}`,
      channel,
      isChannelTarget: true,
      locked: lockedChannels[channel],
      lat: target.lat,
      lon: target.lng,
      color,
      size: 0.35,
      altitude: 0.025,
      layerCategory: 'CHANNEL TARGET',
    }];
  });

  const [hoveredStar, setHoveredStar] = useState<CelestialStar | null>(null);
  const [clickedStar, setClickedStar] = useState<CelestialStar | null>(null);
  const [snapFeedback, setSnapFeedback] = useState<string | null>(null);

  // Fullscreen state for 3D Stage
  const [isStageFullscreen, setIsStageFullscreen] = useState<boolean>(false);

  // Top Plane Image Overlay
  const [overlay, setOverlay] = useState<TopPlaneOverlay>({
    imageUrl: null,
    imageName: null,
    opacity: 0.65,
    scale: 1.0,
    visible: true,
  });
  const overlayImageRef = useRef<HTMLImageElement | null>(null);
  const [showOverlayControls, setShowOverlayControls] = useState<boolean>(false);

  // Dragging states
  const [activeDrag, setActiveDrag] = useState<'a' | 'b' | 'c' | 'camera' | null>(null);
  const [hoverNode, setHoverNode] = useState<'a' | 'b' | 'c' | null>(null);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const cameraStartAngle = useRef({ yaw: cameraYaw, pitch: cameraPitch });

  // Star click tracking: tracks number of stars clicked (activates interior triangle angles after 3 stars)
  const [clickedStarCount, setClickedStarCount] = useState<number>(3); // Initialized with 3 default celestial stars

  // Compute 7-11 real-world astrometric relation on angles
  const relation711: Relation711Result = compute711Relation(aPos, bPos, cPos);

  // Compute authentic Euclidean 3D triangle interior angles at vertices A, B, and C (sum = 180.0°)
  const interiorAngles: TriangleInteriorAngles = computeTriangleInteriorAngles(aPos, bPos, cPos);

  // Monitor fullscreen change on stage
  useEffect(() => {
    const handleFsChange = () => {
      setIsStageFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleStageFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (err) {
      console.warn('Stage fullscreen error:', err);
    }
  };

  // First-order general-precession visualization (~50.29 arcsec/year): shift ecliptic
  // longitude, then transform back to equatorial XYZ. This is illustrative, not a precision
  // IAU/astrometry solution over 12 millennia.
  const celestialPosition = (star: Pick<CelestialStar, 'raDeg' | 'decDeg'>, radius = 7.8): SpatialPosition => {
    const ra = ((star.raDeg + dailyRotationDegreesRef.current) * Math.PI) / 180;
    const dec = (star.decDeg * Math.PI) / 180;
    const eps = 23.439281 * Math.PI / 180;
    const eqX = Math.cos(dec) * Math.cos(ra);
    const eqY = Math.cos(dec) * Math.sin(ra);
    const eqZ = Math.sin(dec);
    const eclY = eqY * Math.cos(eps) + eqZ * Math.sin(eps);
    const eclZ = -eqY * Math.sin(eps) + eqZ * Math.cos(eps);
    const eclLon = Math.atan2(eclY, eqX) + (timelineYearsAgo * 50.29 / 3600) * Math.PI / 180;
    const eclLat = Math.asin(Math.max(-1, Math.min(1, eclZ)));
    const x = Math.cos(eclLat) * Math.cos(eclLon);
    const yEcl = Math.cos(eclLat) * Math.sin(eclLon);
    const zEcl = Math.sin(eclLat);
    const y = yEcl * Math.cos(eps) - zEcl * Math.sin(eps);
    const z = yEcl * Math.sin(eps) + zEcl * Math.cos(eps);
    return { x: radius * x, y: radius * y, z: radius * z };
  };

  // When day rotation is active, A/B/C channels locked to stars follow the same apparent
  // daily sky motion as their assigned stars; Earth-locked channels use the Earth-fixed effect above.
  useEffect(() => {
    if (!is24HourRotationActive) return;
    (['a', 'b', 'c'] as const).forEach((channel) => {
      if (!lockedChannels[channel] || earthChannelTargets[channel]) return;
      const starId = channel === 'a' ? starAId : channel === 'b' ? starBId : starCId;
      const star = REAL_CELESTIAL_STARS.find((item) => item.id === starId);
      if (!star) return;
      const position = celestialPosition(star);
      if (channel === 'a') onUpdateAPos(position);
      else if (channel === 'b') onUpdateBPos(position);
      else onUpdateCPos(position);
    });
    // Inline position callbacks are omitted to avoid running again on each parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is24HourRotationActive, dailyRotationDegrees, lockedChannels, earthChannelTargets, starAId, starBId, starCId]);

  const allStarsDistanceLimitLy = Math.round(10 * Math.pow(10, allStarsDistanceSlider / 25));
  const visibleAllStarPositions = useMemo(() => {
    if (!showAllStars || allStarCatalog.length === 0) return [];
    const maximumDistance = 100000;
    return allStarCatalog
      .filter((star) => star.distanceLy <= allStarsDistanceLimitLy)
      .map((star) => ({
        star,
        // Logarithmic spatial compression preserves near/far order without flattening
        // every star onto the same sphere. The measured catalog distance drives radius.
        position: celestialPosition(
          { raDeg: star.raDeg, decDeg: star.decDeg },
          2.0 + (Math.log1p(star.distanceLy) / Math.log1p(maximumDistance)) * 5.8
        ),
      }));
  }, [showAllStars, allStarCatalog, allStarsDistanceLimitLy, timelineYear, dailyRotationDegrees]);

  const loadAllStars = async () => {
    if (allStarLoading) return;
    setAllStarLoading(true);
    setAllStarLoadError(null);
    try {
      const stars = await loadHYGStarCatalog();
      setAllStarCatalog(stars);
      setShowAllStars(true);
    } catch (error) {
      setAllStarLoadError(error instanceof Error ? error.message : 'Unable to load the HYG star catalog.');
    } finally {
      setAllStarLoading(false);
    }
  };

  const handleToggleAllStars = () => {
    if (showAllStars) {
      setShowAllStars(false);
      return;
    }
    setIsStarModeActive(true);
    setShowAllStars(true);
    if (allStarCatalog.length === 0) void loadAllStars();
  };

  const formatLightYears = (distance: number) => distance >= 1000
    ? Math.round(distance).toLocaleString() + ' ly'
    : Math.round(distance).toLocaleString() + ' ly';

  // Initialize the selected real-star alignment on load; later user selections remain interactive.
  useEffect(() => {
    const preset = STAR_ALIGNMENT_PRESETS.find((item) => item.id === selectedStarPreset);
    if (!preset) return;
    const starA = REAL_CELESTIAL_STARS.find((star) => star.id === preset.starAId);
    const starB = REAL_CELESTIAL_STARS.find((star) => star.id === preset.starBId);
    const starC = REAL_CELESTIAL_STARS.find((star) => star.id === preset.starCId);
    setStarAId(preset.starAId);
    setStarBId(preset.starBId);
    setStarCId(preset.starCId);
    if (starA) onUpdateAPos(celestialPosition(starA));
    if (starB) onUpdateBPos(celestialPosition(starB));
    if (starC) onUpdateCPos(celestialPosition(starC));
    setLockedChannels({ a: true, b: true, c: true });
    setClickedStarCount(3);
  // Intentional one-time setup only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Image Upload for Top Plane
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const img = new Image();
      img.src = url;
      img.onload = () => {
        overlayImageRef.current = img;
        setOverlay((prev) => ({
          ...prev,
          imageUrl: url,
          imageName: file.name,
          visible: true,
        }));
        setShowOverlayControls(true);
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClearOverlay = () => {
    overlayImageRef.current = null;
    setOverlay({
      imageUrl: null,
      imageName: null,
      opacity: 0.65,
      scale: 1.0,
      visible: true,
    });
    setShowOverlayControls(false);
  };

  // Snap channel to a star and lock it in place so it stays there
  const handleSnapChannelToStar = (channel: 'a' | 'b' | 'c', star: CelestialStar) => {
    // A new star assignment replaces any previously assigned Earth target.
    setEarthChannelTargets((prev) => ({ ...prev, [channel]: null }));
    const nextCount = clickedStarCount + 1;
    setClickedStarCount(nextCount);
    setShowTriangleAngles(true);

    if (channel === 'a') {
      setStarAId(star.id);
      onUpdateAPos(celestialPosition(star));
      setLockedChannels((prev) => ({ ...prev, a: true }));
      setSnapTargetChannel('b'); // auto-advance to next channel
    } else if (channel === 'b') {
      setStarBId(star.id);
      onUpdateBPos(celestialPosition(star));
      setLockedChannels((prev) => ({ ...prev, b: true }));
      setSnapTargetChannel('c'); // auto-advance to next channel
    } else if (channel === 'c') {
      setStarCId(star.id);
      onUpdateCPos(celestialPosition(star));
      setLockedChannels((prev) => ({ ...prev, c: true }));
      setSnapTargetChannel('a'); // loop back to 'a'
    }

    if (nextCount >= 3) {
      setSnapFeedback(`★ 3 STARS CLICKED! INTERIOR TRIANGLE ANGLES COMPUTED & DISPLAYED (∠A, ∠B, ∠C)`);
    } else {
      setSnapFeedback(
        `★ [${nextCount}/3 STARS] CH-${channel.toUpperCase()} SNAPPED TO ${star.name.toUpperCase()} (CLICK ${
          3 - nextCount
        } MORE)`
      );
    }
    window.setTimeout(() => setSnapFeedback(null), 3800);
  };

  useEffect(() => {
    const assign = (event: Event) => {
      const detail = (event as CustomEvent<{ channel: 'a' | 'b' | 'c'; latitude: number; longitude: number }>).detail;
      if (detail && ['a', 'b', 'c'].includes(detail.channel)) handlePinChannelToEarth(detail.channel, detail.latitude, detail.longitude);
    };
    window.addEventListener('neuro-pulse-assign-earth-site', assign);
    return () => window.removeEventListener('neuro-pulse-assign-earth-site', assign);
  }, [timelineYear]);

  const handlePinChannelToEarth = (channel: 'a' | 'b' | 'c', latitude: number, longitude: number) => {
    const lat = Math.max(-89.999, Math.min(89.999, latitude));
    const lng = ((longitude + 180) % 360 + 360) % 360 - 180;
    const gmstDeg = calculateTimelineGmstDeg(timelineYear) + dailyRotationDegreesRef.current;
    const position = latLonToCartesian(lat, lng, 3.42, gmstDeg, 23.439281);

    setEarthChannelTargets((prev) => ({ ...prev, [channel]: { lat, lng } }));
    // Assigning an Earth location means lock there, not just move once.
    setLockedChannels((prev) => ({ ...prev, [channel]: true }));
    setClickedStar(null);
    setShowTriangleAngles(false);

    if (channel === 'a') {
      setStarAId('');
      onUpdateAPos(position);
      setSnapTargetChannel('b');
    } else if (channel === 'b') {
      setStarBId('');
      onUpdateBPos(position);
      setSnapTargetChannel('c');
    } else {
      setStarCId('');
      onUpdateCPos(position);
      setSnapTargetChannel('a');
    }

    setSnapFeedback(`CH-${channel.toUpperCase()} pinned to Earth · ${lat.toFixed(3)}°, ${lng.toFixed(3)}°`);
    window.setTimeout(() => setSnapFeedback(null), 3000);
  };

  const handleToggleChannelLock = (channel: 'a' | 'b' | 'c') => {
    if (lockedChannels[channel]) {
      setLockedChannels((prev) => ({ ...prev, [channel]: false }));
      setSnapFeedback('CH-' + channel.toUpperCase() + ' unlocked · saved Earth target remains available to relock');
      window.setTimeout(() => setSnapFeedback(null), 3000);
      return;
    }

    const earthTarget = earthChannelTargets[channel];
    const starId = channel === 'a' ? starAId : channel === 'b' ? starBId : starCId;
    const star = REAL_CELESTIAL_STARS.find((item) => item.id === starId);
    const position = earthTarget
      ? latLonToCartesian(earthTarget.lat, earthTarget.lng, 3.42, calculateTimelineGmstDeg(timelineYear) + dailyRotationDegreesRef.current, 23.439281)
      : star ? celestialPosition(star) : null;

    if (position) {
      if (channel === 'a') onUpdateAPos(position);
      else if (channel === 'b') onUpdateBPos(position);
      else onUpdateCPos(position);
    }
    setLockedChannels((prev) => ({ ...prev, [channel]: true }));
    if (earthTarget) {
      if (channel === 'a') setStarAId('');
      else if (channel === 'b') setStarBId('');
      else setStarCId('');
      setSnapFeedback('CH-' + channel.toUpperCase() + ' locked to Earth · ' + earthTarget.lat.toFixed(3) + '°, ' + earthTarget.lng.toFixed(3) + '°');
    } else {
      setSnapFeedback('CH-' + channel.toUpperCase() + ' locked to ' + (star?.name || 'current position'));
    }
    window.setTimeout(() => setSnapFeedback(null), 3000);
  };

  // Apply Star Alignment Preset
  const handleSelectStarPreset = (presetId: string) => {
    setSelectedStarPreset(presetId);
    const p = STAR_ALIGNMENT_PRESETS.find((x) => x.id === presetId);
    if (!p) return;

    setStarAId(p.starAId);
    setStarBId(p.starBId);
    setStarCId(p.starCId);
    setEarthChannelTargets({ a: null, b: null, c: null });

    const starA = REAL_CELESTIAL_STARS.find((s) => s.id === p.starAId);
    const starB = REAL_CELESTIAL_STARS.find((s) => s.id === p.starBId);
    const starC = REAL_CELESTIAL_STARS.find((s) => s.id === p.starCId);

    if (starA) onUpdateAPos(celestialPosition(starA));
    if (starB) onUpdateBPos(celestialPosition(starB));
    if (starC) onUpdateCPos(celestialPosition(starC));

    // Lock all 3 to stay at the astrometric star positions
    setLockedChannels({ a: true, b: true, c: true });
    setClickedStarCount(3);
    setShowTriangleAngles(true);
    setSnapFeedback(`★ 3 STARS ALIGNED: ${p.name} — INTERIOR ANGLES COMPUTED`);
    window.setTimeout(() => setSnapFeedback(null), 3800);
  };

  const updateCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
  }, []);

  useEffect(() => {
    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, [updateCanvasDimensions]);

  // Project 3D coordinate (x: -8..8, y: -8..8, z: -8..8) to 2D screen
  const project3D = useCallback(
    (x: number, y: number, z: number, w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const baseScale = Math.min(w, h) * 0.075 * cameraZoom;

      if (cameraView === 'top') {
        return {
          sx: cx + x * baseScale * 1.25,
          sy: cy + z * baseScale * 1.25,
          depthScale: 1.0,
        };
      } else if (cameraView === 'front') {
        return {
          sx: cx + x * baseScale * 1.25,
          sy: cy - y * baseScale * 1.25,
          depthScale: 1.0,
        };
      } else {
        const radYaw = (cameraYaw * Math.PI) / 180;
        const radPitch = (cameraPitch * Math.PI) / 180;

        // Rotate Y (Yaw)
        const rx = x * Math.cos(radYaw) - z * Math.sin(radYaw);
        const rz = x * Math.sin(radYaw) + z * Math.cos(radYaw);

        // Rotate X (Pitch)
        const ry = y * Math.cos(radPitch) - rz * Math.sin(radPitch);
        const rz2 = y * Math.sin(radPitch) + rz * Math.cos(radPitch);

        const cameraDist = 28;
        const fov = 350;
        const depth = cameraDist + rz2;
        const factor = fov / Math.max(6, depth);

        return {
          sx: cx + rx * factor * baseScale * 0.065,
          sy: cy - ry * factor * baseScale * 0.065,
          depthScale: factor / (fov / cameraDist),
        };
      }
    },
    [cameraView, cameraYaw, cameraPitch, cameraZoom]
  );

  // Keep the celestial sky on the same camera projection when switching between
  // the working 3D orbit and the Earth/top-plane view. Do not change project3D:
  // the 3D orbit's room, planets, Earth core, and A/B/C puck projection depend on it.
  const projectCelestial3D = useCallback(
    (x: number, y: number, z: number, w: number, h: number) => {
      if (cameraView !== 'top') return project3D(x, y, z, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const baseScale = Math.min(w, h) * 0.075 * cameraZoom;
      const radYaw = (cameraYaw * Math.PI) / 180;
      const radPitch = (cameraPitch * Math.PI) / 180;

      // Mirror the existing perspective branch in project3D exactly.
      // Celestial coordinates use this in top-plane view so stars/constellations
      // retain their screen positions when switching views.
      const rx = x * Math.cos(radYaw) - z * Math.sin(radYaw);
      const rz = x * Math.sin(radYaw) + z * Math.cos(radYaw);
      const ry = y * Math.cos(radPitch) - rz * Math.sin(radPitch);
      const rz2 = y * Math.sin(radPitch) + rz * Math.cos(radPitch);
      const cameraDist = 28;
      const fov = 350;
      const depth = cameraDist + rz2;
      const factor = fov / Math.max(6, depth);

      return {
        sx: cx + rx * factor * baseScale * 0.065,
        sy: cy - ry * factor * baseScale * 0.065,
        depthScale: factor / (fov / cameraDist),
      };
    },
    [cameraView, cameraYaw, cameraPitch, cameraZoom, project3D]
  );

  const handleSunCenterHit = useCallback((screenX: number, screenY: number, width: number, height: number) => {
    if (!isStarModeActive || isSolarSystemMode) return false;
    const sun = timelinePlanetPositions.find((planet) => planet.id === 'sun');
    if (!sun) return false;
    const sunPosition = celestialPosition(sun);
    const projected = projectCelestial3D(sunPosition.x, sunPosition.y, sunPosition.z, width, height);
    if (Math.hypot(screenX - projected.sx, screenY - projected.sy) > 22) return false;
    setShowSunCenterPrompt(true);
    return true;
  }, [isStarModeActive, isSolarSystemMode, timelinePlanetPositions, projectCelestial3D]);

  const startSolarSystemMode = () => {
    const start = new Date(0);
    start.setUTCFullYear(timelineYear, 0, 1);
    start.setUTCHours(12, 0, 0, 0);
    setSolarSystemEpochMs(start.getTime());
    setShowSunCenterPrompt(false);
    setIsSolarSystemMode(true);
    setIsStarPanelExpanded(false);
    setIsCelestialDeckCollapsed(true);
    setIsEarthAssignMode(false);
    setSelectedEarthSite(null);
  };

  const unprojectOrbitPlane = (
    screenX: number,
    screenY: number,
    fixedY: number,
    width: number,
    height: number,
    startX: number,
    startZ: number
  ): { x: number; z: number } => {
    const baseScale = Math.min(width, height) * 0.075 * cameraZoom;
    if (cameraView === 'top') {
      return {
        x: Math.max(-8, Math.min(8, (screenX - width / 2) / (baseScale * 1.25))),
        z: Math.max(-8, Math.min(8, (screenY - height / 2) / (baseScale * 1.25))),
      };
    }

    let guessX = startX;
    let guessZ = startZ;
    const epsilon = 0.02;
    for (let iteration = 0; iteration < 9; iteration++) {
      const point = project3D(guessX, fixedY, guessZ, width, height);
      const errorX = screenX - point.sx;
      const errorY = screenY - point.sy;
      if (Math.hypot(errorX, errorY) < 0.35) break;
      const pointX = project3D(guessX + epsilon, fixedY, guessZ, width, height);
      const pointZ = project3D(guessX, fixedY, guessZ + epsilon, width, height);
      const j11 = (pointX.sx - point.sx) / epsilon;
      const j21 = (pointX.sy - point.sy) / epsilon;
      const j12 = (pointZ.sx - point.sx) / epsilon;
      const j22 = (pointZ.sy - point.sy) / epsilon;
      const determinant = j11 * j22 - j12 * j21;
      if (Math.abs(determinant) < 1e-6) break;
      const stepX = Math.max(-2.5, Math.min(2.5, (errorX * j22 - errorY * j12) / determinant));
      const stepZ = Math.max(-2.5, Math.min(2.5, (j11 * errorY - j21 * errorX) / determinant));
      guessX = Math.max(-8, Math.min(8, guessX + stepX));
      guessZ = Math.max(-8, Math.min(8, guessZ + stepZ));
    }
    return { x: Number(guessX.toFixed(3)), z: Number(guessZ.toFixed(3)) };
  };

  // Render 3D scene & Star Space & Top Plane Overlay
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const cx = width / 2;
      const cy = height / 2;
      const baseScale = Math.min(width, height) * 0.075 * cameraZoom;
      const moonOrbitPhase = is24HourRotationActive
        ? (dailyRotationDegreesRef.current / 27.321661) * Math.PI / 180
        : (performance.now() / 15000) % (Math.PI * 2);

      ctx.save();
      ctx.scale(dpr, dpr);

      // Keep the overlay transparent while the detailed globe is active so the space layer remains visible.
      if (isEarthModeActive) {
        ctx.clearRect(0, 0, width, height);
      } else {
        ctx.fillStyle = isStarModeActive ? '#04060d' : '#060a12';
        ctx.fillRect(0, 0, width, height);
      }

      const bound = 8.0;
      // Shared projection origin: star tethers and angle geometry also render over the Earth globe.
      const centerPt = project3D(0, 0, 0, width, height);

      // 1. Render Top Plane Uploaded Image Overlay (if active)
      if (overlay.visible && overlayImageRef.current) {
        ctx.save();
        ctx.globalAlpha = overlay.opacity;

        if (cameraView === 'top') {
          // Precise 1:1 floor plan mapping in top-down view
          const planeW = 2 * bound * baseScale * 1.25 * overlay.scale;
          const planeH = 2 * bound * baseScale * 1.25 * overlay.scale;
          ctx.drawImage(
            overlayImageRef.current,
            cx - planeW / 2,
            cy - planeH / 2,
            planeW,
            planeH
          );
        } else {
          // Perspective floor rendering: project 4 corners of horizontal plane
          const pTL = project3D(-bound * overlay.scale, -bound, -bound * overlay.scale, width, height);
          const pTR = project3D(bound * overlay.scale, -bound, -bound * overlay.scale, width, height);
          const pBR = project3D(bound * overlay.scale, -bound, bound * overlay.scale, width, height);
          const pBL = project3D(-bound * overlay.scale, -bound, bound * overlay.scale, width, height);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pTL.sx, pTL.sy);
          ctx.lineTo(pTR.sx, pTR.sy);
          ctx.lineTo(pBR.sx, pBR.sy);
          ctx.lineTo(pBL.sx, pBL.sy);
          ctx.closePath();
          ctx.clip();

          const minX = Math.min(pTL.sx, pTR.sx, pBR.sx, pBL.sx);
          const maxX = Math.max(pTL.sx, pTR.sx, pBR.sx, pBL.sx);
          const minY = Math.min(pTL.sy, pTR.sy, pBR.sy, pBL.sy);
          const maxY = Math.max(pTL.sy, pTR.sy, pBR.sy, pBL.sy);
          ctx.drawImage(overlayImageRef.current, minX, minY, maxX - minX, maxY - minY);
          ctx.restore();
        }

        ctx.restore();
      }

      // The WebGL Earth view owns its geography; do not paint cube-space content on top of it.
      if (!isEarthModeActive) {
      // 2. Star-field particles from the working starthing 3D orbit scene.
      // These are rendered in this same orbit canvas, not in a separate sky-map window.
      if (isStarModeActive) {
        ctx.save();
        for (let i = 0; i < 60; i++) {
          const fakeRa = (i * 37) % 360;
          const fakeDec = ((i * 59) % 180) - 90;
          const raRad = (fakeRa * Math.PI) / 180;
          const decRad = (fakeDec * Math.PI) / 180;
          const radius = 7.8;
          const fx = radius * Math.cos(decRad) * Math.sin(raRad);
          const fy = radius * Math.sin(decRad);
          const fz = radius * Math.cos(decRad) * Math.cos(raRad);
          const fp = project3D(fx, fy, fz, width, height);
          ctx.fillStyle = i % 3 === 0 ? 'rgba(165, 201, 255, 0.4)' : 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.arc(fp.sx, fp.sy, Math.max(0.45, (i % 2 === 0 ? 1.0 : 0.6) * fp.depthScale), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // The cube stays in orbit views only; it must not obscure the globe in Top Plane mode.
      if (!isEarthModeActive) {
      // 3. Draw 3D AudioCube Room Wireframe
      ctx.lineWidth = 1;
      const gridSteps = 4;
      for (let i = -gridSteps; i <= gridSteps; i++) {
        const posVal = (i / gridSteps) * bound;

        // Lines along X
        const p1 = project3D(-bound, -bound, posVal, width, height);
        const p2 = project3D(bound, -bound, posVal, width, height);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.strokeStyle = i === 0 ? 'rgba(168, 85, 247, 0.45)' : 'rgba(255, 255, 255, 0.06)';
        ctx.stroke();

        // Lines along Z
        const p3 = project3D(posVal, -bound, -bound, width, height);
        const p4 = project3D(posVal, -bound, bound, width, height);
        ctx.beginPath();
        ctx.moveTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.strokeStyle = i === 0 ? 'rgba(168, 85, 247, 0.45)' : 'rgba(255, 255, 255, 0.06)';
        ctx.stroke();
      }

      // Outer Cube Bounding Edges
      if (cameraView === 'perspective') {
        const corners = [
          [-bound, -bound, -bound],
          [bound, -bound, -bound],
          [bound, -bound, bound],
          [-bound, -bound, bound],
          [-bound, bound, -bound],
          [bound, bound, -bound],
          [bound, bound, bound],
          [-bound, bound, bound],
        ];

        const edges = [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0], // Floor boundary
          [4, 5],
          [5, 6],
          [6, 7],
          [7, 4], // Ceiling boundary
          [0, 4],
          [1, 5],
          [2, 6],
          [3, 7], // Corner vertical pillars
        ];

        edges.forEach(([i1, i2]) => {
          const c1 = corners[i1];
          const c2 = corners[i2];
          const pt1 = project3D(c1[0], c1[1], c1[2], width, height);
          const pt2 = project3D(c2[0], c2[1], c2[2], width, height);

          ctx.beginPath();
          ctx.moveTo(pt1.sx, pt1.sy);
          ctx.lineTo(pt2.sx, pt2.sy);
          ctx.strokeStyle = isStarModeActive ? 'rgba(99, 102, 241, 0.18)' : 'rgba(168, 85, 247, 0.18)';
          ctx.stroke();
        });
      }

      }

      if (!isEarthModeActive) {
      // Sidereal phase for Jan 1 noon in selected year. A year-only slider cannot recover an ancient time-of-day.
      const gmstDeg = calculateTimelineGmstDeg(timelineYear) + dailyRotationDegreesRef.current;
      const earthRadius = 3.35;
      const earthPoint = (lat: number, lon: number, radius = earthRadius) =>
        latLonToCartesian(lat, lon, radius, gmstDeg, 23.439281);
      const cameraFront = (p: { x: number; y: number; z: number }) => {
        if (cameraView !== 'perspective') return p.z < 0.15;
        const yaw = (cameraYaw * Math.PI) / 180;
        const pitch = (cameraPitch * Math.PI) / 180;
        const rz = p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
        const rz2 = p.y * Math.sin(pitch) + rz * Math.cos(pitch);
        return rz2 < 0.15;
      };
      const earthCenter = project3D(0, 0, 0, width, height);
      // Perspective silhouette remains circular and the same apparent size at every orbit yaw/pitch.
      const earthScreenRadius = cameraView === 'perspective'
        ? (baseScale * 0.065 * 350 * earthRadius) / Math.sqrt(28 * 28 - earthRadius * earthRadius)
        : earthRadius * baseScale * 1.25;
      const earthRenderYaw = cameraView === 'perspective' ? cameraYaw : 0;
      const earthRenderPitch = cameraView === 'perspective' ? cameraPitch : 0;
      ctx.save();
      const earthGradient = ctx.createRadialGradient(
        earthCenter.sx - earthScreenRadius * 0.32, earthCenter.sy - earthScreenRadius * 0.35,
        earthScreenRadius * 0.08, earthCenter.sx, earthCenter.sy, earthScreenRadius
      );
      earthGradient.addColorStop(0, '#176b91');
      earthGradient.addColorStop(0.58, '#0b385d');
      earthGradient.addColorStop(1, '#061426');
      ctx.beginPath();
      ctx.arc(earthCenter.sx, earthCenter.sy, earthScreenRadius, 0, Math.PI * 2);
      ctx.fillStyle = earthGradient;
      ctx.fill();
      // Render the equirectangular Blue Marble as a true spherical projection.
      // This keeps the Earth/universe core visibly textured in the 3D orbit view instead of a blue gradient.
      if (earthTextureLoaded && earthTextureRef.current) {
        const tex = earthTextureRef.current;
        const texW = tex.naturalWidth || tex.width;
        const texH = tex.naturalHeight || tex.height;
        const outputSize = 384;
        const cacheKey = [
          earthTextureUrl, timelineYear, dailyRotationDegreesRef.current.toFixed(2), earthRenderYaw.toFixed(2), earthRenderPitch.toFixed(2),
          cameraView, texW, texH
        ].join('|');
        let sphereCanvas = earthSphereCanvasRef.current;
        if (!sphereCanvas) {
          sphereCanvas = document.createElement('canvas');
          earthSphereCanvasRef.current = sphereCanvas;
        }
        if (sphereCanvas.width !== outputSize || sphereCanvas.height !== outputSize) {
          sphereCanvas.width = outputSize;
          sphereCanvas.height = outputSize;
          earthSphereCacheKeyRef.current = '';
        }

        if (earthSphereCacheKeyRef.current !== cacheKey) {
          const sourceCanvas = document.createElement('canvas');
          sourceCanvas.width = texW;
          sourceCanvas.height = texH;
          const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
          const outputContext = sphereCanvas.getContext('2d', { willReadFrequently: true });
          if (sourceContext && outputContext) {
            sourceContext.drawImage(tex, 0, 0, texW, texH);
            const sourcePixels = sourceContext.getImageData(0, 0, texW, texH).data;
            const output = outputContext.createImageData(outputSize, outputSize);
            const yaw = earthRenderYaw * Math.PI / 180;
            const pitch = earthRenderPitch * Math.PI / 180;
            const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
            const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
            const tilt = 23.439281 * Math.PI / 180;
            const cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
            const radiusPx = outputSize / 2;
            const cameraDistance = 28;
            const tangentScale = earthRadius / Math.sqrt(cameraDistance * cameraDistance - earthRadius * earthRadius);
            const lightX = -0.42, lightY = 0.46, lightZ = -0.78;

            for (let py = 0; py < outputSize; py++) {
              const ny = (radiusPx - py - 0.5) / radiusPx;
              for (let px = 0; px < outputSize; px++) {
                const nx = (px + 0.5 - radiusPx) / radiusPx;
                const rr = nx * nx + ny * ny;
                const offset = (py * outputSize + px) * 4;
                if (rr >= 1) {
                  output.data[offset + 3] = 0;
                  continue;
                }

                let sphereX: number;
                let sphereY: number;
                let sphereZ: number;
                if (cameraView === 'perspective') {
                  // Invert the exact perspective projection used by project3D.
                  const rayX = nx * tangentScale;
                  const rayY = ny * tangentScale;
                  const rayR2 = rayX * rayX + rayY * rayY;
                  const discriminant = cameraDistance * cameraDistance -
                    (rayR2 + 1) * (cameraDistance * cameraDistance - earthRadius * earthRadius);
                  if (discriminant < 0) {
                    output.data[offset + 3] = 0;
                    continue;
                  }
                  const depth = (cameraDistance - Math.sqrt(discriminant)) / (rayR2 + 1);
                  sphereX = rayX * depth;
                  sphereY = rayY * depth;
                  sphereZ = depth - cameraDistance;
                } else {
                  sphereX = nx * earthRadius;
                  sphereY = ny * earthRadius;
                  sphereZ = -Math.sqrt(Math.max(0, earthRadius * earthRadius - sphereX * sphereX - sphereY * sphereY));
                }

                // Undo view rotation, Earth axial tilt and sidereal rotation for each surface pixel.
                const yAfterPitch = sphereY * cosPitch + sphereZ * sinPitch;
                const zAfterYaw = -sphereY * sinPitch + sphereZ * cosPitch;
                const worldX = sphereX * cosYaw + zAfterYaw * sinYaw;
                const worldZ = -sphereX * sinYaw + zAfterYaw * cosYaw;
                const unTitledY = yAfterPitch * cosTilt + worldZ * sinTilt;
                const unTitledZ = -yAfterPitch * sinTilt + worldZ * cosTilt;
                const latitude = Math.asin(Math.max(-1, Math.min(1, unTitledY / earthRadius)));
                let longitude = Math.atan2(worldX, unTitledZ) * 180 / Math.PI - gmstDeg;
                longitude = ((longitude + 180) % 360 + 360) % 360 - 180;
                const u = Math.min(texW - 1, Math.max(0, Math.floor(((longitude + 180) / 360) * texW)));
                const v = Math.min(texH - 1, Math.max(0, Math.floor(((90 - latitude * 180 / Math.PI) / 180) * texH)));
                const sourceOffset = (v * texW + u) * 4;
                const diffuse = Math.max(0,
                  (sphereX / earthRadius) * lightX +
                  (sphereY / earthRadius) * lightY +
                  (sphereZ / earthRadius) * lightZ);
                const shade = 0.38 + 0.62 * diffuse;
                output.data[offset] = sourcePixels[sourceOffset] * shade;                output.data[offset] = sourcePixels[sourceOffset] * shade;
                output.data[offset + 1] = sourcePixels[sourceOffset + 1] * shade;
                output.data[offset + 2] = sourcePixels[sourceOffset + 2] * shade;
                output.data[offset + 3] = 255;
              }
            }
            outputContext.putImageData(output, 0, 0);
            earthSphereCacheKeyRef.current = cacheKey;
          }
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(earthCenter.sx, earthCenter.sy, earthScreenRadius * 0.995, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = 1;
        ctx.drawImage(
          sphereCanvas,
          earthCenter.sx - earthScreenRadius,
          earthCenter.sy - earthScreenRadius,
          earthScreenRadius * 2,
          earthScreenRadius * 2
        );
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#0891b2';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Textured Earth with directional limb shading; no wireframe overlays.
      const limbShade = ctx.createRadialGradient(
        earthCenter.sx - earthScreenRadius * 0.34,
        earthCenter.sy - earthScreenRadius * 0.38,
        earthScreenRadius * 0.12,
        earthCenter.sx + earthScreenRadius * 0.12,
        earthCenter.sy + earthScreenRadius * 0.1,
        earthScreenRadius * 1.08
      );
      limbShade.addColorStop(0, 'rgba(255,255,255,0.12)');
      limbShade.addColorStop(0.52, 'rgba(5,18,36,0.04)');
      limbShade.addColorStop(0.82, 'rgba(2,8,20,0.30)');
      limbShade.addColorStop(1, 'rgba(0,4,14,0.82)');
      ctx.beginPath();
      ctx.arc(earthCenter.sx, earthCenter.sy, earthScreenRadius * 0.995, 0, Math.PI * 2);
      ctx.fillStyle = limbShade;
      ctx.fill();
      // Major cities and named landmarks become readable as the user zooms in.
      // Coordinates are geographic locations, projected onto the same rotating Earth.
      const majorCities: Array<{ name: string; lat: number; lon: number }> = [
        { name: 'New York', lat: 40.7128, lon: -74.006 }, { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
        { name: 'Mexico City', lat: 19.4326, lon: -99.1332 }, { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
        { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 }, { name: 'London', lat: 51.5072, lon: -0.1276 },
        { name: 'Paris', lat: 48.8566, lon: 2.3522 }, { name: 'Rome', lat: 41.9028, lon: 12.4964 },
        { name: 'Cairo', lat: 30.0444, lon: 31.2357 }, { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
        { name: 'Nairobi', lat: -1.2921, lon: 36.8219 }, { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
        { name: 'Dubai', lat: 25.2048, lon: 55.2708 }, { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
        { name: 'Delhi', lat: 28.6139, lon: 77.209 }, { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
        { name: 'Singapore', lat: 1.3521, lon: 103.8198 }, { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
        { name: 'Seoul', lat: 37.5665, lon: 126.978 }, { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
        { name: 'Sydney', lat: -33.8688, lon: 151.2093 }, { name: 'Auckland', lat: -36.8509, lon: 174.7645 },
        { name: 'Moscow', lat: 55.7558, lon: 37.6173 }, { name: 'Reykjavik', lat: 64.1466, lon: -21.9426 },
        { name: 'Honolulu', lat: 21.3099, lon: -157.8581 }, { name: 'Anchorage', lat: 61.2181, lon: -149.9003 },
      ];
      const labelEarthPoint = (name: string, lat: number, lon: number, color: string, isCity = false) => {
        const v = earthPoint(lat, lon, earthRadius * 1.002);
        if (!cameraFront(v)) return;
        const p = project3D(v.x, v.y, v.z, width, height);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, isCity ? 1.7 : 2.8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isCity ? 3 : 7;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Paint city names on the same Earth projection so the WebGL label layer
        // cannot disappear behind the custom canvas overlay.
        if (isCity) {
          const fontSize = Math.max(9, Math.min(12, earthScreenRadius * 0.035));
          ctx.save();
          ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(2, 8, 23, 0.96)';
          ctx.fillStyle = '#f8fafc';
          ctx.strokeText(name, p.sx + 5, p.sy - 3);
          ctx.fillText(name, p.sx + 5, p.sy - 3);
          ctx.restore();
        }
      };
      DEFAULT_EARTH_POINTS.forEach((point) => labelEarthPoint(point.name, point.lat, point.lon, point.color));
      if (showCities) majorCities.forEach((city) => labelEarthPoint(city.name, city.lat, city.lon, '#dbeafe', true));
      // Modern coordinates for archaeological destinations; visibility follows approximate site era.
      const historicalSites: Array<{ name: string; lat: number; lon: number; era: number }> = earthSites.filter((site: any) => !site.isCity).map((site) => ({ name: site.name, lat: site.lat, lon: site.lon, era: site.year }));
      historicalSites.forEach((site) => {
        if (showAncientStructures && timelineYear >= site.era) {
          labelEarthPoint('ANCIENT · ' + site.name, site.lat, site.lon, showAcousticColorSystem ? '#facc15' : '#e2e8f0');
          if (show110HzResearchComets) {
            const sitePos = earthPoint(site.lat, site.lon, earthRadius * 1.02);
            if (cameraFront(sitePos)) {
              const p = project3D(sitePos.x, sitePos.y, sitePos.z, width, height);
              const phase = (performance.now() / 420 + Math.abs(site.lat * 11 + site.lon)) % 1;
              const dx = 14 + phase * 34;
              const dy = -10 - phase * 24;
              ctx.save();
              ctx.globalAlpha = Math.max(0.08, 1 - phase);
              ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 2; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 9;
              ctx.beginPath(); ctx.moveTo(p.sx - dx * 0.7, p.sy - dy * 0.7); ctx.lineTo(p.sx + dx * 0.3, p.sy + dy * 0.3); ctx.stroke();
              ctx.beginPath(); ctx.arc(p.sx, p.sy, 3 + phase * 2, 0, Math.PI * 2); ctx.fillStyle = '#ffedd5'; ctx.fill();
              ctx.shadowBlur = 0; ctx.globalAlpha = 1;
              ctx.font = '8px "JetBrains Mono", monospace'; ctx.fillStyle = '#fed7aa'; ctx.fillText('110 Hz candidate*', p.sx + 5, p.sy - 6);
              ctx.restore();
            }
          }
        }
      });
      // Sourced acoustic record: the Hypogeum paper reports 70 Hz and 114 Hz.
      // Preserve 114 Hz exactly; its marker is shown in the 110 Hz investigation band only as a nearby result.
      if (showAncientStructures && timelineYear >= -4000) {
        const acousticSite = ACOUSTIC_SITE_EVIDENCE[0];
        labelEarthPoint('MEASURED · Ħal Saflieni · 114 Hz', acousticSite.lat, acousticSite.lon, showAcousticColorSystem ? '#fb923c' : '#e2e8f0');
        if (show110HzResearchComets) {
          const sitePos = earthPoint(acousticSite.lat, acousticSite.lon, earthRadius * 1.025);
          if (cameraFront(sitePos)) {
            const p = project3D(sitePos.x, sitePos.y, sitePos.z, width, height);
            const phase = (performance.now() / 420 + 0.37) % 1;
            const dx = 18 + phase * 38;
            const dy = -14 - phase * 27;
            ctx.save();
            ctx.globalAlpha = Math.max(0.08, 1 - phase);
            ctx.strokeStyle = '#fdba74'; ctx.lineWidth = 2.5; ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 13;
            ctx.beginPath(); ctx.moveTo(p.sx - dx * 0.7, p.sy - dy * 0.7); ctx.lineTo(p.sx + dx * 0.3, p.sy + dy * 0.3); ctx.stroke();
            ctx.beginPath(); ctx.arc(p.sx, p.sy, 4 + phase * 2, 0, Math.PI * 2); ctx.fillStyle = '#fff7ed'; ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            ctx.font = 'bold 8px "JetBrains Mono", monospace'; ctx.fillStyle = '#fed7aa'; ctx.fillText('114 Hz MEASURED', p.sx + 6, p.sy - 7);
            ctx.restore();
          }
        }
      }
      // Moon position shares the Earth origin and camera rotation. Orbit is compressed for visibility;
      // actual mean Earth-Moon distance is 384,400 km (about 60.3 Earth radii).
      const moonOrbitRadius = earthRadius * 1.72;
      const moonPos = { x: moonOrbitRadius * Math.cos(moonOrbitPhase), y: 0.55, z: moonOrbitRadius * Math.sin(moonOrbitPhase) };
      const moonScreen = project3D(moonPos.x, moonPos.y, moonPos.z, width, height);
      if (cameraFront(moonPos)) {
        const moonRadius = Math.max(3.5, earthScreenRadius * 0.085);
        ctx.save();
        const moonGlow = ctx.createRadialGradient(moonScreen.sx - moonRadius * 0.3, moonScreen.sy - moonRadius * 0.35, 1, moonScreen.sx, moonScreen.sy, moonRadius * 1.6);
        moonGlow.addColorStop(0, 'rgba(248,250,252,0.98)'); moonGlow.addColorStop(0.65, 'rgba(148,163,184,0.95)'); moonGlow.addColorStop(1, 'rgba(71,85,105,0.18)');
        ctx.beginPath(); ctx.arc(moonScreen.sx, moonScreen.sy, moonRadius, 0, Math.PI * 2); ctx.fillStyle = moonGlow; ctx.shadowColor = '#cbd5e1'; ctx.shadowBlur = 15; ctx.fill(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(moonScreen.sx - moonRadius * 0.24, moonScreen.sy - moonRadius * 0.18, moonRadius * 0.19, 0, Math.PI * 2); ctx.fillStyle = 'rgba(71,85,105,0.35)'; ctx.fill();
        ctx.font = '9px "JetBrains Mono", monospace'; ctx.fillStyle = '#e2e8f0'; ctx.fillText('MOON · orbit compressed', moonScreen.sx + moonRadius + 5, moonScreen.sy + 3);
        ctx.restore();
      }
      ctx.restore();

      }

      // In Earth mode the core globe itself supplies the center visual; keep its overlay clean.
      if (!isEarthModeActive) {
      // 4. Center of Spatial Area / Universe Observer Core (0, 0, 0)
      const listenerFloor = project3D(0, -bound, 0, width, height);

      // Floor Shadow & Drop line for Observer
      ctx.beginPath();
      ctx.ellipse(listenerFloor.sx, listenerFloor.sy, 16, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(listenerFloor.sx, listenerFloor.sy);
      ctx.lineTo(centerPt.sx, centerPt.sy);
      ctx.strokeStyle = isStarModeActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(168, 85, 247, 0.3)';
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Universe Center Core
      if (isStarModeActive) {
        ctx.beginPath();
        ctx.arc(centerPt.sx, centerPt.sy, 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(centerPt.sx, centerPt.sy, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#fde047';
        ctx.fillText('EARTH / UNIVERSE CORE', centerPt.sx - 58, centerPt.sy + 24);
      } else {
        ctx.beginPath();
        ctx.arc(centerPt.sx, centerPt.sy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#c084fc';
        ctx.fillText('LISTENER', centerPt.sx - 22, centerPt.sy + 20);
      }

      }

      // 5. Render Real-World Stars and Constellation Edges (Star Mode)
      if (isStarModeActive) {
        // Constellation lines are opt-in; star points remain visible independently.
        if (showConstellationLines) {
        // Draw Constellation Lines
        ctx.save();
        const pulsePhase = (performance.now() / 70) % 18;
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.34)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 8;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -pulsePhase;

        const constellationPulse = 0.55 + 0.35 * Math.sin(performance.now() / 260);
        const renderedConstellationPoints = new Map<string, { sx: number; sy: number }>();
        ctx.globalAlpha = constellationPulse;
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 1.55;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 12;
        ctx.setLineDash([]);
        CONSTELLATION_LINE_SHAPES.forEach((shape) => {
          if (!isConstellationEnabled(shape.name)) return;
          shape.lines.forEach((path) => {
            if (path.length < 2) return;
            ctx.beginPath();
            path.forEach(([raDeg, decDeg], index) => {
              const pos = celestialPosition({ raDeg, decDeg });
              const screen = projectCelestial3D(pos.x, pos.y, pos.z, width, height);
              if (index === 0) ctx.moveTo(screen.sx, screen.sy);
              else ctx.lineTo(screen.sx, screen.sy);
              renderedConstellationPoints.set(`${raDeg.toFixed(3)}:${decDeg.toFixed(3)}`, { sx: screen.sx, sy: screen.sy });
            });
            ctx.stroke();
          });
        });
        ctx.shadowBlur = 7;
        ctx.fillStyle = '#e0f2fe';
        renderedConstellationPoints.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.sx, point.sy, 1.65, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.restore();
        }

        // Draw Real Stars
        // Star points are independent of constellation-line visibility.
        // The constellation toggles above only control the connecting paths.
        REAL_CELESTIAL_STARS.forEach((star) => {
          const starPosition = celestialPosition(star);
          const sp = projectCelestial3D(starPosition.x, starPosition.y, starPosition.z, width, height);
          const isAssignedA = star.id === starAId;
          const isAssignedB = star.id === starBId;
          const isAssignedC = star.id === starCId;
          const isHovered = hoveredStar?.id === star.id;
          const isClicked = clickedStar?.id === star.id;

          // Star glow
          ctx.save();
          const baseRadius = Math.max(2.5, (3.5 - star.mag * 0.4) * sp.depthScale);
          ctx.beginPath();
          ctx.arc(sp.sx, sp.sy, baseRadius, 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.shadowColor = star.color;
          ctx.shadowBlur = isAssignedA || isAssignedB || isAssignedC || isHovered || isClicked ? 16 : 5;
          ctx.fill();

          // Star label
          ctx.font = isHovered || isClicked ? 'bold 10px "JetBrains Mono", monospace' : '9px "JetBrains Mono", monospace';
          ctx.fillStyle = isHovered || isClicked ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
          ctx.fillText(star.name, sp.sx + 7, sp.sy - 3);

          // Indicator for assigned channels
          if (isAssignedA || isAssignedB || isAssignedC) {
            ctx.strokeStyle = isAssignedA ? '#00f0ff' : isAssignedB ? '#ff007f' : '#fbbf24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sp.sx, sp.sy, baseRadius + 4, 0, Math.PI * 2);
            ctx.stroke();

            // Pin marker
            ctx.fillStyle = isAssignedA ? '#00f0ff' : isAssignedB ? '#ff007f' : '#fbbf24';
            ctx.font = 'bold 8px "JetBrains Mono", monospace';
            const badge = isAssignedA ? 'A★' : isAssignedB ? 'B★' : 'C★';
            ctx.fillText(badge, sp.sx - 6, sp.sy - baseRadius - 5);
          }
          ctx.restore();
        });

        // Draw the optional HYG catalog. The slider reveals catalog stars in distance
        // order; only valid measured/derived distances are admitted by the parser above.
        // Points are batched by stellar color to avoid one canvas fill operation per star.
        if (showAllStars && visibleAllStarPositions.length > 0) {
          const starBuckets = new Map<string, Array<{ x: number; y: number; radius: number }>>();
          visibleAllStarPositions.forEach(({ star, position }) => {
            const point = projectCelestial3D(position.x, position.y, position.z, width, height);
            if (point.sx < -3 || point.sx > width + 3 || point.sy < -3 || point.sy > height + 3) return;
            const radius = Math.max(0.4, Math.min(2.5, (1.8 - star.magnitude * 0.12) * point.depthScale));
            const bucket = starBuckets.get(star.color) || [];
            bucket.push({ x: point.sx, y: point.sy, radius });
            if (!starBuckets.has(star.color)) starBuckets.set(star.color, bucket);
          });
          ctx.save();
          starBuckets.forEach((points, color) => {
            ctx.beginPath();
            points.forEach((point) => {
              ctx.moveTo(point.x + point.radius, point.y);
              ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
            });
            ctx.fillStyle = color;
            ctx.fill();
          });
          ctx.restore();
        }

        // Sun and planets use the Stardroid/JPL-style low-precision ephemeris and
        // the same celestial-sphere projection as the existing star catalogue.
        // They appear with Star Mode and update whenever the historical year changes.
        timelinePlanetPositions.forEach((planet: ReturnType<typeof getPlanetSkyPositions>[number]) => {
          const planetPosition = celestialPosition({ raDeg: planet.raDeg, decDeg: planet.decDeg });
          const pp = projectCelestial3D(planetPosition.x, planetPosition.y, planetPosition.z, width, height);
          const radius = Math.max(2.5, planet.size * pp.depthScale);
          ctx.save();
          ctx.beginPath();
          ctx.arc(pp.sx, pp.sy, radius, 0, Math.PI * 2);
          ctx.fillStyle = planet.color;
          ctx.shadowColor = planet.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(pp.sx, pp.sy, radius + 2.2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(planet.name.toUpperCase(), pp.sx + radius + 5, pp.sy - 3);
          ctx.restore();
        });

        // Celestial Tether Beams: Universe Center (0,0,0) -> Assigned Stars -> Channels
        const drawTether = (starId: string, puckPos: SpatialPosition, color: string) => {
          const star = REAL_CELESTIAL_STARS.find((s) => s.id === starId);
          if (!star) return;
          const starPosition = celestialPosition(star);
          const sp = projectCelestial3D(starPosition.x, starPosition.y, starPosition.z, width, height);
          const pp = project3D(puckPos.x, puckPos.y, puckPos.z, width, height);

          // Ray from Center to Star
          ctx.beginPath();
          ctx.moveTo(centerPt.sx, centerPt.sy);
          ctx.lineTo(sp.sx, sp.sy);
          ctx.strokeStyle = `${color}40`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.stroke();

          // Ray from Star to Channel Puck
          ctx.beginPath();
          ctx.moveTo(sp.sx, sp.sy);
          ctx.lineTo(pp.sx, pp.sy);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        };

        if (!isEarthModeActive) {
          drawTether(starAId, aPos, '#00f0ff');
          drawTether(starBId, bPos, '#ff007f');
          drawTether(starCId, cPos, '#fbbf24');
        }
      }

      // 6. Draw 3D Sound Puck Helper
      const drawPuck = (
        pos: SpatialPosition,
        freq: number,
        label: string,
        color: string,
        fillColor: string,
        channelId: 'a' | 'b' | 'c',
        isActive: boolean
      ) => {
        const p = project3D(pos.x, pos.y, pos.z, width, height);
        const pFloor = project3D(pos.x, -bound, pos.z, width, height);
        const isLocked = lockedChannels[channelId];
        const assignedStar = REAL_CELESTIAL_STARS.find(
          (s) => s.id === (channelId === 'a' ? starAId : channelId === 'b' ? starBId : starCId)
        );

        // Vertical drop line to floor
        ctx.beginPath();
        ctx.moveTo(pFloor.sx, pFloor.sy);
        ctx.lineTo(p.sx, p.sy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Shadow ellipse on floor
        ctx.beginPath();
        ctx.ellipse(pFloor.sx, pFloor.sy, 13, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = `${color}25`;
        ctx.fill();

        // Origin to Puck vector
        ctx.beginPath();
        ctx.moveTo(centerPt.sx, centerPt.sy);
        ctx.lineTo(p.sx, p.sy);
        ctx.strokeStyle = `${color}40`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Sound Source Puck Body
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = isRunning ? 16 : 6;
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = color;
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 13 * p.depthScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText(label, p.sx - 3.5, p.sy + 4);
        ctx.restore();

        // Label with Star Lock indicator
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        const starText = isStarModeActive && assignedStar && isLocked ? ` ★ ${assignedStar.name} [LOCKED]` : '';
        ctx.fillText(
          `${label}${starText}: ${freq.toFixed(1)}Hz [${pos.y > 0 ? '+' : ''}${pos.y.toFixed(1)}m]`,
          p.sx - 48,
          p.sy - 18
        );
      };

      // Cube-space pucks and triangle remain in the 3D orbit view. In Earth
      // mode, the geographic A/B/C positions are shown as pins on the globe.
      if (!isEarthModeActive) {
      // 7. Draw Trinaural Acoustic Triangular Web between A, B, and C
      const pa = project3D(aPos.x, aPos.y, aPos.z, width, height);
      const pb = project3D(bPos.x, bPos.y, bPos.z, width, height);
      const pc = project3D(cPos.x, cPos.y, cPos.z, width, height);

      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.lineTo(pc.sx, pc.sy);
      ctx.closePath();
      ctx.strokeStyle = isStarModeActive ? 'rgba(250, 204, 21, 0.35)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = relation711.isHarmonic711 ? 1.8 : 1.2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.fillStyle = relation711.isHarmonic711 ? 'rgba(250, 204, 21, 0.07)' : 'rgba(168, 85, 247, 0.04)';
      ctx.fill();
      ctx.setLineDash([]);

      // 7b. Draw Interior Triangle Angles (Displayed when 3 stars are connected or showTriangleAngles is active)
      const centroidX = (pa.sx + pb.sx + pc.sx) / 3;
      const centroidY = (pa.sy + pb.sy + pc.sy) / 3;

      if (showTriangleAngles) {
        // Helper to draw interior corner angle arc and degree badge inside each triangle corner
        const drawCornerInteriorAngle = (
          v: { sx: number; sy: number },
          adj1: { sx: number; sy: number },
          adj2: { sx: number; sy: number },
          angleDeg: number,
          label: string,
          color: string,
          arcRadius = 24
        ) => {
          const t1 = Math.atan2(adj1.sy - v.sy, adj1.sx - v.sx);
          const t2 = Math.atan2(adj2.sy - v.sy, adj2.sx - v.sx);

          let diff = (t2 - t1) % (2 * Math.PI);
          if (diff < -Math.PI) diff += 2 * Math.PI;
          if (diff > Math.PI) diff -= 2 * Math.PI;

          // Interior bisector directed towards triangle centroid
          const bisector = t1 + diff / 2;
          const dirCentroid = Math.atan2(centroidY - v.sy, centroidX - v.sx);
          let bDiff = Math.abs((bisector - dirCentroid) % (2 * Math.PI));
          if (bDiff > Math.PI) bDiff = 2 * Math.PI - bDiff;
          const interiorBisector = bDiff < Math.PI / 2 ? bisector : bisector + Math.PI;

          // Interior Arc Sector
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(v.sx, v.sy);
          if (diff >= 0) {
            ctx.arc(v.sx, v.sy, arcRadius, t1, t1 + diff, false);
          } else {
            ctx.arc(v.sx, v.sy, arcRadius, t1, t1 + diff, true);
          }
          ctx.closePath();
          ctx.fillStyle = `${color}28`;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Interior Ray toward centroid
          ctx.beginPath();
          ctx.moveTo(v.sx, v.sy);
          ctx.lineTo(
            v.sx + Math.cos(interiorBisector) * (arcRadius + 14),
            v.sy + Math.sin(interiorBisector) * (arcRadius + 14)
          );
          ctx.strokeStyle = `${color}60`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Put the degree badge outside the triangle, opposite the interior bisector,
          // so the text stays clear of the triangle fill and its three connecting edges.
          const labelDist = Math.max(52, arcRadius + 32);
          const labelDirection = interiorBisector + Math.PI;
          const lx = v.sx + Math.cos(labelDirection) * labelDist;
          const ly = v.sy + Math.sin(labelDirection) * labelDist;

          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          const badgeText = `${label}: ${angleDeg.toFixed(1)}°`;
          const badgeW = ctx.measureText(badgeText).width + 8;
          const badgeH = 15;

          ctx.fillStyle = 'rgba(6, 10, 18, 0.92)';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(lx - badgeW / 2, ly - badgeH / 2, badgeW, badgeH, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.fillText(badgeText, lx - badgeW / 2 + 4, ly + 3.5);
          ctx.restore();
        };

        // Draw 3 interior corner angles inside vertices A, B, and C
        drawCornerInteriorAngle(pa, pb, pc, interiorAngles.angleA, '∠A', '#00f0ff');
        drawCornerInteriorAngle(pb, pa, pc, interiorAngles.angleB, '∠B', '#ff007f');
        drawCornerInteriorAngle(pc, pa, pb, interiorAngles.angleC, '∠C', '#fbbf24');

        // Draw subtle dashed rays from vertices to the centroid inside triangle
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.22)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(centroidX, centroidY);
        ctx.moveTo(pb.sx, pb.sy);
        ctx.lineTo(centroidX, centroidY);
        ctx.moveTo(pc.sx, pc.sy);
        ctx.lineTo(centroidX, centroidY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Central Interior Triangle Angle Badge
        const screenPerimeter =
          Math.hypot(pb.sx - pa.sx, pb.sy - pa.sy) +
          Math.hypot(pc.sx - pb.sx, pc.sy - pb.sy) +
          Math.hypot(pa.sx - pc.sx, pa.sy - pc.sy);

        if (screenPerimeter > 100) {
          const badgeW = 210;
          const badgeH = interiorAngles.has711AngleMatch ? 58 : 46;
          const bx = centroidX - badgeW / 2;
          const by = centroidY - badgeH / 2;

          ctx.fillStyle = 'rgba(6, 10, 18, 0.94)';
          ctx.strokeStyle = interiorAngles.has711AngleMatch ? '#facc15' : 'rgba(250, 204, 21, 0.5)';
          ctx.lineWidth = interiorAngles.has711AngleMatch ? 1.6 : 1;
          ctx.beginPath();
          ctx.roundRect(bx, by, badgeW, badgeH, 6);
          ctx.fill();
          ctx.stroke();

          // Header inside triangle badge
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#fde047';
          ctx.fillText('△ TRIANGLE INTERIOR ANGLES', bx + 10, by + 12);

          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('SUM: 180.0°', bx + badgeW - 54, by + 12);

          // 3 Interior Angles: A, B, C
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#00f0ff';
          ctx.fillText(`∠A: ${interiorAngles.angleA}°`, bx + 10, by + 26);
          ctx.fillStyle = '#ff007f';
          ctx.fillText(`∠B: ${interiorAngles.angleB}°`, bx + 78, by + 26);
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`∠C: ${interiorAngles.angleC}°`, bx + 146, by + 26);

          // Subtitle: Area & Side lengths
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillStyle = '#64748b';
          ctx.fillText(`Area: ${interiorAngles.area}m² | P: ${interiorAngles.perimeter}m`, bx + 10, by + 38);

          // 7:11 Harmonic Aspect Match highlight if present
          if (interiorAngles.has711AngleMatch) {
            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 8px "JetBrains Mono", monospace';
            ctx.fillText(
              `★ 7:11 SACRED ASPECT: ∠${interiorAngles.closestAngleTo711.vertex} ≈ 32.5° (${interiorAngles.closestAngleTo711.matchPct}%)`,
              bx + 10,
              by + 50
            );
          }
        }
        ctx.restore();
      }

      // Draw Channel A, B, C pucks.
      drawPuck(aPos, aFreq, 'A', '#00f0ff', '#083344', 'a', activeDrag === 'a' || hoverNode === 'a');
      drawPuck(bPos, bFreq, 'B', '#ff007f', '#4c0519', 'b', activeDrag === 'b' || hoverNode === 'b');
      drawPuck(cPos, cFreq, 'C', '#fbbf24', '#451a03', 'c', activeDrag === 'c' || hoverNode === 'c');

      }

      // 8. Hovered Star Info Card (if hovered)
      if (isStarModeActive && hoveredStar && !clickedStar) {
        const hoverPosition = celestialPosition(hoveredStar);
        const hp = projectCelestial3D(hoverPosition.x, hoverPosition.y, hoverPosition.z, width, height);
        ctx.save();
        ctx.fillStyle = 'rgba(6, 10, 18, 0.94)';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1;
        const infoCardHeight = showDetailedStarInfo ? 56 : 30;
        ctx.beginPath();
        ctx.roundRect(hp.sx + 12, hp.sy - (showDetailedStarInfo ? 38 : 24), showDetailedStarInfo ? 180 : 150, infoCardHeight, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#fde047';
        ctx.fillText(`★ ${hoveredStar.name} (${hoveredStar.bayer})`, hp.sx + 18, hp.sy - (showDetailedStarInfo ? 22 : 7));

        if (showDetailedStarInfo) {
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`Const: ${hoveredStar.constellation} | Mag: ${hoveredStar.mag}`, hp.sx + 18, hp.sy - 10);
          ctx.fillText(`RA: ${hoveredStar.raHours.toFixed(1)}h | Dec: ${hoveredStar.decDeg.toFixed(1)}°`, hp.sx + 18, hp.sy + 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(`Click to snap CH-${snapTargetChannel.toUpperCase()}`, hp.sx + 18, hp.sy + 13);
        }
        ctx.restore();
      }

      }
      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    aPos,
    bPos,
    cPos,
    cameraView,
    cameraYaw,
    cameraPitch,
    cameraZoom,
    aFreq,
    bFreq,
    cFreq,
    isRunning,
    isStarModeActive,
    showConstellationLines,
    constellationsEnabled,
    show110HzResearchComets,
    showDetailedStarInfo,
    showAllStars,
    visibleAllStarPositions,
    isEarthModeActive,
    is24HourRotationActive,
    timelineYear,
    earthTextureLoaded,
    earthTextureUrl,
    starAId,
    starBId,
    starCId,
    snapTargetChannel,
    lockedChannels,
    hoveredStar,
    clickedStar,
    overlay,
    relation711.isHarmonic711,
    project3D,
    projectCelestial3D,
    activeDrag,
    hoverNode,
    showTriangleAngles,
    interiorAngles,
  ]);

  // Pointer interactions
  // In Earth/top-plane mode, the globe receives pointer events. Intercept a
  // pointer-down only if it hits a celestial star; other interaction continues
  // to the globe, preserving rotate/zoom and location-pinning.
  const handleEarthStarPointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isStarModeActive || isSolarSystemMode) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest('canvas')) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Intercept the Sun first in Earth view or the 3D celestial overlay.
    if (handleSunCenterHit(x, y, rect.width, rect.height)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!isEarthModeActive) return;

    for (const star of REAL_CELESTIAL_STARS) {
      const point = celestialPosition(star);
      const screen = projectCelestial3D(point.x, point.y, point.z, rect.width, rect.height);
      if (Math.hypot(x - screen.sx, y - screen.sy) < 18) {
        event.preventDefault();
        event.stopPropagation();
        handleSnapChannelToStar(snapTargetChannel, star);
        setClickedStar(star);
        setHoveredStar(star);
        return;
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    if (handleSunCenterHit(x, y, width, height)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const pa = project3D(aPos.x, aPos.y, aPos.z, width, height);
    const pb = project3D(bPos.x, bPos.y, bPos.z, width, height);
    const pc = project3D(cPos.x, cPos.y, cPos.z, width, height);
    const distA = Math.hypot(x - pa.sx, y - pa.sy);
    const distB = Math.hypot(x - pb.sx, y - pb.sy);
    const distC = Math.hypot(x - pc.sx, y - pc.sy);
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    // Pucks win hit-testing so a channel on a star can still be dragged.
    // Shift-click deliberately selects an overlapping star instead.
    if (!e.shiftKey && Math.min(distA, distB, distC) < 22) {
      const channel: 'a' | 'b' | 'c' = distA <= distB && distA <= distC ? 'a' : distB <= distC ? 'b' : 'c';
      setActiveDrag(channel);
      setHoverNode(channel);
      setLockedChannels((prev) => ({ ...prev, [channel]: false }));
      setEarthChannelTargets((prev) => ({ ...prev, [channel]: null }));
      if (channel === 'a') setStarAId('');
      else if (channel === 'b') setStarBId('');
      else setStarCId('');
      setClickedStar(null);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (isStarModeActive) {
      for (const star of REAL_CELESTIAL_STARS) {
        const starPosition = celestialPosition(star);
        const sp = projectCelestial3D(starPosition.x, starPosition.y, starPosition.z, width, height);
        if (Math.hypot(x - sp.sx, y - sp.sy) < 18) {
          handleSnapChannelToStar(snapTargetChannel, star);
          setClickedStar(star);
          return;
        }
      }
    }
    if (clickedStar) setClickedStar(null);

    if (Math.min(distA, distB, distC) < 22) {
      const channel: 'a' | 'b' | 'c' = distA <= distB && distA <= distC ? 'a' : distB <= distC ? 'b' : 'c';
      setActiveDrag(channel);
      setHoverNode(channel);
      setLockedChannels((prev) => ({ ...prev, [channel]: false }));
      setEarthChannelTargets((prev) => ({ ...prev, [channel]: null }));
      if (channel === 'a') setStarAId('');
      else if (channel === 'b') setStarBId('');
      else setStarCId('');
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    setActiveDrag('camera');
    cameraStartAngle.current = { yaw: cameraYaw, pitch: cameraPitch };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;
    const cx = width / 2;
    const cy = height / 2;
    const baseScale = Math.min(width, height) * 0.075 * cameraZoom;

    if (activeDrag === 'camera') {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      const newYaw = cameraStartAngle.current.yaw + dx * 0.5;
      const newPitch = Math.max(-85, Math.min(85, cameraStartAngle.current.pitch + dy * 0.5));
      onUpdateCameraAngles(Number(newYaw.toFixed(1)), Number(newPitch.toFixed(1)));
    } else if (activeDrag === 'a') {
      if (e.shiftKey) {
        const dy = (dragStartPos.current.y - e.clientY) * 0.08;
        const newY = Math.max(-8, Math.min(8, aPos.y + dy));
        dragStartPos.current.y = e.clientY;
        onUpdateAPos({ ...aPos, y: Number(newY.toFixed(1)) });
      } else if (cameraView === 'front') {
        const newX = Math.max(-8, Math.min(8, (x - cx) / (baseScale * 1.25)));
        const newY = Math.max(-8, Math.min(8, (cy - y) / (baseScale * 1.25)));
        onUpdateAPos({ ...aPos, x: Number(newX.toFixed(1)), y: Number(newY.toFixed(1)) });
      } else {
        const mapped = unprojectOrbitPlane(x, y, aPos.y, width, height, aPos.x, aPos.z);
        onUpdateAPos({ ...aPos, x: mapped.x, z: mapped.z });
      }
    } else if (activeDrag === 'b') {
      if (e.shiftKey) {
        const dy = (dragStartPos.current.y - e.clientY) * 0.08;
        const newY = Math.max(-8, Math.min(8, bPos.y + dy));
        dragStartPos.current.y = e.clientY;
        onUpdateBPos({ ...bPos, y: Number(newY.toFixed(1)) });
      } else if (cameraView === 'front') {
        const newX = Math.max(-8, Math.min(8, (x - cx) / (baseScale * 1.25)));
        const newY = Math.max(-8, Math.min(8, (cy - y) / (baseScale * 1.25)));
        onUpdateBPos({ ...bPos, x: Number(newX.toFixed(1)), y: Number(newY.toFixed(1)) });
      } else {
        const mapped = unprojectOrbitPlane(x, y, bPos.y, width, height, bPos.x, bPos.z);
        onUpdateBPos({ ...bPos, x: mapped.x, z: mapped.z });
      }
    } else if (activeDrag === 'c') {
      if (e.shiftKey) {
        const dy = (dragStartPos.current.y - e.clientY) * 0.08;
        const newY = Math.max(-8, Math.min(8, cPos.y + dy));
        dragStartPos.current.y = e.clientY;
        onUpdateCPos({ ...cPos, y: Number(newY.toFixed(1)) });
      } else if (cameraView === 'front') {
        const newX = Math.max(-8, Math.min(8, (x - cx) / (baseScale * 1.25)));
        const newY = Math.max(-8, Math.min(8, (cy - y) / (baseScale * 1.25)));
        onUpdateCPos({ ...cPos, x: Number(newX.toFixed(1)), y: Number(newY.toFixed(1)) });
      } else {
        const mapped = unprojectOrbitPlane(x, y, cPos.y, width, height, cPos.x, cPos.z);
        onUpdateCPos({ ...cPos, x: mapped.x, z: mapped.z });
      }
    } else {
      const pa = project3D(aPos.x, aPos.y, aPos.z, width, height);
      const pb = project3D(bPos.x, bPos.y, bPos.z, width, height);
      const pc = project3D(cPos.x, cPos.y, cPos.z, width, height);

      const distA = Math.hypot(x - pa.sx, y - pa.sy);
      const distB = Math.hypot(x - pb.sx, y - pb.sy);
      const distC = Math.hypot(x - pc.sx, y - pc.sy);

      if (distA < 22) setHoverNode('a');
      else if (distB < 22) setHoverNode('b');
      else if (distC < 22) setHoverNode('c');
      else setHoverNode(null);

      // Star Hover detection
      if (isStarModeActive) {
        let found: CelestialStar | null = null;
        for (const star of REAL_CELESTIAL_STARS) {
          const starPosition = celestialPosition(star);
          const sp = projectCelestial3D(starPosition.x, starPosition.y, starPosition.z, width, height);
          if (Math.hypot(x - sp.sx, y - sp.sy) < 18) {
            found = star;
            break;
          }
        }
        setHoveredStar(found);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setActiveDrag(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.08;
    const newZoom = Math.max(0.6, Math.min(5, cameraZoom + delta));
    onUpdateCameraZoom(Number(newZoom.toFixed(2)));
  };

  const handleEarthImagerySourceChange = useCallback((source: 'satellite' | 'blue-marble' | 'land-ocean') => {
    setEarthImagerySource(source);
    setEarthTextureUrl(earthImagerySources[source]);
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={handleEarthStarPointerDownCapture}
      className={`relative w-full h-full bg-[#060a12] rounded-xl border border-slate-800 shadow-2xl overflow-hidden select-none flex flex-col ${
        isStageFullscreen ? 'fixed inset-0 z-[100] rounded-none' : ''
      }`}
    >
      {/* Hidden File Input for Top Plane Overlay */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top 3D Deck Controls */}
      <div className="absolute top-3 left-3 right-3 z-[70] flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        {/* Left: View Mode Switches & Orbit Reset */}
        <div className="flex items-center gap-1 bg-[#0b1220]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-lg">
          <button
            onClick={() => onUpdateCameraView('perspective')}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
              cameraView === 'perspective'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3D Orbit Cube
          </button>
          <button
            onClick={() => onUpdateCameraView('top')}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
              cameraView === 'top'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Top Plane
          </button>
          <button
            onClick={() => onUpdateCameraView('front')}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
              cameraView === 'front'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Front Elevation
          </button>

          <button
            type="button"
            onClick={toggle24HourRotation}
            aria-pressed={is24HourRotationActive}
            className={`ml-1 rounded border px-2 py-1 text-[10px] font-mono font-bold transition-colors ${is24HourRotationActive ? 'border-emerald-300 bg-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(52,211,153,.35)]' : 'border-emerald-700 text-emerald-300 hover:bg-emerald-950/50'}`}
            title={is24HourRotationActive ? 'Accelerated 24-hour day simulation is running; click to pause it' : 'Run an accelerated 24-hour day simulation (one full day every 24 seconds); click again to pause'}
          >
            {is24HourRotationActive ? '24H DAY · ON' : '24H DAY'}
          </button>
          <button
            onClick={() => {
              const globe = globeRef.current;
              const canvas = globe?.renderer?.()?.domElement as HTMLCanvasElement | undefined;
              if (!canvas) { window.alert('The Earth view is not ready for a screenshot yet.'); return; }
              try {
                const pov = globe?.pointOfView?.() || {};
                const spot = selectedEarthSite?.name || `Earth-${Number(pov.lat ?? 0).toFixed(2)}-${Number(pov.lng ?? 0).toFixed(2)}`;
                const safeName = String(spot).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'Earth-Screenshot';
                // Composite a screenshot overlay on top of the WebGL globe. The WebGL canvas
                // contains dots but intentionally no text; draw readable names into the PNG.
                const capture = document.createElement('canvas');
                capture.width = canvas.width;
                capture.height = canvas.height;
                const ctx = capture.getContext('2d');
                if (!ctx) throw new Error('Could not create screenshot canvas');
                ctx.drawImage(canvas, 0, 0);
                const scale = canvas.width / Math.max(1, canvas.clientWidth);
                const drawLabel = (name: string, lat: number, lng: number, selected = false) => {
                  const screen = (globe as any)?.getScreenCoords?.(lat, lng, 0.015);
                  if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return;
                  const x = screen.x * scale, y = screen.y * scale;
                  if (x < 4 || y < 4 || x > capture.width - 4 || y > capture.height - 4) return;
                  ctx!.font = `${selected ? 'bold ' : ''}${Math.max(11, Math.round(11 * scale))}px Arial, sans-serif`;
                  const textWidth = ctx!.measureText(name).width;
                  const pad = 4 * scale;
                  ctx!.fillStyle = selected ? 'rgba(8,47,73,0.94)' : 'rgba(2,6,23,0.82)';
                  ctx!.strokeStyle = selected ? '#38bdf8' : 'rgba(148,163,184,0.65)';
                  ctx!.lineWidth = Math.max(1, scale);
                  ctx!.beginPath();
                  ctx!.roundRect(x + 7 * scale, y - 9 * scale, textWidth + pad * 2, 17 * scale, 3 * scale);
                  ctx!.fill(); ctx!.stroke();
                  ctx!.fillStyle = selected ? '#e0f2fe' : '#f8fafc';
                  ctx!.fillText(name, x + 7 * scale + pad, y + 3 * scale);
                };
                DEFAULT_EARTH_POINTS.forEach((point) => drawLabel(point.name, point.lat, point.lon));
                if (selectedEarthSite) drawLabel(selectedEarthSite.name, selectedEarthSite.lat, selectedEarthSite.lon, true);
                // Keep the selected city/site name visible in a title overlay even if it is on the far side.
                const title = selectedEarthSite?.name || spot;
                ctx.fillStyle = 'rgba(2,6,23,0.88)';
                ctx.fillRect(0, 0, capture.width, Math.max(34 * scale, 34));
                ctx.fillStyle = '#e0f2fe';
                ctx.font = `bold ${Math.max(13, Math.round(13 * scale))}px Arial, sans-serif`;
                ctx.fillText(`NEUROPULSE EARTH · ${title}`, 12 * scale, 22 * scale);
                ctx.fillStyle = '#cbd5e1';
                ctx.font = `${Math.max(10, Math.round(10 * scale))}px Arial, sans-serif`;
                ctx.fillText(`${Number(pov.lat ?? selectedEarthSite?.lat ?? 0).toFixed(4)}° lat  ·  ${Number(pov.lng ?? selectedEarthSite?.lon ?? 0).toFixed(4)}° lon  ·  ${new Date().toLocaleString()}`, 12 * scale, 34 * scale);
                const link = document.createElement('a');
                link.download = `${safeName}-labeled-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
                link.href = capture.toDataURL('image/png');
                link.click();
              } catch (error) {
                console.error('Earth screenshot failed:', error);
                window.alert('Could not capture the Earth view. Try again after the globe finishes rendering.');
              }
            }}
            className="ml-1 inline-flex items-center gap-1 rounded border border-sky-500/50 bg-sky-950/70 px-2 py-1 text-[10px] font-mono font-bold text-sky-200 hover:bg-sky-900/80"
            title="Save a PNG screenshot of the Earth globe using the selected site's name"
          >
            <Camera className="w-3.5 h-3.5" /> SCREENSHOT
          </button>
          <button
            onClick={onResetCamera}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ml-1"
            title="Reset 3D Orbit Camera"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setEarthImageryPanelOpen((open) => !open)}
            className="ml-1 flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded border border-sky-500/40 text-sky-300 hover:bg-sky-950/50"
            title="Choose public Earth imagery without sign-in"
            aria-label="Earth imagery sources"
          >
            <Layers className="w-3.5 h-3.5" />
            EARTH IMAGERY
          </button>
          <button
            onClick={() => activateSeaLevelOverlay(!showSeaLevelOverlay)}
            aria-pressed={showSeaLevelOverlay}
            className={`ml-1 flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-mono font-bold ${showSeaLevelOverlay ? 'border-cyan-300 bg-cyan-950 text-cyan-100' : 'border-cyan-700/60 text-cyan-300 hover:bg-cyan-950/50'}`}
            title="Open the DEM-based sea-level inundation model"
          >
            <Layers className="w-3.5 h-3.5" /> SEA LEVEL
          </button>
        </div>

        {/* Center: Star Celestial Alignment Button + Snap Channel Selector + Top Plane Overlay Button */}
        <div className="flex flex-wrap items-center justify-evenly gap-1 bg-[#0b1220]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-lg">
          {/* One persistent STARS button controls both star panels in the right sidebar. */}
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => {
                const open = !isStarPanelExpanded;
                setIsStarPanelExpanded(open);
                setIsCelestialDeckCollapsed(!open);
                if (open) setIsStarModeActive(true);
              }}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-mono font-bold rounded-lg border shadow-md transition-colors ${isStarPanelExpanded ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-amber-500/40 bg-[#0b1220]/90 text-amber-300 hover:bg-amber-950/50'}`}
              title={isStarPanelExpanded ? 'Minimize star controls in the right sidebar' : 'Open star controls in the right sidebar'}
              aria-label="STARS"
              aria-expanded={isStarPanelExpanded}
            >
              <Star className="w-3.5 h-3.5" />
              <span>STARS</span>
            </button>
            {isStarPanelExpanded && typeof document !== 'undefined' && document.querySelector('.atlas-right') ? createPortal((
              <div className="atlas-panel atlas-star-alignment-panel max-h-[65vh] overflow-y-auto overscroll-contain pointer-events-auto" style={{ overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'auto' }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-wider text-amber-300">Star Alignment</span>
                  <button onClick={() => { setIsStarPanelExpanded(false); setIsCelestialDeckCollapsed(true); }} className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700" title="Minimize all star controls">
                    <Minimize className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    onClick={(event) => { event.stopPropagation(); setIsStarModeActive((prev) => !prev); }}
                    aria-pressed={isStarModeActive}
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold rounded border transition-all ${
                      isStarModeActive ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-slate-900 text-amber-300 border-amber-500/40'
                    }`}
                    title="Toggle real celestial star overlays"
                  >
                    <Star className={`w-3 h-3 ${isStarModeActive ? 'fill-current' : ''}`} />
                    {isStarModeActive ? 'STARS ON' : 'STARS OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleAllStars}
                    aria-pressed={showAllStars}
                    className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-mono font-bold transition-colors ${showAllStars ? 'border-violet-300 bg-violet-400 text-slate-950' : 'border-violet-500/40 bg-slate-900 text-violet-200 hover:bg-violet-950/60'}`}
                    title="Load the HYG real-star catalog only when enabled; the distance slider reveals stars nearest to farthest"
                  >
                    ✦ {showAllStars ? 'ALL STARS ON' : 'ALL STARS'}
                  </button>
                  <button
                    onClick={(event) => { event.stopPropagation(); setIsStarModeActive(true); setShowConstellationLines((value) => !value); }}
                    aria-pressed={showConstellationLines}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold border ${showConstellationLines ? 'bg-sky-400 text-slate-950 border-sky-300' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
                    title="Toggle constellation connecting lines independently from star visibility"
                  >
                    CONSTELLATIONS {showConstellationLines ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={(event) => { event.stopPropagation(); onTogglePositionPitchMode(); }}
                    aria-pressed={positionPitchMode}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold border ${positionPitchMode ? 'bg-emerald-400 text-slate-950 border-emerald-300' : 'bg-slate-900 text-emerald-300 border-emerald-500/40'}`}
                    title="When on, moving A, B, or C changes its real oscillator frequency based on XYZ location"
                  >
                    <MapPin className="w-3 h-3" />
                    LOCATION→HZ {positionPitchMode ? 'ON' : 'OFF'}
                  </button>
                  {(isStarModeActive || isEarthAssignMode) && (
                    <>
                      <button
                        onClick={() => setIsEarthAssignMode((value) => !value)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold border ${isEarthAssignMode ? 'bg-emerald-400 text-slate-950 border-emerald-300' : 'bg-slate-900 text-emerald-300 border-emerald-500/40'}`}
                        title="When enabled, click an Earth location to pin the selected A/B/C channel there"
                      >
                        PIN EARTH {isEarthAssignMode ? 'ON' : 'OFF'}
                      </button>
                      {(['a', 'b', 'c'] as const).map((channel) => (
                        <button
                          key={channel}
                          onClick={() => setSnapTargetChannel(channel)}
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            snapTargetChannel === channel
                              ? channel === 'a' ? 'bg-cyan-500 text-black' : channel === 'b' ? 'bg-pink-500 text-white' : 'bg-amber-400 text-black'
                              : channel === 'a' ? 'text-cyan-400 hover:bg-cyan-950/40' : channel === 'b' ? 'text-pink-400 hover:bg-pink-950/40' : 'text-amber-400 hover:bg-amber-950/40'
                          }`}
                          title={`Next star click will snap Channel ${channel.toUpperCase()}`}
                        >
                          CH-{channel.toUpperCase()} {lockedChannels[channel] ? '🔒' : ''}
                        </button>
                      ))}
                    </>
                  )}
                </div>
                {showAllStars && (
                  <div className="rounded-lg border border-violet-500/40 bg-slate-950/95 p-2.5">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                      <span className="font-bold text-violet-200">REAL STARS · NEAR → FAR</span>
                      <span className="text-white">{formatLightYears(allStarsDistanceLimitLy)}</span>
                    </div>
                    {allStarLoading && <div className="mt-2 text-[10px] text-violet-200 animate-pulse">Downloading and sorting HYG star distances…</div>}
                    {allStarLoadError && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-rose-300">
                        <span className="min-w-0 flex-1">{allStarLoadError}</span>
                        <button type="button" onClick={() => void loadAllStars()} className="rounded border border-rose-500/60 px-2 py-1 text-rose-200 hover:bg-rose-950/70">RETRY</button>
                      </div>
                    )}
                    {!allStarLoading && !allStarLoadError && allStarCatalog.length > 0 && (
                      <>
                        <input
                          type="range" min={0} max={100} step={1}
                          aria-label="Maximum star distance in light-years"
                          value={allStarsDistanceSlider}
                          onChange={(event) => setAllStarsDistanceSlider(Number(event.target.value))}
                          className="mt-2 w-full accent-violet-400 cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] font-mono text-slate-500"><span>10 ly · nearest</span><span>1,000 ly</span><span>100,000 ly · farthest</span></div>
                        <div className="mt-1 text-[9px] text-slate-300">
                          {visibleAllStarPositions.length.toLocaleString()} / {allStarCatalog.length.toLocaleString()} catalog stars visible
                        </div>
                        <div className="mt-1 text-[8px] leading-relaxed text-slate-500">{HYG_STAR_CATALOG_SOURCE}. Positions use J2000 RA/Dec; 3D distances are logarithmically compressed for display. Missing-distance placeholders are excluded.</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ), document.querySelector('.atlas-right') as HTMLElement) : null}
          </div>

          {/* SHOW TRIANGLE INTERIOR ANGLES TOGGLE */}
          <button
            onClick={() => setShowTriangleAngles((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg border transition-all shadow-md ${
              showTriangleAngles
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                : 'bg-[#0b1220]/90 backdrop-blur-md text-slate-300 border-slate-700 hover:text-white hover:border-slate-500'
            }`}
            title="Display interior triangle vertex angles (∠A, ∠B, ∠C) inside the 3D triangle (Sum: 180°)"
          >
            <Triangle className={`w-3.5 h-3.5 ${showTriangleAngles ? 'fill-current' : ''}`} />
            <span>ANGLES</span>
            {clickedStarCount >= 3 && (
              <span className="text-[9px] bg-black/25 px-1 rounded ml-0.5">3/3</span>
            )}
          </button>

          {/* UPLOAD TOP PLANE OVERLAY BUTTON */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg border transition-all shadow-md ${
              overlay.imageUrl
                ? 'bg-cyan-950/90 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                : 'bg-[#0b1220]/90 backdrop-blur-md text-slate-300 border-slate-700 hover:text-white hover:border-slate-500'
            }`}
            title="Upload blueprint or image to overlay on the top plane beneath the audio channels"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{overlay.imageUrl ? 'OVERLAY LOADED' : 'UPLOAD OVERLAY'}</span>
          </button>

          {isEarthModeActive && !isTimelineActive && (
            <button type="button" onClick={() => setIsTimelineActive(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-amber-500/60 bg-[#0b1220]/90 text-amber-300 hover:bg-amber-950/60 shadow-md"
              aria-label="Show historical timeline" title="Show historical Earth / sky timeline">
              <Layers className="w-3.5 h-3.5" /><span>TIMELINE</span>
            </button>
          )}
          {/* Quick Overlay Visibility / Controls Toggle */}
          {overlay.imageUrl && (
            <div className="flex items-center gap-1 bg-[#0b1220]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setOverlay((prev) => ({ ...prev, visible: !prev.visible }))}
                className="p-1 text-slate-400 hover:text-white rounded"
                title={overlay.visible ? 'Hide Overlay' : 'Show Overlay'}
              >
                {overlay.visible ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
              </button>
              <button
                onClick={() => setShowOverlayControls((prev) => !prev)}
                className={`p-1 rounded ${showOverlayControls ? 'text-cyan-300 bg-cyan-950' : 'text-slate-400 hover:text-white'}`}
                title="Adjust Overlay Opacity & Scale"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleClearOverlay}
                className="p-1 text-slate-500 hover:text-red-400 rounded"
                title="Remove Overlay"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Camera yaw, pitch, zoom and fullscreen controls live in the right tools sidebar. */}
        {typeof document !== 'undefined' && document.querySelector('.atlas-right') && createPortal(
        <div className="atlas-camera-control-panel flex flex-wrap items-center gap-2 bg-[#0b1220]/95 backdrop-blur-md px-3 py-2 rounded-lg border border-purple-500/50 text-xs font-mono text-slate-400 shadow-lg">
          <Rotate3D className="w-3.5 h-3.5 text-purple-400" />
          <span>
            Yaw: <strong className="text-white">{cameraYaw.toFixed(0)}°</strong>
          </span>
          <span>·</span>
          <span>
            Pitch: <strong className="text-white">{cameraPitch.toFixed(0)}°</strong>
          </span>

          <div className="flex items-center gap-1 ml-2 border-l border-slate-700 pl-2">
            <button
              onClick={() => onUpdateCameraZoom(Math.max(0.6, +(cameraZoom - 0.1).toFixed(2)))}
              className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-300 w-8 text-center">
              {Math.round(cameraZoom * 100)}%
            </span>
            <button
              onClick={() => onUpdateCameraZoom(Math.min(5, +(cameraZoom + 0.1).toFixed(2)))}
              className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stage Fullscreen Toggle */}
          <button
            onClick={handleToggleStageFullscreen}
            className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition-colors ml-1 border-l border-slate-700 pl-2"
            title={isStageFullscreen ? 'Exit 3D Stage Fullscreen' : 'Expand 3D Stage Fullscreen'}
          >
            {isStageFullscreen ? <Minimize className="w-3.5 h-3.5 text-cyan-400" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>,
        document.querySelector('.atlas-right') as HTMLElement
        )}
      </div>

      {earthImageryPanelOpen && (
        <div className="absolute top-16 left-3 z-40 w-[min(92vw,340px)] rounded-xl border border-sky-500/50 bg-[#07101d]/96 p-3 shadow-2xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 text-sky-200 text-xs font-mono font-bold">
              <Layers className="w-4 h-4" />
              PUBLIC EARTH IMAGERY
            </div>
            <button onClick={() => setEarthImageryPanelOpen(false)} className="p-1 rounded text-slate-400 hover:text-white" aria-label="Close Earth imagery panel">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
            Choose a public globe texture. No Google Cloud project, API key, account sign-in, or environment setup is required. Your historical sites, cities, orbit controls, stars and alignment overlays stay in place.
          </p>
          <label className="block text-[10px] text-slate-400 mb-1" htmlFor="earth-imagery-source">Earth imagery</label>
          <select
            id="earth-imagery-source"
            value={earthImagerySource}
            onChange={(event) => handleEarthImagerySourceChange(event.target.value as 'satellite' | 'blue-marble' | 'land-ocean')}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 mb-2"
          >
            <option value="satellite">Satellite imagery (Esri World Imagery)</option>
            <option value="blue-marble">Blue Marble Earth</option>
            <option value="land-ocean">NASA land, ocean and ice</option>
          </select>
          <div className="text-[10px] text-emerald-200 mb-2">No sign-in required · selected texture applies to the existing globe</div>
          <button
            onClick={() => setEarthTextureUrl(earthImagerySources[earthImagerySource])}
            className="w-full rounded-md border border-sky-400/60 bg-sky-950/70 px-3 py-2 text-xs font-mono font-bold text-sky-200 hover:bg-sky-900/80"
          >
            APPLY EARTH IMAGERY
          </button>
          <p className="mt-2 text-[9px] text-slate-500 leading-relaxed">Satellite imagery is served by Esri's public World Imagery service and may be subject to its availability and usage terms.</p>
        </div>
      )}

      {showSeaLevelOverlay && typeof document !== 'undefined' && document.querySelector('.atlas-right') && createPortal(
        <section className="atlas-panel atlas-sea-level-panel max-h-[65vh] overflow-y-auto overscroll-contain" style={{ overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'auto' }}>
          <div className="atlas-panel-heading">
            <span className="flex items-center gap-2 text-cyan-200"><Layers className="h-4 w-4" /> SEA-LEVEL INUNDATION MODEL</span>
            <button onClick={() => activateSeaLevelOverlay(false)} className="rounded p-1 text-slate-400 hover:text-white" aria-label="Close sea-level model"><X className="h-3.5 w-3.5" /></button>
          </div>
          <p className="mb-2 text-[10px] leading-relaxed text-slate-400">Uses actual elevations from a GeoTIFF DEM. The model floods only terrain connected to ocean cells at the raster edge; it does not invent future sea levels or pretend a basemap is elevation data.</p>
          <SeaLevelDemTool onFloodPolygons={setSeaLevelFloodPolygons} />
        </section>,
        document.querySelector('.atlas-right')!
      )}

      {/* Real-time Snap Feedback Banner */}
      {snapFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-amber-400 text-slate-950 font-mono font-bold text-xs px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-bounce pointer-events-none">
          {snapFeedback}
        </div>
      )}

      {/* Interactive Clicked Star Action Modal (Direct Snap & Lock) */}
      {isStarModeActive && clickedStar && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-[#0b1220]/95 backdrop-blur-md p-3.5 rounded-xl border border-amber-400 shadow-2xl flex flex-col gap-2 min-w-[280px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-current" />
              <span className="text-xs font-mono font-bold text-amber-300">
                {clickedStar.name} ({clickedStar.bayer})
              </span>
            </div>
            <button
              onClick={() => setClickedStar(null)}
              className="text-slate-400 hover:text-white text-xs font-mono px-1.5"
            >
              ✕
            </button>
          </div>

          <div className="text-[10px] font-mono text-slate-400">
            <span>Constellation: <strong className="text-slate-200">{clickedStar.constellation}</strong></span> ·{' '}
            <span>RA: <strong className="text-slate-200">{clickedStar.raHours.toFixed(1)}h</strong></span> ·{' '}
            <span>Dec: <strong className="text-slate-200">{clickedStar.decDeg.toFixed(1)}°</strong></span>
          </div>

          <span className="text-[10px] font-mono text-slate-400 mt-1">Snap and lock channel to this star position:</span>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                handleSnapChannelToStar('a', clickedStar);
                setClickedStar(null);
              }}
              className="py-1.5 text-xs font-mono font-bold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 rounded border border-cyan-500 shadow-sm transition-all"
            >
              Snap CH-A
            </button>
            <button
              onClick={() => {
                handleSnapChannelToStar('b', clickedStar);
                setClickedStar(null);
              }}
              className="py-1.5 text-xs font-mono font-bold bg-pink-950 hover:bg-pink-900 text-pink-300 rounded border border-pink-500 shadow-sm transition-all"
            >
              Snap CH-B
            </button>
            <button
              onClick={() => {
                handleSnapChannelToStar('c', clickedStar);
                setClickedStar(null);
              }}
              className="py-1.5 text-xs font-mono font-bold bg-amber-950 hover:bg-amber-900 text-amber-300 rounded border border-amber-500 shadow-sm transition-all"
            >
              Snap CH-C
            </button>
          </div>
          <button
            onClick={() => void handleLocateStarOnEarth(clickedStar)}
            disabled={earthLocateLoading}
            className="w-full mt-1 flex items-center justify-center gap-2 py-2 text-xs font-mono font-bold bg-emerald-950 hover:bg-emerald-900 disabled:opacity-60 text-emerald-200 rounded border border-emerald-500/70 shadow-sm transition-all"
          >
            <MapPin className="w-4 h-4" />
            {earthLocateLoading ? 'CALCULATING LIVE EARTH POSITION…' : 'LOCATE ON EARTH · 2D MAP + IMAGE'}
          </button>
        </div>
      )}

      {earthLocateTarget && (
        <div className="absolute inset-3 z-[60] overflow-y-auto rounded-2xl border border-emerald-400/70 bg-[#07101d]/96 p-3 md:p-5 shadow-2xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-sm md:text-base font-mono font-bold text-emerald-200">EARTH LOCATION · {clickedStar?.name || 'Selected star'}</div>
              <div className="mt-1 text-[10px] md:text-xs font-mono text-slate-300">
                Substellar point: {earthLocateTarget.latitude.toFixed(4)}° lat, {earthLocateTarget.longitude.toFixed(4)}° lon · {earthLocateTarget.date} {earthLocateTarget.utcTime}
              </div>
              <div className="mt-1 text-[9px] font-mono text-slate-500">{earthLocateTarget.source} · UTC / GMST calculation. The marker is the point where the star is directly overhead.</div>
            </div>
            <button onClick={() => setEarthLocateTarget(null)} aria-label="Close Earth location" className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="min-h-[260px] md:min-h-[380px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
              <div className="px-3 py-2 text-[10px] font-mono font-bold tracking-wider text-emerald-200">EARTH EXPLORER · {earthMapView.toUpperCase()}</div>
              <div className="flex flex-wrap gap-1 px-2 pb-2">
                {([
                  ['map', 'ROAD MAP'],
                  ['terrain', 'TERRAIN'],
                  ['satellite', 'SATELLITE'],
                ] as const).map(([view, label]) => (
                  <button key={view} onClick={() => setEarthMapView(view)} className={`rounded border px-2 py-1 text-[9px] font-mono font-bold ${earthMapView === view ? 'border-emerald-400 bg-emerald-900 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'}`}>{label}</button>
                ))}
                <a className="rounded border border-sky-700 bg-sky-950 px-2 py-1 text-[9px] font-mono font-bold text-sky-200 hover:bg-sky-900" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${earthLocateTarget.latitude},${earthLocateTarget.longitude}`} target="_blank" rel="noreferrer">STREET VIEW ↗</a>
              </div>
              <iframe
                title={`Earth ${earthMapView} map at calculated substellar point`}
                className="w-full h-[300px] md:h-[430px] border-0"
                loading="lazy"
                src={earthMapView === 'map'
                  ? `https://www.openstreetmap.org/export/embed.html?bbox=${earthLocateTarget.longitude - 2},${Math.max(-85, earthLocateTarget.latitude - 1.5)},${earthLocateTarget.longitude + 2},${Math.min(85, earthLocateTarget.latitude + 1.5)}&layer=mapnik&marker=${earthLocateTarget.latitude},${earthLocateTarget.longitude}`
                  : `https://maps.google.com/maps?q=${earthLocateTarget.latitude},${earthLocateTarget.longitude}&t=${earthMapView === 'satellite' ? 'k' : 'p'}&z=8&output=embed`}
              />
              <div className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <a className="text-[10px] text-sky-300 hover:text-sky-100" href={`https://www.openstreetmap.org/?mlat=${earthLocateTarget.latitude}&mlon=${earthLocateTarget.longitude}#map=8/${earthLocateTarget.latitude}/${earthLocateTarget.longitude}`} target="_blank" rel="noreferrer">Open full OpenStreetMap ↗</a>
                <a className="text-[10px] text-sky-300 hover:text-sky-100" href={`https://www.google.com/maps/search/?api=1&query=${earthLocateTarget.latitude},${earthLocateTarget.longitude}`} target="_blank" rel="noreferrer">Explore nearby places ↗</a>
              </div>
            </div>
            <div className="min-h-[260px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="text-[10px] font-mono font-bold tracking-wider text-emerald-200">{earthStreetViewFallback ? 'NEARBY SATELLITE FALLBACK' : 'NEAREST AVAILABLE STREET VIEW'}</div>
                <div className="flex gap-1">
                  {earthStreetViewFallback && <button onClick={() => setEarthStreetViewFallback(false)} className="rounded border border-sky-700 bg-sky-950 px-2 py-1 text-[9px] font-mono font-bold text-sky-200 hover:bg-sky-900">RETRY STREET VIEW</button>}
                  <a className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] font-mono font-bold text-slate-300 hover:text-white" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${earthLocateTarget.latitude},${earthLocateTarget.longitude}`} target="_blank" rel="noreferrer">OPEN IN MAPS ↗</a>
                </div>
              </div>
              {earthStreetViewFallback ? (
                <img
                  src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${earthLocateTarget.longitude - 0.025},${Math.max(-85, earthLocateTarget.latitude - 0.018)},${earthLocateTarget.longitude + 0.025},${Math.min(85, earthLocateTarget.latitude + 0.018)}&bboxSR=4326&imageSR=4326&size=1200,760&format=jpg&transparent=false&f=image`}
                  alt={`Satellite imagery near ${earthLocateTarget.latitude.toFixed(4)}, ${earthLocateTarget.longitude.toFixed(4)}`}
                  className="w-full h-[300px] md:h-[430px] object-cover bg-slate-900"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <iframe
                  title={`Nearest Google Street View panorama near ${earthLocateTarget.latitude.toFixed(4)}, ${earthLocateTarget.longitude.toFixed(4)}`}
                  className="w-full h-[300px] md:h-[430px] border-0 bg-slate-900"
                  src={`https://maps.google.com/maps?q=&layer=c&cbll=${earthLocateTarget.latitude},${earthLocateTarget.longitude}&output=svembed`}
                  loading="eager"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
              <div className="px-3 py-2 text-[10px] text-slate-500">
                {earthStreetViewFallback ? 'Street View did not confirm a usable panorama in time; showing high-detail satellite imagery at the same coordinates.' : 'Google Street View attempts the nearest available panorama to the calculated coordinate. Satellite imagery automatically replaces it after 10 seconds if Street View does not load.'}
              </div>
            </div>
          </div>
          <div className="mt-3 text-[9px] text-slate-500">Images are best-effort geographic context, not guaranteed to be a photograph of the exact coordinate. Map data © OpenStreetMap contributors.</div>
        </div>
      )}

      {/* Floating Overlay Controls Popover (When toggled) */}
      {overlay.imageUrl && showOverlayControls && (
        <div className="absolute top-16 right-3 z-30 bg-[#0b1220]/95 backdrop-blur-md p-3 rounded-xl border border-cyan-500/40 shadow-2xl flex flex-col gap-2 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyan-400" />
              Top Plane Overlay
            </span>
            <span className="text-[9px] font-mono text-slate-500 truncate max-w-[100px]">
              {overlay.imageName}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Opacity:</span>
              <span className="text-white">{Math.round(overlay.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={overlay.opacity}
              onChange={(e) => setOverlay((prev) => ({ ...prev, opacity: parseFloat(e.target.value) }))}
              className="accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Scale:</span>
              <span className="text-white">{overlay.scale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={overlay.scale}
              onChange={(e) => setOverlay((prev) => ({ ...prev, scale: parseFloat(e.target.value) }))}
              className="accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>

          <button
            onClick={() => onUpdateCameraView('top')}
            className="mt-1 py-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 rounded border border-cyan-800 text-center"
          >
            Switch to Top View Alignment
          </button>
        </div>
      )}

      {/* Floating Celestial Star & 7-11 Astrometric Deck (When Star Mode is active) */}
      {isStarModeActive && !isCelestialDeckCollapsed && typeof document !== 'undefined' && document.querySelector('.atlas-right') && createPortal(
        <div className="atlas-panel atlas-celestial-star-deck relative z-30 w-full max-w-full overscroll-contain touch-pan-y pr-1 bg-[#0b1220]/95 backdrop-blur-md p-2 rounded-lg border border-amber-500/40 shadow-2xl flex flex-col gap-2.5" >
          {/* Header & 7-11 Match Badge */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              Real Celestial Star Alignment
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowDetailedStarInfo((prev) => !prev)}
                className="px-2 py-1 text-[9px] font-mono font-bold rounded border border-amber-500/40 text-amber-200 hover:bg-amber-950/60 whitespace-nowrap"
                title={showDetailedStarInfo ? 'Show less information on stars in the 3D view' : 'Show more information on stars in the 3D view'}
              >
                {showDetailedStarInfo ? 'LESS INFO' : 'MORE INFO'}
              </button>
              <span
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                relation711.isHarmonic711
                  ? 'bg-amber-400 text-black shadow-[0_0_8px_rgba(250,204,21,0.6)] animate-pulse'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {selectedStarPreset.startsWith('constellation-') ? 'CONSTELLATION PRESET' : `7:11 MATCH: ${relation711.matchPercentage}%`}
              </span>
            </div>
          </div>

          {/* Star Alignment Preset Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-slate-400">Common Constellations & Star Alignments:</span>
            <select
              value={selectedStarPreset}
              onChange={(e) => handleSelectStarPreset(e.target.value)}
              className="bg-slate-900 border border-amber-500/40 text-xs font-mono text-amber-200 rounded px-2.5 py-1.5 outline-none cursor-pointer"
            >
              {STAR_ALIGNMENT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-300 leading-tight mt-0.5">
              {STAR_ALIGNMENT_PRESETS.find((x) => x.id === selectedStarPreset)?.relation711Desc}
            </p>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[10px] font-mono font-bold text-sky-200">IAU CONSTELLATIONS · 88</span>
                <div className="flex gap-1">
                  <button onClick={() => { setIsStarModeActive(true); setShowConstellationLines(true); setAllConstellations(true); }} className="rounded border border-sky-700 px-2 py-1 text-[9px] font-mono text-sky-200 hover:bg-sky-950">ALL ON</button>
                  <button onClick={() => setAllConstellations(false)} className="rounded border border-slate-700 px-2 py-1 text-[9px] font-mono text-slate-300 hover:bg-slate-800">ALL OFF</button>
                  <button onClick={() => setShowConstellationControls((v) => !v)} className="rounded border border-slate-700 px-2 py-1 text-[9px] font-mono text-slate-300">{showConstellationControls ? 'HIDE' : 'SELECT'}</button>
                </div>
              </div>
              {showConstellationControls && <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto pr-1">{IAU_CONSTELLATIONS.map((name) => {
                const available = hasConstellationGeometry(name);
                return <label key={name} className={'flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px] font-mono ' + (available ? 'text-slate-200' : 'text-slate-500')} title={available ? 'Stars in current local catalog can be shown/hidden' : 'Name listed; star-coordinate and line data are not yet in the app catalog'}><input type="checkbox" checked={isConstellationEnabled(name)} onChange={(e) => { setConstellationsEnabled((prev) => ({ ...prev, [name]: e.target.checked })); if (hasConstellationGeometry(name) && e.target.checked) { setIsStarModeActive(true); setShowConstellationLines(true); } }} className="accent-sky-400" />{name}{!available && <span className="ml-auto text-[8px] opacity-70">DATA NEEDED</span>}</label>;
              })}</div>}
              <div className="text-[9px] leading-relaxed text-slate-500">All 88 constellation stick figures use sourced J2000 right-ascension/declination line paths. These are traditional sky-chart connections, not the IAU constellation boundary outlines. Data source: d3-celestial.</div>
            </div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowLocationMenu((open) => !open)} className="rounded-lg border border-sky-400/60 bg-sky-950/70 px-3 py-2 text-[10px] font-mono font-bold tracking-wider text-sky-100 hover:bg-sky-900"><MapPin className="mr-1 inline h-3.5 w-3.5" />{showLocationMenu ? 'CLOSE LOCATION LAYERS' : 'CITY / LOCATION LAYERS'} · {showCities || showAncientStructures || showMeasuredSoundSites ? 'ON' : 'OFF'}</button><div className="flex flex-col items-stretch gap-1"><button type="button" onClick={triangulateEarthLocations} className="rounded-lg border border-cyan-300/50 bg-gradient-to-r from-cyan-950/90 to-slate-900 px-3 py-2 text-[10px] font-mono font-bold tracking-wider text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.12)] hover:border-cyan-200 hover:bg-cyan-900">△ TRIANGULATE CITIES / LOCATIONS</button><button type="button" disabled={!showAlignmentTriangles} onClick={() => setShowTriangleAngles((v) => !v)} className="rounded-lg border border-violet-400/50 bg-slate-950/90 px-3 py-1.5 text-[9px] font-mono font-bold tracking-wider text-violet-100 hover:bg-violet-950 disabled:cursor-not-allowed disabled:opacity-40" title="Toggle the three interior-angle labels for each triangle">△ {showTriangleAngles ? 'HIDE TRIANGLE ANGLES' : 'SHOW TRIANGLE ANGLES'}</button></div>{showAlignmentTriangles && <><button type="button" onClick={() => setShowAlignmentTriangles(false)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-[10px] font-mono text-slate-300 hover:text-white">HIDE MESH</button><span className="self-center text-[9px] font-mono text-cyan-200">{triangulationOverlay.polygons.length.toLocaleString()} TRIANGLES · {triangulationOverlay.siteCount.toLocaleString()} LOCATIONS</span></>}<label className="flex items-center gap-2 rounded border border-slate-700 px-2 py-1.5 text-[10px] text-slate-200 cursor-pointer"><input type="checkbox" checked={showCosmicBeam} onChange={(e) => setShowCosmicBeam(e.target.checked)} className="accent-orange-400" /><span><strong>Cosmic beam</strong></span></label></div>
            {showLocationMenu && <div className="mt-2 rounded-xl border border-sky-500/30 bg-slate-950/90 p-3"><div className="mb-2 text-[10px] font-mono font-bold tracking-widest text-sky-200">LOCATION LAYERS · ON / OFF</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-sky-400/30 px-2 py-2 text-xs text-slate-100 cursor-pointer"><input type="checkbox" checked={showCities} onChange={(e) => setShowCities(e.target.checked)} className="accent-sky-400" /><span><strong className="text-sky-200">CITIES</strong><span className="block text-[9px] text-slate-400">Blue dots · city locations</span></span></label>
            <label className="flex items-center gap-2 rounded-lg border border-yellow-400/30 px-2 py-2 text-xs text-slate-100 cursor-pointer"><input type="checkbox" checked={showAncientStructures} onChange={(e) => setShowAncientStructures(e.target.checked)} className="accent-yellow-400" /><span><strong className="text-yellow-200">ANCIENT SITES / MONUMENTS</strong><span className="block text-[9px] text-slate-400">Yellow dots · monuments and structures</span></span></label>
            <label className="flex items-center gap-2 rounded-lg border border-orange-400/30 px-2 py-2 text-xs text-slate-100 cursor-pointer"><input type="checkbox" checked={showMeasuredSoundSites} onChange={(e) => setShowMeasuredSoundSites(e.target.checked)} className="accent-orange-400" /><span><strong className="text-orange-200">SOUND / RESONANCE SITES</strong><span className="block text-[9px] text-slate-400">Orange dots · published measurements and candidates</span></span></label>
            <label className="flex items-center gap-2 rounded-lg border border-orange-400/30 px-2 py-2 text-xs text-slate-100 cursor-pointer"><input type="checkbox" checked={showNear110BandOnly} onChange={(e) => setShowNear110BandOnly(e.target.checked)} className="accent-orange-400" /><span><strong className="text-orange-200">FOCUS 108–114 Hz</strong><span className="block text-[9px] text-slate-400">Filter sound sites around the 110–112 Hz research range</span></span></label><label className="flex items-center gap-2 rounded-lg border border-fuchsia-400/30 px-2 py-2 text-xs text-slate-100 cursor-pointer"><input type="checkbox" checked={showSolfeggioReference} onChange={(e) => setShowSolfeggioReference(e.target.checked)} className="accent-fuchsia-400" /><span><strong className="text-fuchsia-200">SOLFEGGIO SOUND REFERENCE</strong><span className="block text-[9px] text-slate-400">174 · 285 · 396 · 417 · 528 · 639 · 741 · 852 · 963 Hz</span></span></label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-2 py-2 text-xs text-slate-100 cursor-pointer"><input type="checkbox" checked={showAcousticColorSystem} onChange={(e) => setShowAcousticColorSystem(e.target.checked)} className="accent-orange-400" /><span><strong>COLOR KEY</strong><span className="block text-[9px] text-slate-400">Keep category colors on/off</span></span></label>
            </div>{showSolfeggioReference && <div className="mt-2 rounded border border-fuchsia-500/30 bg-fuchsia-950/20 p-2 text-[10px] text-fuchsia-100">Solfeggio tones are a sound-reference category, not evidence that every marked monument resonates at these frequencies.</div>}</div>}
            {showAcousticColorSystem && <div className="flex flex-wrap gap-2 text-[9px] font-mono"><span className="text-orange-300">● SOUND / RESONANCE · sourced or candidate records</span><span className="text-yellow-300">● ANCIENT SITE / MONUMENT</span><span className="text-sky-200">● CITY / MODERN LOCATION</span><span className="text-fuchsia-300">● SOLFEGGIO REFERENCE</span><span className="text-emerald-300">● A/B/C CHANNEL TARGET</span><span className="text-slate-300">Click a named marker to inspect and assign channels</span></div>}
            <label className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-950/20 p-2 text-[10px] leading-relaxed text-orange-100"><input type="checkbox" checked={show110HzResearchComets} onChange={(e) => setShow110HzResearchComets(e.target.checked)} className="mt-0.5 accent-orange-400" /><span><strong>110 Hz research-band comet layer</strong><br/>Orange comets mark unverified candidate sites. The sourced Ħal Saflieni record reports 70 Hz and 114 Hz; 114 Hz is shown exactly, not rounded to 110 Hz.</span></label>
            {show110HzResearchComets && <div className="rounded-lg border border-orange-500/20 bg-slate-950/70 p-2 flex flex-col gap-2">{ACOUSTIC_SITE_EVIDENCE.map((site) => <div key={site.id} className="text-[10px] leading-relaxed text-slate-300"><div className="font-mono font-bold text-orange-200">{site.name}</div><div>{site.region} · {site.status === 'published-measurement' ? 'Published measurement' : 'Research candidate — measurement unverified'}</div><div className="text-slate-300">{site.measurementContext || ('Reported resonance frequencies: ' + site.measuredFrequenciesHz.join(' Hz and ') + ' Hz')}</div>{site.measurements?.map((measurement) => <div key={measurement.parameter + measurement.frequencyHz} className="text-orange-100">{measurement.parameter}: {measurement.reportedValue} {measurement.unit} · {measurement.frequencyBand || (measurement.frequencyHz + ' Hz band')}</div>)}<div className="text-slate-400">{site.caveat}</div><div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">{site.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="underline text-sky-300 hover:text-sky-100">{source.year} source ↗</a>)}</div></div>)}</div>}
          </div>

          {/* Channel to Star Manual Pickers with Lock / Unlock buttons */}
          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800/80">
            {/* CH-A Star */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold text-cyan-400">CH-A (L)</span>
                <button
                  onClick={() => handleToggleChannelLock('a')}
                  className="text-cyan-400 hover:text-white"
                  title={lockedChannels.a ? (earthChannelTargets.a ? 'Unlock Channel A from Earth location' : 'Unlock Channel A from star') : (earthChannelTargets.a ? 'Lock Channel A to assigned Earth location' : 'Lock Channel A to selected star')}
                >
                  {lockedChannels.a ? <Lock className="w-3 h-3 text-cyan-400" /> : <Unlock className="w-3 h-3 text-slate-500" />}
                </button>
              </div>
              <select
                value={starAId}
                onChange={(e) => {
                  const s = REAL_CELESTIAL_STARS.find((x) => x.id === e.target.value);
                  if (s) handleSnapChannelToStar('a', s);
                }}
                className="bg-slate-900 border border-cyan-800 text-[10px] font-mono text-cyan-300 rounded px-1.5 py-1 outline-none"
              >
                {earthChannelTargets.a ? <option value="">🌍 EARTH TARGET · {earthChannelTargets.a.lat.toFixed(3)}°, {earthChannelTargets.a.lng.toFixed(3)}°</option> : !starAId ? <option value="">FREE POSITION</option> : null}
                {REAL_CELESTIAL_STARS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* CH-B Star */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold text-pink-400">CH-B (R)</span>
                <button
                  onClick={() => handleToggleChannelLock('b')}
                  className="text-pink-400 hover:text-white"
                  title={lockedChannels.b ? (earthChannelTargets.b ? 'Unlock Channel B from Earth location' : 'Unlock Channel B from star') : (earthChannelTargets.b ? 'Lock Channel B to assigned Earth location' : 'Lock Channel B to selected star')}
                >
                  {lockedChannels.b ? <Lock className="w-3 h-3 text-pink-400" /> : <Unlock className="w-3 h-3 text-slate-500" />}
                </button>
              </div>
              <select
                value={starBId}
                onChange={(e) => {
                  const s = REAL_CELESTIAL_STARS.find((x) => x.id === e.target.value);
                  if (s) handleSnapChannelToStar('b', s);
                }}
                className="bg-slate-900 border border-pink-800 text-[10px] font-mono text-pink-300 rounded px-1.5 py-1 outline-none"
              >
                {earthChannelTargets.b ? <option value="">🌍 EARTH TARGET · {earthChannelTargets.b.lat.toFixed(3)}°, {earthChannelTargets.b.lng.toFixed(3)}°</option> : !starBId ? <option value="">FREE POSITION</option> : null}
                {REAL_CELESTIAL_STARS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* CH-C Star */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold text-amber-400">CH-C (CTR)</span>
                <button
                  onClick={() => handleToggleChannelLock('c')}
                  className="text-amber-400 hover:text-white"
                  title={lockedChannels.c ? (earthChannelTargets.c ? 'Unlock Channel C from Earth location' : 'Unlock Channel C from star') : (earthChannelTargets.c ? 'Lock Channel C to assigned Earth location' : 'Lock Channel C to selected star')}
                >
                  {lockedChannels.c ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 text-slate-500" />}
                </button>
              </div>
              <select
                value={starCId}
                onChange={(e) => {
                  const s = REAL_CELESTIAL_STARS.find((x) => x.id === e.target.value);
                  if (s) handleSnapChannelToStar('c', s);
                }}
                className="bg-slate-900 border border-amber-800 text-[10px] font-mono text-amber-300 rounded px-1.5 py-1 outline-none"
              >
                {earthChannelTargets.c ? <option value="">🌍 EARTH TARGET · {earthChannelTargets.c.lat.toFixed(3)}°, {earthChannelTargets.c.lng.toFixed(3)}°</option> : !starCId ? <option value="">FREE POSITION</option> : null}
                {REAL_CELESTIAL_STARS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Real-time Angular Separation & 7:11 Telemetry */}
          <div className="bg-[#060a12] p-2 rounded-lg border border-slate-800 flex flex-col gap-1 text-[10px] font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span>θ(A-B): <strong className="text-white">{relation711.thetaAB}°</strong></span>
              <span>θ(B-C): <strong className="text-white">{relation711.thetaBC}°</strong></span>
              <span>θ(C-A): <strong className="text-white">{relation711.thetaCA}°</strong></span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-slate-400">
              <span>Ratio: <strong className="text-amber-300">{relation711.bestRatio}</strong></span>
              <span>Target: <strong className="text-slate-300">7/11 ({relation711.targetRatio})</strong></span>
              <span>Aspect: <strong className="text-cyan-300">{relation711.aspectAngleDeg}°</strong></span>
            </div>
          </div>

          {/* Real-time 3D Triangle Interior Angles Card (Inside △) */}
          <div className="bg-[#060a12] p-2.5 rounded-lg border border-amber-500/40 flex flex-col gap-1.5 text-[10px] font-mono shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
              <span className="text-amber-300 font-bold flex items-center gap-1.5">
                <Triangle className="w-3.5 h-3.5 text-amber-400 fill-current" />
                Interior Angles (Inside △)
              </span>
              <span className="text-slate-400 text-[9px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                Sum: 180.0°
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-cyan-950/40 border border-cyan-800/60 rounded p-1">
                <span className="text-slate-400 text-[9px] block truncate">
                  ∠A ({REAL_CELESTIAL_STARS.find((s) => s.id === starAId)?.name || 'CH-A'})
                </span>
                <span className="text-cyan-300 font-bold text-xs">{interiorAngles.angleA}°</span>
              </div>
              <div className="bg-pink-950/40 border border-pink-800/60 rounded p-1">
                <span className="text-slate-400 text-[9px] block truncate">
                  ∠B ({REAL_CELESTIAL_STARS.find((s) => s.id === starBId)?.name || 'CH-B'})
                </span>
                <span className="text-pink-300 font-bold text-xs">{interiorAngles.angleB}°</span>
              </div>
              <div className="bg-amber-950/40 border border-amber-800/60 rounded p-1">
                <span className="text-slate-400 text-[9px] block truncate">
                  ∠C ({REAL_CELESTIAL_STARS.find((s) => s.id === starCId)?.name || 'CH-C'})
                </span>
                <span className="text-amber-300 font-bold text-xs">{interiorAngles.angleC}°</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-400 text-[9px] pt-1 border-t border-slate-800/60">
              <span>
                Sides: {interiorAngles.sideAB}m · {interiorAngles.sideBC}m · {interiorAngles.sideCA}m
              </span>
              <span>
                Area: <strong className="text-slate-200">{interiorAngles.area}m²</strong>
              </span>
            </div>

            {interiorAngles.has711AngleMatch && (
              <div className="bg-amber-400/10 border border-amber-400/40 rounded px-2 py-1 text-[9px] text-amber-300 flex items-center justify-between">
                <span>★ 7:11 Sacred Aspect: ∠{interiorAngles.closestAngleTo711.vertex} ≈ 32.5°</span>
                <span className="font-bold">{interiorAngles.closestAngleTo711.matchPct}% Match</span>
              </div>
            )}
          </div>
        </div>,
        document.querySelector('.atlas-right') as HTMLElement
      )}

      {/* Historical Earth / sky timeline is off by default to keep the initial space view clean. */}
      {isTimelineActive ? createPortal((
        <section className="atlas-panel atlas-timeline-panel max-h-[65vh] overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">Historical Earth / Sky Timeline</div>
            <div className="flex items-center gap-2">
              <div className="text-xs font-mono text-white">{timelineYear < 0 ? Math.abs(timelineYear).toLocaleString() + ' BCE' : timelineYear + ' CE'}</div>
              <button onClick={() => setIsTimelineActive(false)} className="rounded px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/40 hover:bg-amber-950/50" aria-label="Hide historical timeline">TIMELINE</button>
            </div>
          </div>
          <input aria-label="Historical year from 10,000 BCE to present" type="range" min="-10000" max={new Date().getUTCFullYear()} step="10" value={timelineYear} onChange={(e) => setTimelineYear(Number(e.target.value))} className="w-full accent-amber-400 cursor-pointer" />
          <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-slate-400"><span>10,000 BCE</span><span>{timelineYearsAgo.toLocaleString()} years before present</span><span>Present</span></div>
          <div className="mt-2 rounded-lg border border-cyan-800/60 bg-slate-950/80 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-mono font-bold tracking-wide text-cyan-200">LASER SPACE OVERLAY</div>
              <button type="button" onClick={() => setShowLaserSpaceOverlay(v => !v)} className={`rounded border px-2 py-1 text-[9px] font-bold ${showLaserSpaceOverlay ? 'border-cyan-400 bg-cyan-950 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{showLaserSpaceOverlay ? 'ON' : 'OFF'}</button>
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-400">Projects outward rays from visible cities and sites beyond the globe view. Apparent star alignments are geometric comparisons, not confirmed physical connections.</p>
            <label className="mt-2 flex items-center gap-2 text-[9px] text-slate-300"><input type="checkbox" checked={showLaserStarIntersections} onChange={e => setShowLaserStarIntersections(e.target.checked)} /> Show star-intersection analysis</label>
            {showLaserSpaceOverlay && <div className="mt-1 text-[9px] text-cyan-300">{visibleEarthSites.filter((site: any) => site.isCity ? showCities : site.evidenceStatus ? showMeasuredSoundSites : showAncientStructures).length.toLocaleString()} visible origins · rays rendered to 75 globe units</div>}
          </div>
          <div className="mt-1 text-[9px] leading-tight text-slate-400">Orange markers appear after each site's approximate founding era. With STAR MODE on, Sun and planets move with this year using a local Stardroid-derived ephemeris. {planetEphemerisYearIsPreferred ? 'Orbital elements are within their preferred 1800–2050 CE range.' : 'Planet positions outside 1800–2050 CE are illustrative, not precision historical ephemerides.'} Sky precession is first-order (~50.29″/yr); year-only rotation phase is not an exact historical time-of-day.</div>
        </section>
      ), document.querySelector('.atlas-right') as HTMLElement) : null}

      {/* Large interactive Earth fills the Top Plane viewport; Globe controls retain drag-to-rotate and wheel zoom. */}
      {isEarthModeActive && !isSolarSystemMode && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="relative h-full w-full max-w-full max-h-full pointer-events-auto flex items-center justify-center">
            <Globe3D ref={globeRef} rendererConfig={{ preserveDrawingBuffer: true }} width={Math.max(320, containerRef.current?.clientWidth || 800)}
              height={Math.max(320, containerRef.current?.clientHeight || 600)}
              globeImageUrl={earthTextureUrl}
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              backgroundColor="rgba(0,0,0,0)"
              showGraticules={isEarthModeActive} showAtmosphere={earthAtmosphere}
              arcsData={showAlignmentTriangles ? triangleEdges : []}
              arcStartLat={(d: any) => d.startLat} arcStartLng={(d: any) => d.startLng}
              arcEndLat={(d: any) => d.endLat} arcEndLng={(d: any) => d.endLng}
              arcColor={() => '#67e8f9'} arcStroke={0.2} arcAltitude={0}
              // Triangulation is lines-only; reserve filled polygons for the Sea Level flood overlay.
              polygonsData={showSeaLevelOverlay ? seaLevelFloodPolygons : []}
              polygonGeoJsonGeometry={(d: any) => d.geometry}
              polygonCapColor={(d: any) => d.layerType === 'sea-level-flood' ? 'rgba(56,189,248,0.42)' : 'rgba(34,211,238,0.055)'}
              polygonSideColor={(d: any) => d.layerType === 'sea-level-flood' ? 'rgba(14,165,233,0.32)' : 'rgba(8,145,178,0.22)'} polygonStrokeColor={(d: any) => d.layerType === 'sea-level-flood' ? 'rgba(125,211,252,0.85)' : 'rgba(165,243,252,0.92)'} polygonAltitude={(d: any) => d.layerType === 'sea-level-flood' ? 0.022 : 0.018}
              labelsData={visibleEarthSites.filter((site: any) => site.isCity && showCities)}
      labelLat={(d: any) => d.lat} labelLng={(d: any) => d.lon} labelText={(d: any) => d.name}
      labelColor={() => '#f8fafc'} labelSize={0.55} labelAltitude={0.012} labelDotRadius={0.12}
              pointsData={visibleEarthSites.filter((site: any) => site.isCity ? showCities : site.evidenceStatus ? showMeasuredSoundSites : showAncientStructures)} pointLat={(d: any) => d.lat} pointLng={(d: any) => d.lon}
              pointColor={(d: any) => showAcousticColorSystem ? d.color : '#e2e8f0'} pointRadius={(d: any) => d.size} pointAltitude={(d: any) => d.altitude}
              {...({
                // Use the points-layer API so the LED sprites replace default point dots.
                pointThreeObject: (d: any) => {
                  const obj = makeRetroLed(d);
                  obj.userData.showLaserSpaceOverlay = showLaserSpaceOverlay;
                  return obj;
                },
                pointThreeObjectExtend: false,
              } as any)}
              pointLabel={(d: any) => {
                if (!d || d.isChannelTarget) return '';
                const escapeHtml = (value: unknown) => String(value ?? '')
                  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const channels = [
                  { key: 'a' as const, color: '#22d3ee' },
                  { key: 'b' as const, color: '#f472b6' },
                  { key: 'c' as const, color: '#fbbf24' },
                ];
                const badges = channels.map(({ key, color }) => {
                  const target = earthChannelTargets[key];
                  const checked = !!target &&
                    Math.abs(target.lat - Number(d.lat)) < 0.02 &&
                    Math.abs(target.lng - Number(d.lon)) < 0.02;
                  return `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:4px;padding:2px 5px;border:1px solid ${color}88;border-radius:5px;color:${color};font-weight:700;background:${checked ? color + '22' : 'rgba(15,23,42,.6)'}">${key.toUpperCase()} ${checked ? '☑' : '☐'}</span>`;
                }).join('');
                return `<div style="min-width:170px;max-width:250px;padding:7px 8px;border:1px solid rgba(125,211,252,.55);border-radius:9px;background:rgba(3,10,22,.96);color:#f8fafc;box-shadow:0 8px 25px rgba(0,0,0,.4);font:12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif">
                  <div style="font-weight:700;margin-bottom:5px">${escapeHtml(d.name || 'Location')}</div>
                  <div style="display:flex;gap:3px;align-items:center;margin-bottom:5px">${badges}</div>
                  <div style="font-size:10px;color:#94a3b8">${Number(d.lat).toFixed(4)}°, ${Number(d.lon).toFixed(4)}°</div>
                  <div style="font-size:10px;color:#cbd5e1;margin-top:3px">Click the location, then use ADD TO A/B/C to assign a channel.</div>
                </div>`;
              }}
              htmlElementsData={[...earthChannelMarkers, ...(showTriangleAngles && showAlignmentTriangles ? triangulationOverlay.angleLabels : []), ...(showAncientStructures && showMeasuredSoundSites && (show110HzResearchComets || showCosmicBeam) ? [...(show110HzResearchComets ? visibleEarthSites.filter((site: any) => !site.evidenceStatus && !site.isCity) : []), ...ACOUSTIC_SITE_EVIDENCE.filter((site) => timelineYear >= -4000 && (!showNear110BandOnly || site.measuredFrequenciesHz.some((hz) => hz >= 108 && hz <= 114) || (site.measurementContext || '').includes('95–120 Hz')) && ((show110HzResearchComets && site.researchBandHz === 110) || (showCosmicBeam && site.id === 'hal-saflieni-hypogeum'))).map((site) => ({ name: site.name, lat: site.lat, lon: site.lon, year: -3500, color: '#fb923c', size: 0.5, altitude: 0.04, measuredHz: site.measuredFrequenciesHz.find((hz) => Math.abs(hz - (site.researchBandHz ?? 114)) <= 10), evidenceStatus: site.status }))] : [])]}
              htmlLat={(d: any) => d.lat} htmlLng={(d: any) => d.lon} htmlAltitude={(d: any) => d.isChannelTarget ? 0.012 : 0.04}
              htmlElement={(d: any) => {
                if (d.isTriangleAngleLabel) {
                  const angle = document.createElement('div');
                  angle.textContent = d.label;
                  angle.title = `Approximate interior angles · ${d.name}`;
                  angle.setAttribute('aria-label', `Triangle interior angles: ${d.label}`);
                  angle.style.padding = '2px 4px';
                  angle.style.border = '1px solid rgba(196,181,253,.72)';
                  angle.style.borderRadius = '4px';
                  angle.style.background = 'rgba(8,12,28,.88)';
                  angle.style.color = '#ddd6fe';
                  angle.style.font = '700 9px ui-monospace, monospace';
                  angle.style.whiteSpace = 'nowrap';
                  angle.style.pointerEvents = 'none';
                  angle.style.transform = 'translate(-50%, -50%)';
                  angle.style.boxShadow = '0 0 5px rgba(167,139,250,.22)';
                  return angle;
                }
                if (d.isEarthSiteLabel) {
                  const label = document.createElement('button');
                  label.type = 'button';
                  label.textContent = d.name;
                  label.title = `${d.layerCategory || (d.isCity ? 'CITY' : d.evidenceStatus ? 'ACOUSTIC SITE' : 'ANCIENT SITE')} · ${d.name} · click to inspect`;
                  label.setAttribute('aria-label', `Open site details for ${d.name}`);
                  label.style.maxWidth = '150px';
                  label.style.padding = '3px 6px';
                  label.style.borderRadius = '9px';
                  label.style.border = `1px solid ${d.color || '#facc15'}99`;
                  label.style.background = 'rgba(4, 13, 27, 0.88)';
                  label.style.backdropFilter = 'blur(8px)';
                  label.style.color = '#f1f7ff';
                  label.style.font = '600 10px Inter, ui-sans-serif, system-ui, sans-serif';
                  label.style.letterSpacing = '0.01em';
                  label.style.lineHeight = '1.3';
                  label.style.whiteSpace = 'nowrap';
                  label.style.overflow = 'hidden';
                  label.style.textOverflow = 'ellipsis';
                  label.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.38)';
                  label.style.cursor = 'pointer';
                  label.style.pointerEvents = 'auto';
                  // Anchor the label to the end of a visible leader instead of centering it over the map pin.
                  label.style.transform = 'translate(13px, -50%)';
                  label.style.position = 'relative';
                  label.style.marginLeft = '13px';
                  label.onclick = (event) => {
                    event.stopPropagation();
                    if (isEarthAssignMode) handlePinChannelToEarth(snapTargetChannel, d.lat, d.lon);
                    else openEarthSite(d);
                  };
                  const leader = document.createElement('span');
                  leader.style.position = 'absolute';
                  leader.style.width = '13px';
                  leader.style.height = '2px';
                  leader.style.left = '-14px';
                  leader.style.top = '50%';
                  leader.style.background = d.color || '#facc15';
                  leader.style.boxShadow = `0 0 5px ${d.color || '#facc15'}66`;
                  label.appendChild(leader);
                  return label;
                }
                if (d.isChannelTarget) {
                  const badge = document.createElement('button');
                  badge.type = 'button';
                  badge.textContent = `${d.channel.toUpperCase()}${d.locked ? ' 🔒' : ' ↔'}`;
                  badge.title = d.locked
                    ? `CH-${d.channel.toUpperCase()} · LOCKED at ${Number(d.lat).toFixed(3)}°, ${Number(d.lon).toFixed(3)}° · click to unlock`
                    : `CH-${d.channel.toUpperCase()} · target saved at ${Number(d.lat).toFixed(3)}°, ${Number(d.lon).toFixed(3)}° · click to lock here`;
                  badge.setAttribute('aria-label', d.locked ? `Unlock channel ${d.channel.toUpperCase()} from this Earth location` : `Lock channel ${d.channel.toUpperCase()} to this Earth location`);
                  badge.style.width = '42px';
                  badge.style.height = '28px';
                  badge.style.borderRadius = '999px';
                  badge.style.border = `2px solid ${d.color}`;
                  badge.style.background = 'rgba(3, 10, 22, 0.94)';
                  badge.style.color = d.color;
                  badge.style.font = 'bold 10px "JetBrains Mono", monospace';
                  badge.style.boxShadow = `0 0 12px ${d.color}99`;
                  badge.style.cursor = 'pointer';
                  badge.style.pointerEvents = 'auto';
                  badge.style.display = 'grid';
                  badge.style.placeItems = 'center';
                  badge.style.transform = 'translate(-50%, -50%)';
                  badge.onclick = (event) => {
                    event.stopPropagation();
                    setSnapTargetChannel(d.channel);
                    handleToggleChannelLock(d.channel);
                  };
                  return badge;
                }
                const marker = document.createElement('div');
                marker.style.width = '52px'; marker.style.height = showCosmicBeam && d.evidenceStatus === 'published-measurement' ? '300px' : '44px'; marker.style.position = 'relative'; marker.style.pointerEvents = 'none';
                marker.title = d.evidenceStatus === 'published-measurement' ? `Published acoustic measurement: ${d.measuredHz} Hz (not 110 Hz)` : '110 Hz research candidate · resonance unverified at this location';
                if (showCosmicBeam && d.evidenceStatus === 'published-measurement') {
                  const beam = document.createElement('div');
                  beam.style.position = 'absolute'; beam.style.left = '25px'; beam.style.top = '0px'; beam.style.width = '3px'; beam.style.height = '150px';
                  beam.style.transform = 'translateX(-50%)'; beam.style.background = 'linear-gradient(to top, rgba(251,146,60,.1), rgba(251,146,60,.8), rgba(255,255,255,.95), transparent)';
                  beam.style.boxShadow = '0 0 12px 3px rgba(251,146,60,.5)'; beam.style.borderRadius = '99px';
                  beam.animate([{opacity:.45, transform:'translateX(-50%) scaleY(.72)'},{opacity:1,transform:'translateX(-50%) scaleY(1)'},{opacity:.5,transform:'translateX(-50%) scaleY(.82)'}],{duration:1800,iterations:Infinity});
                  marker.append(beam);
                }
                const comet = document.createElement('div');
                comet.style.position = 'absolute'; comet.style.left = '4px'; comet.style.top = '20px'; comet.style.width = '34px'; comet.style.height = '3px';
                comet.style.transform = 'rotate(-42deg)'; comet.style.transformOrigin = 'right center';
                comet.style.background = 'linear-gradient(90deg, transparent, rgba(251,146,60,.15), #fdba74, #fff7ed)';
                comet.style.filter = 'drop-shadow(0 0 5px #fb923c)';
                comet.animate([{ opacity: 0.12, transform: 'translate(-4px, 5px) rotate(-42deg) scaleX(.25)' }, { opacity: 1, transform: 'translate(0, 0) rotate(-42deg) scaleX(1)' }, { opacity: 0.05, transform: 'translate(8px, -8px) rotate(-42deg) scaleX(.2)' }], { duration: 1450, iterations: Infinity, delay: (Math.abs(d.lat * 11 + d.lon) % 900) });
                marker.append(comet); return marker;
              }}
              onPointClick={(d: any) => {
                if (isEarthAssignMode) {
                  handlePinChannelToEarth(snapTargetChannel, d.lat, d.lon);
                } else {
                  openEarthSite(d);
                }
              }}
              onGlobeClick={(coords: { lat: number; lng: number }) => {
                if (isEarthAssignMode) handlePinChannelToEarth(snapTargetChannel, coords.lat, coords.lng);
              }} />
            {show110HzResearchComets && <div className="absolute inset-0 z-[5] pointer-events-none flex items-start justify-center pt-16"><span className="rounded-full border border-orange-400/50 bg-slate-950/80 px-3 py-1 text-[9px] font-mono text-orange-200 shadow-[0_0_18px_rgba(249,115,22,.18)]">110 Hz RESEARCH BAND · SOURCED MEASUREMENT + UNVERIFIED CANDIDATES</span></div>}
            {showAlignmentTriangles && showAncientStructures && <div className="absolute left-3 bottom-3 z-[6] max-w-[min(92%,440px)] rounded-lg border border-sky-400/40 bg-slate-950/90 p-2 text-[10px] font-mono text-slate-200 pointer-events-none"><div className="font-bold text-sky-200">EARTH TRIANGULATION · nearest 3 neighbors/site</div><div className="mt-1">{trianglePolygons.length} connected triangles · repeated 5° angle bins: {repeatedTriangleAngles.length ? repeatedTriangleAngles.slice(0,5).map(([angle,count]) => angle+'° × '+count).join(' · ') : 'none detected in current set'}</div><div className="mt-1 text-slate-400">Approximate local-plane angles; projection, site coordinates and chance patterns matter.</div></div>}
            <div className={`absolute inset-0 z-[4] pointer-events-none flex items-center justify-center overflow-hidden ${isEarthModeActive ? 'hidden' : ''}`}>
              <div className="relative w-[min(74vmin,76%)] aspect-square rounded-full border border-slate-300/20 animate-[spin_27s_linear_infinite]">
                <div className="absolute inset-0 rounded-full border border-dashed border-slate-400/15" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 via-slate-400 to-slate-700 shadow-[0_0_18px_rgba(226,232,240,.65)] animate-pulse"><span className="absolute top-7 right-[-28px] whitespace-nowrap text-[9px] font-mono text-slate-200 drop-shadow">MOON · orbit compressed</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className={`absolute inset-0 z-10 w-full h-full touch-none ${isSolarSystemMode ? 'hidden' : ''} ${isEarthModeActive ? 'pointer-events-none' : ''} ${hoverNode || activeDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-all-scroll'}`}
      />

      {isSolarSystemMode && <SolarSystemView epochMs={solarSystemEpochMs} onClose={() => setIsSolarSystemMode(false)} />}

      {showSunCenterPrompt && !isSolarSystemMode && (
        <div className="absolute inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sun-center-question">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/60 bg-[#07101d] p-5 shadow-[0_0_50px_rgba(251,191,36,.16)]">
            <div className="flex items-center gap-2 text-amber-300"><Sun className="h-5 w-5" /><span className="text-[10px] font-mono font-bold tracking-[.2em]">SUN SELECTED</span></div>
            <h2 id="sun-center-question" className="mt-3 text-lg font-semibold text-white">Make the Sun the center of the universe?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Open a Sun-centered Solar System with Mercury through Pluto on inclined elliptical orbits, plus Earth’s Moon orbiting Earth with the same 27.321661-day sidereal orbit and rotation period.</p>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">This switches to a dedicated heliocentric view. Orbit radii and planet sizes are compressed for visibility; orbital periods and ellipse shapes use the app’s low-precision Kepler elements.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowSunCenterPrompt(false)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800">NO · KEEP CURRENT VIEW</button>
              <button type="button" onClick={startSolarSystemMode} className="rounded-lg border border-amber-300 bg-amber-400 px-3 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-amber-300">YES · CENTER ON SUN</button>
            </div>
          </div>
        </div>
      )}


      {/* Direct Vertical Elevation Sliders Overlay (3 Channels: A, B, C) */}
      {showChannelElevationControls && !isSolarSystemMode && (
      <div className="absolute right-3 top-16 bottom-16 flex flex-col justify-center gap-4 pointer-events-auto bg-[#0b1220]/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 shadow-xl z-20">
        {/* CH-A Elevation */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-mono font-bold text-cyan-400">CH-A ELEV</span>
          <div className="h-20 flex items-center justify-center">
            <input
              type="range"
              min="-8"
              max="8"
              step="0.1"
              value={aPos.y}
              onChange={(e) => {
                onUpdateAPos({ ...aPos, y: parseFloat(e.target.value) });
                setLockedChannels((prev) => ({ ...prev, a: false }));
              }}
              className="accent-cyan-400 -rotate-90 w-16 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-cyan-300 tabular-nums">
            {aPos.y > 0 ? '+' : ''}
            {aPos.y.toFixed(1)}m
          </span>
        </div>

        <div className="w-full h-px bg-slate-800" />

        {/* CH-B Elevation */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-mono font-bold text-pink-400">CH-B ELEV</span>
          <div className="h-20 flex items-center justify-center">
            <input
              type="range"
              min="-8"
              max="8"
              step="0.1"
              value={bPos.y}
              onChange={(e) => {
                onUpdateBPos({ ...bPos, y: parseFloat(e.target.value) });
                setLockedChannels((prev) => ({ ...prev, b: false }));
              }}
              className="accent-pink-400 -rotate-90 w-16 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-pink-300 tabular-nums">
            {bPos.y > 0 ? '+' : ''}
            {bPos.y.toFixed(1)}m
          </span>
        </div>

        <div className="w-full h-px bg-slate-800" />

        {/* CH-C Elevation */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-mono font-bold text-amber-400">CH-C ELEV</span>
          <div className="h-20 flex items-center justify-center">
            <input
              type="range"
              min="-8"
              max="8"
              step="0.1"
              value={cPos.y}
              onChange={(e) => {
                onUpdateCPos({ ...cPos, y: parseFloat(e.target.value) });
                setLockedChannels((prev) => ({ ...prev, c: false }));
              }}
              className="accent-amber-400 -rotate-90 w-16 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-amber-300 tabular-nums">
            {cPos.y > 0 ? '+' : ''}
            {cPos.y.toFixed(1)}m
          </span>
        </div>
      </div>
      )}

    </div>
  );
};
