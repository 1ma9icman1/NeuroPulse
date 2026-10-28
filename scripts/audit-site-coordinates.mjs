#!/usr/bin/env node
/**
 * Coordinate audit for the NeuroPulse research-site catalogue.
 *
 * This is a review report, not an automatic claim of Google verification.
 * Google Maps does not expose bulk reverse-geocoding through a URL; each
 * candidate must be checked against the actual monument/feature, not just its
 * town or park. The report gives a direct Google Maps coordinate link per row.
 *
 * Run: node scripts/audit-site-coordinates.mjs
 * Output: reports/site-coordinate-audit.csv
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cataloguePath = resolve(root, 'src/data/researchSiteCatalog.ts');
const outputPath = resolve(root, 'reports/site-coordinate-audit.csv');
const source = readFileSync(cataloguePath, 'utf8');

// Catalogue entries currently use literal name/lat/lon fields. This captures
// those records without evaluating or importing application code.
const entryPattern = /\{\s*name:\s*(['"`])([^'"`]+)\1,\s*lat:\s*(-?\d+(?:\.\d+)?),\s*lon:\s*(-?\d+(?:\.\d+)?)/g;
const sites = [];
for (const match of source.matchAll(entryPattern)) {
  const name = match[2].trim();
  const lat = Number(match[3]);
  const lon = Number(match[4]);
  const latDigits = (match[3].split('.')[1] || '').length;
  const lonDigits = (match[4].split('.')[1] || '').length;
  const valid = Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  sites.push({ name, lat, lon, latDigits, lonDigits, valid });
}

const normalize = (s) => s.toLocaleLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const byName = new Map();
for (const site of sites) {
  const key = normalize(site.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(site);
}

const csv = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
const headers = [
  'name', 'latitude_current', 'longitude_current', 'valid_range',
  'latitude_decimal_places', 'longitude_decimal_places',
  'duplicate_name_count', 'same_name_coordinate_conflict',
  'audit_status', 'google_maps_feature_search_url', 'google_maps_coordinate_check_url'
];
const lines = [headers.map(csv).join(',')];
for (const site of sites) {
  const matches = byName.get(normalize(site.name)) || [];
  const distinctCoords = new Set(matches.map((x) => x.lat.toFixed(6) + ',' + x.lon.toFixed(6)));
  const conflict = distinctCoords.size > 1;
  const lowPrecision = Math.min(site.latDigits, site.lonDigits) < 4;
  const status = !site.valid ? 'INVALID_RANGE' :
    conflict ? 'DUPLICATE_NAME_COORDINATE_CONFLICT' :
    lowPrecision ? 'LOW_PRECISION_REVIEW' : 'VERIFY_FEATURE_LOCATION';
  // Open both the named feature and the stored coordinate. Comparing these two
  // views makes an off-site pin visible; neither URL alone proves accuracy.
  const featureUrl = 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(site.name);
  const coordinateUrl = 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(site.lat + ',' + site.lon);
  lines.push([
    site.name, site.lat, site.lon, site.valid ? 'yes' : 'no',
    site.latDigits, site.lonDigits, matches.length, conflict ? 'yes' : 'no',
    status, featureUrl, coordinateUrl
  ].map(csv).join(','));
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
const invalid = sites.filter((s) => !s.valid).length;
const conflicts = [...byName.values()].filter((group) =>
  new Set(group.map((x) => x.lat.toFixed(6) + ',' + x.lon.toFixed(6))).size > 1
).length;
const lowPrecision = sites.filter((s) => Math.min(s.latDigits, s.lonDigits) < 4).length;
console.log(`Scanned ${sites.length} catalogue entries.`);
console.log(`Invalid coordinate ranges: ${invalid}`);
console.log(`Names with conflicting coordinates: ${conflicts}`);
console.log(`Entries needing precision review (<4 decimal places): ${lowPrecision}`);
console.log(`Wrote ${outputPath}`);
console.log('Google Maps links open each stored coordinate; manually confirm the pin is on the named feature before marking it verified.');
