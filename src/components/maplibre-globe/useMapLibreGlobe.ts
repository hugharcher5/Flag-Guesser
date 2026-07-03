'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { globeStyle } from './globeStyle';

interface UseMapLibreGlobeOptions {
  /** [lng, lat] */
  initialCenter?: [number, number];
  initialZoom?: number;
  autoRotateDegPerSec?: number;
  /** Fired once, the first time the user actually drags/zooms/rotates the globe. */
  onInteractionStart?: () => void;
  /** Fired on every pointer move over the canvas. */
  onPointerMove?: () => void;
}

/**
 * Owns a single MapLibre GL map instance rendered with globe projection over
 * real satellite tiles. Handles create/destroy, gentle ambient auto-rotation
 * (stopped permanently on first user gesture), and forwards pointer-move for
 * UI that needs to dismiss overlays on interaction.
 */
export function useMapLibreGlobe(
  containerRef: RefObject<HTMLDivElement | null>,
  {
    initialCenter = [10, 15],
    initialZoom = 1.1,
    autoRotateDegPerSec = 3,
    onInteractionStart,
    onPointerMove,
  }: UseMapLibreGlobeOptions = {},
) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  const callbacksRef = useRef({ onInteractionStart, onPointerMove });
  callbacksRef.current = { onInteractionStart, onPointerMove };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: globeStyle,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: { compact: true },
      dragRotate: true,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;
    map.once('load', () => setReady(true));

    // ── Gentle ambient auto-rotation, stops the first time the user touches it ──
    let autoRotating = true;
    let rafId = 0;
    let lastTime = performance.now();
    const spin = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      if (autoRotating) {
        const center = map.getCenter();
        map.jumpTo({ center: [center.lng + autoRotateDegPerSec * dt, center.lat] });
      }
      rafId = requestAnimationFrame(spin);
    };
    rafId = requestAnimationFrame(spin);

    const stopAutoRotate = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return; // ignore our own programmatic camera moves
      if (autoRotating) {
        autoRotating = false;
        callbacksRef.current.onInteractionStart?.();
      }
    };
    map.on('dragstart', stopAutoRotate);
    map.on('zoomstart', stopAutoRotate);
    map.on('rotatestart', stopAutoRotate);

    const canvas = map.getCanvas();
    const handlePointerMove = () => callbacksRef.current.onPointerMove?.();
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchstart', handlePointerMove, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('touchstart', handlePointerMove);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mapRef, ready };
}
