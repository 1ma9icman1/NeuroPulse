import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, AlertTriangle, CalendarClock, CircleDot, ExternalLink, Play, RefreshCw, Satellite, Sun, TimerReset, Zap } from 'lucide-react';

type Row = Record<string, unknown>;
type SolarEvent = {
  id: string; beginMs: number; peakMs?: number; classType: string;
  location?: string; source: 'NOAA GOES' | 'NASA DONKI' | 'Historical reconstruction'; link?: string;
};
type Planet = { name: string; au: number; period: number; radius: number; size: number; color: string; phase: number; tilt: number };

const NOAA_XRAY = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json';
const NOAA_FLARES = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json';
const NOAA_KP = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const NOAA_PROTONS = 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-plot-6-hour.json';
const DONKI = 'https://api.nasa.gov/DONKI/FLR';
const LIGHT_SECONDS_PER_AU = 499.0048;
const MAX_AU = 30.1;
const MAX_REPLAY_SECONDS = LIGHT_SECONDS_PER_AU * MAX_AU;
// Historical anchor: Carrington observed the white-light flare on 1 September 1859.
// The time is an approximate UTC mapping of the reported observation time, not instrument data.
const CARRINGTON_EVENT: SolarEvent = {
  id: 'historical-carrington-1859',
  beginMs: Date.parse('1859-09-01T11:18:00Z'),
  classType: 'CARRINGTON EVENT',
  location: 'Sunspot group observed by Richard Carrington',
  source: 'Historical reconstruction',
};
const CX = 485;
const CY = 286;
const YSCALE = 0.72;
const PLANETS: Planet[] = [
  { name: 'MERCURY', au: .387, period: 87.969, radius: 54, size: 3.5, color: '#aaa9a7', phase: .3, tilt: -5 },
  { name: 'VENUS', au: .723, period: 224.701, radius: 84, size: 5, color: '#e6c18a', phase: 2.1, tilt: 4 },
  { name: 'EARTH', au: 1, period: 365.256, radius: 116, size: 6.4, color: '#47b9ff', phase: 4.2, tilt: -2 },
  { name: 'MARS', au: 1.524, period: 686.98, radius: 153, size: 4.8, color: '#ff825b', phase: 1.3, tilt: 3 },
  { name: 'JUPITER', au: 5.203, period: 4332.59, radius: 210, size: 10, color: '#d7b18b', phase: 5.2, tilt: -3 },
  { name: 'SATURN', au: 9.537, period: 10759.2, radius: 273, size: 8.5, color: '#e5d19c', phase: 3.3, tilt: 2 },
  { name: 'URANUS', au: 19.191, period: 30688.5, radius: 338, size: 7, color: '#93e6e8', phase: .9, tilt: -2 },
  { name: 'NEPTUNE', au: 30.07, period: 60182, radius: 400, size: 7, color: '#5d8bff', phase: 2.7, tilt: 3 },
];

function n(...values: unknown[]): number | null {
  for (const value of values) {
    const result = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    if (Number.isFinite(result)) return result;
  }
  return null;
}
function s(...values: unknown[]): string {
  const value = values.find((item) => typeof item === 'string' && item.trim());
  return value ? String(value).trim() : '';
}
function time(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
    if (typeof value === 'string' && value.trim()) {
      const result = Date.parse(value);
      if (Number.isFinite(result)) return result;
    }
  }
  return 0;
}
function rowsOf(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === 'object') : [];
}
function rowTime(row: Row): number {
  return time(row.time_tag, row.timeTag, row.timestamp, row.observed_at, row.time, row.date);
}
function latest(rows: Row[], predicate?: (row: Row) => boolean): Row | undefined {
  return rows.filter((row) => n(row.flux, row.value, row.kp_index, row.kp, row.estimated_kp) !== null && (!predicate || predicate(row)))
    .sort((a, b) => rowTime(b) - rowTime(a))[0];
}
function classFromFlux(flux: number | null): string {
  if (flux === null || flux < 1e-8) return 'A / background';
  if (flux >= 1e-4) return 'X' + (flux / 1e-4).toFixed(1);
  if (flux >= 1e-5) return 'M' + (flux / 1e-5).toFixed(1);
  if (flux >= 1e-6) return 'C' + (flux / 1e-6).toFixed(1);
  if (flux >= 1e-7) return 'B' + (flux / 1e-7).toFixed(1);
  return 'A' + (flux / 1e-8).toFixed(1);
}
function stamp(ms: number): string {
  if (!ms) return 'timestamp unavailable';
  return new Date(ms).toLocaleString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';
}
function dayString(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }
function addDays(day: string, amount: number): string { return dayString(Date.parse(day + 'T00:00:00Z') + amount * 86400000); }
function noaaEvent(row: Row, i: number): SolarEvent | null {
  const beginMs = time(row.begin_time, row.beginTime, row.begin_time_utc, row.start_time, row.time_tag, row.timeTag, row.timestamp);
  if (!beginMs) return null;
  return {
    id: 'noaa-' + (s(row.id, row.event_id, row.flrID, row.region) || (String(beginMs) + '-' + i)),
    beginMs, peakMs: time(row.max_time, row.peak_time, row.peakTime, row.maximum_time) || undefined,
    classType: s(row.max_class, row.current_class, row.class_type, row.classType, row.flare_class, row.max_xray_class, row.max_xrlong) || 'Class not supplied',
    location: s(row.loc, row.location, row.sourceLocation, row.source_location) || undefined,
    source: 'NOAA GOES', link: 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json',
  };
}
function nasaEvent(row: Row, i: number): SolarEvent | null {
  const beginMs = time(row.beginTime, row.begin_time, row.startTime);
  if (!beginMs) return null;
  return {
    id: 'nasa-' + (s(row.flrID, row.id) || (String(beginMs) + '-' + i)),
    beginMs, peakMs: time(row.peakTime, row.peak_time) || undefined,
    classType: s(row.classType, row.class_type, row.class) || 'Class not supplied',
    location: s(row.sourceLocation, row.source_location) || undefined,
    source: 'NASA DONKI', link: s(row.link) || 'https://api.nasa.gov/DONKI/FLR',
  };
}
function position(planet: Planet, days: number) {
  const angle = planet.phase + 2 * Math.PI * days / planet.period;
  const tilt = planet.tilt * Math.PI / 180;
  const x = planet.radius * Math.cos(angle);
  const y = planet.radius * YSCALE * Math.sin(angle);
  return { x: CX + x * Math.cos(tilt) - y * Math.sin(tilt), y: CY + x * Math.sin(tilt) + y * Math.cos(tilt) };
}
function radiusAtAu(au: number): number {
  const value = Math.max(0, Math.min(MAX_AU, au));
  let last = { au: 0, radius: 0 };
  for (const planet of PLANETS) {
    if (value <= planet.au) {
      const part = (value - last.au) / (planet.au - last.au || 1);
      return last.radius + (planet.radius - last.radius) * part;
    }
    last = { au: planet.au, radius: planet.radius };
  }
  return PLANETS[PLANETS.length - 1].radius;
}
function fluxText(value: number | null): string { return value === null ? '—' : value.toExponential(2); }

export function SolarFlareEarth({ onBack }: { onBack: () => void }) {
  const [xrayRows, setXrayRows] = useState<Row[]>([]);
  const [protonRows, setProtonRows] = useState<Row[]>([]);
  const [kpRows, setKpRows] = useState<Row[]>([]);
  const [noaaEvents, setNoaaEvents] = useState<SolarEvent[]>([]);
  const [nasaEvents, setNasaEvents] = useState<SolarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [historyStart, setHistoryStart] = useState(dayString(Date.now() - 29 * 86400000));
  const [selectedId, setSelectedId] = useState(CARRINGTON_EVENT.id);
  const [orbitSpeed, setOrbitSpeed] = useState(6);
  const [playbackSpeed, setPlaybackSpeed] = useState(60);
  const [playing, setPlaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [replaying, setReplaying] = useState(true);
  const [orbitDays, setOrbitDays] = useState(Date.now() / 86400000);
  const [dockTarget, setDockTarget] = useState<HTMLElement | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [focusedPlanet, setFocusedPlanet] = useState<string | null>(null);
  const lastTick = useRef(Date.now());

  useEffect(() => { setDockTarget(document.querySelector('.atlas-left')); }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const feeds = [
      { name: 'NOAA GOES X-ray', url: NOAA_XRAY, set: setXrayRows },
      { name: 'NOAA GOES proton', url: NOAA_PROTONS, set: setProtonRows },
      { name: 'NOAA planetary K-index', url: NOAA_KP, set: setKpRows },
    ];
    const results = await Promise.all(feeds.map(async (feed) => {
      try {
        const response = await fetch(feed.url, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = rowsOf(await response.json());
        feed.set(data);
        return data.length ? '' : feed.name + ': empty response';
      } catch (error) {
        return feed.name + ': ' + (error instanceof Error ? error.message : 'request failed');
      }
    }));
    try {
      const response = await fetch(NOAA_FLARES, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = rowsOf(await response.json());
      setNoaaEvents(data.map(noaaEvent).filter((event): event is SolarEvent => !!event));
      if (!data.length) results.push('NOAA flare catalogue: empty response');
    } catch (error) {
      results.push('NOAA flare catalogue: ' + (error instanceof Error ? error.message : 'request failed'));
    }
    setErrors(results.filter(Boolean));
    setLastRefresh(Date.now());
    setLoading(false);
    setNotice(results.every(Boolean) ? 'NOAA feeds are unavailable. No made-up readings will be shown.' : '');
  }, []);

  const loadHistory = useCallback(async (startDay: string) => {
    setHistoryLoading(true);
    const endDay = addDays(startDay, 29);
    try {
      const url = DONKI + '?startDate=' + encodeURIComponent(startDay) + '&endDate=' + encodeURIComponent(endDay) + '&api_key=DEMO_KEY';
      const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('NASA DONKI HTTP ' + response.status);
      const data = rowsOf(await response.json());
      setNasaEvents(data.map(nasaEvent).filter((event): event is SolarEvent => !!event));
      setNotice('');
    } catch (error) {
      setNotice('NASA history lookup failed: ' + (error instanceof Error ? error.message : 'request failed') + '. NOAA live feeds remain separate.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadHistory(dayString(Date.now() - 29 * 86400000));
    const id = window.setInterval(() => void refresh(), 60000);
    return () => window.clearInterval(id);
  }, [refresh, loadHistory]);

  useEffect(() => {
    lastTick.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, now - lastTick.current) / 1000;
      lastTick.current = now;
      setOrbitDays((days) => days + delta * orbitSpeed);
    }, 80);
    return () => window.clearInterval(id);
  }, [orbitSpeed]);

  const liveXray = useMemo(() => {
    const filtered = xrayRows.filter((row) => {
      const energy = s(row.energy, row.energy_channel, row.channel).toLowerCase();
      return !energy || energy.includes('0.1-0.8') || energy.includes('0.1 – 0.8') || energy.includes('long') || energy.includes('xl');
    });
    return latest(filtered) || latest(xrayRows);
  }, [xrayRows]);
  const liveProton = useMemo(() => latest(protonRows, (row) => {
    const energy = s(row.energy, row.energy_channel, row.channel).toLowerCase();
    return !energy || energy.includes('>=10') || energy.includes('>10') || energy.includes('10 mev') || energy.includes('p10');
  }) || latest(protonRows), [protonRows]);
  const liveKp = useMemo(() => latest(kpRows), [kpRows]);
  const xrayFlux = n(liveXray?.flux, liveXray?.value);
  const protonFlux = n(liveProton?.flux, liveProton?.value);
  const kp = n(liveKp?.kp_index, liveKp?.kp, liveKp?.estimated_kp, liveKp?.value);
  const xrayTime = rowTime(liveXray || {});
  const events = useMemo(() => {
    const merged = [CARRINGTON_EVENT, ...noaaEvents, ...nasaEvents].sort((a, b) => b.beginMs - a.beginMs);
    const distinct: SolarEvent[] = [];
    merged.forEach((event) => {
      const duplicate = distinct.findIndex((other) => Math.abs(other.beginMs - event.beginMs) < 8 * 60000 &&
        (other.classType === event.classType || other.classType === 'Class not supplied' || event.classType === 'Class not supplied'));
      if (duplicate < 0) distinct.push(event);
      else if (event.source === 'NASA DONKI' && distinct[duplicate].source !== 'NASA DONKI') distinct[duplicate] = event;
    });
    return distinct.sort((a, b) => b.beginMs - a.beginMs);
  }, [noaaEvents, nasaEvents]);
  useEffect(() => {
    if (!events.some((event) => event.id === selectedId)) setSelectedId(CARRINGTON_EVENT.id);
  }, [events, selectedId]);

  const selected = events.find((event) => event.id === selectedId);
  const flareStrength = xrayFlux === null ? 0 : Math.max(0, Math.min(1, (Math.log10(Math.max(xrayFlux, 1e-9)) + 9) / 5));
  const liveFront = xrayFlux !== null && xrayFlux >= 1e-7;
  // GOES records X-rays near Earth; use the observation timestamp as the 1-AU crossing time,
  // then advance that observed photon front at c instead of inventing a CME speed.
  const liveFrontAu = Math.min(MAX_AU, 1 + Math.max(0, Date.now() - xrayTime) / 1000 / LIGHT_SECONDS_PER_AU);
  const elapsed = replayProgress / 1000 * MAX_REPLAY_SECONDS;
  const replayAu = Math.min(MAX_AU, elapsed / LIGHT_SECONDS_PER_AU);
  const frontRadius = replaying ? radiusAtAu(replayAu) : liveFront ? radiusAtAu(liveFrontAu) : 0;
  const feedCount = [xrayRows, protonRows, kpRows].filter((data) => data.length > 0).length;
  const feedStatus = loading && lastRefresh === null ? 'CONNECTING' : feedCount === 3 ? 'NOAA LIVE' : feedCount ? 'PARTIAL DATA' : 'FEED OFFLINE';

  useEffect(() => {
    if (!playing || !selected) return;
    let previous = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, now - previous) / 1000;
      previous = now;
      setReplayProgress((progress) => {
        const next = Math.min(1000, progress + delta * playbackSpeed / MAX_REPLAY_SECONDS * 1000);
        if (next >= 1000) setPlaying(false);
        return next;
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [playing, playbackSpeed, selected]);

  const selectEvent = (event: SolarEvent) => {
    setSelectedId(event.id);
    setReplayProgress(0);
    setReplaying(true);
    setPlaying(false);
  };
  const togglePlay = () => {
    if (!selected) return;
    if (replayProgress >= 1000) setReplayProgress(0);
    setReplaying(true);
    setPlaying((value) => !value);
  };
  const backToLive = () => {
    setPlaying(false);
    setReplaying(false);
    setReplayProgress(0);
  };
  const planets = PLANETS.map((planet) => ({ ...planet, ...position(planet, orbitDays) }));
  const focused = planets.find((planet) => planet.name === focusedPlanet);
  const closeView = !!focusedPlanet && mapZoom > 1;
  const viewWidth = 1000 / mapZoom;
  const viewHeight = 600 / mapZoom;
  const viewX = focused ? focused.x - viewWidth / 2 : (1000 - viewWidth) / 2;
  const viewY = focused ? focused.y - viewHeight / 2 : (600 - viewHeight) / 2;
  const flareHasReachedEarth = frontRadius >= PLANETS.find((planet) => planet.name === 'EARTH')!.radius;
  const stateClass = feedCount === 3 ? 'online' : feedCount ? 'partial' : 'offline';

  return (
    <>
    <section className="solar-flare-earth-view" aria-label="Solar Flare Earth solar system map">
      <div className="solar-earth-toolbar">
        <div className="solar-earth-title">
          <span className="solar-earth-icon"><Sun size={17} /></span>
          <div><div className="solar-earth-kicker">NEUROPULSE / LIVE HELIOPHYSICS</div><h2>SOLAR FLARE EARTH</h2></div>
        </div>
        <div className={'solar-earth-feed solar-earth-feed-' + stateClass}><i />{feedStatus}<span>·</span>{lastRefresh ? new Date(lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Awaiting first sample'}</div>
        <button type="button" className="solar-earth-refresh" onClick={onBack} title="Return to the Earth views">← EARTH VIEWS</button>
        <button type="button" className="solar-earth-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={13} className={loading ? 'solar-earth-spin' : ''} />{loading ? 'SYNCING' : 'SYNC NOAA'}</button>
      </div>

      <div className="solar-earth-metrics">
        <div className="solar-earth-metric"><span><Zap size={12} /> GOES X-RAY</span><strong>{fluxText(xrayFlux)}</strong><small>{classFromFlux(xrayFlux)} · W/m²</small></div>
        <div className="solar-earth-metric"><span><Activity size={12} /> PLANETARY K</span><strong>{kp === null ? '—' : kp.toFixed(1) + ' / 9'}</strong><small>{kp === null ? 'No current sample' : kp >= 5 ? 'Storm threshold ≥ 5' : kp >= 4 ? 'Elevated activity' : 'Quiet to unsettled'}</small></div>
        <div className="solar-earth-metric"><span><Satellite size={12} /> PROTON FLUX</span><strong>{fluxText(protonFlux)}</strong><small>{liveProton ? s(liveProton.energy, liveProton.energy_channel, liveProton.channel, 'Energy channel') : 'Energy channel unavailable'}</small></div>
        <div className="solar-earth-metric"><span><CircleDot size={12} /> FLARE EVENTS</span><strong>{events.length}</strong><small>{noaaEvents.length} NOAA · {nasaEvents.length} NASA records</small></div>
      </div>

      <div className="solar-earth-mapframe"
        onWheel={(event) => { event.preventDefault(); event.stopPropagation(); setMapZoom(value => Math.max(1, Math.min(18, Number((value + (event.deltaY < 0 ? (value < 3 ? 0.25 : value < 8 ? 0.75 : 1.5) : -(value < 3 ? 0.25 : value < 8 ? 0.75 : 1.5))).toFixed(2)))); }}
      >
        <div className="solar-earth-view-controls" aria-label="Solar system view controls">
          <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setMapZoom(value => Math.min(18, Number((value + (value < 3 ? 0.25 : value < 8 ? 0.75 : 1.5)).toFixed(2))))}>＋</button>
          <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setMapZoom(value => { const next = Math.max(1, Number((value - (value < 3 ? 0.25 : value < 8 ? 0.75 : 1.5)).toFixed(2))); if (next === 1) setFocusedPlanet(null); return next; })}>−</button>
          <button type="button" title="Reset zoom" aria-label="Reset zoom" onClick={() => { setMapZoom(1); setFocusedPlanet(null); }}>RESET ZOOM</button>
          <span>{Math.round(mapZoom * 100)}%{focusedPlanet ? ' · ' + focusedPlanet : ' · SELECT A PLANET'}</span>
        </div>
        <svg className="solar-earth-svg" viewBox={viewX + ' ' + viewY + ' ' + viewWidth + ' ' + viewHeight} role="img" aria-label="Interactive solar system. Scroll to zoom. Select any planet to inspect it close-up.">
          <defs>
            <radialGradient id="se-sun-fill"><stop offset="0" stopColor="#fff8c4" /><stop offset=".28" stopColor="#ffd66c" /><stop offset=".63" stopColor="#ff8c32" /><stop offset="1" stopColor="#df3e12" /></radialGradient>
            <radialGradient id="se-space-fill"><stop offset="0" stopColor="#081d34" /><stop offset="1" stopColor="#020713" /></radialGradient>
            <radialGradient id="se-planet-mercury"><stop offset="0" stopColor="#c5c1b8"/><stop offset=".65" stopColor="#77756f"/><stop offset="1" stopColor="#272b31"/></radialGradient>
            <radialGradient id="se-planet-venus"><stop offset="0" stopColor="#fff0bc"/><stop offset=".42" stopColor="#d6a76c"/><stop offset=".76" stopColor="#a96c3d"/><stop offset="1" stopColor="#39251f"/></radialGradient>
            <radialGradient id="se-planet-earth"><stop offset="0" stopColor="#61d7ff"/><stop offset=".34" stopColor="#1d8bd0"/><stop offset=".58" stopColor="#21835e"/><stop offset=".8" stopColor="#0b416f"/><stop offset="1" stopColor="#06152e"/></radialGradient>
            <radialGradient id="se-planet-mars"><stop offset="0" stopColor="#ffbd82"/><stop offset=".48" stopColor="#c65332"/><stop offset=".8" stopColor="#7b3027"/><stop offset="1" stopColor="#28171d"/></radialGradient>
            <radialGradient id="se-planet-jupiter"><stop offset="0" stopColor="#f3d9b2"/><stop offset=".3" stopColor="#c79c77"/><stop offset=".52" stopColor="#ead3ae"/><stop offset=".7" stopColor="#9b6b4e"/><stop offset=".86" stopColor="#d7b28d"/><stop offset="1" stopColor="#49332b"/></radialGradient>
            <radialGradient id="se-planet-saturn"><stop offset="0" stopColor="#f4e4b8"/><stop offset=".5" stopColor="#d4ba81"/><stop offset=".82" stopColor="#a08a61"/><stop offset="1" stopColor="#453a2b"/></radialGradient>
            <radialGradient id="se-planet-uranus"><stop offset="0" stopColor="#b4fbff"/><stop offset=".6" stopColor="#69c8d0"/><stop offset="1" stopColor="#183b54"/></radialGradient>
            <radialGradient id="se-planet-neptune"><stop offset="0" stopColor="#77baff"/><stop offset=".55" stopColor="#2862c7"/><stop offset="1" stopColor="#101b4a"/></radialGradient>
            <radialGradient id="se-planet-moon"><stop offset="0" stopColor="#d9d9d4"/><stop offset=".6" stopColor="#8b8d91"/><stop offset="1" stopColor="#282c34"/></radialGradient>
            <filter id="se-earth-impact-glow" x="-500%" y="-500%" width="1000%" height="1000%"><feGaussianBlur stdDeviation="5" result="blur"/><feFlood floodColor="#ff1717" floodOpacity=".95"/><feComposite in2="blur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="se-sun-glow" x="-300%" y="-300%" width="600%" height="600%"><feGaussianBlur stdDeviation="12" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <pattern id="se-starfield" width="155" height="119" patternUnits="userSpaceOnUse"><circle cx="12" cy="16" r=".8" fill="#78b9e9" opacity=".6" /><circle cx="85" cy="39" r=".65" fill="#fff" opacity=".52" /><circle cx="132" cy="94" r=".7" fill="#7dcaff" opacity=".48" /><circle cx="41" cy="101" r=".45" fill="#fff" opacity=".45" /></pattern>
          </defs>
          <rect width="1000" height="600" fill="url(#se-space-fill)" /><rect width="1000" height="600" fill="url(#se-starfield)" opacity=".85" />
          <path d={'M ' + CX + ' 0 V 600 M 0 ' + CY + ' H 1000'} stroke="#2b74a4" strokeWidth=".7" strokeDasharray="2 8" opacity=".14" />
          <g className="solar-earth-orbits">{PLANETS.map((planet) => <ellipse key={planet.name} cx={CX} cy={CY} rx={planet.radius} ry={planet.radius * YSCALE} fill="none" stroke={planet.name === 'EARTH' ? '#2a83be' : '#23506b'} strokeWidth={planet.name === 'EARTH' ? '1.15' : '.85'} strokeOpacity={planet.name === 'EARTH' ? '.8' : '.48'} />)}</g>

          {frontRadius > 0 && <g className={replaying ? 'solar-earth-front solar-earth-front-replay' : 'solar-earth-front solar-earth-front-live'}>
            <ellipse cx={CX} cy={CY} rx={frontRadius} ry={frontRadius * YSCALE} fill="none" stroke={replaying ? '#ffcf69' : '#43d7ff'} strokeWidth={replaying ? '2.1' : '1.4'} strokeDasharray={replaying ? '4 6' : '2 7'} opacity=".95" />
            <ellipse cx={CX} cy={CY} rx={Math.max(3, frontRadius - 6)} ry={Math.max(3, frontRadius - 6) * YSCALE} fill="none" stroke={replaying ? '#ff8f45' : '#43d7ff'} strokeWidth=".65" opacity=".4" />
          </g>}

          <g className="solar-earth-solar-activity">
            {Array.from({ length: 10 }, (_, index) => {
              const angle = index * Math.PI * 2 / 10 + orbitDays * .007;
              const length = 22 + flareStrength * 64 + (index % 3) * 7;
              const x1 = CX + Math.cos(angle) * 18;
              const y1 = CY + Math.sin(angle) * 18;
              const x2 = CX + Math.cos(angle + .11) * (length + 15);
              const y2 = CY + Math.sin(angle + .11) * (length * .78 + 15);
              const mx = (x1 + x2) / 2 + Math.cos(angle + 1.2) * 18;
              const my = (y1 + y2) / 2 + Math.sin(angle + 1.2) * 18;
              return <path key={index} d={'M ' + x1 + ' ' + y1 + ' Q ' + mx + ' ' + my + ' ' + x2 + ' ' + y2} className="solar-earth-flare-ribbon" style={{ opacity: flareStrength * .85, animationDelay: (-index * .21) + 's' }} />;
            })}
            <circle cx={CX} cy={CY} r={20 + flareStrength * 5} fill="url(#se-sun-fill)" filter="url(#se-sun-glow)" />
            <circle cx={CX} cy={CY} r="13" fill="url(#se-sun-fill)" />
            <text x={CX} y={CY + 39} textAnchor="middle" className="solar-earth-sun-label">THE SUN</text>
          </g>

          {planets.map((planet) => <g key={planet.name} className={'solar-earth-planet solar-earth-planet-' + planet.name.toLowerCase()} role="button" tabIndex={0} aria-label={'Zoom to ' + planet.name} onClick={() => { setFocusedPlanet(planet.name); setMapZoom(planet.name === 'EARTH' || planet.name === 'MARS' || planet.name === 'VENUS' ? 12 : 8); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFocusedPlanet(planet.name); setMapZoom(planet.name === 'EARTH' || planet.name === 'MARS' || planet.name === 'VENUS' ? 12 : 8); } }}>
            <circle cx={planet.x} cy={planet.y} r={planet.size + (planet.name === 'EARTH' ? 7 : 4)} fill={planet.color} opacity={planet.name === 'EARTH' ? '.12' : '.07'} />
            {planet.name === 'SATURN' && <ellipse cx={planet.x} cy={planet.y} rx={planet.size * 1.9} ry={planet.size * .62} transform={'rotate(-18 ' + planet.x + ' ' + planet.y + ')'} fill="none" stroke="#d9c38d" strokeWidth="2" opacity=".9" />}
            <circle cx={planet.x} cy={planet.y} r={planet.size} fill={'url(#se-planet-' + planet.name.toLowerCase() + ')'} stroke={flareHasReachedEarth && planet.name === 'EARTH' ? '#ff342f' : planet.name === 'EARTH' ? '#c3f2ff' : '#d5e6f3'} strokeWidth={flareHasReachedEarth && planet.name === 'EARTH' ? '2.5' : planet.name === 'EARTH' ? '1.2' : '.45'} className={flareHasReachedEarth && planet.name === 'EARTH' ? 'solar-earth-hit-by-flare' : ''} filter={flareHasReachedEarth && planet.name === 'EARTH' ? 'url(#se-earth-impact-glow)' : undefined} />
            {planet.name === 'EARTH' && <><path d={'M ' + (planet.x - 3.2) + ' ' + (planet.y - 1.6) + ' l 2 -2.5 2.4 1 -1.4 2.4 2.5 2 -3.5 1.2 z'} fill="#45d5a2" /><circle cx={planet.x} cy={planet.y} r="11" fill="none" stroke={flareHasReachedEarth ? '#ff342f' : '#73dfff'} strokeWidth={flareHasReachedEarth ? '1.8' : '.8'} className={flareHasReachedEarth ? 'solar-earth-hit-pulse' : 'solar-earth-earth-pulse'} />
              <circle cx={planet.x + 10} cy={planet.y - 7} r="1.7" fill="#aeb6c2" stroke="#e3e7ee" strokeWidth=".35" /><ellipse cx={planet.x} cy={planet.y} rx="15" ry="15" fill="none" stroke="#a7c2d5" strokeWidth=".5" opacity=".25" /></>}
            <text x={planet.x} y={planet.y - planet.size - (planet.name === 'JUPITER' || planet.name === 'SATURN' ? 13 : 10)} className={planet.name === 'EARTH' ? 'solar-earth-planet-label solar-earth-label-earth' : 'solar-earth-planet-label'} textAnchor="middle">{planet.name}</text>
          </g>)}

          <text x={CX + PLANETS[2].radius + 10} y={CY - 17} className="solar-earth-distance-note">1 AU · 8m 19s light</text>
          <text x={CX + 8} y="27" className="solar-earth-map-caption">{closeView ? focusedPlanet + ' CLOSE VIEW' : 'HELIOCENTRIC VIEW / ORBITAL PLANE'}</text>
          <text x="18" y="579" className="solar-earth-map-small">ORBIT SPEED: {orbitSpeed} SIMULATED DAYS / SECOND</text>
          <text x="982" y="579" textAnchor="end" className="solar-earth-map-small">{replaying ? 'REPLAY FRONT: ' + replayAu.toFixed(2) + ' AU' : liveFront ? 'LIVE OBSERVED X-RAY FRONT: ' + liveFrontAu.toFixed(2) + ' AU' : 'LIVE MODE · WAITING FOR B-CLASS OR STRONGER X-RAYS'}</text>
          {replaying && selected && <text x={CX + 28} y={CY + 26} className="solar-earth-selected-event-label">{selected.classType.toUpperCase()} · {replayAu.toFixed(2)} AU</text>}
        </svg>

      </div>
    </section>
    {dockTarget && createPortal(
      <div className="solar-earth-left-dock" aria-label="Solar flare event controls and history">
        <div className="solar-earth-left-dock-title"><Sun size={14} /> SOLAR FLARE CONTROLS</div>
        <div className="solar-earth-map-key"><span><i className="se-key-sun" /> NOAA X-ray flux drives solar glow</span><span><i className="se-key-wave" /> X-ray light-front at c</span><span><i className="se-key-orbit" /> Schematic tracks / accelerated periods</span></div>
        <div className="solar-earth-playback">
          <div className="solar-earth-playback-top">
            <div className="solar-earth-current-event"><span className="solar-earth-live-lamp" /><div><strong>{replaying && selected ? 'REPLAY · ' + selected.classType + ' SOLAR FLARE' : 'LIVE SOLAR OBSERVATIONS'}</strong><small>{replaying && selected ? stamp(selected.beginMs) + ' · estimated solar emission 8m 19s earlier' : stamp(xrayTime) + ' · GOES measures X-rays near Earth'}</small></div></div>
            <div className="solar-earth-playback-actions">
              <button type="button" className={playing ? 'se-action se-action-hot' : 'se-action'} onClick={togglePlay} disabled={!selected}><Play size={12} />{playing ? 'PAUSE' : 'PLAY EVENT'}</button>
              <button type="button" className="se-action" onClick={() => { setPlaying(false); setReplaying(false); setReplayProgress(0); }}><TimerReset size={12} />LIVE</button>
            </div>
          </div>
          <div className="solar-earth-timeline-row">
            <span>{replaying ? 'LIGHT TRAVEL' : 'ORBIT SPEED'}</span>
            {replaying ? <input aria-label="Solar flare propagation replay position" type="range" min="0" max="1000" value={replayProgress} onChange={(event) => { setReplayProgress(Number(event.target.value)); setPlaying(false); setReplaying(true); }} /> : <input aria-label="Solar system orbit speed" type="range" min="1" max="30" value={orbitSpeed} onChange={(event) => setOrbitSpeed(Number(event.target.value))} />}
            <select aria-label="Solar flare replay speed" value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))}><option value={1}>1× REAL TIME</option><option value={60}>60× PLAYBACK</option><option value={300}>300× PLAYBACK</option><option value={600}>600× PLAYBACK</option></select>
            <span className="solar-earth-timeline-time">{replaying ? (elapsed / 60).toFixed(1) + ' min / 4.2 hr' : orbitSpeed + ' days / sec'}</span>
          </div>
        </div>
        <div className="solar-earth-history">
          <div className="solar-earth-history-toolbar">
            <div><div className="solar-earth-kicker"><CalendarClock size={12} /> EVENT HISTORY / MEASURED + HISTORICAL</div><strong>{events.length} events loaded</strong><small>Carrington Event (1859) reconstruction + NOAA GOES / NASA DONKI records</small></div>
            <label>Start date <input type="date" value={historyStart} onChange={(event) => setHistoryStart(event.target.value)} /></label>
            <button type="button" className="solar-earth-history-load" onClick={() => void loadHistory(historyStart)} disabled={historyLoading}><RefreshCw size={12} className={historyLoading ? 'solar-earth-spin' : ''} />{historyLoading ? 'LOADING' : 'LOAD 30 DAYS'}</button>
          </div>
          <div className="solar-earth-event-list">
            {[CARRINGTON_EVENT, ...events.filter((event) => event.id !== CARRINGTON_EVENT.id).slice(0, 23)].map((event) => <button type="button" key={event.id} onClick={() => selectEvent(event)} className={selectedId === event.id ? 'solar-earth-event-chip solar-earth-event-chip-selected' : 'solar-earth-event-chip'} title={stamp(event.beginMs) + ' · ' + event.source}>
              <span className="solar-earth-event-class">{event.classType}</span><strong>{stamp(event.beginMs)}</strong><small>{event.source}{event.location ? ' · ' + event.location : ''}</small>
            </button>)}
            {!events.length && <div className="solar-earth-empty">{historyLoading || loading ? 'Loading measured flare records…' : 'No flare events returned for this period. Try another date window.'}</div>}
          </div>
        </div>
        {(notice || errors.length > 0) && <div className="solar-earth-notice"><AlertTriangle size={12} /><span>{notice || errors.join(' · ')}</span></div>}
        <div className="solar-earth-footnote">
          <span>DATA: <a href="https://services.swpc.noaa.gov/json/" target="_blank" rel="noreferrer">NOAA SWPC JSON</a> · <a href="https://api.nasa.gov/" target="_blank" rel="noreferrer">NASA DONKI</a></span>
          <span>{selected ? <><a href={selected.link || 'https://api.nasa.gov/DONKI/FLR'} target="_blank" rel="noreferrer">{selected.source} source <ExternalLink size={10} /></a> · {selected.location || 'source location not supplied'}</> : 'No event selected'}</span>
          <span>Carrington entry is a historical reconstruction, not measured GOES data. Schematic light-front uses AU light travel; CME speed is not inferred.</span>
        </div>
      </div>,
      dockTarget
    )}
    </>
  );
}
