import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Orbit, Pause, Play, Sun } from 'lucide-react';
import { getHeliocentricOrbitElements, HeliocentricOrbitElement } from '../data/planetaryEphemeris';

interface SolarSystemViewProps {
  epochMs: number;
  onClose: () => void;
}

const TAU = Math.PI * 2;
const MOON_SIDEREAL_PERIOD_DAYS = 27.321661;
const EARTH_SIDEREAL_DAY_DAYS = 0.9972695663;

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number) {
  let mean = meanAnomaly % TAU;
  if (mean < 0) mean += TAU;
  let eccentric = mean + eccentricity * Math.sin(mean) * (1 + eccentricity * Math.cos(mean));
  for (let i = 0; i < 12; i += 1) {
    const step = (eccentric - eccentricity * Math.sin(eccentric) - mean) /
      Math.max(0.00001, 1 - eccentricity * Math.cos(eccentric));
    eccentric -= step;
    if (Math.abs(step) < 1e-8) break;
  }
  return eccentric;
}

function orbitPoint(body: HeliocentricOrbitElement, eccentricAnomaly: number, displaySemiMajorAxis: number) {
  const e = body.eccentricity;
  const xLocal = displaySemiMajorAxis * (Math.cos(eccentricAnomaly) - e);
  const yLocal = displaySemiMajorAxis * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(eccentricAnomaly);
  const argument = body.argumentOfPerihelionDeg * Math.PI / 180;
  const node = body.longitudeAscendingNodeDeg * Math.PI / 180;
  const inclination = body.inclinationDeg * Math.PI / 180;
  const xPeri = xLocal * Math.cos(argument) - yLocal * Math.sin(argument);
  const yPeri = xLocal * Math.sin(argument) + yLocal * Math.cos(argument);
  const yInclined = yPeri * Math.cos(inclination);
  const zInclined = yPeri * Math.sin(inclination);
  return {
    x: xPeri * Math.cos(node) - yInclined * Math.sin(node),
    y: xPeri * Math.sin(node) + yInclined * Math.cos(node),
    z: zInclined,
  };
}

function formatDate(epochMs: number) {
  const date = new Date(epochMs);
  if (!Number.isFinite(date.getTime())) return 'Simulation date unavailable';
  return date.toISOString().slice(0, 10);
}

export const SolarSystemView: React.FC<SolarSystemViewProps> = ({ epochMs, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bodiesRef = useRef<HeliocentricOrbitElement[]>(getHeliocentricOrbitElements(epochMs));
  const elapsedDaysRef = useRef(0);
  const speedRef = useRef(5);
  const lastFrameRef = useRef<number | null>(null);
  const [daysPerSecond, setDaysPerSecond] = useState(5);
  const [isSimulationPaused, setIsSimulationPaused] = useState(false);
  const [elapsedDaysDisplay, setElapsedDaysDisplay] = useState(0);

  useEffect(() => {
    bodiesRef.current = getHeliocentricOrbitElements(epochMs);
    elapsedDaysRef.current = 0;
    setElapsedDaysDisplay(0);
    lastFrameRef.current = null;
  }, [epochMs]);

  useEffect(() => { speedRef.current = daysPerSecond; }, [daysPerSecond]);

  useEffect(() => {
    let animationFrame = 0;
    let lastHudUpdate = 0;
    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrame = requestAnimationFrame(renderFrame);
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const targetWidth = Math.max(1, Math.round(width * dpr));
      const targetHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const previous = lastFrameRef.current;
      if (previous !== null && !isSimulationPaused) {
        elapsedDaysRef.current += Math.min(0.1, Math.max(0, now - previous) / 1000) * speedRef.current;
      }
      lastFrameRef.current = now;
      const elapsedDays = elapsedDaysRef.current;
      const simulatedEpoch = epochMs + elapsedDays * 86400000;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const background = ctx.createRadialGradient(width * 0.5, height * 0.48, 2, width * 0.5, height * 0.48, Math.max(width, height) * 0.7);
      background.addColorStop(0, '#101d31');
      background.addColorStop(0.65, '#050a14');
      background.addColorStop(1, '#02040a');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      // Fixed, deterministic star specks keep the view legible without external assets.
      for (let i = 0; i < 145; i += 1) {
        const sx = ((i * 197.31 + 31.7) % 997) / 997 * width;
        const sy = ((i * 313.17 + 71.3) % 991) / 991 * height;
        ctx.globalAlpha = 0.18 + (i % 5) * 0.1;
        ctx.fillStyle = i % 7 === 0 ? '#9bc8ff' : '#e2ebff';
        ctx.beginPath();
        ctx.arc(sx, sy, i % 11 === 0 ? 1.25 : 0.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const bodies = bodiesRef.current;
      const maximumAU = Math.max(...bodies.map((body) => body.semimajorAxisAu * (1 + body.eccentricity)));
      const maximumOrbitPixels = Math.max(100, Math.min(width * 0.455, height * 0.405));
      const sunX = width / 2;
      const sunY = height / 2 + 8;
      const displayAxis = (body: HeliocentricOrbitElement) =>
        12 + Math.log1p(body.semimajorAxisAu) / Math.log1p(maximumAU) * (maximumOrbitPixels - 12);
      const project = (point: { x: number; y: number; z: number }) => ({
        x: sunX + point.x,
        y: sunY - (point.y * Math.cos(0.23) - point.z * Math.sin(0.23)),
      });

      // Planet orbits are drawn as true ellipse shapes with their sourced eccentricity
      // and inclination, but semimajor axes are logarithmically compressed for a usable UI.
      bodies.forEach((body) => {
        const aPixels = displayAxis(body);
        ctx.beginPath();
        for (let sample = 0; sample <= 150; sample += 1) {
          const eccentricAnomaly = sample / 150 * TAU;
          const p = project(orbitPoint(body, eccentricAnomaly, aPixels));
          if (sample === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.strokeStyle = body.id === 'earth' ? 'rgba(96,165,250,.58)' : body.id === 'mars' ? 'rgba(251,113,133,.36)' : 'rgba(148,163,184,.2)';
        ctx.lineWidth = body.id === 'earth' ? 1.6 : 1;
        ctx.stroke();
      });

      // Sun is the actual heliocentric origin for the model.
      ctx.save();
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 36);
      sunGlow.addColorStop(0, 'rgba(255,246,180,.98)');
      sunGlow.addColorStop(0.17, 'rgba(251,191,36,.92)');
      sunGlow.addColorStop(0.48, 'rgba(249,115,22,.2)');
      sunGlow.addColorStop(1, 'rgba(249,115,22,0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 36, 0, TAU);
      ctx.fill();
      const sunDisk = ctx.createRadialGradient(sunX - 3, sunY - 4, 1, sunX, sunY, 11);
      sunDisk.addColorStop(0, '#fff7c2');
      sunDisk.addColorStop(0.6, '#fbbf24');
      sunDisk.addColorStop(1, '#ea580c');
      ctx.fillStyle = sunDisk;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 11, 0, TAU);
      ctx.fill();
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('SUN · CENTER', sunX + 15, sunY - 12);
      ctx.restore();

      const positionById: Record<string, { x: number; y: number; z: number; radius: number }> = {};
      bodies.forEach((body) => {
        const aPixels = displayAxis(body);
        const mean = body.meanAnomalyRad + elapsedDays / body.orbitalPeriodDays * TAU;
        const eccentricAnomaly = solveEccentricAnomaly(mean, body.eccentricity);
        const p = project(orbitPoint(body, eccentricAnomaly, aPixels));
        const radius = body.id === 'earth' ? 5.8 : Math.max(3, Math.min(6.8, body.size * 0.82));
        positionById[body.id] = { x: p.x, y: p.y, z: 0, radius };

        // Directional planet lighting keeps the bodies spherical without hiding their colors.
        ctx.save();
        const shading = ctx.createRadialGradient(p.x - radius * 0.35, p.y - radius * 0.38, 0.5, p.x, p.y, radius * 1.6);
        shading.addColorStop(0, '#ffffff');
        shading.addColorStop(0.22, body.color);
        shading.addColorStop(1, '#020617');
        ctx.fillStyle = shading;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, TAU);
        ctx.fill();
        if (body.id === 'saturn') {
          ctx.strokeStyle = 'rgba(253,230,138,.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, radius * 1.8, radius * 0.58, -0.25, 0, TAU);
          ctx.stroke();
        }
        if (body.id === 'earth') {
          // A single rotating meridian cue illustrates Earth's sidereal spin.
          const spin = (elapsedDays / EARTH_SIDEREAL_DAY_DAYS) * TAU;
          ctx.strokeStyle = 'rgba(186,230,253,.8)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, Math.max(1.2, Math.abs(Math.cos(spin)) * radius * 0.92), radius * 0.88, spin * 0.06, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = 'rgba(74,222,128,.75)';
          ctx.beginPath();
          ctx.ellipse(p.x - radius * 0.25, p.y - radius * 0.12, radius * 0.32, radius * 0.2, 0.4, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(p.x + radius * 0.3, p.y + radius * 0.22, radius * 0.21, radius * 0.14, -0.5, 0, TAU);
          ctx.fill();
        }
        ctx.restore();

        ctx.font = body.id === 'earth' ? 'bold 10px ui-monospace, monospace' : '9px ui-monospace, monospace';
        ctx.fillStyle = body.color;
        ctx.shadowColor = '#020617';
        ctx.shadowBlur = 4;
        ctx.fillText(body.name, p.x + radius + 4, p.y - radius - 2);
        ctx.shadowBlur = 0;
      });

      // The lunar orbit is intentionally enlarged on screen; its sidereal orbital and
      // axial-rotation period both remain 27.321661 simulated days (1:1 tidal locking).
      const earth = positionById.earth;
      if (earth) {
        const moonOrbitX = 17;
        const moonOrbitY = 10;
        ctx.strokeStyle = 'rgba(203,213,225,.62)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.ellipse(earth.x, earth.y, moonOrbitX, moonOrbitY, -0.28, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        const moonAngle = (elapsedDays / MOON_SIDEREAL_PERIOD_DAYS) * TAU + 0.8;
        const moonX = earth.x + moonOrbitX * Math.cos(moonAngle);
        const moonY = earth.y + moonOrbitY * Math.sin(moonAngle);
        const moonRadius = 2.8;
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, TAU);
        ctx.fill();

        // The darker near-side mark always faces Earth: visual 1:1 synchronous rotation.
        const earthFacingAngle = Math.atan2(earth.y - moonY, earth.x - moonX);
        ctx.save();
        ctx.translate(moonX, moonY);
        ctx.rotate(earthFacingAngle);
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(-1.15, 0, 0.95, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-0.2, -1.15, 0.55, 0, TAU);
        ctx.fill();
        ctx.restore();

        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('MOON · 27.32 d · 1:1 LOCK', moonX + 6, moonY + 13);
      }

      // Keep the Sun visibly centered even in compact viewports.
      ctx.strokeStyle = 'rgba(251,191,36,.2)';
      ctx.beginPath();
      ctx.moveTo(sunX - 45, sunY);
      ctx.lineTo(sunX + 45, sunY);
      ctx.moveTo(sunX, sunY - 45);
      ctx.lineTo(sunX, sunY + 45);
      ctx.stroke();

      if (now - lastHudUpdate >= 800) {
        lastHudUpdate = now;
        setElapsedDaysDisplay(Math.floor(elapsedDays));
      }
      animationFrame = requestAnimationFrame(renderFrame);
    };
    animationFrame = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animationFrame);
  }, [epochMs, isSimulationPaused]);

  const simulatedDateMs = epochMs + elapsedDaysDisplay * 86400000;
  const totalEarthDays = elapsedDaysDisplay.toLocaleString();

  return (
    <div className="absolute inset-0 z-[15] overflow-hidden bg-[#02040a]" aria-label="Sun-centered solar system simulation">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute left-3 right-3 top-[4.65rem] z-40 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
        <div className="max-w-xl rounded-xl border border-amber-400/40 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold tracking-widest text-amber-200">
            <Sun className="h-4 w-4" /> HELIOCENTRIC SOLAR SYSTEM
          </div>
          <div className="mt-1 text-[10px] text-slate-300">Sun fixed at the center · Keplerian elliptical orbits · inclination retained</div>
          <div className="mt-1 text-[10px] font-mono text-sky-200">
            DATE {formatDate(simulatedDateMs)} · +{totalEarthDays} SIMULATED DAYS · {daysPerSecond} DAY{daysPerSecond === 1 ? '' : 'S'}/SEC
          </div>
          <div className="mt-1 text-[9px] leading-relaxed text-slate-500">Orbit radii and planet sizes are compressed for visibility. Orbital periods are derived from semimajor axis using Kepler's third law; perturbations are not simulated.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/90 p-2 shadow-xl pointer-events-auto">
          <label className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
            TIME SPEED
            <select value={daysPerSecond} onChange={(event) => setDaysPerSecond(Number(event.target.value))} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white">
              <option value={1}>1 day/sec</option>
              <option value={5}>5 days/sec</option>
              <option value={30}>30 days/sec</option>
              <option value={365}>365 days/sec</option>
            </select>
          </label>
          <button type="button" onClick={() => setIsSimulationPaused((value) => !value)} className="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-mono text-white hover:bg-slate-800">
            {isSimulationPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {isSimulationPaused ? 'RESUME' : 'PAUSE'}
          </button>
          <button type="button" onClick={onClose} className="flex items-center gap-1 rounded border border-amber-500/50 px-2 py-1 text-[10px] font-mono text-amber-200 hover:bg-amber-950/60">
            <ArrowLeft className="h-3.5 w-3.5" /> RETURN TO EARTH / ORBIT
          </button>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 z-40 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/85 px-3 py-2 text-[9px] font-mono text-slate-300">
        <Orbit className="h-3.5 w-3.5 text-sky-300" />
        <span>SIDEREAL DAY {EARTH_SIDEREAL_DAY_DAYS.toFixed(5)} d</span>
        <span className="text-slate-600">·</span>
        <span>LUNAR ORBIT {MOON_SIDEREAL_PERIOD_DAYS.toFixed(3)} d</span>
      </div>
    </div>
  );
};
