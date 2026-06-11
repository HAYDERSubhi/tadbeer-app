// src/components/splash-screen.tsx
"use client";

import { useState, useEffect } from 'react';
import { useAppData } from '@/hooks/use-app-data';

// ── Geometry: regular 12-gon matching the logo's polygonal silhouette ──
const CX = 60, CY = 60, R = 50, N = 12;
const pts = Array.from({ length: N }, (_, k) => {
  const a = -Math.PI / 2 + (k * 2 * Math.PI) / N;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
});
const POLYGON_PATH =
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + ' Z';
// Total perimeter = N × side-length
const PERIMETER = Math.round(N * 2 * R * Math.sin(Math.PI / N)); // ≈ 311

const WORD = ['ت', 'د', 'ب', 'ي', 'ر'];

export function SplashScreen() {
  const { isExpensesFetched } = useAppData();
  const [mounted, setMounted]   = useState(true);
  const [exiting, setExiting]   = useState(false);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => setMounted(false), 350);
  };

  // Dismiss as soon as data is ready — even mid-animation
  useEffect(() => {
    if (isExpensesFetched) dismiss();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpensesFetched]);

  // Hard cap: never block the UI for more than 3.5 s
  useEffect(() => {
    const t = setTimeout(dismiss, 3500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
      style={{ opacity: exiting ? 0 : 1, transition: 'opacity 0.35s ease' }}
    >
      {/* ── Polygon draws itself + logo fades in centre ── */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <svg
          width="120" height="120"
          viewBox="0 0 120 120"
          style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        >
          {/* Faint filled polygon — appears gradually as stroke draws */}
          <path
            d={POLYGON_PATH}
            fill="hsl(var(--primary) / 0.06)"
            style={{ animation: 'sp-fill 1.6s ease forwards' }}
          />
          {/* The polygon border being drawn */}
          <path
            d={POLYGON_PATH}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={PERIMETER}
            strokeDashoffset={PERIMETER}
            style={{ animation: 'sp-draw 1.4s cubic-bezier(0.4,0,0.2,1) forwards' }}
          />
        </svg>

        {/* Logo PNG — bg matches splash bg so white border is invisible */}
        <img
          src="/logo.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 18,
            width: 84,
            height: 84,
            objectFit: 'contain',
            opacity: 0,
            animation: 'sp-logo 0.45s ease forwards 0.85s',
          }}
        />
      </div>

      {/* ── "تدبير" — each letter slides up in sequence ── */}
      <div
        className="flex mt-5 text-2xl font-black tracking-[0.18em] text-foreground"
        dir="rtl"
        aria-label="تدبير"
      >
        {WORD.map((ch, i) => (
          <span
            key={i}
            style={{
              opacity: 0,
              display: 'inline-block',
              animation: `sp-letter 0.38s ease forwards ${0.95 + i * 0.08}s`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* Tagline — fades in after word completes */}
      <p
        className="mt-1 text-xs text-muted-foreground tracking-widest"
        style={{ opacity: 0, animation: 'sp-logo 0.4s ease forwards 1.45s' }}
      >
        دبّر مصاريفك بذكاء
      </p>

      <style>{`
        @keyframes sp-draw   { to { stroke-dashoffset: 0; } }
        @keyframes sp-fill   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sp-logo   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sp-letter {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}
