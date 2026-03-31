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

/** Flatten all rings from a geometry (outer + inner, for correct evenodd fill). */
function allRings(geom: CountryGeometry): Coord[][] {
  if (geom.type === 'Polygon') {
    return (geom as PolygonGeometry).coordinates as Coord[][];
  }
  return ((geom as MultiPolygonGeometry).coordinates as Coord[][][]).flat();
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
  let rings = allRings(geom);
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
