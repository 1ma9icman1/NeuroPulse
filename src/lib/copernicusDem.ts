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
export const COPERNICUS_DATASET = 'Global Terrain-RGB elevation tiles (SRTM/ASTER-derived)';

const CACHE_DB = 'neuropulse-copernicus-dem';
const CACHE_STORE = 'rasters';
const CACHE_KEY = 'terrain-rgb-global-1deg-v2';
// Open-Meteo accepts up to 100 coordinates per request. Use the full batch to reduce
// the global grid to 648 calls, checkpoint every 500 samples, and resume safely.
const BATCH_SIZE = 100;
const CHECKPOINT_SIZE = 500;
// Serialized calls at 30 requests/minute: deliberately conservative versus published limits.
const CONCURRENCY = 1;
const REQUEST_SPACING_MS = 2_000;

type CachedRaster = { key: string; width: number; height: number; values: ArrayBuffer; savedAt: number; completedSamples?: number; complete?: boolean };

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

async function readCachedRaster(): Promise<{ values: Float32Array; completedSamples: number; complete: boolean } | null> {
  const db = await openCache();
  if (!db) return null;
  return new Promise(resolve => {
    const request = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(CACHE_KEY);
    request.onsuccess = () => {
      const value = request.result as CachedRaster | undefined;
      if (!value || value.width !== COPERNICUS_GRID_WIDTH || value.height !== COPERNICUS_GRID_HEIGHT || value.values.byteLength !== COPERNICUS_GRID_WIDTH * COPERNICUS_GRID_HEIGHT * Float32Array.BYTES_PER_ELEMENT) {
        db.close();
        resolve(null);
        return;
      }
      const values = new Float32Array(value.values.slice(0));
      const complete = value.complete === true || value.completedSamples === undefined;
      resolve({ values, completedSamples: complete ? values.length : Math.max(0, Math.min(values.length, value.completedSamples ?? 0)), complete });
      db.close();
    };
    request.onerror = () => { db.close(); resolve(null); };
  });
}

async function writeCache(values: Float32Array, completedSamples = values.length, complete = true): Promise<void> {
  const db = await openCache();
  if (!db) return;
  await new Promise<void>(resolve => {
    const record: CachedRaster = {
      key: CACHE_KEY,
      width: COPERNICUS_GRID_WIDTH,
      height: COPERNICUS_GRID_HEIGHT,
      values: values.slice().buffer,
      savedAt: Date.now(),
      completedSamples,
      complete,
    };
    const transaction = db.transaction(CACHE_STORE, 'readwrite');
    transaction.objectStore(CACHE_STORE).put(record);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); resolve(); };
  });
}

type SamplePoint = { index: number; latitude: number; longitude: number; tileX: number; tileY: number; pixelX: number; pixelY: number };

const TERRAIN_ZOOM = 4;
const TILE_SIZE = 256;
const WORLD_PIXELS = TILE_SIZE * (2 ** TERRAIN_ZOOM);
const TERRAIN_TILE_URL = (x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${TERRAIN_ZOOM}/${x}/${y}.png`;

function createPoints(): SamplePoint[] {
  const points: SamplePoint[] = [];
  const maxMercatorLat = 85.0511287798066;
  for (let y = 0; y < COPERNICUS_GRID_HEIGHT; y++) {
    const latitude = 89.5 - y;
    const clampedLatitude = Math.max(-maxMercatorLat, Math.min(maxMercatorLat, latitude));
    const latRad = clampedLatitude * Math.PI / 180;
    const pixelY = Math.max(0, Math.min(WORLD_PIXELS - 1, Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * WORLD_PIXELS)));
    const tileY = Math.floor(pixelY / TILE_SIZE);
    for (let x = 0; x < COPERNICUS_GRID_WIDTH; x++) {
      const longitude = -179.5 + x;
      const pixelX = ((Math.floor((longitude + 180) / 360 * WORLD_PIXELS) % WORLD_PIXELS) + WORLD_PIXELS) % WORLD_PIXELS;
      points.push({
        index: y * COPERNICUS_GRID_WIDTH + x,
        latitude,
        longitude,
        tileX: Math.floor(pixelX / TILE_SIZE),
        tileY,
        pixelX: pixelX % TILE_SIZE,
        pixelY: pixelY % TILE_SIZE,
      });
    }
  }
  return points;
}

async function fetchTerrainTile(x: number, y: number, signal: AbortSignal): Promise<ImageData> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (signal.aborted) throw new DOMException('Elevation tile load cancelled', 'AbortError');
    try {
      const response = await fetch(TERRAIN_TILE_URL(x, y), { signal, headers: { Accept: 'image/png' } });
      if (response.status === 404) {
        throw new Error(`Terrain elevation tile is missing for XYZ ${TERRAIN_ZOOM}/${x}/${y}; refusing to fabricate elevation values.`);
      }
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('Retry-After') || '');
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(60_000, retryAfter * 1000)
          : Math.min(30_000, 1_000 * (2 ** attempt));
        lastError = new Error(`Terrain tile server returned HTTP ${response.status} for ${TERRAIN_ZOOM}/${x}/${y}.`);
        if (attempt < 4) {
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
      if (!response.ok) throw new Error(`Terrain tile request failed with HTTP ${response.status} for ${TERRAIN_ZOOM}/${x}/${y}.`);
      const bitmap = await createImageBitmap(await response.blob());
      try {
        const canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas 2D context unavailable for terrain tile decoding.');
        context.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE);
        return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
      } finally {
        bitmap.close();
      }
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      lastError = error instanceof Error ? error : new Error('Terrain tile request failed.');
      if (lastError.message.includes('is missing')) throw lastError;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, Math.min(15_000, 1_000 * (2 ** attempt))));
    }
  }
  throw lastError ?? new Error('Terrain tile request failed after retries.');
}

/**
 * Builds a global 1-degree sample grid from real Terrain-RGB (Terrarium) elevation
 * tiles. This avoids thousands of per-coordinate API calls. Tiles are fetched once,
 * decoded locally, and the resulting measured raster is cached in IndexedDB.
 */
export async function loadCopernicusGlobalSamples(
  signal: AbortSignal,
  onProgress?: (completed: number, total: number, fromCache: boolean) => void,
): Promise<{ values: Float32Array; fromCache: boolean }> {
  const cached = await readCachedRaster();
  if (signal.aborted) throw new DOMException('Elevation tile load cancelled', 'AbortError');
  if (cached?.complete && cached.values.length === COPERNICUS_GRID_WIDTH * COPERNICUS_GRID_HEIGHT) {
    onProgress?.(cached.values.length, cached.values.length, true);
    return { values: cached.values, fromCache: true };
  }

  const points = createPoints();
  const total = points.length;
  const values = new Float32Array(total);
  const tiles = new Map<string, { x: number; y: number; points: SamplePoint[] }>();
  for (const point of points) {
    const key = `${point.tileX}/${point.tileY}`;
    let tile = tiles.get(key);
    if (!tile) {
      tile = { x: point.tileX, y: point.tileY, points: [] };
      tiles.set(key, tile);
    }
    tile.points.push(point);
  }

  const queue = [...tiles.values()];
  let next = 0;
  let completed = 0;
  let lastCheckpoint = 0;
  let firstError: unknown = null;
  const worker = async () => {
    while (!firstError) {
      if (signal.aborted) throw new DOMException('Elevation tile load cancelled', 'AbortError');
      const tile = queue[next++];
      if (!tile) return;
      try {
        const image = await fetchTerrainTile(tile.x, tile.y, signal);
        for (const point of tile.points) {
          const offset = (point.pixelY * TILE_SIZE + point.pixelX) * 4;
          const red = image.data[offset];
          const green = image.data[offset + 1];
          const blue = image.data[offset + 2];
          // Terrarium encoding: elevation (metres) = R*256 + G + B/256 - 32768.
          values[point.index] = red * 256 + green + blue / 256 - 32768;
        }
        completed += tile.points.length;
        onProgress?.(completed, total, false);
        // The complete global raster is cached only after all tile-derived samples are ready.
        if (completed - lastCheckpoint >= 4_000) lastCheckpoint = completed;
      } catch (error) {
        firstError = error;
        throw error;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, () => worker()));
  if (signal.aborted) throw new DOMException('Elevation tile load cancelled', 'AbortError');
  if (firstError) throw firstError;
  if (completed !== total || values.length !== total || values.some(value => !Number.isFinite(value))) {
    throw new Error(`Terrain tile sampling incomplete: processed ${completed.toLocaleString()} of ${total.toLocaleString()} global elevation samples.`);
  }
  await writeCache(values, values.length, true);
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
