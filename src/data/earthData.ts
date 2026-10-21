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
