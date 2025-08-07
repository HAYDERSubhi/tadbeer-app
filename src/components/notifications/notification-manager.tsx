
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
        const registration = await navigator.serviceWorker.ready;
        const existingNotifications = await registration.getNotifications({ tag: NOTIFICATION_TAG });

        // First, clear any existing reminders to avoid duplicates
        existingNotifications.forEach(notification => notification.close());

        if (dailyReminderEnabled && Notification.permission === 'granted') {
            const now = new Date();
            let reminderTime = new Date();
            reminderTime.setHours(20, 0, 0, 0); // 8:00 PM

            // If it's already past 8 PM today, schedule for tomorrow
            if (now > reminderTime) {
                reminderTime.setDate(reminderTime.getDate() + 1);
            }
            
            const delay = reminderTime.getTime() - now.getTime();
            
            // We use the service worker to show the notification
            // This is more reliable than setTimeout in a component for PWAs
            registration.showNotification('تذكير يومي من تدبير', {
                tag: NOTIFICATION_TAG,
                body: 'لا تنس تسجيل مصروفاتك لهذا اليوم!',
                icon: '/icon-192x192.png',
                showTrigger: new (window as any).TimestampTrigger(Date.now() + delay),
                renotify: true, // Allow re-notification each day
            }).catch(err => {
                console.error('Failed to schedule notification:', err);
            });
        }
    };

    manageReminder();

  }, [userSettings?.notifications?.dailyReminderEnabled]);

  return null; // This is a logic component, it doesn't render anything
}
