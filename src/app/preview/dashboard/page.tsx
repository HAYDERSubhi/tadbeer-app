// src/app/preview/dashboard/page.tsx
"use client";

import Link from 'next/link';

// Main Preview Component
export default function DashboardPreviewPage() {
  
  return (
    <div className="bg-background min-h-screen">
        {/* Header to explain what this page is */}
        <div className="p-4 text-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-b border-yellow-200 dark:border-yellow-800">
            <h1 className="font-bold">صفحة المعاينة (محذوفة)</h1>
            <p className="text-sm">لم تعد هذه الصفحة مستخدمة. تم دمج منطقها في لوحة التحكم الرئيسية. <Link href="/" className="underline font-semibold">العودة للرئيسية</Link></p>
        </div>
    </div>
  );
}
