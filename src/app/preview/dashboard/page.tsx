
// src/app/preview/dashboard/page.tsx
"use client";

import { useMemo } from 'react';
import {
  Pencil,
  Mic,
  FileScan,
  CreditCard,
  History,
  Sparkles,
  MoreHorizontal,
  CookingPot,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from 'next/link';

// Main Preview Component
export default function DashboardPreviewPage() {
  
  const budgetData = useMemo(() => {
    const mockBudget = 2000000;
    const mockExpenses = [
        { title: 'فاتورة كهرباء الشهر الماضي', cat: 'فواتير وخدمات', amount: 85000 },
        { title: 'تعبئة وقود للسيارة 90 لتر', cat: 'السيارة الخاصة', amount: 50000 },
        { title: 'غداء عمل مع الفريق', cat: 'طعام وشراب', amount: 15000 },
        { title: 'شراء ملابس جديدة للعيد', cat: 'كماليات شخصية', amount: 120000 }
    ];

    const totalSpent = mockExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const spentPercentage = mockBudget > 0 ? (totalSpent / mockBudget) * 100 : 0;
    
    return {
      totalBudget: mockBudget,
      totalSpent,
      spentPercentage,
    };
  }, []);

  return (
    <div className="bg-background min-h-screen">
        {/* Header to explain what this page is */}
        <div className="p-4 text-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-b border-yellow-200 dark:border-yellow-800">
            <h1 className="font-bold">صفحة المعاينة</h1>
            <p className="text-sm">هذه الصفحة هي عرض مرئي للتصميم المقترح. الوظائف معطلة. <Link href="/" className="underline font-semibold">العودة للرئيسية</Link></p>
        </div>

      <main className="p-4 sm:p-6 space-y-6">

        {/* The new proposed "Smart Card" */}
        <Card className="overflow-hidden">
            <div className="p-3 space-y-3">
                 {/* RTL Progress Bar */}
                <div className="relative h-6 w-full overflow-hidden rounded-md bg-secondary">
                    <div 
                        className="absolute top-0 right-0 h-full bg-primary" 
                        style={{ width: `${budgetData.spentPercentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-black/70 drop-shadow-sm">
                           {budgetData.spentPercentage.toFixed(0)}%
                        </span>
                    </div>
                </div>
                
                 <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted transition-colors">
                        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary transition-colors">
                            <Pencil className="w-6 h-6" />
                        </span>
                        <p className="font-semibold text-xs">يدوي</p>
                    </div>
                     <div className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted transition-colors">
                        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary transition-colors">
                            <Mic className="w-6 h-6" />
                        </span>
                        <p className="font-semibold text-xs">صوت</p>
                    </div>
                     <div className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted transition-colors">
                        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary transition-colors">
                            <FileScan className="w-6 h-6" />
                        </span>
                        <p className="font-semibold text-xs">فاتورة</p>
                    </div>
                     <div className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted transition-colors">
                        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary transition-colors">
                            <CreditCard className="w-6 h-6" />
                        </span>
                        <p className="font-semibold text-xs">بطاقة</p>
                    </div>
                </div>
            </div>
        </Card>


        {/* Placeholder for Recent Expenses with smaller fonts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              أحدث المصاريف
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
                {[{title: 'فاتورة كهرباء الشهر الماضي', cat: 'فواتير وخدمات', amount: '85,000'}, {title: 'تعبئة وقود للسيارة 90 لتر', cat: 'السيارة الخاصة', amount: '50,000'}, {title: 'غداء عمل مع الفريق', cat: 'طعام وشراب', amount: '15,000'}, {title: 'شراء ملابس جديدة للعيد', cat: 'كماليات شخصية', amount: '120,000'}].map(item => (
                  <li key={item.title} className="flex items-center p-3">
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xl bg-muted">🛒</span>
                        <div className="min-w-0">
                            <p className="font-semibold text-xs truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.cat}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-end">
                            <p className="font-bold text-xs text-foreground">{item.amount} د.ع</p>
                            <p className="text-xs text-muted-foreground">قبل يومين</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        {/* Placeholder for Financial Coach Insights */}
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    نصائح المدرب المالي
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        <PiggyBank className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="font-semibold text-xs">إدارة ممتازة للميزانية!</p>
                        <p className="text-xs text-muted-foreground">أنت تسير بشكل ممتاز هذا الشهر، استمر بذلك.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        <CookingPot className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="font-semibold text-xs">فكر في الطبخ المنزلي</p>
                        <p className="text-xs text-muted-foreground">لاحظنا ارتفاعاً في مصاريف المطاعم. الطبخ في المنزل قد يوفر الكثير.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                        <TrendingUp className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="font-semibold text-xs">مراقبة مصاريف الترفيه</p>
                        <p className="text-xs text-muted-foreground">مصاريف الترفيه أعلى من المتوسط هذا الشهر، هل تود وضع ميزانية لها؟</p>
                    </div>
                </div>
            </CardContent>
        </Card>

      </main>
    </div>
  );
}
