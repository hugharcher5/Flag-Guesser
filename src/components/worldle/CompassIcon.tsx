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
 * Small arrow icon that rotates to point in one of the 8 compass directions.
 * The arrow is drawn pointing up (North) and rotated via CSS transform.
 */
export default function CompassIcon({ dir, size = 18, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ transform: `rotate(${DEG[dir]}deg)` }}
      aria-label={dir}
      className={`inline-block shrink-0 ${className}`}
    >
      {/* Arrow pointing upward (North); rotated by DEG[dir] */}
      <path d="M12 3 L17 19 L12 15.5 L7 19 Z" />
    </svg>
  );
}
