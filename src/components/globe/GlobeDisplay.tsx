'use client';

/**
 * 3-D interactive globe rendered with react-globe.gl (Three.js).
 *
 * Features:
 *  - earth-day.jpg colour texture + earth-topology.png displacement map
 *  - Country polygon fills coloured by heat-map distance
 *  - River paths and lake fills loaded from public/ GeoJSON files
 *  - Slow auto-rotation that stops on first user interaction
 *  - Hover callback for small-country magnifier
 */

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { CountryGeometry } from '@/lib/geo/polygons';
import { SMALL_COUNTRY_CODES } from './MagnifyOverlay';

// ── GeoJSON feature shapes ────────────────────────────────────────────────────

interface GeoFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Average [lng, lat] of all outer-ring vertices (for centroid hover position). */
function geomCentroid(geom: CountryGeometry): [number, number] {
  let sumLng = 0, sumLat = 0, count = 0;
  const addRing = (ring: [number, number][]) => {
    for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat; count++; }
  };
  if (geom.type === 'Polygon') {
    addRing(geom.coordinates[0] as [number, number][]);
  } else {
    let best: [number, number][] = [];
    for (const poly of geom.coordinates) {
      if (poly[0].length > best.length) best = poly[0] as [number, number][];
    }
    addRing(best);
  }
  return count > 0 ? [sumLng / count, sumLat / count] : [0, 0];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  polygons: Map<string, CountryGeometry>;
  /** code → hex color for guessed countries */
  guessColors: Map<string, string>;
  onCountryHover: (
    code: string | null,
    pos: { x: number; y: number } | null,
  ) => void;
  /** Height of the globe canvas in px */
  height?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobeDisplay({
  polygons,
  guessColors,
  onCountryHover,
  height = 440,
}: Props) {
  const globeRef = useRef<GlobeMethods>(null!);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [riverPaths, setRiverPaths] = useState<[number, number][][]>([]);
  const [lakeFeatures, setLakeFeatures] = useState<GeoFeature[]>([]);

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

  // ── Load rivers and lakes ───────────────────────────────────────────────────
  useEffect(() => {
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
      .catch(() => { /* rivers are decorative; ignore errors */ });

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
  }, []);

  // ── Build polygon feature array ─────────────────────────────────────────────
  const countryFeatures = useMemo<GeoFeature[]>(() => {
    const out: GeoFeature[] = [];
    polygons.forEach((geom, code) => {
      if (geom._dot) return;
      out.push({
        type: 'Feature',
        properties: { code },
        geometry: { type: geom.type, coordinates: geom.coordinates },
      });
    });
    return out;
  }, [polygons]);

  const allPolygons = useMemo(
    () => [...countryFeatures, ...lakeFeatures],
    [countryFeatures, lakeFeatures],
  );

  // ── Color accessors ─────────────────────────────────────────────────────────
  const getCapColor = useCallback(
    (f: object) => {
      const feat = f as GeoFeature;
      if (feat.properties.isLake) return '#4a90d9';
      const code = feat.properties.code as string | undefined;
      if (!code) return 'rgba(0,0,0,0)';
      return guessColors.get(code) ?? 'rgba(0,0,0,0)';
    },
    [guessColors],
  );

  const getSideColor = useCallback(
    (f: object) => {
      const feat = f as GeoFeature;
      if (feat.properties.isLake) return '#4a90d9';
      const code = feat.properties.code as string | undefined;
      if (!code) return 'rgba(0,0,0,0)';
      return guessColors.get(code) ?? 'rgba(0,0,0,0)';
    },
    [guessColors],
  );

  const getStrokeColor = useCallback((f: object) => {
    const feat = f as GeoFeature;
    if (feat.properties.isLake) return false as unknown as string;
    return 'rgba(255,255,255,0.20)';
  }, []);

  // ── Hover handler ───────────────────────────────────────────────────────────
  const handlePolygonHover = useCallback(
    (f: object | null) => {
      if (!f) {
        onCountryHover(null, null);
        return;
      }
      const feat = f as GeoFeature;
      if (feat.properties.isLake) {
        onCountryHover(null, null);
        return;
      }
      const code = feat.properties.code as string | undefined;
      if (!code || !SMALL_COUNTRY_CODES.has(code)) {
        onCountryHover(null, null);
        return;
      }
      const geom = polygons.get(code);
      if (!geom) { onCountryHover(null, null); return; }

      const [lng, lat] = geomCentroid(geom);
      if (!globeRef.current) { onCountryHover(null, null); return; }
      const pos = globeRef.current.getScreenCoords(lat, lng, 0);
      onCountryHover(code, pos);
    },
    [polygons, onCountryHover],
  );

  // ── Globe ready: displacement map + auto-rotation ───────────────────────────
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    // Auto-rotation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = globe.controls() as any;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;

    // Stop on interaction
    const canvas = globe.renderer().domElement;
    const stop = () => { controls.autoRotate = false; };
    canvas.addEventListener('mousedown', stop);
    canvas.addEventListener('touchstart', stop, { passive: true });

    // Find the globe sphere mesh for displacement
    const scene = globe.scene();
    let bestMesh: THREE.Mesh | null = null;
    let bestRadius = 0;

    scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.geometry.type !== 'SphereGeometry') return;
      const params = (mesh.geometry as THREE.SphereGeometry).parameters;
      if (params && params.radius > bestRadius) {
        bestRadius = params.radius;
        bestMesh = mesh;
      }
    });

    if (bestMesh) {
      const m = bestMesh as THREE.Mesh;
      const r = bestRadius;

      // Increase vertex count so displacement has enough geometry
      m.geometry.dispose();
      m.geometry = new THREE.SphereGeometry(r, 200, 200);

      // Apply topology displacement
      new THREE.TextureLoader().load('/earth-topology.png', texture => {
        const mat = m.material;
        if (Array.isArray(mat)) return;
        const phong = mat as THREE.MeshPhongMaterial;
        phong.displacementMap = texture;
        phong.displacementScale = 18;
        phong.shininess = 15;
        phong.needsUpdate = true;
      });
    }
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="w-full rounded-2xl overflow-hidden" style={{ height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl="/earth-day.jpg"
        onGlobeReady={handleGlobeReady}
        backgroundColor="#e8f4f8"
        showAtmosphere={false}
        // Countries + lakes
        polygonsData={allPolygons}
        polygonCapColor={getCapColor}
        polygonSideColor={getSideColor}
        polygonStrokeColor={getStrokeColor}
        polygonAltitude={0.006}
        onPolygonHover={handlePolygonHover}
        // Rivers
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
