// src/app/settings/layout.tsx
"use client";

import React from 'react';
import Link from 'next/link';

// This layout now correctly relies on the main AppShell for its header and navigation.
// No custom header is needed here.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground">قم بإدارة حسابك وتفضيلاتك وبياناتك من هنا.</p>
      </div>
      {children}
      <footer className="p-4 text-center text-xs text-muted-foreground border-t mt-auto">
        <Link href="/privacy" className="hover:underline">سياسة الخصوصية</Link>
      </footer>
    </>
  );
}
