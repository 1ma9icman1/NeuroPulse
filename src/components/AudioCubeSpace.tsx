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
  CONSTELLATION_EDGES,
  STAR_ALIGNMENT_PRESETS,
  compute711Relation,
  computeTriangleInteriorAngles,
  Relation711Result,
} from '../data/celestialStars';
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
  ];
  useEffect(() => { if (isEarthModeActive && globeRef.current) globeRef.current.pointOfView({ altitude: Math.max(1.2, 5.2 - cameraZoom) }, 250); }, [isEarthModeActive, cameraZoom]);

  useEffect(() => {
    const texture = new Image();
    texture.crossOrigin = 'anonymous';
    texture.onload = () => { earthTextureRef.current = texture; setEarthTextureLoaded(true); };
    texture.onerror = () => setEarthTextureLoaded(false);
    texture.src = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/land_ocean_ice_2048.png';
    return () => { texture.onload = null; texture.onerror = null; };
  }, []);

  // Star Celestial Alignment Mode
  const [isStarModeActive, setIsStarModeActive] = useState<boolean>(false);
  const IAU_CONSTELLATIONS = ["Andromeda","Antlia","Apus","Aquarius","Aquila","Ara","Aries","Auriga","Bootes","Caelum","Camelopardalis","Cancer","Canes Venatici","Canis Major","Canis Minor","Capricornus","Carina","Cassiopeia","Centaurus","Cepheus","Cetus","Chamaeleon","Circinus","Columba","Coma Berenices","Corona Australis","Corona Borealis","Corvus","Crater","Crux","Cygnus","Delphinus","Dorado","Draco","Equuleus","Eridanus","Fornax","Gemini","Grus","Hercules","Horologium","Hydra","Hydrus","Indus","Lacerta","Leo","Leo Minor","Lepus","Libra","Lupus","Lynx","Lyra","Mensa","Microscopium","Monoceros","Musca","Norma","Octans","Ophiuchus","Orion","Pavo","Pegasus","Perseus","Phoenix","Pictor","Pisces","Piscis Austrinus","Puppis","Pyxis","Reticulum","Sagitta","Sagittarius","Scorpius","Sculptor","Scutum","Serpens","Sextans","Taurus","Telescopium","Triangulum","Triangulum Australe","Tucana","Ursa Major","Ursa Minor","Vela","Virgo","Volans","Vulpecula"];
  const [constellationsEnabled, setConstellationsEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(IAU_CONSTELLATIONS.map((name) => [name, true])));
  const [showConstellationControls, setShowConstellationControls] = useState<boolean>(true);
  const [show110HzResearchComets, setShow110HzResearchComets] = useState<boolean>(false);
  const setAllConstellations = (enabled: boolean) => setConstellationsEnabled(Object.fromEntries(IAU_CONSTELLATIONS.map((name) => [name, enabled])));
  const isConstellationEnabled = (name: string) => constellationsEnabled[name === 'Boötes' ? 'Bootes' : name] !== false;
  // Historical sky timeline spanning the last 12,000 years.
  const [timelineYear, setTimelineYear] = useState<number>(new Date().getUTCFullYear());
  const [isTimelineActive, setIsTimelineActive] = useState<boolean>(false);
  const timelineYearsAgo = new Date().getUTCFullYear() - timelineYear;
  const visibleEarthSites = earthSites.filter((site) => site.year <= timelineYear).map((site) => ({ ...site, color: '#fb923c', size: 0.35, altitude: 0.02 }));
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
  const [showTriangleAngles, setShowTriangleAngles] = useState<boolean>(true);

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
  const celestialPosition = (star: CelestialStar, radius = 7.8): SpatialPosition => {
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
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, isCity ? 1.7 : 2.8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isCity ? 3 : 7;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Keep the globe clean at orbital scale; reveal names once zoomed closer.
        if (cameraZoom >= (isCity ? 1.35 : 1.08)) {
          const fontSize = isCity ? Math.max(8, Math.min(12, 8 + cameraZoom)) : Math.max(9, Math.min(13, 9 + cameraZoom));
          ctx.font = `${isCity ? '500' : '600'} ${fontSize}px system-ui, sans-serif`;
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(3, 10, 22, 0.92)';
          ctx.strokeText(name, p.sx + 5, p.sy - 5);
          ctx.fillStyle = isCity ? 'rgba(219, 234, 254, 0.96)' : color;
          ctx.fillText(name, p.sx + 5, p.sy - 5);
        }
      };
      DEFAULT_EARTH_POINTS.forEach((point) => labelEarthPoint(point.name, point.lat, point.lon, point.color));
      majorCities.forEach((city) => labelEarthPoint(city.name, city.lat, city.lon, '#dbeafe', true));
      // Modern coordinates for archaeological destinations; visibility follows approximate site era.
      const historicalSites: Array<{ name: string; lat: number; lon: number; era: number }> = [
        { name: 'Göbekli Tepe', lat: 37.223, lon: 38.922, era: -9600 },
        { name: 'Jericho / Tell es-Sultan', lat: 31.871, lon: 35.444, era: -9000 },
        { name: 'Çatalhöyük', lat: 37.667, lon: 32.828, era: -7100 },
        { name: 'Nabta Playa', lat: 22.53, lon: 30.72, era: -7000 },
        { name: 'Stonehenge', lat: 51.1789, lon: -1.8262, era: -3000 },
        { name: 'Giza Plateau', lat: 29.9792, lon: 31.1342, era: -2600 },
        { name: 'Carnac', lat: 47.593, lon: -3.078, era: -4500 },
        { name: 'Newgrange', lat: 53.6947, lon: -6.475, era: -3200 },
        { name: 'Teotihuacan', lat: 19.6925, lon: -98.8438, era: 100 },
        { name: 'Chichén Itzá', lat: 20.6843, lon: -88.5678, era: 600 },
        { name: 'Tenochtitlan', lat: 19.4326, lon: -99.1332, era: 1325 },
        { name: 'Angkor Wat', lat: 13.4125, lon: 103.867, era: 1150 },
        { name: 'Petra', lat: 30.3285, lon: 35.4444, era: -300 },
        { name: 'Persepolis', lat: 29.9352, lon: 52.8916, era: -518 },
        { name: 'Mohenjo-daro', lat: 27.329, lon: 68.138, era: -2500 },
        { name: 'Machu Picchu', lat: -13.1631, lon: -72.545, era: 1450 },
        { name: 'Great Zimbabwe', lat: -20.267, lon: 30.933, era: 1100 },
        { name: 'Nan Madol', lat: 6.844, lon: 158.333, era: 1200 },
      ];
      historicalSites.forEach((site) => {
        if (timelineYear >= site.era) {
          labelEarthPoint('ANCIENT · ' + site.name, site.lat, site.lon, '#fb923c');
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

        CONSTELLATION_EDGES.forEach(([s1Id, s2Id]) => {
          const s1 = REAL_CELESTIAL_STARS.find((s) => s.id === s1Id);
          const s2 = REAL_CELESTIAL_STARS.find((s) => s.id === s2Id);
          if (s1 && s2 && isConstellationEnabled(s1.constellation) && isConstellationEnabled(s2.constellation)) {
            const p1v = celestialPosition(s1);
            const p2v = celestialPosition(s2);
            const p1 = project3D(p1v.x, p1v.y, p1v.z, width, height);
            const p2 = project3D(p2v.x, p2v.y, p2v.z, width, height);
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.stroke();
          }
        });
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

      // Draw Channel A, B, C pucks.
      drawPuck(aPos, aFreq, 'A', '#00f0ff', '#083344', 'a', activeDrag === 'a' || hoverNode === 'a');
      drawPuck(bPos, bFreq, 'B', '#ff007f', '#4c0519', 'b', activeDrag === 'b' || hoverNode === 'b');
      drawPuck(cPos, cFreq, 'C', '#fbbf24', '#451a03', 'c', activeDrag === 'c' || hoverNode === 'c');

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
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
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
            onClick={onResetCamera}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ml-1"
            title="Reset 3D Orbit Camera"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Star Celestial Alignment Button + Snap Channel Selector + Top Plane Overlay Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Star Alignment panel: collapsed to one button by default. */}
          <div className="flex items-start gap-1">
            {!isStarPanelExpanded ? (
              <button
                onClick={() => setIsStarPanelExpanded(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-mono rounded-lg border border-amber-500/40 bg-[#0b1220]/90 text-amber-300 hover:bg-amber-950/50 shadow-md"
                title="Expand Star Alignment controls"
                aria-label="Expand Star Alignment controls"
              >
                <Star className="w-3.5 h-3.5" />
                <Minimize className="w-3 h-3" />
              </button>
            ) : (
              <div className="flex flex-col gap-1 p-2 rounded-lg border border-amber-500/40 bg-[#0b1220]/95 backdrop-blur-md shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-wider text-amber-300">Star Alignment</span>
                  <button onClick={() => setIsStarPanelExpanded(false)} className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700" title="Minimize Star Alignment">
                    <Minimize className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsStarModeActive((prev) => !prev)}
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold rounded border transition-all ${
                      isStarModeActive ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-slate-900 text-amber-300 border-amber-500/40'
                    }`}
                    title="Toggle real celestial star overlays"
                  >
                    <Star className={`w-3 h-3 ${isStarModeActive ? 'fill-current' : ''}`} />
                    {isStarModeActive ? 'STARS ON' : 'STARS OFF'}
                  </button>
                  {isStarModeActive && (
                    <>
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
              </div>
            )}
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
            <span>{showTriangleAngles ? '△ ANGLES: ON' : '△ ANGLES: OFF'}</span>
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

          {isStarModeActive && (
            <button
              onClick={() => setIsCelestialDeckCollapsed((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-amber-500/50 bg-[#0b1220]/90 text-amber-300 hover:bg-amber-950/60 shadow-md"
              title={isCelestialDeckCollapsed ? 'Open Real Celestial menu' : 'Minimize Real Celestial menu beside Upload Overlay'}
              aria-label={isCelestialDeckCollapsed ? 'Open Real Celestial menu' : 'Minimize Real Celestial menu'}
            >
              <Star className="w-3.5 h-3.5" />
              <span>{isCelestialDeckCollapsed ? 'STAR MENU' : 'MINIMIZE STAR MENU'}</span>
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

        {/* Orbit Angles, Zoom & Stage Fullscreen */}
        <div className="flex items-center gap-2 bg-[#0b1220]/90 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
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
        </div>
      </div>

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
              <div className="px-3 py-2 text-[10px] font-mono font-bold tracking-wider text-emerald-200">LOCATION PHOTOGRAPH / SATELLITE CONTEXT</div>
              {earthLocateImage?.url ? (
                <>
                  <img src={earthLocateImage.url} alt={earthLocateImage.title} className="w-full h-[240px] md:h-[330px] object-cover bg-slate-900" loading="lazy" />
                  <div className="p-3">
                    <div className="text-xs font-semibold text-slate-100">{earthLocateImage.title}</div>
                    <div className="mt-1 text-[10px] text-slate-400 line-clamp-3">{earthLocateImage.description}</div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500"><span>Source: {earthLocateImage.source}</span>{earthLocateImage.pageUrl && <a href={earthLocateImage.pageUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-100">Image source ↗</a>}</div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[240px] md:min-h-[330px] items-center justify-center p-6 text-center text-xs font-mono text-slate-400">
                  {earthLocateImageLoading ? 'Searching nearby open-license photographs, then NASA imagery…' : 'No suitable photo was returned. The map remains available; try opening the full map for this location.'}
                </div>
              )}
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
      {isStarModeActive && !isCelestialDeckCollapsed && (
        <div className="absolute top-16 left-3 z-30 max-w-sm w-full bg-[#0b1220]/95 backdrop-blur-md p-3.5 rounded-xl border border-amber-500/40 shadow-2xl flex flex-col gap-2.5">
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
                  <button onClick={() => setAllConstellations(true)} className="rounded border border-sky-700 px-2 py-1 text-[9px] font-mono text-sky-200 hover:bg-sky-950">ALL ON</button>
                  <button onClick={() => setAllConstellations(false)} className="rounded border border-slate-700 px-2 py-1 text-[9px] font-mono text-slate-300 hover:bg-slate-800">ALL OFF</button>
                  <button onClick={() => setShowConstellationControls((v) => !v)} className="rounded border border-slate-700 px-2 py-1 text-[9px] font-mono text-slate-300">{showConstellationControls ? 'HIDE' : 'SELECT'}</button>
                </div>
              </div>
              {showConstellationControls && <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto pr-1">{IAU_CONSTELLATIONS.map((name) => {
                const available = REAL_CELESTIAL_STARS.some((star) => star.constellation === name || (name === 'Bootes' && star.constellation === 'Boötes'));
                return <label key={name} className={'flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px] font-mono ' + (available ? 'text-slate-200' : 'text-slate-500')} title={available ? 'Stars in current local catalog can be shown/hidden' : 'Name listed; star-coordinate and line data are not yet in the app catalog'}><input type="checkbox" checked={isConstellationEnabled(name)} onChange={(e) => setConstellationsEnabled((prev) => ({ ...prev, [name]: e.target.checked }))} className="accent-sky-400" />{name}{!available && <span className="ml-auto text-[8px] opacity-70">DATA NEEDED</span>}</label>;
              })}</div>}
              <div className="text-[9px] leading-relaxed text-slate-500">All 88 IAU constellation names are listed. Only constellations with star coordinates and connection data in the current catalog can draw their shapes; missing data is marked rather than invented.</div>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-950/20 p-2 text-[10px] leading-relaxed text-orange-100"><input type="checkbox" checked={show110HzResearchComets} onChange={(e) => setShow110HzResearchComets(e.target.checked)} className="mt-0.5 accent-orange-400" /><span><strong>110 Hz research comet layer</strong><br/>Animate candidate rays from visible ancient-site markers. These are visual research targets only; no site is confirmed to resonate at 110 Hz without published measurements.</span></label>
          </div>

          {/* Channel to Star Manual Pickers with Lock / Unlock buttons */}
          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800/80">
            {/* CH-A Star */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold text-cyan-400">CH-A (L)</span>
                <button
                  onClick={() => setLockedChannels((prev) => ({ ...prev, a: !prev.a }))}
                  className="text-cyan-400 hover:text-white"
                  title={lockedChannels.a ? 'Channel A is locked to star' : 'Channel A is free to drag'}
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
                  onClick={() => setLockedChannels((prev) => ({ ...prev, b: !prev.b }))}
                  className="text-pink-400 hover:text-white"
                  title={lockedChannels.b ? 'Channel B is locked to star' : 'Channel B is free to drag'}
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
                  onClick={() => setLockedChannels((prev) => ({ ...prev, c: !prev.c }))}
                  className="text-amber-400 hover:text-white"
                  title={lockedChannels.c ? 'Channel C is locked to star' : 'Channel C is free to drag'}
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
        </div>
      )}

      {/* Historical Earth / sky timeline is off by default to keep the initial space view clean. */}
      {isTimelineActive ? (
        <div className="absolute top-[4.6rem] left-3 right-3 z-20 pointer-events-auto max-w-2xl rounded-xl border border-amber-500/40 bg-[#07101d]/95 backdrop-blur-md px-3 py-2 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">Historical Earth / Sky Timeline</div>
            <div className="flex items-center gap-2">
              <div className="text-xs font-mono text-white">{timelineYear < 0 ? Math.abs(timelineYear).toLocaleString() + ' BCE' : timelineYear + ' CE'}</div>
              <button onClick={() => setIsTimelineActive(false)} className="rounded px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/40 hover:bg-amber-950/50" aria-label="Hide historical timeline">TIMELINE OFF</button>
            </div>
          </div>
          <input aria-label="Historical year from 10,000 BCE to present" type="range" min="-10000" max={new Date().getUTCFullYear()} step="10" value={timelineYear} onChange={(e) => setTimelineYear(Number(e.target.value))} className="w-full accent-amber-400 cursor-pointer" />
          <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-slate-400"><span>10,000 BCE</span><span>{timelineYearsAgo.toLocaleString()} years before present</span><span>Present</span></div>
          <div className="mt-1 text-[9px] leading-tight text-slate-400">Orange markers appear after each site's approximate founding era. Sky precession is first-order (~50.29″/yr); year-only rotation phase is illustrative, not an exact historical time-of-day. Berger 1978 describes long-term orbital/climate cycles, not a precision star-position catalogue.</div>
        </div>
      ) : (
        <button onClick={() => setIsTimelineActive(true)} className="absolute top-[4.6rem] left-3 z-20 pointer-events-auto rounded-lg border border-amber-500/40 bg-[#07101d]/90 px-3 py-1.5 text-[10px] font-mono font-bold text-amber-300 shadow-lg hover:bg-amber-950/50" aria-label="Show historical timeline">TIMELINE OFF · SHOW</button>
      )}

      {/* Large interactive Earth fills the Top Plane viewport; Globe controls retain drag-to-rotate and wheel zoom. */}
      {isEarthModeActive && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="relative h-full w-full max-w-full max-h-full pointer-events-auto">
            <Globe3D ref={globeRef} width={Math.max(320, (containerRef.current?.clientWidth || 800) * 0.96)}
              height={Math.max(320, (containerRef.current?.clientHeight || 600) * 0.96)}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              backgroundColor="rgba(0,0,0,0)"
              showGraticules={false} showAtmosphere={earthAtmosphere}
              pointsData={visibleEarthSites} pointLat={(d: any) => d.lat} pointLng={(d: any) => d.lon}
              pointColor={(d: any) => d.color} pointRadius={(d: any) => d.size} pointAltitude={(d: any) => d.altitude}
              pointLabel={(d: any) => `${d.name} — ${d.year < 0 ? Math.abs(d.year) + ' BCE' : d.year + ' CE'} · click to explore`}
              htmlElementsData={show110HzResearchComets ? visibleEarthSites : []}
              htmlLat={(d: any) => d.lat} htmlLng={(d: any) => d.lon} htmlAltitude={(d: any) => 0.04}
              htmlElement={(d: any) => {
                const marker = document.createElement('div');
                marker.style.width = '44px'; marker.style.height = '44px'; marker.style.position = 'relative'; marker.style.pointerEvents = 'none';
                marker.title = '110 Hz research candidate · resonance unverified at this location';
                const comet = document.createElement('div');
                comet.style.position = 'absolute'; comet.style.left = '4px'; comet.style.top = '20px'; comet.style.width = '34px'; comet.style.height = '3px';
                comet.style.transform = 'rotate(-42deg)'; comet.style.transformOrigin = 'right center';
                comet.style.background = 'linear-gradient(90deg, transparent, rgba(251,146,60,.15), #fdba74, #fff7ed)';
                comet.style.filter = 'drop-shadow(0 0 5px #fb923c)';
                comet.animate([{ opacity: 0.12, transform: 'translate(-4px, 5px) rotate(-42deg) scaleX(.25)' }, { opacity: 1, transform: 'translate(0, 0) rotate(-42deg) scaleX(1)' }, { opacity: 0.05, transform: 'translate(8px, -8px) rotate(-42deg) scaleX(.2)' }], { duration: 1450, iterations: Infinity, delay: (Math.abs(d.lat * 11 + d.lon) % 900) });
                const label = document.createElement('span'); label.textContent = '110'; label.style.position = 'absolute'; label.style.left = '17px'; label.style.top = '4px'; label.style.font = 'bold 9px monospace'; label.style.color = '#fed7aa'; label.style.textShadow = '0 0 7px #f97316';
                marker.append(comet, label); return marker;
              }}
              onPointClick={(d: any) => openEarthSite(d)} />
            {show110HzResearchComets && <div className="absolute inset-0 z-[5] pointer-events-none flex items-start justify-center pt-16"><span className="rounded-full border border-orange-400/50 bg-slate-950/80 px-3 py-1 text-[9px] font-mono text-orange-200 shadow-[0_0_18px_rgba(249,115,22,.18)]">110 Hz RESEARCH CANDIDATES · UNVERIFIED RESONANCE</span></div>}
            <div className="absolute inset-0 z-[4] pointer-events-none flex items-center justify-center overflow-hidden">
              <div className="relative w-[min(74vmin,76%)] aspect-square rounded-full border border-slate-300/20 animate-[spin_27s_linear_infinite]">
                <div className="absolute inset-0 rounded-full border border-dashed border-slate-400/15" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 via-slate-400 to-slate-700 shadow-[0_0_18px_rgba(226,232,240,.65)] animate-pulse"><span className="absolute top-7 right-[-28px] whitespace-nowrap text-[9px] font-mono text-slate-200 drop-shadow">MOON · orbit compressed</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={handleWheel} className={`absolute inset-0 z-10 w-full h-full touch-none ${isEarthModeActive ? 'pointer-events-none' : ''} ${hoverNode || activeDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-all-scroll'}`} />

      <EarthSiteExplorer site={selectedEarthSite} onClose={() => setSelectedEarthSite(null)} description={selectedEarthSite ? getEarthSiteDescription(selectedEarthSite.name) : ''} />

      {/* Direct Vertical Elevation Sliders Overlay (3 Channels: A, B, C) */}
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

      {/* Bottom Status Deck */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        {/* Positions Readouts */}
        <div className="flex flex-wrap items-center gap-3 bg-[#0b1220]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff]" />
            <span className="text-cyan-400 font-bold">
              A: ({aPos.x.toFixed(1)}, {aPos.y.toFixed(1)}, {aPos.z.toFixed(1)}m)
              {isStarModeActive && lockedChannels.a && <span className="text-[10px] text-cyan-300 ml-1">★ LOCKED</span>}
            </span>
          </div>

          <span className="text-slate-600">·</span>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ff007f]" />
            <span className="text-pink-400 font-bold">
              B: ({bPos.x.toFixed(1)}, {bPos.y.toFixed(1)}, {bPos.z.toFixed(1)}m)
              {isStarModeActive && lockedChannels.b && <span className="text-[10px] text-pink-300 ml-1">★ LOCKED</span>}
            </span>
          </div>

          <span className="text-slate-600">·</span>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
            <span className="text-amber-400 font-bold">
              C: ({cPos.x.toFixed(1)}, {cPos.y.toFixed(1)}, {cPos.z.toFixed(1)}m)
              {isStarModeActive && lockedChannels.c && <span className="text-[10px] text-amber-300 ml-1">★ LOCKED</span>}
            </span>
          </div>
        </div>

        {/* Spatial Mode Switch */}
        <div className="flex items-center gap-2 bg-[#0b1220]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => onUpdateSpatialMode('trinaural-isolated')}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              spatialMode === 'trinaural-isolated'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Trinaural Split (A:L, B:R, C:Ctr)
          </button>
          <button
            onClick={() => onUpdateSpatialMode('3d-hrtf')}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              spatialMode === '3d-hrtf'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3D HRTF Spatial Cube
          </button>
        </div>
      </div>
    </div>
  );
};
