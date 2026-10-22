/**
 * On-demand HYG v4.1 star catalog ordered from nearest to farthest.
 * Source: Astronexus HYG Database v4.1. CC BY-SA 4.0.
 * https://github.com/astronexus/HYG-Database
 * Loaded only when ALL STARS is explicitly enabled; not part of startup.
 */
export interface HYGStar {
  id: string; name: string; raDeg: number; decDeg: number;
  distanceLy: number; magnitude: number; color: string;
  spectralType: string; constellation: string;
}
const HYG_V41_CSV_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
const PARSEC_TO_LIGHT_YEAR = 3.261563777;
let cachedCatalogPromise: Promise<HYGStar[]> | null = null;

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let value = '';
  let inQuotes = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (inQuotes && row[index + 1] === '"') { value += '"'; index += 1; }
      else inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) { values.push(value); value = ''; }
    else value += character;
  }
  values.push(value);
  return values;
}
function spectralColor(spectralType: string, colorIndex: number): string {
  const type = spectralType.trim().toUpperCase()[0];
  if (type === 'O') return '#9bbcff';
  if (type === 'B') return '#b8d0ff';
  if (type === 'A') return '#e3eaff';
  if (type === 'F') return '#fff4e3';
  if (type === 'G') return '#fff0be';
  if (type === 'K') return '#ffd09a';
  if (type === 'M') return '#ff9d78';
  if (Number.isFinite(colorIndex)) {
    if (colorIndex < -0.2) return '#9bbcff';
    if (colorIndex < 0.1) return '#dbe6ff';
    if (colorIndex < 0.45) return '#fff4e3';
    if (colorIndex < 0.8) return '#ffe4ad';
    return '#ffae83';
  }
  return '#e5edff';
}
async function fetchCatalog(): Promise<HYGStar[]> {
  const response = await fetch(HYG_V41_CSV_URL, { headers: { Accept: 'text/csv,*/*' } });
  if (!response.ok) throw new Error('HYG star catalog download failed (HTTP ' + response.status + ').');
  const csv = await response.text();
  const newline = csv.indexOf('\n');
  if (newline < 0) throw new Error('HYG star catalog is empty or not a CSV file.');
  const headers = parseCsvRow(csv.slice(0, newline).replace(/\r$/, ''));
  const column = (name: string) => headers.indexOf(name);
  const col = {
    hip: column('hip'), hd: column('hd'), proper: column('proper'), ra: column('ra'),
    dec: column('dec'), dist: column('dist'), mag: column('mag'), spect: column('spect'),
    ci: column('ci'), bayer: column('bayer'), flam: column('flam'), con: column('con'),
  };
  if (col.ra < 0 || col.dec < 0 || col.dist < 0 || col.mag < 0) throw new Error('HYG catalog schema lacks expected astrometry columns.');
  const stars: HYGStar[] = [];
  const parse = (row: string) => {
    if (!row) return;
    const f = parseCsvRow(row);
    const pc = Number(f[col.dist]), ra = Number(f[col.ra]), dec = Number(f[col.dec]), mag = Number(f[col.mag]);
    // Exclude distance placeholders (100,000 pc) rather than sorting guesses as real distances.
    if (!Number.isFinite(pc) || pc <= 0 || pc >= 100000 || !Number.isFinite(ra) ||
      ra < 0 || ra >= 24 || !Number.isFinite(dec) || dec < -90 || dec > 90 || !Number.isFinite(mag)) return;
    const distanceLy = pc * PARSEC_TO_LIGHT_YEAR;
    // The UI intentionally caps its distance slider at 100,000 light-years; keep
    // the catalog count consistent with the maximum the user can actually reveal.
    if (distanceLy > 100000) return;
    const proper = (f[col.proper] || '').trim();
    const bayer = (f[col.bayer] || '').trim();
    const flam = (f[col.flam] || '').trim();
    const con = (f[col.con] || '').trim();
    const hip = (f[col.hip] || '').trim();
    const hd = (f[col.hd] || '').trim();
    const name = proper || (bayer ? bayer + ' ' + con : flam ? flam + ' ' + con : hip ? 'HIP ' + hip : hd ? 'HD ' + hd : 'HYG ' + f[0]);
    const spect = (f[col.spect] || '').trim();
    const ci = Number(f[col.ci]);
    stars.push({
      id: hip || f[0], name, raDeg: ra * 15, decDeg: dec, distanceLy,
      magnitude: mag, color: spectralColor(spect, ci), spectralType: spect || 'Unknown', constellation: con,
    });
  };
  let rowStart = newline + 1;
  for (let offset = rowStart; offset < csv.length; offset += 1) {
    if (csv.charCodeAt(offset) !== 10) continue;
    parse(csv.slice(rowStart, offset).replace(/\r$/, ''));
    rowStart = offset + 1;
  }
  if (rowStart < csv.length) parse(csv.slice(rowStart).replace(/\r$/, ''));
  stars.sort((a, b) => a.distanceLy - b.distanceLy);
  if (stars.length < 1000) throw new Error('HYG catalog loaded, but too few valid star distances were found.');
  return stars;
}
export function loadHYGStarCatalog(): Promise<HYGStar[]> {
  if (!cachedCatalogPromise) cachedCatalogPromise = fetchCatalog().catch((error: unknown) => {
    cachedCatalogPromise = null;
    throw error;
  });
  return cachedCatalogPromise;
}
export const HYG_STAR_CATALOG_SOURCE = 'HYG Database v4.1 by Astronexus · CC BY-SA 4.0';
