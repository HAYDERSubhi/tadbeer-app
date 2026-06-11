// src/components/pull-to-refresh.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const PULL_THRESHOLD = 65;  // px of travel to trigger refresh
const MAX_PULL       = 100; // rubber-band ceiling

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
    // Keep the spinner visible briefly so it doesn't flash and disappear
    await new Promise<void>(r => setTimeout(r, 700));

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

      // Rubber-band resistance — pull feels heavier as it stretches
      const dist = Math.min(raw * 0.45, MAX_PULL);
      pullYRef.current = dist;
      setPullY(dist);
      // Suppress native scroll/overscroll once a clear downward pull is detected
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

  // The indicator sits just below the sticky header (h-16 = 64px).
  // translateY maps: hidden → -48px (above header), full pull → +8px (below header edge).
  // While refreshing it stays locked at +8px.
  const translateY = refreshing
    ? 8
    : pullY > 0
      ? Math.min(progress * 56 - 48, 8)
      : -48;

  const visible = pullY > 4 || refreshing;

  return (
    <div
      aria-hidden
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none"
      style={{
        top: 64,
        transform: `translateY(${translateY}px)`,
        // Animate snap-back on release; no transition while finger is moving
        transition: (refreshing || pullY > 0) ? 'none' : 'transform 0.25s ease',
      }}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full shadow-lg',
          'bg-white dark:bg-zinc-800',
          'transition-opacity duration-150',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{ width: 40, height: 40 }}
      >
        <img
          src="/logo.png"
          alt=""
          className={refreshing ? 'animate-spin' : ''}
          style={{
            width: 26,
            height: 26,
            objectFit: 'contain',
            // Fade in as pull deepens; full opacity at threshold
            opacity: 0.2 + progress * 0.8,
            // Rotate with pull progress (0→270°); Tailwind animate-spin takes over when refreshing
            transform:  refreshing ? undefined : `rotate(${progress * 270}deg)`,
            transition: refreshing ? undefined : 'transform 0.05s linear, opacity 0.1s',
          }}
        />
      </div>
    </div>
  );
}
