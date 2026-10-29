/**
 * Global elevation samples from the Copernicus DEM GLO-90 dataset.
 *
 * Open-Meteo documents its elevation endpoint as based on Copernicus DEM 2021
 * GLO-90. We request measured samples in batches, never generate synthetic relief.
 * The coarse global sample grid is cached in IndexedDB; the globe mesh may
 * interpolate between samples for display, but no elevation values are invented.
 */
export const COPERNICUS_GRID_WIDTH = 360;
export const COPERNICUS_GRID_HEIGHT = 180;
export const COPERNICUS_DATASET = 'Copernicus DEM GLO-90 (2021)';

const CACHE_DB = 'neuropulse-copernicus-dem';
const CACHE_STORE = 'rasters';
const CACHE_KEY = 'copernicus-glo90-global-1deg-v1';
const BATCH_SIZE = 100;
// The public elevation endpoint rate-limits burst traffic. Keep global sampling serialized.
const CONCURRENCY = 1;
const REQUEST_SPACING_MS = 300;

type CachedRaster = { key: string; width: number; height: number; values: ArrayBuffer; savedAt: number };

function openCache(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const request = indexedDB.open(CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readCache(): Promise<Float32Array | null> {
  const db = await openCache();
  if (!db) return null;
  return new Promise(resolve => {
    const request = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(CACHE_KEY);
    request.onsuccess = () => {
      const value = request.result as CachedRaster | undefined;
      if (!value || value.width !== COPERNICUS_GRID_WIDTH || value.height !== COPERNICUS_GRID_HEIGHT) {
        resolve(null);
        return;
      }
      resolve(new Float32Array(value.values.slice(0)));
      db.close();
    };
    request.onerror = () => { db.close(); resolve(null); };
  });
}

async function writeCache(values: Float32Array): Promise<void> {
  const db = await openCache();
  if (!db) return;
  await new Promise<void>(resolve => {
    const record: CachedRaster = {
      key: CACHE_KEY,
      width: COPERNICUS_GRID_WIDTH,
      height: COPERNICUS_GRID_HEIGHT,
      values: values.slice().buffer,
      savedAt: Date.now(),
    };
    const transaction = db.transaction(CACHE_STORE, 'readwrite');
    transaction.objectStore(CACHE_STORE).put(record);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); resolve(); };
  });
}

type SamplePoint = { index: number; latitude: number; longitude: number };

function createPoints(): SamplePoint[] {
  const points: SamplePoint[] = [];
  for (let y = 0; y < COPERNICUS_GRID_HEIGHT; y++) {
    // Sample each 1-degree cell at its centre to avoid ambiguous tile edges.
    const latitude = 89.5 - y;
    for (let x = 0; x < COPERNICUS_GRID_WIDTH; x++) {
      points.push({ index: y * COPERNICUS_GRID_WIDTH + x, latitude, longitude: -179.5 + x });
    }
  }
  return points;
}

async function fetchBatch(points: SamplePoint[], signal: AbortSignal): Promise<Array<{ index: number; elevation: number }>> {
  const latitude = points.map(point => point.latitude.toFixed(1)).join(',');
  const longitude = points.map(point => point.longitude.toFixed(1)).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (signal.aborted) throw new DOMException('Copernicus elevation load cancelled', 'AbortError');
    try {
      const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (response.status === 429 || response.status >= 500) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const backoffMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? Math.min(60_000, retryAfterSeconds * 1000)
          : Math.min(30_000, 1_500 * (2 ** attempt));
        lastError = new Error(
          response.status === 429
            ? `Copernicus elevation sampling service is rate-limiting requests (HTTP 429). ${attempt < 4 ? `Retrying after ${Math.ceil(backoffMs / 1000)} seconds.` : 'Automatic retry limit reached.'}`
            : `Copernicus elevation sampling service returned HTTP ${response.status}. ${attempt < 4 ? 'Retrying shortly.' : 'Automatic retry limit reached.'}`
        );
        if (attempt < 4) await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      if (!response.ok) throw new Error(`Copernicus elevation sampling failed (HTTP ${response.status})`);
      const data = await response.json() as { elevation?: unknown };
      const elevations = data.elevation;
      if (!Array.isArray(elevations) || elevations.length !== points.length) {
        throw new Error('Copernicus elevation service returned an incomplete sample batch.');
      }
      return points.map((point, i) => {
        const elevation = Number(elevations[i]);
        if (!Number.isFinite(elevation)) throw new Error(`Invalid Copernicus elevation sample at ${point.latitude}, ${point.longitude}`);
        return { index: point.index, elevation };
      });
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      lastError = error instanceof Error ? error : new Error('Copernicus elevation request failed');
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, Math.min(15_000, 1_000 * (2 ** attempt))));
    }
  }
  throw lastError ?? new Error('Copernicus elevation request failed after retries.');
}

export async function loadCopernicusGlobalSamples(
  signal: AbortSignal,
  onProgress?: (completed: number, total: number, fromCache: boolean) => void,
): Promise<{ values: Float32Array; fromCache: boolean }> {
  const cached = await readCache();
  if (signal.aborted) throw new DOMException('Copernicus elevation load cancelled', 'AbortError');
  if (cached && cached.length === COPERNICUS_GRID_WIDTH * COPERNICUS_GRID_HEIGHT) {
    onProgress?.(cached.length, cached.length, true);
    return { values: cached, fromCache: true };
  }

  const points = createPoints();
  const batches: SamplePoint[][] = [];
  for (let i = 0; i < points.length; i += BATCH_SIZE) batches.push(points.slice(i, i + BATCH_SIZE));
  const values = new Float32Array(points.length);
  let nextBatch = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      if (signal.aborted) throw new DOMException('Copernicus elevation load cancelled', 'AbortError');
      const batchIndex = nextBatch++;
      if (batchIndex >= batches.length) return;
      const samples = await fetchBatch(batches[batchIndex], signal);
      for (const sample of samples) values[sample.index] = sample.elevation;
      completed += samples.length;
      onProgress?.(completed, points.length, false);
      // Leave a small gap between successful calls to avoid triggering provider burst limits.
      if (nextBatch < batches.length && !signal.aborted) await new Promise(resolve => setTimeout(resolve, REQUEST_SPACING_MS));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  if (signal.aborted) throw new DOMException('Copernicus elevation load cancelled', 'AbortError');
  if (values.some(value => !Number.isFinite(value))) throw new Error('Copernicus DEM returned missing or invalid global elevation samples.');
  await writeCache(values);
  return { values, fromCache: false };
}

/** Bilinear resampling from measured global samples to the existing Three.js mesh grid. */
export function resampleCopernicusGrid(source: Float32Array, targetWidth: number, targetHeight: number): Float32Array {
  if (source.length !== COPERNICUS_GRID_WIDTH * COPERNICUS_GRID_HEIGHT) {
    throw new Error('Copernicus global sample grid has an unexpected size.');
  }
  const target = new Float32Array(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y++) {
    const sourceY = Math.max(0, Math.min(COPERNICUS_GRID_HEIGHT - 1, ((y / (targetHeight - 1)) * 180 - 0.5)));
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(COPERNICUS_GRID_HEIGHT - 1, y0 + 1);
    const fy = sourceY - y0;
    for (let x = 0; x < targetWidth; x++) {
      // The longitude sample grid is periodic across the antimeridian.
      const sourceX = ((((x / (targetWidth - 1)) * 360 - 0.5) % COPERNICUS_GRID_WIDTH) + COPERNICUS_GRID_WIDTH) % COPERNICUS_GRID_WIDTH;
      const x0 = Math.floor(sourceX);
      const x1 = (x0 + 1) % COPERNICUS_GRID_WIDTH;
      const fx = sourceX - x0;
      const a = source[y0 * COPERNICUS_GRID_WIDTH + x0];
      const b = source[y0 * COPERNICUS_GRID_WIDTH + x1];
      const c = source[y1 * COPERNICUS_GRID_WIDTH + x0];
      const d = source[y1 * COPERNICUS_GRID_WIDTH + x1];
      const top = a + (b - a) * fx;
      const bottom = c + (d - c) * fx;
      target[y * targetWidth + x] = top + (bottom - top) * fy;
    }
  }
  return target;
}
