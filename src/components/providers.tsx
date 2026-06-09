// src/components/providers.tsx
"use client";

import * as React from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/hooks/use-auth';
import { QueryProvider } from '@/components/query-provider';
import { useSwUpdate } from '@/hooks/use-sw-update';

function SwUpdateWatcher() {
  useSwUpdate();
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <AuthProvider>
          <SwUpdateWatcher />
          {children}
          <Toaster />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
