// src/app/(main)/planner/page.tsx
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Goal, Expense, UserProfile } from '@/types';
import { financialPlanner, FinancialPlannerOutput, FinancialPlannerInput } from '@/ai/flows/financial-planner';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2Icon, BrainCircuit, Target, CheckCircle2, XCircle, ArrowRight, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { getGoals, getExpenses, getUserSettings } from '@/services/firestore';

function PlannerContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const goalIdFromQuery = searchParams.get('goalId');

  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  
  const [plan, setPlan] = useState<FinancialPlannerOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all necessary data using react-query
  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ['goals', user?.uid],
    queryFn: () => getGoals(user!.uid),
    enabled: !!user,
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ['expenses', user?.uid],
    queryFn: () => getExpenses(user!.uid),
    enabled: !!user,
  });
  
  const { data: userSettings, isLoading: settingsLoading } = useQuery({
      queryKey: ['userSettings', user?.uid],
      queryFn: () => getUserSettings(user!.uid),
      enabled: !!user,
  });
  const userProfile = userSettings?.profile;

  // Set initial goal from query params or first available goal
  useEffect(() => {
    if (goalsLoading) return;
    
    if (goalIdFromQuery && goals.some(g => g.id === goalIdFromQuery)) {
        setSelectedGoalId(goalIdFromQuery);
    } else if (goals.length > 0) {
        setSelectedGoalId(goals[0].id);
    }
  }, [goalIdFromQuery, goals, goalsLoading]);
  
  const selectedGoal = useMemo(() => goals.find(g => g.id === selectedGoalId), [goals, selectedGoalId]);

  const handleGeneratePlan = async () => {
    if (!selectedGoal) {
      setError("الرجاء اختيار هدف أولاً.");
      return;
    }
    if (!userProfile || !userProfile.monthlyIncome || !userProfile.familyMembers || userProfile.familyMembers.length === 0) {
      setError("الرجاء إكمال ملفك الشخصي في الإعدادات، خاصة الدخل الشهري وتفاصيل أفراد الأسرة.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPlan(null);

    try {
        const plannerInput: FinancialPlannerInput = {
            goal: {
                name: selectedGoal.name,
                targetAmount: selectedGoal.targetAmount,
                targetDate: format(new Date(selectedGoal.targetDate), 'yyyy-MM-dd'),
            },
            userProfile: {
                monthlyIncome: userProfile.monthlyIncome,
                familyMembers: userProfile.familyMembers.map(({ id, ...rest}) => rest), // remove id for AI
            },
            expenses: expenses.map(e => ({
                ...e,
                category: defaultCategories[e.category as keyof typeof defaultCategories]?.name || e.category,
            })),
            userMessage: "أريد خطة مفصلة لتحقيق هذا الهدف.",
        };

        const result = await financialPlanner(plannerInput);
        setPlan(result);
    } catch (e: any) {
        console.error("Error generating financial plan:", e);
        setError("حدث خطأ غير متوقع أثناء إنشاء الخطة. يرجى المحاولة مرة أخرى.");
    } finally {
        setIsGenerating(false);
    }
  };
  
  const renderPlan = () => {
    if (!plan) return null;

    return (
        <Card className='mt-6 animate-in fade-in duration-500'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    {plan.isAchievable ? 
                        <CheckCircle2 className='h-7 w-7 text-green-500' /> : 
                        <XCircle className='h-7 w-7 text-orange-500' />}
                    خطة تحقيق هدف: {selectedGoal?.name}
                </CardTitle>
                <CardDescription>{plan.initialAssessment}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Alert variant={plan.isAchievable ? "default" : "destructive"}>
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>
                        {plan.isAchievable ? "الهدف قابل للتحقيق!" : "الهدف قد يكون صعب التحقيق"}
                    </AlertTitle>
                    <AlertDescription>
                        تحتاج لتوفير مبلغ <span className='font-bold'>{plan.savingsRequiredPerMonth.toLocaleString()} د.ع</span> شهريًا.
                        {!plan.isAchievable && " بناءً على دخلك ومصاريفك الحالية، قد يكون هذا المبلغ مرتفعاً. الخطة أدناه ستساعدك على محاولة الوصول إليه."}
                    </AlertDescription>
                </Alert>

                <div>
                    <h3 className='text-lg font-semibold mb-2'>خطواتك المقترحة:</h3>
                    <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                        {plan.suggestedPlan.map((step, index) => (
                           <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className='text-base'>
                                    <div className='flex items-center gap-3 text-right'>
                                        <div className='bg-primary/10 text-primary p-2 rounded-full h-10 w-10 flex items-center justify-center font-bold text-lg'>{index + 1}</div>
                                        <span>{step.title}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 space-y-2 text-base">
                                    <p>{step.description}</p>
                                    <p className='text-sm text-muted-foreground'>
                                        <span className='font-semibold text-primary'>التوفير الشهري المقترح:</span> {step.suggestedMonthlySaving.toLocaleString()} د.ع
                                    </p>
                                    {step.categoryToImpact && (
                                        <p className='text-sm text-muted-foreground'>
                                            <span className='font-semibold'>الفئة المتأثرة:</span> {step.categoryToImpact}
                                        </p>
                                    )}
                                </AccordionContent>
                           </AccordionItem>
                        ))}
                    </Accordion>
                </div>
                
                 <div className="p-4 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200 rounded-lg border border-teal-200 dark:border-teal-700">
                    <p className="font-bold">رسالة من مدربك المالي:</p>
                    <p>{plan.motivationalMessage}</p>
                </div>
            </CardContent>
        </Card>
    )
  }

  const renderInitialState = () => {
    if (goalsLoading || settingsLoading) return <Skeleton className='w-full h-48' />;
    
    if (goals.length === 0) {
        return (
             <Card className="text-center py-12">
                <CardContent className="flex flex-col items-center gap-4">
                    <Target className="h-12 w-12 text-muted-foreground" />
                    <h3 className="text-xl font-bold">ليس لديك أهداف بعد!</h3>
                    <p className="text-muted-foreground">اذهب إلى صفحة الأهداف وأضف هدفك الأول لتبدأ التخطيط.</p>
                    <Button asChild>
                        <Link href="/goals">
                            اذهب إلى صفحة الأهداف
                            <ArrowRight className='mr-2 h-4 w-4' />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }
    if (!userProfile || !userProfile.monthlyIncome || !userProfile.familyMembers || userProfile.familyMembers.length === 0) {
         return (
             <Alert variant="destructive">
                <BrainCircuit className="h-4 w-4" />
                <AlertTitle>معلومات غير مكتملة</AlertTitle>
                <AlertDescription>
                    لإنشاء خطة مالية دقيقة، يرجى <Link href="/settings" className='font-bold underline'>إضافة دخلك الشهري وتفاصيل أفراد أسرتك</Link> في ملفك الشخصي بالإعدادات.
                </AlertDescription>
            </Alert>
        )
    }
    return null;
  }
  
  if (goalsLoading || expensesLoading || settingsLoading) {
      return (
        <div className="space-y-6 pb-24">
            <Skeleton className='h-12 w-1/2' />
            <Skeleton className='h-8 w-1/3' />
            <Skeleton className='h-48 w-full' />
        </div>
      );
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-primary" />
            المخطط المالي الذكي
        </h1>
        <p className="text-muted-foreground mt-2">
            اختر هدفًا، ودع الذكاء الاصطناعي يرسم لك خريطة الطريق لتحقيقه.
        </p>
      </div>

      {(goals.length > 0 && userProfile && userProfile.familyMembers && userProfile.familyMembers.length > 0) ? (
        <Card>
            <CardContent className="p-6 space-y-4">
                 <div>
                    <label htmlFor="goal-select" className="text-sm font-medium mb-2 block">اختر الهدف الذي تريد التخطيط له:</label>
                    <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                        <SelectTrigger id="goal-select">
                            <SelectValue placeholder="اختر هدفاً..." />
                        </SelectTrigger>
                        <SelectContent>
                            {goals.map(goal => (
                                <SelectItem key={goal.id} value={goal.id}>
                                    {goal.name} ( {goal.targetAmount.toLocaleString()} د.ع )
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleGeneratePlan} disabled={isGenerating || !selectedGoalId} className="w-full">
                    {isGenerating ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin" /> جاري إنشاء الخطة...</> : "أنشئ الخطة لي"}
                </Button>
            </CardContent>
        </Card>
      ) : renderInitialState()}

      {error && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertTitle>خطأ</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {isGenerating && 
        <div className='space-y-4 mt-6'>
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-24 w-full' />
            <Skeleton className='h-48 w-full' />
        </div>
      }
      {plan && renderPlan()}
    </div>
  );
}

export default function PlannerPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-[60vh]"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>}>
            <PlannerContent />
        </Suspense>
    )
}
