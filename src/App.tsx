import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import type { TrinauralConfig } from './types/index';
import {
  Activity, AudioLines, Atom, AudioWaveform, ChevronDown, Compass,
  Database, Globe2, Layers3, Map, MapPin, Orbit, Radar, Search, Settings2,
  Signal, SlidersHorizontal, Star, Target, Waves, X, Zap, Volume2, ChevronUp
} from 'lucide-react';
import { AudioCubeSpace } from './components/AudioCubeSpace';
import { OscillatorDeck } from './components/OscillatorDeck';
import { DeltaHUD } from './components/DeltaHUD';
import { FrequencyMatrix } from './components/FrequencyMatrix';
import type { CameraView, SpatialPosition, SpatialRoutingMode } from './types';
import { DEFAULT_EARTH_POINTS } from './data/earthData';
import { REAL_CELESTIAL_STARS } from './data/celestialStars';
import { ACOUSTIC_SITE_EVIDENCE } from './data/acousticSiteEvidence';

const INITIAL_CONFIG: TrinauralConfig = { aFreq:432,aFineTune:0,aWaveform:'sine',aGain:0.85,aMuted:false,aPos:{x:-4.5,y:1.5,z:0}, bFreq:442,bFineTune:0,bWaveform:'sine',bGain:0.85,bMuted:false,bPos:{x:4.5,y:1.5,z:0}, cFreq:452,cFineTune:0,cWaveform:'sine',cGain:0.85,cMuted:false,cPos:{x:0,y:2.5,z:3.5},isDeltaLocked:true,lockedDeltaAB:10,lockedDeltaBC:10,masterVolume:0.8,spatialMode:'trinaural-isolated',cameraView:'top',cameraYaw:30,cameraPitch:22,cameraZoom:3.0 };
const CENTER: SpatialPosition = { x: 0, y: 0, z: 0 };
const NAV_ITEMS = [
  { label: 'GLOBAL SEARCH', icon: Radar },
  { label: 'ANCIENT SITES', icon: MapPin },
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


function researchModuleForSite(site: (typeof DEFAULT_EARTH_POINTS)[number]): string[] {
  const name = site.name.toLowerCase();
  const description = (site.desc ?? '').toLowerCase();
  const category = (site.category ?? '').toLowerCase();
  const modules: string[] = ['DATABASE', 'GLOBAL SEARCH', 'MAP OVERLAYS'];
  if (category === 'ancient' || /pyramid|stonehenge|megalith|temple|ruins|ancient|nazca|göbekli|gobekli|catalh|çatal|newgrange|carnac|moai|teotihuacan|chichen|jericho|neolithic|archaeolog|dolmen|standing stone|petra|machu picchu|angkor|baalbek|persepolis|pompeii/.test(name + ' ' + description)) modules.push('ANCIENT SITES');
  if (category === 'astronomy' || /observatory|astronom|solstice|equinox|meridian|celestial|star|constellation|sky alignment|sun pyramid/.test(name + ' ' + description)) modules.push('STELLAR ALIGNMENTS', 'ALIGNMENT ANALYSIS', 'ANGLES & DIRECTIONS');
  if (category === 'acoustic' || /acoustic|sound|resonan|frequency|echo|measured hz|solfeggio/.test(name + ' ' + description)) modules.push('FREQUENCY / HZ', 'SOUND PATTERNS');
  if (category === 'custom' || /city|hub|reference location|modern reference/.test(name + ' ' + description)) modules.push('GLOBAL SEARCH', 'TRIGONOMETRY');
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
  const [selectedSiteId, setSelectedSiteId] = useState(DEFAULT_EARTH_POINTS[0]?.id ?? '');
  const [selectedGlobeSite, setSelectedGlobeSite] = useState<any>(null);
  const [frequencyMax, setFrequencyMax] = useState(20000);
  const [angleMax, setAngleMax] = useState(180);
  const [includeStars, setIncludeStars] = useState(true);
  const [includeAcoustics, setIncludeAcoustics] = useState(true);
  const [includeGeometry, setIncludeGeometry] = useState(true);
  const [showSiteList, setShowSiteList] = useState(false);
  const [scanRequested, setScanRequested] = useState(false);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [matrixMenuOpen, setMatrixMenuOpen] = useState(false);

  const selectedSite = selectedGlobeSite ?? DEFAULT_EARTH_POINTS.find((site) => site.id === selectedSiteId) ?? DEFAULT_EARTH_POINTS[0];
  const handleGlobeSiteSelect = useCallback((site: any) => {
    const known = DEFAULT_EARTH_POINTS.find((point) => point.name.toLowerCase() === site.name.toLowerCase());
    setSelectedSiteId(known?.id ?? site.name);
    setSelectedGlobeSite({ id: known?.id ?? site.name, name: site.name, lat: site.lat, lon: site.lon, category: site.layerCategory ?? (site.evidenceStatus ? 'Acoustic evidence' : 'Globe site'), desc: known?.desc ?? ([site.measurementSummary, site.heightNote, site.orientationNote, site.ritualContext].filter(Boolean).join(' · ') || 'Selected from the live Earth globe. Coordinates and available catalogue details are shown here.'), layerCategory: site.layerCategory, year: site.year, evidenceStatus: site.evidenceStatus, measuredFrequenciesHz: site.measuredFrequenciesHz, structuralHeightFt: site.structuralHeightFt, numberSystem: site.numberSystem, numberSystemNote: site.numberSystemNote, researchReason: site.researchReason, heightBasis: site.heightBasis, ritualContext: site.ritualContext, orientationNote: site.orientationNote, measurementContext: site.measurementContext });
    setShowSiteList(false);
  }, []);
  const filteredSites = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return DEFAULT_EARTH_POINTS.filter((site) =>
      !query || [site.name, site.category, site.desc].some((value) => value?.toLocaleLowerCase().includes(query))
    );
  }, [searchText]);

  const nearestSites = useMemo(() => {
    if (!selectedSite) return [];
    return DEFAULT_EARTH_POINTS
      .filter((site) => site.id !== selectedSite.id)
      .map((site) => ({ ...site, distance: distanceKm(selectedSite, site) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
  }, [selectedSite]);

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
    'ANCIENT SITES': 'Browse the existing geographic site catalogue.',
    'ALIGNMENT ANALYSIS': 'Compare coordinates and test candidate alignments without treating proximity as proof.',
    'FREQUENCY / HZ': 'Explore published acoustic measurements and clearly labelled investigation bands.',
    'SOUND PATTERNS': 'Review source-backed acoustic records and their measurement context.',
    'ANGLES & DIRECTIONS': 'Use coordinates and bearings as geometric inputs for further verification.',
    'STELLAR ALIGNMENTS': 'Browse catalogue stars and compare candidate sky targets with dated site evidence.',
    'TRIGONOMETRY': 'Inspect distances and geometric relationships calculated from site coordinates.',
    'MAP OVERLAYS': 'Use the globe controls to switch map overlays and visualization layers.',
    'DATABASE': 'Browse the site, star, and acoustic reference data already included in this build.',
    'A/B/C AUDIO CONTROLS': 'Full A, B, and C oscillator controls, waveform selection, gain, fine tuning, mute, and spatial elevation.',
    'TRINAURAL / SOLFEGGIO': 'Restore the trinaural delta lock, brainwave presets, and Solfeggio frequency matrix.',
    'SETTINGS': 'Interface and visualization preferences.',
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
            <div className="atlas-brand-subtitle">ANCIENT GLOBAL SEARCH PROGRAM</div>
            <div className="atlas-brand-micro">ALIGNMENT · FREQUENCY · GEOMETRY · THE STARS</div>
          </div>
        </div>
        <nav className="atlas-topnav" aria-label="Primary views">
          {['EARTH', 'SOLAR SYSTEM', 'GALAXY', 'UNIVERSAL ARCHIVE'].map((item, index) => (
            <button key={item} className={(index === 0 ? activeNav === 'GLOBAL SEARCH' : activeNav === item) ? 'active' : ''} onClick={() => setActiveNav(index === 0 ? 'GLOBAL SEARCH' : item)}>
              {item}
            </button>
          ))}
        </nav>
        <div className="atlas-status">
          <button className="atlas-primary-button" onClick={handleToggleAudio}>{isRunning ? "STOP AUDIO" : "START AUDIO"}</button><div className="atlas-clock"><span className="status-dot" /> {isRunning ? "AUDIO ENGINE RUNNING" : "SYSTEM ONLINE"}</div>
          <div className="atlas-status-sub">LOCAL DATA · {DEFAULT_EARTH_POINTS.length} SITES · {REAL_CELESTIAL_STARS.length} STARS</div>
        </div>
      </header>

      <div className="atlas-workspace">
        <aside className="atlas-left">
          <section className="atlas-panel atlas-navigation">
            <div className="atlas-panel-heading">RESEARCH MODULES</div>
            {NAV_ITEMS.map(({ label, icon: Icon }) => (
              <button key={label} className={activeNav === label ? 'atlas-nav-item selected' : 'atlas-nav-item'} onClick={() => setActiveNav(label)}>
                <Icon size={15} strokeWidth={1.8} /><span>{label}</span><span className="nav-chevron">›</span>
              </button>
            ))}
          </section>


          <section className="atlas-panel atlas-site-card atlas-left-selected-site">
            <div className="atlas-panel-heading"><MapPin size={13} /> SELECTED EARTH LOCATION <span className="atlas-panel-count">LIVE</span></div>
            {selectedSite ? <>
              <div className="atlas-site-hero">
                <div className="atlas-site-glyph"><MapPin size={24} /></div>
                <div><h2>{selectedSite.name}</h2><div className="atlas-muted">{selectedSite.category ?? 'Reference location'}{selectedGlobeSite ? ' · selected on globe' : ''}</div></div>
              </div>
              <div className="atlas-coordinates">
                <div><span>LATITUDE</span><strong>{formatCoordinate(selectedSite.lat, 'N', 'S')}</strong></div>
                <div><span>LONGITUDE</span><strong>{formatCoordinate(selectedSite.lon, 'E', 'W')}</strong></div>
              </div>
              <p className="atlas-site-description">{selectedSite.desc ?? 'Coordinates are included in the local site catalogue.'}</p>
              <div className="atlas-data-table">
                <div><span>Nearest listed site</span><strong>{nearestSites[0]?.name ?? '—'}</strong></div>
                <div><span>Surface distance</span><strong>{nearestSites[0] ? `${Math.round(nearestSites[0].distance).toLocaleString()} km` : '—'}</strong></div>
                <div><span>Acoustic records within 100 km</span><strong>{linkedAcousticRecords.length}</strong></div>
                <div><span>Research modules</span><strong>{researchModuleForSite(selectedSite as (typeof DEFAULT_EARTH_POINTS)[number]).filter(m => m !== 'DATABASE' && m !== 'GLOBAL SEARCH' && m !== 'MAP OVERLAYS').length}</strong></div>
              </div>
              <div className="atlas-left-site-actions">
                <a href={`https://www.openstreetmap.org/?mlat=${selectedSite.lat}&mlon=${selectedSite.lon}#map=9/${selectedSite.lat}/${selectedSite.lon}`} target="_blank" rel="noreferrer">OPEN STREET MAP ↗</a>
                <a href={`https://www.google.com/maps/search/?api=1&query=${selectedSite.lat},${selectedSite.lon}`} target="_blank" rel="noreferrer">GOOGLE MAPS ↗</a>
              </div>
              <div className="atlas-subheading">NEARBY SITES · CLICK TO SELECT</div>
              {nearestSites.slice(0,3).map(site => <button key={site.id} className="atlas-related-row" onClick={() => { setSelectedGlobeSite(null); setSelectedSiteId(site.id); }}><span className="atlas-related-marker"><MapPin size={13}/></span><span className="atlas-related-copy"><strong>{site.name}</strong><small>{Math.round(site.distance).toLocaleString()} km away</small></span></button>)}
            </> : <div className="atlas-no-data">Click a city or site on Earth to load its location data here.</div>}
          </section>
          <section className="atlas-panel atlas-module-sites">
            <div className="atlas-panel-heading"><Database size={13}/> {activeNav === 'GLOBAL SEARCH' ? 'SITE CATALOGUE' : activeNav} <span className="atlas-panel-count">{DEFAULT_EARTH_POINTS.filter(site => activeNav === 'GLOBAL SEARCH' || researchModuleForSite(site).includes(activeNav)).length}</span></div>
            <div className="atlas-module-site-list">
              {DEFAULT_EARTH_POINTS.filter(site => activeNav === 'GLOBAL SEARCH' || activeNav === 'DATABASE' || researchModuleForSite(site).includes(activeNav))
                .filter(site => !searchText.trim() || [site.name, site.category, site.desc].some(value => value?.toLowerCase().includes(searchText.trim().toLowerCase())))
                .map(site => <button key={site.id} className={selectedSite?.id === site.id ? 'atlas-module-site selected' : 'atlas-module-site'} onClick={() => { setSelectedGlobeSite(null); setSelectedSiteId(site.id); }}><MapPin size={12}/><span>{site.name}</span><small>{site.category ?? 'reference'}</small></button>)}
            </div>
          </section>

          <section className="atlas-panel atlas-filter-panel">
            <div className="atlas-panel-heading"><SlidersHorizontal size={13} /> SEARCH FILTERS</div>
            <label className="atlas-searchbox">
              <Search size={14} />
              <input value={searchText} onChange={(event) => { setSearchText(event.target.value); setShowSiteList(true); setScanRequested(false); }} placeholder="Name, region, keyword..." />
              {searchText && <button aria-label="Clear search" onClick={() => setSearchText('')}><X size={13} /></button>}
            </label>
            <label className="atlas-field-label">SITE CATEGORY</label>
            <button className="atlas-select-like" onClick={() => setShowSiteList((value) => !value)}>All documented categories <ChevronDown size={13} /></button>
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
        </aside>

        <section className="atlas-center">
          <div className="atlas-center-heading">
            <div><div className="atlas-eyebrow">ACTIVE WORKSPACE / EARTH</div><h1>{activeNav === 'GLOBAL SEARCH' ? 'Global Alignment Explorer' : activeNav}</h1><p>{navDescription[activeNav] ?? 'This view is represented in the navigation; its dedicated visualization is not yet connected.'}</p></div>
            <div className="atlas-live-tag"><span className="status-dot" /> LIVE GLOBE</div>
          </div>
          <div className="atlas-globe-stage">
            <div className="atlas-globe-grid" aria-hidden="true" />
            <AudioCubeSpace
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
              onResetCamera={() => handleUpdateConfig({ cameraYaw: 30, cameraPitch: 22, cameraZoom: 3.0, cameraView: 'top' })}
              onSiteSelect={handleGlobeSiteSelect}
            />
            <div className="atlas-globe-overlay atlas-globe-overlay-top"><span>EARTH REFERENCE FRAME</span><span>WGS84 · LAT / LON</span></div>
            <div className="atlas-globe-overlay atlas-globe-overlay-bottom">
              <span><i className="legend-dot cyan" /> SITE DATABASE</span>
              <span><i className="legend-dot gold" /> STAR CATALOGUE {includeStars ? 'ON' : 'OFF'}</span>
              <span><i className="legend-dot green" /> ACOUSTIC RECORDS {includeAcoustics ? 'ON' : 'OFF'}</span>
              <span><i className="legend-line" /> GEOMETRY {includeGeometry ? 'ON' : 'OFF'}</span>
            </div>
          </div>
          {true && (
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

          {showSiteList && (
            <div className="atlas-results-strip">
              <div className="atlas-results-title"><Search size={14} /> SEARCH RESULTS <strong>{filteredSites.length}</strong></div>
              <div className="atlas-results-list">
                {filteredSites.slice(0, 8).map((site) => (
                  <button key={site.id} className={selectedSite?.id === site.id ? 'atlas-result-chip chosen' : 'atlas-result-chip'} onClick={() => { setSelectedGlobeSite(null); setSelectedSiteId(site.id); }}>
                    <MapPin size={12} /><span>{site.name}</span>
                  </button>
                ))}
                {filteredSites.length === 0 && <span className="atlas-empty">No sites match this search.</span>}
              </div>
              {scanRequested && <div className="atlas-search-note">Catalogue search complete · results reflect local reference data</div>}
            </div>
          )}
        </section>

        <aside className="atlas-right">
          <section className="atlas-panel atlas-site-card">
            <div className="atlas-panel-heading"><MapPin size={13} /> SELECTED SITE <span className="atlas-panel-count">REFERENCE DATA</span></div>
            {selectedSite ? <>
              <div className="atlas-site-hero">
                <div className="atlas-site-glyph"><MapPin size={26} /></div>
                <div><h2>{selectedSite.name}</h2><div className="atlas-muted">{selectedSite.category ?? 'Recorded location'}</div></div>
              </div>
              <div className="atlas-coordinates">
                <div><span>LATITUDE</span><strong>{formatCoordinate(selectedSite.lat, 'N', 'S')}</strong></div>
                <div><span>LONGITUDE</span><strong>{formatCoordinate(selectedSite.lon, 'E', 'W')}</strong></div>
              </div>
              <p className="atlas-site-description">{selectedSite.desc ?? 'Coordinates are included in the local site catalogue.'}</p>
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
            <div className="atlas-panel-heading"><Orbit size={13} /> NEAREST LISTED SITES</div>
            {includeGeometry && nearestSites.map((site) => (
              <button key={site.id} className="atlas-related-row" onClick={() => { setSelectedGlobeSite(null); setSelectedSiteId(site.id); setShowSiteList(false); }}>
                <span className="atlas-related-marker"><MapPin size={14} /></span>
                <span className="atlas-related-copy"><strong>{site.name}</strong><small>{formatCoordinate(site.lat, 'N', 'S')} · {formatCoordinate(site.lon, 'E', 'W')}</small></span>
                <b>{Math.round(site.distance).toLocaleString()} km</b>
              </button>
            ))}
          </section>

          <section className="atlas-panel atlas-star-panel">
            <div className="atlas-panel-heading"><Star size={13} /> STAR CATALOGUE <span className="atlas-panel-count">{REAL_CELESTIAL_STARS.length} RECORDS</span></div>
            {includeStars ? REAL_CELESTIAL_STARS.slice(0, 4).map((star) => (
              <div className="atlas-star-row" key={star.id}><span className="star-spark">✦</span><span><strong>{star.name}</strong><small>{star.constellation}</small></span><b>{star.distLy.toLocaleString()} ly</b></div>
            )) : <div className="atlas-no-data">Star catalogue is excluded by the current search filters.</div>}
            <div className="atlas-footnote">Star catalogue coordinates and distances are reference data; a site alignment requires a dated sky calculation and verified architectural axis.</div>
          </section>
        </aside>
      </div>

      <footer className="atlas-bottom">
        <section className="atlas-bottom-panel atlas-live-data">
          <div className="atlas-bottom-heading"><Activity size={13} /> LOCAL DATA STATUS</div>
          <div className="atlas-metric-grid">
            <div><span>EARTH SITES</span><strong>{DEFAULT_EARTH_POINTS.length}</strong></div>
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
          <button className="atlas-secondary-button" onClick={() => { setSearchText(''); setShowSiteList(false); setScanRequested(false); setSelectedSiteId(DEFAULT_EARTH_POINTS[0]?.id ?? ''); }}>RESET SEARCH</button>
        </section>
      </footer>
      <div className="atlas-tagline">THE PAST LEAVES SIGNALS — WE FIND THEM <span>· EVIDENCE FIRST · HYPOTHESES LABELLED</span></div>
    </main>
  );
}
