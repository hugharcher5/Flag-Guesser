'use client';

import { useMemo } from 'react';
import type { CountryGeometry } from '@/lib/geo/polygons';
import { toSvgPath } from '@/lib/geo/project';

/** Alpha-2 codes of countries too small to be easily visible on the globe. */
export const SMALL_COUNTRY_CODES = new Set([
  'bh', 'bb', 'bn', 'km', 'cy', 'dj', 'dm', 'gd', 'ht', 'jm', 'kw',
  'lb', 'li', 'lu', 'mv', 'mt', 'mh', 'mc', 'nr', 'pw', 'kn', 'lc',
  'vc', 'ws', 'sm', 'st', 'sc', 'sg', 'sb', 'tl', 'to', 'tt', 'tv',
  'va', 'vu', 'fj', 'bs', 'ag', 'gw', 'gq', 'cv',
]);

interface Props {
  hoveredCode: string | null;
  /** Screen-space position of the country centroid on the globe canvas. */
  screenPos: { x: number; y: number } | null;
  polygons: Map<string, CountryGeometry>;
  /** code → hex color (from guesses). Absent = not yet guessed. */
  guessColors: Map<string, string>;
  guessDistances: Map<string, number>;
  countryNames: Map<string, string>;
}

const CIRCLE_R = 60;     // radius of the magnifier circle (px)
const OFFSET_X = 90;     // horizontal offset from country centroid
const OFFSET_Y = -90;    // vertical offset (negative = up)
const SVG_SIZE = 96;     // inner SVG viewport

export default function MagnifyOverlay({
  hoveredCode,
  screenPos,
  polygons,
  guessColors,
  guessDistances,
  countryNames,
}: Props) {
  const geom = hoveredCode ? polygons.get(hoveredCode) : null;
  const color = hoveredCode ? (guessColors.get(hoveredCode) ?? '#1e293b') : '#1e293b';
  const isGuessed = hoveredCode ? guessColors.has(hoveredCode) : false;
  const distKm = hoveredCode ? guessDistances.get(hoveredCode) : undefined;
  const name = hoveredCode ? (countryNames.get(hoveredCode) ?? '') : '';

  const svgPath = useMemo(() => {
    if (!geom) return '';
    return toSvgPath(geom, SVG_SIZE, SVG_SIZE, 6, hoveredCode ?? undefined);
  }, [geom, hoveredCode]);

  if (!hoveredCode || !screenPos || !geom) return null;

  // Circle centre position (offset from country centroid on canvas)
  const cx = screenPos.x + OFFSET_X;
  const cy = screenPos.y + OFFSET_Y;

  // Line endpoint: edge of circle closest to country centroid
  const dx = screenPos.x - cx;
  const dy = screenPos.y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const edgeX = cx + (dx / dist) * CIRCLE_R;
  const edgeY = cy + (dy / dist) * CIRCLE_R;

  // SVG line spans the entire canvas overlay; origin is top-left of container
  const lineViewW = Math.abs(cx - screenPos.x) + CIRCLE_R * 2 + 40;
  const lineViewH = Math.abs(cy - screenPos.y) + CIRCLE_R * 2 + 40;
  const lineLeft = Math.min(cx, screenPos.x) - 20;
  const lineTop = Math.min(cy, screenPos.y) - 20;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 20 }}
    >
      {/* Connecting line */}
      <svg
        style={{
          position: 'absolute',
          left: lineLeft,
          top: lineTop,
          width: lineViewW,
          height: lineViewH,
          overflow: 'visible',
        }}
      >
        <line
          x1={edgeX - lineLeft}
          y1={edgeY - lineTop}
          x2={screenPos.x - lineLeft}
          y2={screenPos.y - lineTop}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <circle
          cx={screenPos.x - lineLeft}
          cy={screenPos.y - lineTop}
          r="3"
          fill="rgba(255,255,255,0.9)"
        />
      </svg>

      {/* Magnifier circle */}
      <div
        style={{
          position: 'absolute',
          left: cx - CIRCLE_R,
          top: cy - CIRCLE_R,
          width: CIRCLE_R * 2,
          height: CIRCLE_R * 2,
        }}
      >
        {/* Circle background */}
        <div
          className="w-full h-full rounded-full shadow-xl border-2 border-white/80 overflow-hidden"
          style={{ background: '#f0f4f8' }}
        >
          {svgPath ? (
            <svg
              width={CIRCLE_R * 2}
              height={CIRCLE_R * 2}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            >
              <rect width={SVG_SIZE} height={SVG_SIZE} fill="#f0f4f8" />
              <path d={svgPath} fill={isGuessed ? color : '#94a3b8'} />
            </svg>
          ) : null}
        </div>

        {/* Country name + distance label below the circle */}
        <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
          <span
            className="block text-xs font-semibold px-2 py-0.5 rounded-full shadow"
            style={{ background: 'rgba(30,41,59,0.85)', color: '#fff' }}
          >
            {name}
          </span>
          {isGuessed && distKm !== undefined && (
            <span
              className="block text-xs mt-0.5 px-2 py-0.5 rounded-full shadow"
              style={{ background: 'rgba(30,41,59,0.7)', color: '#e2e8f0' }}
            >
              {distKm === 0 ? '< 1' : distKm.toLocaleString()} km
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
