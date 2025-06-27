// src/app/(main)/layout.tsx
"use client";

import { useAuth } from '@/hooks/use-auth';
import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';
import { Loader2Icon } from 'lucide-react';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  // While loading (which includes the anonymous sign-in process), show a spinner.
  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If there is a user (anonymous or otherwise), render the main layout
  return (
    <AppShell>
      <div className="flex-1">
        {children}
      </div>
      <PageNavigation />
    </AppShell>
  );
}
