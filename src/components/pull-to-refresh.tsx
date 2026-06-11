// src/components/pull-to-refresh.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const PULL_THRESHOLD = 65;
const MAX_PULL       = 100;

// SVG arc geometry
const SIZE         = 44;
const CX           = SIZE / 2;
const RADIUS       = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 106.8

export function PullToRefresh() {
  const queryClient = useQueryClient();
  const [pullY,      setPullY]      = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef     = useRef<number | null>(null);
  const pullYRef      = useRef(0);
  const refreshingRef = useRef(false);

  const doRefresh = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshing(true);
    setPullY(0);
    pullYRef.current = 0;

    await queryClient.invalidateQueries();
    await new Promise<void>(r => setTimeout(r, 800));

    refreshingRef.current = false;
    setRefreshing(false);
  }, [queryClient]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || window.scrollY > 0) return;
      startYRef.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshingRef.current) return;
      if (window.scrollY > 0) { startYRef.current = null; return; }

      const raw = e.touches[0].clientY - startYRef.current;
      if (raw <= 0) { pullYRef.current = 0; setPullY(0); return; }

      const dist = Math.min(raw * 0.45, MAX_PULL);
      pullYRef.current = dist;
      setPullY(dist);
      if (raw > 8) e.preventDefault();
    };

    const onEnd = () => {
      if (startYRef.current === null) return;
      startYRef.current = null;
      if (pullYRef.current >= PULL_THRESHOLD && !refreshingRef.current) {
        doRefresh();
      } else if (!refreshingRef.current) {
        pullYRef.current = 0;
        setPullY(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove',  onMove,  { passive: false });
    window.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove',  onMove);
      window.removeEventListener('touchend',   onEnd);
    };
  }, [doRefresh]);

  const progress = Math.min(pullY / PULL_THRESHOLD, 1);

  // Indicator lives inside the header zone (0–64px).
  // translateY: -44 (hidden above) → 10 (center sits at y=32, well inside header).
  // Never drops below the header line.
  const translateY = refreshing
    ? 10
    : pullY > 0
      ? Math.min(-44 + progress * 54, 10)
      : -44;

  // SVG arc: stroke-dashoffset goes from full circumference (invisible) to 0 (full circle).
  // The arc starts drawing from 12 o'clock (rotate -90°) and grows clockwise.
  const arcOffset = refreshing ? 0 : CIRCUMFERENCE * (1 - progress);

  return (
    <div
      aria-hidden
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none"
      style={{
        top: 0,
        transform: `translateY(${translateY}px)`,
        transition: (refreshing || pullY > 0) ? 'none' : 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Frosted-glass pill — adapts to light/dark, no harsh white box */}
      <div
        className="relative flex items-center justify-center rounded-full backdrop-blur-md shadow-md"
        style={{
          width: SIZE,
          height: SIZE,
          background: 'color-mix(in srgb, var(--background, #fff) 75%, transparent)',
          opacity: pullY > 2 || refreshing ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      >
        {/* ── SVG: arc draws itself, then spins during refresh ── */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0"
          style={{
            animation: refreshing ? 'ptr-spin 0.9s linear infinite' : 'none',
          }}
        >
          {/* Faint track — appears as arc starts drawing */}
          <circle
            cx={CX} cy={CX} r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity={0.12 * progress}
          />
          {/* The arc being drawn — stroke-dashoffset shrinks with pull progress */}
          <circle
            cx={CX} cy={CX} r={RADIUS}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={arcOffset}
            transform={`rotate(-90 ${CX} ${CX})`}
            style={{ transition: refreshing ? 'none' : 'stroke-dashoffset 0.04s linear' }}
          />
        </svg>

        {/* Logo — fades in as the arc nears completion */}
        <img
          src="/logo.png"
          alt=""
          style={{
            position: 'relative',
            width: SIZE - 18,
            height: SIZE - 18,
            objectFit: 'contain',
            opacity: progress * 0.9,
            transition: 'opacity 0.1s',
            // Blend white PNG background away — works on light & semi-transparent surfaces
            mixBlendMode: 'multiply',
          }}
        />
      </div>

      {/* Keyframe for the refresh spin — defined inline to avoid global CSS dependency */}
      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
