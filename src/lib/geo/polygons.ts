/**
 * Loads pre-built country polygon data from /countryPolygons.json (served from public/).
 * The file is generated once by `node scripts/buildPolygons.mjs` and committed to the repo.
 * It maps ISO 3166-1 alpha-2 codes → GeoJSON-like geometries (WGS84, [lng, lat] order).
 *
 * _dot: true marks countries that lack a real polygon (centroid placeholder only).
 * These are excluded from the answer pool but remain valid as guesses.
 */

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: [number, number][][]; // rings of [lng, lat] pairs
  _dot?: true;
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: [number, number][][][]; // polygons → rings → [lng, lat] pairs
  _dot?: true;
}

export type CountryGeometry = PolygonGeometry | MultiPolygonGeometry;

let cache: Map<string, CountryGeometry> | null = null;

export async function getCountryPolygons(): Promise<Map<string, CountryGeometry>> {
  if (cache) return cache;

  const res = await fetch('/countryPolygons.json');
  if (!res.ok) throw new Error(`Failed to fetch polygon data (${res.status})`);

  const raw = (await res.json()) as Record<string, CountryGeometry>;
  cache = new Map(Object.entries(raw));
  return cache;
}
