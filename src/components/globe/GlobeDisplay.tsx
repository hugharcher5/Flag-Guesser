'use client';

/**
 * 3-D interactive globe rendered with MapLibre GL JS's native globe
 * projection over real ESRI World Imagery satellite tiles.
 *
 * Design:
 *  - Only guessed countries are added as a GeoJSON fill layer (5–20 max);
 *    unguessed countries show through the satellite imagery untouched.
 *  - Rivers and lakes are deferred 3 s after mount (decorative, non-blocking).
 *  - Hover only fires for guessed polygons — used for the small-country magnifier.
 *
 * Post-guess animation:
 *  - focusCentroid triggers a 1-second flyTo to the guessed country (same zoom).
 *  - After the animation settles (1100 ms), onFocusComplete is called with the
 *    country's screen position so GlobeMode can auto-show the magnifier for small
 *    countries without any user hover interaction.
 */

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CountryGeometry } from '@/lib/geo/polygons';
import { SMALL_COUNTRY_CODES } from './MagnifyOverlay';
import { useMapLibreGlobe } from '../maplibre-globe/useMapLibreGlobe';

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
   * 1 000 ms while keeping the current zoom level.
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

const GUESSED_SOURCE = 'guessed-countries';
const GUESSED_FILL_LAYER = 'guessed-countries-fill';
const GUESSED_LINE_LAYER = 'guessed-countries-line';
const LAKES_SOURCE = 'lakes';
const LAKES_LAYER = 'lakes-fill';
const RIVERS_SOURCE = 'rivers';
const RIVERS_LAYER = 'rivers-line';

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobeDisplay({
  guessedPolygons,
  onCountryHover,
  focusCentroid,
  onFocusComplete,
  onGlobeMouseMove,
  height = 440,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [riverPaths, setRiverPaths] = useState<[number, number][][]>([]);
  const [lakeFeatures, setLakeFeatures] = useState<GeoFeature[]>([]);

  const onCountryHoverRef = useRef(onCountryHover);
  onCountryHoverRef.current = onCountryHover;
  const onFocusCompleteRef = useRef(onFocusComplete);
  onFocusCompleteRef.current = onFocusComplete;

  const { mapRef, ready } = useMapLibreGlobe(containerRef, {
    onPointerMove: onGlobeMouseMove,
  });

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
        .then(fc => setLakeFeatures(fc.features))
        .catch(() => { /* decorative */ });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

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

  const centroidByCode = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const f of countryFeatures) {
      m.set(f.properties.code as string, featureCentroid(f.geometry));
    }
    return m;
  }, [countryFeatures]);

  // ── Set up sources/layers once the map style has loaded ────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    map.addSource(GUESSED_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: GUESSED_FILL_LAYER,
      type: 'fill',
      source: GUESSED_SOURCE,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.75 },
    });
    map.addLayer({
      id: GUESSED_LINE_LAYER,
      type: 'line',
      source: GUESSED_SOURCE,
      paint: { 'line-color': 'rgba(255,255,255,0.35)', 'line-width': 1 },
    });

    map.addSource(LAKES_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: LAKES_LAYER,
      type: 'fill',
      source: LAKES_SOURCE,
      paint: { 'fill-color': '#4a90d9', 'fill-opacity': 0.85 },
    });

    map.addSource(RIVERS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: RIVERS_LAYER,
      type: 'line',
      source: RIVERS_SOURCE,
      paint: { 'line-color': '#4a90d9', 'line-width': 1 },
    });

    // ── Hover — fires only for guessed polygons (only ones in the source) ────
    const handleMouseMove = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const feat = e.features?.[0];
      const code = feat?.properties?.code as string | undefined;
      if (!code || !SMALL_COUNTRY_CODES.has(code)) {
        onCountryHoverRef.current(null, null);
        return;
      }
      const centroid = centroidByCode.get(code);
      if (!centroid) { onCountryHoverRef.current(null, null); return; }
      const pos = map.project(centroid);
      onCountryHoverRef.current(code, { x: pos.x, y: pos.y });
    };
    const handleMouseLeave = () => onCountryHoverRef.current(null, null);

    map.on('mousemove', GUESSED_FILL_LAYER, handleMouseMove);
    map.on('mouseleave', GUESSED_FILL_LAYER, handleMouseLeave);

    return () => {
      map.off('mousemove', GUESSED_FILL_LAYER, handleMouseMove);
      map.off('mouseleave', GUESSED_FILL_LAYER, handleMouseLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── Keep guessed-country fills in sync ──────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const source = mapRef.current.getSource(GUESSED_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: countryFeatures as never[] });
  }, [ready, mapRef, countryFeatures]);

  // ── Keep lakes/rivers in sync (deferred load) ───────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const source = mapRef.current.getSource(LAKES_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: lakeFeatures as never[] });
  }, [ready, mapRef, lakeFeatures]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const source = mapRef.current.getSource(RIVERS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    const features: GeoFeature[] = riverPaths.map(coords => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    }));
    source?.setData({ type: 'FeatureCollection', features: features as never[] });
  }, [ready, mapRef, riverPaths]);

  // ── Rotate to guessed country centroid after each guess ─────────────────────
  useEffect(() => {
    if (!focusCentroid || !ready || !mapRef.current) return;
    const map = mapRef.current;
    map.flyTo({ center: [focusCentroid.lng, focusCentroid.lat], zoom: map.getZoom(), duration: 1000 });

    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      const pos = mapRef.current.project([focusCentroid.lng, focusCentroid.lat]);
      onFocusCompleteRef.current({ x: pos.x, y: pos.y });
    }, 1100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCentroid, ready]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden"
      style={{ height, background: '#e8f4f8' }}
    />
  );
}
