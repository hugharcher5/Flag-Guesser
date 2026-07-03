'use client';

import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapLibreGlobe } from '../maplibre-globe/useMapLibreGlobe';

interface Props {
  guessPin: { lat: number; lng: number } | null;
  answerPin: { lat: number; lng: number } | null;
  onGlobeClick: (lat: number, lng: number) => void;
  focusCentroid: { lat: number; lng: number } | null;
  onFocusComplete?: () => void;
  height?: number;
}

function makePinEl(color: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = '18px';
  el.style.height = '18px';
  el.style.borderRadius = '50%';
  el.style.background = color;
  el.style.border = '2px solid white';
  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.5)';
  return el;
}

export default function LandmarkGlobeDisplay({
  guessPin,
  answerPin,
  onGlobeClick,
  focusCentroid,
  onFocusComplete,
  height = 440,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const guessMarkerRef = useRef<maplibregl.Marker | null>(null);
  const answerMarkerRef = useRef<maplibregl.Marker | null>(null);

  const onGlobeClickRef = useRef(onGlobeClick);
  onGlobeClickRef.current = onGlobeClick;
  const onFocusCompleteRef = useRef(onFocusComplete);
  onFocusCompleteRef.current = onFocusComplete;

  const { mapRef, ready } = useMapLibreGlobe(containerRef);

  // ── Click-to-place pin ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      onGlobeClickRef.current(e.lngLat.lat, e.lngLat.lng);
    };
    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [ready, mapRef]);

  // ── Guess pin (red) ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!guessPin) {
      guessMarkerRef.current?.remove();
      guessMarkerRef.current = null;
      return;
    }
    if (!guessMarkerRef.current) {
      guessMarkerRef.current = new maplibregl.Marker({ element: makePinEl('#ef4444') });
    }
    guessMarkerRef.current.setLngLat([guessPin.lng, guessPin.lat]).addTo(mapRef.current);
  }, [ready, mapRef, guessPin]);

  // ── Answer pin (green) ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!answerPin) {
      answerMarkerRef.current?.remove();
      answerMarkerRef.current = null;
      return;
    }
    if (!answerMarkerRef.current) {
      answerMarkerRef.current = new maplibregl.Marker({ element: makePinEl('#22c55e') });
    }
    answerMarkerRef.current.setLngLat([answerPin.lng, answerPin.lat]).addTo(mapRef.current);
  }, [ready, mapRef, answerPin]);

  // ── Rotate to true location after a guess is confirmed ──────────────────────
  useEffect(() => {
    if (!focusCentroid || !ready || !mapRef.current) return;
    const map = mapRef.current;
    map.flyTo({ center: [focusCentroid.lng, focusCentroid.lat], zoom: map.getZoom(), duration: 1000 });

    const timer = setTimeout(() => {
      onFocusCompleteRef.current?.();
    }, 1100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCentroid, ready]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden"
      style={{ height, background: '#e8f4f8' }}
    />
  );
}
