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
// For MultiPolygon countries only sub-polygons whose outer-ring centroid falls
// within this rectangle are rendered; everything outside is silently excluded.
//
// Two use-cases:
//  1. Territory exclusion — strips DOM-TOM / Canary Islands / sub-Antarctic
//     outliers so only the recognisable mainland shape is shown.
//  2. Archipelago zoom  — for island nations whose atolls span hundreds of
//     degrees, restrict the view to the main cluster so individual islands
//     are large enough to see.

const DISPLAY_BBOX: Record<string, readonly [number, number, number, number]> = {
  // ── Overseas territory exclusion ──────────────────────────────────────────
  fr: [-5.5,  10.0,  41.0,  52.5],
  pt: [-9.6,  -5.9,  36.5,  42.3],
  es: [-9.5,   4.5,  35.5,  44.0],

  // ── Archipelago zoom ──────────────────────────────────────────────────────
  ki: [172.0, 177.0,  -2.0,   2.0],
  fm: [137.0, 163.5,   5.0,  10.5],
  mh: [165.5, 172.5,   4.5,  14.7],
  sc: [ 55.0,  56.3,  -5.0,  -3.7],
  pw: [134.0, 134.8,   6.8,   7.8],
  mu: [ 57.2,  57.9, -20.6, -19.9],
  nz: [166.0, 178.6, -47.5, -34.0],
  za: [ 15.5,  33.0, -35.5, -21.5],
  // Tonga: keep only the 3 main island groups (Tongatapu, Ha'apai, Vava'u).
  // Drops Niuafo'ou (-15.6°S, far north) and 'Ata (-22.3°S/-176.2°E, far south)
  // which otherwise stretch the bbox to 8° and make all islands invisible.
  to: [-176.0, -173.5, -21.5, -18.3],
  // Tuvalu: 9 atolls in a north-south chain around 178°E.
  tv: [175.5, 180.5, -10.5,  -5.0],
};

// ── Single-polygon rendering (keep only largest sub-polygon) ─────────────────
//
// Countries whose GeoJSON MultiPolygon contains small inner islands that
// geographically sit *inside* the main territory. With evenodd fill these
// inner islands cancel the fill, creating visible holes.  Keeping only the
// dominant sub-polygon (by vertex count) removes them entirely.

const KEEP_MAIN_ONLY = new Set(['kz']);

// ── Dot-island rendering ──────────────────────────────────────────────────────
//
// For micro-archipelagos (Maldives, Marshall Islands, Micronesia, Tuvalu) the
// individual atolls are so small that projecting their coastlines produces
// sub-pixel shapes — or worse, distorted jagged spikes after any scaling.
//
// Instead, each sub-polygon is represented as a filled circle whose centre is
// the projected centroid of the original polygon ring.  The radius (in SVG px)
// is chosen so the dot pattern is legible at the game's 480×320 canvas.

const DOT_RENDER: Record<string, number> = {
  mv: 5,   // Maldives   — 176 atolls; small dots to avoid overcrowding
  mh: 7,   // Marshall Islands — 21 atolls
  fm: 8,   // Micronesia — 15 island groups; fewest count so largest dots
  tv: 7,   // Tuvalu — 9 atolls
};

// ── Threshold for the fallback distance-based sub-polygon filter ─────────────
const DISPLAY_THRESHOLD_DEG = 72;

/**
 * Returns only the OUTER rings of each sub-polygon selected for display.
 *
 * Inner rings (holes, at index ≥ 1 in each polygon) are always dropped so
 * the silhouette renders as a solid fill regardless of the SVG fill-rule.
 *
 * For MultiPolygon geometries:
 *  1. KEEP_MAIN_ONLY — return only the outer ring of the largest sub-polygon.
 *  2. DISPLAY_BBOX override — keep outer rings of sub-polygons whose centroid
 *     falls inside the rectangle.
 *  3. Distance-threshold fallback — keep outer rings within 72° of the main.
 */
function displayRings(geom: CountryGeometry, code?: string): Coord[][] {
  if (geom.type === 'Polygon') {
    // Outer ring only — drop any hole rings.
    return [(geom as PolygonGeometry).coordinates[0] as Coord[]];
  }

  const polys = (geom as MultiPolygonGeometry).coordinates as Coord[][][];
  if (polys.length === 1) return [polys[0][0] as Coord[]]; // outer ring only

  // ── KEEP_MAIN_ONLY path ──────────────────────────────────────────────────
  if (code && KEEP_MAIN_ONLY.has(code)) {
    let mainIdx = 0;
    for (let i = 1; i < polys.length; i++) {
      if (polys[i][0].length > polys[mainIdx][0].length) mainIdx = i;
    }
    return [polys[mainIdx][0] as Coord[]];
  }

  // ── DISPLAY_BBOX path ────────────────────────────────────────────────────
  const bboxOverride = code ? DISPLAY_BBOX[code] : undefined;
  if (bboxOverride) {
    const [minLng, maxLng, minLat, maxLat] = bboxOverride;
    const kept: Coord[][] = [];
    for (const poly of polys) {
      const [cLng, cLat] = ringCentroid(poly[0] as Coord[]);
      if (cLng >= minLng && cLng <= maxLng && cLat >= minLat && cLat <= maxLat) {
        kept.push(poly[0] as Coord[]); // outer ring only
      }
    }
    if (kept.length > 0) return kept;
  }

  // ── Distance-threshold path ───────────────────────────────────────────────
  let mainIdx = 0;
  for (let i = 1; i < polys.length; i++) {
    if (polys[i][0].length > polys[mainIdx][0].length) mainIdx = i;
  }

  const [mainLng, mainLat] = ringCentroid(polys[mainIdx][0]);
  const kept: Coord[][] = [];

  for (let i = 0; i < polys.length; i++) {
    const outerRing = polys[i][0] as Coord[];
    if (i === mainIdx) { kept.push(outerRing); continue; }

    const [rawLng, cLat] = ringCentroid(outerRing);
    let dLng = rawLng - mainLng;
    while (dLng > 180) dLng -= 360;
    while (dLng < -180) dLng += 360;

    if (Math.sqrt(dLng * dLng + (cLat - mainLat) ** 2) <= DISPLAY_THRESHOLD_DEG) {
      kept.push(outerRing);
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

/** SVG path string for a filled circle centred at (cx, cy) with radius r. */
function circlePath(cx: number, cy: number, r: number): string {
  const x = cx.toFixed(1), y = cy.toFixed(1), rs = r.toFixed(1);
  const d2r = (2 * r).toFixed(1);
  return `M${(cx - r).toFixed(1)},${y}a${rs},${rs} 0 1,0 ${d2r},0a${rs},${rs} 0 1,0 -${d2r},0Z`;
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

  if (geoW === 0 && geoH === 0) return '';

  const midLat = (box.minLat + box.maxLat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);
  const effectiveW = geoW * cosLat;

  const drawW = svgW - padding * 2;
  const drawH = svgH - padding * 2;

  const scaleX = effectiveW > 0 ? drawW / effectiveW : Infinity;
  const scaleY = geoH > 0 ? drawH / geoH : Infinity;
  const scale = isFinite(Math.min(scaleX, scaleY)) ? Math.min(scaleX, scaleY) : 0;
  if (scale <= 0) return '';

  const ox = (svgW - effectiveW * scale) / 2;
  const oy = (svgH - geoH * scale) / 2;

  const px = (lng: number) => ox + (lng - box.minLng) * cosLat * scale;
  const py = (lat: number) => oy + (box.maxLat - lat) * scale;

  // ── Dot-island rendering ─────────────────────────────────────────────────
  // For micro-archipelagos, draw each island as a filled circle at its
  // projected centroid instead of rendering the (sub-pixel) coastline.
  const dotR = code ? (DOT_RENDER[code] ?? 0) : 0;
  if (dotR > 0) {
    return rings
      .filter(ring => ring.length >= 3)
      .map(ring => {
        const [cLng, cLat] = ringCentroid(ring);
        return circlePath(px(cLng), py(cLat), dotR);
      })
      .join('');
  }

  // ── Normal coastline rendering ────────────────────────────────────────────
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
