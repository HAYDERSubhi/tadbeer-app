// src/components/query-provider.tsx
"use client";

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 5-minute stale window: long enough to avoid pointless background
        // refetches, short enough to pick up changes in a live session.
        staleTime: 1000 * 60 * 5,
        // Don't refetch when the user switches back to the tab/window —
        // mutations already invalidate the cache explicitly.
        refetchOnWindowFocus: false,
        // Don't retry on failure — show the error immediately.
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
