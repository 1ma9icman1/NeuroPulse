import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Link2, Save, Search, Tag } from 'lucide-react';

type ResearchSite = {
  id?: string;
  name: string;
  lat: number;
  lon: number;
  category?: string;
  desc?: string;
  tags?: string[];
  modules?: string[];
};

type SavedNote = {
  siteKey: string;
  siteName: string;
  lat: number;
  lon: number;
  note: string;
  updatedAt: string;
};

type Props = {
  site: ResearchSite;
  sites: ResearchSite[];
  onSelectSite: (site: ResearchSite) => void;
};

const STORAGE_KEY = 'neuropulse-site-research-notes-v1';
const STOP_WORDS = new Set((
  'about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just more most my myself no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves the site location place notes note research'
).split(/\s+/));

function normalize(value: string): string {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function siteKey(site: ResearchSite): string {
  return normalize(site.id || site.name) + '|' + Number(site.lat).toFixed(4) + '|' + Number(site.lon).toFixed(4);
}

function extractKeywords(value: string): string[] {
  const counts = new Map<string, number>();
  normalize(value).split(/\s+/).forEach(word => {
    if (word.length < 4 || STOP_WORDS.has(word) || /^\d+$/.test(word)) return;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([word]) => word);
}

function readSavedNotes(): SavedNote[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(item => item && typeof item.siteKey === 'string' && typeof item.note === 'string') : [];
  } catch {
    return [];
  }
}

export function SiteResearchNotes({ site, sites, onSelectSite }: Props) {
  const currentKey = siteKey(site);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(readSavedNotes);
  const [note, setNote] = useState(() => readSavedNotes().find(item => item.siteKey === currentKey)?.note ?? '');
  const [searchRelated, setSearchRelated] = useState('');
  const [saveState, setSaveState] = useState('Saved locally on this device');

  useEffect(() => {
    setNote(savedNotes.find(item => item.siteKey === currentKey)?.note ?? '');
    setSearchRelated('');
  }, [currentKey]);

  useEffect(() => {
    try {
      const current = savedNotes.find(item => item.siteKey === currentKey);
      const next = note.trim()
        ? [
            ...savedNotes.filter(item => item.siteKey !== currentKey),
            { siteKey: currentKey, siteName: site.name, lat: site.lat, lon: site.lon, note, updatedAt: new Date().toISOString() },
          ]
        : savedNotes.filter(item => item.siteKey !== currentKey);
      // Avoid rewriting storage when the current note already matches the persisted value.
      if (current?.note === note && (note.trim() || !current)) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedNotes(next);
      setSaveState(note.trim() ? 'Saved locally on this device' : 'Note cleared');
    } catch {
      setSaveState('Could not save — browser storage may be disabled');
    }
  }, [note, currentKey, site.name, site.lat, site.lon]);

  const keywords = useMemo(() => extractKeywords(note), [note]);
  const relatedNotes = useMemo(() => {
    if (!keywords.length) return [];
    const keywordSet = new Set(keywords);
    const query = normalize(searchRelated);
    return savedNotes
      .filter(item => item.siteKey !== currentKey && item.note.trim())
      .map(item => {
        const matched = extractKeywords(item.note).filter(word => keywordSet.has(word));
        return { ...item, matched: [...new Set(matched)].slice(0, 5), score: new Set(matched).size };
      })
      .filter(item => item.score > 0 && (!query || normalize(item.siteName).includes(query) || item.matched.some(word => word.includes(query))))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [keywords, savedNotes, currentKey, searchRelated]);

  const relatedCatalogue = useMemo(() => {
    if (!keywords.length) return [];
    const keywordSet = new Set(keywords);
    const query = normalize(searchRelated);
    return sites
      .filter(item => siteKey(item) !== currentKey)
      .map(item => {
        const text = normalize([item.name, item.category, item.desc, ...(item.tags ?? []), ...(item.modules ?? [])].filter(Boolean).join(' '));
        const matched = keywords.filter(word => text.split(' ').includes(word));
        return { site: item, matched: [...new Set(matched)].slice(0, 4), score: new Set(matched).size };
      })
      .filter(item => item.score > 0 && (!query || normalize(item.site.name + ' ' + item.site.category).includes(query)))
      .sort((a, b) => b.score - a.score || a.site.name.localeCompare(b.site.name))
      .slice(0, 6);
  }, [keywords, sites, currentKey, searchRelated]);

  const wordHits = useMemo(() => {
    const query = normalize(searchRelated);
    if (!query) return keywords.slice(0, 16);
    return keywords.filter(word => word.includes(query)).slice(0, 16);
  }, [keywords, searchRelated]);

  return (
    <section className="atlas-panel atlas-research-notes">
      <div className="atlas-panel-heading"><BookOpen size={14} /> LOCATION RESEARCH NOTES <span className="atlas-panel-count">AUTO-SAVE</span></div>
      <p className="atlas-notes-help">Keep your observations, source excerpts, measurements, and hypotheses for this location. NeuroPulse scans your words and finds matching terms in other notes and site records.</p>
      <label className="atlas-notes-label" htmlFor="site-research-note">NOTES — {site.name}</label>
      <textarea
        id="site-research-note"
        className="atlas-notes-textarea"
        value={note}
        onChange={event => setNote(event.target.value)}
        placeholder="Type your notes about this location…\n\nExample: solstice sunrise, limestone, 432 Hz, water source, cardinal alignment, excavation report…"
        rows={7}
      />
      <div className="atlas-notes-footer"><span><Save size={12} /> {saveState}</span><span>{note.trim() ? note.trim().split(/\s+/).length : 0} words</span></div>
      <div className="atlas-notes-subheading"><Tag size={13} /> WORDS DETECTED <span>{keywords.length}</span></div>
      {wordHits.length ? <div className="atlas-note-keywords">{wordHits.map(word => <button type="button" key={word} onClick={() => setSearchRelated(word)} title={'Find records related to ' + word}>{word}</button>)}</div> : <div className="atlas-notes-empty">Add a few notes to detect keywords and related records.</div>}
      <label className="atlas-notes-search"><Search size={13} /><input value={searchRelated} onChange={event => setSearchRelated(event.target.value)} placeholder="Filter related records or click a keyword" /><button type="button" onClick={() => setSearchRelated('')} aria-label="Clear related search">×</button></label>
      {relatedNotes.length > 0 && <div className="atlas-notes-related">
        <div className="atlas-notes-subheading"><Link2 size={13} /> MATCHING NOTES <span>{relatedNotes.length}</span></div>
        {relatedNotes.map(item => <div className="atlas-note-match" key={item.siteKey}><strong>{item.siteName}</strong><p>{item.note.trim().slice(0, 190)}{item.note.trim().length > 190 ? '…' : ''}</p><div>{item.matched.map(word => <span key={word}>{word}</span>)}</div></div>)}
      </div>}
      {relatedCatalogue.length > 0 && <div className="atlas-notes-related">
        <div className="atlas-notes-subheading"><Link2 size={13} /> RELATED CATALOGUE LOCATIONS <span>{relatedCatalogue.length}</span></div>
        {relatedCatalogue.map(({ site: match, matched }) => <button type="button" className="atlas-note-catalogue-match" key={siteKey(match)} onClick={() => onSelectSite(match)}><span><strong>{match.name}</strong><small>{match.category ?? 'Research location'}</small><i>{matched.join(' · ')}</i></span><b>OPEN ↗</b></button>)}
      </div>}
      {!relatedNotes.length && !relatedCatalogue.length && keywords.length > 0 && <div className="atlas-notes-empty">No word matches found yet. As you add notes to other locations, shared terms will connect them here.</div>}
      <div className="atlas-notes-storage-note">Notes are stored in this browser on this device; they are not uploaded to GitHub or synced to other devices.</div>
    </section>
  );
}
