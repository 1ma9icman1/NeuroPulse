import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock3, ExternalLink, Pause, Play, RefreshCw, Satellite, ShieldAlert, Sun, Zap } from 'lucide-react';

type DataRow = Record<string, unknown>;
type NasaFlareEvent = { flrID?: string; beginTime?: string; peakTime?: string; endTime?: string; classType?: string; sourceLocation?: string; activeRegionNum?: number; link?: string };
type Series = { key: string; label: string; url: string; rows: DataRow[]; error?: string; updatedAt?: string };
const SOURCES = [
  { key: 'kp', label: 'Planetary K-index', url: 'https://services.swpc.noaa.gov/json/planetary-k-index.json' },
  { key: 'xray', label: 'GOES X-ray flux', url: 'https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json' },
  { key: 'proton', label: 'GOES proton flux', url: 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json' },
  { key: 'electron', label: 'GOES electron flux', url: 'https://services.swpc.noaa.gov/json/goes/primary/integral-electrons-6-hour.json' },
];
const SOURCE_LINKS = [
  { label: 'Planetary K-index', href: 'https://www.spaceweather.gov/products/planetary-k-index' },
  { label: 'GOES proton flux', href: 'https://www.spaceweather.gov/products/goes-proton-flux' },
  { label: 'GOES electron flux', href: 'https://www.spaceweather.gov/products/goes-electron-flux' },
  { label: 'NOAA scales', href: 'https://www.spaceweather.gov/noaa-scales-explanation' },
];
const HISTORICAL_EVENTS = [
  { date: '1859-09-01', year: '1859', name: 'Carrington Event', type: 'Solar flare + geomagnetic storm', note: 'Historic extreme geomagnetic disturbance; nineteenth-century measurements do not provide modern GOES X-ray or particle-flux channels.', source: 'Historical observatory reports; NOAA/NASA space-weather history.' },
  { date: '1921-05-13', year: '1921', name: 'May 1921 geomagnetic storm', type: 'Geomagnetic storm', note: 'Major historical geomagnetic disturbance documented through ground and telegraph-system reports; modern particle-channel measurements are unavailable.', source: 'Historical geomagnetic records.' },
  { date: '1972-08-04', year: '1972', name: 'August 1972 solar particle event', type: 'Solar energetic particles', note: 'Major solar particle event during the Apollo era; review original particle measurements and mission-era context before drawing exposure conclusions.', source: 'NASA heliophysics and historical solar-particle archives.' },
  { date: '1989-03-13', year: '1989', name: 'March 1989 geomagnetic storm', type: 'Geomagnetic storm', note: 'Severe geomagnetic storm associated with a major power-grid disturbance in Quebec; this is a terrestrial impact record, not a flare-class measurement.', source: 'NOAA space-weather history and power-system reports.' },
  { date: '2003-10-28', year: '2003', name: 'Halloween solar storms', type: 'X-class flares + CMEs + geomagnetic activity', note: 'A sequence of major flares and associated space-weather events; inspect individual event timestamps and measurements rather than treating the sequence as one flare.', source: 'NOAA GOES records and NASA DONKI / heliophysics archives.' },
  { date: '2005-01-20', year: '2005', name: 'Extreme solar proton event', type: 'Solar energetic particles', note: 'A historically significant high-energy proton event. Review energy-specific particle measurements and instrument metadata.', source: 'NOAA GOES particle archives and NASA heliophysics records.' },
  { date: '2012-07-23', year: '2012', name: 'STEREO-observed extreme CME', type: 'CME / near miss', note: 'An extreme CME observed by STEREO that did not directly strike Earth; included to compare event severity with Earth-directed geometry.', source: 'NASA STEREO and heliophysics publications.' },
  { date: '2017-09-06', year: '2017', name: 'September 2017 X-class flare sequence', type: 'X-class flare + space weather', note: 'Major September 2017 solar activity including the X9.3 flare. Review measured GOES flux, associated events, and actual Earth observations separately.', source: 'NOAA GOES records and NASA event archives.' },
  { date: '2024-05-10', year: '2024', name: 'May 2024 G5 geomagnetic storm', type: 'Geomagnetic storm / CME sequence', note: 'The strongest geomagnetic storm category observed in May 2024; review the sequence of CMEs, measured geomagnetic indices, aurora reports, and regional observations.', source: 'NOAA SWPC and NASA heliophysics records.' },
];

const numberValue = (...values: unknown[]): number | null => {
  for (const value of values) {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
};
const timestampOf = (row: DataRow): number => {
  const raw = row.time_tag ?? row.timeTag ?? row.timestamp ?? row.observed_at;
  const n = typeof raw === 'number' ? raw : Date.parse(String(raw ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const fmtTime = (value: number) => value ? new Date(value).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC' : 'Timestamp unavailable';
const fmtFlux = (n: number | null) => n === null ? '—' : n.toExponential(2);
const flareClass = (flux: number | null) => {
  if (flux === null || flux < 1e-8) return 'BACKGROUND / A';
  if (flux >= 1e-4) return 'X' + (flux / 1e-4).toFixed(1);
  if (flux >= 1e-5) return 'M' + (flux / 1e-5).toFixed(1);
  if (flux >= 1e-6) return 'C' + (flux / 1e-6).toFixed(1);
  if (flux >= 1e-7) return 'B' + (flux / 1e-7).toFixed(1);
  return 'A' + (flux / 1e-8).toFixed(1);
};
const energyMatches = (row: DataRow, kind: 'xray' | 'proton' | 'electron') => {
  const energy = String(row.energy ?? row.energy_channel ?? row.channel ?? '').toLowerCase();
  if (kind === 'xray') return energy.includes('0.1-0.8') || energy.includes('0.1 – 0.8') || energy.includes('long') || energy.includes('xl');
  if (kind === 'proton') return energy.includes('>=10') || energy.includes('>10') || energy.includes('10 mev') || energy.includes('p10');
  return energy.includes('>=2') || energy.includes('>2') || energy.includes('2 mev') || energy.includes('e2');
};
const rowFlux = (row: DataRow) => numberValue(row.flux, row.value, row.flux_value, row.kp_index, row.kp, row.estimated_kp);
const latestFor = (series: Series | undefined, kind: 'xray' | 'proton' | 'electron') => {
  if (!series) return null;
  const rows = series.rows.filter((row) => kind === 'xray' ? energyMatches(row, kind) || !row.energy : energyMatches(row, kind) || !row.energy);
  return rows.filter((row) => rowFlux(row) !== null).sort((a, b) => timestampOf(b) - timestampOf(a))[0] ?? null;
};

export function SolarFlareResearch({ onClose }: { onClose?: () => void }) {
  const [series, setSeries] = useState<Series[]>(SOURCES.map((s) => ({ ...s, rows: [] })));
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [notice, setNotice] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [nasaEvents, setNasaEvents] = useState<NasaFlareEvent[]>([]);
  const [nasaEventError, setNasaEventError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(SOURCES.map(async (source): Promise<Series> => {
      try {
        const response = await fetch(source.url, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const json: unknown = await response.json();
        if (!Array.isArray(json)) throw new Error('Unexpected data format');
        return { ...source, rows: (json as DataRow[]).filter((row) => row && typeof row === 'object'), updatedAt: new Date().toISOString() };
      } catch (error) {
        return { ...source, rows: [], error: error instanceof Error ? error.message : 'Request failed' };
      }
    }));
    setSeries(results);
    setLastRefresh(Date.now());
    setLoading(false);
    setNotice(results.some((item) => item.rows.length > 0) ? '' : 'NOAA data could not be loaded. Check your connection or browser network restrictions; no sample readings are substituted.');
  }, []);
  useEffect(() => { void refresh(); const id = window.setInterval(() => void refresh(), 5 * 60 * 1000); return () => window.clearInterval(id); }, [refresh]);
  useEffect(() => {
    let cancelled = false;
    const loadNasaEvents = async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
      try {
        const url = 'https://api.nasa.gov/DONKI/FLR?startDate=' + dateOnly(start) + '&endDate=' + dateOnly(end) + '&api_key=DEMO_KEY';
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('NASA DONKI HTTP ' + response.status);
        const json: unknown = await response.json();
        if (!Array.isArray(json)) throw new Error('Unexpected NASA DONKI response');
        if (!cancelled) { setNasaEvents((json as NasaFlareEvent[]).sort((a, b) => Date.parse(b.beginTime ?? '') - Date.parse(a.beginTime ?? ''))); setNasaEventError(''); }
      } catch (error) {
        if (!cancelled) setNasaEventError(error instanceof Error ? error.message : 'NASA DONKI unavailable');
      }
    };
    void loadNasaEvents();
    const id = window.setInterval(() => void loadNasaEvents(), 30 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);
  const xray = series.find((item) => item.key === 'xray');
  const proton = series.find((item) => item.key === 'proton');
  const electron = series.find((item) => item.key === 'electron');
  const kp = series.find((item) => item.key === 'kp');
  const xrayRows = useMemo(() => (xray?.rows ?? []).filter((row) => energyMatches(row, 'xray') || !row.energy).filter((row) => rowFlux(row) !== null).sort((a, b) => timestampOf(a) - timestampOf(b)), [xray]);
  useEffect(() => { if (xrayRows.length) setSelectedTime((old) => Math.min(old, xrayRows.length - 1)); else setSelectedTime(0); }, [xrayRows.length]);
  useEffect(() => {
    if (!playing || xrayRows.length < 2) return;
    const id = window.setInterval(() => setSelectedTime((current) => {
      if (current >= xrayRows.length - 1) { setPlaying(false); return current; }
      return Math.min(xrayRows.length - 1, current + speed);
    }), 700);
    return () => window.clearInterval(id);
  }, [playing, speed, xrayRows.length]);
  const selectedXray = xrayRows[Math.min(selectedTime, Math.max(0, xrayRows.length - 1))];
  const liveXray = latestFor(xray, 'xray');
  const liveProton = latestFor(proton, 'proton');
  const liveElectron = latestFor(electron, 'electron');
  const liveKp = (kp?.rows ?? []).filter((row) => rowFlux(row) !== null).sort((a, b) => timestampOf(b) - timestampOf(a))[0];
  const kpValue = rowFlux(liveKp ?? {});
  const xrayValue = rowFlux(liveXray ?? {});
  const protonValue = rowFlux(liveProton ?? {});
  const electronValue = rowFlux(liveElectron ?? {});
  const currentTime = timestampOf(selectedXray ?? {});
  const flareLabel = flareClass(rowFlux(selectedXray ?? {}));
  const xrayPoints = xrayRows.slice(-80);
  const maxFlux = Math.max(1e-8, ...xrayPoints.map((row) => rowFlux(row) ?? 0));
  const chartPoints = xrayPoints.map((row, index) => {
    const x = xrayPoints.length <= 1 ? 0 : index / (xrayPoints.length - 1) * 100;
    const v = Math.max(1e-9, rowFlux(row) ?? 1e-9);
    const y = 96 - (Math.log10(v) - Math.log10(1e-9)) / (Math.log10(maxFlux) - Math.log10(1e-9) || 1) * 86;
    return x + ',' + Math.max(5, Math.min(96, y));
  }).join(' ');
  const kpLabel = kpValue === null ? 'Unavailable' : kpValue.toFixed(1) + ' / 9';
  const kpLevel = kpValue === null ? 'No reading' : kpValue >= 5 ? 'Geomagnetic storm threshold reached' : kpValue >= 4 ? 'Elevated' : 'Quiet to unsettled';
  const timeFor = (row: DataRow | null) => row ? fmtTime(timestampOf(row)) : 'No timestamp';
  const selectedFlux = rowFlux(selectedXray ?? {});
  const kIndexRow = liveKp ?? {};
  const filteredHistory = HISTORICAL_EVENTS.filter((event) => !historyQuery.trim() || [event.year, event.date, event.name, event.type, event.note].some((value) => value.toLowerCase().includes(historyQuery.trim().toLowerCase())));
  return (
    <section className="solar-research" aria-label="Solar flare and space weather research">
      <div className="solar-research-toolbar">
        <div><div className="solar-eyebrow"><Sun size={13} /> SPACE WEATHER / LIVE OBSERVATIONS</div><h2>Solar Flare Research</h2><p>NOAA GOES measurements · Planetary geomagnetic activity · UTC timeline</p></div>
        <button className="solar-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'solar-spinning' : ''} /> {loading ? 'UPDATING' : 'REFRESH DATA'}</button>
        {onClose && <button type="button" className="solar-close-module" onClick={onClose}>BACK TO NEUROPULSE</button>}
      </div>
      <div className="solar-statusline"><span className={series.some((item) => item.rows.length) ? 'solar-status-dot' : 'solar-status-dot offline'} />{series.some((item) => item.rows.length) ? 'NOAA DATA CONNECTED' : 'WAITING FOR NOAA DATA'}<span>·</span> Updated {lastRefresh ? fmtTime(lastRefresh) : 'not yet'}<span>·</span>{loading ? 'Refreshing sources…' : 'Auto-refresh every 5 minutes'}</div>
      {notice && <div className="solar-notice"><AlertTriangle size={15} />{notice}</div>}
      <div className="solar-metrics">
        <article className="solar-metric"><div className="solar-metric-label"><Zap size={13} /> GOES X-RAY FLUX</div><strong>{fmtFlux(xrayValue)}</strong><span>{flareClass(xrayValue)} · W/m²</span><small>{timeFor(liveXray)}</small></article>
        <article className="solar-metric"><div className="solar-metric-label"><Activity size={13} /> PROTON FLUX</div><strong>{fmtFlux(protonValue)}</strong><span>{String(liveProton?.energy ?? 'Energy channel unavailable')} · particles/(cm²·s·sr)</span><small>{timeFor(liveProton)}</small></article>
        <article className="solar-metric"><div className="solar-metric-label"><Satellite size={13} /> ELECTRON FLUX</div><strong>{fmtFlux(electronValue)}</strong><span>{String(liveElectron?.energy ?? 'Energy channel unavailable')} · electrons/(cm²·s·sr)</span><small>{timeFor(liveElectron)}</small></article>
        <article className="solar-metric"><div className="solar-metric-label"><ShieldAlert size={13} /> PLANETARY Kp</div><strong>{kpLabel}</strong><span>{kpLevel}</span><small>{timeFor(kIndexRow)}</small></article>
      </div>
      <div className="solar-content-grid">
        <article className="solar-panel solar-simulation-panel">
          <div className="solar-panel-heading"><Sun size={14} /> SUN → EARTH / EVENT TIMELINE <span>SCHEMATIC · NOT TO SCALE</span></div>
          <div className="solar-space-scene">
            <div className="solar-starfield" />
            <div className="solar-sun"><img className="solar-sdo-image" src="https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0171.jpg" alt="Latest NASA Solar Dynamics Observatory AIA 171 angstrom solar image" /><div className="solar-flare-arc" /></div>
            <div className="solar-propagation-line"><i /></div>
            <div className="solar-earth"><div /></div>
            <div className="solar-space-label solar-label-sun">SUN <small>{flareLabel}</small></div>
            <div className="solar-space-label solar-label-earth">EARTH <small>{currentTime ? fmtTime(currentTime) : 'Select a timestamp'}</small></div>
            <div className="solar-observed-tag">OBSERVED IMAGE · NASA SDO AIA 171 Å</div><div className="solar-propagation-note">{selectedFlux === null ? 'Waiting for measured X-ray data' : selectedFlux >= 1e-5 ? 'Elevated measured X-ray flux · event candidate' : 'Measured X-ray background / lower activity'}</div>
          </div>
          <div className="solar-timeline-controls">
            <div className="solar-timeline-buttons"><button onClick={() => setPlaying((v) => !v)} disabled={xrayRows.length < 2}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'PAUSE' : 'PLAY TIMELINE'}</button><button onClick={() => { setPlaying(false); setSelectedTime(0); }}>RESET</button><label>PLAYBACK <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option><option value={8}>8×</option></select></label></div>
            <input aria-label="Solar X-ray observation timeline" type="range" min={0} max={Math.max(0, xrayRows.length - 1)} value={Math.min(selectedTime, Math.max(0, xrayRows.length - 1))} onChange={(event) => { setPlaying(false); setSelectedTime(Number(event.target.value)); }} disabled={xrayRows.length < 2} />
            <div className="solar-timeline-labels"><span>{xrayRows.length ? fmtTime(timestampOf(xrayRows[0])) : 'No history loaded'}</span><strong>{currentTime ? fmtTime(currentTime) : 'No selected observation'}</strong><span>{xrayRows.length ? fmtTime(timestampOf(xrayRows[xrayRows.length - 1])) : 'Waiting for data'}</span></div>
          </div>
          <div className="solar-chart-wrap"><div className="solar-chart-title">GOES LONG-CHANNEL X-RAY FLUX <span>LOG SCALE · W/m²</span></div>{xrayPoints.length > 1 ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="GOES X-ray flux trend"><polyline points={chartPoints} fill="none" stroke="#42c9ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />{selectedXray && <circle cx={(Math.max(0, xrayPoints.findIndex((row) => timestampOf(row) === timestampOf(selectedXray))) / Math.max(1, xrayPoints.length - 1)) * 100} cy={Number(chartPoints.split(' ')[Math.max(0, xrayPoints.findIndex((row) => timestampOf(row) === timestampOf(selectedXray)))].split(',')[1]) || 50} r="2" fill="#ffd36a" />}</svg> : <div className="solar-chart-empty">Waiting for NOAA X-ray time-series observations.</div>}</div>
        </article>
        <article className="solar-panel solar-details-panel">
          <div className="solar-panel-heading"><Activity size={14} /> SELECTED OBSERVATION</div>
          <div className="solar-detail-class"><span>GOES X-RAY CLASS ESTIMATE</span><strong>{flareLabel}</strong><small>Calculated from selected long-channel flux; not an official event catalogue entry.</small></div>
          <dl className="solar-details-list"><div><dt>Observation time</dt><dd>{currentTime ? fmtTime(currentTime) : 'Unavailable'}</dd></div><div><dt>Measured X-ray flux</dt><dd>{fmtFlux(selectedFlux)} W/m²</dd></div><div><dt>GOES satellite</dt><dd>{String(selectedXray?.satellite ?? liveXray?.satellite ?? 'Not reported')}</dd></div><div><dt>Proton energy channel</dt><dd>{String(liveProton?.energy ?? 'Unavailable')}</dd></div><div><dt>Electron energy channel</dt><dd>{String(liveElectron?.energy ?? 'Unavailable')}</dd></div><div><dt>Planetary Kp</dt><dd>{kpValue === null ? 'Unavailable' : kpValue.toFixed(1)}</dd></div></dl>
          <div className="solar-scales-note"><ShieldAlert size={15} /><div><strong>Interpretation</strong><p>Kp is a planetary geomagnetic index, not a flare class. GOES proton/electron fluxes are independent particle measurements. A flare does not automatically imply a CME or an Earth impact.</p></div></div>
          <div className="solar-source-links"><strong>OFFICIAL NOAA SOURCES</strong>{SOURCE_LINKS.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={11} /></a>)}</div>
        </article>
      </div>
      <article className="solar-panel solar-nasa-events">
        <div className="solar-panel-heading"><Sun size={14} /> NASA DONKI / RECENT FLARE EVENTS <span>LAST 7 DAYS · EVENT CATALOGUE</span></div>
        <div className="solar-nasa-intro">NASA DONKI event reports are listed separately from GOES flux measurements. A catalogue entry is an event report, not proof of a CME or Earth impact.</div>
        {nasaEventError && <div className="solar-nasa-error"><AlertTriangle size={13} /> NASA DONKI event feed unavailable: {nasaEventError}</div>}
        <div className="solar-nasa-list">{nasaEvents.map((event, index) => <article className="solar-nasa-row" key={event.flrID ?? event.beginTime ?? String(index)}><div className="solar-nasa-class">{event.classType ?? 'Flare'}<small>{event.flrID ?? 'NASA event'}</small></div><div className="solar-nasa-info"><strong>{event.beginTime ? fmtTime(Date.parse(event.beginTime)) : 'Start time unavailable'}</strong><span>Peak: {event.peakTime ? fmtTime(Date.parse(event.peakTime)) : 'not reported'} · End: {event.endTime ? fmtTime(Date.parse(event.endTime)) : 'not reported'}</span><small>Solar location: {event.sourceLocation ?? 'not reported'} · Active region: {event.activeRegionNum ?? 'not reported'}</small>{event.link && <a href={event.link} target="_blank" rel="noreferrer">Open NASA event record <ExternalLink size={10} /></a>}</div></article>)}{nasaEvents.length === 0 && !nasaEventError && <div className="solar-chart-empty">Loading recent NASA DONKI flare reports…</div>}</div>
        <div className="solar-nasa-footnote">Feed: NASA DONKI FLR API · last 7 days · refreshed every 30 minutes. NOAA time series below are measured flux; NASA records provide event metadata. DEMO_KEY rate limits may apply.</div>
      </article>
      <article className="solar-panel solar-history-panel">
        <div className="solar-panel-heading"><Clock3 size={14} /> HISTORICAL SPACE-WEATHER INDEX <span>CURATED RESEARCH STARTING POINTS</span></div>
        <div className="solar-history-tools"><label htmlFor="solar-history-search">Search by year, date, event, or type</label><input id="solar-history-search" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="e.g. 2003, proton, geomagnetic..." /><span>{filteredHistory.length} records</span></div>
        <div className="solar-history-list">{filteredHistory.map((event) => <article className="solar-history-row" key={event.year + event.name}><div className="solar-history-date">{event.year}<small>{event.date}</small></div><div className="solar-history-info"><strong>{event.name}</strong><span>{event.type}</span><p>{event.note}</p><small>Source trail: {event.source}</small></div></article>)}{filteredHistory.length === 0 && <div className="solar-chart-empty">No historical events match that search.</div>}</div>
        <div className="solar-history-disclaimer">This curated index is a research guide, not a complete calibrated measurement archive. Historical classifications and flux values are not invented for periods before the relevant instruments existed. Verify event-level measurements in the cited official archives before analysis.</div>
      </article>
      <div className="solar-data-footnote"><Clock3 size={12} /> Values come from NOAA SWPC JSON products when available. Time-series slider replays recorded samples, not a forecast of the flare travelling to Earth. Units, energy channel and timestamps should be checked against each source product. {series.filter((item) => item.error).map((item) => item.label + ': ' + item.error).join(' · ')}</div>
    </section>
  );
}
