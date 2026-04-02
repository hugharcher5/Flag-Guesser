'use client';

/**
 * 3-D interactive globe rendered with react-globe.gl (Three.js).
 *
 * Performance design:
 *  - polygonsData contains ONLY guessed countries (5–20 max), not all 196.
 *    Unguessed countries show through the terrain texture; no polygon overhead.
 *  - bumpImageUrl provides pseudo-3D terrain at near-zero cost vs displacement.
 *  - Rivers and lakes are deferred 3 s after mount (decorative, non-blocking).
 *  - Hover only fires for guessed polygons — used for the small-country magnifier.
 *
 * Post-guess animation:
 *  - focusCentroid triggers a 1-second pointOfView animation to the guessed country.
 *  - After the animation settles (1100 ms), onFocusComplete is called with the
 *    country's screen position so GlobeMode can auto-show the magnifier for small
 *    countries without any user hover interaction.
 */

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import type { CountryGeometry } from '@/lib/geo/polygons';
import { SMALL_COUNTRY_CODES } from './MagnifyOverlay';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GuessedPolygon {
  code: string;
  geom: CountryGeometry;
  color: string;
}

interface GeoFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

// ── Helper: centroid from a GeoJSON-like geometry ────────────────────────────

function featureCentroid(geom: GeoFeature['geometry']): [number, number] {
  let sumLng = 0, sumLat = 0, count = 0;
  const addRing = (ring: [number, number][]) => {
    for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat; count++; }
  };
  if (geom.type === 'Polygon') {
    addRing((geom.coordinates as [number, number][][])[0]);
  } else if (geom.type === 'MultiPolygon') {
    let best: [number, number][] = [];
    for (const poly of geom.coordinates as [number, number][][][]) {
      if (poly[0].length > best.length) best = poly[0];
    }
    addRing(best);
  }
  return count > 0 ? [sumLng / count, sumLat / count] : [0, 0];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Only the countries that have been guessed — keeps the polygon layer tiny. */
  guessedPolygons: GuessedPolygon[];
  onCountryHover: (code: string | null, pos: { x: number; y: number } | null) => void;
  /**
   * When set to a new object, the globe smoothly rotates to that lat/lng over
   * 1 000 ms while keeping the current zoom level (altitude).
   */
  focusCentroid: { lat: number; lng: number } | null;
  /**
   * Called 1 100 ms after a focusCentroid change (animation settled) with the
   * screen-space position of that point. Used to auto-position the magnifier.
   */
  onFocusComplete: (pos: { x: number; y: number }) => void;
  /**
   * Called on any mouse movement over the globe canvas. Used by GlobeMode to
   * dismiss the auto-shown magnifier when the user interacts with the globe.
   */
  onGlobeMouseMove: () => void;
  height?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobeDisplay({
  guessedPolygons,
  onCountryHover,
  focusCentroid,
  onFocusComplete,
  onGlobeMouseMove,
  height = 440,
}: Props) {
  const globeRef = useRef<GlobeMethods>(null!);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [riverPaths, setRiverPaths] = useState<[number, number][][]>([]);
  const [lakeFeatures, setLakeFeatures] = useState<GeoFeature[]>([]);

  // Keep stable refs to callbacks so event listeners never go stale
  const onFocusCompleteRef = useRef(onFocusComplete);
  onFocusCompleteRef.current = onFocusComplete;
  const onGlobeMouseMoveRef = useRef(onGlobeMouseMove);
  onGlobeMouseMoveRef.current = onGlobeMouseMove;

  // ── Responsive width ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    setWidth(el.offsetWidth);
    return () => obs.disconnect();
  }, []);

  // ── Deferred rivers + lakes (decorative, non-blocking) ─────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/rivers.geojson')
        .then(r => r.json() as Promise<FeatureCollection>)
        .then(fc => {
          const paths: [number, number][][] = [];
          for (const f of fc.features) {
            if (f.geometry.type === 'LineString') {
              paths.push(f.geometry.coordinates as [number, number][]);
            } else if (f.geometry.type === 'MultiLineString') {
              for (const seg of f.geometry.coordinates as [number, number][][]) {
                paths.push(seg);
              }
            }
          }
          setRiverPaths(paths);
        })
        .catch(() => { /* decorative; ignore */ });

      fetch('/lakes.geojson')
        .then(r => r.json() as Promise<FeatureCollection>)
        .then(fc => {
          setLakeFeatures(
            fc.features.map(f => ({
              ...f,
              properties: { ...f.properties, isLake: true },
            })),
          );
        })
        .catch(() => { /* decorative */ });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // ── Rotate to guessed country centroid after each guess ─────────────────────
  useEffect(() => {
    if (!focusCentroid) return;
    const globe = globeRef.current;
    if (!globe) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pov = globe.pointOfView() as any;
    globe.pointOfView(
      { lat: focusCentroid.lat, lng: focusCentroid.lng, altitude: pov?.altitude ?? 2.5 },
      1000,
    );

    // After animation settles, call back with the country's screen position
    const timer = setTimeout(() => {
      if (!globeRef.current) return;
      const pos = globeRef.current.getScreenCoords(focusCentroid.lat, focusCentroid.lng, 0);
      onFocusCompleteRef.current(pos);
    }, 1100);

    return () => clearTimeout(timer);
  }, [focusCentroid]);

  // ── Convert guessed countries to GeoJSON features ───────────────────────────
  const countryFeatures = useMemo<GeoFeature[]>(
    () =>
      guessedPolygons.map(({ code, geom, color }) => ({
        type: 'Feature',
        properties: { code, color },
        geometry: { type: geom.type, coordinates: geom.coordinates },
      })),
    [guessedPolygons],
  );

  const allPolygons = useMemo(
    () => [...countryFeatures, ...lakeFeatures],
    [countryFeatures, lakeFeatures],
  );

  // ── Color accessors — color is stored in feature.properties.color ───────────
  const getCapColor = useCallback((f: object) => {
    const feat = f as GeoFeature;
    if (feat.properties.isLake) return '#4a90d9';
    return (feat.properties.color as string) ?? 'rgba(0,0,0,0)';
  }, []);

  const getSideColor = useCallback((f: object) => {
    const feat = f as GeoFeature;
    if (feat.properties.isLake) return '#4a90d9';
    return (feat.properties.color as string) ?? 'rgba(0,0,0,0)';
  }, []);

  const getStrokeColor = useCallback((f: object) => {
    const feat = f as GeoFeature;
    if (feat.properties.isLake) return false as unknown as string;
    return 'rgba(255,255,255,0.35)';
  }, []);

  const getAltitude = useCallback((f: object) => {
    const feat = f as GeoFeature;
    return feat.properties.isLake ? 0.001 : 0.006;
  }, []);

  // ── Hover — fires only for guessed polygons (since they're the only ones in
  //   polygonsData). Check SMALL_COUNTRY_CODES to decide whether to show magnifier.
  const handlePolygonHover = useCallback(
    (f: object | null) => {
      if (!f) { onCountryHover(null, null); return; }
      const feat = f as GeoFeature;
      if (feat.properties.isLake) { onCountryHover(null, null); return; }
      const code = feat.properties.code as string | undefined;
      if (!code || !SMALL_COUNTRY_CODES.has(code)) { onCountryHover(null, null); return; }
      if (!globeRef.current) { onCountryHover(null, null); return; }
      const [lng, lat] = featureCentroid(feat.geometry);
      const pos = globeRef.current.getScreenCoords(lat, lng, 0);
      onCountryHover(code, pos);
    },
    [onCountryHover],
  );

  // ── Globe ready: auto-rotation + event listeners ────────────────────────────
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = globe.controls() as any;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;

    const canvas = globe.renderer().domElement;

    // Stop auto-rotation on interaction
    const stopRotation = () => { controls.autoRotate = false; };
    canvas.addEventListener('mousedown', stopRotation);
    canvas.addEventListener('touchstart', stopRotation, { passive: true });

    // Notify GlobeMode of any mouse movement (used to dismiss auto-shown magnifier)
    canvas.addEventListener(
      'mousemove',
      () => { onGlobeMouseMoveRef.current(); },
      { passive: true },
    );
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="w-full rounded-2xl overflow-hidden" style={{ height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl="/earth-day.jpg"
        bumpImageUrl="/earth-topology.png"
        onGlobeReady={handleGlobeReady}
        backgroundColor="#e8f4f8"
        showAtmosphere={false}
        // Guessed country fills + lake fills
        polygonsData={allPolygons}
        polygonCapColor={getCapColor}
        polygonSideColor={getSideColor}
        polygonStrokeColor={getStrokeColor}
        polygonAltitude={getAltitude}
        onPolygonHover={handlePolygonHover}
        // Rivers (deferred)
        pathsData={riverPaths}
        pathPoints={(p: object) => p as [number, number][]}
        pathPointLat={(pt: object) => (pt as [number, number])[1]}
        pathPointLng={(pt: object) => (pt as [number, number])[0]}
        pathColor={() => '#4a90d9'}
        pathStroke={0.3}
        pathDashLength={1}
        pathDashGap={0}
        pathTransitionDuration={0}
      />
    </div>
  );
}
