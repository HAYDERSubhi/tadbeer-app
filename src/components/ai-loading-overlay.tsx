"use client";

import { useEffect, useRef, useState } from "react";
import { Coffee, Car, Zap, ShoppingBag } from "lucide-react";

/**
 * حركة انتظار موحّدة لمسارات الذكاء (الصوت · الفاتورة): شعار تدبير عائم بلا بطاقة،
 * وأيقونات مصاريف تُسحب إليه. مكوّن واحد معزول — التراجع عنه حذف استدعائه.
 *
 * ⛔ pointer-events-none عمداً: لا تحجب الشاشة ولا تُعلِق المستخدم لو تأخّر الرد.
 *    (للصوت مهلة 35 ثانية وللفاتورة مهلتها؛ الحركة تتبع الحالة فقط.)
 * ⛔ لا تُضِف بطاقة/خلفية بيضاء: قرار صاحب المشروع «شعار عائم بلا خلفية».
 * ⏱ لا وميض: لا تظهر قبل 250ms (الرد السريع لا يستحقّها)، وإذا ظهرت بقيت 700ms على الأقل.
 */
const SHOW_DELAY_MS = 250;
const MIN_VISIBLE_MS = 700;
const OUT_MS = 180;

const CHIPS = [
  { Icon: Coffee,      x: "-86px", y: "-62px", delay: "0s" },
  { Icon: Car,         x: "86px",  y: "-62px", delay: "0.6s" },
  { Icon: ShoppingBag, x: "86px",  y: "66px",  delay: "1.2s" },
  { Icon: Zap,         x: "-86px", y: "66px",  delay: "1.8s" },
] as const;

interface Props {
  open: boolean;
  label: string;
  sublabel?: string;
  /** 0–100 — يظهر شريط رفيع تحت النص إن وُجدت */
  progress?: number;
}

export function AiLoadingOverlay({ open, label, sublabel, progress }: Props) {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shownAtRef = useRef(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      if (mounted) {
        setLeaving(false);
      } else {
        t = setTimeout(() => {
          shownAtRef.current = Date.now();
          setLeaving(false);
          setMounted(true);
        }, SHOW_DELAY_MS);
      }
    } else if (mounted) {
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAtRef.current));
      t = setTimeout(() => {
        setLeaving(true);
        t = setTimeout(() => setMounted(false), OUT_MS);
      }, wait);
    }
    return () => { if (t) clearTimeout(t); };
  }, [open, mounted]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/35 ${leaving ? "tl-overlay-out" : "tl-overlay-in"}`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-40 w-40">
          {/* حلقة التقدّم */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 160" aria-hidden="true">
            <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" />
            <g className="tl-ring">
              <circle
                cx="80" cy="80" r="62" fill="none" stroke="#1AB2A7" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray="110 280"
              />
            </g>
          </svg>

          {/* أيقونات المصاريف تُسحب إلى الشعار */}
          {CHIPS.map(({ Icon, x, y, delay }, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="tl-chip absolute inset-0 m-auto flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md"
              style={{ ["--tl-x" as string]: x, ["--tl-y" as string]: y, animationDelay: delay }}
            >
              <Icon className="h-[18px] w-[18px] text-primary" />
            </span>
          ))}

          {/* الشعار الأبيض العائم */}
          <div className="tl-float absolute inset-0 m-auto flex h-24 w-24 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 object-contain"
              style={{ filter: "brightness(0) invert(1) drop-shadow(0 6px 16px rgba(26,178,167,0.55))" }}
            />
          </div>
        </div>

        <div className="flex max-w-[260px] flex-col items-center gap-1.5 text-center">
          <p className="text-base font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.45)]">{label}</p>
          {typeof progress === "number" && progress > 0 && (
            <div className="h-1 w-40 overflow-hidden rounded-full bg-white/25" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {sublabel && <p className="text-xs text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,0.45)]">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}
