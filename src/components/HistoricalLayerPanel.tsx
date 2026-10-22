import React, { useRef } from 'react';

export type HistoricalLayerKey = 'ancientPlaces' | 'structures' | 'soundSites' | 'cities' | 'imported' | 'openHistoricalMap';
export type HistoricalLayerState = Record<HistoricalLayerKey, boolean>;

interface Props {
  layers: HistoricalLayerState;
  onToggle: (layer: HistoricalLayerKey, enabled: boolean) => void;
  onGeoJsonLoaded: (data: GeoJSON.FeatureCollection, fileName: string) => void;
  loadedFileName: string | null;
}

const SOURCES = [
  { name: 'OpenHistoricalMap', detail: 'Dated places, boundaries, roads and features', url: 'https://www.openhistoricalmap.org/', license: 'Public-domain project; verify individual tags and source notes' },
  { name: 'Pleiades', detail: 'Ancient places, names, locations and connections', url: 'https://pleiades.stoa.org/downloads', license: 'CC BY 3.0 · attribution required' },
  { name: 'Chronas', detail: 'Historical borders, cultures and political geography', url: 'https://chronas.org/', license: 'Dataset has its own CC BY-SA and source attribution terms' },
  { name: 'Stanford ORBIS', detail: 'Roman-era places, routes and travel-cost models', url: 'https://orbis.stanford.edu/', license: 'Use ORBIS terms for each dataset; not all routes are a public GeoJSON API' },
];

export const HistoricalLayerPanel: React.FC<Props> = ({ layers, onToggle, onGeoJsonLoaded, loadedFileName }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const options: Array<{ key: HistoricalLayerKey; label: string; detail: string }> = [
    { key: 'ancientPlaces', label: 'Ancient & historical places', detail: 'Existing site catalogue + Pleiades imports' },
    { key: 'openHistoricalMap', label: 'OpenHistoricalMap live data', detail: 'Zoom in to load dated features for the selected year' },
    { key: 'structures', label: 'Ancient structures', detail: 'Architecture and archaeological sites' },
    { key: 'soundSites', label: 'Acoustic / measured sites', detail: 'Evidence records with date filtering' },
    { key: 'cities', label: 'Modern cities', detail: 'Off by default; not part of ancient layers' },
    { key: 'imported', label: 'Imported GeoJSON', detail: loadedFileName || 'Pleiades, Chronas, ORBIS or other GeoJSON exports' },
  ];
  const loadFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const data = (parsed as any)?.type === 'FeatureCollection' ? parsed as GeoJSON.FeatureCollection
        : (parsed as any)?.type === 'Feature' ? { type: 'FeatureCollection', features: [parsed] } as GeoJSON.FeatureCollection
        : null;
      if (!data || !Array.isArray(data.features)) throw new Error('Expected a GeoJSON Feature or FeatureCollection.');
      onGeoJsonLoaded(data, file.name);
      onToggle('imported', true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not read this GeoJSON file.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="mt-2 rounded-lg border border-slate-700/80 bg-slate-950/70 p-2">
      <div className="mb-2 text-[9px] font-mono font-bold tracking-[.16em] text-cyan-200">HISTORICAL LAYERS · YEAR FILTERED</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {options.map((option) => (
          <label key={option.key} className="flex items-start gap-2 rounded-md border border-slate-800 px-2 py-1.5 cursor-pointer hover:bg-slate-900/80">
            <input type="checkbox" checked={layers[option.key]} onChange={(event) => onToggle(option.key, event.target.checked)} className="mt-0.5 accent-amber-400" />
            <span className="min-w-0"><span className="block text-[10px] text-slate-100">{option.label}</span><span className="block text-[9px] text-slate-500 leading-tight">{option.detail}</span></span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded border border-cyan-500/40 px-2 py-1 text-[9px] font-mono text-cyan-200 hover:bg-cyan-950/50">IMPORT GEOJSON</button>
        <input ref={fileRef} type="file" accept=".geojson,.json,application/geo+json,application/json" className="hidden" onChange={(event) => void loadFile(event.target.files?.[0])} />
        <span className="text-[9px] text-slate-500">Imported features are filtered against the selected year when date properties exist.</span>
      </div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {SOURCES.map((source) => (
          <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-800 px-2 py-1.5 hover:border-slate-600">
            <span className="block text-[10px] font-semibold text-amber-200">{source.name} ↗</span>
            <span className="block text-[9px] leading-tight text-slate-400">{source.detail}</span>
            <span className="block mt-0.5 text-[8px] leading-tight text-slate-600">{source.license}</span>
          </a>
        ))}
      </div>
    </div>
  );
};
