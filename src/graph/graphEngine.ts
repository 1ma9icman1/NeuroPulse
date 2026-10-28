export type KnowledgeEntityType = "site" | "star" | "civilization" | "event" | "language" | "geographic_feature";

export interface KnowledgeEntity {
  id: string;
  title: string;
  type: KnowledgeEntityType;
  latitude?: number;
  longitude?: number;
  category?: string;
  description?: string;
  sourceUrl?: string;
}

export type RelationshipType = "geographic_proximity" | "shared_category";

export interface KnowledgeRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  distanceKm?: number;
  confidence: number;
  status: "derived" | "documented";
  explanation: string;
}

export interface GraphSiteInput {
  id?: string | number;
  name: string;
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
  category?: string;
  desc?: string;
  sourceUrl?: string;
}

const toRadians = (value: number) => value * Math.PI / 180;

export function greatCircleDistanceKm(a: Pick<KnowledgeEntity, "latitude" | "longitude">, b: Pick<KnowledgeEntity, "latitude" | "longitude">): number | undefined {
  if (typeof a.latitude !== "number" || typeof a.longitude !== "number" ||
      typeof b.latitude !== "number" || typeof b.longitude !== "number") return undefined;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function buildKnowledgeEntities(sites: GraphSiteInput[]): KnowledgeEntity[] {
  const seen = new Set<string>();
  return sites.flatMap((site, index) => {
    const title = String(site.name ?? "").trim();
    if (!title) return [];
    const id = String(site.id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    if (seen.has(id)) return [];
    seen.add(id);
    const latitude = typeof site.lat === "number" ? site.lat : site.latitude;
    const longitude = typeof site.lon === "number" ? site.lon : site.longitude;
    return [{
      id, title, type: "site" as const,
      ...(typeof latitude === "number" ? { latitude } : {}),
      ...(typeof longitude === "number" ? { longitude } : {}),
      ...(site.category ? { category: site.category } : {}),
      ...(site.desc ? { description: site.desc } : {}),
      ...(site.sourceUrl ? { sourceUrl: site.sourceUrl } : {}),
    }];
  });
}

export function buildKnowledgeRelationships(entities: KnowledgeEntity[], maxDistanceKm = 250): KnowledgeRelationship[] {
  const relationships: KnowledgeRelationship[] = [];
  for (let i = 0; i < entities.length; i += 1) {
    for (let j = i + 1; j < entities.length; j += 1) {
      const a = entities[i];
      const b = entities[j];
      const distanceKm = greatCircleDistanceKm(a, b);
      if (distanceKm !== undefined && distanceKm <= maxDistanceKm) {
        relationships.push({
          id: `proximity:${a.id}:${b.id}`, sourceId: a.id, targetId: b.id,
          type: "geographic_proximity", distanceKm: Math.round(distanceKm * 10) / 10,
          confidence: 1, status: "derived",
          explanation: "Calculated from the two catalogue coordinates using great-circle distance. This is geographic proximity, not evidence of historical contact.",
        });
      }
      if (a.category && b.category && a.category.toLowerCase() === b.category.toLowerCase()) {
        relationships.push({
          id: `category:${a.id}:${b.id}`, sourceId: a.id, targetId: b.id,
          type: "shared_category", confidence: 1, status: "derived",
          explanation: `Both records are classified as “${a.category}”. Shared classification does not establish a historical relationship.`,
        });
      }
    }
  }
  return relationships;
}
