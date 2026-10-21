import React, { useRef, useEffect } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { Lock, Unlock, Zap, Triangle } from 'lucide-react';

interface DeltaHUDProps {
  aFreq: number;
  bFreq: number;
  cFreq: number;
  aFineTune: number;
  bFineTune: number;
  cFineTune: number;
  isDeltaLocked: boolean;
  audioEngine: AudioEngine | null;
  isRunning: boolean;
  onToggleDeltaLock: () => void;
  onSetQuickDelta: (delta: number) => void;
}

export const DeltaHUD: React.FC<DeltaHUDProps> = ({
  aFreq,
  bFreq,
  cFreq,
  aFineTune,
  bFineTune,
  cFineTune,
  isDeltaLocked,
  audioEngine,
  isRunning,
  onToggleDeltaLock,
  onSetQuickDelta,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const totalA = aFreq + aFineTune;
  const totalB = bFreq + bFineTune;
  const totalC = cFreq + cFineTune;

  const deltaAB = Math.abs(totalB - totalA);
  const deltaBC = Math.abs(totalC - totalB);
  const deltaCA = Math.abs(totalC - totalA);

  // Brainwave classification helper
  const getBrainwaveInfo = (d: number) => {
    if (d <= 4.0) return { name: 'DELTA', color: '#38bdf8', desc: 'Deep Restorative Sleep' };
    if (d <= 8.0) return { name: 'THETA', color: '#a855f7', desc: 'Meditation & Creativity' };
    if (d <= 12.0) return { name: 'ALPHA', color: '#00f0ff', desc: 'Calm Alertness & Focus' };
    if (d <= 30.0) return { name: 'BETA', color: '#f59e0b', desc: 'Active Cognition' };
    return { name: 'GAMMA', color: '#ff007f', desc: 'Peak Neural Synchrony' };
  };

  const primaryBand = getBrainwaveInfo(deltaAB);

  // 3-Phase Oscilloscope / Lissajous Scope
  useEffect(() => {
    let animId: number;
    const aData = new Uint8Array(128);
    const bData = new Uint8Array(128);
    const cData = new Uint8Array(128);

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Dark background
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, w, h);

      // Radar / Scope Polar Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2);
      ctx.stroke();

      if (audioEngine && isRunning) {
        audioEngine.getATimeDomainData(aData);
        audioEngine.getBTimeDomainData(bData);
        audioEngine.getCTimeDomainData(cData);

        const cx = w / 2;
        const cy = h / 2;
        const amp = Math.min(w, h) * 0.38;

        // 1. Lissajous AB loop (Cyan vs Pink phase interaction)
        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = primaryBand.color;
        ctx.shadowColor = primaryBand.color;
        ctx.shadowBlur = 6;

        for (let i = 0; i < 128; i++) {
          const xVal = (aData[i] / 128.0 - 1.0) * amp;
          const yVal = (bData[i] / 128.0 - 1.0) * amp;
          const px = cx + xVal;
          const py = cy - yVal;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // 2. Channel C overlay harmonic circle
        ctx.beginPath();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 4;
        for (let i = 0; i < 128; i++) {
          const angle = (i / 128) * Math.PI * 2;
          const rMod = amp * 0.5 + ((cData[i] / 128.0 - 1.0) * amp * 0.4);
          const px = cx + Math.cos(angle) * rMod;
          const py = cy + Math.sin(angle) * rMod;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        // Idle triangular marker
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        const cx = w / 2;
        const cy = h / 2;
        const r = 16;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
        ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [audioEngine, isRunning, primaryBand.color]);

  const quickDeltas = [
    { label: 'Delta 2.5Hz', delta: 2.5 },
    { label: 'Theta 6.0Hz', delta: 6.0 },
    { label: 'Alpha 10.0Hz', delta: 10.0 },
    { label: 'Beta 18.0Hz', delta: 18.0 },
    { label: 'Gamma 40.0Hz', delta: 40.0 },
  ];

  return (
    <div className="bg-[#0b101c] rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4 select-none">
      {/* Left: Trinaural Triangular Delta Metrics */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Main Inter-Aural Delta (A vs B) */}
        <div className="p-3 bg-[#060a12] rounded-lg border border-slate-800 flex flex-col min-w-[170px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
              Δ A-B Inter-Aural
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-mono font-bold tabular-nums" style={{ color: primaryBand.color }}>
              Δ {deltaAB.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400">Hz</span>
          </div>
          <span className="text-[10px] font-mono font-semibold uppercase mt-0.5" style={{ color: primaryBand.color }}>
            {primaryBand.name} ({primaryBand.desc})
          </span>
        </div>

        {/* Secondary Deltas (B vs C and C vs A) */}
        <div className="flex flex-col gap-1.5">
          {/* Delta B-C */}
          <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-[#060a12] rounded-lg border border-slate-800 min-w-[150px]">
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Δ B-C (Right/Center):
            </span>
            <span className="text-xs font-mono font-bold text-amber-300 tabular-nums">
              {deltaBC.toFixed(2)} Hz
            </span>
          </div>

          {/* Delta C-A */}
          <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-[#060a12] rounded-lg border border-slate-800 min-w-[150px]">
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
              Δ C-A (Center/Left):
            </span>
            <span className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
              {deltaCA.toFixed(2)} Hz
            </span>
          </div>
        </div>

        {/* Trinaural Lock / Unlock Link Button */}
        <button
          onClick={onToggleDeltaLock}
          className={`flex items-center gap-2 px-3.5 py-3 rounded-lg border transition-all text-xs font-mono font-bold ${
            isDeltaLocked
              ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md'
              : 'bg-[#070b14] border-slate-700 text-slate-400 hover:text-white'
          }`}
          title={isDeltaLocked ? 'Locked: tuning CH-A moves CH-B and CH-C in fixed trinaural offset' : 'Unlocked: all 3 channels tune independently'}
        >
          {isDeltaLocked ? <Lock className="w-4 h-4 text-purple-400" /> : <Unlock className="w-4 h-4" />}
          <span>{isDeltaLocked ? 'TRINAURAL LOCKED' : 'FREE INDEPENDENT'}</span>
        </button>
      </div>

      {/* Center: 3-Signal Lissajous Scope Canvas */}
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-24 bg-[#060a12] rounded-lg border border-slate-800 overflow-hidden shadow-inner">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
        <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase flex items-center gap-1">
          <Triangle className="w-2.5 h-2.5 text-slate-400" />
          Trinaural Phase Scope
        </span>
      </div>

      {/* Right: Quick Target Band Buttons */}
      <div className="flex flex-col gap-1.5 w-full lg:w-auto">
        <span className="text-[10px] font-mono text-slate-400 uppercase">Quick Target Band</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {quickDeltas.map((qd) => (
            <button
              key={qd.delta}
              onClick={() => onSetQuickDelta(qd.delta)}
              className={`px-2.5 py-1.5 text-xs font-mono rounded border transition-colors ${
                Math.abs(deltaAB - qd.delta) < 0.2
                  ? 'bg-slate-800 text-white border-cyan-400 shadow-sm'
                  : 'bg-[#070b14] text-slate-400 hover:text-white border-slate-800'
              }`}
            >
              {qd.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
