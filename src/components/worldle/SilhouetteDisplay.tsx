'use client';

import { useMemo } from 'react';
import type { CountryGeometry } from '@/lib/geo/polygons';
import { toSvgPath } from '@/lib/geo/project';

const SVG_W = 480;
const SVG_H = 320;

interface Props {
  geometry: CountryGeometry | null;
  /** ISO alpha-2 code — enables per-country projection overrides. */
  code?: string;
  /** If true the silhouette is shown in blue (answer-revealed state). */
  revealed?: boolean;
  label?: string;
}

/**
 * Renders a country silhouette as an inline SVG.
 * Uses a latitude-corrected equirectangular projection so high-latitude
 * countries (Iceland, Russia, Canada, etc.) render without horizontal stretch.
 */
export default function SilhouetteDisplay({ geometry, code, revealed = false, label }: Props) {
  // Recompute path only when the geometry or code changes
  const pathData = useMemo(
    () => (geometry ? toSvgPath(geometry, SVG_W, SVG_H, 16, code) : ''),
    [geometry, code],
  );

  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white flex items-center justify-center min-h-48 sm:min-h-56">
      {!geometry ? (
        <div className="w-full h-48 sm:h-56 bg-gray-100 animate-pulse" />
      ) : (
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full max-h-64 sm:max-h-80"
          aria-label={label ?? 'Country silhouette'}
        >
          <path
            d={pathData}
            fill={revealed ? '#3b82f6' : '#1e293b'}
            fillRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
}
