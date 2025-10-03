// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface BudgetSummaryCardProps {
    totalBudget: number;
    totalSpent: number;
    remaining: number;
    outOfBudget: number;
    spentPercentage: number;
    timeProgress: number;
    isBudgetSet: boolean;
}

const StatItem = ({ label, value, isVisible, className, isCurrency = true }: { label: string; value: number; isVisible: boolean; className?: string; isCurrency?: boolean; }) => (
    <div className="flex flex-col items-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-bold tracking-tighter", className)}>
            {isVisible ? `${value.toLocaleString()}${isCurrency ? ' د.ع' : ''}` : "••••••"}
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
}: BudgetSummaryCardProps) {
    const [isVisible, setIsVisible] = useState(true);
    
    const progressBarColor = (() => {
        if (!isBudgetSet) {
            return 'bg-primary/50';
        }
        if (spentPercentage <= timeProgress) {
            return 'bg-primary';
        }
        const overspendRatio = timeProgress > 0 ? (spentPercentage - timeProgress) / timeProgress : 1;
        if (overspendRatio < 0.25) {
            return 'bg-yellow-500';
        }
        return 'bg-destructive';
    })();

    return (
        <Card id="budget-summary-card" className="w-full">
            <CardContent className="p-3 relative">
                <Button variant="ghost" size="icon" className="absolute top-2 left-2 h-7 w-7 text-muted-foreground" onClick={() => setIsVisible(!isVisible)}>
                    {isVisible ? <EyeOff /> : <Eye />}
                </Button>
                
                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <StatItem label="الميزانية" value={totalBudget} isVisible={isVisible} />
                    <StatItem label="المصروف" value={totalSpent} isVisible={isVisible} className="text-destructive" />
                    <StatItem label="المتبقي" value={remaining} isVisible={isVisible} className={cn(remaining >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")} />
                </div>
                
                 <div className="px-2 space-y-3">
                    {isBudgetSet && (
                         <div className="relative w-full h-8">
                            <div className="absolute inset-0 w-full h-full rounded-full bg-muted overflow-hidden">
                                {/* The colored bar representing time progress */}
                                <div 
                                    className={cn("h-full transition-all duration-500", progressBarColor)}
                                    style={{ width: `${timeProgress}%`}}
                                >
                                    {/* Percentage text inside the bar */}
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold text-xs mix-blend-difference">
                                        {spentPercentage.toFixed(0)}%
                                    </div>
                                </div>

                                {/* Week markers */}
                                <div className="absolute inset-0 flex justify-around items-end">
                                    <div className="w-[1.5px] h-1/4 bg-foreground/30" style={{ left: '25%' }} />
                                    <div className="w-[2px] h-1/4 bg-foreground/50" style={{ left: '50%' }} />
                                    <div className="w-[1.5px] h-1/4 bg-foreground/30" style={{ left: '75%' }} />
                                </div>
                            </div>
                        </div>
                    )}
                     <div className="flex justify-between items-center text-xs pt-1">
                        <StatItem label="خارج الميزانية" value={outOfBudget} isVisible={isVisible} className="text-blue-500 !text-sm" />
                        {isBudgetSet && (
                            <div className="flex items-center gap-2">
                                 <p className="text-muted-foreground">{timeProgress.toFixed(0)}% من الشهر</p>
                                 <div className={cn("h-2 w-2 rounded-full", progressBarColor)} />
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}