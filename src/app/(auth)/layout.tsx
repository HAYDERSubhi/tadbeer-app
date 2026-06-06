import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500">
      {children}
    </main>
  );
}
