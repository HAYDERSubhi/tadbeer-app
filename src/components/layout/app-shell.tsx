
"use client";

import Link from 'next/link';
import { MoonIcon, SunIcon, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import React from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';

export const AppLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2L12 22" />
        <path d="M12 2C8.68629 2 6 4.68629 6 8C6 11.3137 8.68629 14 12 14" />
        <path d="M12 2C15.3137 2 18 4.68629 18 8C18 11.3137 15.3137 14 12 14" />
        <path d="M8 8H16" />
        <path d="M7 11H17" />
    </svg>
);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  usePWAInstall(); // Initialize the PWA install prompt logic

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <AppLogo className="h-8 w-8" />
            <span className="text-foreground">تدبير</span>
          </Link>
          <div className="flex items-center gap-2">
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
