import type { CompassDir } from '@/lib/geo/haversine';

const DEG: Record<CompassDir, number> = {
  N: 0, NE: 45, E: 90, SE: 135,
  S: 180, SW: 225, W: 270, NW: 315,
};

interface Props {
  dir: CompassDir;
  size?: number;
  className?: string;
}

/**
 * Cartoon compass rose that rotates a two-tone needle toward the answer country.
 *
 * The face (circle, tick marks, "N" label) is fixed and never rotates.
 * Only the diamond needle inside the <g transform="rotate(…)"> rotates.
 * Red half points toward the answer; light-grey half points away.
 */
export default function CompassIcon({ dir, size = 32, className = '' }: Props) {
  const deg = DEG[dir];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-label={dir}
      className={`inline-block shrink-0 ${className}`}
    >
      {/* Compass face */}
      <circle cx="16" cy="16" r="15" fill="#f9fafb" stroke="#d1d5db" strokeWidth="1" />

      {/* Cardinal tick marks — fixed, do not rotate */}
      <line x1="16" y1="2"  x2="16" y2="5"  stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="27" x2="16" y2="30" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27" y1="16" x2="30" y2="16" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2"  y1="16" x2="5"  y2="16" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />

      {/* Rotating diamond needle */}
      <g transform={`rotate(${deg}, 16, 16)`}>
        {/* Red top half — points toward the answer country */}
        <polygon points="16,6 13,16 19,16" fill="#ef4444" />
        {/* Light-grey bottom half */}
        <polygon points="16,26 13,16 19,16" fill="#d1d5db" />
      </g>

      {/* Centre anchor pin — rendered above needle so it always shows */}
      <circle cx="16" cy="16" r="2.5" fill="#374151" />

      {/* "N" label — fixed, rendered last so it appears above the needle */}
      <text
        x="16"
        y="11.5"
        textAnchor="middle"
        fontSize="5"
        fontFamily="sans-serif"
        fontWeight="bold"
        fill="#374151"
      >
        N
      </text>
    </svg>
  );
}
