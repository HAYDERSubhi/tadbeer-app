// src/lib/meta-pixel.ts
export const META_PIXEL_ID = '899929045834123';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export function trackMetaEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return;
  try {
    window.fbq('track', eventName, params);
  } catch {}
}

export function trackMetaCustomEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return;
  try {
    window.fbq('trackCustom', eventName, params);
  } catch {}
}
