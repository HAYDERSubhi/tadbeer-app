// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, TrendingDown } from "lucide-react";
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { getDate } from 'date-fns';

interface BudgetSummaryCardProps {
    totalBudget: number;
    totalSpent: number;
    remaining: number;
    outOfBudget: number;
    spentPercentage: number;
    timeProgress: number;
    isBudgetSet: boolean;
    predictedEndDay?: number | null;
}

const StatItem = ({ label, value, isVisible, className, formatFn }: {
    label: string;
    value: number;
    isVisible: boolean;
    className?: string;
    formatFn: (n: number) => string;
}) => (
    <div className="flex flex-col items-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-base font-bold tracking-tighter whitespace-nowrap", className)}>
            {isVisible ? formatFn(value) : "••••"}
        </p>
    </div>
);

export default function BudgetSummaryCard({
    totalBudget,
    totalSpent,
    remaining,
    outOfBudget,
    spentPercentage,
    timeProgress,
    isBudgetSet,
    predictedEndDay,
}: BudgetSummaryCardProps) {
    const [isVisible, setIsVisible] = useState(true);
    const { format: formatCurrency } = useCurrency();

    const currentDay = getDate(new Date());

    // Bar design: the FILL represents elapsed time in the month; the COLOR
    // encodes spending health; a vertical MARKER shows the actual spend %.
    // Reading: marker behind the fill edge = on track; marker ahead of it =
    // spending faster than time — the gap is the size of the risk.
    const progressBarColor = (() => {
        if (!isBudgetSet) return 'bg-primary/50';
        // Early-month grace (days 1-3): the relative formula compares spend
        // to only ~3-10% elapsed time, so one rent bill turns the bar red
        // unfairly. Stay calm unless spend exceeds 25% of the whole budget.
        if (currentDay <= 3 && spentPercentage <= 25) return 'bg-primary';
        if (spentPercentage <= timeProgress) return 'bg-primary';
        const overspendRatio = timeProgress > 0 ? (spentPercentage - timeProgress) / timeProgress : 1;
        if (overspendRatio < 0.25) return 'bg-yellow-500';
        return 'bg-destructive';
    })();

    // Marker color follows the state, darker for contrast over the track.
    const markerColorClass = (() => {
        if (progressBarColor === 'bg-destructive') return 'text-destructive';
        if (progressBarColor === 'bg-yellow-500') return 'text-yellow-700 dark:text-yellow-500';
        return 'text-foreground/70';
    })();

    // Fill = elapsed time (the month itself), capped at 100%.
    const timeFillWidth = isBudgetSet ? Math.min(timeProgress, 100) : 0;
    // Marker position = actual spend %, clamped to [2, 98] so the triangle
    // never disappears behind the bar's rounded end caps at very low or
    // very high spend.
    const spendMarkerPos = Math.min(Math.max(spentPercentage, 2), 98);

    return (
        <Card id="budget-summary-card" className="w-full">
            <CardContent className="p-3 relative">
                <Button variant="ghost" size="icon" className="absolute top-2 left-2 h-7 w-7 text-muted-foreground" onClick={() => setIsVisible(!isVisible)}>
                    {isVisible ? <EyeOff /> : <Eye />}
                </Button>

                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <StatItem label="الميزانية" value={totalBudget} isVisible={isVisible} formatFn={formatCurrency} />
                    <StatItem label="المصروف" value={totalSpent} isVisible={isVisible} className="text-destructive" formatFn={formatCurrency} />
                    <StatItem label="المتبقي" value={remaining} isVisible={isVisible} className={cn(remaining >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")} formatFn={formatCurrency} />
                </div>

                <div className="px-2 space-y-2">
                    {isBudgetSet && (
                        <div className="relative w-full h-8 mt-2">
                            <div className="absolute inset-0 w-full h-full rounded-full bg-muted overflow-hidden">
                                {/* Time fill — the bar IS the month */}
                                <div
                                    className={cn("absolute top-0 bottom-0 transition-all duration-500", progressBarColor)}
                                    style={{ right: '0', width: `${timeFillWidth}%` }}
                                />
                                {/* Centered spend label */}
                                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs mix-blend-difference pointer-events-none">
                                    إنفاق {spentPercentage.toFixed(0)}%
                                </div>
                            </div>
                            {/* Week markers (25/50/75%) */}
                            <div className="absolute inset-0 flex items-end pointer-events-none">
                                <div className="absolute bottom-0 bg-foreground/30" style={{ right: '25%', width: '1px', height: '20%' }} />
                                <div className="absolute bottom-0 bg-foreground/50" style={{ right: '50%', width: '1.5px', height: '20%' }} />
                                <div className="absolute bottom-0 bg-foreground/30" style={{ right: '75%', width: '1px', height: '20%' }} />
                            </div>
                            {/* Spend marker ▾ — its position is the actual spend %.
                                Behind the fill edge = on track; ahead of it = overspending. */}
                            <div
                                className={cn("absolute pointer-events-none transition-all duration-500", markerColorClass)}
                                style={{ right: `${spendMarkerPos}%`, top: '-7px', bottom: '0', transform: 'translateX(50%)' }}
                            >
                                <div style={{
                                    width: 0, height: 0, margin: '0 auto',
                                    borderLeft: '5px solid transparent',
                                    borderRight: '5px solid transparent',
                                    borderTop: '6px solid currentColor',
                                }} />
                                <div className="bg-current opacity-60 mx-auto" style={{ width: '2px', height: 'calc(100% - 6px)' }} />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xs pt-1">
                        {/* Hidden when zero — no point reserving space for an empty value.
                            The empty span keeps the time text anchored to the left side. */}
                        {outOfBudget > 0 ? (
                            <StatItem label="خارج الميزانية" value={outOfBudget} isVisible={isVisible} className="text-blue-500 !text-sm" formatFn={formatCurrency} />
                        ) : (
                            <span />
                        )}
                        {isBudgetSet && (
                            <p className="text-muted-foreground">اليوم {currentDay} — مضى {timeProgress.toFixed(0)}% من الشهر</p>
                        )}
                    </div>

                    {/* Budget end prediction */}
                    {predictedEndDay && isVisible && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-1.5 mt-1">
                            <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                بمعدل إنفاقك الحالي، ستنتهي الميزانية في يوم <span className="font-bold">{predictedEndDay}</span> من الشهر
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
