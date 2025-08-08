
// src/app/settings/layout.tsx
"use client";

import React from 'react';
import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';
import { AppDataProvider } from '@/hooks/use-app-data';
import Link from 'next/link';

function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
    return (
        <AppShell>
            <main className="flex-1 p-4 sm:p-6">
                 <div className="mb-4">
                    <h1 className="text-2xl font-bold">الإعدادات</h1>
                    <p className="text-muted-foreground">قم بإدارة حسابك وتفضيلاتك وبياناتك من هنا.</p>
                 </div>
                {children}
            </main>
            
            <footer className="p-4 text-center text-xs text-muted-foreground border-t">
                <Link href="/privacy" className="hover:underline">سياسة الخصوصية</Link>
            </footer>

            <PageNavigation />
        </AppShell>
    )
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
        <SettingsLayoutContent>
            {children}
        </SettingsLayoutContent>
    </AppDataProvider>
  );
}
