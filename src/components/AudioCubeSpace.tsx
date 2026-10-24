import React, { useRef, useEffect, useState, useCallback } from 'react';
import Globe3D from 'react-globe.gl';
import { EarthSiteExplorer } from './EarthSiteExplorer';
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
} from 'lucide-react';
import {
  REAL_CELESTIAL_STARS,
  STAR_ALIGNMENT_PRESETS,
  compute711Relation,
  computeTriangleInteriorAngles,
  Relation711Result,
} from '../data/celestialStars';
import { CONSTELLATION_LINE_SHAPES } from '../data/constellationLineData';
import { ACOUSTIC_SITE_EVIDENCE } from '../data/acousticSiteEvidence';
import { ANCIENT_STRUCTURE_DIMENSIONS } from '../data/ancientStructureDimensions';
import {
  DEFAULT_EARTH_POINTS,
  CONTINENTAL_COASTLINES,
  latLonToCartesian,
  cartesianToLatLon,
} from '../data/earthData';
import { calculateSubstellarPoint, fetchIersDut1Seconds, fetchPlaceImage, resolveStarAstrometry, EarthTarget, PlaceImage } from '../services/celestialEarthData';


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
  onUpdateAPos: (pos: SpatialPosition) => void;
  onUpdateBPos: (pos: SpatialPosition) => void;
  onUpdateCPos: (pos: SpatialPosition) => void;
  onUpdateSpatialMode: (mode: SpatialRoutingMode) => void;
  onUpdateCameraView: (view: CameraView) => void;
  onUpdateCameraAngles: (yaw: number, pitch: number) => void;
  onUpdateCameraZoom: (zoom: number) => void;
  onResetCamera: () => void;
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
  onUpdateAPos,
  onUpdateBPos,
  onUpdateCPos,
  onUpdateSpatialMode,
  onUpdateCameraView,
  onUpdateCameraAngles,
  onUpdateCameraZoom,
  onResetCamera,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const earthTextureRef = useRef<HTMLImageElement | null>(null);
  const [earthTextureLoaded, setEarthTextureLoaded] = useState(false);
  const ledAtlasCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ledAtlasLoaded, setLedAtlasLoaded] = useState(false);
  const isEarthModeActive = cameraView === 'top';
  const globeRef = useRef<any>(null);
  const [earthAtmosphere, setEarthAtmosphere] = useState(true);
  const earthSites = [
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
  useEffect(() => { if (isEarthModeActive && globeRef.current) globeRef.current.pointOfView({ altitude: Math.max(1.55, 3.1 - cameraZoom) }, 350); }, [isEarthModeActive, cameraZoom]);

  useEffect(() => {
    const texture = new Image();
    texture.crossOrigin = 'anonymous';
    texture.onload = () => { earthTextureRef.current = texture; setEarthTextureLoaded(true); };
    texture.onerror = () => setEarthTextureLoaded(false);
    texture.src = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/land_ocean_ice_2048.png';
    return () => { texture.onload = null; texture.onerror = null; };
  }, []);

  // Load and key the LED tilesheet once. The dark tile backing becomes transparent,
  // allowing the real bulb sprites to sit directly over either Earth view.
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const brightest = Math.max(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]);
        if (brightest < 27) pixels.data[i + 3] = 0;
      }
      context.putImageData(pixels, 0, 0);
      ledAtlasCanvasRef.current = canvas;
      setLedAtlasLoaded(true);
    };
    image.onerror = () => setLedAtlasLoaded(false);
    image.src = new URL('../../ledBULBS-on-off.png', import.meta.url).href;
    return () => { image.onload = null; image.onerror = null; };
  }, []);

  // Star Celestial Alignment Mode
  const [isStarModeActive, setIsStarModeActive] = useState<boolean>(false);
  const IAU_CONSTELLATIONS = ["Andromeda","Antlia","Apus","Aquarius","Aquila","Ara","Aries","Auriga","Bootes","Caelum","Camelopardalis","Cancer","Canes Venatici","Canis Major","Canis Minor","Capricornus","Carina","Cassiopeia","Centaurus","Cepheus","Cetus","Chamaeleon","Circinus","Columba","Coma Berenices","Corona Australis","Corona Borealis","Corvus","Crater","Crux","Cygnus","Delphinus","Dorado","Draco","Equuleus","Eridanus","Fornax","Gemini","Grus","Hercules","Horologium","Hydra","Hydrus","Indus","Lacerta","Leo","Leo Minor","Lepus","Libra","Lupus","Lynx","Lyra","Mensa","Microscopium","Monoceros","Musca","Norma","Octans","Ophiuchus","Orion","Pavo","Pegasus","Perseus","Phoenix","Pictor","Pisces","Piscis Austrinus","Puppis","Pyxis","Reticulum","Sagitta","Sagittarius","Scorpius","Sculptor","Scutum","Serpens","Sextans","Taurus","Telescopium","Triangulum","Triangulum Australe","Tucana","Ursa Major","Ursa Minor","Vela","Virgo","Volans","Vulpecula"];
  const [constellationsEnabled, setConstellationsEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(IAU_CONSTELLATIONS.map((name) => [name, true])));
  const [showConstellationControls, setShowConstellationControls] = useState<boolean>(true);
  const [show110HzResearchComets, setShow110HzResearchComets] = useState<boolean>(false);
  const [showCities, setShowCities] = useState<boolean>(false);
  const [showAncientStructures, setShowAncientStructures] = useState<boolean>(true);
  const [showAcousticColorSystem, setShowAcousticColorSystem] = useState<boolean>(true);
  const [showAlignmentTriangles, setShowAlignmentTriangles] = useState<boolean>(false);
  const [showCosmicBeam, setShowCosmicBeam] = useState<boolean>(false);
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
  const [isTimelineActive, setIsTimelineActive] = useState<boolean>(false);
  const timelineYearsAgo = new Date().getUTCFullYear() - timelineYear;
  const visibleEarthSites = [...earthSites.filter((site: any) => site.isCity ? showCities : site.year <= timelineYear).map((site: any) => ({ ...site, color: site.isCity ? '#60a5fa' : '#facc15', size: site.isCity ? 0.10 : 0.12, altitude: 0.012, layerCategory: site.isCity ? 'CITY' : 'ANCIENT SITE' })), ...(showAncientStructures ? ANCIENT_STRUCTURE_DIMENSIONS.filter((structure) => !earthSites.some((site: any) => !site.isCity && Math.abs(site.lat - structure.lat) < 0.08 && Math.abs(site.lon - structure.lon) < 0.08)).map((structure) => ({ name: structure.name, lat: structure.lat, lon: structure.lon, year: -3500, color: '#facc15', size: 0.12, altitude: 0.012, layerCategory: 'ANCIENT STRUCTURE HEIGHT', structuralHeightFt: structure.approximateHeightFt, heightBasis: structure.heightBasis, heightNote: structure.evidenceNote, numberSystem: structure.numberSystem, numberSystemNote: structure.numberSystemNote, orientationNote: structure.orientationNote, ritualContext: structure.ritualContext, isDimensionRecord: true })) : []), ...(timelineYear >= -4000 && showMeasuredSoundSites ? ACOUSTIC_SITE_EVIDENCE.filter((site) => !showNear110BandOnly || site.measuredFrequenciesHz.some((hz) => hz >= 108 && hz <= 114) || (site.measurementContext || '').includes('95–120 Hz')).map((site) => ({ name: site.name, lat: site.lat, lon: site.lon, year: -3500, color: '#fb923c', size: 0.14, altitude: 0.016, evidenceStatus: site.status, layerCategory: site.status === 'published-measurement' ? 'MEASURED SOUND' : 'SOUND CANDIDATE', measuredFrequenciesHz: site.measuredFrequenciesHz, measurementSummary: site.measurementContext || site.summary, measuredHz: site.measuredFrequenciesHz.reduce((best, hz) => Math.abs(hz - 111) < Math.abs(best - 111) ? hz : best, site.measuredFrequenciesHz[0]) })) : [])];
  const triangleCandidates = showAlignmentTriangles && showAncientStructures ? visibleEarthSites.filter((site: any) => !site.isCity && !site.evidenceStatus) : [];
  const triangleEdgeMap = new Map<string, { startLat: number; startLng: number; endLat: number; endLng: number }>();
  const triangleKey = (a: string, b: string) => [a, b].sort().join('::');
  const triangleDistance = (a: any, b: any) => {
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  };
  triangleCandidates.forEach((site: any) => triangleCandidates.filter((other: any) => other.name !== site.name).sort((a: any, b: any) => triangleDistance(site, a) - triangleDistance(site, b)).slice(0, 3).forEach((other: any) => {
    const key = triangleKey(site.name, other.name);
    if (!triangleEdgeMap.has(key)) triangleEdgeMap.set(key, { startLat: site.lat, startLng: site.lon, endLat: other.lat, endLng: other.lon });
  }));
  const triangleEdges = Array.from(triangleEdgeMap.values());
  const trianglePolygons: Array<{ name: string; geometry: { type: 'Polygon'; coordinates: number[][][] } }> = [];
  const triangleAngleCounts: Record<string, number> = {};
  const triangleConnected = (a: string, b: string) => triangleEdgeMap.has(triangleKey(a, b));
  const localXY = (site: any) => ({ x: site.lon * Math.cos(site.lat * Math.PI / 180), y: site.lat });
  const triangleAngle = (p: any, q: any, r: any) => {
    const a = localXY(p), b = localXY(q), c = localXY(r);
    const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - a.x, vy = c.y - a.y;
    const denominator = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    return denominator ? Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / denominator))) * 180 / Math.PI : 0;
  };
  for (let ai = 0; ai < triangleCandidates.length; ai++) for (let bi = ai + 1; bi < triangleCandidates.length; bi++) for (let ci = bi + 1; ci < triangleCandidates.length; ci++) {
    const a = triangleCandidates[ai], b = triangleCandidates[bi], c = triangleCandidates[ci];
    if (!triangleConnected(a.name, b.name) || !triangleConnected(b.name, c.name) || !triangleConnected(c.name, a.name)) continue;
    const angles = [triangleAngle(a,b,c), triangleAngle(b,c,a), triangleAngle(c,a,b)];
    angles.forEach((angle) => { const bin = String(Math.round(angle / 5) * 5); triangleAngleCounts[bin] = (triangleAngleCounts[bin] || 0) + 1; });
    trianglePolygons.push({ name: [a.name,b.name,c.name].join(' / '), geometry: { type: 'Polygon', coordinates: [[[a.lon,a.lat],[b.lon,b.lat],[c.lon,c.lat],[a.lon,a.lat]]] } });
  }
  const repeatedTriangleAngles = Object.entries(triangleAngleCounts).filter(([, count]) => count >= 4).sort((a,b) => Number(a[0])-Number(b[0]));
  const [isStarPanelExpanded, setIsStarPanelExpanded] = useState<boolean>(false);
  const [isCelestialDeckCollapsed, setIsCelestialDeckCollapsed] = useState<boolean>(false);
  const [showDetailedStarInfo, setShowDetailedStarInfo] = useState<boolean>(true);
  const [earthLocateTarget, setEarthLocateTarget] = useState<EarthTarget | null>(null);
  const [earthLocateImage, setEarthLocateImage] = useState<PlaceImage | null>(null);
  const [earthLocateLoading, setEarthLocateLoading] = useState(false);
  const [earthLocateImageLoading, setEarthLocateImageLoading] = useState(false);
  const [earthMapView, setEarthMapView] = useState<'map' | 'terrain' | 'satellite'>('map');
  const [selectedEarthSite, setSelectedEarthSite] = useState<EarthSiteSelection | null>(null);
  const openEarthSite = (site: EarthSiteSelection) => {
    setSelectedEarthSite(site);
    onUpdateCameraView('top');
    window.setTimeout(() => globeRef.current?.pointOfView({ lat: site.lat, lng: site.lon, altitude: 0.48 }, 850), 150);
  };
  const getEarthSiteDescription = (name: string) => {
    const acousticEvidence = ACOUSTIC_SITE_EVIDENCE.find((site) => site.name.toLowerCase() === name.toLowerCase());
    if (acousticEvidence) return acousticEvidence.summary + ' ' + (acousticEvidence.measurementContext || '') + ' ' + acousticEvidence.caveat + ' Sources are linked in the acoustic evidence panel.';
    const known = DEFAULT_EARTH_POINTS.find((point) => point.name.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(point.name.toLowerCase()) || point.name.toLowerCase().includes(name.toLowerCase()));
    if (known?.desc) return known.desc;
    const descriptions: Record<string, string> = {
      'Göbekli Tepe': 'Pre-Pottery Neolithic archaeological site in southeastern Türkiye, known for monumental T-shaped pillars and carved stone enclosures. The plotted era is approximate.',
      'Stonehenge': 'Prehistoric monument in Wiltshire, England. Its solstitial axis is widely studied; a specific star or frequency link needs separate measured evidence.',
      'Great Pyramid of Giza': 'Old Kingdom pyramid at Giza, Egypt. Coordinates are approximate; proposed star correlations should be tested against surveyed axes and a dated sky model.',
      'Giza Plateau': 'Archaeological landscape containing the Great Pyramid and other monuments. This marker represents the plateau area, not a single exact structure.',
      'Chichén Itzá': 'Maya archaeological city in Yucatán, Mexico. El Castillo is a stepped pyramid; claims about acoustic or sky alignments require site-specific evidence.',
      'Teotihuacan': 'Ancient Mesoamerican city with monumental architecture and studied urban orientations. A specific frequency match is not established by location alone.',
      'Newgrange': 'Neolithic passage tomb in Ireland, famous for winter-solstice sunrise illumination of its inner chamber.',
      'Carnac Stones': 'Prehistoric megalithic alignments in Brittany, France. A particular celestial or frequency meaning requires evidence.',
      'Jericho': 'Tell es-Sultan contains long-lived settlement remains in the Jordan Valley. The plotted date is an approximate era marker.',
      'Çatalhöyük': 'Neolithic settlement in central Anatolia, known for dense mudbrick housing and extensive archaeological remains.',
      'Angkor Wat': 'Large temple complex in Cambodia, built during the Khmer Empire period. Interpretations should be separated from documented architecture.',
      'Mohenjo-daro': 'Major Indus Valley Civilization urban site in present-day Pakistan, noted for planned streets and baked-brick architecture.',
      'Machu Picchu': 'Inca site in the Andes of Peru, known for stone architecture and its mountain setting.',
      'Petra': 'Nabataean city in present-day Jordan, with rock-cut architecture and water-management systems.',
      'Persepolis': 'Ceremonial capital of the Achaemenid Persian Empire, with monumental stone terraces and reliefs.',
      'Great Zimbabwe': 'Medieval stone-built urban and political center in southern Africa.',
      'Nan Madol': 'Historic ceremonial and administrative center built on artificial islets in Pohnpei, Micronesia.',
      'Tenochtitlan': 'Mexica capital founded on an island in Lake Texcoco; much of the historic city lies beneath modern Mexico City.'
    };
    return descriptions[name] || 'Geographic reference marker. A documented date, measured architectural orientation, and source-backed acoustic or astronomical data are needed before assigning a specific frequency relationship.';
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
  const [showTriangleAngles, setShowTriangleAngles] = useState<boolean>(false);

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
    const ra = (star.raDeg * Math.PI) / 180;
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

  // Apply Star Alignment Preset
  const handleSelectStarPreset = (presetId: string) => {
    setSelectedStarPreset(presetId);
    const p = STAR_ALIGNMENT_PRESETS.find((x) => x.id === presetId);
    if (!p) return;

    setStarAId(p.starAId);
    setStarBId(p.starBId);
    setStarCId(p.starCId);

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
      const baseScale = Math.min(w, h) * 0.042 * cameraZoom;

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
      const baseScale = Math.min(width, height) * 0.042 * cameraZoom;
      const moonOrbitPhase = (performance.now() / 15000) % (Math.PI * 2);

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

      // Flat Earth/top-plane markers: use the equirectangular lat/lon projection and
      // the same LED sprites, overlaid on the existing Earth image/texture.
      if (isEarthModeActive && ledAtlasLoaded && ledAtlasCanvasRef.current) {
        const atlas = ledAtlasCanvasRef.current;
        const tileW = atlas.width / 8;
        const tileH = atlas.height / 10;
        const planeSize = 2 * bound * baseScale * 1.25 * (overlay.visible ? overlay.scale : 1);
        const planeLeft = cx - planeSize / 2;
        const planeTop = cy - planeSize / 2;
        const drawFlatLed = (lat: number, lon: number, color: string, isCity = false) => {
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
          const x = planeLeft + ((lon + 180) / 360) * planeSize;
          const y = planeTop + ((90 - lat) / 180) * planeSize;
          const normalized = String(color).toLowerCase();
          const colorRow = /orange|fb923c|f97316|red|ef4444|f87171/.test(normalized) ? 0
            : /blue|sky|60a5fa|38bdf8|dbeafe/.test(normalized) ? 2
            : /green|34d399|10b981|22c55e/.test(normalized) ? 3
            : /purple|violet|a78bfa|f472b6|fuchsia/.test(normalized) ? 4 : 1;
          const bulbSize = isCity ? 15 : 21;
          ctx.drawImage(atlas, 0, (colorRow * 2 + 1) * tileH, tileW, tileH,
            x - bulbSize / 2, y - bulbSize * 0.78, bulbSize, bulbSize * 1.2);
        };
        visibleEarthSites.forEach((site: any) => {
          drawFlatLed(Number(site.lat), Number(site.lon), site.isCity ? '#60a5fa' : site.color || '#facc15', Boolean(site.isCity));
        });
      }

      // No synthetic background particles: render catalogued celestial objects only.

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

      if (!isEarthModeActive) {
      // Sidereal phase for Jan 1 noon in selected year. A year-only slider cannot recover an ancient time-of-day.
      const jd = Date.UTC(timelineYear, 0, 1, 12, 0, 0) / 86400000 + 2440587.5;
      const centuries = (jd - 2451545.0) / 36525.0;
      const gmstDeg = ((280.46061837 + 360.98564736629 * (jd - 2451545.0) +
        0.000387933 * centuries * centuries - centuries * centuries * centuries / 38710000) % 360 + 360) % 360;
      const earthRadius = 3.35;
      const earthPoint = (lat: number, lon: number, radius = earthRadius) =>
        latLonToCartesian(lat, lon, radius, gmstDeg, 23.439281);
      const cameraFront = (p: { x: number; y: number; z: number }) => {
        const yaw = (cameraYaw * Math.PI) / 180;
        const pitch = (cameraPitch * Math.PI) / 180;
        const rz = p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
        const rz2 = p.y * Math.sin(pitch) + rz * Math.cos(pitch);
        return rz2 < 0.15;
      };
      const earthCenter = project3D(0, 0, 0, width, height);
      const earthEdge = project3D(earthRadius, 0, 0, width, height);
      const earthScreenRadius = Math.hypot(earthEdge.sx - earthCenter.sx, earthEdge.sy - earthCenter.sy);
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
      // NASA Blue Marble global land/ocean texture. Clip to the globe; coastline and site overlays remain above it.
      if (earthTextureLoaded && earthTextureRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(earthCenter.sx, earthCenter.sy, earthScreenRadius * 0.995, 0, Math.PI * 2);
        ctx.clip();
        const tex = earthTextureRef.current;
        const texW = tex.naturalWidth || tex.width;
        const texH = tex.naturalHeight || tex.height;
        const diameter = earthScreenRadius * 2;
        ctx.globalAlpha = 0.96;
        ctx.drawImage(tex, earthCenter.sx - earthScreenRadius, earthCenter.sy - earthScreenRadius, diameter, diameter);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#0891b2';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const traceEarthLine = (coords: [number, number][], stroke: string, lineWidth: number) => {
        ctx.beginPath();
        let previousVisible = false;
        for (const [lat, lon] of coords) {
          const v = earthPoint(lat, lon);
          const visible = cameraFront(v);
          const p = project3D(v.x, v.y, v.z, width, height);
          if (visible) {
            if (!previousVisible) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
          }
          previousVisible = visible;
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      };
      for (let lat = -60; lat <= 60; lat += 30) {
        const line: [number, number][] = [];
        for (let lon = -180; lon <= 180; lon += 4) line.push([lat, lon]);
        traceEarthLine(line, 'rgba(125, 211, 252, 0.28)', 0.65);
      }
      for (let lon = -180; lon < 180; lon += 30) {
        const line: [number, number][] = [];
        for (let lat = -88; lat <= 88; lat += 3) line.push([lat, lon]);
        traceEarthLine(line, 'rgba(125, 211, 252, 0.28)', 0.65);
      }
      CONTINENTAL_COASTLINES.forEach((polygon) => traceEarthLine(polygon, 'rgba(45, 212, 191, 0.9)', 1.15));
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
        const v = earthPoint(lat, lon, earthRadius * 1.012);
        if (!cameraFront(v)) return;
        const p = project3D(v.x, v.y, v.z, width, height);
        const ledAtlas = ledAtlasCanvasRef.current;
        if (ledAtlasLoaded && ledAtlas) {
          const normalized = String(color).toLowerCase();
          const colorRow = /orange|fb923c|f97316|red|ef4444|f87171/.test(normalized) ? 0
            : /blue|sky|60a5fa|38bdf8|dbeafe/.test(normalized) ? 2
            : /green|34d399|10b981|22c55e/.test(normalized) ? 3
            : /purple|violet|a78bfa|f472b6|fuchsia/.test(normalized) ? 4 : 1;
          const tileW = ledAtlas.width / 8;
          const tileH = ledAtlas.height / 10;
          const bulbSize = Math.max(15, Math.min(29, (isCity ? 17 : 21) * Math.max(0.85, cameraZoom * 0.7)));
          ctx.drawImage(ledAtlas, 0, (colorRow * 2 + 1) * tileH, tileW, tileH,
            p.sx - bulbSize / 2, p.sy - bulbSize * 0.78, bulbSize, bulbSize * 1.2);
        } else {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, isCity ? 1.7 : 2.8, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = isCity ? 3 : 7;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        // Keep the globe clean at orbital scale; reveal names once zoomed closer.
        if (cameraZoom >= (isCity ? 1.35 : 1.08)) {
          const isMeasuredAcousticSite = name.includes('MEASURED') || ACOUSTIC_SITE_EVIDENCE.some((site) => name.includes(site.name));
          const isAncientStructure = name.includes('ANCIENT') || isMeasuredAcousticSite;
          const fontSize = isCity ? Math.max(8, Math.min(12, 8 + cameraZoom)) : isMeasuredAcousticSite ? Math.max(13, Math.min(21, 13 + cameraZoom * 1.6)) : isAncientStructure ? Math.max(11, Math.min(17, 11 + cameraZoom * 1.25)) : Math.max(9, Math.min(13, 9 + cameraZoom));
          ctx.font = `${isCity ? '500' : isMeasuredAcousticSite ? '700' : '600'} ${fontSize}px system-ui, sans-serif`;
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(3, 10, 22, 0.92)';
          ctx.strokeText(name, p.sx + 5, p.sy - 5);
          const displayColor = showAcousticColorSystem ? (isMeasuredAcousticSite ? '#fb923c' : isAncientStructure ? '#facc15' : isCity ? '#dbeafe' : color) : '#e2e8f0';
          ctx.fillStyle = isCity ? (showAcousticColorSystem ? 'rgba(219, 234, 254, 0.96)' : '#e2e8f0') : displayColor;
          ctx.fillText(name, p.sx + 5, p.sy - 5);
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

      // 5. Render Real-World Stars and Constellation Edges (Star Mode)
      if (isStarModeActive) {
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
              const screen = project3D(pos.x, pos.y, pos.z, width, height);
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

        // Draw Real Stars
        REAL_CELESTIAL_STARS.filter((star) => isConstellationEnabled(star.constellation)).forEach((star) => {
          const starPosition = celestialPosition(star);
          const sp = project3D(starPosition.x, starPosition.y, starPosition.z, width, height);
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

        // Celestial Tether Beams: Universe Center (0,0,0) -> Assigned Stars -> Channels
        const drawTether = (starId: string, puckPos: SpatialPosition, color: string) => {
          const star = REAL_CELESTIAL_STARS.find((s) => s.id === starId);
          if (!star) return;
          const starPosition = celestialPosition(star);
          const sp = project3D(starPosition.x, starPosition.y, starPosition.z, width, height);
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

        drawTether(starAId, aPos, '#00f0ff');
        drawTether(starBId, bPos, '#ff007f');
        drawTether(starCId, cPos, '#fbbf24');
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

      // 7. Draw Trinaural Acoustic Triangular Web between A, B, and C
      const pa = project3D(aPos.x, aPos.y, aPos.z, width, height);
      const pb = project3D(bPos.x, bPos.y, bPos.z, width, height);
      const pc = project3D(cPos.x, cPos.y, cPos.z, width, height);

      if (isStarModeActive) {
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.lineTo(pc.sx, pc.sy);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.lineWidth = relation711.isHarmonic711 ? 1.8 : 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.fillStyle = relation711.isHarmonic711 ? 'rgba(250, 204, 21, 0.07)' : 'rgba(168, 85, 247, 0.04)';
        ctx.fill();
        ctx.setLineDash([]);
      }

      // 7b. Draw Interior Triangle Angles (Displayed when 3 stars are connected or showTriangleAngles is active)
      const centroidX = (pa.sx + pb.sx + pc.sx) / 3;
      const centroidY = (pa.sy + pb.sy + pc.sy) / 3;

      if (isStarModeActive && showTriangleAngles) {
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

          // Degree readout badge positioned inside the triangle
          const labelDist = Math.max(34, arcRadius + 14);
          const lx = v.sx + Math.cos(interiorBisector) * labelDist;
          const ly = v.sy + Math.sin(interiorBisector) * labelDist;

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

      // Keep channel markers hidden until the user explicitly enables Stars.
      if (isStarModeActive) {
        drawPuck(aPos, aFreq, 'A', '#00f0ff', '#083344', 'a', activeDrag === 'a' || hoverNode === 'a');
        drawPuck(bPos, bFreq, 'B', '#ff007f', '#4c0519', 'b', activeDrag === 'b' || hoverNode === 'b');
        drawPuck(cPos, cFreq, 'C', '#fbbf24', '#451a03', 'c', activeDrag === 'c' || hoverNode === 'c');
      }

      // 8. Hovered Star Info Card (if hovered)
      if (isStarModeActive && hoveredStar && !clickedStar) {
        const hoverPosition = celestialPosition(hoveredStar);
        const hp = project3D(hoverPosition.x, hoverPosition.y, hoverPosition.z, width, height);
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
    constellationsEnabled,
    show110HzResearchComets,
    showDetailedStarInfo,
    isEarthModeActive,
    timelineYear,
    earthTextureLoaded,
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
    activeDrag,
    hoverNode,
    showTriangleAngles,
    interiorAngles,
    ledAtlasLoaded,
    visibleEarthSites,
  ]);

  // Pointer interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;

    // 1. Check if user clicked directly on any real star
    if (isStarModeActive) {
      for (const star of REAL_CELESTIAL_STARS.filter((item) => isConstellationEnabled(item.constellation))) {
        const starPosition = celestialPosition(star);
          const sp = project3D(starPosition.x, starPosition.y, starPosition.z, width, height);
        if (Math.hypot(x - sp.sx, y - sp.sy) < 18) {
          // Snap currently selected target channel to this star and stay there!
          handleSnapChannelToStar(snapTargetChannel, star);
          setClickedStar(star);
          return;
        }
      }
    }

    // Dismiss clicked star modal if clicking elsewhere
    if (clickedStar) {
      setClickedStar(null);
    }

    const pa = project3D(aPos.x, aPos.y, aPos.z, width, height);
    const pb = project3D(bPos.x, bPos.y, bPos.z, width, height);
    const pc = project3D(cPos.x, cPos.y, cPos.z, width, height);

    const distA = Math.hypot(x - pa.sx, y - pa.sy);
    const distB = Math.hypot(x - pb.sx, y - pb.sy);
    const distC = Math.hypot(x - pc.sx, y - pc.sy);

    dragStartPos.current = { x: e.clientX, y: e.clientY };

    if (distA < 22) {
      // If locked to star, prevent accidental displacement unless shift is held
      if (isStarModeActive && lockedChannels.a && !e.shiftKey) {
        setSnapFeedback(`★ CH-A IS LOCKED TO STAR. Hold Shift to override.`);
        window.setTimeout(() => setSnapFeedback(null), 2500);
        return;
      }
      setActiveDrag('a');
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (distB < 22) {
      if (isStarModeActive && lockedChannels.b && !e.shiftKey) {
        setSnapFeedback(`★ CH-B IS LOCKED TO STAR. Hold Shift to override.`);
        window.setTimeout(() => setSnapFeedback(null), 2500);
        return;
      }
      setActiveDrag('b');
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (distC < 22) {
      if (isStarModeActive && lockedChannels.c && !e.shiftKey) {
        setSnapFeedback(`★ CH-C IS LOCKED TO STAR. Hold Shift to override.`);
        window.setTimeout(() => setSnapFeedback(null), 2500);
        return;
      }
      setActiveDrag('c');
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      // Orbit Camera
      setActiveDrag('camera');
      cameraStartAngle.current = { yaw: cameraYaw, pitch: cameraPitch };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
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
    const baseScale = Math.min(width, height) * 0.042 * cameraZoom;

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
      } else {
        const newX = Math.max(-8, Math.min(8, (x - cx) / (baseScale * 1.25)));
        const newZ = Math.max(-8, Math.min(8, (y - cy) / (baseScale * 1.25)));
        onUpdateAPos({ ...aPos, x: Number(newX.toFixed(1)), z: Number(newZ.toFixed(1)) });
      }
    } else if (activeDrag === 'b') {
      if (e.shiftKey) {
        const dy = (dragStartPos.current.y - e.clientY) * 0.08;
        const newY = Math.max(-8, Math.min(8, bPos.y + dy));
        dragStartPos.current.y = e.clientY;
        onUpdateBPos({ ...bPos, y: Number(newY.toFixed(1)) });
      } else {
        const newX = Math.max(-8, Math.min(8, (x - cx) / (baseScale * 1.25)));
        const newZ = Math.max(-8, Math.min(8, (y - cy) / (baseScale * 1.25)));
        onUpdateBPos({ ...bPos, x: Number(newX.toFixed(1)), z: Number(newZ.toFixed(1)) });
      }
    } else if (activeDrag === 'c') {
      if (e.shiftKey) {
        const dy = (dragStartPos.current.y - e.clientY) * 0.08;
        const newY = Math.max(-8, Math.min(8, cPos.y + dy));
        dragStartPos.current.y = e.clientY;
        onUpdateCPos({ ...cPos, y: Number(newY.toFixed(1)) });
      } else {
        const newX = Math.max(-8, Math.min(8, (x - cx) / (baseScale * 1.25)));
        const newZ = Math.max(-8, Math.min(8, (y - cy) / (baseScale * 1.25)));
        onUpdateCPos({ ...cPos, x: Number(newX.toFixed(1)), z: Number(newZ.toFixed(1)) });
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
        for (const star of REAL_CELESTIAL_STARS.filter((item) => isConstellationEnabled(item.constellation))) {
          const starPosition = celestialPosition(star);
          const sp = project3D(starPosition.x, starPosition.y, starPosition.z, width, height);
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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#02040a]"
      aria-label="Interactive star globe"
    >
      <Globe3D
        ref={globeRef}
        width={typeof window !== 'undefined' ? window.innerWidth : 1280}
        height={typeof window !== 'undefined' ? window.innerHeight : 800}
        backgroundColor="#02040a"
        showGlobe={false}
        showAtmosphere={false}
        showGraticules={false}
        pointsData={REAL_CELESTIAL_STARS}
        pointLat={(star: any) => star.decDeg}
        pointLng={(star: any) => star.raDeg - 180}
        pointColor={(star: any) => star.color || '#dbeafe'}
        pointRadius={(star: any) => Math.max(0.035, 0.11 - (Number(star.mag) + 1.5) * 0.018)}
        pointAltitude={0.01}
        pointResolution={12}
        pointLabel={() => ''}
        enablePointerInteraction={true}
        animateIn={false}
      />
    </div>
  );
};
