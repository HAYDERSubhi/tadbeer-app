"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Requests notification permission (must run inside a user gesture handler,
// e.g. a Switch's onCheckedChange) and subscribes to push if granted.
// Returns whether the subscription succeeded.
export async function requestAndSubscribePush(user: { getIdToken: () => Promise<string> }): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const idToken = await user.getIdToken();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return true;
  } catch {
    return false;
  }
}

// Silently registers push subscription if permission already granted.
// Permission request itself happens in settings toggle (user gesture required).
export function usePushNotifications() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user || registered.current) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!VAPID_PUBLIC_KEY) return;
    if (Notification.permission !== 'granted') return; // only if already granted

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }
        const idToken = await user.getIdToken();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        registered.current = true;
      } catch { /* silent fail */ }
    };

    const timer = setTimeout(register, 2000);
    return () => clearTimeout(timer);
  }, [user]);
}
