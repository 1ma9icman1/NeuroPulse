/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import {
  TrinauralConfig,
  Preset,
  SpatialPosition,
  WaveformType,
  SpatialRoutingMode,
  CameraView,
  ChannelId,
} from './types';
import { DAW_PRESETS } from './data/dawPresets';
import { MasterTransport } from './components/MasterTransport';
import { AudioCubeSpace } from './components/AudioCubeSpace';
import { DeltaHUD } from './components/DeltaHUD';
import { OscillatorDeck } from './components/OscillatorDeck';
import { FrequencyMatrix } from './components/FrequencyMatrix';
import { CheckCircle2, Volume2, Triangle, Maximize, Minimize } from 'lucide-react';

const INITIAL_CONFIG: TrinauralConfig = {
  // Channel A (Left / Cyan)
  aFreq: 432.0,
  aFineTune: 0.0,
  aWaveform: 'sine',
  aGain: 0.85,
  aMuted: false,
  aPos: { x: -4.5, y: 1.5, z: 0.0 },

  // Channel B (Right / Pink)
  bFreq: 442.0,
  bFineTune: 0.0,
  bWaveform: 'sine',
  bGain: 0.85,
  bMuted: false,
  bPos: { x: 4.5, y: 1.5, z: 0.0 },

  // Channel C (Spatial Center / Amber)
  cFreq: 452.0,
  cFineTune: 0.0,
  cWaveform: 'sine',
  cGain: 0.85,
  cMuted: false,
  cPos: { x: 0.0, y: 2.5, z: 3.5 },

  // Linking & Delta
  isDeltaLocked: true,
  lockedDeltaAB: 10.0,
  lockedDeltaBC: 10.0,

  // Master & 3D Spatial
  masterVolume: 0.8,
  spatialMode: 'trinaural-isolated',
  cameraView: 'perspective',
  cameraYaw: 30,
  cameraPitch: 22,
  cameraZoom: 1.0,
};

export default function App() {
  const [config, setConfig] = useState<TrinauralConfig>(INITIAL_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DAW_PRESETS[0].id);
  const [trinauralTestStatus, setTrinauralTestStatus] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const audioEngineRef = useRef<AudioEngine | null>(null);

  // Monitor fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  // Initialize AudioEngine on first mount
  useEffect(() => {
    const engine = new AudioEngine(INITIAL_CONFIG);
    audioEngineRef.current = engine;

    return () => {
      engine.stop();
    };
  }, []);

  // Update audio engine when config changes
  const handleUpdateConfig = useCallback((newConfig: Partial<TrinauralConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      if (audioEngineRef.current) {
        audioEngineRef.current.updateConfig(updated);
      }
      return updated;
    });
  }, []);

  // Master Play / Stop
  const handleTogglePlay = async () => {
    if (!audioEngineRef.current) return;

    if (isRunning) {
      audioEngineRef.current.stop();
      setIsRunning(false);
    } else {
      await audioEngineRef.current.start();
      setIsRunning(true);
    }
  };

  // Run 3-Channel Trinaural Audio Sequence Test (CH-A -> CH-B -> CH-C -> All 3 Active)
  const handleRunTrinauralTest = async () => {
    if (!audioEngineRef.current) return;

    if (!isRunning) {
      await audioEngineRef.current.start();
      setIsRunning(true);
    }

    // Preserve previous mute state
    const prevMuteA = config.aMuted;
    const prevMuteB = config.bMuted;
    const prevMuteC = config.cMuted;

    // Step 1: Channel A solo (Hard Left -1.0)
    setTrinauralTestStatus('TESTING CH-A: LEFT EAR (-1.0)...');
    handleUpdateConfig({ aMuted: false, bMuted: true, cMuted: true });

    // Step 2: Channel B solo (Hard Right +1.0)
    setTimeout(() => {
      setTrinauralTestStatus('TESTING CH-B: RIGHT EAR (+1.0)...');
      handleUpdateConfig({ aMuted: true, bMuted: false, cMuted: true });
    }, 1800);

    // Step 3: Channel C solo (Center Spatial 0.0)
    setTimeout(() => {
      setTrinauralTestStatus('TESTING CH-C: SPATIAL CENTER (0.0)...');
      handleUpdateConfig({ aMuted: true, bMuted: true, cMuted: false });
    }, 3600);

    // Step 4: All 3 active in Trinaural Fusion
    setTimeout(() => {
      setTrinauralTestStatus('ALL 3 CHANNELS ACTIVE (TRINAURAL FUSION)');
      handleUpdateConfig({ aMuted: false, bMuted: false, cMuted: false });
    }, 5400);

    // Done: Restore state
    setTimeout(() => {
      setTrinauralTestStatus(null);
      handleUpdateConfig({ aMuted: prevMuteA, bMuted: prevMuteB, cMuted: prevMuteC });
    }, 7400);
  };

  // Direct Channel A Frequency Tuning
  const handleUpdateAFreq = (val: number) => {
    if (config.isDeltaLocked) {
      handleUpdateConfig({
        aFreq: val,
        bFreq: Number((val + config.lockedDeltaAB).toFixed(2)),
        cFreq: Number((val + config.lockedDeltaAB + config.lockedDeltaBC).toFixed(2)),
      });
    } else {
      handleUpdateConfig({ aFreq: val });
    }
  };

  // Direct Channel B Frequency Tuning
  const handleUpdateBFreq = (val: number) => {
    if (config.isDeltaLocked) {
      const newDeltaAB = Math.abs(val - config.aFreq);
      handleUpdateConfig({
        bFreq: val,
        lockedDeltaAB: Number(newDeltaAB.toFixed(2)),
      });
    } else {
      handleUpdateConfig({ bFreq: val });
    }
  };

  // Direct Channel C Frequency Tuning
  const handleUpdateCFreq = (val: number) => {
    if (config.isDeltaLocked) {
      const newDeltaBC = Math.abs(val - config.bFreq);
      handleUpdateConfig({
        cFreq: val,
        lockedDeltaBC: Number(newDeltaBC.toFixed(2)),
      });
    } else {
      handleUpdateConfig({ cFreq: val });
    }
  };

  // Toggle Delta Link
  const handleToggleDeltaLock = () => {
    const currentDeltaAB = Math.abs(config.bFreq - config.aFreq);
    const currentDeltaBC = Math.abs(config.cFreq - config.bFreq);
    handleUpdateConfig({
      isDeltaLocked: !config.isDeltaLocked,
      lockedDeltaAB: Number(currentDeltaAB.toFixed(2)),
      lockedDeltaBC: Number(currentDeltaBC.toFixed(2)),
    });
  };

  // Quick Delta Snap from Brainwave Band
  const handleSetQuickDelta = (delta: number) => {
    handleUpdateConfig({
      bFreq: Number((config.aFreq + delta).toFixed(2)),
      cFreq: Number((config.aFreq + delta * 2).toFixed(2)),
      lockedDeltaAB: delta,
      lockedDeltaBC: delta,
    });
  };

  // Solfeggio Tone Routing
  const handleApplySolfeggio = (freq: number, target: 'base' | ChannelId | 'tri-spread') => {
    if (target === 'base') {
      const deltaAB = config.isDeltaLocked ? config.lockedDeltaAB : Math.abs(config.bFreq - config.aFreq);
      const deltaBC = config.isDeltaLocked ? config.lockedDeltaBC : Math.abs(config.cFreq - config.bFreq);
      handleUpdateConfig({
        aFreq: freq,
        bFreq: Number((freq + deltaAB).toFixed(2)),
        cFreq: Number((freq + deltaAB + deltaBC).toFixed(2)),
      });
    } else if (target === 'tri-spread') {
      const step = config.lockedDeltaAB || 10.0;
      handleUpdateConfig({
        aFreq: freq,
        bFreq: Number((freq + step).toFixed(2)),
        cFreq: Number((freq + step * 2).toFixed(2)),
      });
    } else if (target === 'a') {
      handleUpdateAFreq(freq);
    } else if (target === 'b') {
      handleUpdateBFreq(freq);
    } else if (target === 'c') {
      handleUpdateCFreq(freq);
    }
  };

  // Reset 3D Camera Angles
  const handleResetCamera = () => {
    handleUpdateConfig({
      cameraYaw: 30,
      cameraPitch: 22,
      cameraZoom: 1.0,
      cameraView: 'perspective',
    });
  };

  // Apply Preset
  const handleSelectPreset = (preset: Preset) => {
    setSelectedPresetId(preset.id);
    const newDeltaAB = Math.abs(preset.bFreq - preset.aFreq);
    const newDeltaBC = Math.abs(preset.cFreq - preset.bFreq);
    handleUpdateConfig({
      aFreq: preset.aFreq,
      bFreq: preset.bFreq,
      cFreq: preset.cFreq,
      aWaveform: preset.aWaveform,
      bWaveform: preset.bWaveform,
      cWaveform: preset.cWaveform,
      lockedDeltaAB: newDeltaAB,
      lockedDeltaBC: newDeltaBC,
    });
  };

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top DAW Header with Run Stereo/Trinaural Test Button */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-[#080d18] border-b border-slate-800/80 sticky top-0 z-50">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded bg-cyan-400 shadow-[0_0_10px_#00f0ff]" />
          <span className="text-base font-mono font-bold tracking-tight text-white flex items-center gap-1.5">
            <span>AUDIOCUBE SPACE</span>
            <span className="text-slate-500 font-normal hidden sm:inline">· 3D Trinaural Spatial Synthesizer DAW</span>
          </span>
        </div>

        {/* Center: Live Trinaural Test Button & Real-Time Readouts */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunTrinauralTest}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border shadow-sm ${
              trinauralTestStatus
                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)] animate-pulse'
                : 'bg-[#060a12] border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
            }`}
            title="Sequentially audits Channel A (Left) -> Channel B (Right) -> Channel C (Spatial) -> All 3"
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${trinauralTestStatus ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span>{trinauralTestStatus || 'RUN TRINAURAL TEST'}</span>
          </button>

          <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-400 border-l border-slate-800 pl-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              A: <strong className="text-cyan-400 font-bold">{(config.aFreq + config.aFineTune).toFixed(1)} Hz</strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
              B: <strong className="text-pink-400 font-bold">{(config.bFreq + config.bFineTune).toFixed(1)} Hz</strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              C: <strong className="text-amber-400 font-bold">{(config.cFreq + config.cFineTune).toFixed(1)} Hz</strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              Δ A-B: <strong className="text-purple-400 font-bold">{Math.abs(config.bFreq - config.aFreq).toFixed(2)} Hz</strong>
            </span>
          </div>
        </div>

        {/* Right: Master Run/Stop Toggle & Fullscreen Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleToggleFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-md border transition-all shadow-sm ${
              isFullscreen
                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
                : 'bg-[#060a12] border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
            }`}
            title={isFullscreen ? 'Exit Full Screen' : 'Toggle Full Screen Mode'}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-cyan-400" /> : <Maximize className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}</span>
          </button>

          <button
            onClick={handleTogglePlay}
            className={`px-5 py-1.5 text-xs font-mono font-bold tracking-wider rounded-md transition-all shadow-md ${
              isRunning
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
            }`}
          >
            {isRunning ? 'STOP ENGINE' : 'START AUDIO'}
          </button>
        </div>
      </header>

      {/* Main Production Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {/* Master transport and volume UI hidden by request; audio engine and state remain intact. */}
        <div style={{ display: 'none' }} aria-hidden="true">
          <MasterTransport
            isRunning={isRunning}
            masterVolume={config.masterVolume}
            presets={DAW_PRESETS}
            selectedPresetId={selectedPresetId}
            audioEngine={audioEngineRef.current}
            onTogglePlay={handleTogglePlay}
            onUpdateVolume={(vol) => handleUpdateConfig({ masterVolume: vol })}
            onSelectPreset={handleSelectPreset}
          />
        </div>

        {/* 3D AudioCube Spatializer Stage (Interactive Orbit & Direct Elevation Sliders) */}
        <section className="h-[430px] sm:h-[480px]">
          <AudioCubeSpace
            aPos={config.aPos}
            bPos={config.bPos}
            cPos={config.cPos}
            spatialMode={config.spatialMode}
            cameraView={config.cameraView}
            cameraYaw={config.cameraYaw}
            cameraPitch={config.cameraPitch}
            cameraZoom={config.cameraZoom}
            aFreq={config.aFreq + config.aFineTune}
            bFreq={config.bFreq + config.bFineTune}
            cFreq={config.cFreq + config.cFineTune}
            isRunning={isRunning}
            onUpdateAPos={(pos: SpatialPosition) => handleUpdateConfig({ aPos: pos })}
            onUpdateBPos={(pos: SpatialPosition) => handleUpdateConfig({ bPos: pos })}
            onUpdateCPos={(pos: SpatialPosition) => handleUpdateConfig({ cPos: pos })}
            onUpdateSpatialMode={(mode: SpatialRoutingMode) => handleUpdateConfig({ spatialMode: mode })}
            onUpdateCameraView={(view: CameraView) => handleUpdateConfig({ cameraView: view })}
            onUpdateCameraAngles={(yaw: number, pitch: number) =>
              handleUpdateConfig({ cameraYaw: yaw, cameraPitch: pitch })
            }
            onUpdateCameraZoom={(zoom: number) => handleUpdateConfig({ cameraZoom: zoom })}
            onResetCamera={handleResetCamera}
          />
        </section>

        {/* Triangular Delta Offset & 3-Signal Lissajous Scope Deck */}
        <DeltaHUD
          aFreq={config.aFreq}
          bFreq={config.bFreq}
          cFreq={config.cFreq}
          aFineTune={config.aFineTune}
          bFineTune={config.bFineTune}
          cFineTune={config.cFineTune}
          isDeltaLocked={config.isDeltaLocked}
          audioEngine={audioEngineRef.current}
          isRunning={isRunning}
          onToggleDeltaLock={handleToggleDeltaLock}
          onSetQuickDelta={handleSetQuickDelta}
        />

        {/* 3-Channel Trinaural Oscillator DAW Channel Strips (CH-A, CH-B, CH-C) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Channel A: Left Ear Oscillator (Cyan) */}
          <OscillatorDeck
            channel="a"
            frequency={config.aFreq}
            fineTune={config.aFineTune}
            waveform={config.aWaveform}
            gain={config.aGain}
            muted={config.aMuted}
            position={config.aPos}
            audioEngine={audioEngineRef.current}
            isRunning={isRunning}
            onUpdateFrequency={handleUpdateAFreq}
            onUpdateFineTune={(fine) => handleUpdateConfig({ aFineTune: fine })}
            onUpdateWaveform={(wave: WaveformType) => handleUpdateConfig({ aWaveform: wave })}
            onUpdateGain={(g) => handleUpdateConfig({ aGain: g })}
            onUpdateElevation={(elev) => handleUpdateConfig({ aPos: { ...config.aPos, y: elev } })}
            onToggleMute={() => handleUpdateConfig({ aMuted: !config.aMuted })}
          />

          {/* Channel B: Right Ear Oscillator (Pink) */}
          <OscillatorDeck
            channel="b"
            frequency={config.bFreq}
            fineTune={config.bFineTune}
            waveform={config.bWaveform}
            gain={config.bGain}
            muted={config.bMuted}
            position={config.bPos}
            audioEngine={audioEngineRef.current}
            isRunning={isRunning}
            onUpdateFrequency={handleUpdateBFreq}
            onUpdateFineTune={(fine) => handleUpdateConfig({ bFineTune: fine })}
            onUpdateWaveform={(wave: WaveformType) => handleUpdateConfig({ bWaveform: wave })}
            onUpdateGain={(g) => handleUpdateConfig({ bGain: g })}
            onUpdateElevation={(elev) => handleUpdateConfig({ bPos: { ...config.bPos, y: elev } })}
            onToggleMute={() => handleUpdateConfig({ bMuted: !config.bMuted })}
          />

          {/* Channel C: Spatial Center Oscillator (Amber) */}
          <OscillatorDeck
            channel="c"
            frequency={config.cFreq}
            fineTune={config.cFineTune}
            waveform={config.cWaveform}
            gain={config.cGain}
            muted={config.cMuted}
            position={config.cPos}
            audioEngine={audioEngineRef.current}
            isRunning={isRunning}
            onUpdateFrequency={handleUpdateCFreq}
            onUpdateFineTune={(fine) => handleUpdateConfig({ cFineTune: fine })}
            onUpdateWaveform={(wave: WaveformType) => handleUpdateConfig({ cWaveform: wave })}
            onUpdateGain={(g) => handleUpdateConfig({ cGain: g })}
            onUpdateElevation={(elev) => handleUpdateConfig({ cPos: { ...config.cPos, y: elev } })}
            onToggleMute={() => handleUpdateConfig({ cMuted: !config.cMuted })}
          />
        </section>

        {/* Combined Unified Frequency Matrix: Solfeggio & Healing Tones + Brainwaves */}
        <section>
          <FrequencyMatrix
            aFreq={config.aFreq}
            bFreq={config.bFreq}
            cFreq={config.cFreq}
            lockedDeltaAB={config.lockedDeltaAB}
            lockedDeltaBC={config.lockedDeltaBC}
            isDeltaLocked={config.isDeltaLocked}
            onApplySolfeggio={handleApplySolfeggio}
            onApplyBrainwaveDelta={handleSetQuickDelta}
          />
        </section>
      </main>

      {/* Clean Studio Footer */}
      <footer className="border-t border-slate-900 bg-[#05070d] py-3.5 px-6 text-xs text-slate-500 font-mono flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400">AUDIOCUBE SPACE</span>
          <span>·</span>
          <span>3D Trinaural Spatial Synthesizer DAW</span>
          <span>·</span>
          <span>Tri-Tone Interference Matrix</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>Free 3D Orbit Camera</span>
          <span>·</span>
          <span>Channel Elevation Sliders</span>
          <span>·</span>
          <span>Native Web Audio API Oscillators</span>
        </div>
      </footer>
    </div>
  );
}
