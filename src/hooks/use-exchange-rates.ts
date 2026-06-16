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

export function getIQDMarketRate(): number {
  try {
    const v = localStorage.getItem(IQD_MARKET_KEY);
    return v ? parseFloat(v) : 1480;
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
    return JSON.parse(raw) as Cache;
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
        if (data?.result === 'success' && data.rates) {
          writeCache(data.rates);
          setRates(data.rates);
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
