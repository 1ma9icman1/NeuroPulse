import React, { useEffect, useRef, useState } from 'react';
import {
  ArcGisMapServerImageryProvider,
  BoundingSphere,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
  EllipsoidTerrainProvider,
  Geometry,
  GeometryAttribute,
  GeometryInstance,
  PerInstanceColorAppearance,
  Primitive,
  PrimitiveType,
  Rectangle,
  Viewer,
} from 'cesium';
import { fromUrl } from 'geotiff';
import 'cesium/Build/Cesium/Widgets/widgets.css';

type Props = {
  open: boolean;
  onClose: () => void;
  selectedSite: { name: string; lat: number; lon: number } | null;
};

type DemManifest = {
  dataset: string;
  resolutionMeters: number;
  files: string[];
};

const PREVIEW_GRID_SIZE = 129;

function safeTileUrl(filename: string): string {
  const normalized = filename.replace(/\\\\/g, '/').replace(/^\/+/, '');
  if (normalized.split('/').some(part => part === '..')) throw new Error('Invalid path in Copernicus DEM manifest.');
  return `/copernicus-dem/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

export const CesiumCopernicusPreview: React.FC<Props> = ({ open, onClose, selectedSite }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [status, setStatus] = useState('Waiting for local Copernicus DEM tiles…');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !hostRef.current) return;
    let cancelled = false;
    let viewer: Viewer | null = null;
    const primitives: Primitive[] = [];

    const start = async () => {
      try {
        setError('');
        setStatus('Starting CesiumJS viewer…');
        viewer = new Viewer(hostRef.current!, {
          animation: false,
          timeline: false,
          geocoder: false,
          baseLayerPicker: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          infoBox: false,
          selectionIndicator: false,
          terrainProvider: new EllipsoidTerrainProvider(),
          baseLayer: false,
          requestRenderMode: true,
        });
        viewerRef.current = viewer;
        const imagery = await ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        );
        if (cancelled) return;
        viewer.imageryLayers.addImageryProvider(imagery);

        const manifestResponse = await fetch('/copernicus-dem/manifest.json', { cache: 'no-store' });
        if (!manifestResponse.ok) {
          throw new Error('No local Copernicus DEM manifest was found. Run scripts/prepare-copernicus-dem.R first.');
        }
        const manifest = await manifestResponse.json() as DemManifest;
        if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
          throw new Error('The Copernicus DEM manifest contains no GeoTIFF tiles.');
        }

        let loaded = 0;
        for (const filename of manifest.files) {
          if (cancelled) return;
          setStatus(`Reading measured ${manifest.dataset} tile ${loaded + 1} of ${manifest.files.length}…`);
          const tiff = await fromUrl(safeTileUrl(filename));
          const image = await tiff.getImage();
          const bbox = image.getBoundingBox();
          if (bbox.length !== 4 || !bbox.every(Number.isFinite)) {
            throw new Error(`Invalid geographic bounds in DEM tile: ${filename}`);
          }
          const west = bbox[0], south = bbox[1], east = bbox[2], north = bbox[3];
          const raster = await image.readRasters({
            width: PREVIEW_GRID_SIZE,
            height: PREVIEW_GRID_SIZE,
            interleave: true,
          }) as unknown as ArrayLike<number>;
          const count = PREVIEW_GRID_SIZE * PREVIEW_GRID_SIZE;
          if (raster.length !== count) throw new Error(`Incomplete elevation raster: ${filename}`);

          const positions = new Float64Array(count * 3);
          const indexValues: number[] = [];
          const rawNoData = typeof image.getGDALNoData === 'function' ? image.getGDALNoData() : undefined;
          const noData = rawNoData === null || rawNoData === undefined || rawNoData === '' ? NaN : Number(rawNoData);
          const validMask = new Uint8Array(count);
          let validVertices = 0;
          for (let y = 0; y < PREVIEW_GRID_SIZE; y++) {
            const latitude = north - (y / (PREVIEW_GRID_SIZE - 1)) * (north - south);
            for (let x = 0; x < PREVIEW_GRID_SIZE; x++) {
              const index = y * PREVIEW_GRID_SIZE + x;
              const longitude = west + (x / (PREVIEW_GRID_SIZE - 1)) * (east - west);
              const elevation = Number(raster[index]);
              const valid = Number.isFinite(elevation) && (!Number.isFinite(noData) || elevation !== noData);
              if (valid) { validMask[index] = 1; validVertices++; }
              const point = Cartesian3.fromDegrees(longitude, latitude, valid ? elevation : 0);
              positions[index * 3] = point.x;
              positions[index * 3 + 1] = point.y;
              positions[index * 3 + 2] = point.z;
            }
          }
          if (validVertices < count * 0.9) {
            throw new Error(`Too many invalid elevation samples in ${filename}; tile not rendered.`);
          }

          for (let y = 0; y < PREVIEW_GRID_SIZE - 1; y++) {
            for (let x = 0; x < PREVIEW_GRID_SIZE - 1; x++) {
              const a = y * PREVIEW_GRID_SIZE + x;
              const b = a + 1;
              const c = a + PREVIEW_GRID_SIZE;
              const d = c + 1;
              if (!validMask[a] || !validMask[b] || !validMask[c] || !validMask[d]) continue;
              indexValues.push(a, c, b, b, c, d);
            }
          }
          const geometry = new Geometry({
            // Cesium's public typings require placeholder fields that its runtime geometry does not need for a flat position-only mesh.
            attributes: { position: new GeometryAttribute({
              componentDatatype: ComponentDatatype.DOUBLE,
              componentsPerAttribute: 3,
              values: positions,
            }) } as never,
            indices: Uint32Array.from(indexValues),
            primitiveType: PrimitiveType.TRIANGLES,
            boundingSphere: BoundingSphere.fromVertices(positions),
          });
          const primitive = new Primitive({
            geometryInstances: new GeometryInstance({
              geometry,
              attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString('#b3a47b')) },
            }),
            appearance: new PerInstanceColorAppearance({ flat: true, translucent: false, closed: false }),
            asynchronous: true,
            allowPicking: false,
          });
          viewer.scene.primitives.add(primitive);
          primitives.push(primitive);
          loaded++;
        }

        if (cancelled) return;
        const focus = selectedSite;
        if (focus) {
          viewer.entities.add({
            name: focus.name,
            position: Cartesian3.fromDegrees(focus.lon, focus.lat, 100),
            point: { pixelSize: 10, color: Color.CYAN, outlineColor: Color.WHITE, outlineWidth: 2 },
            label: { text: focus.name, font: '13px sans-serif', fillColor: Color.WHITE, outlineColor: Color.BLACK, outlineWidth: 3, style: 2 },
          });
          viewer.camera.flyTo({
            destination: Rectangle.fromDegrees(focus.lon - 0.8, focus.lat - 0.6, focus.lon + 0.8, focus.lat + 0.6),
            duration: 0.8,
          });
        } else if (primitives.length > 0) {
          viewer.camera.flyTo({ destination: Rectangle.fromDegrees(-180, -75, 180, 75), duration: 0.8 });
        }
        setStatus(`Rendered ${loaded} real GeoTIFF tile(s) from ${manifest.dataset} at ${manifest.resolutionMeters} m source resolution. Mesh is resampled to ${PREVIEW_GRID_SIZE}×${PREVIEW_GRID_SIZE} vertices per tile for interactive display.`);
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : 'Unable to initialize Cesium Copernicus terrain preview.';
          setError(message);
          setStatus('Cesium terrain preview unavailable.');
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      for (const primitive of primitives) {
        try { primitive.destroy(); } catch { /* Cesium may already have destroyed it with the viewer. */ }
      }
      viewer?.destroy();
      viewer = null;
      viewerRef.current = null;
    };
  }, [open, selectedSite?.lat, selectedSite?.lon, selectedSite?.name]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-3 md:p-5" role="dialog" aria-modal="true" aria-label="Cesium Copernicus DEM terrain preview">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-mono font-bold tracking-wider text-sky-200">CESIUMJS · COPERNICUS DEM DETAIL</div>
          <div className="mt-1 text-xs text-slate-300">{status}</div>
          {error && <div className="mt-2 max-w-4xl text-xs text-rose-300">{error}</div>}
        </div>
        <button onClick={onClose} className="shrink-0 rounded border border-slate-600 px-3 py-2 text-xs font-mono text-slate-100 hover:bg-slate-800">CLOSE</button>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden rounded border border-slate-700" />
      <div className="pt-2 text-[10px] text-slate-500">Terrain geometry uses measured local Copernicus GeoTIFF elevations. The mesh is display-resampled; the source raster is not modified.</div>
    </div>
  );
};
