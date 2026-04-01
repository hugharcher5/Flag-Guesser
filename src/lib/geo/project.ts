/**
 * Projects a country geometry to an SVG path string.
 *
 * Uses equirectangular (plate carrée) projection — maps longitude directly to
 * x and latitude to y (inverted). This is the standard choice for Worldle-style
 * games: shapes are recognisable, simple, and need no external library.
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

/**
 * Returns the rings to use for rendering.
 *
 * For Polygon geometries this is identical to returning all rings.
 *
 * For MultiPolygon geometries (countries that include distant overseas
 * territories — France, Netherlands, Spain, USA, …) we filter out
 * sub-polygons whose centroid is more than 72° away from the main territory
 * (the sub-polygon with the most outer-ring vertices).  This keeps nearby
 * islands (Alaska ~60°, Hawaii ~62°, Corsica ~9°, Azores ~20°, Svalbard ~14°)
 * while dropping far-flung territories (French Guiana ~70°, Réunion ~87°,
 * Martinique ~70°, Dutch Caribbean ~85°).
 *
 * The threshold only affects display; borderCalc.ts uses the raw geometry.
 */
const DISPLAY_THRESHOLD_DEG = 72;

function displayRings(geom: CountryGeometry): Coord[][] {
  if (geom.type === 'Polygon') {
    return (geom as PolygonGeometry).coordinates as Coord[][];
  }

  const polys = (geom as MultiPolygonGeometry).coordinates as Coord[][][];
  if (polys.length === 1) return polys[0] as Coord[][];

  // Find the main sub-polygon: the one with the most outer-ring vertices.
  let mainIdx = 0;
  for (let i = 1; i < polys.length; i++) {
    if (polys[i][0].length > polys[mainIdx][0].length) mainIdx = i;
  }

  const [mainLng, mainLat] = ringCentroid(polys[mainIdx][0]);
  const kept: Coord[][] = [];

  for (let i = 0; i < polys.length; i++) {
    if (i === mainIdx) {
      // Always keep the main territory (all its rings, including holes).
      for (const ring of polys[i]) kept.push(ring as Coord[]);
      continue;
    }

    const [rawLng, cLat] = ringCentroid(polys[i][0]);

    // Normalise longitude so the difference wraps correctly across ±180°.
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
 * antimeridian (±180°). Their GeoJSON coordinates span from a large negative
 * longitude (e.g. −170) to a positive one (e.g. 170), making the bounding
 * box appear to cover almost the whole globe.
 *
 * Fix: shift any negative longitude to lng + 360 so the geometry is
 * entirely in the 0–360 range and the bounding box is sensible.
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
 */
export function toSvgPath(
  geom: CountryGeometry,
  svgW: number,
  svgH: number,
  padding = 16,
): string {
  let rings = displayRings(geom);
  let box = computeBBox(rings);

  // Detect antimeridian crossing: bbox wider than 180°
  if (box.maxLng - box.minLng > 180) {
    rings = normaliseAntimeridian(rings);
    box = computeBBox(rings);
  }

  const geoW = box.maxLng - box.minLng;
  const geoH = box.maxLat - box.minLat;
  if (geoW === 0 || geoH === 0) return '';

  // Uniform scale that fits both dimensions within the padded area
  const drawW = svgW - padding * 2;
  const drawH = svgH - padding * 2;
  const scale = Math.min(drawW / geoW, drawH / geoH);

  // Centre the projected shape in the SVG
  const ox = (svgW - geoW * scale) / 2;
  const oy = (svgH - geoH * scale) / 2;

  const px = (lng: number) => ox + (lng - box.minLng) * scale;
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
