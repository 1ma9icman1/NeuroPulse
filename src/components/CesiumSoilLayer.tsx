import React, { useEffect, useRef, useState } from 'react';
import { BoundingSphere, Cartesian3, Color, ColorGeometryInstanceAttribute, ComponentDatatype, ConstantPositionProperty, Geometry, GeometryAttribute, GeometryInstance, GeometryPipeline, PerInstanceColorAppearance, Primitive, PrimitiveType, Viewer } from 'cesium';
import { fromUrl } from 'geotiff';

type DemManifest = {
  dataset: string;
  resolutionMeters: number;
  files: string[];
};

const PREVIEW_GRID_SIZE = 513;
type CachedDemTile = { west: number; south: number; east: number; north: number; raster: ArrayLike<number>; noData: number };

function buildElevationPrimitive(tile: CachedDemTile, soilDepth = 0, reliefExaggeration = 1): Primitive {
  const count = PREVIEW_GRID_SIZE * PREVIEW_GRID_SIZE;
  const positions = new Float64Array(count * 3);
  const elevations = new Float32Array(count);
  const validMask = new Uint8Array(count);
  let validVertices = 0;
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let elevationSum = 0;

  // Pass 1: calculate the DEM statistics before using the mean to position vertices.
  // Keeping this separate avoids reading meanElevation before it is initialized.
  for (let index = 0; index < count; index++) {
    const elevation = Number(tile.raster[index]);
    const valid = Number.isFinite(elevation) && (!Number.isFinite(tile.noData) || elevation !== tile.noData);
    if (!valid) continue;
    validMask[index] = 1;
    elevations[index] = elevation;
    validVertices++;
    minElevation = Math.min(minElevation, elevation);
    maxElevation = Math.max(maxElevation, elevation);
    elevationSum += elevation;
  }
  if (validVertices < count * 0.9) throw new Error('Too many invalid elevation samples in a cached DEM tile.');
  const meanElevation = elevationSum / validVertices;

  // Pass 2: build the 3D vertex positions using the now-initialized mean.
  for (let y = 0; y < PREVIEW_GRID_SIZE; y++) {
    const latitude = tile.north - (y / (PREVIEW_GRID_SIZE - 1)) * (tile.north - tile.south);
    for (let x = 0; x < PREVIEW_GRID_SIZE; x++) {
      const index = y * PREVIEW_GRID_SIZE + x;
      const longitude = tile.west + (x / (PREVIEW_GRID_SIZE - 1)) * (tile.east - tile.west);
      const elevation = elevations[index];
      const valid = validMask[index] === 1;
      const adjustedElevation = valid ? meanElevation + (elevation - meanElevation) * reliefExaggeration + soilDepth : meanElevation;
      const point = Cartesian3.fromDegrees(longitude, latitude, adjustedElevation);
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    }
  }
  if (!Number.isFinite(minElevation) || !Number.isFinite(maxElevation) || maxElevation - minElevation < 0.01) {
    throw new Error(`DEM tile has no usable relief: min ${minElevation}, max ${maxElevation}. Check the GeoTIFF vertical band and no-data metadata.`);
  }

  // This DEM-following mesh IS the displayed topographic surface. Soil depth shifts each
  // measured vertex vertically; no second soil sheet is drawn over the map.
  const bands: number[][] = Array.from({ length: 7 }, () => []);
  const bandFor = (elevation: number) => { const adjusted = meanElevation + (elevation - meanElevation) * reliefExaggeration + soilDepth; return adjusted < 0 ? 0 : adjusted < 100 ? 1 : adjusted < 500 ? 2 : adjusted < 1200 ? 3 : adjusted < 2500 ? 4 : adjusted < 4000 ? 5 : 6; };
  for (let y = 0; y < PREVIEW_GRID_SIZE - 1; y++) {
    for (let x = 0; x < PREVIEW_GRID_SIZE - 1; x++) {
      const a = y * PREVIEW_GRID_SIZE + x, b = a + 1, c = a + PREVIEW_GRID_SIZE, d = c + 1;
      if (!(validMask[a] && validMask[b] && validMask[c] && validMask[d])) continue;
      const mean1 = (elevations[a] + elevations[b] + elevations[c]) / 3;
      const mean2 = (elevations[b] + elevations[c] + elevations[d]) / 3;
      bands[bandFor(mean1)].push(a, c, b);
      bands[bandFor(mean2)].push(b, c, d);
    }
  }
  const bandColors = [
    '#174d91', // below sea level
    '#32875b', // lowlands
    '#9aaf55', // hills
    '#c2a15c', // uplands
    '#a87345', // mountains
    '#c4b6a0', // high mountains
    '#f1eee7', // highest terrain
  ];
  const instances = bands.flatMap((indices, band) => {
    if (!indices.length) return [];
    const geometry = new Geometry({
      attributes: { position: new GeometryAttribute({ componentDatatype: ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values: positions }) } as never,
      indices: Uint32Array.from(indices),
      primitiveType: PrimitiveType.TRIANGLES,
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
      boundingSphere: BoundingSphere.fromVertices(positions),
    });
    // Per-vertex normals let Cesium shade slopes and ridgelines with real directional light,
    // adding visible terrain depth instead of presenting the DEM as flat color bands.
    GeometryPipeline.computeNormal(geometry);
    return [new GeometryInstance({
      id: `copernicus-elevation-band-${band}-${tile.west}-${tile.south}`,
      geometry,
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString(bandColors[band]).withAlpha(0.30)) },
    })];
  });
  if (!instances.length) throw new Error('The DEM tile contains no valid terrain triangles.');
  return new Primitive({
    geometryInstances: instances,
    appearance: new PerInstanceColorAppearance({ flat: false, translucent: true, closed: false, faceForward: true }),
    asynchronous: false,
    allowPicking: false,
  });
}


function buildElevationWireframePrimitive(tile: CachedDemTile, soilDepth = 0, reliefExaggeration = 1): Primitive {
  const count = PREVIEW_GRID_SIZE * PREVIEW_GRID_SIZE;
  const positions = new Float64Array(count * 3);
  const validMask = new Uint8Array(count);
  let elevationSum = 0;
  let validCount = 0;
  for (let index = 0; index < count; index++) {
    const value = Number(tile.raster[index]);
    if (!Number.isFinite(value) || (Number.isFinite(tile.noData) && value === tile.noData)) continue;
    validMask[index] = 1;
    elevationSum += value;
    validCount++;
  }
  if (!validCount) throw new Error('No valid DEM samples available for the terrain wireframe.');
  const meanElevation = elevationSum / validCount;
  for (let y = 0; y < PREVIEW_GRID_SIZE; y++) {
    const latitude = tile.north - (y / (PREVIEW_GRID_SIZE - 1)) * (tile.north - tile.south);
    for (let x = 0; x < PREVIEW_GRID_SIZE; x++) {
      const index = y * PREVIEW_GRID_SIZE + x;
      const longitude = tile.west + (x / (PREVIEW_GRID_SIZE - 1)) * (tile.east - tile.west);
      const elevation = Number(tile.raster[index]);
      const adjusted = validMask[index] ? meanElevation + (elevation - meanElevation) * reliefExaggeration + soilDepth : meanElevation;
      const point = Cartesian3.fromDegrees(longitude, latitude, adjusted);
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    }
  }
  const indices: number[] = [];
  const step = 8;
  for (let y = 0; y < PREVIEW_GRID_SIZE; y += step) {
    for (let x = 0; x < PREVIEW_GRID_SIZE - 1; x += step) {
      const a = y * PREVIEW_GRID_SIZE + x;
      const b = y * PREVIEW_GRID_SIZE + Math.min(PREVIEW_GRID_SIZE - 1, x + step);
      if (validMask[a] && validMask[b]) indices.push(a, b);
    }
  }
  for (let x = 0; x < PREVIEW_GRID_SIZE; x += step) {
    for (let y = 0; y < PREVIEW_GRID_SIZE - 1; y += step) {
      const a = y * PREVIEW_GRID_SIZE + x;
      const b = Math.min(PREVIEW_GRID_SIZE - 1, y + step) * PREVIEW_GRID_SIZE + x;
      if (validMask[a] && validMask[b]) indices.push(a, b);
    }
  }
  if (!indices.length) throw new Error('The DEM tile contains no valid wireframe edges.');
  const geometry = new Geometry({
    attributes: { position: new GeometryAttribute({ componentDatatype: ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values: positions }) } as never,
    indices: Uint32Array.from(indices),
    primitiveType: PrimitiveType.LINES,
    vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
    boundingSphere: BoundingSphere.fromVertices(positions),
  });
  return new Primitive({
    geometryInstances: new GeometryInstance({
      id: `copernicus-terrain-wireframe-${tile.west}-${tile.south}`,
      geometry,
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString('#d9e8d9').withAlpha(0.48)) },
    }),
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: true, closed: false }),
    asynchronous: false,
    allowPicking: false,
  });
}

function sampleTileElevation(site: SoilSite, tiles: CachedDemTile[]): number | null {
  const tile = tiles.find(item => site.lon >= item.west && site.lon <= item.east && site.lat >= item.south && site.lat <= item.north);
  if (!tile) return null;
  const x = Math.max(0, Math.min(PREVIEW_GRID_SIZE - 1, Math.round(((site.lon - tile.west) / (tile.east - tile.west)) * (PREVIEW_GRID_SIZE - 1))));
  const y = Math.max(0, Math.min(PREVIEW_GRID_SIZE - 1, Math.round(((tile.north - site.lat) / (tile.north - tile.south)) * (PREVIEW_GRID_SIZE - 1))));
  const value = Number(tile.raster[y * PREVIEW_GRID_SIZE + x]);
  return Number.isFinite(value) && (!Number.isFinite(tile.noData) || value !== tile.noData) ? value : null;
}

function safeTileUrl(filename: string): string {
  const normalized = filename.replace(/\\\\/g, '/').replace(/^\/+/, '');
  if (normalized.split('/').some(part => part === '..')) throw new Error('Invalid path in Copernicus DEM manifest.');
  return `/copernicus-dem/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}



type SoilSite = { id?: string; name: string; lat: number; lon: number; altitude?: number };
type SoilLayerProps = {
  viewer: Viewer | null;
  sites: SoilSite[];
  selectedSite?: SoilSite | null;
  enabled: boolean;
  depth: number;
  reliefExaggeration: number;
  onStatus?: (status: string) => void;
};

export const CesiumSoilLayer: React.FC<SoilLayerProps> = ({ viewer, sites, selectedSite, enabled, depth, reliefExaggeration, onStatus }) => {
  const [tiles, setTiles] = useState<CachedDemTile[]>([]);
  const loadGeneration = useRef(0);
  const activePrimitives = useRef<Primitive[]>([]);

  useEffect(() => {
    if (!enabled || !viewer || viewer.isDestroyed()) {
      setTiles([]);
      onStatus?.('Soil / sand layer off · Copernicus DEM not loaded');
      return;
    }
    const generation = ++loadGeneration.current;
    let cancelled = false;
    setTiles([]);
    onStatus?.('Loading local Copernicus GLO-90 DEM…');
    void (async () => {
      try {
        const response = await fetch('/copernicus-dem/manifest.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('No local Copernicus DEM manifest found. Run scripts/prepare-copernicus-dem.R first.');
        const manifest = await response.json() as DemManifest;
        if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error('The Copernicus DEM manifest contains no GeoTIFF tiles.');
        const loaded: CachedDemTile[] = [];
        for (let index = 0; index < manifest.files.length; index++) {
          if (cancelled || generation !== loadGeneration.current) return;
          onStatus?.(`Reading GLO-90 tile ${index + 1}/${manifest.files.length}…`);
          const tiff = await fromUrl(safeTileUrl(manifest.files[index]));
          const image = await tiff.getImage();
          const bbox = image.getBoundingBox();
          if (bbox.length !== 4 || !bbox.every(Number.isFinite)) throw new Error(`Invalid geographic bounds in DEM tile: ${manifest.files[index]}`);
          const raster = await image.readRasters({ width: PREVIEW_GRID_SIZE, height: PREVIEW_GRID_SIZE, interleave: true }) as unknown as ArrayLike<number>;
          if (raster.length !== PREVIEW_GRID_SIZE * PREVIEW_GRID_SIZE) throw new Error(`Incomplete elevation raster: ${manifest.files[index]}`);
          const rawNoData = typeof image.getGDALNoData === 'function' ? image.getGDALNoData() : undefined;
          loaded.push({ west: bbox[0], south: bbox[1], east: bbox[2], north: bbox[3], raster, noData: rawNoData == null ? NaN : Number(rawNoData) });
        }
        if (cancelled || generation !== loadGeneration.current) return;
        setTiles(loaded);
        onStatus?.(`Loaded ${loaded.length} Copernicus GLO-90 tile(s) · building terrain mesh…`);
      } catch (error) {
        if (cancelled || generation !== loadGeneration.current) return;
        const message = error instanceof Error ? error.message : String(error);
        onStatus?.(`Soil / sand unavailable: ${message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, viewer]);

  useEffect(() => {
    const activeViewer = viewer;
    if (!enabled || !activeViewer || activeViewer.isDestroyed() || !tiles.length) return;
    const next: Primitive[] = [];
    try {
      for (const tile of tiles) {
        const terrain = buildElevationPrimitive(tile, depth, reliefExaggeration);
        const wire = buildElevationWireframePrimitive(tile, depth, reliefExaggeration);
        activeViewer.scene.primitives.add(terrain);
        activeViewer.scene.primitives.add(wire);
        next.push(terrain, wire);
      }
      for (const old of activePrimitives.current) {
        if (!old.isDestroyed()) activeViewer.scene.primitives.remove(old);
      }
      activePrimitives.current = next;
      activeViewer.scene.requestRender();
      onStatus?.(`3D Copernicus GLO-90 terrain active · ${tiles.length} local tile(s) · surface offset ${depth} m · relief ${reliefExaggeration.toFixed(1)}×`);
    } catch (error) {
      for (const primitive of next) if (!primitive.isDestroyed()) activeViewer.scene.primitives.remove(primitive);
      const message = error instanceof Error ? error.message : String(error);
      onStatus?.(`Soil / sand mesh failed: ${message}`);
    }
    return () => {
      for (const primitive of activePrimitives.current) {
        if (!primitive.isDestroyed() && !activeViewer.isDestroyed()) activeViewer.scene.primitives.remove(primitive);
      }
      activePrimitives.current = [];
      if (!activeViewer.isDestroyed()) activeViewer.scene.requestRender();
    };
  }, [viewer, enabled, tiles, depth, reliefExaggeration]);

  // Keep existing Earth catalogue markers on the actual local DEM surface without
  // changing their WGS84 latitude/longitude. Restore their normal height when disabled.
  useEffect(() => {
    const activeViewer = viewer;
    if (!activeViewer || activeViewer.isDestroyed()) return;
    const frame = requestAnimationFrame(() => {
      if (activeViewer.isDestroyed()) return;
      for (const site of sites) {
        if (!site || !Number.isFinite(site.lat) || !Number.isFinite(site.lon)) continue;
        const id = `np-earth-site:${site.id ?? site.name}:${Number(site.lat)}:${Number(site.lon)}`;
        const entity = activeViewer.entities.getById(id);
        if (!entity) continue;
        const selected = selectedSite && (selectedSite.id ?? selectedSite.name) === (site.id ?? site.name);
        const demHeight = enabled ? sampleTileElevation(site, tiles) : null;
        const baseHeight = Math.max(0, Number(site.altitude) || 0) + (selected ? 100 : 40);
        const height = demHeight === null ? baseHeight : demHeight + depth + (selected ? 100 : 40);
        entity.position = new ConstantPositionProperty(Cartesian3.fromDegrees(Number(site.lon), Number(site.lat), height));
      }
      activeViewer.scene.requestRender();
    });
    return () => cancelAnimationFrame(frame);
  }, [viewer, sites, selectedSite?.id, selectedSite?.name, enabled, tiles, depth]);

  useEffect(() => () => {
    const activeViewer = viewer;
    if (activeViewer && !activeViewer.isDestroyed()) {
      for (const primitive of activePrimitives.current) {
        if (!primitive.isDestroyed()) activeViewer.scene.primitives.remove(primitive);
      }
    }
    activePrimitives.current = [];
  }, [viewer]);

  return null;
};
