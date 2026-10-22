import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, LoaderCircle, Orbit, RefreshCw, X } from 'lucide-react';
import { gaiaSkyBridge, type GaiaSkyBridgeResponse } from '../services/gaiaSkyBridge';

interface GaiaSkyBridgePanelProps {
  onClose: () => void;
}

type ConnectionState = 'checking' | 'connected' | 'offline';
type Operation = 'status' | 'focus' | 'time' | 'coordinate' | null;

const currentUtcYear = new Date().getUTCFullYear();
const displayYear = (year: number) => year < 0 ? `${Math.abs(year).toLocaleString()} BCE` : `${year.toLocaleString()} CE`;

export function GaiaSkyBridgePanel({ onClose }: GaiaSkyBridgePanelProps) {
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [targetName, setTargetName] = useState('Sirius');
  const [simulationYear, setSimulationYear] = useState(currentUtcYear);
  const [raDeg, setRaDeg] = useState('101.287');
  const [decDeg, setDecDeg] = useState('-16.716');
  const [busy, setBusy] = useState<Operation>('status');
  const [message, setMessage] = useState('Checking the local Gaia Sky REST server…');
  const [lastAction, setLastAction] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setBusy('status');
    setConnection('checking');
    try {
      const result = await gaiaSkyBridge.checkConnection();
      setConnection('connected');
      setMessage(result.message);
    } catch (error) {
      setConnection('offline');
      setMessage(error instanceof Error ? error.message : 'Gaia Sky connection failed.');
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const runOperation = async (
    operation: Exclude<Operation, 'status' | null>,
    run: () => Promise<GaiaSkyBridgeResponse>
  ) => {
    setBusy(operation);
    setLastAction(null);
    try {
      const result = await run();
      setConnection('connected');
      setMessage(result.message);
      setLastAction(result.resultText || result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gaia Sky command failed.');
      if (/not reachable|could not reach|connection refused/i.test(error instanceof Error ? error.message : '')) {
        setConnection('offline');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/65 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close Gaia Sky panel" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="gaiasky-panel-title"
        className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-cyan-900/70 bg-[#070d18] shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-[#080d18]/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-2 text-cyan-300">
              <Orbit className="h-5 w-5" />
            </div>
            <div>
              <h2 id="gaiasky-panel-title" className="text-sm font-bold tracking-wide text-white">GAIA SKY · UNIVERSE BRIDGE</h2>
              <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">Local desktop integration prototype</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white" title="Close panel">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 p-5">
          <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {connection === 'connected'
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  : connection === 'offline'
                    ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    : <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan-300" />}
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    {connection === 'connected' ? 'GAIA SKY CONNECTED' : connection === 'offline' ? 'GAIA SKY NOT CONNECTED' : 'CHECKING CONNECTION'}
                  </div>
                  <p className="mt-1 break-words text-xs leading-relaxed text-slate-400">{message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void checkConnection()}
                disabled={busy !== null}
                className="shrink-0 rounded-md border border-slate-700 p-2 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-40"
                title="Check connection again"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy === 'status' ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {lastAction && <p className="mt-3 border-t border-slate-800 pt-3 text-[10px] leading-relaxed text-emerald-300">{lastAction}</p>}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/35 p-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">Navigate to an object</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Focus Gaia Sky on a named object in its loaded scene, such as Sirius, Earth, Jupiter or the Sun.</p>
            </div>
            <form onSubmit={(event) => {
              event.preventDefault();
              void runOperation('focus', () => gaiaSkyBridge.focusObject(targetName));
            }} className="flex gap-2">
              <input
                value={targetName}
                onChange={(event) => setTargetName(event.target.value)}
                maxLength={120}
                placeholder="Object name, e.g. Sirius"
                aria-label="Gaia Sky object name"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#050911] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              />
              <button type="submit" disabled={busy !== null || connection !== 'connected' || !targetName.trim()} className="flex items-center gap-2 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
                {busy === 'focus' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                FOCUS
              </button>
            </form>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/35 p-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200">Historical simulation time</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Send a calendar year to Gaia Sky’s simulation clock. This prototype uses January 1 at 12:00 UTC.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={-10000}
                max={9999}
                step={1}
                value={simulationYear}
                onChange={(event) => setSimulationYear(Number(event.target.value))}
                aria-label="Gaia Sky simulation year"
                className="w-32 rounded-lg border border-slate-700 bg-[#050911] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
              />
              <span className="flex-1 text-xs font-mono text-amber-200">{displayYear(simulationYear)}</span>
              <button type="button" disabled={busy !== null || connection !== 'connected' || !Number.isInteger(simulationYear) || simulationYear < -10000 || simulationYear > 9999} onClick={() => void runOperation('time', () => gaiaSkyBridge.setSimulationYear(simulationYear))} className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-40">
                {busy === 'time' ? 'SENDING…' : 'SET TIME'}
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/35 p-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-200">Point at sky coordinates</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Test the same RA/declination path we can use for NeuroPulse star selections.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-[10px] font-mono text-slate-400">
                RIGHT ASCENSION (°)
                <input type="number" min={0} max={360} step="0.001" value={raDeg} onChange={(event) => setRaDeg(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#050911] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400" />
              </label>
              <label className="space-y-1.5 text-[10px] font-mono text-slate-400">
                DECLINATION (°)
                <input type="number" min={-90} max={90} step="0.001" value={decDeg} onChange={(event) => setDecDeg(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#050911] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400" />
              </label>
            </div>
            <button
              type="button"
              disabled={busy !== null || connection !== 'connected' || raDeg.trim() === '' || decDeg.trim() === ''}
              onClick={() => void runOperation('coordinate', () => gaiaSkyBridge.pointAtSkyCoordinate(Number(raDeg), Number(decDeg)))}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-950/30 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'coordinate' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              POINT AT COORDINATES
            </button>
            <p className="text-[10px] leading-relaxed text-slate-500">Gaia Sky’s current API accepts integer-degree coordinates here, so this test rounds the values before sending. We’ll verify precision before linking the full star catalogue.</p>
          </section>

          <div className="rounded-lg border border-slate-800 bg-[#050911] p-3 text-[10px] leading-relaxed text-slate-500">
            <div className="flex items-center gap-1.5 font-bold text-slate-300"><AlertCircle className="h-3.5 w-3.5" /> Local-only prototype</div>
            <p className="mt-1">This bridge is available through the local Vite development server only. Keep Gaia Sky’s REST server on its default localhost-only setting; never expose it to your network or the public internet.</p>
            <a className="mt-2 inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200" href="https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/REST-server.html" target="_blank" rel="noreferrer">
              Gaia Sky REST server docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
