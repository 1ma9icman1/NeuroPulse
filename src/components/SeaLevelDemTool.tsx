import React, { useRef, useState } from 'react';
import { fromBlob, writeArrayBuffer } from 'geotiff';
import { Download, FileImage, FileUp, Waves } from 'lucide-react';

type MaskMode = 'band' | 'below'; // below = ocean-connected inundation, not a simple low-terrain mask
type GeoMeta = {
  width: number;
  height: number;
  origin: number[];
  resolution: number[];
  bbox: number[];
  projectionLabel: string;
  noData: number | null;
};
type Product = { blob: Blob; filename: string };

const MAX_INPUT_BYTES = 300 * 1024 * 1024;
const NODATA = -9999;
const delay = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

/**
 * Entirely local DEM processing. The selected TIFF is read in the browser; no
 * raster is uploaded to NeuroPulse or sent to an external service.
 */
export const SeaLevelDemTool: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState(0);
  const [tolerance, setTolerance] = useState(1);
  const [mode, setMode] = useState<MaskMode>('below');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Choose a coastal elevation/bathymetry GeoTIFF containing ocean cells along at least one raster edge.');
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState<GeoMeta | null>(null);
  const [tiffProduct, setTiffProduct] = useState<Product | null>(null);
  const [pngProduct, setPngProduct] = useState<Product | null>(null);
  const [pngPreviewUrl, setPngPreviewUrl] = useState<string | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [validCount, setValidCount] = useState(0);

  const chooseFile = (next: File | null) => {
    setFile(next);
    setMetadata(null);
    setTiffProduct(null);
    setPngProduct(null);
    setPngPreviewUrl(null);
    setMatchedCount(0);
    setValidCount(0);
    setProgress(0);
    setError('');
    setStatus(next
      ? `Selected ${next.name}. Choose the elevation band or ocean-connected flood model, then build the layer.`
      : 'Choose a coastal elevation/bathymetry GeoTIFF containing ocean cells along at least one raster edge.');
  };

  const buildMask = async () => {
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    setError('');
    setTiffProduct(null);
    setPngProduct(null);
    setPngPreviewUrl(null);
    try {
      if (file.size > MAX_INPUT_BYTES) {
        throw new Error('This file is larger than 300 MB. Download a smaller regional DEM/tile first to avoid running out of browser memory.');
      }
      setStatus('Reading the local elevation raster…');
      const tiff = await fromBlob(file);
      const image = await tiff.getImage();
      const width = image.getWidth();
      const height = image.getHeight();
      const total = width * height;
      if (!Number.isSafeInteger(total) || total < 1) throw new Error('The selected file has invalid raster dimensions.');
      const pixelLimit = mode === 'below' ? 15_000_000 : 45_000_000;
      if (total > pixelLimit) throw new Error(`This raster contains more than ${pixelLimit.toLocaleString()} pixels for the selected mode. Use a smaller coastal tile to keep the connected-flood calculation within browser memory limits.`);

      const origin = image.getOrigin();
      const resolution = image.getResolution();
      const bbox = image.getBoundingBox();
      if (!origin || !resolution || !bbox || ![...origin, ...resolution, ...bbox].every(Number.isFinite)) {
        throw new Error('The TIFF does not contain a usable georeferenced extent. Choose a GeoTIFF DEM rather than a plain image.');
      }

      setStatus('Reading elevation values…');
      const rasterSet = await image.readRasters({ interleave: false });
      const input = rasterSet[0] as ArrayLike<number>;
      if (!input || input.length !== total) throw new Error('Could not read the first elevation band from this GeoTIFF.');
      const noDataValue = image.getGDALNoData();
      const noData = Number.isFinite(noDataValue) ? noDataValue : null;
      const mask = new Float32Array(total);
      mask.fill(NODATA);
      let matched = 0;
      let valid = 0;
      const lower = target - tolerance;
      const upper = target + tolerance;
      const chunk = 500_000;

      if (mode === 'band') {
        for (let start = 0; start < total; start += chunk) {
          const stop = Math.min(total, start + chunk);
          for (let i = start; i < stop; i++) {
            const elevation = Number(input[i]);
            const isValid = Number.isFinite(elevation) && !(noData !== null && elevation === noData);
            if (isValid) valid++;
            if (isValid && elevation >= lower && elevation <= upper) {
              mask[i] = elevation;
              matched++;
            }
          }
          setProgress(Math.round((stop / total) * 65));
          await delay();
        }
      } else {
        // Flood-fill only from ocean-connected cells on the raster perimeter.
        // The source DEM must include sea/bathymetry at an edge; a land-only tile
        // cannot establish ocean connectivity and is rejected rather than guessed.
        for (let i = 0; i < total; i++) {
          const elevation = Number(input[i]);
          if (Number.isFinite(elevation) && !(noData !== null && elevation === noData)) valid++;
        }
        const queue = new Uint32Array(total);
        let head = 0;
        let tail = 0;
        const seedLimit = Math.min(0, target);
        const seed = (index: number) => {
          const elevation = Number(input[index]);
          const isValid = Number.isFinite(elevation) && !(noData !== null && elevation === noData);
          if (isValid && elevation <= seedLimit && mask[index] === NODATA) {
            mask[index] = 1;
            queue[tail++] = index;
          }
        };
        for (let x = 0; x < width; x++) {
          seed(x);
          if (height > 1) seed((height - 1) * width + x);
        }
        for (let y = 1; y < height - 1; y++) {
          seed(y * width);
          if (width > 1) seed(y * width + width - 1);
        }
        if (tail === 0) {
          throw new Error('No ocean/bathymetry cells at or below the selected sea level touch this raster edge. Use a coastal DEM tile that includes the sea, not a land-only elevation tile.');
        }
        let lastYield = 0;
        while (head < tail) {
          const index = queue[head++];
          const x = index % width;
          const y = Math.floor(index / width);
          const neighbors = [
            x > 0 ? index - 1 : -1,
            x + 1 < width ? index + 1 : -1,
            y > 0 ? index - width : -1,
            y + 1 < height ? index + width : -1,
          ];
          for (const next of neighbors) {
            if (next < 0 || mask[next] !== NODATA) continue;
            const elevation = Number(input[next]);
            const isValid = Number.isFinite(elevation) && !(noData !== null && elevation === noData);
            if (isValid && elevation <= target) {
              mask[next] = 1;
              queue[tail++] = next;
            }
          }
          if (head - lastYield >= chunk) {
            lastYield = head;
            setProgress(Math.min(65, Math.round((head / Math.max(1, total)) * 65)));
            await delay();
          }
        }
        matched = tail;
      }
      if (!matched) throw new Error(mode === 'below'
        ? 'No ocean-connected pixels were flooded at this sea level. Try a higher level or check the DEM elevation units.'
        : 'No raster pixels matched that elevation. Try a wider tolerance or a different target value.');

      const rawImage = image as any;
      const fileDirectory = rawImage.getFileDirectory?.() ?? rawImage.fileDirectory ?? {};
      const getTag = (key: string) => fileDirectory.getValue?.(key) ?? fileDirectory[key];
      const geoKeys = rawImage.getGeoKeys?.() ?? rawImage.geoKeys ?? {};
      const pixelScaleTag = getTag('ModelPixelScale');
      const tiePointTag = getTag('ModelTiepoint');
      const transformTag = getTag('ModelTransformation');
      const writerMeta: Record<string, unknown> = {
        width,
        height,
        BitsPerSample: [32],
        SamplesPerPixel: 1,
        SampleFormat: [3],
        PhotometricInterpretation: 1,
        Compression: 1,
        GDAL_NODATA: String(NODATA),
      };
      // Preserve projection/coordinate metadata so the output layers line up in GIS.
      if (pixelScaleTag && tiePointTag) {
        writerMeta.ModelPixelScale = Array.from(pixelScaleTag as ArrayLike<number>);
        writerMeta.ModelTiepoint = Array.from(tiePointTag as ArrayLike<number>);
      } else if (transformTag) {
        writerMeta.ModelTransformation = Array.from(transformTag as ArrayLike<number>);
      } else {
        writerMeta.ModelPixelScale = [Math.abs(resolution[0]), Math.abs(resolution[1]), 0];
        writerMeta.ModelTiepoint = [0, 0, 0, origin[0], origin[1], origin[2] ?? 0];
      }
      for (const key of [
        'GTModelTypeGeoKey', 'GTRasterTypeGeoKey', 'GeographicTypeGeoKey',
        'GeogGeodeticDatumGeoKey', 'GeogAngularUnitsGeoKey',
        'ProjectedCSTypeGeoKey', 'ProjectionGeoKey', 'ProjCoordTransGeoKey',
        'ProjLinearUnitsGeoKey', 'VerticalCSTypeGeoKey',
      ]) {
        const value = geoKeys[key];
        if (value !== undefined && value !== null) writerMeta[key] = value;
      }

      setStatus('Writing georeferenced mask GeoTIFF…');
      setProgress(70);
      await delay();
      const outputArrayBuffer = await writeArrayBuffer(mask, writerMeta as any);
      const stem = file.name.replace(/\.(tif|tiff)$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 72) || 'elevation';
      const suffix = mode === 'band'
        ? `elevation-${target}m-plusminus-${tolerance}m`
        : `below-${target}m-mask`;
      const nextTiff = new Blob([outputArrayBuffer], { type: 'image/tiff' });
      setTiffProduct({ blob: nextTiff, filename: `${stem}-${suffix}.tif` });

      // A quick transparent PNG preview/downloader is useful for visual checking.
      // The GeoTIFF remains the authoritative georeferenced output for GIS/maps.
      const scale = Math.max(1, Math.ceil(Math.max(width / 1100, height / 800)));
      const previewWidth = Math.ceil(width / scale);
      const previewHeight = Math.ceil(height / scale);
      const canvas = document.createElement('canvas');
      canvas.width = previewWidth;
      canvas.height = previewHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.createImageData(previewWidth, previewHeight);
        for (let y = 0; y < previewHeight; y++) {
          const srcY = Math.min(height - 1, y * scale);
          for (let x = 0; x < previewWidth; x++) {
            const srcX = Math.min(width - 1, x * scale);
            const i = srcY * width + srcX;
            const out = (y * previewWidth + x) * 4;
            if (mask[i] !== NODATA) {
              imageData.data[out] = mode === 'band' ? 250 : 40;
              imageData.data[out + 1] = mode === 'band' ? 204 : 190;
              imageData.data[out + 2] = mode === 'band' ? 21 : 255;
              imageData.data[out + 3] = 215;
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const png = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create PNG preview.')), 'image/png'));
        setPngProduct({ blob: png, filename: `${stem}-${suffix}-preview.png` });
        setPngPreviewUrl(URL.createObjectURL(png));
      }
      const geoKeysForLabel = geoKeys as Record<string, unknown>;
      const projectionLabel = geoKeysForLabel.ProjectedCSTypeGeoKey
        ? `Projected CRS ${String(geoKeysForLabel.ProjectedCSTypeGeoKey)}`
        : geoKeysForLabel.GeographicTypeGeoKey
          ? `Geographic CRS ${String(geoKeysForLabel.GeographicTypeGeoKey)}`
          : 'Source projection metadata preserved where available';
      setMetadata({ width, height, origin, resolution, bbox, projectionLabel, noData });
      setMatchedCount(matched);
      setValidCount(valid);
      setProgress(100);
      setStatus(mode === 'band'
        ? `Finished. Kept ${matched.toLocaleString()} pixels between ${lower.toFixed(1)} m and ${upper.toFixed(1)} m.`
        : `Flood simulation complete: ${matched.toLocaleString()} ocean-connected pixels inundated at ${target} m relative to the DEM's vertical datum, out of ${valid.toLocaleString()} valid pixels. This static bathtub model excludes tides, storm surge, defenses, subsidence, and hydrodynamics.`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not process the selected GeoTIFF.';
      setError(message);
      setStatus('Processing stopped.');
    } finally {
      setBusy(false);
    }
  };

  const download = (product: Product | null) => {
    if (!product) return;
    const url = URL.createObjectURL(product.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = product.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
  };

  return (
    <section className="mt-3 rounded-xl border border-cyan-800/70 bg-slate-950/80 p-3">
      <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-200">
        <Waves className="h-4 w-4" /> DEM-BASED SEA-LEVEL INUNDATION
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
        Load a coastal elevation/bathymetry GeoTIFF, set sea level in metres relative to the DEM's vertical datum, and calculate only land connected to ocean cells on the raster edge. Processing stays local; the output GeoTIFF preserves georeferencing.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input ref={fileInputRef} type="file" accept=".tif,.tiff,image/tiff" className="hidden" onChange={event => chooseFile(event.target.files?.[0] ?? null)} />
        <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 rounded border border-cyan-700 px-3 py-2 text-[10px] font-mono text-cyan-200 hover:bg-cyan-950 disabled:opacity-50">
          <FileUp className="h-3.5 w-3.5" /> CHOOSE DEM TIFF
        </button>
        {file && <span className="self-center max-w-full break-all text-[10px] text-slate-300">{file.name} · {(file.size / 1048576).toFixed(1)} MB</span>}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="flex justify-between text-[10px] text-slate-300"><label htmlFor="dem-target">Sea level / target elevation</label><strong className="font-mono text-cyan-200">{target} m</strong></div>
          <input id="dem-target" aria-label="Target elevation in meters" type="range" min="-500" max="9000" step="1" value={target} disabled={busy} onChange={event => setTarget(Number(event.target.value))} className="w-full accent-cyan-400" />
          <div className="flex justify-between text-[9px] text-slate-500"><span>-500 m</span><span>9,000 m</span></div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-slate-300"><label htmlFor="dem-tolerance">Band tolerance</label><strong className="font-mono text-cyan-200">±{tolerance.toFixed(1)} m</strong></div>
          <input id="dem-tolerance" aria-label="Elevation band tolerance" type="range" min="0.1" max="10" step="0.1" value={tolerance} disabled={busy || mode === 'below'} onChange={event => setTolerance(Number(event.target.value))} className="w-full accent-cyan-400" />
          <div className="flex justify-between text-[9px] text-slate-500"><span>±0.1 m</span><span>±10 m</span></div>
        </div>
      </div>

      <label htmlFor="dem-mode" className="mt-3 mb-1 block text-[10px] text-slate-300">Processing mode</label>
      <select id="dem-mode" value={mode} disabled={busy} onChange={event => setMode(event.target.value as MaskMode)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-[11px] text-slate-100">
        <option value="band">Isolate elevation contour band (default: 29–31 m)</option>
        <option value="below">Simulate ocean-connected inundation at this sea level</option>
      </select>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!file || busy} onClick={buildMask} className="inline-flex items-center gap-1 rounded bg-cyan-500 px-3 py-2 text-[10px] font-mono font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
          <FileImage className="h-3.5 w-3.5" /> {busy ? `PROCESSING ${progress}%` : 'RUN INUNDATION MODEL'}
        </button>
        <button type="button" disabled={!tiffProduct || busy} onClick={() => download(tiffProduct)} className="inline-flex items-center gap-1 rounded border border-emerald-700 px-3 py-2 text-[10px] font-mono text-emerald-200 hover:bg-emerald-950 disabled:opacity-50"><Download className="h-3.5 w-3.5" /> DOWNLOAD GEOTIFF</button>
        <button type="button" disabled={!pngProduct || busy} onClick={() => download(pngProduct)} className="inline-flex items-center gap-1 rounded border border-sky-700 px-3 py-2 text-[10px] font-mono text-sky-200 hover:bg-sky-950 disabled:opacity-50"><Download className="h-3.5 w-3.5" /> PNG PREVIEW</button>
      </div>
      {busy && <div className="mt-3 h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>}
      <p role="status" className={`mt-2 text-[10px] leading-relaxed ${error ? 'text-rose-300' : 'text-slate-300'}`}>{error || status}</p>
      {metadata && <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-black/20 p-2 text-[10px]">
        <div><span className="block text-slate-500">Raster dimensions</span><strong className="text-slate-200">{metadata.width.toLocaleString()} × {metadata.height.toLocaleString()}</strong></div>
        <div><span className="block text-slate-500">Pixels matched</span><strong className="text-cyan-200">{matchedCount.toLocaleString()}</strong></div>
        <div><span className="block text-slate-500">Coordinate bounds</span><strong className="break-all text-slate-200">{metadata.bbox.map(v => Number(v).toFixed(5)).join(', ')}</strong></div>
        <div><span className="block text-slate-500">Projection</span><strong className="break-words text-slate-200">{metadata.projectionLabel}</strong></div>
      </div>}
      {pngPreviewUrl && metadata && <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 p-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-mono font-bold text-sky-200">GENERATED DEM MASK PREVIEW</div>
          <span className="text-[9px] text-slate-400">Transparent pixels = no match</span>
        </div>
        <div className="overflow-hidden rounded border border-slate-800 bg-slate-950">
          <img src={pngPreviewUrl} alt="Preview of generated elevation mask" className="block max-h-72 w-full object-contain" />
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-slate-400">This is the computed raster for the selected DEM tile. The GeoTIFF retains georeferencing for GIS. This regional raster is not automatically draped onto the live global globe.</p>
      </div>}
      <div className="mt-3 border-t border-slate-800 pt-2 text-[9px] leading-relaxed text-slate-500">
        <div className="mb-1 font-bold uppercase tracking-wide text-slate-400">Free NOAA / USGS DEM data — no API key</div>
        <div className="mb-2 flex flex-wrap gap-2">
          <a className="rounded border border-cyan-800 px-2 py-1 text-cyan-200 hover:bg-cyan-950" href="https://coast.noaa.gov/htdata/raster2/elevation/SLR_viewer_DEM_6230/" target="_blank" rel="noreferrer">NOAA DEM 6230 directory</a>
          <a className="rounded border border-cyan-800 px-2 py-1 text-cyan-200 hover:bg-cyan-950" href="https://noaa-nos-coastal-lidar-pds.s3.amazonaws.com/dem/SLR_Viewer_DEM_AS_9062/index.html" target="_blank" rel="noreferrer">NOAA American Samoa DEM 9062</a>
        </div>
        <a className="underline decoration-cyan-700 underline-offset-2 hover:text-cyan-200" href="https://coast.noaa.gov/slrdata/" target="_blank" rel="noreferrer">NOAA Sea Level Rise Viewer data portal</a>
        <span> · </span>
        <a className="underline decoration-cyan-700 underline-offset-2 hover:text-cyan-200" href="https://apps.nationalmap.gov/downloader/" target="_blank" rel="noreferrer">USGS The National Map</a>
        <p className="mt-1">Elevation values must use metres and a consistent vertical datum. Ocean-connected inundation requires bathymetry/ocean cells touching the raster edge; inland depressions disconnected from the ocean stay dry. This is a static bathtub model, not a hydrodynamic forecast. Flood mode is limited to 15 million pixels to control browser memory.</p>
      </div>
    </section>
  );
};
