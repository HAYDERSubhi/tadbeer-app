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
    // =========================================================================================
    // آلية عمل شريط التقدم للميزانية (شرح مفصل)
    // =========================================================================================
    //
    // الهدف: عرض النسبة المئوية الإجمالية للمصروفات من الميزانية الشهرية، مع توضيح حالة الصرف لكل أسبوع.
    //
    // -----------------------------------------------------------------------------------------
    // السيناريو الحالي:
    // -----------------------------------------------------------------------------------------
    // - الوضع الزمني: نهاية الأسبوع الثالث من الشهر.
    // - الميزانية الشهرية الإجمالية: 4,000,000 دينار.
    // - الميزانية الأسبوعية (الميزانية الشهرية / 4): 1,000,000 دينار.
    //
    // - مصروفات الأسبوع الأول (أقصى اليمين): 750,000 (أقل من الميزانية الأسبوعية -> أخضر).
    // - مصروفات الأسبوع الثاني: 1,100,000 (تجاوز طفيف بنسبة 10% -> برتقالي).
    // - مصروفات الأسبوع الثالث: 1,300,000 (تجاوز كبير بنسبة 30% -> أحمر).
    // - مصروفات الأسبوع الرابع (أقصى اليسار): 0 (لم يبدأ بعد -> شفاف).
    //
    // - إجمالي الصرف الحالي: 3,150,000 دينار.
    // - النسبة المئوية المعروضة: (3,150,000 / 4,000,000) * 100 = 78.75% (مقربة إلى 79%).
    //
    // -----------------------------------------------------------------------------------------
    // منطق الألوان:
    // -----------------------------------------------------------------------------------------
    // - أخضر (bg-primary): الصرف <= 100% من الميزانية الأسبوعية.
    // - برتقالي (bg-orange-400): الصرف > 100% و <= 125% من الميزانية الأسبوعية.
    // - أحمر (bg-destructive): الصرف > 125% من الميزانية الأسبوعية.
    //
    // -----------------------------------------------------------------------------------------
    // البنية والتصميم (من الأسفل للأعلى):
    // -----------------------------------------------------------------------------------------
    // 1. حاوية رئيسية (relative): تضبط الحجم العام وتستخدم `overflow-hidden` لضمان حواف دائرية ناعمة.
    // 2. طبقة الألوان (absolute, z-0): حاوية `flex` لعرض الأسابيع من اليمين لليسار (السلوك الطبيعي في RTL).
    // 3. طبقة الفواصل (absolute, z-10): حاوية شفافة تغطي الشريط، تحتوي على 3 خطوط عمودية سوداء بموقع دقيق.
    // 4. طبقة النص (absolute, z-20): حاوية شفافة في الأعلى لعرض النسبة المئوية في المنتصف.
    // =========================================================================================
    
    const mockBudget = 4000000;
    const weeklyBudget = mockBudget / 4;
    
    // The order here is Week 1, Week 2, Week 3, Week 4.
    // In an RTL flex container, this will render from right to left correctly.
    const weeklyExpenses = [
      750000,  // Week 1 (Rightmost)
      1100000, // Week 2
      1300000, // Week 3
      0        // Week 4 (Leftmost)
    ];
    
    const totalSpentForScenario = weeklyExpenses.reduce((a, b) => a + b, 0);
    const spentPercentage = mockBudget > 0 ? (totalSpentForScenario / mockBudget) * 100 : 0;
    
    const weeklySummaries = weeklyExpenses.map((spent) => {
        let colorClass = 'bg-transparent';
        if (spent > 0) {
            const overspendRatio = spent / weeklyBudget;
            if (overspendRatio > 1.25) {
                colorClass = 'bg-destructive'; // Red
            } else if (overspendRatio > 1) {
                colorClass = 'bg-orange-400'; // Orange
            } else {
                colorClass = 'bg-primary'; // Green (Teal)
            }
        }
        return { spent, colorClass };
    });
    
    return {
      totalBudget: mockBudget,
      spentPercentage: Math.round(spentPercentage),
      weeklySummaries,
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
        <Card id="budget-summary-card" className="overflow-hidden bg-card border shadow-sm rounded-md">
            <CardContent className="p-4 space-y-4">
                {/* The Smart Progress Bar Container */}
                <div className="relative h-6 w-full rounded-full bg-secondary overflow-hidden">
                    
                    {/* Layer 1: The colored segments (Bottom Layer, z-0) */}
                    {/* This flex container will naturally flow from Right to Left because the page is RTL */}
                    <div className="absolute inset-0 z-0 flex">
                        {budgetData.weeklySummaries.map((week, index) => (
                           <div key={index} className={cn("h-full w-1/4", week.colorClass)} />
                        ))}
                    </div>

                    {/* Layer 2: The dividers (Middle Layer, z-10) */}
                    <div className="absolute inset-0 z-10 pointer-events-none">
                         <div className="absolute h-1 w-px bg-black/75 bottom-0" style={{right: '25%'}}></div>
                         <div className="absolute h-1 w-px bg-black/75 bottom-0" style={{right: '50%'}}></div>
                         <div className="absolute h-1 w-px bg-black/75 bottom-0" style={{right: '75%'}}></div>
                    </div>
                   
                    {/* Layer 3: Percentage Text Overlay (Top Layer, z-20) */}
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <span className="text-sm font-bold text-black/70 drop-shadow-sm">
                            {budgetData.spentPercentage}%
                        </span>
                    </div>
                </div>
            
                <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                        <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                            <Pencil className="w-6 h-6 sm:w-7 sm:h-7" />
                        </span>
                        <p className="font-semibold text-xs">يدوي</p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                        <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                            <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
                        </span>
                        <p className="font-semibold text-xs">صوت</p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                        <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                            <FileScan className="w-6 h-6 sm:w-7 sm:h-7" />
                        </span>
                        <p className="font-semibold text-xs">فاتورة</p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                        <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                            <CreditCard className="w-6 h-6 sm:w-7 sm:h-7" />
                        </span>
                        <p className="font-semibold text-xs">بطاقة</p>
                    </div>
                </div>
            </CardContent>
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
