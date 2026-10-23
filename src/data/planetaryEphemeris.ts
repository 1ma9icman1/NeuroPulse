/**
 * Planet positions for NeuroPulse's existing 3D celestial overlay.
 *
 * Adapted from the low-precision JPL two-term orbital-element method and
 * element constants documented in Sky Map / Stardroid v1:
 * https://github.com/sky-map-team/stardroid
 * Source files: SolarSystemBody.kt and OrbitalElements.kt.
 *
 * The referenced Stardroid v1 files are Apache-2.0 licensed. This adaptation
 * retains attribution and the same approximate-use caveat: the source element
 * series is intended for roughly 1800–2050 CE. Earlier timeline dates are
 * drawn as an educational approximation, not precision historical ephemerides.
 *
 * No Earth Engine, cloud account, network API, or runtime data download is used.
 */

export interface PlanetSkyPosition {
  id: string;
  name: string;
  raDeg: number;
  decDeg: number;
  distanceAu: number;
  color: string;
  size: number;
}

interface OrbitalElementRates {
  a: [number, number];
  e: [number, number];
  i: [number, number];
  L: [number, number];
  peri: [number, number];
  node: [number, number];
  color: string;
  size: number;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// JPL two-term orbital elements reproduced from Stardroid v1 SolarSystemBody.kt.
// Values are (constant, change per Julian century).
const ELEMENTS: Record<string, OrbitalElementRates> = {
  Mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], i: [7.00497902, -0.00594749], L: [252.25032350, 149472.67411175], peri: [77.45779628, 0.16047689], node: [48.33076593, -0.12534081], color: '#cbd5e1', size: 3.1 },
  Venus: { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], i: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729], peri: [131.60246718, 0.00268329], node: [76.67984255, -0.27769418], color: '#fcd34d', size: 3.8 },
  Earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], i: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0, 0], color: '#60a5fa', size: 3.5 },
  Mars: { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], i: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343], color: '#fb7185', size: 3.5 },
  Jupiter: { a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], i: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], peri: [14.72847983, 0.21252668], node: [100.47390909, 0.20469106], color: '#fdba74', size: 4.5 },
  Saturn: { a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], i: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], peri: [92.59887831, -0.41897216], node: [113.66242448, -0.28867794], color: '#fde68a', size: 4.2 },
  Uranus: { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], i: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], peri: [170.95427630, 0.40805281], node: [74.01692503, 0.04240589], color: '#67e8f9', size: 3.2 },
  Neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], i: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], peri: [44.96476227, -0.32241464], node: [131.78422574, -0.00508664], color: '#818cf8', size: 3.2 },
  Pluto: { a: [39.48211675, -0.00031596], e: [0.24882730, 0.00005170], i: [17.14001206, 0.00004818], L: [238.92903833, 145.20780515], peri: [224.06891629, -0.04062942], node: [110.30393684, -0.01183482], color: '#d8b4fe', size: 2.7 },
};

type Vector3 = { x: number; y: number; z: number };

function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let E = meanAnomaly + eccentricity * Math.sin(meanAnomaly) * (1 + eccentricity * Math.cos(meanAnomaly));
  for (let iteration = 0; iteration < 30; iteration++) {
    const next = E - (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
    if (Math.abs(next - E) < 1e-10) return next;
    E = next;
  }
  return E;
}

function heliocentricEcliptic(body: OrbitalElementRates, centuries: number): Vector3 {
  const value = (pair: [number, number]) => pair[0] + pair[1] * centuries;
  const a = value(body.a);
  const e = value(body.e);
  const inclination = value(body.i) * DEG;
  const meanLongitude = value(body.L) * DEG;
  const perihelion = value(body.peri) * DEG;
  const ascendingNode = value(body.node) * DEG;
  const meanAnomaly = ((meanLongitude - perihelion) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const eccentricAnomaly = solveKepler(meanAnomaly, e);
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(eccentricAnomaly / 2), Math.sqrt(1 - e) * Math.cos(eccentricAnomaly / 2));
  const radius = a * (1 - e * Math.cos(eccentricAnomaly));
  const argumentOfPerihelion = perihelion - ascendingNode;
  const u = argumentOfPerihelion + trueAnomaly;
  return {
    x: radius * (Math.cos(ascendingNode) * Math.cos(u) - Math.sin(ascendingNode) * Math.sin(u) * Math.cos(inclination)),
    y: radius * (Math.sin(ascendingNode) * Math.cos(u) + Math.cos(ascendingNode) * Math.sin(u) * Math.cos(inclination)),
    z: radius * Math.sin(u) * Math.sin(inclination),
  };
}

function toSkyPosition(vector: Vector3): { raDeg: number; decDeg: number } {
  // Rotate ecliptic coordinates into the mean equatorial frame.
  const obliquity = 23.439291 * DEG;
  const x = vector.x;
  const y = vector.y * Math.cos(obliquity) - vector.z * Math.sin(obliquity);
  const z = vector.y * Math.sin(obliquity) + vector.z * Math.cos(obliquity);
  const raDeg = ((Math.atan2(y, x) * RAD) % 360 + 360) % 360;
  const decDeg = Math.atan2(z, Math.hypot(x, y)) * RAD;
  return { raDeg, decDeg };
}

function subtract(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Returns the Sun and planets at the requested timeline year.
 * Planet coordinates are geocentric RA/Dec, suitable for the existing celestial
 * sphere overlay. The current low-precision element series is best for 1800–2050.
 */
export function getPlanetSkyPositions(year: number): PlanetSkyPosition[] {
  const date = new Date(Date.UTC(Math.trunc(year), 0, 1, 12, 0, 0));
  const jd = date.getTime() / 86400000 + 2440587.5;
  const centuries = (jd - 2451545.0) / 36525;
  const earth = heliocentricEcliptic(ELEMENTS.Earth, centuries);
  const sunGeo = { x: -earth.x, y: -earth.y, z: -earth.z };
  const sunSky = toSkyPosition(sunGeo);
  const positions: PlanetSkyPosition[] = [{
    id: 'sun', name: 'Sun', ...sunSky, distanceAu: Math.hypot(sunGeo.x, sunGeo.y, sunGeo.z), color: '#fbbf24', size: 4.8,
  }];

  for (const [name, elements] of Object.entries(ELEMENTS)) {
    if (name === 'Earth') continue;
    const geo = subtract(heliocentricEcliptic(elements, centuries), earth);
    positions.push({
      id: name.toLowerCase(),
      name,
      ...toSkyPosition(geo),
      distanceAu: Math.hypot(geo.x, geo.y, geo.z),
      color: elements.color,
      size: elements.size,
    });
  }
  return positions;
}

export function isPlanetEphemerisYearInPreferredRange(year: number): boolean {
  return year >= 1800 && year <= 2050;
}


/**
 * Compact heliocentric orbital elements for the dedicated Sun-centred canvas.
 * Display geometry is intentionally compressed; values are approximate educational
 * elements rather than a precision ephemeris.
 */
export interface HeliocentricOrbitElement {
  id: string;
  name: string;
  color: string;
  semimajorAxisAu: number;
  eccentricity: number;
  inclinationDeg: number;
  longitudeAscendingNodeDeg: number;
  argumentOfPerihelionDeg: number;
  meanAnomalyRad: number;
  orbitalPeriodDays: number;
}

export function getHeliocentricOrbitElements(epochMs: number): HeliocentricOrbitElement[] {
  const jd = epochMs / 86400000 + 2440587.5;
  const daysFromJ2000 = jd - 2451545.0;
  const data: Array<[string,string,number,number,number,number,number,number,number]> = [
    ['mercury','Mercury',0.3871,0.2056,7.005,48.331,29.125,174.796,87.969],
    ['venus','Venus',0.7233,0.0068,3.395,76.680,54.884,50.115,224.701],
    ['earth','Earth',1.0000,0.0167,0.000,0.000,102.937,357.517,365.256],
    ['mars','Mars',1.5237,0.0934,1.850,49.558,286.502,19.373,686.980],
    ['jupiter','Jupiter',5.2026,0.0485,1.303,100.464,273.867,20.020,4332.589],
    ['saturn','Saturn',9.5549,0.0555,2.489,113.665,339.392,317.020,10759.22],
    ['uranus','Uranus',19.2184,0.0463,0.773,74.006,96.998,142.238,30688.5],
    ['neptune','Neptune',30.1104,0.0095,1.770,131.784,273.187,256.228,60182],
    ['pluto','Pluto',39.482,0.2488,17.14,110.299,113.834,14.53,90560],
  ];
  return data.map(([id,name,a,e,i,node,peri,mean0,period]) => ({
    id, name, color: id === 'earth' ? '#93c5fd' : id === 'mars' ? '#fda4af' : id === 'jupiter' ? '#d6b08c' : '#cbd5e1',
    semimajorAxisAu: a, eccentricity: e, inclinationDeg: i,
    longitudeAscendingNodeDeg: node, argumentOfPerihelionDeg: peri,
    meanAnomalyRad: ((mean0 + 360 * daysFromJ2000 / period) % 360) * Math.PI / 180,
    orbitalPeriodDays: period,
  }));
}
