import React, { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, MapPin, Search, X, Camera, ExternalLink, AlertCircle } from 'lucide-react';

export type StreetImagerySite = { name: string; lat: number; lon: number; category?: string; color?: string };
type CoverageStatus = 'unchecked' | 'checking' | 'found' | 'empty' | 'error';
type CoverageRecord = { status: CoverageStatus; count?: number; checkedAt?: number; message?: string };
type Props = {
  sites: StreetImagerySite[];
  selectedSite: StreetImagerySite | null;
  onSelectSite?: (site: StreetImagerySite) => void;
};

const CACHE_TTL = 1000 * 60 * 60 * 24;
const cacheKey = (site: StreetImagerySite) => `${site.lat.toFixed(4)},${site.lon.toFixed(4)}`;

function findPhotoRecords(payload: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 7 || seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth + 1));
      return;
    }
    const item = value as Record<string, unknown>;
    const hasId = item.id != null || item.photoId != null || item.photo_id != null;
    const hasPosition = (item.lat != null || item.latitude != null) && (item.lng != null || item.lon != null || item.longitude != null);
    const hasImage = ['fileurl', 'fileUrl', 'image', 'imageUrl', 'thumb_url', 'thumbnail', 'url'].some(key => typeof item[key] === 'string' && String(item[key]).length > 0);
    if (hasId && (hasPosition || hasImage)) found.push(item);
    Object.values(item).forEach(child => visit(child, depth + 1));
  };
  visit(payload);
  return found;
}

export const FreeStreetImageryPanel: React.FC<Props> = ({ sites, selectedSite, onSelectSite }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<Record<string, CoverageRecord>>({});
  const [viewerSite, setViewerSite] = useState<StreetImagerySite | null>(null);

  const checkCoverage = useCallback(async (site: StreetImagerySite) => {
    const key = cacheKey(site);
    const previous = records[key];
    if (previous?.status === 'checking') return;
    if (previous?.checkedAt && Date.now() - previous.checkedAt < CACHE_TTL && (previous.status === 'found' || previous.status === 'empty')) {
      if (previous.status === 'found') setViewerSite(site);
      return;
    }
    setRecords(current => ({ ...current, [key]: { status: 'checking', message: 'Checking public imagery…' } }));
    try {
      const url = new URL('https://api.openstreetcam.org/2.0/photo/');
      url.searchParams.set('lat', String(site.lat));
      url.searchParams.set('lng', String(site.lon));
      url.searchParams.set('zoomLevel', '15');
      url.searchParams.set('join', 'sequence');
      url.searchParams.set('orderBy', 'id');
      url.searchParams.set('orderDirection', 'desc');
      const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`Imagery service returned HTTP ${response.status}`);
      const payload = await response.json() as { status?: { apiCode?: number; apiMessage?: string } };
      if (payload.status?.apiCode !== 600) {
        throw new Error(payload.status?.apiMessage || 'The public imagery service did not confirm this request.');
      }
      const photos = findPhotoRecords(payload);
      const checkedAt = Date.now();
      if (photos.length) {
        setRecords(current => ({ ...current, [key]: { status: 'found', count: photos.length, checkedAt, message: `${photos.length} nearby public photo record(s) found.` } }));
        setViewerSite(site);
      } else {
        setRecords(current => ({ ...current, [key]: { status: 'empty', count: 0, checkedAt, message: 'No KartaView photo records were returned for this search.' } }));
      }
    } catch (error) {
      setRecords(current => ({ ...current, [key]: { status: 'error', message: error instanceof Error ? error.message : 'Could not check the public imagery service.' } }));
    }
  }, [records]);

  const visibleSites = useMemo(() => {
    const unique = new Map<string, StreetImagerySite>();
    [...(selectedSite ? [selectedSite] : []), ...sites].forEach(site => {
      if (Number.isFinite(site.lat) && Number.isFinite(site.lon)) unique.set(cacheKey(site), site);
    });
    const list = [...unique.values()];
    const normalized = query.trim().toLowerCase();
    return (normalized ? list.filter(site => site.name.toLowerCase().includes(normalized) || (site.category || '').toLowerCase().includes(normalized)) : list).slice(0, 120);
  }, [sites, selectedSite, query]);

  const statusFor = (site: StreetImagerySite) => records[cacheKey(site)] ?? { status: 'unchecked' as const };
  const statusColor = (status: CoverageStatus) => status === 'found' ? 'text-cyan-300 border-cyan-400/60 bg-cyan-950/50 shadow-[0_0_10px_rgba(34,211,238,0.24)]' : status === 'checking' ? 'text-amber-200 border-amber-400/50' : status === 'empty' ? 'text-slate-500 border-slate-700' : status === 'error' ? 'text-rose-300 border-rose-400/50' : 'text-slate-400 border-slate-700 hover:border-cyan-400/60';

  return (
    <>
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} title="Check free open street-level imagery" className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-mono font-bold backdrop-blur transition-colors ${open ? 'border-cyan-300 bg-cyan-950/90 text-cyan-100' : 'border-slate-600 bg-slate-950/90 text-slate-200 hover:border-cyan-400'}`}>
          <Eye className="h-4 w-4" /> FREE IMAGERY
          {selectedSite && statusFor(selectedSite).status === 'found' && <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />}
        </button>
        {open && <section className="w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl border border-cyan-500/40 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur">
          <header className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
            <div><div className="text-[10px] font-mono font-bold tracking-wider text-cyan-200">OPEN STREET-LEVEL IMAGERY</div><div className="mt-1 text-[9px] text-slate-500">KartaView public metadata · no API key</div></div>
            <button type="button" aria-label="Close free imagery panel" onClick={() => { setOpen(false); setViewerSite(null); }} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
          </header>
          <div className="border-b border-slate-800 p-2">
            <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a site…" aria-label="Filter sites for free imagery" className="w-full bg-transparent py-2 text-xs outline-none placeholder:text-slate-600" /></div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-500">A positive result confirms nearby KartaView photo records, not guaranteed 360° panorama coverage. Checks are cached for 24 hours.</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {visibleSites.map(site => {
              const record = statusFor(site);
              return <div key={cacheKey(site)} className="flex items-center gap-2 border-b border-slate-900 px-3 py-2 last:border-0">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border ${statusColor(record.status)}`}>
                  {record.status === 'checking' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : record.status === 'found' ? <Eye className="h-3.5 w-3.5" /> : record.status === 'error' ? <AlertCircle className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectSite?.(site)} title="Select site on the elevation globe">
                  <span className="block truncate text-[11px] font-semibold text-slate-200">{site.name}</span>
                  <span className="block truncate text-[9px] text-slate-500">{record.message || (record.status === 'unchecked' ? 'Not checked yet' : record.status === 'checking' ? 'Checking…' : record.status === 'found' ? 'Imagery found' : record.status === 'empty' ? 'No nearby photos found' : 'Check failed')}</span>
                </button>
                <button type="button" onClick={() => record.status === 'found' ? setViewerSite(site) : void checkCoverage(site)} disabled={record.status === 'checking'} aria-label={record.status === 'found' ? `Open imagery for ${site.name}` : `Check imagery for ${site.name}`} title={record.status === 'found' ? 'Open in Earth workspace' : 'Check public imagery'} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50 ${statusColor(record.status)}`}>
                  {record.status === 'checking' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : record.status === 'found' ? <Camera className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>;
            })}
            {!visibleSites.length && <div className="p-4 text-center text-xs text-slate-500">No matching sites in the catalogue.</div>}
          </div>
          {viewerSite && <div className="border-t border-cyan-500/30 p-2">
            <div className="mb-2 flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate text-[10px] font-mono font-bold text-cyan-200">{viewerSite.name}</div><div className="text-[9px] text-slate-500">Opening community street imagery map</div></div><button type="button" onClick={() => setViewerSite(null)} aria-label="Close imagery view" className="rounded p-1 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button></div>
            <iframe title={`KartaView imagery near ${viewerSite.name}`} src={`https://kartaview.org/map/@${viewerSite.lat.toFixed(6)},${viewerSite.lon.toFixed(6)},16z`} className="h-56 w-full rounded border border-slate-700 bg-slate-900" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
            <a className="mt-2 inline-flex items-center gap-1 text-[9px] text-cyan-300 underline" href={`https://kartaview.org/map/@${viewerSite.lat.toFixed(6)},${viewerSite.lon.toFixed(6)},16z`} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> Open KartaView in a new tab if embedded view is blocked</a>
          </div>}
          <footer className="border-t border-slate-800 px-3 py-2 text-[9px] text-slate-600"><MapPin className="mr-1 inline h-3 w-3" /> Open community coverage varies by location; no paid API or key used.</footer>
        </section>}
      </div>
    </>
  );
};
