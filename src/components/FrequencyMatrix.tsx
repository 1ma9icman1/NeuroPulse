import React, { useState } from 'react';
import { SOLFEGGIO_TONES, BRAINWAVE_BANDS } from '../data/solfeggioData';
import { Sparkles, Brain, Radio, Layers } from 'lucide-react';
import { ChannelId } from '../types';

interface FrequencyMatrixProps {
  aFreq: number;
  bFreq: number;
  cFreq: number;
  lockedDeltaAB: number;
  lockedDeltaBC: number;
  isDeltaLocked: boolean;
  onApplySolfeggio: (freq: number, target: 'base' | ChannelId | 'tri-spread') => void;
  onApplyBrainwaveDelta: (delta: number) => void;
}

export const FrequencyMatrix: React.FC<FrequencyMatrixProps> = ({
  aFreq,
  bFreq,
  cFreq,
  lockedDeltaAB,
  lockedDeltaBC,
  isDeltaLocked,
  onApplySolfeggio,
  onApplyBrainwaveDelta,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'solfeggio' | 'brainwaves'>('all');

  const deltaAB = Math.abs(bFreq - aFreq);
  const deltaBC = Math.abs(cFreq - bFreq);

  return (
    <div className="bg-[#0b101c] rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col gap-4 select-none">
      {/* Header Deck: Controls & Live 3-Channel Telemetry */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        {/* Navigation Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-[#060a12] rounded-lg border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Unified Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab('solfeggio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors ${
              activeTab === 'solfeggio'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Solfeggio & Healing (11)</span>
          </button>
          <button
            onClick={() => setActiveTab('brainwaves')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded transition-colors ${
              activeTab === 'brainwaves'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>Brainwaves (5)</span>
          </button>
        </div>

        {/* Live Trinaural Bus Frequencies */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono bg-[#060a12] px-3.5 py-1.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-slate-400">CH-A:</span>
            <strong className="text-cyan-300 tabular-nums">{aFreq.toFixed(1)} Hz</strong>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-pink-400" />
            <span className="text-slate-400">CH-B:</span>
            <strong className="text-pink-300 tabular-nums">{bFreq.toFixed(1)} Hz</strong>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400">CH-C:</span>
            <strong className="text-amber-300 tabular-nums">{cFreq.toFixed(1)} Hz</strong>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Δ A-B:</span>
            <strong className="text-purple-300 tabular-nums">{deltaAB.toFixed(2)} Hz</strong>
          </div>
        </div>
      </div>

      {/* Section 1: Brainwave Entrainment Target Frequencies */}
      {(activeTab === 'all' || activeTab === 'brainwaves') && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-purple-400" />
              Brainwave Entrainment Targets (Delta / Theta / Alpha / Beta / Gamma)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Click any band to tune the Trinaural inter-aural beating delta
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {BRAINWAVE_BANDS.map((bw) => {
              const isBandActive = deltaAB >= bw.min && deltaAB <= bw.max;

              return (
                <button
                  key={bw.id}
                  onClick={() => onApplyBrainwaveDelta(bw.defaultDelta)}
                  className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                    isBandActive
                      ? 'bg-slate-800/90 border-slate-500 shadow-lg text-white'
                      : 'bg-[#060a12] border-slate-800/90 hover:border-slate-700 text-slate-400'
                  }`}
                  style={{
                    borderLeftColor: bw.color,
                    borderLeftWidth: '4px',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                        {bw.name}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">
                        {bw.min}–{bw.max} Hz
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium leading-snug">{bw.desc}</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{bw.details}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">Target Delta:</span>
                    <span className="text-xs font-mono font-bold" style={{ color: bw.color }}>
                      Δ {bw.defaultDelta} Hz
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Solfeggio & Healing Frequencies (All 11 Requested Tones) */}
      {(activeTab === 'all' || activeTab === 'solfeggio') && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Solfeggio & Sacred Healing Tones (174, 285, 396, 417, 432, 440, 528, 639, 741, 852, 963 Hz)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Route directly to individual channels or harmonically spread across the Trinaural matrix
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
            {SOLFEGGIO_TONES.map((tone) => {
              const isA = Math.abs(aFreq - tone.freq) < 0.2;
              const isB = Math.abs(bFreq - tone.freq) < 0.2;
              const isC = Math.abs(cFreq - tone.freq) < 0.2;

              return (
                <div
                  key={tone.freq}
                  className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between gap-2.5 ${
                    isA || isB || isC
                      ? 'bg-slate-900 border-cyan-500/50 shadow-md'
                      : 'bg-[#060a12] border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-mono font-bold text-cyan-300">{tone.name}</span>
                        {/* Channel match indicators */}
                        {isA && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            A
                          </span>
                        )}
                        {isB && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-800">
                            B
                          </span>
                        )}
                        {isC && (
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            C
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{tone.category}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-snug">{tone.desc}</p>
                  </div>

                  {/* 3-Channel Precision Routing Deck */}
                  <div className="flex flex-wrap items-center gap-1 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => onApplySolfeggio(tone.freq, 'base')}
                      className="flex-1 py-1 px-1.5 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
                      title="Set as master base carrier (shifts all 3 channels maintaining deltas)"
                    >
                      Set Base
                    </button>
                    <button
                      onClick={() => onApplySolfeggio(tone.freq, 'tri-spread')}
                      className="py-1 px-2 text-[11px] font-mono bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 rounded border border-purple-800 transition-colors"
                      title="Spreads tone across 3 channels: f, f+Δ, f+2Δ"
                    >
                      Tri-Spread
                    </button>
                    <button
                      onClick={() => onApplySolfeggio(tone.freq, 'a')}
                      className="px-2 py-1 text-[11px] font-mono bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 rounded border border-cyan-800 transition-colors"
                      title="Route tone to Channel A (Left)"
                    >
                      CH-A
                    </button>
                    <button
                      onClick={() => onApplySolfeggio(tone.freq, 'b')}
                      className="px-2 py-1 text-[11px] font-mono bg-pink-950/60 hover:bg-pink-900/60 text-pink-300 rounded border border-pink-800 transition-colors"
                      title="Route tone to Channel B (Right)"
                    >
                      CH-B
                    </button>
                    <button
                      onClick={() => onApplySolfeggio(tone.freq, 'c')}
                      className="px-2 py-1 text-[11px] font-mono bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 rounded border border-amber-800 transition-colors"
                      title="Route tone to Channel C (Spatial Center)"
                    >
                      CH-C
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evidence-led physical frequency reference: measured quantities are kept separate from musical tuning claims. */}
      {activeTab === 'all' && (
        <section className="rounded-lg border border-slate-700 bg-[#080d17] p-3 flex flex-col gap-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">Physical Frequency Checks · Evidence Only</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">These values are not interchangeable: a musical pitch, an electromagnetic resonance, and Earth's rotation are different physical quantities. A numerical match is not proof of an ancient connection.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
              <div className="text-sm font-mono font-bold text-emerald-200">≈ 7.83 Hz</div>
              <div className="mt-1 text-[10px] font-semibold text-slate-200">Schumann fundamental</div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Measured global electromagnetic resonance in the Earth–ionosphere cavity; it varies. It is not an audible sound tone.</p>
              <a className="mt-2 inline-block text-[10px] text-sky-300 hover:text-sky-100" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5551208/" target="_blank" rel="noreferrer">Research source ↗</a>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
              <div className="text-sm font-mono font-bold text-amber-200">432 Hz</div>
              <div className="mt-1 text-[10px] font-semibold text-slate-200">Alternative A4 tuning</div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">A musical tuning choice for the A4 reference note. It is not an established measured frequency of Earth.</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
              <div className="text-sm font-mono font-bold text-cyan-200">110 Hz</div>
              <div className="mt-1 text-[10px] font-semibold text-slate-200">A2 musical note</div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">A2 in 12-tone equal temperament when A4 = 440 Hz. No established Earth resonance at 110 Hz is identified here.</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
              <div className="text-sm font-mono font-bold text-violet-200">≈ 0.0000116 Hz</div>
              <div className="mt-1 text-[10px] font-semibold text-slate-200">Earth sidereal rotation</div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Calculated as 1 ÷ 86,164.0905 seconds per sidereal rotation. This is a rotation rate, not an acoustic resonance.</p>
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">Audit rule: every candidate value must include its physical definition, units, source, uncertainty, calculation, and a comparison against a chance baseline before the app labels it significant.</p>
        </section>
      )}
    </div>
  );
};
