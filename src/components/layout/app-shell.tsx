
"use client";

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';

export default function AppShell({ children }: { children: React.ReactNode }) {
  usePWAInstall();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full bg-primary shadow-sm" style={{ marginTop: '-1px', paddingTop: '1px' }}>
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <div style={{
              width: 36, height: 36,
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '3px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src="/logo.png"
                alt="شعار تطبيق تدبير"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <span className="text-white">تدبير</span>
          </Link>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" asChild>
            <Link href="/settings" aria-label="الإعدادات">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </header>

      {children}

    </div>
  );
}
