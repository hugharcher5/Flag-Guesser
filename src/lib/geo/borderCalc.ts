/**
 * Nearest-border distance and direction between two country geometries.
 *
 * Algorithm: vertex-to-vertex minimum distance across all outer rings.
 * Dense rings are subsampled to keep worst-case calculation fast
 * (e.g. Russia vs Canada: ~800 × 800 = 640 000 Haversine calls ≈ 30–60 ms).
 *
 * Accuracy: within ~25 km of the true nearest-border distance for 50m-resolution
 * data. Sufficient for a game; no external library required.
 */

import type { CountryGeometry, PolygonGeometry, MultiPolygonGeometry } from './polygons';
import { haversineKm, bearingDeg, snapToCompass, type CompassDir } from './haversine';

type Coord = [number, number]; // [lng, lat]

const MAX_PER_RING = 200; // max vertices sampled per ring
const GLOBAL_CAP = 800;   // max total vertices per country

/** Extract outer-ring vertices from all sub-polygons, with subsampling. */
function outerVertices(geom: CountryGeometry): Coord[] {
  const out: Coord[] = [];

  const addRing = (ring: Coord[]) => {
    if (ring.length <= MAX_PER_RING) {
      for (const c of ring) out.push(c);
    } else {
      const step = ring.length / MAX_PER_RING;
      for (let i = 0; i < MAX_PER_RING; i++) out.push(ring[Math.floor(i * step)]);
    }
  };

  if (geom.type === 'Polygon') {
    addRing((geom as PolygonGeometry).coordinates[0]);
  } else {
    for (const poly of (geom as MultiPolygonGeometry).coordinates) addRing(poly[0]);
  }

  // Global cap: subsample the merged list if still too long
  if (out.length > GLOBAL_CAP) {
    const step = out.length / GLOBAL_CAP;
    return Array.from({ length: GLOBAL_CAP }, (_, i) => out[Math.floor(i * step)]);
  }
  return out;
}

export interface BorderResult {
  distanceKm: number;
  compassDir: CompassDir;
}

/**
 * Returns the nearest-border distance (km) and the compass direction
 * from the nearest point on `guessed`'s border to the nearest point
 * on `answer`'s border.
 */
export function calcBorderDistance(
  guessed: CountryGeometry,
  answer: CountryGeometry,
): BorderResult {
  const vGuessed = outerVertices(guessed);
  const vAnswer = outerVertices(answer);

  let minDist = Infinity;
  let nearGuessed: Coord = vGuessed[0];
  let nearAnswer: Coord = vAnswer[0];

  for (const a of vGuessed) {
    for (const b of vAnswer) {
      const d = haversineKm(a[1], a[0], b[1], b[0]);
      if (d < minDist) {
        minDist = d;
        nearGuessed = a;
        nearAnswer = b;
      }
    }
  }

  return {
    distanceKm: Math.round(minDist),
    compassDir: snapToCompass(
      bearingDeg(nearGuessed[1], nearGuessed[0], nearAnswer[1], nearAnswer[0]),
    ),
  };
}
