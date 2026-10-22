import React, { useMemo, useState } from 'react';
import { ArrowUpRight, MapPin, X } from 'lucide-react';

export interface EarthSiteSelection {
  name: string;
  lat: number;
  lon: number;
  year: number;
  color?: string;
  size?: number;
  altitude?: number;
}

interface Props {
  site: EarthSiteSelection | null;
  onClose: () => void;
  description: string;
  alignmentSites?: Array<{ name: string; lat: number; lon: number }>;
}

type MapView = 'map' | 'terrain' | 'satellite';

const buttonBase = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300';
const buttonIdle = 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white';
const buttonActive = 'border-sky-300/60 bg-sky-300/15 text-sky-100';

export const EarthSiteExplorer: React.FC<Props> = ({ site, onClose, description, alignmentSites = [] }) => {
  const [mapView, setMapView] = useState<MapView>('satellite');

  const nearestSites = useMemo(() => {
    if (!site) return [];
    return alignmentSites
      .filter((other) => other.name !== site.name)
      .map((other) => {
        const dLat = (other.lat - site.lat) * Math.PI / 180;
        const dLon = (other.lon - site.lon) * Math.PI / 180;
        const h = Math.sin(dLat / 2) ** 2
          + Math.cos(site.lat * Math.PI / 180) * Math.cos(other.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return { ...other, distanceKm: 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))) };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }, [site, alignmentSites]);

  if (!site) return null;

  const yearLabel = site.year < 0
    ? `${Math.abs(site.year).toLocaleString()} BCE`
    : `${site.year.toLocaleString()} CE`;
  const mapUrl = mapView === 'map'
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${site.lon - 0.12},${Math.max(-85, site.lat - 0.08)},${site.lon + 0.12},${Math.min(85, site.lat + 0.08)}&layer=mapnik&marker=${site.lat},${site.lon}`
    : `https://maps.google.com/maps?q=${site.lat},${site.lon}&t=${mapView === 'satellite' ? 'k' : 'p'}&z=13&output=embed`;
  const coordinates = `${Math.abs(site.lat).toFixed(4)}° ${site.lat >= 0 ? 'N' : 'S'}, ${Math.abs(site.lon).toFixed(4)}° ${site.lon >= 0 ? 'E' : 'W'}`;

  return (
    <div className="absolute inset-2 md:inset-5 z-[70] overflow-hidden rounded-2xl border border-white/10 bg-[#080d16]/[.98] text-white shadow-2xl backdrop-blur-2xl pointer-events-auto">
      <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-white/[0.08] px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-200">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Earth atlas / site record</div>
            <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight md:text-xl">{site.name}</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close site explorer" className={`${buttonBase} ${buttonIdle} shrink-0`}>
          <X className="h-4 w-4" /><span className="hidden sm:inline">Close</span>
        </button>
      </header>

      <div className="grid h-[calc(100%-76px)] min-h-0 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.8fr)]">
        <section className="flex min-h-[360px] flex-col border-b border-white/[0.08] lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
            <div>
              <div className="text-sm font-medium text-white">Location</div>
              <div className="mt-0.5 text-xs text-slate-500">{coordinates}</div>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-black/20 p-1">
              {(['map', 'terrain', 'satellite'] as MapView[]).map((view) => (
                <button key={view} type="button" onClick={() => setMapView(view)} aria-pressed={mapView === view} className={`h-8 rounded-lg px-3 text-[11px] font-medium capitalize transition-colors ${mapView === view ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-200'}`}>
                  {view}
                </button>
              ))}
            </div>
          </div>
          <div className="relative min-h-[300px] flex-1 bg-[#03070d]">
            <iframe title={`${mapView} map for ${site.name}`} className="absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={mapUrl} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-4 py-3 md:px-5">
            <span className="text-[10px] text-slate-500">Map imagery and coverage vary by location.</span>
            <div className="flex flex-wrap gap-2">
              <a className={`${buttonBase} ${buttonIdle}`} href={`https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lon}`} target="_blank" rel="noreferrer">
                Open map <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a className={`${buttonBase} ${buttonIdle}`} href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${site.lat},${site.lon}`} target="_blank" rel="noreferrer">
                Street View <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-5 p-4 md:p-5">
          <section>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Site overview</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="text-[10px] text-slate-500">Approximate era</div>
                <div className="mt-1 text-base font-semibold text-white">{yearLabel}</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <div className="text-[10px] text-slate-500">Coordinates</div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-white">{site.lat.toFixed(2)}°, {site.lon.toFixed(2)}°</div>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-300">{description || 'No site description is available yet.'}</p>
          </section>

          <section className="border-t border-white/[0.08] pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-white">Nearby mapped sites</h3>
              <span className="text-[10px] text-slate-500">By distance</span>
            </div>
            {nearestSites.length ? (
              <div className="mt-3 space-y-2">
                {nearestSites.map((near) => (
                  <div key={near.name} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sky-300" />
                    <div className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">{near.name}</div>
                    <div className="shrink-0 text-[11px] tabular-nums text-slate-500">{Math.round(near.distanceKm).toLocaleString()} km</div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-xs text-slate-500">No nearby reference sites available.</p>}
          </section>

          <div className="mt-auto rounded-xl border border-white/[0.07] bg-black/20 p-3 text-[11px] leading-5 text-slate-500">
            Dates and coordinates are approximate map references, not a survey or proof of a historical alignment.
          </div>
        </aside>
      </div>
    </div>
  );
};
