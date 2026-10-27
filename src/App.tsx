import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import type { TrinauralConfig } from './types/index';
import {
  Activity, AudioLines, Atom, AudioWaveform, Building2, Camera, ChevronDown, Compass,
  Database, Globe2, Landmark, Layers3, Map, MapPin, Orbit, Radar, Search, Settings2,
  Signal, SlidersHorizontal, Star, Target, Waves, X, Zap, Volume2, ChevronUp, Mountain, Sun
} from 'lucide-react';
import { AudioCubeSpace } from './components/AudioCubeSpace';
import { EarthElevation } from './components/EarthElevation';
import { SiteResearchNotes } from './components/SiteResearchNotes';
import { SolarFlareResearch } from './components/SolarFlareResearch';
import { SolarFlareEarth } from './components/SolarFlareEarth';
import { OscillatorDeck } from './components/OscillatorDeck';
import { DeltaHUD } from './components/DeltaHUD';
import { FrequencyMatrix } from './components/FrequencyMatrix';
import type { CameraView, SpatialPosition, SpatialRoutingMode } from './types';
import { DEFAULT_EARTH_POINTS, LEGACY_HISTORICAL_SITES } from './data/earthData';
import { REAL_CELESTIAL_STARS } from './data/celestialStars';
import { ACOUSTIC_SITE_EVIDENCE } from './data/acousticSiteEvidence';
import { RESEARCH_CATALOG_SITES } from './data/researchSiteCatalog';

const INITIAL_CONFIG: TrinauralConfig = { aFreq:432,aFineTune:0,aWaveform:'sine',aGain:0.85,aMuted:false,aPos:{x:-4.5,y:1.5,z:0}, bFreq:442,bFineTune:0,bWaveform:'sine',bGain:0.85,bMuted:false,bPos:{x:4.5,y:1.5,z:0}, cFreq:452,cFineTune:0,cWaveform:'sine',cGain:0.85,cMuted:false,cPos:{x:0,y:2.5,z:3.5},isDeltaLocked:true,lockedDeltaAB:10,lockedDeltaBC:10,masterVolume:0.8,spatialMode:'trinaural-isolated',cameraView:'top',cameraYaw:30,cameraPitch:22,cameraZoom:4.6 };
const CENTER: SpatialPosition = { x: 0, y: 0, z: 0 };
const NAV_ITEMS = [
  { label: 'GLOBAL SEARCH', icon: Radar },
  { label: 'ANCIENT SITES', icon: MapPin },
  { label: 'HISTORICAL SITES', icon: Landmark },
  { label: 'CITIES', icon: Building2 },
  { label: 'REFERENCE LOCATIONS', icon: Globe2 },
  { label: 'ALIGNMENT ANALYSIS', icon: Target },
  { label: 'FREQUENCY / HZ', icon: AudioWaveform },
  { label: 'SOUND PATTERNS', icon: Waves },
  { label: 'ANGLES & DIRECTIONS', icon: Compass },
  { label: 'STELLAR ALIGNMENTS', icon: Star },
  { label: 'TRIGONOMETRY', icon: Atom },
  { label: 'MAP OVERLAYS', icon: Layers3 },
  { label: 'DATABASE', icon: Database },
  { label: 'A/B/C AUDIO CONTROLS', icon: AudioLines },
  { label: 'TRINAURAL / SOLFEGGIO', icon: AudioWaveform },
  { label: 'SETTINGS', icon: Settings2 },
];



function siteGlyphFor(category = '', name = '', isCity = false): string {
  const value = `${category} ${name}`.toLowerCase();
  if (isCity || /city|settlement|village|urban/.test(value)) return '⌂';
  if (/sound|audio|acoustic|frequency|resonance|hz|solfeggio/.test(value)) return '♫';
  if (/star|astronom|observatory|alignment|celestial|constellation/.test(value)) return '✦';
  if (/water|spring|lake|river|well|ocean|sea level/.test(value)) return '≈';
  if (/cave|cavern|grotto|underground/.test(value)) return '◒';
  if (/stone|crystal|rock|mineral/.test(value)) return '⬟';
  if (/mound|burial|tumulus|tomb|dolmen|barrow/.test(value)) return '⬢';
  if (/pyramid|temple|ziggurat|monument|megalith|structure|archaeolog|ancient|historic/.test(value)) return '▲';
  return '⌖';
}

function researchModuleForSite(site: (typeof DEFAULT_EARTH_POINTS)[number]): string[] {
  const name = site.name.toLowerCase();
  const description = (site.desc ?? '').toLowerCase();
  const category = (site.category ?? '').toLowerCase();
  const modules: string[] = ['DATABASE', 'GLOBAL SEARCH', 'MAP OVERLAYS'];
  if (category === 'ancient' || /pyramid|stonehenge|megalith|temple|ruins|ancient|nazca|göbekli|gobekli|çatal|newgrange|carnac|moai|teotihuacan|chichen|jericho|neolithic|archaeolog|dolmen|standing stone|petra|machu picchu|angkor|baalbek|persepolis|pompeii|mound|sanctuary|ziggurat|grotto|cliff palace|historical park|passage tomb|stone circle/.test(name + ' ' + description)) modules.push('ANCIENT SITES', 'HISTORICAL SITES');
  if (category === 'astronomy' || /observatory|astronom|solstice|equinox|meridian|celestial|star|constellation|sky alignment|chankillo/.test(name + ' ' + description)) modules.push('STELLAR ALIGNMENTS', 'ALIGNMENT ANALYSIS', 'ANGLES & DIRECTIONS');
  if (category === 'acoustic' || /acoustic|sound|resonan|frequency|echo|measured hz|solfeggio/.test(name + ' ' + description)) modules.push('FREQUENCY / HZ', 'SOUND PATTERNS');
  if (category === 'city' || /city|tokyo celestial hub/.test(name)) modules.push('CITIES', 'GLOBAL SEARCH', 'TRIGONOMETRY');
  if (category === 'reference') modules.push('REFERENCE LOCATIONS', 'GLOBAL SEARCH');
  if (!modules.includes('ALIGNMENT ANALYSIS')) modules.push('ALIGNMENT ANALYSIS');
  if (!modules.includes('TRIGONOMETRY')) modules.push('TRIGONOMETRY');
  return [...new Set(modules)];
}
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

export default function App() {
  const [config, setConfig] = useState<TrinauralConfig>(INITIAL_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [positionPitchMode, setPositionPitchMode] = useState(false);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  useEffect(() => { const engine = new AudioEngine(INITIAL_CONFIG); audioEngineRef.current = engine; return () => { engine.stop(); audioEngineRef.current = null; }; }, []);
  const handleUpdateConfig = useCallback((patch: Partial<TrinauralConfig>) => { setConfig((previous) => { const next = { ...previous, ...patch }; audioEngineRef.current?.updateConfig(next); return next; }); }, []);
  const handleToggleAudio = async () => { const engine = audioEngineRef.current; if (!engine) return; if (isRunning) { engine.stop(); setIsRunning(false); } else { await engine.start(); setIsRunning(true); } };
  const [activeNav, setActiveNav] = useState('GLOBAL SEARCH');
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedGlobeSite, setSelectedGlobeSite] = useState<any>(null);
  const [favoriteSites, setFavoriteSites] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('neuropulse-favorite-sites') || '[]'); } catch { return []; }
  });
  const [showFavorites, setShowFavorites] = useState(false);
  const [customEarthSites, setCustomEarthSites] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('neuropulse-custom-earth-sites') || '[]'); } catch { return []; }
  });
  const [showAddEarthSite, setShowAddEarthSite] = useState(false);
  const [newEarthSiteName, setNewEarthSiteName] = useState('');
  const [newEarthSiteLat, setNewEarthSiteLat] = useState('');
  const [newEarthSiteLon, setNewEarthSiteLon] = useState('');
  const [newEarthSiteCategory, setNewEarthSiteCategory] = useState('ancient');
  const [newEarthSiteNotes, setNewEarthSiteNotes] = useState('');
  useEffect(() => { try { localStorage.setItem('neuropulse-custom-earth-sites', JSON.stringify(customEarthSites)); } catch { /* browser storage may be unavailable */ } }, [customEarthSites]);
  useEffect(() => { try { localStorage.setItem('neuropulse-favorite-sites', JSON.stringify(favoriteSites)); } catch { /* storage can be disabled */ } }, [favoriteSites]);
  const toggleFavorite = useCallback((site: any) => {
    if (!site) return;
    const key = String(site.name || site.id || '');
    setFavoriteSites(previous => previous.some(item => String(item.name || item.id || '') === key)
      ? previous.filter(item => String(item.name || item.id || '') !== key)
      : [...previous, { id: site.id ?? key, name: site.name ?? key, lat: site.lat, lon: site.lon, category: site.category ?? site.layerCategory ?? 'Research site', desc: site.desc ?? site.measurementSummary ?? site.researchReason ?? '' }]);
  }, []);
  const isFavorite = (site: any) => !!site && favoriteSites.some(item => String(item.name || item.id || '') === String(site.name || site.id || ''));
  const [frequencyMax, setFrequencyMax] = useState(20000);
  const [angleMax, setAngleMax] = useState(180);
  const [includeStars, setIncludeStars] = useState(false);
  const [includeAcoustics, setIncludeAcoustics] = useState(true);
  const [includeGeometry, setIncludeGeometry] = useState(true);
  const [showSiteList, setShowSiteList] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [scanRequested, setScanRequested] = useState(false);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [matrixMenuOpen, setMatrixMenuOpen] = useState(false);
  const [earthAreaView, setEarthAreaView] = useState<'globe' | 'road' | 'satellite' | 'street' | 'elevation'>('globe');
  const [waterElevationRequest, setWaterElevationRequest] = useState(0);
  const [earthSearchRequest, setEarthSearchRequest] = useState(0);
  const [streetFallbackNotice, setStreetFallbackNotice] = useState(false);
  const [streetFrameLoaded, setStreetFrameLoaded] = useState(false);
  const [mapSnapshotNotice, setMapSnapshotNotice] = useState('');
  const [mapSnapshotLoading, setMapSnapshotLoading] = useState(false);
  const [elevationTools, setElevationTools] = useState({ triangulation: false, constellations: false, angles: false });
  const [elevationWaterLevel, setElevationWaterLevel] = useState(0);
  const [elevationWaterOpacity, setElevationWaterOpacity] = useState(0.58);
  useEffect(() => {
    const onElevationState = (event: Event) => {
      const detail = (event as CustomEvent<{ seaLevel?: number; waterOpacity?: number }>).detail;
      if (typeof detail?.seaLevel === 'number') setElevationWaterLevel(detail.seaLevel);
      if (typeof detail?.waterOpacity === 'number') setElevationWaterOpacity(detail.waterOpacity);
    };
    window.addEventListener('neuro-pulse-elevation-state', onElevationState);
    return () => window.removeEventListener('neuro-pulse-elevation-state', onElevationState);
  }, []);
  useEffect(() => {
    if (earthAreaView !== 'elevation') setElevationTools({ triangulation: false, constellations: false, angles: false });
  }, [earthAreaView]);
  const runElevationTool = (action: 'triangulate' | 'constellations' | 'angles' | 'screenshot' | 'clear') => {
    if (action === 'clear') setElevationTools({ triangulation: false, constellations: false, angles: false });
    else if (action === 'triangulate') setElevationTools(value => ({ ...value, triangulation: !value.triangulation }));
    else if (action === 'constellations') setElevationTools(value => ({ ...value, constellations: !value.constellations }));
    else if (action === 'angles') setElevationTools(value => ({ ...value, angles: !value.angles }));
    window.dispatchEvent(new CustomEvent('neuro-pulse-elevation-tool', { detail: { action } }));
  };

  // Clear stale fallback notices when the selected location changes. Do not replace a
  // Street View iframe merely because it took longer than a few seconds to render.
  useEffect(() => {
    setStreetFallbackNotice(false);
  }, [selectedSiteId, selectedGlobeSite?.lat, selectedGlobeSite?.lon]);

  useEffect(() => {
    if (earthAreaView === 'street') setStreetFrameLoaded(false);
  }, [earthAreaView, selectedSiteId, selectedGlobeSite?.lat, selectedGlobeSite?.lon]);

  const handleGlobeSiteSelect = useCallback((site: any) => {
    const known = DEFAULT_EARTH_POINTS.find((point) => point.name.toLowerCase() === site.name.toLowerCase());
    setSelectedSiteId(known?.id ?? site.name);
    setEarthAreaView('street');
    setSelectedGlobeSite({ id: known?.id ?? site.name, name: site.name, lat: site.lat, lon: site.lon, category: site.layerCategory ?? (site.evidenceStatus ? 'Acoustic evidence' : 'Globe site'), desc: known?.desc ?? ([site.measurementSummary, site.heightNote, site.orientationNote, site.ritualContext].filter(Boolean).join(' · ') || 'Selected from the live Earth globe. Coordinates and available catalogue details are shown here.'), layerCategory: site.layerCategory, year: site.year, evidenceStatus: site.evidenceStatus, measuredFrequenciesHz: site.measuredFrequenciesHz, structuralHeightFt: site.structuralHeightFt, numberSystem: site.numberSystem, numberSystemNote: site.numberSystemNote, researchReason: site.researchReason, heightBasis: site.heightBasis, ritualContext: site.ritualContext, orientationNote: site.orientationNote, measurementContext: site.measurementContext });
    setShowSiteList(false);
  }, []);
  const researchSites = useMemo(() => {
    const core = DEFAULT_EARTH_POINTS.map((site) => ({
      ...site,
      modules: researchModuleForSite(site),
      sourceUrl: /chankillo/i.test(site.name) ? 'https://whc.unesco.org/en/list/1624/' :
        /stonehenge|avebury/i.test(site.name) ? 'https://whc.unesco.org/en/list/373/' :
        /göbekli|gobekli/i.test(site.name) ? 'https://whc.unesco.org/en/list/1572/' :
        /nazca/i.test(site.name) ? 'https://whc.unesco.org/en/list/700/' :
        /teotihuacan/i.test(site.name) ? 'https://whc.unesco.org/en/list/414/' :
        /machu picchu/i.test(site.name) ? 'https://whc.unesco.org/en/list/274/' :
        /easter island|rapa nui|moai/i.test(site.name) ? 'https://whc.unesco.org/en/list/715/' :
        /great pyramid|giza/i.test(site.name) ? 'https://whc.unesco.org/en/list/86/' :
        /petra/i.test(site.name) ? 'https://whc.unesco.org/en/list/326/' :
        /caral/i.test(site.name) ? 'https://whc.unesco.org/en/list/1269/' : undefined,
    }));
    const known = new Set(core.map((site) => site.name.toLowerCase()));
    const legacy = LEGACY_HISTORICAL_SITES
      .filter((site) => !known.has(site.name.toLowerCase()))
      .map((site, index) => {
        const category: 'ancient' | 'astronomy' | 'acoustic' | 'custom' = 'ancient';
        const normalized = { ...site, id: 'legacy-' + index + '-' + site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), color: site.isCity ? '#60a5fa' : '#facc15', category,
          desc: /chankillo/i.test(site.name)
            ? 'UNESCO documents Chankillo as a solar observatory and ceremonial center used around 250–200 BCE. Its thirteen towers and two observation points track the annual sunrise and sunset range; this is a strong documented archaeoastronomy case. Source: UNESCO World Heritage Centre.'
            : /stonehenge/i.test(site.name)
            ? 'UNESCO identifies Stonehenge and Avebury as a major prehistoric monument landscape. Solstitial orientation is widely studied; interpretations beyond documented monument phases should be assessed against archaeological evidence.'
            : /göbekli|gobekli/i.test(site.name)
            ? 'UNESCO describes monumental round-oval and rectangular enclosures built in the Pre-Pottery Neolithic, approximately 9600–8200 BCE, with carved T-shaped limestone pillars. Ritual interpretations remain archaeological interpretations, not proof of a specific astronomical function.'
            : /nazca/i.test(site.name)
            ? 'The Nazca and Palpa geoglyph landscape is a major archaeological research subject. Individual line functions vary and should be assessed from published surveys rather than assuming every line is an astronomical alignment.'
            : /great pyramid|giza/i.test(site.name)
            ? 'The Giza pyramid field is an archaeological complex of the Old Kingdom. Coordinate and orientation studies should use surveyed monument axes and dated sky calculations; proposed star correlations are hypotheses unless independently demonstrated.'
            : /caral/i.test(site.name)
            ? 'Caral-Supe is an early urban and ceremonial center in Peru, dated to the third millennium BCE. It is relevant to comparative studies of early urban planning and monumental architecture; any specific sky alignment needs its own evidence.'
            : site.isCity ? 'City reference point for geographic comparison. Urban coordinates are representative and do not imply an archaeological or astronomical alignment.'
            : 'Historical/archaeological reference entry. Its inclusion supports geographic, chronology, and comparative monument research; any specific astronomical alignment or acoustic property requires site-specific evidence.',
        };
        return { ...normalized, modules: researchModuleForSite(normalized), sourceUrl:
          /chankillo/i.test(site.name) ? 'https://whc.unesco.org/en/list/1624/' :
          /stonehenge|avebury/i.test(site.name) ? 'https://whc.unesco.org/en/list/373/' :
          /göbekli|gobekli/i.test(site.name) ? 'https://whc.unesco.org/en/list/1572/' :
          /nazca/i.test(site.name) ? 'https://whc.unesco.org/en/list/700/' :
          /teotihuacan/i.test(site.name) ? 'https://whc.unesco.org/en/list/414/' :
          /machu picchu/i.test(site.name) ? 'https://whc.unesco.org/en/list/274/' :
          /easter island|rapa nui|moai/i.test(site.name) ? 'https://whc.unesco.org/en/list/715/' :
          /great pyramid|giza/i.test(site.name) ? 'https://whc.unesco.org/en/list/86/' :
          /petra/i.test(site.name) ? 'https://whc.unesco.org/en/list/326/' :
          /caral/i.test(site.name) ? 'https://whc.unesco.org/en/list/1269/' : undefined };
      });
    const additions = RESEARCH_CATALOG_SITES.map((site, index) => ({
      ...site,
      id: 'catalog-' + index + '-' + site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      color: site.category === 'astronomy' ? '#a78bfa' : site.category === 'acoustic' ? '#fb923c' : site.isCity ? '#60a5fa' : '#facc15',
      modules: [...new Set(['DATABASE', 'GLOBAL SEARCH', 'MAP OVERLAYS', ...(site.tags ?? []), ...researchModuleForSite(site as any)])],
      sourceUrl: site.sourceUrl,
    }));
    const normalizeName = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const seen = new Set([...core, ...legacy].map((site) => normalizeName(site.name)));
    const uniqueAdditions = additions.filter((site) => {
      const key = normalizeName(site.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...core, ...legacy, ...uniqueAdditions, ...customEarthSites];
  }, [customEarthSites]);
  const selectedSite = selectedGlobeSite ?? researchSites.find((site) => site.id === selectedSiteId) ?? null;

  // Marker selections open Street View first. Google serves the embedded panorama when
  // coverage exists; because the iframe is cross-origin, NeuroPulse can detect load/network
  // failures but cannot inspect Google's internal 'no imagery' message. Keep an explicit
  // in-app aerial fallback available for those cases.
  const moduleSites = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return researchSites.filter((site) =>
      (activeNav === 'GLOBAL SEARCH' || ['EARTH','SOLAR SYSTEM','GALAXY','UNIVERSAL ARCHIVE'].includes(activeNav) || site.modules.includes(activeNav)) &&
      (categoryFilter === 'ALL' || String(site.category ?? 'Other').trim() === categoryFilter) &&
      (!query || [site.name, site.category, site.desc, site.sourceUrl, ...(site.modules ?? []), ...(((site as any).tags ?? []) as string[])].some((value) => value?.toLocaleLowerCase().includes(query)))
    );
  }, [researchSites, searchText, activeNav, categoryFilter]);
  const categoryOptions = useMemo(() => [...new Set(researchSites.map(site => String(site.category ?? 'Other').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [researchSites]);
  const filteredSites = moduleSites;

  const nearestSites = useMemo(() => {
    if (!selectedSite) return [];
    return researchSites
      .filter((site) => site.name !== selectedSite.name)
      .map((site) => ({ ...site, distance: distanceKm(selectedSite, site) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 30);
  }, [selectedSite, researchSites]);

  const linkedAcousticRecords = useMemo(() => {
    if (!selectedSite) return [];
    return ACOUSTIC_SITE_EVIDENCE
      .map((record) => ({ ...record, distance: distanceKm(selectedSite, record) }))
      .filter((record) => record.distance < 100 && record.measuredFrequenciesHz.some((hz) => hz <= frequencyMax))
      .sort((a, b) => a.distance - b.distance);
  }, [selectedSite, frequencyMax]);

  const updatePosition = (channel: 'a' | 'b' | 'c', position: SpatialPosition) => handleUpdateConfig({ [channel + 'Pos']: position } as Partial<TrinauralConfig>);

  const navDescription: Record<string, string> = {
    'GLOBAL SEARCH': 'Search and compare documented places, measured evidence, and calculated geometry.',
    'SOLAR FLARE EARTH': 'Dedicated animated solar-system map with NOAA live observations and replayable recorded flare events.',
    'ANCIENT SITES': 'Browse archaeological sites, monuments, and ancient structures.',
    'HISTORICAL SITES': 'Browse historic settlements, temples, tombs, and cultural landmarks.',
    'CITIES': 'Browse modern cities and urban reference locations.',
    'REFERENCE LOCATIONS': 'Browse geographic locations that do not fit a specialist category.',
    'ALIGNMENT ANALYSIS': 'Compare coordinates and test candidate alignments without treating proximity as proof.',
    'FREQUENCY / HZ': 'Explore published acoustic measurements and clearly labelled investigation bands.',
    'SOUND PATTERNS': 'Review source-backed acoustic records and their measurement context.',
    'ANGLES & DIRECTIONS': 'Use coordinates and bearings as geometric inputs for further verification.',
    'STELLAR ALIGNMENTS': 'Browse catalogue stars and compare candidate sky targets with dated site evidence.',
    'TRIGONOMETRY': 'Inspect distances and geometric relationships calculated from site coordinates.',
    'MAP OVERLAYS': 'Use the globe controls to switch map overlays and visualization layers.',
    'DATABASE': 'Browse the full combined site catalogue, historic city references, stars, and acoustic records. Curated site records link to UNESCO sources where available.',
    'A/B/C AUDIO CONTROLS': 'Full A, B, and C oscillator controls, waveform selection, gain, fine tuning, mute, and spatial elevation.',
    'TRINAURAL / SOLFEGGIO': 'Restore the trinaural delta lock, brainwave presets, and Solfeggio frequency matrix.',
    'SETTINGS': 'Interface and visualization preferences.',
  };

  const handleMapSnapshot = async () => {
    const latitude = Number(selectedSite?.lat);
    const longitude = Number(selectedSite?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMapSnapshotNotice('Select a location before saving a map snapshot.');
      return;
    }
    setMapSnapshotLoading(true);
    setMapSnapshotNotice('');
    const service = earthAreaView === 'road'
      ? 'World_Street_Map'
      : 'World_Imagery';
    // Google Maps is embedded in a cross-origin iframe, so the browser cannot copy
    // its pixels directly. Export an imagery/road-map image for the selected location.
    const halfLat = 0.055;
    const halfLon = Math.min(45, halfLat * 1.55 / Math.max(0.25, Math.cos(latitude * Math.PI / 180)));
    const west = Math.max(-180, longitude - halfLon);
    const east = Math.min(180, longitude + halfLon);
    const south = Math.max(-85, latitude - halfLat);
    const north = Math.min(85, latitude + halfLat);
    const exportUrl = new URL(`https://services.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/export`);
    exportUrl.search = new URLSearchParams({
      bbox: [west, south, east, north].join(','),
      bboxSR: '4326',
      imageSR: '4326',
      size: '1400,900',
      format: 'png32',
      transparent: 'false',
      f: 'image',
    }).toString();
    try {
      const response = await fetch(exportUrl.toString(), { mode: 'cors' });
      if (!response.ok) throw new Error(`Map export returned ${response.status}`);
      const sourceBlob = await response.blob();
      const sourceUrl = URL.createObjectURL(sourceBlob);
      try {
        const image = new Image();
        image.src = sourceUrl;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('The map image could not be decoded.'));
        });
        const canvas = document.createElement('canvas');
        canvas.width = 1400;
        canvas.height = 900;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create a map snapshot canvas.');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        // Add a small title/date strip and a visible center pin for the selected place.
        ctx.fillStyle = 'rgba(3, 10, 22, 0.88)';
        ctx.fillRect(0, 0, canvas.width, 72);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 25px Arial, sans-serif';
        ctx.fillText(String(selectedSite.name || 'Selected location').slice(0, 70), 24, 31);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '16px Arial, sans-serif';
        ctx.fillText(`${latitude.toFixed(5)}°, ${longitude.toFixed(5)}° · ${earthAreaView === 'road' ? 'Road map' : earthAreaView === 'street' ? 'Aerial context for Street View' : 'Satellite imagery'} · ${new Date().toLocaleString()}`, 24, 55);
        const px = canvas.width / 2;
        const py = canvas.height / 2 + 36;
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#fb7185';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px, py + 12);
        ctx.lineTo(px, py + 28);
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 5;
        ctx.stroke();

        const png = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png');
        });
        const downloadUrl = URL.createObjectURL(png);
        const link = document.createElement('a');
        const safeName = String(selectedSite.name || 'map').normalize('NFKD')
          .replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '').slice(0, 80) || 'map';
        link.href = downloadUrl;
        link.download = `${safeName}-map-snapshot-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
        setMapSnapshotNotice(earthAreaView === 'street'
          ? 'Map snapshot saved. It shows aerial context; the embedded Google Street View panorama itself cannot be captured by this button.'
          : 'Map snapshot saved.');
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    } catch (error) {
      console.error('Map snapshot export failed:', error);
      setMapSnapshotNotice('Snapshot download failed. Try again, or use the map’s own menu to save/share this view.');
    } finally {
      setMapSnapshotLoading(false);
    }
  };

  const handleAddEarthSite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newEarthSiteName.trim();
    const lat = Number(newEarthSiteLat);
    const lon = Number(newEarthSiteLon);
    if (!name || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) return;
    const site = {
      id: 'custom-' + Date.now(), name, lat, lon, category: newEarthSiteCategory,
      desc: newEarthSiteNotes.trim() || 'User-added Earth reference site. Notes are user supplied; verify coordinates and any historical claims independently.',
      color: '#38bdf8', modules: ['DATABASE', 'GLOBAL SEARCH', 'MAP OVERLAYS', 'ANCIENT SITES', 'HISTORICAL SITES', 'TRIGONOMETRY'],
      isCustom: true,
    };
    setCustomEarthSites(previous => [...previous, site]);
    setSelectedGlobeSite(null);
    setSelectedSiteId(site.id);
    setEarthAreaView('street');
    setActiveNav('GLOBAL SEARCH');
    setSearchText('');
    setShowSiteList(false);
    setShowAddEarthSite(false);
    setNewEarthSiteName(''); setNewEarthSiteLat(''); setNewEarthSiteLon(''); setNewEarthSiteNotes('');
  };

  const handleRunSearch = () => {
    setScanRequested(true);
    setShowSiteList(true);
  };

  return (
    <main className="atlas-app">
      <header className="atlas-topbar">
        <div className="atlas-brand">
          <div className="atlas-brand-mark"><Globe2 size={28} strokeWidth={1.5} /></div>
          <div className="atlas-brand-copy">
            <div className="atlas-brand-title">NEUROPULSE<span> / ATLAS</span></div>
            <div className="atlas-brand-subtitle">ANCIENT GLOBAL RESEARCH PROGRAM</div>
            <div className="atlas-brand-micro">ALIGNMENT · FREQUENCY · GEOMETRY · THE STARS</div>
          </div>
        </div>
        <div className="atlas-topnav" aria-hidden="true" />
      </header>

      {showFavorites && <section className="atlas-panel" role="dialog" aria-label="Favorite sites" style={{position:'absolute',zIndex:100,top:84,right:20,width:'min(420px, calc(100vw - 32px))',maxHeight:'70vh',overflow:'auto',padding:16}}>
        <div className="atlas-panel-heading"><Star size={14} fill="currentColor"/> FAVORITE SITES <button className="atlas-secondary-button" onClick={() => setShowFavorites(false)}>CLOSE</button></div>
        {favoriteSites.length ? favoriteSites.map((site: any) => <div key={site.id} className="atlas-favorite-row" style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between',padding:'6px 0'}}><button className="atlas-result-chip" onClick={() => { setSelectedGlobeSite(site); setSelectedSiteId(site.id); setEarthAreaView('street'); setShowFavorites(false); }}><MapPin size={12}/><span>{site.name}</span></button><button aria-label={'Remove '+site.name+' from favorites'} onClick={() => toggleFavorite(site)}><Star size={14} fill="currentColor"/></button></div>) : <p className="atlas-no-data">No favorites saved yet. Select a site and use Save to Favorites.</p>}
      </section>}
      <div className="atlas-workspace">
        <aside className="atlas-left" aria-label="Earth navigation and site tools">
          <section className="atlas-panel atlas-navigation">
            <div className="atlas-panel-heading">RESEARCH MODULES</div>
            {NAV_ITEMS.map(({ label, icon: Icon }) => (
              <button key={label} className={activeNav === label ? 'atlas-nav-item selected' : 'atlas-nav-item'} onClick={() => {
                setActiveNav(label);
                if (label === 'SOLAR FLARE' || label === 'GLOBAL SEARCH') setEarthAreaView('globe');
                if (label === 'STELLAR ALIGNMENTS') setIncludeStars(true);
                if (label === 'A/B/C AUDIO CONTROLS' || label === 'TRINAURAL / SOLFEGGIO') setAudioMenuOpen(true);
              }}>
                <Icon size={15} strokeWidth={1.8} /><span>{label}</span><span className="nav-chevron">›</span>
              </button>
            ))}
          </section>
          <section className="atlas-panel atlas-add-site-panel">
            <button type="button" className="atlas-add-site-launch" onClick={() => setShowAddEarthSite(value => !value)}><MapPin size={15} /> {showAddEarthSite ? 'CLOSE ADD EARTH SITE' : 'ADD EARTH SITE'}</button>
            {showAddEarthSite && <form className="atlas-add-site-form" onSubmit={handleAddEarthSite}>
              <label>SITE NAME<input required value={newEarthSiteName} onChange={event => setNewEarthSiteName(event.target.value)} placeholder="e.g. Research location" /></label>
              <div className="atlas-add-site-coordinates">
                <label>LATITUDE<input required type="number" min="-90" max="90" step="any" value={newEarthSiteLat} onChange={event => setNewEarthSiteLat(event.target.value)} placeholder="-90 to 90" /></label>
                <label>LONGITUDE<input required type="number" min="-180" max="180" step="any" value={newEarthSiteLon} onChange={event => setNewEarthSiteLon(event.target.value)} placeholder="-180 to 180" /></label>
              </div>
              <label>CATEGORY<select value={newEarthSiteCategory} onChange={event => setNewEarthSiteCategory(event.target.value)}><option value="ancient">Ancient site</option><option value="historical">Historical site</option><option value="astronomy">Astronomy</option><option value="acoustic">Acoustic research</option><option value="reference">Reference location</option><option value="custom">Other / custom</option></select></label>
              <label>NOTES<textarea rows={3} value={newEarthSiteNotes} onChange={event => setNewEarthSiteNotes(event.target.value)} placeholder="Your observations, sources, or research notes" /></label>
              <button type="submit" className="atlas-add-site-save">SAVE SITE TO NEUROPULSE</button>
              <p>Saved in this browser and added to the site catalogue. Coordinates are user entered.</p>
            </form>}
            {customEarthSites.length > 0 && <div className="atlas-custom-site-count">{customEarthSites.length} USER-ADDED SITE{customEarthSites.length === 1 ? '' : 'S'} SAVED</div>}
          </section>
          {activeNav === 'SOLAR FLARE' && <div className="atlas-solar-details-left"><SolarFlareResearch onClose={() => { setActiveNav('GLOBAL SEARCH'); setEarthAreaView('globe'); }} /></div>}
          <div className="atlas-left-bottom-controls" aria-label="Solar research controls">
            <button type="button" className="atlas-solar-launch-button atlas-solar-research-button" onClick={() => { setActiveNav('SOLAR FLARE RESEARCH'); setShowSearchPanel(false); }} aria-label="Open Solar Flare Research"><Sun size={16} /> SOLAR FLARE RESEARCH</button>
          </div>
        </aside>
        <section className="atlas-center">
          <div className="atlas-globe-stage">
            <div className="atlas-globe-grid" aria-hidden="true" />
            {activeNav === 'SOLAR FLARE' ? <SolarFlareEarth onBack={() => { setActiveNav('GLOBAL SEARCH'); setEarthAreaView('globe'); }} /> : earthAreaView === 'elevation' ? <EarthElevation
              key="water-elevation-earth"
              selectedSite={selectedSite ? { name: selectedSite.name, lat: selectedSite.lat, lon: selectedSite.lon } : null}
              siteCatalogue={researchSites}
              onBack={() => setEarthAreaView('globe')}
              onAssignChannel={(channel, latitude, longitude) => {
                const lat = latitude * Math.PI / 180;
                const lon = longitude * Math.PI / 180;
                const radius = 3.42;
                updatePosition(channel, { x: radius * Math.cos(lat) * Math.sin(lon), y: radius * Math.sin(lat), z: radius * Math.cos(lat) * Math.cos(lon) });
              }}
              onSelectSite={(site) => {
                const known = researchSites.find((item: any) => item.name === site.name) as any;
                setSelectedSiteId(known?.id ?? site.name);
                setSelectedGlobeSite(known ?? { ...site, id: site.name, category: site.category ?? 'Mapped site' });
              }}
            /> : (earthAreaView === 'globe' || !selectedSite) ? <AudioCubeSpace
              aPos={config.aPos} bPos={config.bPos} cPos={config.cPos}
              spatialMode={config.spatialMode} cameraView={config.cameraView}
              cameraYaw={config.cameraYaw} cameraPitch={config.cameraPitch} cameraZoom={config.cameraZoom}
              aFreq={config.aFreq + config.aFineTune} bFreq={config.bFreq + config.bFineTune} cFreq={config.cFreq + config.cFineTune}
              isRunning={isRunning}
              positionPitchMode={positionPitchMode} onTogglePositionPitchMode={() => setPositionPitchMode(value => !value)}
              onUpdateAPos={(position) => updatePosition('a', position)} onUpdateBPos={(position) => updatePosition('b', position)} onUpdateCPos={(position) => updatePosition('c', position)}
              onUpdateSpatialMode={(spatialMode) => handleUpdateConfig({ spatialMode })} onUpdateCameraView={(cameraView) => handleUpdateConfig({ cameraView })}
              onUpdateCameraAngles={(cameraYaw, cameraPitch) => handleUpdateConfig({ cameraYaw, cameraPitch })}
              onUpdateCameraZoom={(cameraZoom) => handleUpdateConfig({ cameraZoom })}
              onResetCamera={() => handleUpdateConfig({ cameraYaw: 30, cameraPitch: 22, cameraZoom: 4.6, cameraView: 'top' })}
              onSiteSelect={handleGlobeSiteSelect}
              siteCatalogue={researchSites}
              openWaterElevationRequest={waterElevationRequest}
              openEarthSearchRequest={earthSearchRequest}
              onOpenWaterElevation={() => setEarthAreaView('elevation')}

              showChannelElevationControls={audioMenuOpen && ['A/B/C AUDIO CONTROLS', 'TRINAURAL / SOLFEGGIO'].includes(activeNav)}
            /> : <div className="atlas-embedded-earth-map"><div className="atlas-map-toolbar"><strong>{earthAreaView === 'street' ? 'STREET VIEW' : earthAreaView === 'satellite' ? 'SATELLITE MAP' : 'LOCATION MAP'} · {siteGlyphFor(selectedSite.category || selectedSite.layerCategory || '', selectedSite.name, !!selectedSite.isCity)} {selectedSite.name}</strong><div className="atlas-map-toolbar-actions">{mapSnapshotNotice && <span role="status">{mapSnapshotNotice}</span>}{streetFallbackNotice && <span role="status">Street View unavailable — showing satellite map</span>}<button onClick={handleMapSnapshot} disabled={mapSnapshotLoading} title="Download a PNG snapshot of the selected location using an exportable basemap"><Camera size={14} /> {mapSnapshotLoading ? 'SAVING…' : 'SCREENSHOT MAP'}</button><button onClick={() => { setStreetFallbackNotice(false); setStreetFrameLoaded(false); setEarthAreaView('street'); }}>TRY STREET VIEW IN APP</button>{earthAreaView === 'street' && <button onClick={() => { setStreetFallbackNotice(true); setEarthAreaView('satellite'); }}>AERIAL FALLBACK IN APP</button>}<button onClick={() => setEarthAreaView('globe')}>← BACK TO EARTH GLOBE</button></div></div><iframe title={'Map view of ' + selectedSite.name} onLoad={() => { if (earthAreaView === 'street') setStreetFrameLoaded(true); }} onError={() => { if (earthAreaView === 'street') { setStreetFallbackNotice(true); setEarthAreaView('satellite'); } }} loading="eager" src={earthAreaView === 'street' ? 'https://maps.google.com/maps?layer=c&cbll=' + selectedSite.lat + ',' + selectedSite.lon + '&cbp=11,0,,0,0&output=svembed' : earthAreaView === 'satellite' ? 'https://maps.google.com/maps?q=' + selectedSite.lat + ',' + selectedSite.lon + '&t=k&z=14&output=embed' : 'https://www.openstreetmap.org/export/embed.html?bbox=' + (selectedSite.lon-0.08) + ',' + (selectedSite.lat-0.06) + ',' + (selectedSite.lon+0.08) + ',' + (selectedSite.lat+0.06) + '&layer=mapnik&marker=' + selectedSite.lat + ',' + selectedSite.lon} /></div>}
            {earthAreaView !== 'elevation' && activeNav !== 'SOLAR FLARE' && <div className="atlas-globe-overlay atlas-globe-overlay-top"><span>EARTH REFERENCE FRAME</span><span>WGS84 · LAT / LON</span></div>}

          </div>
          {['ANCIENT SITES', 'HISTORICAL SITES', 'CITIES', 'FREQUENCY / HZ', 'SOUND PATTERNS', 'MAP OVERLAYS', 'SETTINGS'].includes(activeNav) && (
            <section className="atlas-panel atlas-module-workspace">
              <div className="atlas-panel-heading">
                {activeNav === 'FREQUENCY / HZ' || activeNav === 'SOUND PATTERNS' ? 'ACOUSTIC RESEARCH' : activeNav === 'MAP OVERLAYS' ? 'MAP LAYERS' : activeNav === 'SETTINGS' ? 'WORKSPACE SETTINGS' : activeNav}
                <span className="atlas-panel-count">INTERACTIVE CONTROLS</span>
              </div>
              {(activeNav === 'ANCIENT SITES' || activeNav === 'HISTORICAL SITES' || activeNav === 'CITIES' || activeNav === 'FREQUENCY / HZ' || activeNav === 'SOUND PATTERNS') && (
                <div className="atlas-module-results">
                  {moduleSites.slice(0, 24).map((site) => (
                    <button key={site.id} className="atlas-result-chip" onClick={() => {
                      setSelectedGlobeSite(null);
                      setSelectedSiteId(site.id);
                      setEarthAreaView('street');
                      setShowSiteList(false);
                    }}>
                      <MapPin size={12} /><span>{site.name}</span><small>{site.category ?? (activeNav === 'CITIES' ? 'City reference' : 'Historical site')}</small>
                    </button>
                  ))}
                  {moduleSites.length === 0 && <div className="atlas-no-data">No catalogue entries match this module and search. Clear the search to see available records.</div>}
                </div>
              )}
              {(activeNav === 'FREQUENCY / HZ' || activeNav === 'SOUND PATTERNS') && (
                <div className="atlas-module-results">
                  {ACOUSTIC_SITE_EVIDENCE.filter(record => record.measuredFrequenciesHz.some(hz => hz <= frequencyMax)).slice(0, 30).map(record => (
                    <button key={record.id} className="atlas-result-chip" onClick={() => {
                      const known = researchSites.find(site => site.name.toLowerCase() === record.name.toLowerCase());
                      if (known) setSelectedSiteId(known.id);
                      setSelectedGlobeSite({ ...record, id: record.id, category: 'Acoustic evidence', desc: record.measurementContext || record.status });
                      setEarthAreaView('street');
                    }}>
                      <AudioWaveform size={12} /><span>{record.name}</span><small>{record.measuredFrequenciesHz.join(' / ')} Hz</small>
                    </button>
                  ))}
                  <div className="atlas-footnote">Frequency values are shown as recorded in the source catalogue; they are not inferred for sites without measurements.</div>
                </div>
              )}
              {activeNav === 'MAP OVERLAYS' && (
                <div className="atlas-module-toggles">
                  <label><input type="checkbox" checked={includeStars} onChange={event => setIncludeStars(event.target.checked)} /> Show star catalogue layer</label>
                  <label><input type="checkbox" checked={includeAcoustics} onChange={event => setIncludeAcoustics(event.target.checked)} /> Show acoustic evidence layer</label>
                  <label><input type="checkbox" checked={includeGeometry} onChange={event => setIncludeGeometry(event.target.checked)} /> Show geometry and alignment layer</label>
                  <button className="atlas-secondary-button" onClick={() => setShowSiteList(value => !value)}>{showSiteList ? 'HIDE SEARCH RESULTS' : 'SHOW FILTERED SITE RESULTS'}</button>
                </div>
              )}
              {activeNav === 'SETTINGS' && (
                <div className="atlas-module-toggles">
                  <label><input type="checkbox" checked={includeStars} onChange={event => setIncludeStars(event.target.checked)} /> Star catalogue visible</label>
                  <label><input type="checkbox" checked={includeAcoustics} onChange={event => setIncludeAcoustics(event.target.checked)} /> Acoustic records visible</label>
                  <label><input type="checkbox" checked={includeGeometry} onChange={event => setIncludeGeometry(event.target.checked)} /> Geometry comparisons enabled</label>
                  <label><input type="checkbox" checked={showSiteList} onChange={event => setShowSiteList(event.target.checked)} /> Keep site results panel open</label>
                  <button className="atlas-secondary-button" onClick={() => {
                    setIncludeStars(true); setIncludeAcoustics(true); setIncludeGeometry(true);
                    setShowSiteList(false); setFrequencyMax(20000); setAngleMax(180);
                    setSearchText(''); setCategoryFilter('ALL'); setScanRequested(false);
                  }}>RESET WORKSPACE SETTINGS</button>
                </div>
              )}
            </section>
          )}
          {['A/B/C AUDIO CONTROLS', 'TRINAURAL / SOLFEGGIO'].includes(activeNav) && (
            <section className="atlas-audio-workspace">
              <div className="atlas-audio-menu-header">
                <div><strong><AudioLines size={15} /> A / B / C SPATIAL AUDIO ENGINE</strong><span>Independent oscillator controls · changes update the live audio engine</span></div>
                <button className="atlas-secondary-button" onClick={() => setAudioMenuOpen(v => !v)}>{audioMenuOpen ? 'COLLAPSE' : 'OPEN'} <ChevronUp size={13} /></button>
              </div>
              {audioMenuOpen && <>
                <div className="atlas-master-controls">
                  <button className="atlas-primary-button" onClick={handleToggleAudio}>{isRunning ? 'STOP AUDIO ENGINE' : 'START AUDIO ENGINE'}</button>
                  <label><Volume2 size={15} /> MASTER VOLUME <strong>{Math.round(config.masterVolume * 100)}%</strong><input type="range" min="0" max="1" step="0.01" value={config.masterVolume} onChange={e => handleUpdateConfig({ masterVolume: Number(e.target.value) })} /></label>
                  <button className="atlas-secondary-button" onClick={() => setMatrixMenuOpen(v => !v)}>{matrixMenuOpen ? 'HIDE FREQUENCY MATRIX' : 'OPEN FREQUENCY MATRIX'}</button>
                </div>
                <div className="atlas-oscillator-grid">
                  <OscillatorDeck channel="a" frequency={config.aFreq} fineTune={config.aFineTune} waveform={config.aWaveform} gain={config.aGain} muted={config.aMuted} position={config.aPos} audioEngine={audioEngineRef.current} isRunning={isRunning}
                    onUpdateFrequency={aFreq => config.isDeltaLocked ? handleUpdateConfig({ aFreq, bFreq: Number((aFreq + config.lockedDeltaAB).toFixed(2)), cFreq: Number((aFreq + config.lockedDeltaAB + config.lockedDeltaBC).toFixed(2)) }) : handleUpdateConfig({ aFreq })} onUpdateFineTune={aFineTune => handleUpdateConfig({ aFineTune })} onUpdateWaveform={aWaveform => handleUpdateConfig({ aWaveform })} onUpdateGain={aGain => handleUpdateConfig({ aGain })} onUpdateElevation={y => updatePosition('a', { ...config.aPos, y })} onToggleMute={() => handleUpdateConfig({ aMuted: !config.aMuted })} />
                  <OscillatorDeck channel="b" frequency={config.bFreq} fineTune={config.bFineTune} waveform={config.bWaveform} gain={config.bGain} muted={config.bMuted} position={config.bPos} audioEngine={audioEngineRef.current} isRunning={isRunning}
                    onUpdateFrequency={bFreq => config.isDeltaLocked ? handleUpdateConfig({ bFreq, lockedDeltaAB: Number(Math.abs(bFreq - config.aFreq).toFixed(2)) }) : handleUpdateConfig({ bFreq })} onUpdateFineTune={bFineTune => handleUpdateConfig({ bFineTune })} onUpdateWaveform={bWaveform => handleUpdateConfig({ bWaveform })} onUpdateGain={bGain => handleUpdateConfig({ bGain })} onUpdateElevation={y => updatePosition('b', { ...config.bPos, y })} onToggleMute={() => handleUpdateConfig({ bMuted: !config.bMuted })} />
                  <OscillatorDeck channel="c" frequency={config.cFreq} fineTune={config.cFineTune} waveform={config.cWaveform} gain={config.cGain} muted={config.cMuted} position={config.cPos} audioEngine={audioEngineRef.current} isRunning={isRunning}
                    onUpdateFrequency={cFreq => config.isDeltaLocked ? handleUpdateConfig({ cFreq, lockedDeltaBC: Number(Math.abs(cFreq - config.bFreq).toFixed(2)) }) : handleUpdateConfig({ cFreq })} onUpdateFineTune={cFineTune => handleUpdateConfig({ cFineTune })} onUpdateWaveform={cWaveform => handleUpdateConfig({ cWaveform })} onUpdateGain={cGain => handleUpdateConfig({ cGain })} onUpdateElevation={y => updatePosition('c', { ...config.cPos, y })} onToggleMute={() => handleUpdateConfig({ cMuted: !config.cMuted })} />
                </div>
                <DeltaHUD aFreq={config.aFreq} bFreq={config.bFreq} cFreq={config.cFreq} aFineTune={config.aFineTune} bFineTune={config.bFineTune} cFineTune={config.cFineTune} isDeltaLocked={config.isDeltaLocked} audioEngine={audioEngineRef.current} isRunning={isRunning}
                  onToggleDeltaLock={() => { const locked = !config.isDeltaLocked; handleUpdateConfig({ isDeltaLocked: locked, lockedDeltaAB: Math.abs(config.bFreq - config.aFreq), lockedDeltaBC: Math.abs(config.cFreq - config.bFreq) }); }}
                  onSetQuickDelta={delta => handleUpdateConfig({ bFreq: config.aFreq + delta, cFreq: config.aFreq + delta * 2, lockedDeltaAB: delta, lockedDeltaBC: delta, isDeltaLocked: true })} />
                {matrixMenuOpen && <FrequencyMatrix aFreq={config.aFreq} bFreq={config.bFreq} cFreq={config.cFreq} lockedDeltaAB={config.lockedDeltaAB} lockedDeltaBC={config.lockedDeltaBC} isDeltaLocked={config.isDeltaLocked}
                  onApplySolfeggio={(freq, target) => { if (target === 'base' || target === 'tri-spread') { const deltaAB = config.isDeltaLocked ? config.lockedDeltaAB : Math.abs(config.bFreq - config.aFreq); const deltaBC = config.isDeltaLocked ? config.lockedDeltaBC : Math.abs(config.cFreq - config.bFreq); handleUpdateConfig({ aFreq: freq, bFreq: freq + deltaAB, cFreq: freq + deltaAB + deltaBC }); } else if (target === 'a') handleUpdateConfig({ aFreq: freq }); else if (target === 'b') handleUpdateConfig({ bFreq: freq }); else handleUpdateConfig({ cFreq: freq }); }}
                  onApplyBrainwaveDelta={delta => handleUpdateConfig({ bFreq: config.aFreq + delta, cFreq: config.aFreq + delta * 2, lockedDeltaAB: delta, lockedDeltaBC: delta, isDeltaLocked: true })} />}
              </>}
            </section>
          )}
          {activeNav === 'TRINAURAL / SOLFEGGIO' && !audioMenuOpen && <section className="atlas-audio-workspace"><button className="atlas-primary-button" onClick={() => { setAudioMenuOpen(true); setMatrixMenuOpen(true); }}>OPEN TRINAURAL CONTROLS & FREQUENCY MATRIX</button></section>}
        </section>

        <aside className="atlas-right">
          {activeNav === 'SOLAR FLARE RESEARCH' && <SolarFlareResearch onClose={() => setActiveNav('GLOBAL SEARCH')} />}
          <button type="button" className="atlas-search-right-button" onClick={() => setShowSearchPanel(value => !value)} aria-expanded={showSearchPanel}><Search size={15} /> {showSearchPanel ? "CLOSE SEARCH" : "SEARCH"}</button>
          {showSearchPanel && <div className="atlas-search-drawer">
            <div className="atlas-search-drawer-title"><strong><Search size={14} /> GLOBAL SEARCH</strong><button className="atlas-search-close" onClick={() => setShowSearchPanel(false)} aria-label="Close search"><X size={14} /></button></div>
          <section className="atlas-panel atlas-navigation">
            <div className="atlas-panel-heading">RESEARCH MODULES</div>
            {NAV_ITEMS.map(({ label, icon: Icon }) => (
              <button key={label} className={activeNav === label ? 'atlas-nav-item selected' : 'atlas-nav-item'} onClick={() => { setActiveNav(label); if (label === 'SOLAR FLARE') { setEarthAreaView('globe'); setShowSearchPanel(false); } if (label === 'GLOBAL SEARCH') { setEarthAreaView('globe'); handleUpdateConfig({ cameraView: 'top' }); setEarthSearchRequest(value => value + 1); setShowSearchPanel(false); } if (label === 'STELLAR ALIGNMENTS') setIncludeStars(true); if (label === 'A/B/C AUDIO CONTROLS' || label === 'TRINAURAL / SOLFEGGIO') setAudioMenuOpen(true); }}>
                <Icon size={15} strokeWidth={1.8} /><span>{label}</span><span className="nav-chevron">›</span>
              </button>
            ))}
          </section>
          <section className="atlas-panel atlas-filter-panel">
            <div className="atlas-panel-heading"><SlidersHorizontal size={13} /> SEARCH FILTERS</div>
            <label className="atlas-searchbox">
              <Search size={14} />
              <input value={searchText} onChange={(event) => { setSearchText(event.target.value); setShowSiteList(true); setScanRequested(false); }} placeholder="Name, region, keyword..." />
              {searchText && <button aria-label="Clear search" onClick={() => setSearchText('')}><X size={13} /></button>}
            </label>
            {!showSiteList && <button className="atlas-search-expand" onClick={() => setShowSiteList(true)}><Search size={12} /> SHOW SEARCH RESULTS ({filteredSites.length})</button>}
            <label className="atlas-field-label">SITE CATEGORY</label>
            <select className="atlas-select-like" aria-label="Filter by site category" value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setShowSiteList(true); setScanRequested(false); }}><option value="ALL">All documented categories</option>{categoryOptions.map(category => <option key={category} value={category}>{category}</option>)}</select>
            <label className="atlas-field-label">FREQUENCY RANGE (HZ) <strong>{frequencyMax.toLocaleString()} Hz</strong></label>
            <input className="atlas-range" aria-label="Maximum frequency" type="range" min="100" max="20000" step="100" value={frequencyMax} onChange={(event) => setFrequencyMax(Number(event.target.value))} />
            <div className="atlas-range-labels"><span>100</span><span>20,000</span></div>
            <label className="atlas-field-label">ANGLE RANGE <strong>{angleMax}°</strong></label>
            <input className="atlas-range" aria-label="Maximum angle" type="range" min="1" max="180" value={angleMax} onChange={(event) => setAngleMax(Number(event.target.value))} />
            <div className="atlas-range-labels"><span>1°</span><span>180°</span></div>
            <div className="atlas-checks">
              <label><input type="checkbox" checked={includeStars} onChange={(event) => setIncludeStars(event.target.checked)} /> Include star catalogue</label>
              <label><input type="checkbox" checked={includeAcoustics} onChange={(event) => setIncludeAcoustics(event.target.checked)} /> Include acoustic evidence</label>
              <label><input type="checkbox" checked={includeGeometry} onChange={(event) => setIncludeGeometry(event.target.checked)} /> Include geometric comparisons</label>
            </div>
            <button className="atlas-primary-button" onClick={handleRunSearch}><Radar size={16} /> RUN GLOBAL SEARCH</button>
          </section>


          {showSiteList && (
            <div className="atlas-results-strip">
              <div className="atlas-results-title"><span className="atlas-results-heading"><Search size={14} /> SEARCH RESULTS <strong>{filteredSites.length}</strong></span><button className="atlas-results-minimize" onClick={() => setShowSiteList(false)} aria-label="Close search results" title="Close search results"><X size={14} /></button></div>
              <div className="atlas-results-list">
                {filteredSites.slice(0, 80).map((site) => (
                  <button key={site.id} className={selectedSite?.id === site.id ? 'atlas-result-chip chosen' : 'atlas-result-chip'} onClick={() => { setSelectedGlobeSite(null); setSelectedSiteId(site.id); setEarthAreaView('street'); }}>
                    <MapPin size={12} /><span>{site.name}</span>
                  </button>
                ))}
                {filteredSites.length === 0 && <span className="atlas-empty">No sites match this search.</span>}
              </div>
              {scanRequested && <div className="atlas-search-note">Catalogue search complete · {filteredSites.length} combined site records · UNESCO source links appear in the selected-site details where available.</div>}
            </div>
          )}
          </div>}

          {earthAreaView === 'elevation' && <section className="atlas-panel atlas-elevation-tools">
            <div className="atlas-panel-heading"><Mountain size={13} /> ELEVATION TOOLKIT <span className="atlas-panel-count">3D TERRAIN</span></div>
            <div className="atlas-elevation-tool-note">NOAA height data and adjustable ocean datum are active. Water and terrain controls are first; geometry overlays are below.</div>
            <div className="atlas-elevation-water-controls">
              <label>WATER ELEVATION <strong>{elevationWaterLevel > 0 ? '+' : ''}{elevationWaterLevel.toFixed(1)} m</strong></label>
              <input aria-label="Elevation workspace water level" type="range" min="-120" max="1000" step="1" value={elevationWaterLevel} onChange={event => { const value = Number(event.target.value); setElevationWaterLevel(value); window.dispatchEvent(new CustomEvent('neuro-pulse-elevation-tool', { detail: { action: 'water-level', value } })); }} />
              <div className="atlas-elevation-water-labels"><span>-120 m</span><span>0 m datum</span><span>+1,000 m</span></div>
              <label>WATER TRANSPARENCY <strong>{Math.round((1 - elevationWaterOpacity) * 100)}%</strong></label>
              <input aria-label="Elevation workspace water transparency" type="range" min="0" max="0.95" step="0.05" value={1 - elevationWaterOpacity} onChange={event => { const value = 1 - Number(event.target.value); setElevationWaterOpacity(value); window.dispatchEvent(new CustomEvent('neuro-pulse-elevation-tool', { detail: { action: 'water-opacity', value } })); }} />
              <div className="atlas-elevation-water-labels"><span>Transparent</span><span>Opaque</span></div>
              <button type="button" className="atlas-elevation-reset-water" onClick={() => { setElevationWaterLevel(0); setElevationWaterOpacity(0.58); window.dispatchEvent(new CustomEvent('neuro-pulse-elevation-tool', { detail: { action: 'water-level', value: 0 } })); window.dispatchEvent(new CustomEvent('neuro-pulse-elevation-tool', { detail: { action: 'water-opacity', value: 0.58 } })); }}>RESET WATER TO PRESENT DATUM</button>
            </div>
            <div className="atlas-elevation-tool-grid">
              <button type="button" aria-pressed={elevationTools.triangulation} className={elevationTools.triangulation ? 'active' : ''} onClick={() => runElevationTool('triangulate')}><Atom size={14} /> {elevationTools.triangulation ? 'HIDE TRIANGULATION' : 'TRIANGULATE SITES'}</button>
              <button type="button" aria-pressed={elevationTools.constellations} className={elevationTools.constellations ? 'active' : ''} onClick={() => { runElevationTool('constellations'); setIncludeStars(true); }}><Star size={14} /> {elevationTools.constellations ? 'HIDE CONSTELLATIONS' : 'CONSTELLATION LINES'}</button>
              <button type="button" aria-pressed={elevationTools.angles} className={elevationTools.angles ? 'active' : ''} onClick={() => runElevationTool('angles')}><Compass size={14} /> {elevationTools.angles ? 'HIDE ANGLES' : 'SHOW ANGLES'}</button>
              <button type="button" onClick={() => runElevationTool('screenshot')}><Camera size={14} /> SCREENSHOT ELEVATION</button>
              <button type="button" onClick={() => runElevationTool('clear')}><X size={14} /> CLEAR GEOMETRY</button>
              <button type="button" onClick={() => setEarthAreaView('globe')}><Globe2 size={14} /> FLAT / GLOBE EARTH</button>
            </div>
            <div className="atlas-elevation-tool-status" role="status">{[elevationTools.triangulation && 'SITE MESH ON', elevationTools.constellations && 'CONSTELLATIONS ON', elevationTools.angles && 'ANGLE LABELS ON'].filter(Boolean).join(' · ') || 'GEOMETRY OVERLAYS OFF'}</div>
          </section>}
          <section className="atlas-panel atlas-site-card">
            <div className="atlas-panel-heading"><MapPin size={13} /> SELECTED SITE <span className="atlas-panel-count">REFERENCE DATA</span></div>
            {selectedSite ? <>
              <div className="atlas-site-hero">
                <div className="atlas-site-glyph"><MapPin size={26} /></div>
                <div><h2>{selectedSite.name}</h2><div className="atlas-muted">{selectedSite.category ?? 'Recorded location'}</div></div>
              </div>
              <div className="atlas-site-map-actions"><button onClick={() => setEarthAreaView('road')}>ROAD MAP IN EARTH VIEW</button><button onClick={() => setEarthAreaView('satellite')}>SATELLITE IN EARTH VIEW</button><button onClick={() => setEarthAreaView('street')}>STREET VIEW IN EARTH VIEW</button><button onClick={() => setEarthAreaView('elevation')} title="Open the third Earth workspace with NOAA terrain, bathymetry, and adjustable sea level">WATER ELEVATION · 3D EARTH</button></div><div className="atlas-site-map-actions"><button onClick={() => setEarthAreaView('satellite')} title="Show this location's aerial imagery inside NeuroPulse">OPEN AERIAL MAP IN APP</button></div>
              <div className="atlas-site-map-actions"><button onClick={() => toggleFavorite(selectedSite)} aria-pressed={isFavorite(selectedSite)}><Star size={14} fill={isFavorite(selectedSite) ? 'currentColor' : 'none'} /> {isFavorite(selectedSite) ? 'SAVED TO FAVORITES' : 'SAVE TO FAVORITES'}</button></div>
              <div className="atlas-site-assign-actions"><span>ASSIGN THIS LOCATION TO SPATIAL CHANNEL</span>{(['a','b','c'] as const).map(channel => <button key={channel} className={'assign-' + channel} onClick={() => window.dispatchEvent(new CustomEvent('neuro-pulse-assign-earth-site', { detail: { channel, latitude: selectedSite.lat, longitude: selectedSite.lon } }))}>ADD TO {channel.toUpperCase()}</button>)}</div>
              <div className="atlas-coordinates">
                <div><span>LATITUDE</span><strong>{formatCoordinate(selectedSite.lat, 'N', 'S')}</strong></div>
                <div><span>LONGITUDE</span><strong>{formatCoordinate(selectedSite.lon, 'E', 'W')}</strong></div>
              </div>
              <p className="atlas-site-description">{selectedSite.desc ?? 'Coordinates are included in the local site catalogue.'}</p>
              <SiteResearchNotes
                key={`${selectedSite.id ?? selectedSite.name}-${selectedSite.lat}-${selectedSite.lon}`}
                site={selectedSite}
                sites={researchSites}
                onSelectSite={(site) => {
                  setSelectedGlobeSite(null);
                  setSelectedSiteId(site.id ?? site.name);
                  setEarthAreaView('street');
                }}
              />
              {(selectedSite as any).sourceUrl && <p className="atlas-site-source"><strong>RESEARCH SOURCE</strong><br /><a href={(selectedSite as any).sourceUrl} target="_blank" rel="noreferrer">Open official UNESCO site record ↗</a></p>}
              <div className="atlas-data-table">
                <div><span>Nearest listed site</span><strong>{nearestSites[0]?.name ?? '—'}</strong></div>
                <div><span>Surface distance</span><strong>{nearestSites[0] ? `${Math.round(nearestSites[0].distance).toLocaleString()} km` : '—'}</strong></div>
                <div><span>Acoustic records within 100 km</span><strong>{linkedAcousticRecords.length}</strong></div>
                <div><span>Geometry limit</span><strong>{angleMax}° max angle</strong></div>
              </div>
              <div className="atlas-subheading">ACOUSTIC EVIDENCE</div>
              {!includeAcoustics ? <div className="atlas-no-data">Acoustic evidence is excluded by the current search filters.</div> : linkedAcousticRecords.length > 0 ? linkedAcousticRecords.slice(0, 2).map((record) => (
                <div className="atlas-evidence-row" key={record.id}>
                  <div><strong>{record.name}</strong><span>{record.status === 'published-measurement' ? 'Published measurement' : 'Candidate only'} · {Math.round(record.distance)} km</span></div>
                  <b>{record.measuredFrequenciesHz.length ? record.measuredFrequenciesHz.map((hz) => `${hz} Hz`).join(' / ') : 'No measured Hz'}</b>
                </div>
              )) : <div className="atlas-no-data">No acoustic record in the current evidence catalogue is within 100 km. No frequency is inferred for this site.</div>}
            </> : <div className="atlas-no-data">Select a site from the catalogue to inspect its reference data.</div>}
          </section>

          <section className="atlas-panel atlas-related-panel">
            <div className="atlas-panel-heading"><Orbit size={13} /> NEAREST LISTED SITES <span className="atlas-panel-count">{nearestSites.length} LISTED</span></div>
            {includeGeometry && <div className="atlas-nearest-scroll" tabIndex={0} aria-label="Scrollable nearest sites list">{nearestSites.map((site) => (
              <button key={site.id} className="atlas-related-row" onClick={() => { setSelectedGlobeSite(null); setSelectedSiteId(site.id); setShowSiteList(false); setEarthAreaView('street'); }}>
                <span className="atlas-related-marker"><MapPin size={14} /></span>
                <span className="atlas-related-copy"><strong>{site.name}</strong><small>{formatCoordinate(site.lat, 'N', 'S')} · {formatCoordinate(site.lon, 'E', 'W')}</small></span>
                <b>{Math.round(site.distance).toLocaleString()} km</b>
              </button>
            ))}</div>}
          </section>

          {activeNav === 'STELLAR ALIGNMENTS' && <section className="atlas-panel atlas-star-panel">
            <div className="atlas-panel-heading"><Star size={13} /> STAR CATALOGUE <span className="atlas-panel-count">{REAL_CELESTIAL_STARS.length} RECORDS</span></div>
            {includeStars && REAL_CELESTIAL_STARS.slice(0, 4).map((star) => (
              <div className="atlas-star-row" key={star.id}><span className="star-spark">✦</span><span><strong>{star.name}</strong><small>{star.constellation}</small></span><b>{star.distLy.toLocaleString()} ly</b></div>
            ))}
            <div className="atlas-footnote">Star catalogue coordinates and distances are reference data; a site alignment requires a dated sky calculation and verified architectural axis.</div>
          </section>}
        </aside>
      </div>

      <footer className="atlas-bottom">
        <section className="atlas-bottom-panel atlas-live-data">
          <div className="atlas-bottom-heading"><Activity size={13} /> LOCAL DATA STATUS</div>
          <div className="atlas-metric-grid">
            <div><span>EARTH SITES</span><strong>{researchSites.length.toLocaleString()}</strong></div>
            <div><span>CATALOGUED STARS</span><strong>{REAL_CELESTIAL_STARS.length}</strong></div>
            <div><span>ACOUSTIC RECORDS</span><strong>{ACOUSTIC_SITE_EVIDENCE.length}</strong></div>
            <div><span>SEARCH MATCHES</span><strong>{filteredSites.length}</strong></div>
          </div>
        </section>
        <section className="atlas-bottom-panel atlas-analysis">
          <div className="atlas-bottom-heading"><Target size={13} /> ANALYSIS WORKSPACE</div>
          <div className="atlas-analysis-items">
            <div><span className="analysis-dot cyan" /><span>Coordinate distance</span><b>Available</b></div>
            <div><span className="analysis-dot green" /><span>Published acoustic evidence</span><b>{includeAcoustics ? 'Included' : 'Filtered'}</b></div>
            <div><span className="analysis-dot gold" /><span>Stellar reference catalogue</span><b>{includeStars ? 'Included' : 'Filtered'}</b></div>
            <div><span className="analysis-dot purple" /><span>Alignment verification</span><b>Requires dated sky model</b></div>
          </div>
        </section>
        <section className="atlas-bottom-panel atlas-frequency">
          <div className="atlas-bottom-heading"><Signal size={13} /> FREQUENCY INVESTIGATION</div>
          <div className="atlas-frequency-display"><span>{frequencyMax.toLocaleString()} Hz</span><small>MAX SEARCH RANGE</small></div>
          <div className="atlas-frequency-bars" aria-hidden="true">{Array.from({ length: 34 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 17 + 13) % 31)}%` }} />)}</div>
          <div className="atlas-footnote">Decorative scale indicator only; it is not a live microphone spectrum or measurement.</div>
        </section>
        <section className="atlas-bottom-panel atlas-progress">
          <div className="atlas-bottom-heading"><Zap size={13} /> SEARCH STATE</div>
          <div className="atlas-progress-status"><span className="status-dot" /> {scanRequested ? 'CATALOGUE SEARCH COMPLETE' : 'READY FOR QUERY'}</div>
          <div className="atlas-progress-track"><span style={{ width: scanRequested ? '100%' : '8%' }} /></div>
          <div className="atlas-progress-copy">{scanRequested ? `${filteredSites.length} local site records match the current query.` : 'Run a search to filter the local site catalogue.'}</div>
          <button className="atlas-secondary-button" onClick={() => { setSearchText(''); setShowSiteList(false); setScanRequested(false); setCategoryFilter('ALL'); setSelectedSiteId(''); setSelectedGlobeSite(null); setEarthAreaView('globe'); }}>RESET SEARCH</button>
        </section>
      </footer>
      <div className="atlas-tagline">THE PAST LEAVES SIGNALS — WE FIND THEM <span>· EVIDENCE FIRST · HYPOTHESES LABELLED</span></div>
    </main>
  );
}
