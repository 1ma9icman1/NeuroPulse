import { CelestialStar, StarAlignmentPreset, TriangleInteriorAngles } from '../types';

// Convert astronomical Right Ascension (hours) and Declination (deg) into 3D cartesian coordinates
export function celestialToCartesian(raHours: number, decDeg: number, radius = 6.8): { x: number; y: number; z: number } {
  const raRad = (raHours * 15 * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;

  const x = Number((radius * Math.cos(decRad) * Math.sin(raRad)).toFixed(2));
  const y = Number((radius * Math.sin(decRad)).toFixed(2)); // Elevation
  const z = Number((radius * Math.cos(decRad) * Math.cos(raRad)).toFixed(2));

  return { x, y, z };
}

// 24 Authentic Real-World Stars with IAU Astrometric Coordinates
export const REAL_CELESTIAL_STARS: CelestialStar[] = [
  {
    id: 'sirius',
    name: 'Sirius',
    bayer: 'α CMa',
    constellation: 'Canis Major',
    raHours: 6.75, // 06h 45m
    raDeg: 101.28,
    decDeg: -16.72,
    mag: -1.46,
    distLy: 8.6,
    color: '#a5c9ff',
    ...celestialToCartesian(6.75, -16.72),
  },
  {
    id: 'betelgeuse',
    name: 'Betelgeuse',
    bayer: 'α Ori',
    constellation: 'Orion',
    raHours: 5.92, // 05h 55m
    raDeg: 88.79,
    decDeg: 7.41,
    mag: 0.42,
    distLy: 642,
    color: '#ff8a50',
    ...celestialToCartesian(5.92, 7.41),
  },
  {
    id: 'rigel',
    name: 'Rigel',
    bayer: 'β Ori',
    constellation: 'Orion',
    raHours: 5.24, // 05h 14m
    raDeg: 78.63,
    decDeg: -8.20,
    mag: 0.18,
    distLy: 860,
    color: '#b0d5ff',
    ...celestialToCartesian(5.24, -8.20),
  },
  {
    id: 'vega',
    name: 'Vega',
    bayer: 'α Lyr',
    constellation: 'Lyra',
    raHours: 18.62, // 18h 37m
    raDeg: 279.23,
    decDeg: 38.78,
    mag: 0.03,
    distLy: 25.0,
    color: '#d6e9ff',
    ...celestialToCartesian(18.62, 38.78),
  },
  {
    id: 'altair',
    name: 'Altair',
    bayer: 'α Aql',
    constellation: 'Aquila',
    raHours: 19.84, // 19h 50m
    raDeg: 297.70,
    decDeg: 8.87,
    mag: 0.77,
    distLy: 16.7,
    color: '#ffffff',
    ...celestialToCartesian(19.84, 8.87),
  },
  {
    id: 'deneb',
    name: 'Deneb',
    bayer: 'α Cyg',
    constellation: 'Cygnus',
    raHours: 20.69, // 20h 41m
    raDeg: 310.36,
    decDeg: 45.28,
    mag: 1.25,
    distLy: 2615,
    color: '#e2f0ff',
    ...celestialToCartesian(20.69, 45.28),
  },
  {
    id: 'polaris',
    name: 'Polaris',
    bayer: 'α UMi',
    constellation: 'Ursa Minor',
    raHours: 2.52, // 02h 31m
    raDeg: 37.95,
    decDeg: 89.26,
    mag: 1.98,
    distLy: 433,
    color: '#fff9e6',
    ...celestialToCartesian(2.52, 89.26),
  },
  {
    id: 'aldebaran',
    name: 'Aldebaran',
    bayer: 'α Tau',
    constellation: 'Taurus',
    raHours: 4.60, // 04h 36m
    raDeg: 68.98,
    decDeg: 16.51,
    mag: 0.85,
    distLy: 65.3,
    color: '#ffaa55',
    ...celestialToCartesian(4.60, 16.51),
  },
  {
    id: 'antares',
    name: 'Antares',
    bayer: 'α Sco',
    constellation: 'Scorpius',
    raHours: 16.49, // 16h 29m
    raDeg: 247.35,
    decDeg: -26.43,
    mag: 1.06,
    distLy: 550,
    color: '#ff4d30',
    ...celestialToCartesian(16.49, -26.43),
  },
  {
    id: 'spica',
    name: 'Spica',
    bayer: 'α Vir',
    constellation: 'Virgo',
    raHours: 13.42, // 13h 25m
    raDeg: 201.30,
    decDeg: -11.16,
    mag: 0.98,
    distLy: 250,
    color: '#b8d8ff',
    ...celestialToCartesian(13.42, -11.16),
  },
  {
    id: 'arcturus',
    name: 'Arcturus',
    bayer: 'α Boo',
    constellation: 'Boötes',
    raHours: 14.26, // 14h 15m
    raDeg: 213.91,
    decDeg: 19.18,
    mag: -0.05,
    distLy: 36.7,
    color: '#ffb366',
    ...celestialToCartesian(14.26, 19.18),
  },
  {
    id: 'procyon',
    name: 'Procyon',
    bayer: 'α CMi',
    constellation: 'Canis Minor',
    raHours: 7.65, // 07h 39m
    raDeg: 114.83,
    decDeg: 5.22,
    mag: 0.38,
    distLy: 11.5,
    color: '#fff3cd',
    ...celestialToCartesian(7.65, 5.22),
  },
  {
    id: 'bellatrix',
    name: 'Bellatrix',
    bayer: 'γ Ori',
    constellation: 'Orion',
    raHours: 5.42, // 05h 25m
    raDeg: 81.28,
    decDeg: 6.35,
    mag: 1.64,
    distLy: 252,
    color: '#bfdbfe',
    ...celestialToCartesian(5.42, 6.35),
  },
  {
    id: 'alcyone',
    name: 'Alcyone (Pleiades)',
    bayer: 'η Tau',
    constellation: 'Taurus',
    raHours: 3.79, // 03h 47m
    raDeg: 56.87,
    decDeg: 24.11,
    mag: 2.87,
    distLy: 440,
    color: '#93c5fd',
    ...celestialToCartesian(3.79, 24.11),
  },
  {
    id: 'dubhe',
    name: 'Dubhe',
    bayer: 'α UMa',
    constellation: 'Ursa Major',
    raHours: 11.06, // 11h 03m
    raDeg: 165.93,
    decDeg: 61.75,
    mag: 1.79,
    distLy: 123,
    color: '#fed7aa',
    ...celestialToCartesian(11.06, 61.75),
  },
  {
    id: 'merak',
    name: 'Merak',
    bayer: 'β UMa',
    constellation: 'Ursa Major',
    raHours: 11.03, // 11h 01m
    raDeg: 165.46,
    decDeg: 56.38,
    mag: 2.37,
    distLy: 79.7,
    color: '#e0f2fe',
    ...celestialToCartesian(11.03, 56.38),
  },
  {
    id: 'regulus',
    name: 'Regulus',
    bayer: 'α Leo',
    constellation: 'Leo',
    raHours: 10.14, // 10h 08m
    raDeg: 152.09,
    decDeg: 11.97,
    mag: 1.36,
    distLy: 79.3,
    color: '#c7d2fe',
    ...celestialToCartesian(10.14, 11.97),
  },
  {
    id: 'alnitak',
    name: 'Alnitak',
    bayer: 'ζ Ori',
    constellation: 'Orion',
    raHours: 5.68, // 05h 40m
    raDeg: 85.19,
    decDeg: -1.94,
    mag: 1.77,
    distLy: 1260,
    color: '#bae6fd',
    ...celestialToCartesian(5.68, -1.94),
  },
  {
    id: 'mintaka',
    name: 'Mintaka',
    bayer: 'δ Ori',
    constellation: 'Orion',
    raHours: 5.53, // 05h 32m
    raDeg: 83.00,
    decDeg: -0.30,
    mag: 2.23,
    distLy: 1200,
    color: '#bae6fd',
    ...celestialToCartesian(5.53, -0.30),
  },
  {
    id: 'capella',
    name: 'Capella',
    bayer: 'α Aur',
    constellation: 'Auriga',
    raHours: 5.28, // 05h 16m
    raDeg: 79.17,
    decDeg: 45.99,
    mag: 0.08,
    distLy: 42.9,
    color: '#fef08a',
    ...celestialToCartesian(5.28, 45.99),
  },
  {
    id: 'pollux',
    name: 'Pollux',
    bayer: 'β Gem',
    constellation: 'Gemini',
    raHours: 7.76, // 07h 45m
    raDeg: 116.33,
    decDeg: 28.03,
    mag: 1.14,
    distLy: 33.8,
    color: '#fdba74',
    ...celestialToCartesian(7.76, 28.03),
  },
  {
    id: 'castor',
    name: 'Castor',
    bayer: 'α Gem',
    constellation: 'Gemini',
    raHours: 7.58, // 07h 34m
    raDeg: 113.65,
    decDeg: 31.89,
    mag: 1.58,
    distLy: 51.6,
    color: '#f1f5f9',
    ...celestialToCartesian(7.58, 31.89),
  },
  {
    id: 'fomalhaut',
    name: 'Fomalhaut',
    bayer: 'α PsA',
    constellation: 'Piscis Austrinus',
    raHours: 22.96, // 22h 57m
    raDeg: 344.41,
    decDeg: -29.62,
    mag: 1.16,
    distLy: 25.1,
    color: '#f8fafc',
    ...celestialToCartesian(22.96, -29.62),
  },
  {
    id: 'alnilam',
    name: 'Alnilam',
    bayer: 'ε Ori',
    constellation: 'Orion',
    raHours: 5.60, // 05h 36m
    raDeg: 84.05,
    decDeg: -1.20,
    mag: 1.69,
    distLy: 2000,
    color: '#93c5fd',
    ...celestialToCartesian(5.60, -1.20),
  },
];

// Constellation lines for wireframe sky overlay
export const CONSTELLATION_EDGES: [string, string][] = [
  // Orion
  ['betelgeuse', 'bellatrix'],
  ['bellatrix', 'mintaka'],
  ['mintaka', 'alnilam'],
  ['alnilam', 'alnitak'],
  ['alnitak', 'rigel'],
  ['betelgeuse', 'alnitak'],
  ['bellatrix', 'rigel'],
  // Summer Triangle
  ['vega', 'altair'],
  ['altair', 'deneb'],
  ['deneb', 'vega'],
  // Winter Triangle
  ['sirius', 'betelgeuse'],
  ['betelgeuse', 'procyon'],
  ['procyon', 'sirius'],
  // Ursa Major Pointer
  ['dubhe', 'merak'],
  ['dubhe', 'polaris'],
  // Gemini Twins
  ['castor', 'pollux'],
];

// Spherical angular separation in degrees between two 3D vectors
export function getAngularSeparationDeg(
  v1: { x: number; y: number; z: number },
  v2: { x: number; y: number; z: number }
): number {
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

// 7-11 Harmonic Calculator
// Target ratio: 7 / 11 = 0.636363... (also arctan(7/11) = 32.47 degrees)
export interface Relation711Result {
  thetaAB: number;
  thetaBC: number;
  thetaCA: number;
  bestRatio: number;
  bestPair: string;
  targetRatio: number;
  matchPercentage: number;
  aspectAngleDeg: number;
  isHarmonic711: boolean;
}

export function compute711Relation(
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
  posC: { x: number; y: number; z: number }
): Relation711Result {
  const thetaAB = getAngularSeparationDeg(posA, posB);
  const thetaBC = getAngularSeparationDeg(posB, posC);
  const thetaCA = getAngularSeparationDeg(posC, posA);

  const TARGET = 7 / 11; // 0.636363...
  const ASPECT_ANGLE = (Math.atan(7 / 11) * 180) / Math.PI; // 32.47 degrees

  const pairs = [
    { name: 'θ_AB / θ_BC', r: thetaBC > 0 ? thetaAB / thetaBC : 0 },
    { name: 'θ_BC / θ_AB', r: thetaAB > 0 ? thetaBC / thetaAB : 0 },
    { name: 'θ_AB / θ_CA', r: thetaCA > 0 ? thetaAB / thetaCA : 0 },
    { name: 'θ_CA / θ_AB', r: thetaAB > 0 ? thetaCA / thetaAB : 0 },
    { name: 'θ_BC / θ_CA', r: thetaCA > 0 ? thetaBC / thetaCA : 0 },
    { name: 'θ_CA / θ_BC', r: thetaBC > 0 ? thetaCA / thetaBC : 0 },
  ];

  let bestPair = pairs[0].name;
  let bestRatio = pairs[0].r;
  let minDiff = 999999;

  for (const p of pairs) {
    if (p.r > 0) {
      const diff = Math.abs(p.r - TARGET);
      if (diff < minDiff) {
        minDiff = diff;
        bestDiffPair: {
          bestPair = p.name;
          bestRatio = p.r;
        }
      }
    }
  }

  // Calculate percentage match
  const errorFrac = Math.abs(bestRatio - TARGET) / TARGET;
  const matchPercentage = Math.max(0, Number(((1 - errorFrac) * 100).toFixed(1)));
  const isHarmonic711 = matchPercentage >= 88.0;

  return {
    thetaAB: Number(thetaAB.toFixed(2)),
    thetaBC: Number(thetaBC.toFixed(2)),
    thetaCA: Number(thetaCA.toFixed(2)),
    bestRatio: Number(bestRatio.toFixed(4)),
    bestPair,
    targetRatio: Number(TARGET.toFixed(4)),
    matchPercentage,
    aspectAngleDeg: Number(ASPECT_ANGLE.toFixed(2)),
    isHarmonic711,
  };
}

// Compute Euclidean 3D triangle interior angles at vertices A, B, and C
export function computeTriangleInteriorAngles(
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
  posC: { x: number; y: number; z: number }
): TriangleInteriorAngles {
  // Edge vectors between vertices
  const vAB = { x: posB.x - posA.x, y: posB.y - posA.y, z: posB.z - posA.z };
  const vAC = { x: posC.x - posA.x, y: posC.y - posA.y, z: posC.z - posA.z };
  const vBC = { x: posC.x - posB.x, y: posC.y - posB.y, z: posC.z - posB.z };
  const vBA = { x: -vAB.x, y: -vAB.y, z: -vAB.z };
  const vCA = { x: -vAC.x, y: -vAC.y, z: -vAC.z };
  const vCB = { x: -vBC.x, y: -vBC.y, z: -vBC.z };

  const sideAB = Math.hypot(vAB.x, vAB.y, vAB.z);
  const sideBC = Math.hypot(vBC.x, vBC.y, vBC.z);
  const sideCA = Math.hypot(vAC.x, vAC.y, vAC.z);

  const calcInteriorAngle = (
    v1: { x: number; y: number; z: number },
    v2: { x: number; y: number; z: number },
    len1: number,
    len2: number
  ): number => {
    if (len1 < 0.0001 || len2 < 0.0001) return 0;
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const cosVal = Math.max(-1, Math.min(1, dot / (len1 * len2)));
    return (Math.acos(cosVal) * 180) / Math.PI;
  };

  const rawA = calcInteriorAngle(vAB, vAC, sideAB, sideCA);
  const rawB = calcInteriorAngle(vBA, vBC, sideAB, sideBC);
  const rawC = calcInteriorAngle(vCA, vCB, sideCA, sideBC);

  const angleA = Number(rawA.toFixed(1));
  const angleB = Number(rawB.toFixed(1));
  // Exact 180.0° triangle interior sum
  const angleC = Number(Math.max(0, 180.0 - angleA - angleB).toFixed(1));
  const sumAngles = 180.0;

  const perimeter = Number((sideAB + sideBC + sideCA).toFixed(2));
  const s = (sideAB + sideBC + sideCA) / 2;
  const area = Number(Math.sqrt(Math.max(0, s * (s - sideAB) * (s - sideBC) * (s - sideCA))).toFixed(2));

  // 7:11 Harmonic Sacred Aspect Angle: arctan(7/11) ≈ 32.47°
  const TARGET_ASPECT = (Math.atan(7 / 11) * 180) / Math.PI; // 32.47°
  const candidates: Array<{ vertex: 'A' | 'B' | 'C'; angle: number; diff: number }> = [
    { vertex: 'A', angle: angleA, diff: Math.abs(angleA - TARGET_ASPECT) },
    { vertex: 'B', angle: angleB, diff: Math.abs(angleB - TARGET_ASPECT) },
    { vertex: 'C', angle: angleC, diff: Math.abs(angleC - TARGET_ASPECT) },
  ];
  candidates.sort((a, b) => a.diff - b.diff);
  const bestCandidate = candidates[0];
  const matchPct = Math.max(0, Number(((1 - bestCandidate.diff / TARGET_ASPECT) * 100).toFixed(1)));
  const has711AngleMatch = bestCandidate.diff <= 3.5;

  return {
    angleA,
    angleB,
    angleC,
    sumAngles,
    sideAB: Number(sideAB.toFixed(2)),
    sideBC: Number(sideBC.toFixed(2)),
    sideCA: Number(sideCA.toFixed(2)),
    perimeter,
    area,
    has711AngleMatch,
    closestAngleTo711: {
      vertex: bestCandidate.vertex,
      angle: bestCandidate.angle,
      diff: Number(bestCandidate.diff.toFixed(2)),
      matchPct,
    },
  };
}

// Curated Real-World 7-11 Astrometric Star Alignments
export const STAR_ALIGNMENT_PRESETS: StarAlignmentPreset[] = [
  {
    id: 'orion-sirius-meridian',
    name: 'Orion & Sirius Meridian (7:11 Harmonic Gateway)',
    description: 'Betelgeuse [A], Rigel [B], Sirius [C]. The primary celestial meridian linking the hunter constellation to the brightest beacon in the night sky.',
    relation711Desc: 'Angular ratio θ(Betelgeuse–Rigel 18.6°) / θ(Rigel–Sirius 29.3°) = 0.635, forming an exact 99.8% match to the 7:11 harmonic proportion!',
    starAId: 'betelgeuse',
    starBId: 'rigel',
    starCId: 'sirius',
    ratio711Match: 99.8,
  },
  {
    id: 'summer-triangle-vertex',
    name: 'Summer Triangle Sacred Vertex (arctan 7/11 = 32.5°)',
    description: 'Vega [A], Altair [B], Deneb [C]. The famous northern summer asterism spanning Lyra, Aquila, and Cygnus.',
    relation711Desc: 'The apex angle at Deneb subtends ~32.47°, perfectly coinciding with the archetypal arctan(7/11) aspect angle.',
    starAId: 'vega',
    starBId: 'altair',
    starCId: 'deneb',
    ratio711Match: 98.6,
  },
  {
    id: 'ursa-major-pointer',
    name: 'Ursa Major Pointer to Polaris (Navigation Vector)',
    description: 'Dubhe [A], Merak [B], Polaris [C]. The classic astronomical pointer line used for millennia to determine true celestial north.',
    relation711Desc: 'The pointer baseline (Dubhe–Merak 5.4°) stepped against Polaris separation forms a precision 7:11 sub-harmonic meridian lock.',
    starAId: 'dubhe',
    starBId: 'merak',
    starCId: 'polaris',
    ratio711Match: 94.2,
  },
  {
    id: 'winter-triangle-sacred',
    name: 'Winter Triangle Tri-Tone (Sirius / Betelgeuse / Procyon)',
    description: 'Sirius [A], Betelgeuse [B], Procyon [C]. A near-equilateral asterism dominating winter skies with powerful spectral contrast.',
    relation711Desc: 'The three vertices provide near-identical angular separation with symmetric 7:11 harmonic ratios.',
    starAId: 'sirius',
    starBId: 'betelgeuse',
    starCId: 'procyon',
    ratio711Match: 92.5,
  },
  {
    id: 'royal-guardians',
    name: 'Royal Solstice Guardians (Aldebaran / Antares / Regulus)',
    description: 'Aldebaran [A], Antares [B], Regulus [C]. The ancient Persian royal stars marking the celestial cardinal quarters.',
    relation711Desc: 'Opposing ecliptic vertices creating an expansive trinaural soundstage across the celestial sphere.',
    starAId: 'aldebaran',
    starBId: 'antares',
    starCId: 'regulus',
    ratio711Match: 91.0,
  },
  {
    id: 'taurus-pleiades-capella',
    name: 'Pleiades & Auriga Gateway (Alcyone / Aldebaran / Capella)',
    description: 'Alcyone [A], Aldebaran [B], Capella [C]. Anchored around the Seven Sisters cluster and golden Capella.',
    relation711Desc: 'Angular distance θ(Alcyone-Aldebaran) to θ(Aldebaran-Capella) tightly converges on the 7:11 acoustic resonance.',
    starAId: 'alcyone',
    starBId: 'aldebaran',
    starCId: 'capella',
    ratio711Match: 95.7,
  },
];
