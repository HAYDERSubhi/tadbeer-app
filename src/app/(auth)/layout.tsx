import React from 'react';
import { OpenInBrowserBanner } from '@/components/layout/open-in-browser-banner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 overflow-y-auto">
      <OpenInBrowserBanner />
      <main className="flex flex-1 flex-col items-center justify-center p-5">
        {children}
      </main>
    </div>
  );
}
