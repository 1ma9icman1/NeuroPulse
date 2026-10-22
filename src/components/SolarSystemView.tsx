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
const PLANET_TEXTURE_URLS: Record<string, string> = {
  mercury: 'https://www.solarsystemscope.com/textures/download/2k_mercury.jpg',
  venus: 'https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg',
  earth: 'https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg',
  mars: 'https://www.solarsystemscope.com/textures/download/2k_mars.jpg',
  jupiter: 'https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg',
  saturn: 'https://www.solarsystemscope.com/textures/download/2k_saturn.jpg',
  uranus: 'https://www.solarsystemscope.com/textures/download/2k_uranus.jpg',
  neptune: 'https://www.solarsystemscope.com/textures/download/2k_neptune.jpg',
  pluto: 'https://www.solarsystemscope.com/textures/download/2k_pluto.jpg',
  moon: 'https://www.solarsystemscope.com/textures/download/2k_moon.jpg',
};

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

const PLANET_SPIN_DAYS: Record<string, number> = {
  mercury: 58.646, venus: -243.025, earth: 0.9972695663, mars: 1.025957,
  jupiter: 0.41354, saturn: 0.44401, uranus: -0.71833, neptune: 0.67125, pluto: 6.387,
};

function drawCrater(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.fillStyle = 'rgba(12,16,22,.22)';
  ctx.beginPath(); ctx.ellipse(x, y, radius, radius * 0.72, -0.24, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.17)'; ctx.lineWidth = Math.max(.45, radius * .12);
  ctx.beginPath(); ctx.ellipse(x - radius * .08, y - radius * .06, radius * .87, radius * .62, -0.24, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
}

function drawPlanetDisk(ctx: CanvasRenderingContext2D, body: HeliocentricOrbitElement, x: number, y: number, radius: number, elapsedDays: number, textures: Record<string, HTMLImageElement>) {
  const id = body.id;
  const spinDays = PLANET_SPIN_DAYS[id] || 1;
  const spin = elapsedDays / spinDays * TAU;
  const base = id === 'mercury' ? '#8a8379' : id === 'venus' ? '#d7b783' : id === 'earth' ? '#1457a0' :
    id === 'mars' ? '#b64f35' : id === 'jupiter' ? '#c99d73' : id === 'saturn' ? '#d7bd88' :
    id === 'uranus' ? '#76cbd1' : id === 'neptune' ? '#315bcb' : '#b7a99a';

  // Draw far-side Saturn rings first so its body naturally occludes the far half.
  if (id === 'saturn') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.28);
    ctx.strokeStyle = 'rgba(173,145,104,.5)'; ctx.lineWidth = Math.max(1.6, radius * .45);
    ctx.beginPath(); ctx.ellipse(0, 0, radius * 2.1, radius * .72, 0, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(241,220,173,.62)'; ctx.lineWidth = Math.max(.7, radius * .12);
    ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.75, radius * .59, 0, Math.PI, TAU); ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.clip();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const r = radius;

  const surface = ctx.createRadialGradient(-r * .38, -r * .42, r * .03, r * .15, r * .14, r * 1.22);
  surface.addColorStop(0, base);
  surface.addColorStop(.76, base);
  surface.addColorStop(1, '#07101e');
  ctx.fillStyle = surface; ctx.fillRect(-r, -r, 2 * r, 2 * r);

  const texture = textures[id];
  if (texture) ctx.drawImage(texture, -r, -r, 2 * r, 2 * r);

  if (!texture && (id === 'mercury' || id === 'pluto')) {
    const craters = id === 'mercury'
      ? [[-.48,-.42,.18],[.24,-.55,.12],[.56,-.15,.21],[-.12,.05,.22],[.37,.42,.15],[-.52,.48,.12],[.03,.6,.11]]
      : [[-.5,-.35,.19],[.24,-.43,.13],[.45,.1,.2],[-.15,.2,.22],[.18,.58,.12],[-.55,.48,.1]];
    craters.forEach(([cx, cy, size]) => drawCrater(ctx, cx * r, cy * r, size * r));
    if (id === 'pluto') {
      ctx.fillStyle = 'rgba(249,231,205,.55)';
      ctx.beginPath(); ctx.ellipse(-r * .15, -r * .2, r * .28, r * .18, -.3, 0, TAU); ctx.fill();
    }
  } else if (!texture && id === 'venus') {
    ctx.globalAlpha = .72;
    for (let band = -3; band <= 3; band += 1) {
      ctx.strokeStyle = band % 2 ? '#f1d8ac' : '#b18d62';
      ctx.lineWidth = Math.max(1, r * .2);
      ctx.beginPath();
      ctx.moveTo(-r, band * r * .27);
      ctx.bezierCurveTo(-r * .45, band * r * .27 - r * .12, r * .12, band * r * .27 + r * .15, r, band * r * .22);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (!texture && id === 'earth') {
    // Simplified continent silhouettes with cloud swirls; textured enough to read as Earth at this scale.
    ctx.fillStyle = '#348653';
    ctx.beginPath(); ctx.moveTo(-r*.72,-r*.13); ctx.lineTo(-r*.53,-r*.49); ctx.lineTo(-r*.19,-r*.55); ctx.lineTo(-r*.04,-r*.27); ctx.lineTo(-r*.22,-r*.06); ctx.lineTo(-r*.29,r*.18); ctx.lineTo(-r*.47,r*.34); ctx.lineTo(-r*.57,r*.12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r*.06,-r*.07); ctx.lineTo(r*.28,-r*.18); ctx.lineTo(r*.5,-r*.06); ctx.lineTo(r*.62,r*.2); ctx.lineTo(r*.42,r*.4); ctx.lineTo(r*.27,r*.2); ctx.lineTo(r*.15,r*.35); ctx.lineTo(r*.04,r*.16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(151,219,232,.66)';
    for (let band = -2; band <= 2; band += 1) {
      ctx.strokeStyle = band % 2 ? 'rgba(229,246,255,.58)' : 'rgba(180,225,239,.35)';
      ctx.lineWidth = Math.max(.65, r * .09);
      ctx.beginPath(); ctx.moveTo(-r, band * r * .25);
      ctx.bezierCurveTo(-r*.35, band*r*.25-r*.12, r*.25, band*r*.25+r*.1, r, band*r*.22); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(239,248,255,.72)';
    ctx.beginPath(); ctx.ellipse(0,-r*.83,r*.47,r*.12,0,0,TAU); ctx.fill();
  } else if (!texture && id === 'mars') {
    ctx.fillStyle = 'rgba(87,38,31,.55)';
    ctx.beginPath(); ctx.ellipse(-r*.32,-r*.12,r*.34,r*.2,-.45,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*.38,r*.27,r*.29,r*.17,.3,0,TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,176,.55)';
    ctx.beginPath(); ctx.ellipse(-r*.06,-r*.82,r*.4,r*.11,-.08,0,TAU); ctx.fill();
    drawCrater(ctx, r*.2, -r*.05, r*.12);
  } else if (!texture && (id === 'jupiter' || id === 'saturn')) {
    const bands = id === 'jupiter'
      ? [{ y:-.72, h:.13, c:'#ead0aa' },{ y:-.5,h:.09,c:'#9b6e53' },{y:-.3,h:.18,c:'#e8c69c'},{y:-.08,h:.11,c:'#9c6a51'},{y:.15,h:.14,c:'#e8c9a2'},{y:.4,h:.17,c:'#9c7158'},{y:.65,h:.1,c:'#e8d0ae'}]
      : [{y:-.7,h:.12,c:'#f1dfb9'},{y:-.48,h:.1,c:'#9f8a69'},{y:-.25,h:.15,c:'#f4dfb0'},{y:0,h:.11,c:'#b89b73'},{y:.24,h:.17,c:'#ead3a5'},{y:.5,h:.1,c:'#a89070'},{y:.7,h:.08,c:'#e9d6af'}];
    bands.forEach((band) => {
      ctx.fillStyle = band.c;
      ctx.beginPath(); ctx.ellipse(0, band.y*r, r*1.15, band.h*r, 0, 0, TAU); ctx.fill();
    });
    if (id === 'jupiter') {
      ctx.fillStyle = '#bd6547'; ctx.beginPath(); ctx.ellipse(r*.28,r*.25,r*.26,r*.15,-.2,0,TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(250,222,182,.8)'; ctx.lineWidth = Math.max(.6,r*.07);
      ctx.beginPath(); ctx.ellipse(r*.28,r*.25,r*.2,r*.1,-.2,Math.PI*.08,Math.PI*1.2); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(245,232,197,.72)'; ctx.beginPath(); ctx.ellipse(0,-r*.82,r*.32,r*.09,0,0,TAU); ctx.fill();
    }
  } else if (!texture && (id === 'uranus' || id === 'neptune')) {
    for (let band = -3; band <= 3; band += 1) {
      ctx.strokeStyle = band % 2 ? 'rgba(219,250,255,.22)' : 'rgba(8,54,130,.24)';
      ctx.lineWidth = Math.max(.8,r*.11);
      ctx.beginPath(); ctx.moveTo(-r,band*r*.23); ctx.bezierCurveTo(-r*.45,band*r*.23-r*.08,r*.45,band*r*.23+r*.07,r,band*r*.2); ctx.stroke();
    }
    if (id === 'neptune') {
      ctx.fillStyle = 'rgba(10,36,112,.6)'; ctx.beginPath(); ctx.ellipse(r*.27,r*.1,r*.2,r*.1,-.25,0,TAU); ctx.fill();
    }
  }
  ctx.restore();

  // Fixed-direction night-side falloff and lit-rim reflection.
  const lighting = ctx.createLinearGradient(x - r, y - r * .25, x + r, y + r * .2);
  lighting.addColorStop(0, 'rgba(255,255,255,.14)');
  lighting.addColorStop(.42, 'rgba(255,255,255,0)');
  lighting.addColorStop(.76, 'rgba(2,6,18,.28)');
  lighting.addColorStop(1, 'rgba(0,3,12,.88)');
  ctx.fillStyle = lighting;
  ctx.fillRect(x-r,y-r,2*r,2*r);

  const edge = ctx.createRadialGradient(x-r*.3,y-r*.34,r*.22,x,y,r*1.04);
  edge.addColorStop(.7,'rgba(0,0,0,0)');
  edge.addColorStop(.93,'rgba(0,0,0,.24)');
  edge.addColorStop(1,'rgba(0,0,0,.75)');
  ctx.fillStyle = edge;
  ctx.fillRect(x-r,y-r,2*r,2*r);
  ctx.restore();

  ctx.beginPath(); ctx.arc(x,y,radius,0,TAU);
  ctx.strokeStyle = id === 'earth' ? 'rgba(125,211,252,.84)' : 'rgba(226,232,240,.3)';
  ctx.lineWidth = id === 'earth' ? 1.2 : .65;
  ctx.stroke();

  // The near half of Saturn's rings sits over its sphere.
  if (id === 'saturn') {
    ctx.save(); ctx.translate(x,y); ctx.rotate(-.28);
    ctx.strokeStyle = 'rgba(235,217,173,.85)'; ctx.lineWidth = Math.max(1.2,r*.25);
    ctx.beginPath(); ctx.ellipse(0,0,r*2.05,r*.69,0,0,Math.PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(123,103,76,.9)'; ctx.lineWidth = Math.max(.6,r*.07);
    ctx.beginPath(); ctx.ellipse(0,0,r*1.62,r*.53,0,0,Math.PI); ctx.stroke();
    ctx.restore();
  }
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
  const planetTexturesRef = useRef<Record<string, HTMLImageElement>>({});
  const [planetTextureRevision, setPlanetTextureRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = [];
    Object.entries(PLANET_TEXTURE_URLS).forEach(([body, url]) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (cancelled) return;
        planetTexturesRef.current = { ...planetTexturesRef.current, [body]: image };
        setPlanetTextureRevision((revision) => revision + 1);
      };
      image.onerror = () => {
        // Procedural surface drawing remains available if a public texture fails.
      };
      image.src = url;
      images.push(image);
    });
    return () => {
      cancelled = true;
      images.forEach((image) => { image.onload = null; image.onerror = null; });
    };
  }, []);

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
        const radius = body.id === 'jupiter' ? 12.5 : body.id === 'saturn' ? 10.8 : body.id === 'earth' ? 7.4 : body.id === 'venus' ? 7 : body.id === 'uranus' || body.id === 'neptune' ? 7.2 : body.id === 'mars' ? 6.3 : body.id === 'mercury' ? 4.7 : 4.5;
        positionById[body.id] = { x: p.x, y: p.y, z: 0, radius };

        // Distinct surface features, rotating texture marks, atmospheric shading and rim light.
        drawPlanetDisk(ctx, body, p.x, p.y, radius, elapsedDays, planetTexturesRef.current);

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
  }, [epochMs, isSimulationPaused, planetTextureRevision]);

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
          <div className="mt-1 text-[9px] leading-relaxed text-slate-500">Orbit radii and planet sizes are compressed for visibility. Orbital periods are derived from semimajor axis using Kepler's third law; perturbations are not simulated. Surface maps: Solar System Scope, based on NASA imagery/elevation data · CC BY 4.0; drawn details are local fallbacks.</div>
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
