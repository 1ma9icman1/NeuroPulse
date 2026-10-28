import React, { useMemo, useState } from "react";
import { ArrowUpRight, CircleHelp, Network, Search, X } from "lucide-react";
import { buildKnowledgeEntities, buildKnowledgeRelationships, type GraphSiteInput, type KnowledgeEntity, type KnowledgeRelationship } from "../graph/graphEngine";

interface Props {
  sites: GraphSiteInput[];
  onSelectSite: (site: GraphSiteInput) => void;
  onClose: () => void;
}

const COLORS = ["#37c7ff", "#a879ff", "#f5c451", "#43dfad", "#f16acb", "#4d8dff"];

export function KnowledgeExplorer({ sites, onSelectSite, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [relationshipType, setRelationshipType] = useState("all");
  const [radius, setRadius] = useState(250);
  const [selectedId, setSelectedId] = useState("");
  const entities = useMemo(() => buildKnowledgeEntities(sites), [sites]);
  const filteredEntities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entities.filter(e => !q || [e.title, e.category, e.description].some(v => String(v ?? "").toLowerCase().includes(q)));
  }, [entities, query]);
  const allRelationships = useMemo(() => buildKnowledgeRelationships(filteredEntities.slice(0, 36), radius), [filteredEntities, radius]);
  const visibleIds = useMemo(() => new Set(filteredEntities.slice(0, 36).map(e => e.id)), [filteredEntities]);
  const relationships = allRelationships.filter(r => visibleIds.has(r.sourceId) && visibleIds.has(r.targetId) && (relationshipType === "all" || r.type === relationshipType));
  const nodes = filteredEntities.slice(0, 36);
  const selected = entities.find(e => e.id === selectedId) ?? nodes[0];
  const centerX = 480, centerY = 265, orbitX = 345, orbitY = 190;
  const positions = new Map<string, {x:number;y:number}>();
  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index / Math.max(nodes.length, 1)) - Math.PI / 2;
    const ring = index % 3 === 0 ? 0.52 : index % 3 === 1 ? 0.78 : 1;
    positions.set(node.id, { x: centerX + Math.cos(angle) * orbitX * ring, y: centerY + Math.sin(angle) * orbitY * ring });
  });
  const related = selected ? relationships.filter(r => r.sourceId === selected.id || r.targetId === selected.id) : [];
  const entityFor = (id: string) => entities.find(e => e.id === id);
  const focusSite = (entity: KnowledgeEntity) => {
    const site = sites.find(s => String(s.id ?? s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")) === entity.id);
    if (site) onSelectSite(site);
  };

  return <section className="knowledge-explorer" role="dialog" aria-modal="true" aria-label="Knowledge graph explorer">
    <header className="kg-topbar">
      <div className="kg-brand"><span className="kg-brand-mark"><Network size={22}/></span><div><strong>NEUROPULSE</strong><small>PLANETARY KNOWLEDGE ENGINE</small></div></div>
      <label className="kg-query"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sites, regions, categories, evidence…"/><kbd>ENTER</kbd></label>
      <button className="kg-close" onClick={onClose} aria-label="Close Knowledge Graph"><X size={20}/></button>
    </header>
    <div className="kg-layout">
      <aside className="kg-sidebar">
        <div className="kg-section-label">EXPLORER</div>
        <div className="kg-nav-active"><Network size={16}/> Knowledge Graph</div>
        <button onClick={() => setRelationshipType("geographic_proximity")}>Geographic connections</button>
        <button onClick={() => setRelationshipType("shared_category")}>Shared categories</button>
        <button onClick={() => setRelationshipType("all")}>All derived relationships</button>
        <div className="kg-divider"/>
        <div className="kg-section-label">RELATIONSHIP DISTANCE</div>
        <div className="kg-range-value">{radius} km</div>
        <input className="kg-range" aria-label="Maximum geographic connection distance" type="range" min="25" max="1000" step="25" value={radius} onChange={e => setRadius(Number(e.target.value))}/>
        <div className="kg-range-labels"><span>25 km</span><span>1,000 km</span></div>
        <div className="kg-divider"/>
        <div className="kg-section-label">LIVE CATALOGUE</div>
        <div className="kg-stat"><span>Entities indexed</span><strong>{entities.length.toLocaleString()}</strong></div>
        <div className="kg-stat"><span>Visible entities</span><strong>{nodes.length}</strong></div>
        <div className="kg-stat"><span>Derived connections</span><strong>{relationships.length.toLocaleString()}</strong></div>
        <div className="kg-note"><CircleHelp size={15}/> Connections here are calculated from actual catalogue coordinates and categories. They do not imply cultural, historical, or astronomical proof.</div>
      </aside>
      <main className="kg-main">
        <div className="kg-heading"><div><div className="kg-eyebrow">RELATIONSHIP EXPLORER / EARTH CATALOGUE</div><h1>Knowledge Network</h1><p>Explore how catalogued locations relate by distance and classification.</p></div><div className="kg-pill"><span/> DATA-DRIVEN GRAPH</div></div>
        <div className="kg-canvas">
          <div className="kg-canvas-stars"/>
          <svg className="kg-lines" viewBox="0 0 960 530" preserveAspectRatio="none" aria-label="Connections between catalogue entities">
            {relationships.slice(0, 500).map((r: KnowledgeRelationship) => {
              const a = positions.get(r.sourceId), b = positions.get(r.targetId);
              if (!a || !b) return null;
              const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2 - Math.min(42, Math.abs(a.x - b.x) * .05);
              return <path key={r.id} d={`M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`} className={r.type === "geographic_proximity" ? "kg-link proximity" : "kg-link category"} />;
            })}
          </svg>
          {nodes.map((node, index) => {
            const p = positions.get(node.id)!;
            const color = COLORS[index % COLORS.length];
            return <button key={node.id} className={`kg-node ${selected?.id === node.id ? "selected" : ""}`} style={{left: `${p.x / 960 * 100}%`, top: `${p.y / 530 * 100}%`, "--node-color": color} as React.CSSProperties} onClick={() => setSelectedId(node.id)} title={node.title}>
              <span className="kg-node-orb"><span/></span><strong>{node.title}</strong><small>{node.category ?? "Catalogue site"}</small>
            </button>;
          })}
          <div className="kg-canvas-legend"><span><i className="kg-legend-line cyan"/> Geographic proximity</span><span><i className="kg-legend-line purple"/> Shared category</span></div>
          <div className="kg-canvas-counter">{nodes.length} NODES · {relationships.length} LINKS</div>
        </div>
        <div className="kg-bottom"><div className="kg-bottom-title">CONNECTION MAP <span>Derived from catalogue metadata</span></div><div className="kg-mini-graph">{nodes.slice(0, 9).map((n, i) => <button key={n.id} onClick={() => setSelectedId(n.id)} className={selected?.id === n.id ? "active" : ""}><i style={{background:COLORS[i%COLORS.length]}}/>{n.title}</button>)}</div></div>
      </main>
      <aside className="kg-detail">
        {selected ? <>
          <div className="kg-detail-hero"><div className="kg-detail-icon"><Network size={24}/></div><div><div className="kg-eyebrow">SELECTED ENTITY</div><h2>{selected.title}</h2><p>{selected.category ?? "Archaeological / geographic catalogue"}</p></div></div>
          <div className="kg-detail-metrics"><div><small>CONNECTED NODES</small><strong>{related.length}</strong></div><div><small>ENTITY TYPE</small><strong>Site</strong></div></div>
          <div className="kg-detail-heading">ENTITY RECORD</div>
          {typeof selected.latitude === "number" && typeof selected.longitude === "number" && <div className="kg-coordinate">{selected.latitude.toFixed(4)}° · {selected.longitude.toFixed(4)}°</div>}
          <p className="kg-description">{selected.description || "No description is recorded for this catalogue entry."}</p>
          <div className="kg-detail-heading">DIRECT RELATIONSHIPS <span>{related.length}</span></div>
          <div className="kg-related-list">{related.slice(0, 16).map(r => { const other = entityFor(r.sourceId === selected.id ? r.targetId : r.sourceId); return other ? <button key={r.id} onClick={() => setSelectedId(other.id)}><i className={r.type === "geographic_proximity" ? "cyan" : "purple"}/><span><strong>{other.title}</strong><small>{r.type === "geographic_proximity" ? `Geographic proximity · ${r.distanceKm} km` : "Shared catalogue category"}</small></span><ArrowUpRight size={15}/></button> : null; })}</div>
          <button className="kg-open-site" onClick={() => focusSite(selected)}>Open location in EarthCore <ArrowUpRight size={16}/></button>
        </> : <div className="kg-empty">No entities match this query.</div>}
      </aside>
    </div>
  </section>;
}
