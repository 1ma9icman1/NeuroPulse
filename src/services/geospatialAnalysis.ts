/**
 * WGS84 geodesic calculations for NeuroPulse site-to-site research.
 *
 * Uses Vincenty's inverse solution on the WGS84 ellipsoid. If the points are
 * nearly antipodal and the iteration does not converge, falls back to a
 * spherical great-circle calculation and marks the result as approximate.
 *
 * Bearings are initial forward azimuths clockwise from true north, in degrees.
 */
export interface GeographicPoint {
  lat: number;
  lon: number;
}

export interface GeodesicResult {
  distanceMeters: number;
  distanceKm: number;
  initialBearingDegrees: number;
  method: 'WGS84 Vincenty' | 'spherical fallback';
  approximate: boolean;
}

const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = (1 - WGS84_F) * WGS84_A;
const MEAN_EARTH_RADIUS_M = 6371008.8;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function validatePoint(point: GeographicPoint, label: string): void {
  if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) {
    throw new RangeError(`${label}.lat must be a finite number between -90 and 90 degrees`);
  }
  if (!Number.isFinite(point.lon) || point.lon < -180 || point.lon > 180) {
    throw new RangeError(`${label}.lon must be a finite number between -180 and 180 degrees`);
  }
}

function normalizeBearing(degrees: number): number {
  return (degrees % 360 + 360) % 360;
}

function sphericalFallback(a: GeographicPoint, b: GeographicPoint): GeodesicResult {
  const phi1 = a.lat * DEG_TO_RAD;
  const phi2 = b.lat * DEG_TO_RAD;
  const deltaPhi = phi2 - phi1;
  const deltaLambda = (b.lon - a.lon) * DEG_TO_RAD;
  const h = Math.min(1, Math.max(0,
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  ));
  const centralAngle = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const bearing = centralAngle < 1e-14 ? 0 : normalizeBearing(Math.atan2(y, x) * RAD_TO_DEG);
  const distanceMeters = MEAN_EARTH_RADIUS_M * centralAngle;
  return {
    distanceMeters,
    distanceKm: distanceMeters / 1000,
    initialBearingDegrees: bearing,
    method: 'spherical fallback',
    approximate: true,
  };
}

/** Calculate ellipsoidal distance and initial bearing between WGS84 coordinates. */
export function calculateGeodesic(a: GeographicPoint, b: GeographicPoint): GeodesicResult {
  validatePoint(a, 'start');
  validatePoint(b, 'end');

  if (a.lat === b.lat && a.lon === b.lon) {
    return {
      distanceMeters: 0,
      distanceKm: 0,
      initialBearingDegrees: 0,
      method: 'WGS84 Vincenty',
      approximate: false,
    };
  }

  const phi1 = a.lat * DEG_TO_RAD;
  const phi2 = b.lat * DEG_TO_RAD;
  const rawLongitudeDelta = (b.lon - a.lon) * DEG_TO_RAD;
  // Normalize to the shortest longitude difference across the antimeridian.
  const L = Math.atan2(Math.sin(rawLongitudeDelta), Math.cos(rawLongitudeDelta));
  const U1 = Math.atan((1 - WGS84_F) * Math.tan(phi1));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(phi2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);
  let lambda = L;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let sinAlpha = 0;
  let cosSqAlpha = 0;
  let cos2SigmaM = 0;
  let converged = false;

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    const first = cosU2 * sinLambda;
    const second = cosU1 * sinU2 - sinU1 * cosU2 * cosLambda;
    sinSigma = Math.hypot(first, second);
    if (sinSigma < 1e-15) {
      return {
        distanceMeters: 0,
        distanceKm: 0,
        initialBearingDegrees: 0,
        method: 'WGS84 Vincenty',
        approximate: false,
      };
    }

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha > 1e-15
      ? cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha
      : 0;

    const C = WGS84_F / 16 * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
    const nextLambda = L + (1 - C) * WGS84_F * sinAlpha * (
      sigma + C * sinSigma * (
        cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)
      )
    );

    if (Math.abs(nextLambda - lambda) < 1e-12) {
      lambda = nextLambda;
      converged = true;
      break;
    }
    lambda = nextLambda;
  }

  if (!converged) return sphericalFallback(a, b);

  const uSq = cosSqAlpha * (WGS84_A ** 2 - WGS84_B ** 2) / WGS84_B ** 2;
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma = B * sinSigma * (
    cos2SigmaM + B / 4 * (
      cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
      B / 6 * cos2SigmaM * (-3 + 4 * sinSigma ** 2) *
      (-3 + 4 * cos2SigmaM ** 2)
    )
  );
  const distanceMeters = WGS84_B * A * (sigma - deltaSigma);
  const initialBearingDegrees = normalizeBearing(Math.atan2(
    cosU2 * Math.sin(lambda),
    cosU1 * sinU2 - sinU1 * cosU2 * Math.cos(lambda)
  ) * RAD_TO_DEG);

  return {
    distanceMeters,
    distanceKm: distanceMeters / 1000,
    initialBearingDegrees,
    method: 'WGS84 Vincenty',
    approximate: false,
  };
}

/** Convenience helper for existing distance-only workflows. */
export function geodesicDistanceKm(a: GeographicPoint, b: GeographicPoint): number {
  return calculateGeodesic(a, b).distanceKm;
}
