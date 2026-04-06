'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import type { CountryGeometry } from '@/lib/geo/polygons';
import { toSvgPath } from '@/lib/geo/project';
import { SILHOUETTE_PATHS } from '@/lib/geo/silhouettePaths';

const SVG_W = 480;
const SVG_H = 320;

/**
 * Countries that have pre-extracted high-detail SVG silhouette files
 * in /public/silhouettes/.  Two variants per country:
 *   {code}.svg      — dark fill (#1e293b)
 *   {code}_blue.svg — blue fill (#3b82f6)
 */
export const IMAGE_SILHOUETTES = new Set([
  'mc', 'va', 'nr', 'sg', 'sm', 'mh', 'mv', 'fm', 'tv',
]);

interface Props {
  geometry: CountryGeometry | null;
  /** ISO alpha-2 code — enables per-country projection overrides. */
  code?: string;
  /** If true the silhouette is shown in blue (answer-revealed state). */
  revealed?: boolean;
  label?: string;
}

export default function SilhouetteDisplay({
  geometry,
  code,
  revealed = false,
  label,
}: Props) {
  const useImage = !!(code && IMAGE_SILHOUETTES.has(code));

  // Always call hooks unconditionally (React rules of hooks)
  const pathData = useMemo(() => {
    if (useImage) return '';
    if (code && SILHOUETTE_PATHS[code]) return SILHOUETTE_PATHS[code];
    return geometry ? toSvgPath(geometry, SVG_W, SVG_H, 16, code) : '';
  }, [geometry, code, useImage]);

  const fillColor = revealed ? '#3b82f6' : '#1e293b';
  const wrapper =
    'w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white flex items-center justify-center min-h-48 sm:min-h-56';

  // ── High-detail SVG image files ──────────────────────────────────────────
  if (useImage) {
    const src = revealed
      ? `/silhouettes/${code}_blue.svg`
      : `/silhouettes/${code}.svg`;

    return (
      <div className={wrapper}>
        {!geometry ? (
          <div className="w-full h-48 sm:h-56 bg-gray-100 animate-pulse" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label ?? 'Country silhouette'}
            className="w-full max-h-64 sm:max-h-80 object-contain"
          />
        )}
      </div>
    );
  }

  // ── Polygon-based inline SVG path ────────────────────────────────────────
  return (
    <div className={wrapper}>
      {!geometry ? (
        <div className="w-full h-48 sm:h-56 bg-gray-100 animate-pulse" />
      ) : (
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full max-h-64 sm:max-h-80"
          aria-label={label ?? 'Country silhouette'}
        >
          <path d={pathData} fill={fillColor} fillRule="evenodd" />
        </svg>
      )}
    </div>
  );
}
