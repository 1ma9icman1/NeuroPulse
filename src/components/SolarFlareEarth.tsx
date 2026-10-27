import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, AlertTriangle, CalendarClock, CircleDot, ExternalLink, Play, RefreshCw, Satellite, Sun, TimerReset, Zap } from 'lucide-react';

type Row = Record<string, unknown>;
type SolarEvent = {
  id: string; beginMs: number; peakMs?: number; classType: string;
  location?: string; source: 'NOAA GOES' | 'NASA DONKI' | 'Historical reconstruction'; link?: string;
};
type Planet = { name: string; au: number; period: number; radius: number; size: number; color: string };
type OrbitElements = {
  a: number; e: number; i: number; L: number; peri: number; node: number;
  aRate: number; eRate: number; iRate: number; LRate: number; periRate: number; nodeRate: number;
};

const NOAA_XRAY = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json';
const NOAA_FLARES = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json';
const NOAA_KP = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const NOAA_PROTONS = 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-plot-6-hour.json';
const NOAA_EUV_IMAGE = (wavelength: string) => 'https://services.swpc.noaa.gov/images/animations/suvi/primary/' + wavelength + '/latest.png';
const NOAA_CORONA_IMAGE = 'https://services.swpc.noaa.gov/images/animations/ccor1/latest.png';
const NOAA_AURORA_IMAGE = 'https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg';
const NOAA_SPACE_WEATHER = 'https://www.spaceweather.gov/';

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
  { name: 'MERCURY', au: .387099, period: 87.969, radius: 54, size: 3.5, color: '#aaa9a7' },
  { name: 'VENUS', au: .723336, period: 224.701, radius: 84, size: 5, color: '#e6c18a' },
  { name: 'EARTH', au: 1.000003, period: 365.256, radius: 116, size: 6.4, color: '#47b9ff' },
  { name: 'MARS', au: 1.523710, period: 686.980, radius: 153, size: 4.8, color: '#ff825b' },
  { name: 'JUPITER', au: 5.202887, period: 4332.59, radius: 210, size: 10, color: '#d7b18b' },
  { name: 'SATURN', au: 9.536676, period: 10759.2, radius: 273, size: 8.5, color: '#e5d19c' },
  { name: 'URANUS', au: 19.189165, period: 30688.5, radius: 338, size: 7, color: '#93e6e8' },
  { name: 'NEPTUNE', au: 30.069923, period: 60182, radius: 400, size: 7, color: '#5d8bff' },
];

// Sidereal axial rotation periods in hours; negative values indicate retrograde rotation.
const PLANET_ROTATION_HOURS: Record<string, number> = {
  MERCURY: 1407.6,
  VENUS: -5832.5,
  EARTH: 23.934,
  MARS: 24.623,
  JUPITER: 9.925,
  SATURN: 10.656,
  URANUS: -17.24,
  NEPTUNE: 16.11,
};

const PLANET_TEXTURE_URLS: Record<string, string> = {
  MERCURY: 'https://www.solarsystemscope.com/textures/download/2k_mercury.jpg',
  VENUS: 'https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg',
  EARTH: 'https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg',
  MARS: 'https://www.solarsystemscope.com/textures/download/2k_mars.jpg',
  JUPITER: 'https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg',
  SATURN: 'https://www.solarsystemscope.com/textures/download/2k_saturn.jpg',
  URANUS: 'https://www.solarsystemscope.com/textures/download/2k_uranus.jpg',
  NEPTUNE: 'https://www.solarsystemscope.com/textures/download/2k_neptune.jpg',
  MOON: 'https://www.solarsystemscope.com/textures/download/2k_moon.jpg',
};

// J2000 heliocentric orbital elements and secular rates (per Julian century).
// Mean longitude and perihelion/node evolution keep phases tied to the UTC clock.
// The display uses schematic planet spacing, but orbital timing and directions are date-based.
const ORBIT_ELEMENTS: Record<string, OrbitElements> = {
  MERCURY: { a:.38709927, e:.20563593, i:7.00497902, L:252.25032350, peri:77.45779628, node:48.33076593, aRate:.00000037, eRate:.00001906, iRate:-.00594749, LRate:149472.67411175, periRate:.16047689, nodeRate:-.12534081 },
  VENUS:   { a:.72333566, e:.00677672, i:3.39467605, L:181.97909950, peri:131.60246718, node:76.67984255, aRate:.00000390, eRate:-.00004107, iRate:-.00078890, LRate:58517.81538729, periRate:.00268329, nodeRate:-.27769418 },
  EARTH:   { a:1.00000261, e:.01671123, i:-.00001531, L:100.46457166, peri:102.93768193, node:0, aRate:.00000562, eRate:-.00004392, iRate:-.01294668, LRate:35999.37244981, periRate:.32327364, nodeRate:0 },
  MARS:    { a:1.52371034, e:.09339410, i:1.84969142, L:-4.55343205, peri:-23.94362959, node:49.55953891, aRate:.00001847, eRate:.00007882, iRate:-.00813131, LRate:19140.30268499, periRate:.44441088, nodeRate:-.29257343 },
  JUPITER: { a:5.20288700, e:.04838624, i:1.30439695, L:34.39644051, peri:14.72847983, node:100.47390909, aRate:-.00011607, eRate:-.00013253, iRate:-.00183714, LRate:3034.74612775, periRate:.21252668, nodeRate:.20469106 },
  SATURN:  { a:9.53667594, e:.05386179, i:2.48599187, L:49.95424423, peri:92.59887831, node:113.66242448, aRate:-.00125060, eRate:-.00050991, iRate:.00193609, LRate:1222.49362201, periRate:-.41897216, nodeRate:-.28867794 },
  URANUS:  { a:19.18916464, e:.04725744, i:.77263783, L:313.23810451, peri:170.95427630, node:74.01692503, aRate:-.00196176, eRate:-.00004397, iRate:-.00242939, LRate:428.48202785, periRate:.40805281, nodeRate:.04240589 },
  NEPTUNE: { a:30.06992276, e:.00859048, i:1.77004347, L:-55.12002969, peri:44.96476227, node:131.78422574, aRate:.00026291, eRate:.00005105, iRate:.00035372, LRate:218.45945325, periRate:-.32241464, nodeRate:-.00508664 },
};
const JULIAN_DAY_UNIX_EPOCH = 2440587.5;
const J2000_JULIAN_DAY = 2451545.0;
const MS_PER_DAY = 86400000;
const MOON_DISPLAY_DISTANCE = 15.5;

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
function radians(degrees: number): number { return degrees * Math.PI / 180; }
function wrapDegrees(degrees: number): number { return ((degrees % 360) + 360) % 360; }
function julianCenturies(unixDays: number): number {
  return (JULIAN_DAY_UNIX_EPOCH + unixDays - J2000_JULIAN_DAY) / 36525;
}
function elementsAt(planet: Planet, unixDays: number) {
  const base = ORBIT_ELEMENTS[planet.name];
  const t = julianCenturies(unixDays);
  return {
    a: base.a + base.aRate * t,
    e: base.e + base.eRate * t,
    i: radians(base.i + base.iRate * t),
    L: base.L + base.LRate * t,
    peri: base.peri + base.periRate * t,
    node: base.node + base.nodeRate * t,
  };
}
function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let eccentricAnomaly = meanAnomaly;
  for (let i = 0; i < 10; i++) {
    const correction = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= correction;
    if (Math.abs(correction) < 1e-12) break;
  }
  return eccentricAnomaly;
}
function heliocentricPoint(planet: Planet, unixDays: number, meanAnomalyDegrees?: number) {
  const elements = elementsAt(planet, unixDays);
  const meanAnomaly = radians(meanAnomalyDegrees === undefined ? elements.L - elements.peri : meanAnomalyDegrees);
  const E = solveKepler(meanAnomaly, elements.e);
  const xOrbit = elements.a * (Math.cos(E) - elements.e);
  const yOrbit = elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(E);
  const argumentOfPerihelion = radians(elements.peri - elements.node);
  const cosW = Math.cos(argumentOfPerihelion);
  const sinW = Math.sin(argumentOfPerihelion);
  const cosNode = Math.cos(radians(elements.node));
  const sinNode = Math.sin(radians(elements.node));
  const cosI = Math.cos(elements.i);
  const xPlane = xOrbit * cosW - yOrbit * sinW;
  const yPlane = xOrbit * sinW + yOrbit * cosW;
  const x = xPlane * cosNode - yPlane * cosI * sinNode;
  const y = xPlane * sinNode + yPlane * cosI * cosNode;
  const z = yPlane * Math.sin(elements.i);
  return { x, y, z, a: elements.a, distanceAu: Math.sqrt(x * x + y * y + z * z) };
}
function position(planet: Planet, unixDays: number) {
  const point = heliocentricPoint(planet, unixDays);
  const scale = planet.radius / point.a;
  return { x: CX + point.x * scale, y: CY - point.y * scale * YSCALE, distanceAu: point.distanceAu };
}
function orbitalPath(planet: Planet, unixDays: number): string {
  const steps = 144;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const point = heliocentricPoint(planet, unixDays, i / steps * 360);
    const scale = planet.radius / point.a;
    points.push((i === 0 ? 'M ' : 'L ') + (CX + point.x * scale).toFixed(2) + ' ' + (CY - point.y * scale * YSCALE).toFixed(2));
  }
  return points.join(' ') + ' Z';
}
function moonPosition(earth: { x: number; y: number }, unixDays: number) {
  const T = julianCenturies(unixDays);
  const L = wrapDegrees(218.3164477 + 481267.88123421 * T);
  const D = radians(297.8501921 + 445267.1114034 * T);
  const M = radians(134.9633964 + 477198.8675055 * T);
  const sunM = radians(357.5291092 + 35999.0502909 * T);
  const F = radians(93.2720950 + 483202.0175233 * T);
  const lunarLongitude = L +
    6.289 * Math.sin(M) +
    1.274 * Math.sin(2 * D - M) +
    .658 * Math.sin(2 * D) +
    .214 * Math.sin(2 * M) -
    .186 * Math.sin(sunM) -
    .114 * Math.sin(2 * F);
  const lunarLatitude = 5.128 * Math.sin(F) + .280 * Math.sin(M + F) + .277 * Math.sin(M - F) + .173 * Math.sin(2 * D - F);
  const distanceKm = 385000.56 - 20905.4 * Math.cos(M) - 3699.1 * Math.cos(2 * D - M) - 2956.0 * Math.cos(2 * D) - 570.2 * Math.cos(2 * M);
  const angle = radians(lunarLongitude);
  const latitude = radians(lunarLatitude);
  const displayRadius = MOON_DISPLAY_DISTANCE * distanceKm / 384400;
  let dx = displayRadius * Math.cos(latitude) * Math.cos(angle);
  let dy = -displayRadius * Math.cos(latitude) * Math.sin(angle) * YSCALE;
  // The lunar orbit is inclined about 5.1° to Earth's orbital plane.
  const planeTilt = radians(-5.145);
  const x = earth.x + dx * Math.cos(planeTilt) - dy * Math.sin(planeTilt);
  const y = earth.y + dx * Math.sin(planeTilt) + dy * Math.cos(planeTilt);
  return { x, y, angle: wrapDegrees(lunarLongitude), distanceKm, latitude: lunarLatitude };
}
function earthSiderealRotation(unixDays: number): number {
  const jd = JULIAN_DAY_UNIX_EPOCH + unixDays;
  return wrapDegrees(280.46061837 + 360.98564736629 * (jd - J2000_JULIAN_DAY));
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
  const [realTimeOrbit, setRealTimeOrbit] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(60);
  const [playing, setPlaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [replaying, setReplaying] = useState(true);
  const [orbitDays, setOrbitDays] = useState(Date.now() / 86400000);
  const [simulationPlaying, setSimulationPlaying] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(6);
  const [dockTarget, setDockTarget] = useState<HTMLElement | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [focusedPlanet, setFocusedPlanet] = useState<string | null>(null);
  const [euvWavelength, setEuvWavelength] = useState('304');
  const [spaceWeatherFrame, setSpaceWeatherFrame] = useState(Date.now());

  const lastTick = useRef(Date.now());

  useEffect(() => {
    const attachDock = () => setDockTarget(document.getElementById('solar-flare-right-dock-target'));
    attachDock();
    const frame = window.requestAnimationFrame(attachDock);
    window.addEventListener('resize', attachDock);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', attachDock);
    };
  }, []);

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
    const frameTimer = window.setInterval(() => setSpaceWeatherFrame(Date.now()), 5 * 60 * 1000);
    return () => window.clearInterval(frameTimer);
  }, []);

  useEffect(() => {
    void refresh();
    void loadHistory(dayString(Date.now() - 29 * 86400000));
    const id = window.setInterval(() => void refresh(), 60000);
    return () => window.clearInterval(id);
  }, [refresh, loadHistory]);

  useEffect(() => {
    lastTick.current = Date.now();
    if (!simulationPlaying) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, now - lastTick.current) / 1000;
      lastTick.current = now;
      const daysPerSecond = realTimeOrbit ? 1 / 86400 : simulationSpeed;
      setOrbitDays((days) => days + delta * daysPerSecond);
    }, 80);
    return () => window.clearInterval(id);
  }, [simulationPlaying, simulationSpeed, realTimeOrbit]);

  const simulationTimeMs = orbitDays * MS_PER_DAY;
  const simulationDate = new Date(simulationTimeMs);
  const simulationIsLive = Math.abs(simulationTimeMs - Date.now()) <= 5 * 60 * 1000;
  const sliderMinMs = Date.parse('1859-09-01T00:00:00Z');
  const sliderMaxMs = Date.parse('2100-12-31T23:59:59Z');
  const sliderValue = Math.max(0, Math.min(1000, (simulationTimeMs - sliderMinMs) / (sliderMaxMs - sliderMinMs) * 1000));
  const setSimulationTimestamp = (timestamp: number, resume = false) => {
    if (!Number.isFinite(timestamp)) return;
    setOrbitDays(timestamp / MS_PER_DAY);
    setRealTimeOrbit(false);
    setReplaying(false);
    setPlaying(false);
    setSimulationPlaying(resume);
  };
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
  const xrayRowsForSimulation = useMemo(() => xrayRows.filter((row) => {
    const energy = s(row.energy, row.energy_channel, row.channel).toLowerCase();
    return !energy || energy.includes('0.1-0.8') || energy.includes('0.1 – 0.8') || energy.includes('long') || energy.includes('xl');
  }), [xrayRows]);
  const protonRowsForSimulation = useMemo(() => protonRows.filter((row) => {
    const energy = s(row.energy, row.energy_channel, row.channel).toLowerCase();
    return !energy || energy.includes('>=10') || energy.includes('>10') || energy.includes('10 mev') || energy.includes('p10');
  }), [protonRows]);
  const xrayForSimulation = simulationIsLive ? liveXray : latest(xrayRowsForSimulation.filter((row) => rowTime(row) <= simulationTimeMs && simulationTimeMs - rowTime(row) <= 6 * 60 * 60 * 1000));
  const protonForSimulation = simulationIsLive ? liveProton : latest(protonRowsForSimulation.filter((row) => rowTime(row) <= simulationTimeMs && simulationTimeMs - rowTime(row) <= 6 * 60 * 60 * 1000));
  const kpForSimulation = simulationIsLive ? liveKp : latest(kpRows.filter((row) => rowTime(row) <= simulationTimeMs && simulationTimeMs - rowTime(row) <= 3 * 60 * 60 * 1000));
  const xrayFlux = n(xrayForSimulation?.flux, xrayForSimulation?.value);
  const protonFlux = n(protonForSimulation?.flux, protonForSimulation?.value);
  const kp = n(kpForSimulation?.kp_index, kpForSimulation?.kp, kpForSimulation?.estimated_kp, kpForSimulation?.value);
  const xrayTime = rowTime(xrayForSimulation || {});
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
  const liveFront = simulationIsLive && xrayFlux !== null && xrayFlux >= 1e-7;
  // A live propagation front is shown only while viewing current measured GOES data.
  // Historical and future simulation dates never reuse today's live flare as if it happened then.
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
  const earthPlanet = planets.find((planet) => planet.name === 'EARTH')!;
  const moon = moonPosition(earthPlanet, orbitDays);
  const earthSpinDegrees = earthSiderealRotation(orbitDays);
  const moonFacingAngle = Math.atan2(earthPlanet.y - moon.y, earthPlanet.x - moon.x) * 180 / Math.PI;
  const focused = planets.find((planet) => planet.name === focusedPlanet);
  const closeView = !!focusedPlanet && mapZoom > 1;
  const viewWidth = 1000 / mapZoom;
  const viewHeight = 600 / mapZoom;
  const viewX = focused ? focused.x - viewWidth / 2 : (1000 - viewWidth) / 2;
  const viewY = focused ? focused.y - viewHeight / 2 : (600 - viewHeight) / 2;
  // A red impact is a moving pulse, not a permanent "has been hit" state.
  // During replay each planet glows only while the wavefront is passing it.
  const planetIsInImpact = (planet: Planet & { distanceAu: number }) => {
    if (replaying && replayProgress >= 1000) return false;
    if (!replaying && !liveFront) return false;
    const wavefrontAu = replaying ? replayAu : liveFrontAu;
    // Widen the pulse slightly during accelerated replay so it remains visible at higher playback speeds.
    const impactBandAu = replaying ? Math.max(0.06, planet.au * 0.015) : 0.005;
    return Math.abs(wavefrontAu - planet.distanceAu) <= impactBandAu;
  };
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
        onWheel={(event) => { event.preventDefault(); event.stopPropagation(); setMapZoom(value => { const step = value < 3 ? 0.25 : value < 8 ? 0.75 : 1.5; const delta = event.deltaY < 0 ? step : -step; return Math.max(1, Math.min(18, Number((value + delta).toFixed(2)))); }); }}
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
            <radialGradient id="se-sphere-shading" cx="30%" cy="25%" r="78%">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".22" />
              <stop offset=".38" stopColor="#ffffff" stopOpacity=".04" />
              <stop offset=".68" stopColor="#000000" stopOpacity=".16" />
              <stop offset=".88" stopColor="#000000" stopOpacity=".48" />
              <stop offset="1" stopColor="#000000" stopOpacity=".82" />
            </radialGradient>
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
          <g className="solar-earth-orbits">{PLANETS.map((planet) => <path key={planet.name} d={orbitalPath(planet, orbitDays)} fill="none" stroke={planet.name === 'EARTH' ? '#2a83be' : '#23506b'} strokeWidth={planet.name === 'EARTH' ? '1.15' : '.85'} strokeOpacity={planet.name === 'EARTH' ? '.8' : '.48'} />)}</g>
          <g className="solar-earth-moon-orbit" aria-label="Moon orbit around Earth">
            <ellipse cx={earthPlanet.x} cy={earthPlanet.y} rx={MOON_DISPLAY_DISTANCE} ry={MOON_DISPLAY_DISTANCE * YSCALE} transform={'rotate(-5.145 ' + earthPlanet.x + ' ' + earthPlanet.y + ')'} fill="none" stroke="#8c9baa" strokeWidth=".65" strokeDasharray="2 3" strokeOpacity=".72" />
          </g>

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
            <circle cx={CX} cy={CY} r={22 + flareStrength * 5} fill="url(#se-sun-fill)" filter="url(#se-sun-glow)" />
            <defs><clipPath id="se-sun-euv-clip"><circle cx={CX} cy={CY} r="17" /></clipPath></defs>
            <circle cx={CX} cy={CY} r="18" fill="url(#se-sun-fill)" />
            <g clipPath="url(#se-sun-euv-clip)">
              <image href={NOAA_EUV_IMAGE(euvWavelength) + '?t=' + spaceWeatherFrame} x={CX - 18} y={CY - 18} width="36" height="36" preserveAspectRatio="xMidYMid slice" />
              <circle cx={CX} cy={CY} r="17" fill="#ff6a24" opacity=".10" />
            </g>
            <circle cx={CX} cy={CY} r="18" fill="none" stroke="#ffdca1" strokeWidth=".8" opacity=".85" />
            <text x={CX} y={CY + 39} textAnchor="middle" className="solar-earth-sun-label">THE SUN</text>
          </g>

          {planets.map((planet) => {
            const impact = planetIsInImpact(planet);
            return <g key={planet.name} className={'solar-earth-planet solar-earth-planet-' + planet.name.toLowerCase()} role="button" tabIndex={0} aria-label={'Zoom to ' + planet.name} onClick={() => { setFocusedPlanet(planet.name); setMapZoom(planet.name === 'EARTH' || planet.name === 'MARS' || planet.name === 'VENUS' ? 12 : 8); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFocusedPlanet(planet.name); setMapZoom(planet.name === 'EARTH' || planet.name === 'MARS' || planet.name === 'VENUS' ? 12 : 8); } }}>
              <circle cx={planet.x} cy={planet.y} r={planet.size + (planet.name === 'EARTH' ? 7 : 4)} fill={impact ? '#ff1717' : planet.color} opacity={impact ? '.42' : planet.name === 'EARTH' ? '.12' : '.07'} className={impact ? 'solar-earth-hit-pulse' : undefined} />
              {impact && <circle cx={planet.x} cy={planet.y} r={planet.size + 5} fill="none" stroke="#ff2929" strokeWidth="2" filter="url(#se-earth-impact-glow)" className="solar-earth-hit-pulse" />}
              {planet.name === 'SATURN' && <ellipse cx={planet.x} cy={planet.y} rx={planet.size * 1.9} ry={planet.size * .62} transform={'rotate(-18 ' + planet.x + ' ' + planet.y + ')'} fill="none" stroke="#d9c38d" strokeWidth="2" opacity=".9" />}
              <defs>
                <clipPath id={'se-texture-clip-' + planet.name.toLowerCase()}>
                  <circle cx={planet.x} cy={planet.y} r={planet.size} />
                </clipPath>
              </defs>
              {(() => {
                // Equirectangular maps are twice as wide as tall. Two adjacent copies let
                // the visible hemisphere scroll continuously without a texture seam.
                const spinHours = PLANET_ROTATION_HOURS[planet.name] || 24;
                const spinDegrees = planet.name === 'EARTH'
                  ? earthSpinDegrees
                  : ((orbitDays * 24 / spinHours * 360) % 360 + 360) % 360;
                const textureWidth = planet.size * 4;
                const textureOffset = spinDegrees / 360 * textureWidth;
                return (
                  <g clipPath={'url(#se-texture-clip-' + planet.name.toLowerCase() + ')'}>
                    <g transform={'translate(' + (-textureOffset) + ' 0)'}>
                      <image href={PLANET_TEXTURE_URLS[planet.name]} x={planet.x - planet.size * 2} y={planet.y - planet.size} width={textureWidth} height={planet.size * 2} preserveAspectRatio="none" />
                      <image href={PLANET_TEXTURE_URLS[planet.name]} x={planet.x + planet.size * 2} y={planet.y - planet.size} width={textureWidth} height={planet.size * 2} preserveAspectRatio="none" />
                    </g>
                    {planet.name === 'EARTH' && <image href={NOAA_AURORA_IMAGE + '?t=' + spaceWeatherFrame} x={planet.x - planet.size} y={planet.y - planet.size} width={planet.size * 2} height={planet.size * 2} preserveAspectRatio="xMidYMid slice" clipPath="url(#se-texture-clip-earth)" opacity=".7" style={{ mixBlendMode: 'screen' }} />}
                    <circle cx={planet.x} cy={planet.y} r={planet.size} fill="url(#se-sphere-shading)" pointerEvents="none" />
                    <ellipse cx={planet.x - planet.size * .24} cy={planet.y - planet.size * .36} rx={planet.size * .28} ry={planet.size * .12} transform={'rotate(-28 ' + (planet.x - planet.size * .24) + ' ' + (planet.y - planet.size * .36) + ')'} fill="#ffffff" opacity=".08" pointerEvents="none" />
                  </g>
                );
              })()}
              <circle cx={planet.x} cy={planet.y} r={planet.size} fill="none" stroke={impact ? '#ff342f' : planet.name === 'EARTH' ? '#c3f2ff' : '#d5e6f3'} strokeWidth={impact ? '2.5' : planet.name === 'EARTH' ? '1.2' : '.45'} className={impact ? 'solar-earth-hit-by-flare' : ''} filter={impact ? 'url(#se-earth-impact-glow)' : undefined} />
              <text x={planet.x} y={planet.y - planet.size - (planet.name === 'JUPITER' || planet.name === 'SATURN' ? 13 : 10)} className={planet.name === 'EARTH' ? 'solar-earth-planet-label solar-earth-label-earth' : 'solar-earth-planet-label'} textAnchor="middle">{planet.name}</text>
            </g>;
          })}
          <g className="solar-earth-moon" role="button" tabIndex={0} aria-label="Moon, orbiting Earth every 27.32 days" onClick={() => { setFocusedPlanet('EARTH'); setMapZoom(12); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFocusedPlanet('EARTH'); setMapZoom(12); } }}>
            {planetIsInImpact(earthPlanet) && <circle cx={moon.x} cy={moon.y} r="5.5" fill="none" stroke="#ff2929" strokeWidth="1.4" filter="url(#se-earth-impact-glow)" className="solar-earth-hit-pulse" />}
            <circle cx={moon.x} cy={moon.y} r="2.15" fill="url(#se-planet-moon)" stroke={planetIsInImpact(earthPlanet) ? '#ff342f' : '#d6dbe3'} strokeWidth={planetIsInImpact(earthPlanet) ? '.9' : '.45'} filter={planetIsInImpact(earthPlanet) ? 'url(#se-earth-impact-glow)' : undefined} />
            <g transform={'rotate(' + moonFacingAngle + ' ' + moon.x + ' ' + moon.y + ')'}>
              <circle cx={moon.x + .65} cy={moon.y - .42} r=".52" fill="#60656d" opacity=".72" />
              <circle cx={moon.x + .95} cy={moon.y + .38} r=".25" fill="#6b7079" opacity=".8" />
            </g>
            <text x={moon.x} y={moon.y - 3.2} textAnchor="middle" className="solar-earth-planet-label">MOON</text>
          </g>

          <text x={CX + PLANETS[2].radius + 10} y={CY - 17} className="solar-earth-distance-note">EARTH ORBIT · 1 AU (DISPLAY NOT TO SCALE)</text>
          <text x={CX + 8} y="27" className="solar-earth-map-caption">{closeView ? focusedPlanet + ' CLOSE VIEW' : 'HELIOCENTRIC VIEW / DATE-BASED ORBITS'}</text>
          <text x="18" y="579" className="solar-earth-map-small">{realTimeOrbit ? 'REAL TIME · UTC ORBIT + AXIAL ROTATION' : 'ORBIT SPEED: ' + orbitSpeed + ' SIMULATED DAYS / SECOND'}</text>
          <text x="982" y="579" textAnchor="end" className="solar-earth-map-small">{replaying ? 'REPLAY FRONT: ' + replayAu.toFixed(2) + ' AU' : liveFront ? 'LIVE OBSERVED X-RAY FRONT: ' + liveFrontAu.toFixed(2) + ' AU' : 'LIVE MODE · WAITING FOR B-CLASS OR STRONGER X-RAYS'}</text>
          {replaying && selected && <text x={CX + 28} y={CY + 26} className="solar-earth-selected-event-label">{selected.classType.toUpperCase()} · {replayAu.toFixed(2)} AU</text>}
        </svg>

      </div>
    </section>
    {dockTarget && createPortal(
      <div className="solar-earth-left-dock" aria-label="Solar flare event controls and history">
        <div className="solar-earth-left-dock-title"><Sun size={14} /> SOLAR FLARE CONTROLS</div>
        <section className="swpc-live-panel" aria-label="NOAA Space Weather live imagery and indices">
          <div className="swpc-live-heading"><span><Activity size={14} /> NOAA SPACE WEATHER</span><a href={NOAA_SPACE_WEATHER} target="_blank" rel="noreferrer">SPACEWEATHER.GOV ↗</a></div>
          <div className="swpc-imagery-block">
            <div className="swpc-imagery-title"><strong>SUN · EUV</strong><span>GOES SUVI · {euvWavelength} Å</span></div>
            <div className="swpc-euv-tabs">{['094','131','171','195','284','304'].map((wave) => <button type="button" key={wave} className={euvWavelength === wave ? 'active' : ''} onClick={() => setEuvWavelength(wave)}>{wave}</button>)}</div>
            <a className="swpc-imagery-frame" href={NOAA_SPACE_WEATHER} target="_blank" rel="noreferrer" title="Open official NOAA solar imagery">
              <img src={NOAA_EUV_IMAGE(euvWavelength) + '?t=' + spaceWeatherFrame} alt={'Latest NOAA GOES SUVI ' + euvWavelength + ' angstrom solar image'} />
            </a>
          </div>
          <div className="swpc-imagery-block swpc-corona-block">
            <div className="swpc-imagery-title"><strong>CORONA</strong><span>CCOR-1 coronagraph</span></div>
            <a className="swpc-imagery-frame swpc-corona-frame" href="https://www.spaceweather.gov/products/coronagraph" target="_blank" rel="noreferrer" title="Open official NOAA coronagraph imagery">
              <img src={NOAA_CORONA_IMAGE + '?t=' + spaceWeatherFrame} alt="Latest NOAA CCOR-1 coronagraph view of the solar corona" />
              <span>Solar corona · NOAA SWPC</span>
            </a>
          </div>
          <div className="swpc-index-grid">
            <a className="swpc-index-card" href="https://www.spaceweather.gov/products/goes-x-ray-flux" target="_blank" rel="noreferrer"><span>X-RAY FLUX</span><strong>{fluxText(xrayFlux)}</strong><small>{classFromFlux(xrayFlux)}</small><i className="swpc-index-xray" /></a>
            <a className="swpc-index-card" href="https://www.spaceweather.gov/products/goes-proton-flux" target="_blank" rel="noreferrer"><span>PROTON FLUX</span><strong>{fluxText(protonFlux)}</strong><small>{liveProton ? s(liveProton.energy, liveProton.energy_channel, liveProton.channel) || 'GOES ≥10 MeV' : 'Awaiting feed'}</small><i className="swpc-index-proton" /></a>
            <a className="swpc-index-card" href="https://www.spaceweather.gov/products/planetary-k-index" target="_blank" rel="noreferrer"><span>K INDEX</span><strong>{kp === null ? '—' : kp.toFixed(1)}</strong><small>{kp === null ? 'Awaiting feed' : kp >= 5 ? 'Geomagnetic storm' : 'Quiet / unsettled'}</small><i className="swpc-index-kp" /></a>
          </div>
          <div className="swpc-aurora-note"><img src={NOAA_AURORA_IMAGE + '?t=' + spaceWeatherFrame} alt="Latest NOAA northern aurora forecast" /><span><strong>EARTH · AURORA OVERLAY</strong><small>NOAA OVATION forecast over the Earth sphere; refreshed as new frames arrive.</small></span></div>
          <div className="swpc-live-foot">Official NOAA SWPC imagery · readings are from measured feeds</div>
        </section>

        <div className="solar-earth-map-key"><span><i className="se-key-sun" /> NOAA X-ray flux drives solar glow</span></div>
        <div className="solar-earth-playback">
          <div className="solar-earth-playback-top">
            <div className="solar-earth-current-event"><span className="solar-earth-live-lamp" /><div><strong>{replaying && selected ? 'REPLAY · ' + selected.classType + ' SOLAR FLARE' : 'LIVE SOLAR OBSERVATIONS'}</strong><small>{replaying && selected ? stamp(selected.beginMs) + ' · estimated solar emission 8m 19s earlier' : stamp(xrayTime) + ' · GOES measures X-rays near Earth'}</small></div></div>
            <div className="solar-earth-playback-actions">
              <button type="button" className={playing ? 'se-action se-action-hot' : 'se-action'} onClick={togglePlay} disabled={!selected}><Play size={12} />{playing ? 'PAUSE' : 'PLAY EVENT'}</button>
              <button type="button" className={realTimeOrbit && !replaying ? 'se-action se-action-hot' : 'se-action'} title="Return to current UTC time and real orbital rates" onClick={() => { setPlaying(false); setReplaying(false); setReplayProgress(0); setOrbitDays(Date.now() / MS_PER_DAY); setOrbitSpeed(1); setRealTimeOrbit(true); setSimulationPlaying(true); }}><TimerReset size={12} />LIVE TIME</button>
            </div>
          </div>
          <div className="solar-earth-timeline-row">
            <span>{replaying ? 'LIGHT TRAVEL' : 'ORBIT SPEED'}</span>
            {replaying ? <input aria-label="Solar flare propagation replay position" type="range" min="0" max="1000" value={replayProgress} onChange={(event) => { setReplayProgress(Number(event.target.value)); setPlaying(false); setReplaying(true); }} /> : <input aria-label="Solar system orbit speed" type="range" min="1" max="30" value={orbitSpeed} onChange={(event) => { setOrbitSpeed(Number(event.target.value)); setRealTimeOrbit(false); }} />}
            <select aria-label="Solar flare replay speed" value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))}><option value={1}>1× REAL TIME</option><option value={60}>60× PLAYBACK</option><option value={300}>300× PLAYBACK</option><option value={600}>600× PLAYBACK</option></select>
            <span className="solar-earth-timeline-time">{replaying ? (elapsed / 60).toFixed(1) + ' min / 4.2 hr' : realTimeOrbit ? '1 day / 24 hours · UTC' : orbitSpeed + ' simulated days / sec'}</span>
          </div>
          <section className="solar-earth-simulation-clock" aria-label="Connected simulation date and time controls" style={{ marginTop: 12, padding: 12, border: '1px solid rgba(105, 190, 255, .28)', borderRadius: 10, background: 'rgba(3, 15, 30, .94)', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#7dd3fc', fontSize: 10, fontWeight: 700, letterSpacing: '.16em' }}>SIMULATION CLOCK · UTC</div>
                <strong style={{ display: 'block', color: '#f0f8ff', fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{simulationDate.toISOString().replace('T', ' ').slice(0, 19)} UTC</strong>
                <small style={{ color: simulationIsLive ? '#7ce7b0' : '#f6c879' }}>{simulationIsLive ? 'LIVE MEASUREMENTS · CURRENT TIME' : simulationTimeMs > Date.now() ? 'FUTURE SIMULATION · LIVE MEASUREMENTS HIDDEN' : 'HISTORICAL SIMULATION · MATCHING ARCHIVE SAMPLES ONLY'}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="se-action" onClick={() => setSimulationPlaying(value => !value)} title={simulationPlaying ? 'Pause simulation clock' : 'Play simulation clock'}>{simulationPlaying ? 'PAUSE TIME' : 'PLAY TIME'}</button>
                <select aria-label="Simulation clock speed" value={simulationSpeed} onChange={(event) => setSimulationSpeed(Number(event.target.value))} style={{ maxWidth: 150 }}>
                  <option value={1}>1 simulated day/sec</option><option value={6}>6 simulated days/sec</option><option value={30}>30 simulated days/sec</option><option value={365}>1 simulated year/sec</option>
                </select>
              </div>
            </div>
            <input aria-label="Simulation date timeline from 1859 through 2100" type="range" min="0" max="1000" step="1" value={sliderValue} onChange={(event) => setSimulationTimestamp(sliderMinMs + Number(event.target.value) / 1000 * (sliderMaxMs - sliderMinMs))} style={{ width: '100%', accentColor: '#48c7ff', cursor: 'ew-resize' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#9bb4cb', fontSize: 11 }}><span>1859 · Carrington event</span><span>Present</span><span>2100 · Future</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b8cde0', fontSize: 12 }}>DATE <input aria-label="Simulation date" type="date" min="1859-09-01" max="2100-12-31" value={dayString(simulationTimeMs)} onChange={(event) => { if (event.target.value) { const next = Date.parse(event.target.value + 'T' + simulationDate.toISOString().slice(11, 19) + 'Z'); setSimulationTimestamp(next); } }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b8cde0', fontSize: 12 }}>TIME UTC <input aria-label="Simulation time UTC" type="time" step="1" value={simulationDate.toISOString().slice(11, 19)} onChange={(event) => { if (event.target.value) { const next = Date.parse(dayString(simulationTimeMs) + 'T' + event.target.value + 'Z'); setSimulationTimestamp(next); } }} /></label>
              <button type="button" className="se-action" onClick={() => { setSimulationTimestamp(Date.now()); setRealTimeOrbit(true); setSimulationPlaying(true); setOrbitSpeed(1); }}>NOW</button>
            </div>
            <small style={{ color: '#8ea9c2', lineHeight: 1.45 }}>Orbital positions, planetary rotation, and Moon position follow this clock. Instrument readings only appear when a timestamped measurement exists for the selected time; current NOAA imagery remains live imagery.</small>
          </section>
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
