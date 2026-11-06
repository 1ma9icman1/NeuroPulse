import test from 'node:test';
import assert from 'node:assert/strict';
import {
  googleMapsCoordinateUrl,
  isValidWgs84Coordinate,
  latitudeToTextureV,
  parseGoogleMapsCoordinates,
  sampleSurfaceElevation,
  sampleTriangulatedSurfacePosition,
} from '../src/lib/siteCoordinates.ts';

test('validates WGS84 latitude and longitude ranges', () => {
  assert.equal(isValidWgs84Coordinate(29.9792, 31.1342), true);
  assert.equal(isValidWgs84Coordinate(90, 180), true);
  assert.equal(isValidWgs84Coordinate(90.01, 0), false);
  assert.equal(isValidWgs84Coordinate(0, -180.01), false);
});

test('extracts coordinates from Google Maps URL forms without swapping axes', () => {
  assert.equal(parseGoogleMapsCoordinates('https://www.google.com/maps/@29.9792,31.1342,17z'), null, 'viewport centre is not the selected feature coordinate');
  assert.deepEqual(parseGoogleMapsCoordinates('https://www.google.com/maps/place/Test/data=!3m1!4b1!4m2!3m1!1s0x0!3m1!1s0x0!3d29.9792!4d31.1342'), { lat: 29.9792, lon: 31.1342 });
  assert.deepEqual(parseGoogleMapsCoordinates('https://www.google.com/maps?query=-13.1633,-72.5456'), { lat: -13.1633, lon: -72.5456 });
  assert.deepEqual(parseGoogleMapsCoordinates('-13.1633,-72.5456'), { lat: -13.1633, lon: -72.5456 });
});

test('does not invent coordinates for a Google Maps place URL without a coordinate pair', () => {
  assert.equal(parseGoogleMapsCoordinates('https://www.google.com/maps/place/Stonehenge/'), null);
  assert.equal(parseGoogleMapsCoordinates('not a coordinate'), null);
});

test('creates a direct Google Maps coordinate link', () => {
  assert.equal(googleMapsCoordinateUrl(29.9792, 31.1342), 'https://www.google.com/maps/search/?api=1&query=29.9792%2C31.1342');
  assert.throws(() => googleMapsCoordinateUrl(91, 0), RangeError);
});

test('maps the imagery export latitude extent rather than stretching it over both poles', () => {
  assert.equal(latitudeToTextureV(85), 1);
  assert.equal(latitudeToTextureV(0), 0.5);
  assert.equal(latitudeToTextureV(-85), 0);
  assert.equal(latitudeToTextureV(90), 1);
  assert.equal(latitudeToTextureV(-90), 0);
});

test('bilinearly samples the exact coordinate and applies the water datum consistently', () => {
  const grid = new Float32Array([0, 10, 20, 30]);
  assert.equal(sampleSurfaceElevation(grid, 2, 2, 0, 0, 0), 15);
  assert.equal(sampleSurfaceElevation(grid, 2, 2, 90, -180, 0), 0);
  assert.equal(sampleSurfaceElevation(grid, 2, 2, 0, 0, 12), 18);
});

test('samples exact mesh vertices without moving their geographic coordinate', () => {
  const grid = new Float32Array([100, 200, 300, 400]);
  assert.equal(sampleSurfaceElevation(grid, 2, 2, 90, -180), 100);
  assert.equal(sampleSurfaceElevation(grid, 2, 2, -90, 180), 400);
});

test('places markers on the same split triangle used by the terrain mesh', () => {
  // a=(0,0,0), b=(1,0,0), c=(0,1,0), d=(1,1,1)
  const vertices = new Float32Array([
    0, 0, 0,  1, 0, 0,
    0, 1, 0,  1, 1, 1,
  ]);
  assert.deepEqual(sampleTriangulatedSurfacePosition(vertices, 2, 2, 0, 0), [0.5, 0.5, 0]);
  assert.deepEqual(sampleTriangulatedSurfacePosition(vertices, 2, 2, -45, 90), [0.75, 0.75, 0.5]);
});

test('applies marker offset along the local outward direction', () => {
  const vertices = new Float32Array([
    0, 0, 10,  10, 0, 10,
    0, 10, 10,  10, 10, 10,
  ]);
  const [x, y, z] = sampleTriangulatedSurfacePosition(vertices, 2, 2, 0, 0, 1);
  assert.ok(Math.abs(Math.hypot(x, y, z) - (Math.hypot(5, 5, 10) + 1)) < 1e-10);
});
