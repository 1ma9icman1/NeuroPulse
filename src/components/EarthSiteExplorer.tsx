import React, { useState } from 'react';
import { X, MapPin, ExternalLink } from 'lucide-react';

export interface EarthSiteSelection {
  name: string; lat: number; lon: number; year: number;
  color?: string; size?: number; altitude?: number;
}

interface Props { site: EarthSiteSelection | null; onClose: () => void; description: string; }

export const EarthSiteExplorer: React.FC<Props> = ({ site, onClose, description }) => {
  const [mapView, setMapView] = useState<'map' | 'terrain' | 'satellite'>('satellite');
  if (!site) return null;
  const yearLabel = site.year < 0 ? Math.abs(site.year).toLocaleString() + ' BCE' : site.year + ' CE';
  const bounds = [site.lon - 0.08, Math.max(-85, site.lat - 0.05), site.lon + 0.08, Math.min(85, site.lat + 0.05)].join(',');
  const mapUrl = mapView === 'map'
    ? 'https://www.openstreetmap.org/export/embed.html?bbox=' + bounds + '&layer=mapnik&marker=' + site.lat + ',' + site.lon
    : 'https://maps.google.com/maps?q=' + site.lat + ',' + site.lon + '&t=' + (mapView === 'satellite' ? 'k' : 'p') + '&z=14&output=embed';
  const modelKind = /Giza|Pyramid/i.test(site.name) ? 'pyramid' : /Stonehenge|Carnac/i.test(site.name) ? 'stones' : /Chich|Teotihuacan|Tenochtitlan/i.test(site.name) ? 'temple' : 'ruins';
  return (
    <div className="absolute inset-2 md:inset-4 z-[70] overflow-y-auto rounded-2xl border border-amber-400/70 bg-[#050b15]/[.98] p-3 md:p-5 shadow-2xl backdrop-blur-xl pointer-events-auto">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div><div className="text-[10px] font-mono font-bold tracking-[.22em] text-amber-300">ANCIENT PLACES · SITE EXPLORER</div>
          <h2 className="mt-1 text-xl md:text-2xl font-semibold text-white">{site.name}</h2>
          <div className="mt-1 text-xs font-mono text-slate-400">{Math.abs(site.lat).toFixed(4)}° {site.lat >= 0 ? 'N' : 'S'} · {Math.abs(site.lon).toFixed(4)}° {site.lon >= 0 ? 'E' : 'W'} · Approx. era marker: {yearLabel}</div>
        </div>
        <button onClick={onClose} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-mono text-slate-200 hover:bg-slate-800"><X className="inline w-4 h-4 mr-1"/>BACK TO GLOBE</button>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(240px,.85fr)_minmax(320px,1.15fr)_minmax(280px,1fr)] gap-3 items-stretch">
        <section className="min-h-[280px] overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-b from-[#172235] to-[#080d16]">
          <div className="px-3 py-2 border-b border-slate-700/70 text-[10px] font-mono font-bold tracking-wider text-amber-200">LANDMARK MODEL · CONCEPTUAL 3D VIEW</div>
          <div className="h-[290px] md:h-[360px] flex items-center justify-center p-2">
            <svg viewBox="0 0 360 280" role="img" aria-label={'Stylized landmark model for ' + site.name + ', illustration not measured'} className="w-full h-full drop-shadow-[0_0_20px_rgba(245,158,11,.15)]">
              <defs><linearGradient id="siteStone" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f4d7a1"/><stop offset="55%" stopColor="#ad8757"/><stop offset="100%" stopColor="#5d4938"/></linearGradient></defs>
              <ellipse cx="180" cy="232" rx="140" ry="25" fill="#020617" opacity=".8"/><path d="M35 219 L180 168 L325 219 L180 263 Z" fill="#1e293b" stroke="#64748b" strokeOpacity=".5"/>
              {modelKind === 'pyramid' ? <g stroke="#f6d9a4" strokeOpacity=".8" strokeWidth="1"><path d="M75 216 L151 78 L227 216 Z" fill="url(#siteStone)"/><path d="M151 78 L227 216 L151 216 Z" fill="#8f704e"/><path d="M113 147 L189 147 M96 177 L205 177 M84 198 L217 198" fill="none" stroke="#6d533b" strokeOpacity=".7"/></g> :
               modelKind === 'stones' ? <g fill="url(#siteStone)" stroke="#f3d7a2" strokeWidth="1.2"><path d="M84 205 L87 137 L104 128 L119 137 L121 205 Z"/><path d="M128 203 L132 118 L150 110 L166 120 L168 203 Z"/><path d="M184 204 L187 136 L204 128 L219 137 L220 204 Z"/><path d="M236 208 L239 150 L254 143 L268 151 L269 208 Z"/><path d="M80 132 L80 119 L163 114 L164 127 Z"/><path d="M181 132 L181 119 L271 145 L268 157 Z"/></g> :
               modelKind === 'temple' ? <g stroke="#f6d9a4" strokeWidth="1"><path d="M93 217 L180 122 L267 217 Z" fill="#947653"/><path d="M111 202 L249 202 L238 190 L122 190 Z" fill="#d6b782"/><path d="M123 190 L237 190 L226 178 L134 178 Z" fill="#ad8b5c"/><path d="M135 178 L225 178 L214 166 L146 166 Z" fill="#d6b782"/><path d="M146 166 L214 166 L203 154 L157 154 Z" fill="#ad8b5c"/><path d="M157 154 L203 154 L180 122 Z" fill="#d6b782"/><path d="M169 217 L169 190 L191 190 L191 217 Z" fill="#302b25"/></g> :
               <g stroke="#e6c99a" strokeWidth="1"><path d="M78 217 L88 163 L113 154 L126 165 L126 217 Z" fill="url(#siteStone)"/><path d="M132 217 L142 125 L166 114 L184 128 L184 217 Z" fill="#c6a778"/><path d="M191 217 L202 156 L225 147 L240 159 L240 217 Z" fill="url(#siteStone)"/><path d="M72 165 L108 151 L129 163 L92 177 Z" fill="#d9bd8d"/><path d="M127 128 L160 111 L187 127 L153 143 Z" fill="#e7d0a5"/><path d="M145 217 L145 183 L168 183 L168 217 Z" fill="#29251f"/></g>}
              <g fill="#fde68a" opacity=".75"><circle cx="49" cy="62" r="1.7"/><circle cx="289" cy="49" r="1.4"/><circle cx="312" cy="96" r="1.8"/><circle cx="69" cy="104" r="1.2"/></g>
              <text x="180" y="24" textAnchor="middle" fill="#fcdba0" fontSize="9" letterSpacing="2">SITE FORM STUDY</text><text x="180" y="276" textAnchor="middle" fill="#94a3b8" fontSize="8">Stylized illustration · not to scale</text>
            </svg>
          </div>
          <div className="px-3 pb-3 text-[10px] leading-relaxed text-slate-400">Illustrative landmark form, not a photogrammetric model or measured archaeological reconstruction.</div>
        </section>
        <section className="min-h-[280px] overflow-hidden rounded-xl border border-sky-500/30 bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-700/70"><span className="text-[10px] font-mono font-bold tracking-wider text-sky-200">MAP VIEW · {mapView.toUpperCase()}</span><div className="flex gap-1">{([['map','ROAD'],['terrain','TERRAIN'],['satellite','SATELLITE']] as const).map(([view,label])=><button key={view} onClick={()=>setMapView(view)} className={'rounded border px-2 py-1 text-[9px] font-mono ' + (mapView===view?'border-sky-400 bg-sky-950 text-white':'border-slate-700 text-slate-400 hover:text-white')}>{label}</button>)}</div></div>
          <iframe title={'Map of ' + site.name} className="w-full h-[310px] md:h-[390px] border-0" loading="lazy" src={mapUrl}/>
          <div className="flex flex-wrap gap-3 px-3 py-2"><a className="text-[10px] text-sky-300 hover:text-white" href={'https://www.google.com/maps/search/?api=1&query=' + site.lat + ',' + site.lon} target="_blank" rel="noreferrer"><MapPin className="inline w-3 h-3 mr-1"/>OPEN FULL MAP ↗</a><a className="text-[10px] text-sky-300 hover:text-white" href={'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + site.lat + ',' + site.lon} target="_blank" rel="noreferrer">STREET VIEW ↗</a></div>
        </section>
        <section className="min-h-[280px] rounded-xl border border-emerald-500/30 bg-[#08111b] p-3 md:p-4 flex flex-col gap-3">
          <div><div className="text-[10px] font-mono font-bold tracking-wider text-emerald-200">SITE FILE · WHAT IS DOCUMENTED</div><p className="mt-2 text-sm leading-relaxed text-slate-200">{description}</p></div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3"><div className="text-[10px] font-mono font-bold text-amber-200">FREQUENCY CHECK · NO ASSUMED MATCH</div><div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded border border-slate-800 p-2"><div className="text-lg font-mono text-white">432 Hz</div><div className="text-[10px] text-slate-400">Alternative A4 tuning reference; not a measured Earth/site resonance.</div></div><div className="rounded border border-slate-800 p-2"><div className="text-lg font-mono text-white">110 Hz</div><div className="text-[10px] text-slate-400">A2 note under A4 = 440 Hz tuning; not a measured resonance for this site.</div></div></div><p className="mt-2 text-[10px] leading-relaxed text-slate-500">No frequency is assigned unless traceable measurements, units, method, uncertainty, and source are available.</p></div>
          <div className="mt-auto rounded-lg border border-slate-800 p-3"><div className="text-[10px] font-mono font-bold text-slate-300">RESEARCH CHECKLIST</div><ul className="mt-2 list-disc pl-4 space-y-1 text-[10px] leading-relaxed text-slate-400"><li>Verify surveyed coordinates and architectural axes.</li><li>Compare candidate sky targets using a dated sky model.</li><li>Record published acoustic measurements and conditions.</li><li>Test numerical patterns against chance and uncertainty.</li></ul></div>
        </section>
      </div>
    </div>
  );
};
