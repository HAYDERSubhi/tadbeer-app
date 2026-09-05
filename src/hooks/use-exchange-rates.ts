'use client';

import { useState, useEffect } from 'react';

export type Rates = Record<string, number>;

type Cache = { rates: Rates; updatedAt: number };

const CACHE_KEY = 'tadbeer_exchange_rates';
const IQD_MARKET_KEY = 'tadbeer_iqd_market_rate';
const IQD_MARKET_AT_KEY = 'tadbeer_iqd_market_rate_at';
const ONE_DAY = 24 * 60 * 60 * 1000;
const API_URL = 'https://open.er-api.com/v6/latest/USD';

// Fallback rates (approximate) used when offline and no cache exists
const FALLBACK_RATES: Rates = {
  USD: 1,
  IQD: 1310,
  AED: 3.67,
  SAR: 3.75,
  EUR: 0.92,
  GBP: 0.79,
  TRY: 38.5,
  KWD: 0.307,
  EGP: 30.9,
};

/** العملات التي تعرضها الأداة — أي مصدر أسعار ينقصه واحد منها يُرفض كاملاً. */
const REQUIRED_CODES = ['IQD', 'USD', 'AED', 'SAR', 'EUR', 'TRY'] as const;

/**
 * يقبل كائن أسعار **صالحاً فقط**: قيم أرقام موجبة منتهية، وكل العملات المطلوبة حاضرة.
 *
 * ⛔ سبب وجوده: `readCache` كانت تفعل `JSON.parse(raw) as Cache` بلا أي تحقّق.
 *    فأي نسخة مخزَّنة ناقصة أو تالفة (كتابة مبتورة، حصّة تخزين ممتلئة، نسخة أقدم
 *    من التطبيق) كانت تُقبل كما هي، ثم يسقط كل سعر مفقود على `?? 1` في التحويل —
 *    فيظهر «1,000,000 دينار = 1,000,000 دولار» رقماً سليم الشكل تماماً وخاطئاً
 *    تماماً، بلا أي تنبيه. رفض المصدر كلّه أسلم من تحويل نصفه.
 */
function sanitizeRates(raw: unknown): Rates | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Rates = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[code] = value;
  }
  return REQUIRED_CODES.every(c => out[c] !== undefined) ? out : null;
}

export function getIQDMarketRate(): number {
  try {
    const v = localStorage.getItem(IQD_MARKET_KEY);
    if (!v) return 1480;
    // parseFloat('abc') = NaN، وكانت تُعاد كما هي فتُفسد كل تحويل يشمل الدينار.
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : 1480;
  } catch { return 1480; }
}

export function getIQDMarketRateSavedAt(): number | null {
  try { const v = localStorage.getItem(IQD_MARKET_AT_KEY); return v ? parseInt(v) : null; } catch { return null; }
}

export function saveIQDMarketRate(rate: number) {
  try {
    localStorage.setItem(IQD_MARKET_KEY, String(rate));
    localStorage.setItem(IQD_MARKET_AT_KEY, String(Date.now()));
  } catch {}
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Cache>;
    const rates = sanitizeRates(parsed?.rates);
    // نسخة تالفة أو ناقصة ⇒ تُهمَل تماماً، فيُعاد الجلب من الشبكة أو تُستعمل
    // أسعار الطوارئ. لا تُمرَّر أسعار نصفية إلى التحويل.
    if (!rates || typeof parsed?.updatedAt !== 'number') return null;
    return { rates, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

function writeCache(rates: Rates) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, updatedAt: Date.now() }));
  } catch {}
}

export function useExchangeRates() {
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const cache = readCache();

    if (cache && Date.now() - cache.updatedAt < ONE_DAY) {
      setRates(cache.rates);
      setUpdatedAt(cache.updatedAt);
      setLoading(false);
      return;
    }

    fetch(API_URL)
      .then(r => r.json())
      .then(data => {
        // ردّ الخدمة يمرّ بنفس التحقّق: «success» وحدها لا تضمن أن كل عملة
        // تعرضها الأداة موجودة في الردّ. ردّ ناقص يُهمَل وتبقى الأسعار السابقة.
        const clean = data?.result === 'success' ? sanitizeRates(data.rates) : null;
        if (clean) {
          writeCache(clean);
          setRates(clean);
          setUpdatedAt(Date.now());
          setOffline(false);
        }
      })
      .catch(() => {
        if (cache) {
          setRates(cache.rates);
          setUpdatedAt(cache.updatedAt);
        } else {
          setRates(FALLBACK_RATES);
        }
        setOffline(true);
      })
      .finally(() => setLoading(false));
  }, []);

  function convert(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    const inUSD = amount / (rates[from] ?? 1);
    return inUSD * (rates[to] ?? 1);
  }

  return { rates, convert, loading, offline, updatedAt };
}
