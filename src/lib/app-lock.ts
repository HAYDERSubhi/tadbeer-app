// src/lib/app-lock.ts
// Device-local "app lock": a 4-digit PIN asked on a cold start of the app.
// This is a soft lock for everyday privacy — the PIN is stored hashed in
// localStorage, NOT synced to Firestore, and does not encrypt any data.

const ENABLED_KEY = 'tadbeer_app_lock_enabled';
const HASH_KEY = 'tadbeer_app_lock_hash';

export const PIN_LENGTH = 4;

/** Is the app lock turned on for this device? */
export function isLockEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === '1' && !!localStorage.getItem(HASH_KEY);
}

/** SHA-256 of the PIN (with a fixed salt) — never store the PIN in clear text. */
async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${pin}:tadbeer-lock`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Save a new PIN and enable the lock. */
export async function setPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  localStorage.setItem(HASH_KEY, hash);
  localStorage.setItem(ENABLED_KEY, '1');
}

/** Returns true when the entered PIN matches the stored one. */
export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(HASH_KEY);
  if (!stored) return false;
  return (await hashPin(pin)) === stored;
}

/** Turn the lock off and forget the PIN. */
export function disableLock(): void {
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(HASH_KEY);
}
