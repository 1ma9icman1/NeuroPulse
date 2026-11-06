/**
 * Geographic coordinate helpers shared by Earth rendering and site imports.
 * All application site records use WGS84 latitude/longitude in decimal degrees.
 */
export interface Wgs84Coordinate {
  lat: number;
  lon: number;
}

export function isValidWgs84Coordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Extract a coordinate pair from a Google Maps URL or a plain "lat,lon" value.
 * Google Maps URLs use latitude first, longitude second in these URL forms.
 * A place URL without embedded coordinates intentionally returns null: a
 * place name or Place ID is not silently converted into an approximate pin.
 */
export function parseGoogleMapsCoordinates(input: string): Wgs84Coordinate | null {
  const value = input.trim();
  if (!value) return null;

  const candidates: Array<[string, string]> = [];
  // !3d/!4d identifies the selected Google Maps feature. The @lat,lon
  // segment is only the current camera centre and is deliberately not trusted.
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) candidates.push([match[1], match[2]]);
  }

  try {
    const url = new URL(value);
    for (const key of ['q', 'query', 'll', 'center']) {
      const parameter = url.searchParams.get(key);
      if (!parameter) continue;
      const match = parameter.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (match) candidates.push([match[1], match[2]]);
    }
  } catch {
    const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) candidates.push([match[1], match[2]]);
  }

  for (const [latText, lonText] of candidates) {
    const lat = Number(latText);
    const lon = Number(lonText);
    if (isValidWgs84Coordinate(lat, lon)) return { lat, lon };
  }
  return null;
}

export function googleMapsCoordinateUrl(lat: number, lon: number): string {
  if (!isValidWgs84Coordinate(lat, lon)) {
    throw new RangeError('Cannot create a Google Maps link for invalid WGS84 coordinates.');
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
}

/** Map latitude to the vertical UV of the actual imagery export extent. */
export function latitudeToTextureV(latitude: number, south = -85, north = 85): number {
  if (!Number.isFinite(latitude) || !Number.isFinite(south) || !Number.isFinite(north) || south >= north) {
    throw new RangeError('Invalid latitude or imagery latitude extent.');
  }
  return Math.max(0, Math.min(1, (Math.max(south, Math.min(north, latitude)) - south) / (north - south)));
}

/**
 * Bilinearly sample a north-to-south, west-to-east global mesh at the exact
 * WGS84 coordinate. This matches the GPU's interpolation between terrain
 * vertices and avoids assigning a site's height from a neighbouring 1° cell.
 */
export function sampleSurfaceElevation(
  values: Float32Array,
  width: number,
  height: number,
  lat: number,
  lon: number,
  seaLevel = 0,
): number {
  if (!isValidWgs84Coordinate(lat, lon) || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 2 || height < 2 || values.length !== width * height || !Number.isFinite(seaLevel)) {
    throw new RangeError('Invalid grid or WGS84 coordinate for terrain sampling.');
  }

  const x = Math.max(0, Math.min(width - 1, ((lon + 180) / 360) * (width - 1)));
  const y = Math.max(0, Math.min(height - 1, ((90 - lat) / 180) * (height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;

  const surfaceHeight = (value: number) => value === 0 || value < seaLevel ? seaLevel : value;
  const a = surfaceHeight(values[y0 * width + x0]);
  const b = surfaceHeight(values[y0 * width + x1]);
  const c = surfaceHeight(values[y1 * width + x0]);
  const d = surfaceHeight(values[y1 * width + x1]);
  const north = a + (b - a) * fx;
  const south = c + (d - c) * fx;
  return north + (south - north) * fy;
}

/**
 * Interpolate the exact triangle used by the Three.js terrain index buffer.
 * The mesh uses triangles (a,c,b) and (b,c,d), split along b-c. Returning
 * the interpolated 3D point (rather than a radial height approximation)
 * keeps icons and selected markers attached to the rendered terrain surface.
 */
export function sampleTriangulatedSurfacePosition(
  positions: ArrayLike<number>,
  width: number,
  height: number,
  lat: number,
  lon: number,
  outwardOffset = 0,
): [number, number, number] {
  if (!isValidWgs84Coordinate(lat, lon) || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 2 || height < 2 || positions.length !== width * height * 3
    || !Number.isFinite(outwardOffset)) {
    throw new RangeError('Invalid terrain geometry or WGS84 coordinate for surface positioning.');
  }

  const x = Math.max(0, Math.min(width - 1, ((lon + 180) / 360) * (width - 1)));
  const y = Math.max(0, Math.min(height - 1, ((90 - lat) / 180) * (height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const u = x - x0;
  const v = y - y0;
  const a = (y0 * width + x0) * 3;
  const b = (y0 * width + x1) * 3;
  const c = (y1 * width + x0) * 3;
  const d = (y1 * width + x1) * 3;

  let px: number;
  let py: number;
  let pz: number;
  if (u + v <= 1) {
    const wa = 1 - u - v;
    px = positions[a] * wa + positions[b] * u + positions[c] * v;
    py = positions[a + 1] * wa + positions[b + 1] * u + positions[c + 1] * v;
    pz = positions[a + 2] * wa + positions[b + 2] * u + positions[c + 2] * v;
  } else {
    const wb = 1 - v;
    const wc = 1 - u;
    const wd = u + v - 1;
    px = positions[b] * wb + positions[c] * wc + positions[d] * wd;
    py = positions[b + 1] * wb + positions[c + 1] * wc + positions[d + 1] * wd;
    pz = positions[b + 2] * wb + positions[c + 2] * wc + positions[d + 2] * wd;
  }

  const magnitude = Math.hypot(px, py, pz);
  if (magnitude > 0 && outwardOffset !== 0) {
    const scale = outwardOffset / magnitude;
    px += px * scale;
    py += py * scale;
    pz += pz * scale;
  }
  return [px, py, pz];
}
