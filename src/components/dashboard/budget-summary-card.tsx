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
                
                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <StatItem label="الميزانية" value={totalBudget} isVisible={isVisible} />
                    <StatItem label="المصروف" value={totalSpent} isVisible={isVisible} className="text-destructive" />
                    <StatItem label="المتبقي" value={remaining} isVisible={isVisible} className={cn(remaining >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")} />
                </div>
                
                 <div className="px-2 space-y-3">
                    {isBudgetSet && (
                        <div className="relative w-full">
                            {/* Spending Percentage Label */}
                            <div
                                className="absolute bottom-full mb-1 text-xs font-semibold text-muted-foreground"
                                style={{
                                    right: `clamp(2%, ${spentPercentage}%, 98%)`,
                                    transform: 'translateX(50%)',
                                }}
                            >
                                {spentPercentage.toFixed(0)}%
                            </div>

                            {/* Main Progress Bar Container */}
                            <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                                {/* The actual progress bar */}
                                <div 
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        isOverspendingTime ? "bg-destructive" : "bg-primary"
                                    )}
                                    style={{ width: `${spentPercentage}%`}}
                                />
                                
                                {/* Weekly Markers */}
                                {[25, 50, 75].map(pos => (
                                    <div
                                        key={pos}
                                        className="absolute top-0 h-full w-px bg-background/70"
                                        style={{ right: `${pos}%`, transform: 'translateX(50%)' }}
                                    ></div>
                                ))}

                                 {/* Current Spend Marker */}
                                <div
                                    className="absolute top-0 h-full w-px bg-foreground/50"
                                    style={{
                                        right: `${spentPercentage}%`,
                                        transform: 'translateX(50%)',
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xs pt-1">
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
