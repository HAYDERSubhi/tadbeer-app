
"use client";

import Link from 'next/link';
import { MoonIcon, SunIcon, Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import React from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import Logo from '@/components/ui/logo';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { canInstall, handleInstall } = usePWAInstall();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <Logo />
            <span className="text-foreground">تدبير</span>
          </Link>
          <div className="flex items-center gap-2">
             {canInstall && (
                <Button variant="ghost" size="icon" onClick={handleInstall} aria-label="تثبيت التطبيق">
                    <Download className="h-5 w-5" />
                </Button>
             )}
             <Button asChild variant="ghost" size="icon">
              <Link href="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label="Toggle theme"
            >
              <SunIcon className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <MoonIcon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* The children will be <main> and <PageNavigation> */}
      {children}
      
    </div>
  );
}
