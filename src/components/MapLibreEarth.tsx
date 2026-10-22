import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl, { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { filterHistoricalGeoJson } from '../data/historicalGeoJson';

export interface EarthMapPoint {
  name: string;
  lat: number;
  lon: number;
  year?: number;
  color?: string;
  isCity?: boolean;
  evidenceStatus?: string;
}
export interface MapLibreEarthHandle {
  pointOfView: (view: { lat?: number; lng?: number; altitude?: number }, duration?: number) => void;
}
interface Props {
  points: EarthMapPoint[];
  onPointClick: (point: EarthMapPoint) => void;
  zoom?: number;
  compact?: boolean;
  importedGeoJson?: GeoJSON.FeatureCollection | null;
  showImportedHistoricalData?: boolean;
  showOpenHistoricalMap?: boolean;
  timelineYear?: number;
}

/** Shared Earth renderer: MapLibre globe projection, Esri imagery, Natural Earth boundaries, and dot-only site markers. */
export const MapLibreEarth = forwardRef<MapLibreEarthHandle, Props>(function MapLibreEarth(
  { points, onPointClick, zoom = 1, compact = false, importedGeoJson = null, showImportedHistoricalData = false, showOpenHistoricalMap = false, timelineYear = new Date().getUTCFullYear() }, ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbackRef = useRef(onPointClick);
  const pointsRef = useRef(points);
  const importedRef = useRef(importedGeoJson);
  const importedVisibleRef = useRef(showImportedHistoricalData);
  const yearRef = useRef(timelineYear);
  callbackRef.current = onPointClick;
  pointsRef.current = points;
  importedRef.current = importedGeoJson;
  importedVisibleRef.current = showImportedHistoricalData;
  yearRef.current = timelineYear;

  useImperativeHandle(ref, () => ({
    pointOfView: (view, duration = 0) => {
      const map = mapRef.current;
      if (!map) return;
      const targetZoom = view.altitude == null ? undefined : Math.max(1.2, Math.min(7, 5.4 - view.altitude * 2.1));
      map.flyTo({
        center: [view.lng ?? map.getCenter().lng, view.lat ?? map.getCenter().lat],
        ...(targetZoom == null ? {} : { zoom: targetZoom }),
        duration: Math.max(0, duration),
        essential: true,
      });
    },
  }), []);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: hostRef.current,
      center: [12, 18],
      zoom: compact ? 1.15 : 1.45,
      minZoom: 0.85,
      maxZoom: 9,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      style: {
        version: 8,
        projection: { type: 'globe' },
        sources: {
          imagery: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Imagery © Esri; geographic boundaries © Natural Earth',
            maxzoom: 19,
          },
          naturalEarth: {
            type: 'geojson',
            data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
          },
          sites: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          historicalImports: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
          openHistoricalMap: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
        },
        layers: [
          { id: 'earth-imagery', type: 'raster', source: 'imagery', paint: { 'raster-opacity': 1, 'raster-saturation': 0.08, 'raster-contrast': 0.08 } },
          { id: 'natural-earth-fill', type: 'fill', source: 'naturalEarth', paint: { 'fill-color': '#4b8b78', 'fill-opacity': 0.08 } },
          { id: 'natural-earth-borders', type: 'line', source: 'naturalEarth', paint: { 'line-color': '#b6e0d2', 'line-opacity': 0.52, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.25, 5, 0.8] } },
          { id: 'ohm-history-polygons', type: 'fill', source: 'openHistoricalMap', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#60a5fa', 'fill-opacity': 0.12, 'fill-outline-color': '#60a5fa' } },
          { id: 'ohm-history-lines', type: 'line', source: 'openHistoricalMap', filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]], paint: { 'line-color': '#60a5fa', 'line-width': 1.4, 'line-opacity': 0.8 } },
          { id: 'ohm-history-points', type: 'circle', source: 'openHistoricalMap', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 2.8, 'circle-color': '#60a5fa', 'circle-stroke-color': '#dbeafe', 'circle-stroke-width': 0.5 } },
          { id: 'imported-history-polygons', type: 'fill', source: 'historicalImports', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['coalesce', ['get', 'color'], '#eab308'], 'fill-opacity': 0.18, 'fill-outline-color': '#fbbf24' } },
          { id: 'imported-history-lines', type: 'line', source: 'historicalImports', filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]], paint: { 'line-color': ['coalesce', ['get', 'color'], '#fbbf24'], 'line-width': 1.5, 'line-opacity': 0.85 } },
          { id: 'imported-history-points', type: 'circle', source: 'historicalImports', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 3.5, 'circle-color': ['coalesce', ['get', 'color'], '#fb923c'], 'circle-stroke-color': '#fff7ed', 'circle-stroke-width': 0.8 } },
          { id: 'historical-site-dots', type: 'circle', source: 'sites', paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.4, 3, 3.4, 7, 5],
            'circle-color': ['coalesce', ['get', 'color'], '#facc15'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 0.8,
            'circle-opacity': 0.96,
            'circle-pitch-alignment': 'viewport',
            'circle-pitch-scale': 'viewport',
          } },
        ],
      },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      const source = map.getSource('sites') as GeoJSONSource | undefined;
      if (source) source.setData(toFeatureCollection(pointsRef.current));
      updateImportedSource(map, importedRef.current, importedVisibleRef.current, yearRef.current);
      map.resize();
    });
    map.on('click', 'historical-site-dots', (event) => {
      const feature = event.features?.[0];
      const name = feature?.properties?.name;
      if (!name) return;
      const point = pointsRef.current.find((item) => item.name === name);
      if (point) callbackRef.current(point);
    });
    map.on('mouseenter', 'historical-site-dots', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'historical-site-dots', () => { map.getCanvas().style.cursor = ''; });
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(hostRef.current);
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource('sites') as GeoJSONSource | undefined;
      source?.setData(toFeatureCollection(points));
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => updateImportedSource(map, importedGeoJson, showImportedHistoricalData, timelineYear);
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [importedGeoJson, showImportedHistoricalData, timelineYear]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let controller: AbortController | null = null;
    let requestId = 0;
    const source = () => map.getSource('openHistoricalMap') as GeoJSONSource | undefined;
    const refresh = async () => {
      controller?.abort();
      controller = null;
      const id = ++requestId;
      if (!showOpenHistoricalMap || !map.isStyleLoaded()) {
        source()?.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const bounds = map.getBounds();
      const west = Math.max(-180, bounds.getWest()), east = Math.min(180, bounds.getEast());
      const south = Math.max(-85, bounds.getSouth()), north = Math.min(85, bounds.getNorth());
      const area = (east - west) * (north - south);
      // Keep the live Overpass request bounded; zoom in before querying broad world regions.
      if (map.getZoom() < 2.2 || area > 2400) {
        source()?.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const abort = new AbortController();
      controller = abort;
      const bbox = `${south},${west},${north},${east}`;
      const query = `[out:json][timeout:25];(nwr["start_date"](${bbox});nwr["end_date"](${bbox}););out geom;`;
      try {
        const response = await fetch('https://overpass-api.openhistoricalmap.org/api/interpreter', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: `data=${encodeURIComponent(query)}`, signal: abort.signal,
        });
        if (!response.ok) throw new Error(`OpenHistoricalMap returned HTTP ${response.status}`);
        const payload = await response.json();
        if (id !== requestId || abort.signal.aborted) return;
        source()?.setData(overpassToGeoJson(payload, timelineYear));
      } catch (error) {
        if (!abort.signal.aborted) console.warn('OpenHistoricalMap historical layer unavailable:', error);
      }
    };
    map.on('moveend', refresh);
    void refresh();
    return () => { map.off('moveend', refresh); controller?.abort(); };
  }, [showOpenHistoricalMap, timelineYear]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.easeTo({ zoom: Math.max(0.85, Math.min(7, 1.25 + zoom * 0.55)), duration: 220 });
  }, [zoom]);

  return <div ref={hostRef} className="np-maplibre-earth" aria-label="Interactive 3D Earth map" />;
});

function overpassToGeoJson(payload: any, year: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const element of payload?.elements || []) {
    const tags = element.tags || {};
    const parseDate = (value: unknown): number | undefined => {
      if (typeof value !== 'string' && typeof value !== 'number') return undefined;
      const text = String(value);
      const match = text.match(/-?\d{1,6}/);
      if (!match) return undefined;
      const numeric = Number(match[0]);
      return /\b(?:BCE|BC)\b/i.test(text) ? -Math.abs(numeric) : numeric;
    };
    const start = parseDate(tags.start_date || tags.start || tags.inception);
    const end = parseDate(tags.end_date || tags.end || tags.disused);
    if ((start !== undefined && start > year) || (end !== undefined && end < year)) continue;
    let geometry: GeoJSON.Geometry | null = null;
    if (element.type === 'node' && Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
      geometry = { type: 'Point', coordinates: [element.lon, element.lat] };
    } else if (element.geometry?.length >= 2) {
      const coordinates = element.geometry.map((point: any) => [point.lon, point.lat]);
      const first = coordinates[0], last = coordinates[coordinates.length - 1];
      const closed = coordinates.length >= 4 && first[0] === last[0] && first[1] === last[1];
      geometry = closed ? { type: 'Polygon', coordinates: [coordinates] } : { type: 'LineString', coordinates };
    }
    if (!geometry) continue;
    features.push({ type: 'Feature', id: `${element.type}/${element.id}`, geometry, properties: { ...tags, osm_id: element.id, osm_type: element.type, name: tags.name || tags['name:en'] || `${element.type} ${element.id}` } });
  }
  return { type: 'FeatureCollection', features };
}

function updateImportedSource(map: MapLibreMap, data: GeoJSON.FeatureCollection | null, enabled: boolean, year: number) {
  const source = map.getSource('historicalImports') as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(enabled && data ? filterHistoricalGeoJson(data, year) : { type: 'FeatureCollection', features: [] });
}

function toFeatureCollection(points: EarthMapPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.lon, point.lat] },
      properties: { name: point.name, color: point.color || (point.isCity ? '#60a5fa' : '#facc15') },
    })),
  };
}
