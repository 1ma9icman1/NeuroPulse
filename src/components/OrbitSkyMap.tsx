import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getPlanetSkyPositions } from '../data/planetaryEphemeris';
import { X, Search, Minus, Plus, RotateCcw } from 'lucide-react';

type Star = { name: string; ra: number; dec: number; mag: number; color?: string };
const STARS: Star[] = [
  { name: 'Polaris', ra: 37.95, dec: 89.26, mag: 2.0 }, { name: 'Vega', ra: 279.23, dec: 38.78, mag: 0.0 },
  { name: 'Deneb', ra: 310.36, dec: 45.28, mag: 1.3 }, { name: 'Altair', ra: 297.70, dec: 8.87, mag: 0.8 },
  { name: 'Arcturus', ra: 213.92, dec: 19.18, mag: -0.1 }, { name: 'Spica', ra: 201.30, dec: -11.16, mag: 1.0 },
  { name: 'Regulus', ra: 152.09, dec: 11.97, mag: 1.4 }, { name: 'Betelgeuse', ra: 88.79, dec: 7.41, mag: 0.5 },
  { name: 'Rigel', ra: 78.63, dec: -8.20, mag: 0.2 }, { name: 'Bellatrix', ra: 81.28, dec: 6.35, mag: 1.6 },
  { name: 'Sirius', ra: 101.29, dec: -16.72, mag: -1.46 }, { name: 'Procyon', ra: 114.83, dec: 5.22, mag: 0.4 },
  { name: 'Aldebaran', ra: 68.98, dec: 16.51, mag: 0.9 }, { name: 'Capella', ra: 79.17, dec: 45.998, mag: 0.1 },
  { name: 'Castor', ra: 113.65, dec: 31.89, mag: 1.6 }, { name: 'Pollux', ra: 116.33, dec: 28.03, mag: 1.1 },
  { name: 'Dubhe', ra: 165.93, dec: 61.75, mag: 1.8 }, { name: 'Merak', ra: 165.46, dec: 56.38, mag: 2.4 },
  { name: 'Phecda', ra: 178.46, dec: 53.69, mag: 2.4 }, { name: 'Megrez', ra: 183.86, dec: 57.03, mag: 3.3 },
  { name: 'Alioth', ra: 193.51, dec: 55.96, mag: 1.8 }, { name: 'Mizar', ra: 200.98, dec: 54.93, mag: 2.2 },
  { name: 'Alkaid', ra: 206.89, dec: 49.31, mag: 1.9 }, { name: 'Alpheratz', ra: 2.10, dec: 29.09, mag: 2.1 },
  { name: 'Mirach', ra: 17.43, dec: 35.62, mag: 2.1 }, { name: 'Algol', ra: 47.04, dec: 40.96, mag: 2.1 },
  { name: 'Denebola', ra: 177.26, dec: 14.57, mag: 2.1 }, { name: 'Antares', ra: 247.35, dec: -26.43, mag: 1.1 },
  { name: 'Fomalhaut', ra: 344.41, dec: -29.62, mag: 1.2 }, { name: 'Canopus', ra: 95.99, dec: -52.70, mag: -0.7 },
  { name: 'Achernar', ra: 24.43, dec: -57.24, mag: 0.5 }, { name: 'Acrux', ra: 186.65, dec: -63.10, mag: 0.8 },
  { name: 'Alpha Centauri', ra: 219.90, dec: -60.83, mag: -0.3 }, { name: 'Alnitak', ra: 85.19, dec: -1.94, mag: 1.8 },
  { name: 'Alnilam', ra: 84.05, dec: -1.20, mag: 1.7 }, { name: 'Mintaka', ra: 83.00, dec: -0.30, mag: 2.2 },
  { name: 'Elnath', ra: 81.57, dec: 28.61, mag: 1.7 }, { name: 'Kochab', ra: 222.68, dec: 74.16, mag: 2.1 },
  { name: 'Deneb Kaitos', ra: 10.90, dec: -17.99, mag: 2.0 }, { name: 'Rasalhague', ra: 263.73, dec: 12.56, mag: 2.1 },
];
const CONSTELLATIONS: [string, string][] = [
  ['Dubhe','Merak'], ['Merak','Phecda'], ['Phecda','Megrez'], ['Megrez','Dubhe'], ['Megrez','Alioth'], ['Alioth','Mizar'], ['Mizar','Alkaid'],
  ['Vega','Deneb'], ['Deneb','Altair'], ['Altair','Vega'], ['Betelgeuse','Bellatrix'], ['Betelgeuse','Alnitak'], ['Alnitak','Alnilam'], ['Alnilam','Mintaka'], ['Mintaka','Bellatrix'], ['Rigel','Alnitak'],
  ['Castor','Pollux'], ['Alpheratz','Mirach'], ['Aldebaran','Elnath'],
];
type Props = { onClose: () => void };
export const OrbitSkyMap: React.FC<Props> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{x:number;y:number;ra:number;dec:number} | null>(null);
  const [zoom, setZoom] = useState(1);
  const [centerRa, setCenterRa] = useState(180);
  const [centerDec, setCenterDec] = useState(0);
  const [showStars, setShowStars] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [showPlanets, setShowPlanets] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const planets = useMemo(() => getPlanetSkyPositions(year), [year]);
  const filteredStars = useMemo(() => STARS.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [search]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.fillStyle = '#030712'; ctx.fillRect(0, 0, w, h);
    const fov = 180 / zoom;
    const project = (ra:number, dec:number) => {
      let dra = ((ra - centerRa + 540) % 360) - 180;
      const x = w / 2 + (dra / fov) * w;
      const y = h / 2 - ((dec - centerDec) / fov) * h;
      return {x,y,visible: Math.abs(dra) <= fov/2 && Math.abs(dec-centerDec) <= fov/2};
    };
    // Stable background stars make the sky readable before any catalog labels are selected.
    let seed = 92173;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i=0;i<520;i++) {
      const ra=rand()*360, dec=rand()*180-90, p=project(ra,dec);
      if (!p.visible) continue;
      ctx.fillStyle = 'rgba(191,219,254,'+(0.18+rand()*0.6)+')';
      ctx.beginPath(); ctx.arc(p.x,p.y,0.35+rand()*0.8,0,Math.PI*2); ctx.fill();
    }
    if (showGrid) {
      ctx.strokeStyle='rgba(56,189,248,0.16)'; ctx.lineWidth=1;
      for(let ra=Math.ceil((centerRa-fov/2)/15)*15;ra<=centerRa+fov/2;ra+=15){const a=project(ra,-90),b=project(ra,90);ctx.beginPath();ctx.moveTo(a.x,0);ctx.lineTo(b.x,h);ctx.stroke();}
      for(let dec=Math.ceil((centerDec-fov/2)/15)*15;dec<=centerDec+fov/2;dec+=15){const a=project(centerRa-fov/2,dec),b=project(centerRa+fov/2,dec);ctx.beginPath();ctx.moveTo(0,a.y);ctx.lineTo(w,b.y);ctx.stroke();}
    }
    const byName = new Map(STARS.map(s=>[s.name,s]));
    if (showLines) {
      ctx.strokeStyle='rgba(125,211,252,0.55)';ctx.lineWidth=1.25;
      for(const [a,b] of CONSTELLATIONS){const sa=byName.get(a),sb=byName.get(b);if(!sa||!sb)continue;const pa=project(sa.ra,sa.dec),pb=project(sb.ra,sb.dec);if(pa.visible||pb.visible){ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();}}
    }
    if (showStars) for(const star of STARS){const p=project(star.ra,star.dec);if(!p.visible)continue;const r=Math.max(1.2,Math.min(4.2,3.8-star.mag*0.8));ctx.fillStyle=star.mag<0?'#fff7c2':'#e0f2fe';ctx.shadowColor='#93c5fd';ctx.shadowBlur=star.mag<1?8:2;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;if(zoom>=1.3||star.mag<1){ctx.font='11px ui-monospace,monospace';ctx.fillStyle='#cbd5e1';ctx.fillText(star.name,p.x+6,p.y-5);}}
    if (showPlanets) for(const planet of planets){const p=project(planet.raDeg,planet.decDeg);if(!p.visible)continue;ctx.fillStyle=planet.color;ctx.shadowColor=planet.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(3,planet.size),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.font='bold 11px ui-monospace,monospace';ctx.fillStyle=planet.color;ctx.fillText(planet.name,p.x+7,p.y+4);}
    ctx.fillStyle='rgba(148,163,184,0.75)';ctx.font='10px ui-monospace,monospace';ctx.fillText('RA '+centerRa.toFixed(1)+'°  ·  DEC '+centerDec.toFixed(1)+'°  ·  FOV '+fov.toFixed(0)+'°',14,h-14);
    ctx.strokeStyle='rgba(148,163,184,0.22)';ctx.strokeRect(0.5,0.5,w-1,h-1);
  }, [zoom,centerRa,centerDec,showStars,showLines,showPlanets,showGrid,planets]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => { dragRef.current={x:e.clientX,y:e.clientY,ra:centerRa,dec:centerDec};e.currentTarget.setPointerCapture(e.pointerId); };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {if(!dragRef.current)return;const r=e.currentTarget.getBoundingClientRect();setCenterRa(((dragRef.current.ra-(e.clientX-dragRef.current.x)/r.width*180/zoom)%360+360)%360);setCenterDec(Math.max(-89,Math.min(89,dragRef.current.dec+(e.clientY-dragRef.current.y)/r.height*180/zoom)));};
  const reset = () => {setZoom(1);setCenterRa(180);setCenterDec(0);setSelected(null);};
  return <div className="absolute inset-0 z-[70] flex flex-col bg-[#030712] text-slate-100">
    <header className="flex flex-wrap items-center gap-2 border-b border-sky-900/60 bg-[#07101d] px-3 py-2">
      <div className="mr-auto"><div className="text-sm font-bold tracking-widest text-sky-300">ORBIT · SKY MAP</div><div className="text-[10px] text-slate-400">Interactive celestial chart · drag to pan · wheel or +/- to zoom</div></div>
      <label className="flex items-center gap-2 text-xs text-slate-300"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a star…" className="w-32 rounded border border-slate-700 bg-slate-900 px-2 py-1 outline-none focus:border-sky-500"/></label>
      <button onClick={()=>setZoom(z=>Math.min(8,z*1.35))} className="rounded border border-slate-700 p-1.5 hover:bg-slate-800" aria-label="Zoom in"><Plus size={16}/></button>
      <button onClick={()=>setZoom(z=>Math.max(0.5,z/1.35))} className="rounded border border-slate-700 p-1.5 hover:bg-slate-800" aria-label="Zoom out"><Minus size={16}/></button>
      <button onClick={reset} className="rounded border border-slate-700 p-1.5 hover:bg-slate-800" aria-label="Reset sky map"><RotateCcw size={16}/></button>
      <button onClick={onClose} className="rounded border border-rose-500/40 p-1.5 text-rose-300 hover:bg-rose-950/40" aria-label="Close Sky Map"><X size={16}/></button>
    </header>
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-3 py-2 text-[11px]">
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={showStars} onChange={e=>setShowStars(e.target.checked)}/>Stars</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={showLines} onChange={e=>setShowLines(e.target.checked)}/>Constellation lines</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={showPlanets} onChange={e=>setShowPlanets(e.target.checked)}/>Sun & planets</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/>RA/Dec grid</label>
      <div className="ml-auto flex min-w-48 items-center gap-2 text-amber-200"><span>Year</span><input aria-label="Sky map year" type="range" min="1800" max="2050" value={year} onChange={e=>setYear(Number(e.target.value))} className="w-28 accent-amber-400"/><span>{year}</span></div>
    </div>
    <canvas ref={canvasRef} className="min-h-0 flex-1 touch-none cursor-grab active:cursor-grabbing" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={()=>{dragRef.current=null;}} onPointerCancel={()=>{dragRef.current=null;}} onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(0.5,Math.min(8,z*(e.deltaY<0?1.12:0.89))));}} />
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#07101d] px-3 py-2 text-[10px] text-slate-400"><span>Local catalog · no account or cloud service required · planetary positions use the project’s Stardroid-derived ephemeris</span><span>{STARS.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase())).length} catalog stars · {planets.length} solar-system objects</span></footer>
    {search && <div className="absolute bottom-12 right-3 z-10 max-h-40 overflow-auto rounded border border-slate-700 bg-slate-950/95 p-1">{filteredStars.slice(0,8).map(s=><button key={s.name} onClick={()=>{setCenterRa(s.ra);setCenterDec(s.dec);setZoom(3);setSelected(s.name);}} className={`block w-full rounded px-3 py-1 text-left text-xs hover:bg-sky-900/60 ${selected===s.name?'text-sky-200':'text-slate-300'}`}>{s.name}</button>)}</div>}
  </div>;
};
