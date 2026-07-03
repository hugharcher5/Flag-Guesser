'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';

interface PinPoint {
  lat: number;
  lng: number;
  color: string;
  size: number;
}

interface Props {
  guessPin: { lat: number; lng: number } | null;
  answerPin: { lat: number; lng: number } | null;
  onGlobeClick: (lat: number, lng: number) => void;
  focusCentroid: { lat: number; lng: number } | null;
  onFocusComplete?: () => void;
  height?: number;
}

export default function LandmarkGlobeDisplay({
  guessPin,
  answerPin,
  onGlobeClick,
  focusCentroid,
  onFocusComplete,
  height = 440,
}: Props) {
  const globeRef = useRef<GlobeMethods>(null!);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  const onFocusCompleteRef = useRef(onFocusComplete);
  onFocusCompleteRef.current = onFocusComplete;

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
    const timer = setTimeout(() => {
      onFocusCompleteRef.current?.();
    }, 1100);
    return () => clearTimeout(timer);
  }, [focusCentroid]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = globe.controls() as any;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    const canvas = globe.renderer().domElement;
    const stop = () => { controls.autoRotate = false; };
    canvas.addEventListener('mousedown', stop);
    canvas.addEventListener('touchstart', stop, { passive: true });
  }, []);

  const points: PinPoint[] = [];
  if (guessPin) points.push({ lat: guessPin.lat, lng: guessPin.lng, color: '#ef4444', size: 0.6 });
  if (answerPin) points.push({ lat: answerPin.lat, lng: answerPin.lng, color: '#22c55e', size: 0.6 });

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
        onGlobeClick={({ lat, lng }: { lat: number; lng: number }) => onGlobeClick(lat, lng)}
        pointsData={points}
        pointLat={(p: object) => (p as PinPoint).lat}
        pointLng={(p: object) => (p as PinPoint).lng}
        pointColor={(p: object) => (p as PinPoint).color}
        pointRadius={(p: object) => (p as PinPoint).size}
        pointAltitude={0.01}
        pointResolution={12}
      />
    </div>
  );
}
