#!/usr/bin/env node
/**
 * Cross-catalogue coordinate audit.
 *
 * This report validates WGS84 ranges, identifies low-precision pins and
 * conflicting duplicate names, and emits side-by-side Google Maps feature and
 * stored-coordinate links. It deliberately does NOT claim a coordinate is
 * Google-verified: the named physical entrance/structure must be compared to
 * the stored pin before its record can be marked verified.
 *
 * Run: npm run audit:coordinates
 * Output: reports/site-coordinate-audit.csv
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cataloguePaths = [
  'src/data/earthData.ts',
  'src/data/researchSiteCatalog.ts',
  'src/data/undergroundSiteCatalog.ts',
];
const sites = [];
const entryPattern = /\{\s*name:\s*(['"`])([^'"`]+)\1,\s*lat:\s*(-?\d+(?:\.\d+)?),\s*lon:\s*(-?\d+(?:\.\d+)?)/g;

for (const relativePath of cataloguePaths) {
  const cataloguePath = resolve(root, relativePath);
  if (!existsSync(cataloguePath)) continue;
  const source = readFileSync(cataloguePath, 'utf8');
  for (const match of source.matchAll(entryPattern)) {
    const name = match[2].trim();
    const lat = Number(match[3]);
    const lon = Number(match[4]);
    const latDigits = (match[3].split('.')[1] || '').length;
    const lonDigits = (match[4].split('.')[1] || '').length;
    const valid = Number.isFinite(lat) && Number.isFinite(lon)
      && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    sites.push({ sourceFile: relativePath, name, lat, lon, latDigits, lonDigits, valid });
  }
}

const normalize = value => value.toLocaleLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const byName = new Map();
for (const site of sites) {
  const key = normalize(site.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(site);
}

const csv = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
const headers = [
  'source_file', 'name', 'latitude', 'longitude', 'valid_wgs84_range',
  'latitude_decimal_places', 'longitude_decimal_places',
  'same_name_record_count', 'same_name_coordinate_conflict',
  'audit_status', 'google_maps_feature_search_url', 'google_maps_stored_coordinate_url',
];
const lines = [headers.map(csv).join(',')];
for (const site of sites) {
  const matches = byName.get(normalize(site.name)) || [];
  const distinctCoords = new Set(matches.map(item => item.lat.toFixed(7) + ',' + item.lon.toFixed(7)));
  const conflict = distinctCoords.size > 1;
  const lowPrecision = Math.min(site.latDigits, site.lonDigits) < 4;
  const status = !site.valid ? 'INVALID_WGS84_RANGE'
    : conflict ? 'DUPLICATE_NAME_COORDINATE_CONFLICT'
      : lowPrecision ? 'LOW_PRECISION_REVIEW'
        : 'FEATURE_LOCATION_REQUIRES_VISUAL_VERIFICATION';
  const featureUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(site.name);
  const coordinateUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(site.lat + ',' + site.lon);
  lines.push([
    site.sourceFile, site.name, site.lat, site.lon, site.valid ? 'yes' : 'no',
    site.latDigits, site.lonDigits, matches.length, conflict ? 'yes' : 'no',
    status, featureUrl, coordinateUrl,
  ].map(csv).join(','));
}

const outputPath = resolve(root, 'reports/site-coordinate-audit.csv');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
const invalid = sites.filter(site => !site.valid).length;
const lowPrecision = sites.filter(site => site.valid && Math.min(site.latDigits, site.lonDigits) < 4).length;
const conflicts = [...byName.values()].filter(group =>
  new Set(group.map(item => item.lat.toFixed(7) + ',' + item.lon.toFixed(7))).size > 1
).length;
console.log(`Scanned ${sites.length} records across ${cataloguePaths.filter(path => existsSync(resolve(root, path))).length} catalogue files.`);
console.log(`Invalid WGS84 coordinate ranges: ${invalid}`);
console.log(`Names with conflicting coordinates: ${conflicts}`);
console.log(`Low-precision records (<4 decimal places): ${lowPrecision}`);
console.log(`Wrote ${outputPath}`);
console.log('Every valid record still requires visual confirmation that the stored coordinate is on the named physical feature.');
