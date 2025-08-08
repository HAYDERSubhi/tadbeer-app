
// src/app/settings/layout.tsx
"use client";

import Link from 'next/link';
import { MoonIcon, SunIcon, ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import React from 'react';
import PageNavigation from '@/components/layout/page-navigation';
import { AppDataProvider } from '@/hooks/use-app-data';
import { usePWAInstall } from '@/hooks/use-pwa-install';

function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
    const { theme, setTheme } = useTheme();
    const { canInstall, handleInstall } = usePWAInstall();

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-2">
                         <Button asChild variant="ghost" size="icon">
                            <Link href="/">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <h1 className="text-lg font-bold">الإعدادات</h1>
                    </div>
                   
                    <div className="flex items-center gap-2">
                         {canInstall && (
                            <Button variant="ghost" size="icon" onClick={handleInstall} aria-label="تثبيت التطبيق">
                                <Download className="h-5 w-5" />
                            </Button>
                         )}
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

            <main className="flex-1 p-4 sm:p-6">
                {children}
            </main>
            
            <footer className="p-4 text-center text-xs text-muted-foreground border-t">
                <Link href="/privacy" className="hover:underline">سياسة الخصوصية</Link>
            </footer>

            <PageNavigation />
        </div>
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
