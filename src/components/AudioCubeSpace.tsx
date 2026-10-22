import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Globe3D from 'react-globe.gl';
import { Search, MapPin, ExternalLink, X, Globe2, Volume2, Landmark, Telescope } from 'lucide-react';
import { ACOUSTIC_SITE_EVIDENCE } from '../data/acousticSiteEvidence';
import { ANCIENT_STRUCTURE_DIMENSIONS } from '../data/ancientStructureDimensions';
import { DEFAULT_EARTH_POINTS, LEGACY_HISTORICAL_SITES } from '../data/earthData';

type SiteCategory =
  | 'Measured acoustic research'
  | 'Acoustic candidates'
  | 'Ancient structures'
  | 'Historical & archaeological'
  | 'Astronomy & alignment'
  | 'Modern reference cities';

interface ResearchSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  year?: number;
  category: SiteCategory;
  region: string;
  reason: string;
  soundNote: string;
  caveat?: string;
  sourceUrl?: string;
  status?: string;
  color: string;
}

const CATEGORY_COLORS: Record<SiteCategory, string> = {
  'Measured acoustic research': '#38bdf8',
  'Acoustic candidates': '#a78bfa',
  'Ancient structures': '#f59e0b',
  'Historical & archaeological': '#34d399',
  'Astronomy & alignment': '#f472b6',
  'Modern reference cities': '#94a3b8',
};

const CATEGORIES = Object.keys(CATEGORY_COLORS) as SiteCategory[];
const BLUE_MARBLE_TEXTURE = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/land_ocean_ice_2048.png';
const EARTH_BUMP_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
const STAR_BACKGROUND = 'https://unpkg.com/three-globe/example/img/night-sky.png';

const categoryForEarthPoint = (category: string): SiteCategory => {
  if (/astronomy|alignment|sky/i.test(category)) return 'Astronomy & alignment';
  if (/acoustic|sound|resonan/i.test(category)) return 'Acoustic candidates';
  if (/ancient|archaeolog|histor/i.test(category)) return 'Historical & archaeological';
  return 'Historical & archaeological';
};

const yearLabel = (year?: number) => {
  if (year === undefined || !Number.isFinite(year)) return 'Date not specified';
  if (year < 0) return `${Math.abs(year).toLocaleString()} BCE`;
  return `${year.toLocaleString()} CE`;
};

export const AudioCubeSpace: React.FC = () => {
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });
  const [category, setCategory] = useState<SiteCategory | 'All sites'>('All sites');
  const [search, setSearch] = useState('');
  const [selectedSite, setSelectedSite] = useState<ResearchSite | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [showSiteList, setShowSiteList] = useState(true);
  const globeRef = React.useRef<any>(null);

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const sites = useMemo<ResearchSite[]>(() => {
    const combined: ResearchSite[] = [];

    for (const item of ACOUSTIC_SITE_EVIDENCE) {
      const measured = item.status === 'published-measurement';
      combined.push({
        id: item.id,
        name: item.name,
        lat: item.lat,
        lon: item.lon,
        category: measured ? 'Measured acoustic research' : 'Acoustic candidates',
        region: item.region,
        reason: item.summary,
        soundNote: item.measurementContext
          ? `Reported acoustic measurements: ${item.measurementContext}`
          : item.measuredFrequenciesHz?.length
            ? `Frequencies or test bands reported in the source record: ${item.measuredFrequenciesHz.join(', ')} Hz.`
            : 'Candidate location for acoustic research; no measured frequency is asserted by this record.',
        caveat: item.caveat,
        sourceUrl: item.sources?.[0]?.url,
        status: item.status,
        color: CATEGORY_COLORS[measured ? 'Measured acoustic research' : 'Acoustic candidates'],
      });
    }

    for (const item of ANCIENT_STRUCTURE_DIMENSIONS) {
      combined.push({
        id: item.id,
        name: item.name,
        lat: item.lat,
        lon: item.lon,
        category: 'Ancient structures',
        region: item.location,
        reason: item.evidenceNote,
        soundNote: 'This entry is included for historical and architectural comparison. No sound frequency or resonance is inferred from its shape or dimensions.',
        caveat: item.geometryClaim,
        sourceUrl: item.sourceUrl,
        color: CATEGORY_COLORS['Ancient structures'],
      });
    }

    for (const item of DEFAULT_EARTH_POINTS) {
      const cat = categoryForEarthPoint(item.category);
      combined.push({
        id: item.id,
        name: item.name,
        lat: item.lat,
        lon: item.lon,
        category: cat,
        region: 'Location reference',
        reason: item.desc,
        soundNote: /chichen/i.test(item.name)
          ? 'An echo phenomenon is reported for this site; the bird-call comparison is an interpretation, not a measured frequency.'
          : /acoustic|sound|resonan/i.test(item.category)
            ? 'Research-interest tag only; verify site-specific measurements before attributing a resonance.'
            : 'No site-specific sound measurement is asserted in this location record.',
        color: CATEGORY_COLORS[cat],
      });
    }

    for (const item of LEGACY_HISTORICAL_SITES) {
      const cat: SiteCategory = item.isCity ? 'Modern reference cities' : 'Historical & archaeological';
      combined.push({
        id: `legacy-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: item.name,
        lat: item.lat,
        lon: item.lon,
        year: item.year,
        category: cat,
        region: item.isCity ? 'Modern geographic reference' : 'Historical site catalog',
        reason: item.isCity
          ? 'Included as a modern geographic reference point. It is not labelled as an ancient sound or resonance site.'
          : 'Historical/archaeological site retained from the existing catalog. This location alone does not establish an acoustic effect; site-specific evidence is needed.',
        soundNote: item.isCity
          ? 'No ancient sound claim. Modern reference location only.'
          : 'Acoustic evidence has not yet been independently catalogued for this entry.',
        color: CATEGORY_COLORS[cat],
      });
    }

    // Keep the strongest, most specific record when catalogs contain the same named site.
    const unique = new Map<string, ResearchSite>();
    for (const item of combined) {
      const key = item.name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!unique.has(key)) unique.set(key, item);
    }
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredSites = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sites.filter((site) => {
      const matchesCategory = category === 'All sites' || site.category === category;
      const matchesSearch = !term || [
        site.name, site.region, site.category, site.reason, site.soundNote,
      ].some((value) => value.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [sites, category, search]);

  const focusSite = useCallback((site: ResearchSite) => {
    setSelectedSite(site);
    globeRef.current?.pointOfView({ lat: site.lat, lng: site.lon, altitude: 0.8 }, 900);
  }, []);

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: 20, lng: 5, altitude: 2.35 }, 0);
  }, [globeReady]);

  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#02040a] text-slate-100">
      <div className="absolute inset-0">
        <Globe3D
          ref={globeRef}
          width={viewport.width}
          height={viewport.height}
          backgroundColor="#02040a"
          backgroundImageUrl={STAR_BACKGROUND}
          globeImageUrl={BLUE_MARBLE_TEXTURE}
          bumpImageUrl={EARTH_BUMP_TEXTURE}
          showAtmosphere
          atmosphereColor="#55aaff"
          atmosphereAltitude={0.16}
          showGraticules={false}
          pointsData={filteredSites}
          pointLat={(site: ResearchSite) => site.lat}
          pointLng={(site: ResearchSite) => site.lon}
          pointColor={(site: ResearchSite) => site.color}
          pointRadius={(site: ResearchSite) => selectedSite?.id === site.id ? 0.28 : 0.16}
          pointAltitude={(site: ResearchSite) => selectedSite?.id === site.id ? 0.035 : 0.018}
          pointResolution={10}
          pointLabel={(site: ResearchSite) => `<div style="background:#07111f;border:1px solid ${site.color};border-radius:8px;padding:8px 10px;color:#f8fafc;max-width:260px"><strong>${site.name.replace(/</g, '&lt;')}</strong><br/><span style="color:${site.color}">${site.category}</span><br/><span style="color:#cbd5e1;font-size:11px">${site.soundNote.replace(/</g, '&lt;')}</span></div>`}
          onPointClick={(site: ResearchSite) => focusSite(site)}
          onGlobeReady={() => setGlobeReady(true)}
          enablePointerInteraction
          animateIn={false}
        />
      </div>

      <header className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-3 pointer-events-none">
        <div className="rounded-xl border border-sky-400/30 bg-slate-950/85 px-4 py-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-sky-300">
            <Globe2 size={17} />
            <span className="text-[10px] font-bold tracking-[.24em]">EARTH RESEARCH ATLAS</span>
          </div>
          <h1 className="mt-1 text-lg font-semibold leading-tight text-white">Historical Sites & Sound Research</h1>
          <p className="mt-1 text-[11px] text-slate-400">{sites.length.toLocaleString()} catalog entries · drag to rotate · scroll to zoom</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSiteList((value) => !value)}
          className="pointer-events-auto rounded-lg border border-sky-400/40 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-slate-900"
        >
          {showSiteList ? 'Hide site list' : 'Show site list'}
        </button>
      </header>

      {showSiteList && (
        <aside className="absolute bottom-4 right-4 top-[112px] z-10 flex w-[min(410px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#050b15]/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-slate-800 p-3">
            <div className="mb-2 flex items-center gap-2">
              <MapPin size={15} className="text-sky-300" />
              <h2 className="text-xs font-bold tracking-[.16em] text-white">SITE CATALOG</h2>
              <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{filteredSites.length}</span>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
              <Search size={14} className="shrink-0 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sites, sound, or reason…"
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
              />
            </label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as SiteCategory | 'All sites')}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none"
            >
              <option value="All sites">All categories</option>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {CATEGORIES.map((item) => (
                <span key={item} className="flex items-center gap-1 text-[9px] text-slate-400">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item] }} />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {selectedSite && (
            <section className="border-b border-sky-400/30 bg-sky-950/25 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[.16em]" style={{ color: selectedSite.color }}>{selectedSite.category}</p>
                  <h3 className="mt-1 text-sm font-semibold text-white">{selectedSite.name}</h3>
                  <p className="mt-1 text-[10px] text-slate-400">{selectedSite.region} · {Math.abs(selectedSite.lat).toFixed(3)}°{selectedSite.lat >= 0 ? 'N' : 'S'}, {Math.abs(selectedSite.lon).toFixed(3)}°{selectedSite.lon >= 0 ? 'E' : 'W'}{selectedSite.year !== undefined ? ` · ${yearLabel(selectedSite.year)}` : ''}</p>
                </div>
                <button onClick={() => setSelectedSite(null)} className="rounded p-1 text-slate-500 hover:text-white" aria-label="Close site details"><X size={15} /></button>
              </div>
              <div className="mt-2 flex gap-2">
                <Volume2 size={13} className="mt-0.5 shrink-0 text-sky-300" />
                <p className="text-[11px] leading-relaxed text-slate-200">{selectedSite.soundNote}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <Landmark size={13} className="mt-0.5 shrink-0 text-amber-300" />
                <p className="text-[11px] leading-relaxed text-slate-300">{selectedSite.reason}</p>
              </div>
              {selectedSite.caveat && <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-950/20 p-2 text-[10px] leading-relaxed text-amber-100/80">{selectedSite.caveat}</p>}
              {selectedSite.sourceUrl && <a href={selectedSite.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-sky-300 hover:text-sky-200">Open source <ExternalLink size={11} /></a>}
            </section>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {filteredSites.map((site) => (
              <button
                type="button"
                key={site.id}
                onClick={() => focusSite(site)}
                className={`block w-full border-b border-slate-800/80 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/60 ${selectedSite?.id === site.id ? 'bg-sky-950/45' : ''}`}
              >
                <span className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: site.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-slate-100">{site.name}</span>
                    <span className="mt-0.5 block text-[9px] uppercase tracking-wide" style={{ color: site.color }}>{site.category}</span>
                    <span className="mt-1 block line-clamp-2 text-[10px] leading-relaxed text-slate-400">{site.soundNote}</span>
                  </span>
                  <span className="pt-0.5 text-[9px] text-slate-600">{site.year !== undefined ? yearLabel(site.year) : ''}</span>
                </span>
              </button>
            ))}
            {filteredSites.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No sites match this search.</p>}
          </div>
        </aside>
      )}

      <div className="absolute bottom-4 left-4 z-10 max-w-[min(360px,calc(100vw-2rem))] rounded-lg border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-[10px] leading-relaxed text-slate-400 backdrop-blur-md">
        <Telescope size={12} className="mr-1 inline text-sky-300" />
        Sound claims are separated from historical interest. A site marker alone is not evidence of resonance; measured findings retain their reported values and caveats.
      </div>
    </main>
  );
};
