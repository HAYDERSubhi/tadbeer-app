
// src/components/notifications/notification-manager.tsx
"use client";

import { useEffect } from 'react';
import { useAppData } from '@/hooks/use-app-data';

const NOTIFICATION_TAG = 'daily-expense-reminder';

export default function NotificationManager() {
  const { userSettings } = useAppData();

  useEffect(() => {
    const dailyReminderEnabled = userSettings?.notifications?.dailyReminderEnabled ?? false;
    
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return;
    }

    const manageReminder = async () => {
        if (!dailyReminderEnabled || Notification.permission !== 'granted') {
            return;
        }

        const registration = await navigator.serviceWorker.ready;

        // Check if a notification for today has already been shown
        const lastShown = localStorage.getItem('dailyReminderLastShown');
        const todayStr = new Date().toDateString();

        if (lastShown === todayStr) {
            return; // Already shown today
        }
        
        const now = new Date();
        // Check if it's after 8 PM
        if (now.getHours() >= 20) {
            registration.showNotification('تذكير يومي من تدبير', {
                tag: NOTIFICATION_TAG,
                body: 'لا تنس تسجيل مصروفاتك لهذا اليوم!',
                icon: '/logo.png',
                renotify: true,
            }).then(() => {
                localStorage.setItem('dailyReminderLastShown', todayStr);
            }).catch(err => {
                console.error('Failed to show notification:', err);
            });
        }
    };

    manageReminder();

  }, [userSettings?.notifications?.dailyReminderEnabled]);

  return null; // This is a logic component, it doesn't render anything
}
