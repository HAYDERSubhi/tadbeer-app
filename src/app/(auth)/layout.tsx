import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center p-5 bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 overflow-x-hidden overflow-y-auto">
      {/* أشكال ناعمة خافتة تعطي الخلفية عمقاً — ثابتة لا تتأثر بالتمرير */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/[0.07]" />
        <div className="absolute top-1/3 -left-24 w-64 h-64 rounded-full bg-white/[0.06]" />
        <div className="absolute -bottom-24 right-1/4 w-72 h-72 rounded-full bg-white/[0.05]" />
      </div>
      <div className="relative z-10 w-full flex justify-center">
        {children}
      </div>
    </main>
  );
}
