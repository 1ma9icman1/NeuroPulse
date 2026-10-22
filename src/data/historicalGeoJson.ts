/** Shared GeoJSON normalization and year filtering for historical map imports. */
export function filterHistoricalGeoJson(collection: GeoJSON.FeatureCollection, year: number): GeoJSON.FeatureCollection {
  const features = collection.features.filter((feature) => {
    const properties = feature.properties || {};
    const readYear = (...keys: string[]) => {
      for (const key of keys) {
        const value = properties[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const match = value.match(/-?\d{1,6}/);
          if (match) return Number(match[0]);
        }
      }
      return undefined;
    };
    const start = readYear('start_year', 'startYear', 'start_date', 'startDate', 'from', 'valid_from', 'year', 'date');
    const end = readYear('end_year', 'endYear', 'end_date', 'endDate', 'to', 'valid_to');
    if (start !== undefined && start > year) return false;
    if (end !== undefined && end < year) return false;
    return true;
  });
  return { type: 'FeatureCollection', features };
}
