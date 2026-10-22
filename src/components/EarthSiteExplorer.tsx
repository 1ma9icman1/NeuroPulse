import React, { useEffect, useRef, useState } from 'react';
import { LeafletSiteMap } from './LeafletSiteMap';
import type { LeafletAudioPoint } from './LeafletSiteMap';
import { ACOUSTIC_SITE_EVIDENCE } from '../data/acousticSiteEvidence';
import { X, MapPin, ExternalLink } from 'lucide-react';

export interface EarthSiteSelection {
  name: string; lat: number; lon: number; year: number;
  color?: string; size?: number; altitude?: number;
}

interface Props {
  site: EarthSiteSelection | null;
  onClose: () => void;
  description: string;
  alignmentSites?: Array<{ name: string; lat: number; lon: number }>;
  audioSites?: LeafletAudioPoint[];
  onAssignChannel?: (channel: 'a' | 'b' | 'c', site: EarthSiteSelection) => void;
  lockedChannels?: { a: boolean; b: boolean; c: boolean };
  earthChannelTargets?: {
    a: { lat: number; lng: number } | null;
    b: { lat: number; lng: number } | null;
    c: { lat: number; lng: number } | null;
  };
  onToggleChannelLock?: (channel: 'a' | 'b' | 'c') => void;
  onSelectMapLocation?: (site: EarthSiteSelection) => void;
}

export const EarthSiteExplorer: React.FC<Props> = ({
  site,
  onClose,
  description,
  alignmentSites = [],
  audioSites = [],
  onAssignChannel,
  lockedChannels,
  earthChannelTargets,
  onToggleChannelLock,
  onSelectMapLocation,
}) => {
  const [mapView, setMapView] = useState<'map' | 'terrain' | 'satellite'>('satellite');
  const [activeFrequency, setActiveFrequency] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  useEffect(() => () => { try { oscillatorRef.current?.stop(); } catch { /* oscillator already stopped */ } void audioContextRef.current?.close(); }, []);
  const playReferenceTone = async (frequency: number) => {
    try {
      if (oscillatorRef.current) { try { oscillatorRef.current.stop(); } catch { /* oscillator already stopped */ } oscillatorRef.current = null; }
      if (activeFrequency === frequency) { setActiveFrequency(null); return; }
      const audioContext = audioContextRef.current || new window.AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, audioContext.currentTime + 1.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.9);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + 1.92);
      oscillatorRef.current = oscillator; setActiveFrequency(frequency);
      oscillator.onended = () => { if (oscillatorRef.current === oscillator) oscillatorRef.current = null; setActiveFrequency((current) => current === frequency ? null : current); };
    } catch (error) { console.warn('Unable to play reference tone:', error); }
  };
  if (!site) return null;
  const yearLabel = site.year < 0 ? Math.abs(site.year).toLocaleString() + ' BCE' : site.year + ' CE';
  const channelAlreadyTargetsSite = (channel: 'a' | 'b' | 'c') => {
    const target = earthChannelTargets?.[channel];
    if (!target) return false;
    const longitudeDifference = ((target.lng - site.lon + 540) % 360) - 180;
    return Math.abs(target.lat - site.lat) < 0.01 && Math.abs(longitudeDifference) < 0.01;
  };
  const channelIsLockedHere = (channel: 'a' | 'b' | 'c') =>
    channelAlreadyTargetsSite(channel) && Boolean(lockedChannels?.[channel]);
  const nearestSites = site ? alignmentSites.filter((other) => other.name !== site.name).map((other) => {
    const dLat = (other.lat - site.lat) * Math.PI / 180;
    const dLon = (other.lon - site.lon) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(site.lat * Math.PI / 180) * Math.cos(other.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return { ...other, distanceKm: 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))) };
  }).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 2) : [];
  const localXY = (point: { lat: number; lon: number }) => ({ x: point.lon * Math.cos((site?.lat || 0) * Math.PI / 180), y: point.lat });
  const triangleAngles = site && nearestSites.length === 2 ? (() => {
    const points = [site, ...nearestSites].map(localXY);
    const angle = (p: typeof points[number], q: typeof points[number], r: typeof points[number]) => {
      const ux = q.x - p.x, uy = q.y - p.y, vx = r.x - p.x, vy = r.y - p.y;
      const denom = Math.hypot(ux, uy) * Math.hypot(vx, vy);
      return denom ? Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / denom))) * 180 / Math.PI : 0;
    };
    return [angle(points[0], points[1], points[2]), angle(points[1], points[2], points[0]), angle(points[2], points[0], points[1])].map((value) => value.toFixed(1));
  })() : [];
  const modelKind = /Giza|Pyramid/i.test(site.name) ? 'pyramid' : /Stonehenge|Carnac/i.test(site.name) ? 'stones' : /Chich|Teotihuacan|Tenochtitlan/i.test(site.name) ? 'temple' : 'ruins';
  const acousticRecord = ACOUSTIC_SITE_EVIDENCE.find((record) => record.name.toLowerCase() === site.name.toLowerCase()) || ACOUSTIC_SITE_EVIDENCE.find((record) => Math.abs(record.lat - site.lat) < 0.025 && Math.abs(record.lon - site.lon) < 0.025);
  const recordedFrequencies = acousticRecord?.measuredFrequenciesHz || [];
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
              <g className={activeFrequency ? "np-landmark-audio-rings" : ""} fill="none" stroke={activeFrequency === 432 ? "#c084fc" : "#fb923c"} strokeWidth="1.4" opacity={activeFrequency ? ".9" : "0"}><circle cx="180" cy="185" r="34"/><circle cx="180" cy="185" r="56"/><circle cx="180" cy="185" r="78"/></g>
              <g fill="#fde68a" opacity=".75"><circle cx="49" cy="62" r="1.7"/><circle cx="289" cy="49" r="1.4"/><circle cx="312" cy="96" r="1.8"/><circle cx="69" cy="104" r="1.2"/></g>
              <text x="180" y="24" textAnchor="middle" fill="#fcdba0" fontSize="9" letterSpacing="2">SITE FORM STUDY</text><text x="180" y="276" textAnchor="middle" fill="#94a3b8" fontSize="8">Stylized illustration · not to scale</text>
            </svg>
          </div>
          <div className="px-3 pb-3 text-[10px] leading-relaxed text-slate-400">Illustrative landmark form, not a photogrammetric model or measured archaeological reconstruction.</div>
        </section>
        <section className="min-h-[280px] overflow-hidden rounded-xl border border-sky-500/30 bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-700/70"><span className="text-[10px] font-mono font-bold tracking-wider text-sky-200">MAP VIEW · {mapView.toUpperCase()}</span><div className="flex gap-1">{([['map','ROAD'],['terrain','TERRAIN'],['satellite','SATELLITE']] as const).map(([view,label])=><button key={view} onClick={()=>setMapView(view)} className={'rounded border px-2 py-1 text-[9px] font-mono ' + (mapView===view?'border-sky-400 bg-sky-950 text-white':'border-slate-700 text-slate-400 hover:text-white')}>{label}</button>)}</div></div>
          <LeafletSiteMap site={site} sites={alignmentSites} layer={mapView} audioSites={audioSites} onMapPointClick={(point) => onSelectMapLocation?.({ ...point, year: site.year })} />
          <div className="flex flex-wrap gap-3 px-3 py-2"><a className="text-[10px] text-sky-300 hover:text-white" href={'https://www.google.com/maps/search/?api=1&query=' + site.lat + ',' + site.lon} target="_blank" rel="noreferrer"><MapPin className="inline w-3 h-3 mr-1"/>OPEN FULL MAP ↗</a><a className="text-[10px] text-sky-300 hover:text-white" href={'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + site.lat + ',' + site.lon} target="_blank" rel="noreferrer">STREET VIEW ↗</a></div>
        </section>
        <section className="min-h-[280px] rounded-xl border border-emerald-500/30 bg-[#08111b] p-3 md:p-4 flex flex-col gap-3">
          <div><div className="text-[10px] font-mono font-bold tracking-wider text-emerald-200">SITE FILE · WHAT IS DOCUMENTED</div><p className="mt-2 text-sm leading-relaxed text-slate-200">{description}</p></div>
          <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3"><div className="text-[10px] font-mono font-bold text-amber-200">LOCATION AUDIO · MEASUREMENTS + REFERENCE TONES</div>
            {acousticRecord ? <><div className="mt-2 text-[10px] leading-relaxed text-slate-300">{acousticRecord.status === 'published-measurement' ? 'Published acoustic measurement record' : 'Candidate-only acoustic association'} · {acousticRecord.region}</div><div className="mt-1 flex flex-wrap gap-1.5">{recordedFrequencies.map((hz) => <span key={hz} className="rounded border border-orange-500/50 bg-orange-950/40 px-2 py-1 text-[10px] font-mono text-orange-200">{hz} Hz measured</span>)}</div><p className="mt-1 text-[9px] leading-relaxed text-slate-500">{acousticRecord.caveat}</p><div className="mt-1 flex flex-wrap gap-2">{acousticRecord.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-[9px] text-sky-300 hover:text-white">{source.label} ↗</a>)}</div></> : <p className="mt-2 text-[10px] leading-relaxed text-slate-400">No site-specific measured frequency record is linked to this marker. The tones below are synthetic reference tones, not recordings or proof of site resonance.</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">{[110, 432].map((hz) => <button key={hz} type="button" onClick={() => void playReferenceTone(hz)} className={'rounded border px-2 py-2 text-left transition-all ' + (activeFrequency === hz ? 'border-cyan-300 bg-cyan-950/70 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.35)]' : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500')}><span className="block text-sm font-mono">{activeFrequency === hz ? '◉' : '▶'} {hz} Hz</span><span className="block text-[9px] text-slate-400">Play synthetic reference tone</span></button>)}</div>
            <div className="relative mt-2 h-10 overflow-hidden rounded border border-slate-800 bg-slate-950 flex items-center justify-center gap-1.5">{Array.from({ length: 28 }, (_, index) => <span key={index} className={'w-1 rounded-full bg-gradient-to-t from-cyan-600 to-amber-300 ' + (activeFrequency ? 'animate-pulse' : 'opacity-35')} style={{ height: `${activeFrequency ? 8 + ((index * 7 + activeFrequency) % 24) : 5 + (index % 5) * 2}px`, animationDelay: `${index * 18}ms` }} />)}<span className="absolute right-2 bottom-1 text-[8px] font-mono text-slate-500">{activeFrequency ? `${activeFrequency} Hz PLAYING` : 'AUDIO SIGNATURE'}</span></div>
          </div>
          <div className="rounded-lg border border-sky-500/30 bg-slate-950/80 p-3">
            <div className="text-[10px] font-mono font-bold text-sky-200">SITE TRIANGLE · NEAREST NEIGHBORS</div>
            {nearestSites.length === 2 ? <><div className="mt-2 text-xs text-white">{site.name} · {nearestSites[0].name} · {nearestSites[1].name}</div><div className="mt-1 text-[10px] leading-relaxed text-slate-300">Approximate local-plane interior angles: {triangleAngles.join('° · ')}°. Nearby site distances: {nearestSites.map((near) => near.name + ' ' + Math.round(near.distanceKm).toLocaleString() + ' km').join(' · ')}.</div><div className="mt-1 text-[9px] text-slate-500">Geographic triangle for exploration only; the local-plane approximation is not a surveyed ancient alignment.</div></> : <div className="mt-2 text-[10px] text-slate-400">Not enough reference sites to calculate a triangle.</div>}
          </div>
          <div className="rounded-lg border border-cyan-500/30 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-mono font-bold text-cyan-200">LOCK A / B / C TO THIS EARTH LOCATION</div>
              <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">{(['a', 'b', 'c'] as const).map((channel) => {
              const lockedHere = channelIsLockedHere(channel);
              const assignedHere = channelAlreadyTargetsSite(channel);
              const colorClass = channel === 'a'
                ? 'border-cyan-500/60 bg-cyan-950/50 text-cyan-200 hover:bg-cyan-900'
                : channel === 'b'
                  ? 'border-pink-500/60 bg-pink-950/50 text-pink-200 hover:bg-pink-900'
                  : 'border-amber-500/60 bg-amber-950/50 text-amber-200 hover:bg-amber-900';
              return <button
                key={channel}
                type="button"
                aria-pressed={lockedHere}
                disabled={!onAssignChannel || (lockedHere && !onToggleChannelLock)}
                onClick={() => {
                  if (lockedHere) onToggleChannelLock?.(channel);
                  else onAssignChannel?.(channel, site);
                }}
                title={lockedHere
                  ? `Unlock Channel ${channel.toUpperCase()} from this Earth location`
                  : assignedHere
                    ? `Lock Channel ${channel.toUpperCase()} back to this Earth location`
                    : `Move Channel ${channel.toUpperCase()} to ${site.name} and lock it there`}
                className={'rounded border px-2 py-2 text-[10px] font-mono font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ' + colorClass + (lockedHere ? ' ring-1 ring-emerald-300' : '')}
              >
                {lockedHere ? '🔒 UNLOCK ' : assignedHere ? '🔐 LOCK ' : 'LOCK '}CH-{channel.toUpperCase()}
              </button>;
            })}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-mono">
              {(['a', 'b', 'c'] as const).map((channel) => <span key={channel} className={channelIsLockedHere(channel) ? 'text-emerald-300' : earthChannelTargets?.[channel] ? 'text-amber-200' : 'text-slate-500'}>
                CH-{channel.toUpperCase()}: {channelIsLockedHere(channel) ? 'LOCKED HERE' : channelAlreadyTargetsSite(channel) ? 'TARGET SAVED · UNLOCKED' : earthChannelTargets?.[channel] ? 'LOCKED TO ANOTHER SITE' : 'NOT ASSIGNED'}
              </span>)}
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-500">Locking places the channel at these coordinates and keeps its Earth-fixed target synchronized with the selected simulation year. The matching A/B/C pin on the globe shows its assignment. Unlocking leaves the target available to lock again.</p>
          </div>
          <div className="rounded-lg border border-violet-500/30 bg-slate-950/80 p-3">
            <div className="text-[10px] font-mono font-bold text-violet-200">STAR & MOON COMPARISON</div>
            <div className="mt-2 text-[10px] leading-relaxed text-slate-300">Use the A/B/C star triangle in Star Alignment controls, then use a star's “Locate on Earth” action to compare its calculated substellar point with this location. The Moon orbit in the 3D scene is currently compressed and illustrative, not a precision lunar ephemeris.</div>
          </div>
          <div className="mt-auto rounded-lg border border-slate-800 p-3"><div className="text-[10px] font-mono font-bold text-slate-300">RESEARCH CHECKLIST</div><ul className="mt-2 list-disc pl-4 space-y-1 text-[10px] leading-relaxed text-slate-400"><li>Verify surveyed coordinates and architectural axes.</li><li>Compare candidate sky targets using a dated sky model.</li><li>Record published acoustic measurements and conditions.</li><li>Test numerical patterns against chance and uncertainty.</li></ul></div>
        </section>
      </div>
    </div>
  );
};
