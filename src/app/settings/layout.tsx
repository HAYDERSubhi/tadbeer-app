
// src/app/settings/layout.tsx
"use client";

import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <main className="flex-1 p-4 sm:p-6">
        {children}
      </main>
      <PageNavigation />
    </AppShell>
  );
}
