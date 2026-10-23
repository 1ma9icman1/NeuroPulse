export interface StarAstrometryInput {
  name: string;
  raDeg: number;
  decDeg: number;
}

export interface StarAstrometryResult {
  raDeg: number;
  decDeg: number;
  source: string;
  epoch: number;
  properMotionApplied: boolean;
}

export interface EarthTarget {
  latitude: number;
  longitude: number;
  date: string;
  utcTime: string;
  source: string;
  raDeg: number;
  decDeg: number;
}

const wrapDegrees = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

/** Gaia DR3 cone search with a short timeout; catalog coordinates remain the offline fallback. */
export async function resolveStarAstrometry(
  star: StarAstrometryInput,
  date: Date,
): Promise<StarAstrometryResult> {
  const fallback: StarAstrometryResult = {
    raDeg: star.raDeg,
    decDeg: star.decDeg,
    source: 'Bundled real-star catalog (offline fallback)',
    epoch: 2000,
    properMotionApplied: false,
  };

  try {
    const adql = `SELECT TOP 1 ra, dec, pmra, pmdec, ref_epoch
      FROM gaiadr3.gaia_source
      WHERE DISTANCE(POINT('ICRS', ra, dec), POINT('ICRS', ${star.raDeg}, ${star.decDeg})) < 0.02
      AND pmra IS NOT NULL AND pmdec IS NOT NULL
      ORDER BY DISTANCE(POINT('ICRS', ra, dec), POINT('ICRS', ${star.raDeg}, ${star.decDeg})) ASC`;
    const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'json', QUERY: adql });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2200);
    try {
      const response = await fetch('https://gea.esac.esa.int/tap-server/tap/sync', {
        method: 'POST',
        body,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      });
      if (!response.ok) throw new Error(`Gaia HTTP ${response.status}`);
      const json = await response.json();
      const fields: string[] = (json.metadata || []).map((field: { name: string }) => field.name);
      const row: unknown[] | undefined = json.data?.[0];
      if (!row) return fallback;
      const value = (key: string) => Number(row[fields.indexOf(key)]);
      const ra = value('ra');
      const dec = value('dec');
      const pmra = value('pmra');
      const pmdec = value('pmdec');
      const epoch = value('ref_epoch');
      if (![ra, dec, pmra, pmdec, epoch].every(Number.isFinite)) return fallback;
      const years = date.getUTCFullYear() + (date.getUTCMonth() + 0.5) / 12 - epoch;
      const cosDec = Math.max(0.05, Math.cos((dec * Math.PI) / 180));
      return {
        raDeg: ((ra + (pmra * years) / (3_600_000 * cosDec)) % 360 + 360) % 360,
        decDeg: Math.max(-90, Math.min(90, dec + (pmdec * years) / 3_600_000)),
        source: 'ESA Gaia DR3 + proper motion',
        epoch,
        properMotionApplied: true,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    return fallback;
  }
}

let iersDailyCache: { fetchedAt: number; rows: Array<{ mjd: number; dut1: number }> } | null = null;

/** Fast, optional IERS daily Earth-orientation correction. Falls back to UTC-only GMST if unavailable. */
export async function fetchIersDut1Seconds(date: Date): Promise<number | null> {
  if (date.getUTCFullYear() !== new Date().getUTCFullYear()) return null;
  if (iersDailyCache && Date.now() - iersDailyCache.fetchedAt < 6 * 60 * 60 * 1000) {
    const mjd = date.getTime() / 86400000 + 40587;
    const row = iersDailyCache.rows.reduce((best, item) => Math.abs(item.mjd - mjd) < Math.abs(best.mjd - mjd) ? item : best);
    return Math.abs(row.mjd - mjd) <= 2 ? row.dut1 : null;
  }
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1600);
    try {
      const response = await fetch('https://datacenter.iers.org/products/eop/rapid/daily/finals2000A.daily', { signal: controller.signal });
      if (!response.ok) return null;
      const lines = (await response.text()).split(String.fromCharCode(10));
      const rows = lines.map((line) => {
        const fields = (line.trim().match(/\S+/g) || []);
        return { mjd: Number(fields[2]), dut1: Number(fields[9]) };
      }).filter((row) => Number.isFinite(row.mjd) && Number.isFinite(row.dut1));
      if (!rows.length) return null;
      iersDailyCache = { fetchedAt: Date.now(), rows };
      const mjd = date.getTime() / 86400000 + 40587;
      const row = rows.reduce((best, item) => Math.abs(item.mjd - mjd) < Math.abs(best.mjd - mjd) ? item : best);
      return Math.abs(row.mjd - mjd) <= 2 ? row.dut1 : null;
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

/** Calculate the star's substellar point using UTC, GMST, and optional IERS UT1−UTC correction. */
export function calculateSubstellarPoint(raDeg: number, decDeg: number, date: Date, source: string, dut1Seconds = 0): EarthTarget {
  const jd = date.getTime() / 86_400_000 + 2440587.5 + dut1Seconds / 86400;
  const t = (jd - 2451545.0) / 36525;
  const gmst = ((280.46061837 + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * t * t - (t * t * t) / 38710000) % 360 + 360) % 360;
  return {
    latitude: Math.max(-90, Math.min(90, decDeg)),
    longitude: wrapDegrees(raDeg - gmst),
    date: date.toISOString().slice(0, 10),
    utcTime: date.toISOString().slice(11, 19) + ' UTC',
    source,
    raDeg,
    decDeg,
  };
}

export interface PlaceImage {
  title: string;
  url: string;
  description: string;
  source: string;
  pageUrl?: string;
}

/** Nearby, geotagged Commons photos first; NASA is a contextual fallback when Commons has none. */
export async function fetchPlaceImages(latitude: number, longitude: number, placeName: string): Promise<PlaceImage[]> {
  try {
    const params = new URLSearchParams({
      action: 'query', generator: 'geosearch', ggscoord: `${latitude}|${longitude}`,
      ggsradius: '10000', ggsnamespace: '6', ggslimit: '30',
      prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1000', format: 'json', origin: '*',
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Commons unavailable');
      const json = await response.json();
      const pages = Object.values(json.query?.pages || {}) as Array<any>;
      const images = pages.map((page) => {
        const info = page.imageinfo?.[0];
        const url = info?.thumburl || info?.url;
        if (!url || !(url.startsWith('https://') || url.startsWith('http://'))) return null;
        return {
          title: String(page.title || 'Location photograph').replace(/^File:/, ''),
          url,
          description: String(info.extmetadata?.ImageDescription?.value || 'Geotagged photograph near this location.').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim(),
          source: 'Wikimedia Commons geotagged photo',
          pageUrl: info.descriptionurl,
        } as PlaceImage;
      }).filter((image): image is PlaceImage => Boolean(image))
        .filter((image, index, all) => all.findIndex((other) => other.url === image.url) === index)
        .slice(0, 20);
      if (images.length) return images;
    } finally { window.clearTimeout(timeout); }
  } catch { /* Try NASA's public image library when Commons has no geotagged photos. */ }

  try {
    const query = encodeURIComponent(`${latitude.toFixed(2)}, ${longitude.toFixed(2)} ${placeName} Earth landscape`);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`https://images-api.nasa.gov/search?q=${query}&media_type=image&page_size=12`, { signal: controller.signal });
      if (!response.ok) return [];
      const json = await response.json();
      return (json.collection?.items || []).map((item: any) => {
        const link = item.links?.find((entry: any) => entry.render === 'image');
        if (!link?.href || !(link.href.startsWith('https://') || link.href.startsWith('http://'))) return null;
        const nasaId = item.data?.[0]?.nasa_id;
        return {
          title: item.data?.[0]?.title || `Regional imagery near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
          url: link.href,
          description: item.data?.[0]?.description || 'NASA library result; may show regional context rather than the exact ground site.',
          source: 'NASA Image and Video Library (regional context)',
          pageUrl: nasaId ? `https://images.nasa.gov/details/${nasaId}` : undefined,
        } as PlaceImage;
      }).filter((image: PlaceImage | null): image is PlaceImage => Boolean(image)).slice(0, 12);
    } finally { window.clearTimeout(timeout); }
  } catch { return []; }
}

/** Backward-compatible single-image helper. */
export async function fetchPlaceImage(latitude: number, longitude: number, placeName: string): Promise<PlaceImage | null> {
  return (await fetchPlaceImages(latitude, longitude, placeName))[0] || null;
}
