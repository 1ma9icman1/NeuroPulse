import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LeafletSitePoint { name: string; lat: number; lon: number; color?: string }
export interface LeafletAudioPoint { name: string; lat: number; lon: number; measuredFrequenciesHz: number[]; status?: string }
interface Props {
  site: LeafletSitePoint;
  sites?: LeafletSitePoint[];
  layer: 'map' | 'terrain' | 'satellite';
  audioSites?: LeafletAudioPoint[];
}
export function LeafletSiteMap({ site, sites = [], layer, audioSites = [] }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<string, L.TileLayer>>({});
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true, worldCopyJump: true }).setView([site.lat, site.lon], 12);
    layersRef.current = {
      map: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }),
      terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery &copy; Esri' }),
    };
    layersRef.current[layer].addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(layersRef.current).forEach((tile) => { if (map.hasLayer(tile)) map.removeLayer(tile); });
    layersRef.current[layer]?.addTo(map);
  }, [layer]);

  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const all = [site, ...sites.filter((point) => point.name !== site.name)];
    all.forEach((point, index) => {
      L.circleMarker([point.lat, point.lon], {
        radius: index === 0 ? 8 : 4,
        color: index === 0 ? '#ffffff' : '#07101d',
        weight: index === 0 ? 2 : 1,
        fillColor: point.color || (index === 0 ? '#f59e0b' : '#38bdf8'),
        fillOpacity: 0.95,
      }).bindTooltip(point.name, { direction: 'top', opacity: 0.95 }).addTo(group);
    });
    audioSites.forEach((audio) => {
      if (map.distance([site.lat, site.lon], [audio.lat, audio.lon]) > 2500000) return;
      const frequencies = audio.measuredFrequenciesHz || [];
      const color = frequencies.some((hz) => Math.abs(hz - 110) <= 10) ? '#fb923c' : frequencies.some((hz) => Math.abs(hz - 432) <= 8) ? '#c084fc' : '#38bdf8';
      const label = frequencies.length ? frequencies.map((hz) => `${hz} Hz`).join(' · ') : 'SOUND CANDIDATE';
      L.circle([audio.lat, audio.lon], { radius: 220, color, weight: 1.5, opacity: 0.8, fillColor: color, fillOpacity: 0.09, className: 'np-audio-wave' }).bindTooltip(`${audio.name}: ${label}`, { direction: 'top' }).addTo(group);
      L.marker([audio.lat, audio.lon], { icon: L.divIcon({ className: 'np-audio-frequency-icon', html: `<span class="np-audio-frequency-dot" style="background:${color}"></span><span class="np-audio-frequency-label">${label}</span>`, iconSize: [110, 26], iconAnchor: [7, 7] }) }).bindTooltip(`${audio.name}: ${label}`, { direction: 'top' }).addTo(group);
    });
    map.setView([site.lat, site.lon], 12, { animate: false });
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [site, sites, audioSites]);

  return <div ref={hostRef} className="np-leaflet-site-map" aria-label={'Map of ' + site.name} />;
}
