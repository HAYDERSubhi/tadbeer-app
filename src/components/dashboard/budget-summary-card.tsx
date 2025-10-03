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

    const isOverspendingTime = spentPercentage > timeProgress;
    
    return (
        <Card id="budget-summary-card" className="w-full">
            <CardContent className="p-3 relative">
                <Button variant="ghost" size="icon" className="absolute top-2 left-2 h-7 w-7 text-muted-foreground" onClick={() => setIsVisible(!isVisible)}>
                    {isVisible ? <EyeOff /> : <Eye />}
                </Button>
                
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <StatItem label="الميزانية" value={totalBudget} isVisible={isVisible} />
                    <StatItem label="المصروف" value={totalSpent} isVisible={isVisible} className="text-destructive" />
                    <StatItem label="المتبقي" value={remaining} isVisible={isVisible} className={cn(remaining >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")} />
                </div>
                
                <div className="px-2 space-y-2">
                    {isBudgetSet && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                                    <div 
                                        className={cn(
                                            "absolute h-full rounded-full transition-all duration-500",
                                            isOverspendingTime ? "bg-destructive" : "bg-primary"
                                        )}
                                        style={{ width: `${timeProgress}%`}}
                                    />
                                </div>
                            </TooltipTrigger>
                             <TooltipContent>
                              <p className="text-xs">
                                {isOverspendingTime 
                                    ? `إنفاقك أسرع من الوقت. لقد أنفقت ${spentPercentage.toFixed(0)}% من ميزانيتك، بينما مر ${timeProgress.toFixed(0)}% من الشهر.`
                                    : `أداؤك جيد. لقد أنفقت ${spentPercentage.toFixed(0)}% من ميزانيتك، وقد مر ${timeProgress.toFixed(0)}% من الشهر.`
                                }
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                    )}

                     <div className="flex justify-between items-center text-xs">
                        <StatItem label="خارج الميزانية" value={outOfBudget} isVisible={isVisible} className="text-blue-500 !text-sm" />
                        {isBudgetSet && (
                            <p className="text-muted-foreground">{timeProgress.toFixed(0)}% من الشهر</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
