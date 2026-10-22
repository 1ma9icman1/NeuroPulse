import React, { useState } from 'react';
import { Play, Square, Disc, Download, Sparkles } from 'lucide-react';
import { Knob } from './Knob';
import { AudioEngine } from '../audio/AudioEngine';
import { Preset } from '../types';

interface MasterTransportProps {
  isRunning: boolean;
  masterVolume: number;
  presets: Preset[];
  selectedPresetId: string;
  audioEngine: AudioEngine | null;
  onTogglePlay: () => void;
  onUpdateVolume: (vol: number) => void;
  onSelectPreset: (preset: Preset) => void;
}

export const MasterTransport: React.FC<MasterTransportProps> = ({
  isRunning,
  masterVolume,
  presets,
  selectedPresetId,
  audioEngine,
  onTogglePlay,
  onUpdateVolume,
  onSelectPreset,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const handleToggleRecord = () => {
    if (!audioEngine) return;

    if (!isRecording) {
      const ok = audioEngine.startRecording();
      if (ok) {
        setIsRecording(true);
        setRecordedBlob(null);
      }
    } else {
      const blob = audioEngine.stopRecording();
      setIsRecording(false);
      if (blob) {
        setRecordedBlob(blob);
      }
    }
  };

  const handleDownload = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audiocube-space-trinaural-daw-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#0b101c] rounded-xl border border-slate-800 p-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Brand & Transport Play Button */}
      <div style={{display:"none"}} className="hidden">
        <div className="flex flex-col">
          <span className="text-sm font-mono font-bold tracking-tight text-white flex items-center gap-1.5">
            <span className="text-cyan-400">AUDIOCUBE</span>
            <span className="text-purple-400">SPACE</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500">3D Trinaural Spatial Synthesizer DAW</span>
        </div>

        {/* Big Tactile Transport Button */}
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-2.5 px-6 py-2.5 rounded-lg text-sm font-mono font-bold tracking-wider transition-all shadow-lg active:scale-95 ${
            isRunning
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
              : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
          }`}
        >
          {isRunning ? <Square className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isRunning ? 'STOP ENGINE' : 'START AUDIO'}</span>
        </button>
      </div>

      {/* Preset Bank hidden by request; preset logic retained. */}
      <div style={{display:"none"}} className="hidden px-3 py-1.5 rounded-lg border border-slate-800">
        <Sparkles className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-mono text-slate-400">Trinaural Preset:</span>
        <select
          value={selectedPresetId}
          onChange={(e) => {
            const p = presets.find((x) => x.id === e.target.value);
            if (p) onSelectPreset(p);
          }}
          className="bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 rounded px-2.5 py-1 outline-none cursor-pointer max-w-[240px] sm:max-w-none"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Audio Recorder & Master Volume */}
      <div className="flex items-center gap-4">
        {/* Record Button hidden by request; recording logic retained. */}
        <div className="hidden">
          <button
            onClick={handleToggleRecord}
            disabled={!isRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
              isRecording
                ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse'
                : 'bg-[#060a12] border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
          >
            <Disc className={`w-3.5 h-3.5 ${isRecording ? 'text-red-500' : 'text-slate-400'}`} />
            <span>{isRecording ? 'REC...' : 'RECORD'}</span>
          </button>

          {recordedBlob && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-cyan-950/60 border border-cyan-500 text-cyan-300 hover:bg-cyan-900/60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>SAVE</span>
            </button>
          )}
        </div>

        {/* Master Output Knob */}
        <div style={{ display: "none" }} className="flex items-center gap-2 bg-[#060a12] px-3 py-1 rounded-lg border border-slate-800">
          <Knob
            label="MASTER"
            value={masterVolume * 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            size={48}
            color="#34d399"
            decimals={0}
            onChange={(v) => onUpdateVolume(v / 100)}
          />
        </div>
      </div>
    </div>
  );
};
