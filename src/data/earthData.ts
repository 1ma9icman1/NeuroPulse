/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EarthPoint } from '../types';

export const DEFAULT_EARTH_POINTS: EarthPoint[] = [
  {
    id: 'giza',
    name: 'Great Pyramid of Giza',
    lat: 29.9792,
    lon: 31.1342,
    color: '#f59e0b',
    category: 'ancient',
    desc: 'Coordinates are approximately 29.9792°N, 31.1342°E. Proposed Orion correlations should be checked against measured pyramid axes and dated sky models; these coordinates do not establish a 432 Hz or 110 Hz resonance.',
  },
  {
    id: 'stonehenge',
    name: 'Stonehenge Megalith',
    lat: 51.1789,
    lon: -1.8262,
    color: '#10b981',
    category: 'ancient',
    desc: 'Stonehenge has a widely studied solstitial axis. Claims about special acoustic or harmonic tuning require separate measured evidence.',
  },
  {
    id: 'greenwich',
    name: 'Royal Greenwich Observatory',
    lat: 51.4769,
    lon: -0.0005,
    color: '#06b6d4',
    category: 'astronomy',
    desc: 'The historic Greenwich meridian is the reference for 0° longitude. Modern geodetic longitude is defined relative to the ITRF, not the physical historic line alone.',
  },
  {
    id: 'easter-island',
    name: 'Easter Island (Rapa Nui)',
    lat: -27.1127,
    lon: -109.3497,
    color: '#ec4899',
    category: 'ancient',
    desc: 'Ahu Akivi is a major moai platform. Equinox-sunset alignment claims should be checked against published site surveys and local horizon data.',
  },
  {
    id: 'teotihuacan',
    name: 'Teotihuacan Sun Pyramid',
    lat: 19.6925,
    lon: -98.8438,
    color: '#eab308',
    category: 'ancient',
    desc: 'Teotihuacan has documented urban orientations; a specific Pleiades-setting interpretation should be treated as a hypothesis unless supported by a site-specific source and date model.',
  },
  {
    id: 'kailash',
    name: 'Mount Kailash',
    lat: 31.0667,
    lon: 81.3125,
    color: '#a855f7',
    category: 'acoustic',
    desc: 'Mount Kailash is a mountain with major religious and cultural significance. Cardinal alignment or pyramid-shape interpretations are not treated here as measured astronomical facts.',
  },
  {
    id: 'chichen-itza',
    name: 'Chichen Itza (El Castillo)',
    lat: 20.6843,
    lon: -88.5678,
    color: '#14b8a6',
    category: 'ancient',
    desc: 'El Castillo has a reported echo phenomenon sometimes compared with a bird call. The comparison is an interpretation; the stair geometry is directly observable.',
  },
  {
    id: 'alexandria',
    name: 'Library of Alexandria',
    lat: 31.2001,
    lon: 29.9187,
    color: '#3b82f6',
    category: 'astronomy',
    desc: 'Alexandria was a major ancient scholarly center. Eratosthenes\' famous Earth-circumference estimate used observations between Syene and Alexandria; that calculation is not evidence of a local astronomical alignment.',
  },
  {
    id: 'nazca',
    name: 'Nazca Lines',
    lat: -14.7167,
    lon: -75.1333,
    color: '#f97316',
    category: 'ancient',
    desc: 'The Nazca Lines include large geoglyphs and straight lines. Proposed astronomical targets vary by study and should be tested against a defined survey dataset rather than assumed.',
  },
  {
    id: 'tokyo',
    name: 'Tokyo Celestial Hub',
    lat: 35.6762,
    lon: 139.6503,
    color: '#8b5cf6',
    category: 'custom',
    desc: 'Modern reference location only. The label \'audio-astronomy hub\' is an app category, not a documented historical or astronomical property.',
  },
];

// Vector coastline polygons [latitude, longitude] in degrees
// Captures authentic global continental outlines for full 3D Earth globe projection
export const CONTINENTAL_COASTLINES: [number, number][][] = [
  // Africa
  [
    [37.3, 9.8], [36.8, 10.3], [35.8, 10.6], [33.8, 11.0], [31.5, 25.0], [31.2, 32.3],
    [27.8, 34.3], [22.0, 36.9], [15.6, 39.5], [11.8, 43.3], [11.8, 51.3], [5.0, 48.0],
    [-0.5, 42.8], [-4.0, 39.6], [-10.5, 40.5], [-15.0, 40.6], [-25.0, 32.9], [-28.0, 32.6],
    [-34.8, 20.0], [-34.4, 18.5], [-30.0, 17.1], [-22.0, 14.4], [-16.0, 11.8], [-10.0, 13.0],
    [-5.0, 12.0], [4.5, 8.5], [4.8, 2.0], [5.0, -1.5], [4.5, -7.5], [6.5, -11.0],
    [9.5, -13.5], [12.0, -16.5], [14.8, -17.5], [16.5, -16.5], [21.0, -17.0], [26.0, -14.5],
    [31.0, -10.0], [35.9, -5.6], [35.5, -3.0], [36.0, 3.0], [37.3, 9.8]
  ],
  // Eurasia (Europe + Asia + Scandinavia + India + SE Asia)
  [
    [36.0, -5.5], [43.5, -9.3], [44.0, -1.2], [47.5, -3.0], [50.0, 1.5], [54.0, 8.5],
    [58.0, 11.5], [62.0, 5.0], [70.0, 20.0], [71.0, 28.0], [68.0, 40.0], [67.0, 50.0],
    [70.0, 60.0], [73.0, 72.0], [76.0, 110.0], [73.0, 140.0], [70.0, 170.0], [66.0, 170.0],
    [60.0, 163.0], [53.0, 143.0], [43.0, 132.0], [38.0, 125.0], [35.0, 119.0], [31.0, 122.0],
    [22.0, 114.0], [21.0, 108.0], [10.0, 107.0], [1.3, 104.0], [8.0, 98.0], [15.0, 96.0],
    [22.0, 90.0], [20.0, 86.0], [13.0, 80.0], [8.1, 77.5], [15.0, 74.0], [23.0, 69.0],
    [25.0, 62.0], [27.0, 56.0], [24.0, 57.0], [16.0, 53.0], [12.6, 43.5], [22.0, 38.0],
    [31.0, 34.5], [36.0, 36.0], [41.0, 28.0], [40.0, 23.0], [37.0, 22.0], [39.0, 16.0],
    [45.0, 13.0], [41.0, 9.0], [43.5, 7.0], [41.5, 2.0], [36.0, -5.5]
  ],
  // North America
  [
    [71.0, -156.0], [65.0, -168.0], [60.0, -165.0], [55.0, -160.0], [58.0, -137.0],
    [50.0, -127.0], [45.0, -124.0], [38.0, -123.0], [32.5, -117.0], [23.0, -110.0],
    [25.0, -107.0], [16.0, -95.0], [14.5, -92.0], [8.5, -83.0], [8.0, -77.5],
    [10.5, -75.0], [15.0, -83.0], [20.0, -87.0], [22.0, -97.0], [29.0, -94.0],
    [29.0, -89.0], [25.0, -80.5], [32.0, -81.0], [35.0, -75.5], [41.0, -72.0],
    [45.0, -66.0], [47.0, -53.0], [55.0, -60.0], [62.0, -65.0], [68.0, -85.0],
    [72.0, -95.0], [70.0, -130.0], [71.0, -156.0]
  ],
  // South America
  [
    [12.5, -71.5], [10.5, -62.0], [6.0, -55.0], [0.0, -50.0], [-5.0, -35.0],
    [-13.0, -38.5], [-23.0, -44.0], [-33.0, -53.0], [-38.0, -57.5], [-46.0, -66.0],
    [-54.0, -68.0], [-55.0, -66.0], [-52.0, -74.0], [-40.0, -74.0], [-23.0, -70.5],
    [-12.0, -77.0], [-5.0, -81.0], [1.0, -79.0], [8.0, -77.0], [12.5, -71.5]
  ],
  // Australia
  [
    [-12.0, 131.0], [-11.0, 142.5], [-20.0, 148.5], [-28.0, 153.5], [-37.5, 150.0],
    [-38.0, 144.5], [-35.0, 137.0], [-32.0, 128.5], [-34.5, 119.0], [-32.0, 115.5],
    [-22.0, 114.0], [-18.0, 122.0], [-15.0, 129.0], [-12.0, 131.0]
  ],
  // Antarctica
  [
    [-65.0, -64.0], [-70.0, -10.0], [-68.0, 40.0], [-66.0, 90.0], [-65.0, 135.0],
    [-70.0, 170.0], [-78.0, -170.0], [-72.0, -100.0], [-65.0, -64.0]
  ],
  // British Isles
  [
    [50.0, -5.2], [51.5, 1.4], [53.5, 0.0], [58.5, -3.0], [58.5, -5.0],
    [55.0, -5.0], [51.0, -4.5], [50.0, -5.2]
  ],
  // Japan
  [
    [45.0, 142.0], [43.0, 145.5], [38.0, 141.5], [35.0, 140.0], [33.5, 135.5],
    [31.5, 131.0], [33.5, 130.0], [36.0, 136.0], [40.0, 140.0], [45.0, 142.0]
  ],
  // Madagascar
  [
    [-12.0, 49.3], [-16.0, 49.8], [-25.0, 47.0], [-25.0, 44.5], [-16.0, 44.0], [-12.0, 49.3]
  ],
  // Greenland
  [
    [60.0, -44.0], [65.0, -38.0], [70.0, -22.0], [80.0, -18.0], [83.0, -35.0],
    [78.0, -70.0], [70.0, -54.0], [60.0, -44.0]
  ]
];

/**
 * Transforms latitude & longitude to 3D Cartesian coordinates (x, y, z)
 * incorporating Earth's axial tilt (23.44°) and diurnal rotation.
 */
export function latLonToCartesian(
  latDeg: number,
  lonDeg: number,
  radius: number,
  rotationDeg: number = 0,
  axialTiltDeg: number = 23.44
): { x: number; y: number; z: number } {
  const phi = (latDeg * Math.PI) / 180; // Latitude
  const lambda = ((lonDeg + rotationDeg) * Math.PI) / 180; // Longitude + Diurnal spin

  // Spherical coords before axial tilt
  const x0 = radius * Math.cos(phi) * Math.sin(lambda);
  const y0 = radius * Math.sin(phi);
  const z0 = radius * Math.cos(phi) * Math.cos(lambda);

  // Apply Earth's 23.44° axial tilt in the Y-Z plane
  const tiltRad = (axialTiltDeg * Math.PI) / 180;
  const x = x0;
  const y = y0 * Math.cos(tiltRad) - z0 * Math.sin(tiltRad);
  const z = y0 * Math.sin(tiltRad) + z0 * Math.cos(tiltRad);

  return { x, y, z };
}

/**
 * Reverse mapping: from 3D surface point on Earth back to latitude & longitude
 */
export function cartesianToLatLon(
  x: number,
  y: number,
  z: number,
  rotationDeg: number = 0,
  axialTiltDeg: number = 23.44
): { lat: number; lon: number } {
  // Invert axial tilt
  const tiltRad = (axialTiltDeg * Math.PI) / 180;
  const x0 = x;
  const y0 = y * Math.cos(tiltRad) + z * Math.sin(tiltRad);
  const z0 = -y * Math.sin(tiltRad) + z * Math.cos(tiltRad);

  const radius = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0);
  if (radius < 0.0001) return { lat: 0, lon: 0 };

  const lat = (Math.asin(Math.max(-1, Math.min(1, y0 / radius))) * 180) / Math.PI;
  let lon = (Math.atan2(x0, z0) * 180) / Math.PI - rotationDeg;

  // Normalize lon to [-180, 180]
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;

  return { lat, lon };
}

/** Historical places and modern reference cities already present in the app catalog. */
export interface LegacyHistoricalSite {
  name: string;
  lat: number;
  lon: number;
  year: number;
  isCity?: boolean;
}

export const LEGACY_HISTORICAL_SITES: LegacyHistoricalSite[] = [
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
