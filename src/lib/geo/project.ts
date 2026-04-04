/**
 * Projects a country geometry to an SVG path string.
 *
 * Uses a latitude-corrected equirectangular projection:
 *  - Longitude is scaled by cos(midLat) before fitting to the canvas.
 *    At the equator cos(0°) = 1 → no change.  At 65°N cos(65°) ≈ 0.42 →
 *    the east-west axis is compressed, preventing the horizontal squash
 *    visible on flat maps for Iceland, Russia, Canada, Scandinavia, etc.
 *  - Latitude is projected linearly (plate carrée on the y-axis only).
 *
 * Per-country display-bbox overrides clip which sub-polygons are rendered,
 * used to (a) exclude distant overseas territories from France / Portugal /
 * Spain, and (b) zoom the view into the main island cluster of scattered
 * archipelagos such as Kiribati, Seychelles, and Palau.
 *
 * Handles antimeridian-crossing geometries (Russia, Kiribati, Fiji, …) by
 * normalising negative longitudes to the 0–360 range before projecting.
 */

import type { CountryGeometry, PolygonGeometry, MultiPolygonGeometry } from './polygons';

type Coord = [number, number]; // [lng, lat]

interface BBox {
  minLng: number; maxLng: number;
  minLat: number; maxLat: number;
}

/** Average [lng, lat] of a ring's vertices. */
function ringCentroid(ring: Coord[]): Coord {
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat; }
  return [sumLng / ring.length, sumLat / ring.length];
}

// ── Per-country display-bbox overrides ───────────────────────────────────────
//
// Format: [minLng, maxLng, minLat, maxLat]
//
// For MultiPolygon countries only sub-polygons whose centroid falls within
// this rectangle are rendered; everything else is silently excluded.
//
// Two use-cases:
//  1. Territory exclusion — strips DOM-TOM / Canary Islands / sub-Antarctic
//     outliers so only the recognisable mainland shape is shown.
//  2. Archipelago zoom  — for island nations whose atolls span hundreds of
//     degrees, restrict the view to the main cluster so individual islands
//     are large enough to see.

const DISPLAY_BBOX: Record<string, readonly [number, number, number, number]> = {
  // ── Overseas territory exclusion ──────────────────────────────────────────
  // France: metropolitan mainland + Corsica; strips Martinique, Guadeloupe,
  //         French Guiana, Réunion, Mayotte, New Caledonia, etc.
  fr: [-5.5,  10.0,  41.0,  52.5],
  // Portugal: mainland only; strips Azores (~-28°E) and Madeira (~-17°E).
  pt: [-9.6,  -5.9,  36.5,  42.3],
  // Spain: mainland + Balearic Islands; strips Canary Islands (~-18°E, 28°N).
  es: [-9.5,   4.5,  35.5,  44.0],

  // ── Archipelago zoom ──────────────────────────────────────────────────────
  // Kiribati spans from Gilberts (173°E) to Line Islands (−157°E = 203° after
  // normalisation) — 30° wide after antimeridian fix, but most of that is
  // empty ocean. Zoom to the Gilbert Islands where the capital Tarawa sits.
  ki: [172.0, 177.0,  -2.0,   2.0],
  // Micronesia: four island groups spread across 25° of longitude. Restrict
  // to the main group extents so the states are large enough to see.
  fm: [137.0, 163.5,   5.0,  10.5],
  // Marshall Islands: two parallel atoll chains over a 7°×10° box; keep full
  // extent but provide explicit bbox so future sub-polygon tweaks are easy.
  mh: [165.5, 172.5,   4.5,  14.7],
  // Seychelles: inner granitic islands (Mahé, Praslin, La Digue); strips the
  // distant Aldabra, Farquhar, and Amirantes groups 10° away.
  sc: [ 55.0,  56.3,  -5.0,  -3.7],
  // Palau: main island group; strips the remote Southwest Islands 200 km away.
  pw: [134.0, 134.8,   6.8,   7.8],
  // Mauritius: main island only; strips Rodrigues (~63.4°E) and Agaléga (~56.6°E).
  mu: [ 57.2,  57.9, -20.6, -19.9],
  // New Zealand: main North + South + Stewart islands; strips Chatham Islands
  // (~-176°E = 184° after normalisation) and sub-Antarctic islands (~-52°S).
  nz: [166.0, 178.6, -47.5, -34.0],
  // South Africa: mainland; strips the Prince Edward / Marion Islands (~-47°S)
  // which pull the bounding box 12° south and shrink the mainland render.
  za: [ 15.5,  33.0, -35.5, -21.5],
};

// ── Threshold for the fallback distance-based sub-polygon filter ─────────────
const DISPLAY_THRESHOLD_DEG = 72;

/**
 * Returns the coordinate rings to use for rendering.
 *
 * For Polygon geometries this is all rings unchanged.
 *
 * For MultiPolygon geometries:
 *  1. If a DISPLAY_BBOX override exists for `code`, keep only sub-polygons
 *     whose outer-ring centroid falls inside that rectangle.
 *  2. Otherwise fall back to the original distance-threshold filter that
 *     removes sub-polygons more than 72° from the main territory.
 */
function displayRings(geom: CountryGeometry, code?: string): Coord[][] {
  if (geom.type === 'Polygon') {
    return (geom as PolygonGeometry).coordinates as Coord[][];
  }

  const polys = (geom as MultiPolygonGeometry).coordinates as Coord[][][];
  if (polys.length === 1) return polys[0] as Coord[][];

  // ── DISPLAY_BBOX path ────────────────────────────────────────────────────
  const bboxOverride = code ? DISPLAY_BBOX[code] : undefined;
  if (bboxOverride) {
    const [minLng, maxLng, minLat, maxLat] = bboxOverride;
    const kept: Coord[][] = [];
    for (const poly of polys) {
      const [cLng, cLat] = ringCentroid(poly[0] as Coord[]);
      if (cLng >= minLng && cLng <= maxLng && cLat >= minLat && cLat <= maxLat) {
        for (const ring of poly) kept.push(ring as Coord[]);
      }
    }
    if (kept.length > 0) return kept;
    // If nothing matched (e.g. bbox too tight), fall through to distance filter
  }

  // ── Distance-threshold path (original logic) ─────────────────────────────
  // Find the main sub-polygon: the one with the most outer-ring vertices.
  let mainIdx = 0;
  for (let i = 1; i < polys.length; i++) {
    if (polys[i][0].length > polys[mainIdx][0].length) mainIdx = i;
  }

  const [mainLng, mainLat] = ringCentroid(polys[mainIdx][0]);
  const kept: Coord[][] = [];

  for (let i = 0; i < polys.length; i++) {
    if (i === mainIdx) {
      for (const ring of polys[i]) kept.push(ring as Coord[]);
      continue;
    }

    const [rawLng, cLat] = ringCentroid(polys[i][0]);

    // Normalise longitude difference so it wraps correctly across ±180°.
    let dLng = rawLng - mainLng;
    while (dLng > 180) dLng -= 360;
    while (dLng < -180) dLng += 360;

    const dist = Math.sqrt(dLng * dLng + (cLat - mainLat) ** 2);
    if (dist <= DISPLAY_THRESHOLD_DEG) {
      for (const ring of polys[i]) kept.push(ring as Coord[]);
    }
  }

  return kept;
}

function computeBBox(rings: Coord[][]): BBox {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLng, maxLng, minLat, maxLat };
}

/**
 * Countries like Russia, Kiribati, and Fiji have polygons that cross the
 * antimeridian (±180°). Fix by shifting any negative longitude to lng + 360
 * so the geometry is entirely in the 0–360 range.
 */
function normaliseAntimeridian(rings: Coord[][]): Coord[][] {
  return rings.map(ring =>
    ring.map(([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat] as Coord),
  );
}

/**
 * Converts a country geometry to an SVG path `d` attribute string.
 *
 * @param geom    The country's GeoJSON-like geometry.
 * @param svgW    SVG viewport width in pixels.
 * @param svgH    SVG viewport height in pixels.
 * @param padding Internal padding in pixels (keeps shapes away from the edge).
 * @param code    ISO alpha-2 country code; enables per-country overrides.
 */
export function toSvgPath(
  geom: CountryGeometry,
  svgW: number,
  svgH: number,
  padding = 16,
  code?: string,
): string {
  let rings = displayRings(geom, code);
  let box = computeBBox(rings);

  // Detect antimeridian crossing: bbox wider than 180°
  if (box.maxLng - box.minLng > 180) {
    rings = normaliseAntimeridian(rings);
    box = computeBBox(rings);
  }

  const geoW = box.maxLng - box.minLng;
  const geoH = box.maxLat - box.minLat;

  // Degenerate: geometry is a true point — nothing to draw.
  if (geoW === 0 && geoH === 0) return '';

  // ── Latitude cosine correction ────────────────────────────────────────────
  // In the equirectangular projection 1° of longitude spans the same pixel
  // distance as 1° of latitude regardless of where on the globe we are.
  // At high latitudes this makes countries look too wide: at 65°N a degree of
  // longitude covers only cos(65°) ≈ 0.42× the east-west distance of a degree
  // of latitude.  Multiplying the longitude scale by cos(midLat) corrects for
  // this so the rendered shape matches what people recognise from world maps.
  const midLat = (box.minLat + box.maxLat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);

  // Effective east-west extent after correction (may be 0 for countries with
  // all points at the same longitude, e.g. a vertical chain of islands).
  const effectiveW = geoW * cosLat;

  const drawW = svgW - padding * 2;
  const drawH = svgH - padding * 2;

  // Compute scale; guard against zero-extent in either dimension.
  const scaleX = effectiveW > 0 ? drawW / effectiveW : Infinity;
  const scaleY = geoH > 0 ? drawH / geoH : Infinity;
  const scale = isFinite(Math.min(scaleX, scaleY)) ? Math.min(scaleX, scaleY) : 0;
  if (scale <= 0) return '';

  // Centre the projected shape in the SVG
  const ox = (svgW - effectiveW * scale) / 2;
  const oy = (svgH - geoH * scale) / 2;

  // Project: longitude gets the cosine correction applied; latitude is linear.
  const px = (lng: number) => ox + (lng - box.minLng) * cosLat * scale;
  // SVG y-axis grows downward; latitude grows upward → flip
  const py = (lat: number) => oy + (box.maxLat - lat) * scale;

  return rings
    .filter(ring => ring.length >= 3)
    .map(ring => {
      const [x0, y0] = [px(ring[0][0]), py(ring[0][1])];
      const rest = ring
        .slice(1)
        .map(([lng, lat]) => `L${px(lng).toFixed(1)},${py(lat).toFixed(1)}`)
        .join('');
      return `M${x0.toFixed(1)},${y0.toFixed(1)}${rest}Z`;
    })
    .join('');
}
