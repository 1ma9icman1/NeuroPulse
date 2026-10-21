import React, { useRef, useEffect } from 'react';
import { WaveformType, SpatialPosition, ChannelId } from '../types';
import { Knob } from './Knob';
import { AudioEngine } from '../audio/AudioEngine';
import { Volume2, VolumeX, ArrowUpDown } from 'lucide-react';

interface OscillatorDeckProps {
  channel: ChannelId;
  frequency: number;
  fineTune: number;
  waveform: WaveformType;
  gain: number;
  muted: boolean;
  position: SpatialPosition;
  audioEngine: AudioEngine | null;
  isRunning: boolean;
  onUpdateFrequency: (freq: number) => void;
  onUpdateFineTune: (fine: number) => void;
  onUpdateWaveform: (wave: WaveformType) => void;
  onUpdateGain: (gain: number) => void;
  onUpdateElevation: (elevation: number) => void;
  onToggleMute: () => void;
}

export const OscillatorDeck: React.FC<OscillatorDeckProps> = ({
  channel,
  frequency,
  fineTune,
  waveform,
  gain,
  muted,
  position,
  audioEngine,
  isRunning,
  onUpdateFrequency,
  onUpdateFineTune,
  onUpdateWaveform,
  onUpdateGain,
  onUpdateElevation,
  onToggleMute,
}) => {
  // Theme color and channel labeling based on channel
  const theme =
    channel === 'a'
      ? {
          color: '#00f0ff',
          bgBorder: 'border-cyan-500/40',
          headerBg: 'from-cyan-950/50 to-transparent',
          label: 'CH-A · LEFT [HARD L]',
        }
      : channel === 'b'
      ? {
          color: '#ff007f',
          bgBorder: 'border-pink-500/40',
          headerBg: 'from-pink-950/50 to-transparent',
          label: 'CH-B · RIGHT [HARD R]',
        }
      : {
          color: '#fbbf24',
          bgBorder: 'border-amber-500/40',
          headerBg: 'from-amber-950/50 to-transparent',
          label: 'CH-C · SPATIAL [CENTER]',
        };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const totalHz = Math.max(10, Math.min(2000, frequency + fineTune));

  // Mini oscilloscope loop
  useEffect(() => {
    let animId: number;
    const timeData = new Uint8Array(new ArrayBuffer(128));

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

      // Background
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, w, h);

      // Center reference line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      if (audioEngine && isRunning) {
        if (channel === 'a') {
          audioEngine.getATimeDomainData(timeData);
        } else if (channel === 'b') {
          audioEngine.getBTimeDomainData(timeData);
        } else {
          audioEngine.getCTimeDomainData(timeData);
        }
      } else {
        timeData.fill(128);
      }

      ctx.beginPath();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = theme.color;
      ctx.shadowColor = theme.color;
      ctx.shadowBlur = isRunning ? 6 : 0;

      const sliceWidth = w / 128;
      let x = 0;

      for (let i = 0; i < 128; i++) {
        const v = timeData[i] / 128.0;
        const y = h / 2 + (v - 1.0) * (h * 0.4);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [audioEngine, isRunning, channel, theme.color]);

  // Frequency step helpers
  const handleStepFreq = (amount: number) => {
    const next = Math.max(10, Math.min(2000, +(frequency + amount).toFixed(2)));
    onUpdateFrequency(next);
  };

  const handleOctave = (mult: number) => {
    const next = Math.max(10, Math.min(2000, +(frequency * mult).toFixed(2)));
    onUpdateFrequency(next);
  };

  const waveforms: Array<{ id: WaveformType; label: string }> = [
    { id: 'sine', label: 'SINE' },
    { id: 'triangle', label: 'TRI' },
    { id: 'sawtooth', label: 'SAW' },
    { id: 'square', label: 'SQR' },
  ];

  return (
    <div
      className={`bg-[#0c121e] rounded-xl border ${theme.bgBorder} p-3.5 shadow-xl flex flex-col gap-3.5 select-none relative overflow-hidden`}
    >
      {/* Top Header Strip */}
      <div
        className={`flex items-center justify-between border-b border-slate-800 pb-2.5 bg-gradient-to-r ${theme.headerBg} -mx-3.5 -mt-3.5 px-3.5 pt-3 rounded-t-xl`}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-sm shadow-md"
            style={{ backgroundColor: theme.color, boxShadow: `0 0 8px ${theme.color}` }}
          />
          <span className="text-xs font-mono font-bold tracking-wider text-white">
            {theme.label}
          </span>
        </div>

        {/* Live Total Output Hz & 3D Elevation Position */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <ArrowUpDown className="w-3 h-3 text-purple-400" />
            <span>Elev:</span>
            <span className="font-bold text-slate-200">
              {position.y > 0 ? '+' : ''}
              {position.y.toFixed(1)}m
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#070b14] px-2 py-0.5 rounded border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400">OUT:</span>
            <span className="text-xs font-mono font-bold tabular-nums" style={{ color: theme.color }}>
              {totalHz.toFixed(2)} Hz
            </span>
          </div>
        </div>
      </div>

      {/* Primary Frequency Deck: Big Display & Direct Number Input */}
      <div className="bg-[#070b14] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Carrier Tone Pitch
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleOctave(0.5)}
              className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
              title="Divide by 2 (Down 1 Octave)"
            >
              ÷2
            </button>
            <button
              onClick={() => handleOctave(2.0)}
              className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
              title="Multiply by 2 (Up 1 Octave)"
            >
              ×2
            </button>
          </div>
        </div>

        {/* Big LED Number Field */}
        <div className="flex items-center justify-between gap-2 bg-[#050810] px-2.5 py-1.5 rounded-lg border border-slate-700">
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              step="0.01"
              min="10"
              max="2000"
              value={frequency}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onUpdateFrequency(Math.max(10, Math.min(2000, val)));
              }}
              className="w-28 bg-transparent text-xl font-mono font-bold text-white outline-none tabular-nums"
              style={{ color: theme.color }}
            />
            <span className="text-xs font-mono text-slate-400">Hz</span>
          </div>

          {/* Quick Step Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleStepFreq(-1.0)}
              className="px-1.5 py-0.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
            >
              -1
            </button>
            <button
              onClick={() => handleStepFreq(-0.1)}
              className="px-1 py-0.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
            >
              -.1
            </button>
            <button
              onClick={() => handleStepFreq(0.1)}
              className="px-1 py-0.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
            >
              +.1
            </button>
            <button
              onClick={() => handleStepFreq(1.0)}
              className="px-1.5 py-0.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
            >
              +1
            </button>
          </div>
        </div>
      </div>

      {/* Tactile Controls: Rotary Knobs + Waveform Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
        {/* Waveform Selector Buttons */}
        <div className="sm:col-span-4 flex flex-col gap-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Waveform</span>
          <div className="grid grid-cols-2 gap-1">
            {waveforms.map((w) => {
              const active = waveform === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => onUpdateWaveform(w.id)}
                  className={`py-1 text-[11px] font-mono font-bold rounded border transition-all ${
                    active
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'bg-[#070b14] text-slate-400 hover:text-white border-slate-800'
                  }`}
                  style={{
                    borderColor: active ? theme.color : undefined,
                    boxShadow: active ? `0 0 8px ${theme.color}40` : undefined,
                  }}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rotary Knobs: Tune, Fine, Elevation, Gain */}
        <div className="sm:col-span-8 flex items-center justify-around bg-[#070b14] p-1.5 rounded-lg border border-slate-800">
          <Knob
            label="Tune"
            value={frequency}
            min={20}
            max={1200}
            step={0.5}
            unit="Hz"
            size={46}
            color={theme.color}
            decimals={1}
            onChange={onUpdateFrequency}
          />
          <Knob
            label="Fine"
            value={fineTune}
            min={-10}
            max={10}
            step={0.01}
            unit="Hz"
            size={46}
            color="#a855f7"
            decimals={2}
            onChange={onUpdateFineTune}
          />
          <Knob
            label="Elev"
            value={position.y}
            min={-8}
            max={8}
            step={0.1}
            unit="m"
            size={46}
            color="#38bdf8"
            decimals={1}
            onChange={onUpdateElevation}
          />
          <Knob
            label="Gain"
            value={gain * 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            size={46}
            color="#fbbf24"
            decimals={0}
            onChange={(v) => onUpdateGain(v / 100)}
          />
        </div>
      </div>

      {/* Mini Oscilloscope Waveform & Mute Action */}
      <div className="flex items-center gap-2 bg-[#070b14] p-1.5 rounded-lg border border-slate-800">
        <canvas ref={canvasRef} className="flex-1 h-10 rounded" />

        <button
          onClick={onToggleMute}
          className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 text-xs font-mono font-bold transition-all border ${
            muted
              ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-sm'
              : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
          }`}
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{muted ? 'MUTED' : 'ON'}</span>
        </button>
      </div>
    </div>
  );
};
