// src/app/(main)/planner/page.tsx
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { UserProfile, Goal } from '@/types';
import { financialPlanner, FinancialPlannerOutput, FinancialPlannerInput } from '@/ai/flows/financial-planner';
import { subMonths, isAfter, parseISO as parseDateISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2Icon, Goal as GoalIcon, Target, CheckCircle2, XCircle, ArrowRight, Lightbulb, PlusCircle, Trash2Icon, ChevronsRight, Flag, Calendar as CalendarIconLucide, Bot, Vault, TrendingUp, Edit3 } from 'lucide-react';
import { format, differenceInCalendarMonths, isFuture, parseISO } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { cn } from '@/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addGoal, deleteGoal, updateGoalSavedAmount } from '@/services/firestore';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/use-categories';
import { useCurrency } from '@/hooks/use-currency';

const goalSchema = z.object({
  name: z.string().min(3, { message: 'اسم الهدف مطلوب (3 أحرف على الأقل)' }),
  targetAmount: z.coerce.number().min(1, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  targetDate: z.date({ required_error: 'تاريخ الهدف مطلوب' }).refine(date => isFuture(date), { message: "يجب أن يكون التاريخ في المستقبل" }),
});
type GoalFormData = z.infer<typeof goalSchema>;

const formatNumberWithCommas = (value: string | number | undefined) => {
    if (value === null || value === undefined || value === '') return '';
    const numericString = String(value).replace(/,/g, '');
    const number = Number(numericString);
    if (isNaN(number)) return '';
    return new Intl.NumberFormat('en-US').format(number);
};

const parseFormattedNumber = (value: string | undefined) => {
    if (!value) return '';
    return value.replace(/,/g, '');
};


function PlannerContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { categoryMap } = useCategories();
  const { format: formatCurrency } = useCurrency();
  const goalIdFromQuery = searchParams.get('goalId');

  const { goals, expenses, userSettings } = useAppData();

  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [planEnabled, setPlanEnabled] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [editingSavingId, setEditingSavingId] = useState<string | null>(null);
  const [savingInput, setSavingInput] = useState<string>('');
  
  const userProfile: UserProfile | undefined = userSettings?.profile;
  
  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: { name: '', targetAmount: 0 },
  });

  // Set initial goal from query params or first available goal
  useEffect(() => {
    if (goalIdFromQuery && goals.some(g => g.id === goalIdFromQuery)) {
        setSelectedGoalId(goalIdFromQuery);
    } else if (goals.length > 0 && !selectedGoalId) {
        setSelectedGoalId(goals[0].id);
    }
  }, [goalIdFromQuery, goals, selectedGoalId]);
  
  const selectedGoal = useMemo(() => goals.find(g => g.id === selectedGoalId), [goals, selectedGoalId]);

  // Reset plan when user switches to a different goal
  useEffect(() => {
    setPlanEnabled(false);
  }, [selectedGoalId]);

  // Limit expenses to last 6 months to avoid token overflows
  const recentExpenses = useMemo(() => {
    const cutoff = subMonths(new Date(), 6);
    return expenses.filter(e => {
      try { return isAfter(parseDateISO(e.date), cutoff); }
      catch { return false; }
    });
  }, [expenses]);

  // Stable cache key — only regenerates if goal or income changes
  const planCacheKey = useMemo(() => {
    if (!selectedGoal || !userProfile?.monthlyIncome) return null;
    return `plan-${selectedGoal.id}-${selectedGoal.targetAmount}-${userProfile.monthlyIncome}`;
  }, [selectedGoal, userProfile?.monthlyIncome]);

  const {
    data: plan,
    isFetching: isGenerating,
    error: planError,
    refetch: refetchPlan,
  } = useQuery<FinancialPlannerOutput>({
    queryKey: ['financial-plan', planCacheKey],
    queryFn: async () => {
      if (!selectedGoal || !userProfile?.monthlyIncome) throw new Error('missing data');
      const input: FinancialPlannerInput = {
        goal: {
          name: selectedGoal.name,
          targetAmount: selectedGoal.targetAmount,
          targetDate: format(new Date(selectedGoal.targetDate), 'yyyy-MM-dd'),
        },
        userProfile: {
          monthlyIncome: userProfile.monthlyIncome,
          familyMembers: userProfile.familyMembers?.map(({ id, ...rest }) => rest) || [],
        },
        appTone: userSettings?.appTone ?? 'formal',
        expenses: recentExpenses.map(e => ({
          ...e,
          category: categoryMap[e.category]?.name || e.category,
        })),
        userMessage: "أريد خطة مفصلة لتحقيق هذا الهدف.",
      };
      return financialPlanner(input);
    },
    enabled: planEnabled && !!planCacheKey,
    staleTime: 1000 * 60 * 15, // 15 minutes — don't re-fetch unless goal changes
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  const addGoalMutation = useMutation({
    mutationFn: (newGoal: Omit<Goal, 'id' | 'createdAt' | 'uid'>) => addGoal(user!.uid, newGoal),
    onSuccess: (newGoalId) => {
        queryClient.invalidateQueries({ queryKey: ['goals', user?.uid] });
        toast({
          title: "تم إضافة الهدف!",
          description: `هدف جديد أضيف بنجاح.`,
        });
        form.reset();
        setSelectedGoalId(newGoalId); // Select the new goal
    },
    onError: () => {
         toast({ title: "خطأ", description: "لم يتمكن من إضافة الهدف.", variant: "destructive" });
    }
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: string) => deleteGoal(user!.uid, goalId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.uid] });
      toast({ title: "تم الحذف", description: "تم حذف الهدف المالي بنجاح." });
      if(selectedGoalId === deletedId) {
        setSelectedGoalId('');
        setPlanEnabled(false);
      }
    }
  });

  const updateSavingMutation = useMutation({
    mutationFn: ({ goalId, amount }: { goalId: string; amount: number }) =>
      updateGoalSavedAmount(user!.uid, goalId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', user?.uid] });
      setEditingSavingId(null);
      setSavingInput('');
      toast({ title: "تم التحديث", description: "تم حفظ مبلغ التوفير بنجاح." });
    },
  });

  const handleSaveSaving = (goalId: string, currentSaved: number) => {
    const parsed = Number(savingInput.replace(/,/g, ''));
    if (isNaN(parsed) || parsed < 0) return;
    updateSavingMutation.mutate({ goalId, amount: parsed });
  };

  const handleAddGoal = (data: GoalFormData) => {
    if (!user) return;
    const newGoalData = {
      name: data.name,
      targetAmount: data.targetAmount,
      targetDate: data.targetDate.toISOString(),
    };
    addGoalMutation.mutate(newGoalData);
  };
  
  const handleDeleteGoal = (goalId: string) => {
    if (!user) return;
    deleteGoalMutation.mutate(goalId);
  };

  const handleGeneratePlan = () => {
    if (planEnabled && plan) {
      // Already have a cached plan — force refresh
      refetchPlan();
    } else {
      setPlanEnabled(true);
    }
  };

  const calculateMonthsLeft = (targetDate: string) => {
    const months = differenceInCalendarMonths(parseISO(targetDate), new Date());
    return months <= 0 ? 1 : months;
  };
  
  const error = planError ? "حدث خطأ أثناء إنشاء الخطة. يرجى المحاولة مرة أخرى." : null;

  const renderPlan = () => {
    if (!plan) return null;
    return (
        <Card className='mt-6 animate-in fade-in duration-500'>
            <CardHeader className="py-4">
                <CardTitle className='flex items-center gap-2 text-sm font-semibold'>
                    {plan.isAchievable ? <CheckCircle2 className='h-4 w-4 text-green-500' /> : <XCircle className='h-4 w-4 text-orange-500' />}
                    خطة هدف: {selectedGoal?.name}
                </CardTitle>
                <CardDescription className="text-xs">{plan.initialAssessment}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert variant={plan.isAchievable ? "default" : "destructive"} className="p-3">
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle className="text-xs font-semibold">{plan.isAchievable ? "الهدف قابل للتحقيق" : "الهدف صعب التحقيق"}</AlertTitle>
                    <AlertDescription className="text-xs">
                        تحتاج لتوفير <span className='font-bold'>{formatCurrency(plan.savingsRequiredPerMonth)}</span> شهريًا.
                        {!plan.isAchievable && " هذا قد يكون صعبًا. الخطة أدناه ستساعدك."}
                    </AlertDescription>
                </Alert>
                <div>
                    <h3 className='font-semibold mb-2 text-sm'>الخطوات المقترحة:</h3>
                    <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                        {plan.suggestedPlan.map((step, index) => (
                           <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className='text-sm py-3'><div className='flex items-center gap-2 text-right'><div className='bg-primary/10 text-primary p-1 rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm'>{index + 1}</div><span>{step.title}</span></div></AccordionTrigger>
                                <AccordionContent className="p-3 space-y-2 text-xs"><p>{step.description}</p><p className='text-muted-foreground'><span className='font-semibold text-primary'>التوفير الشهري:</span> {formatCurrency(step.suggestedMonthlySaving)}</p>{step.categoryToImpact && (<p className='text-muted-foreground'><span className='font-semibold'>الفئة المتأثرة:</span> {step.categoryToImpact}</p>)}</AccordionContent>
                           </AccordionItem>
                        ))}
                    </Accordion>
                </div>
                 <div className="p-3 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200 rounded-lg border border-teal-200 dark:border-teal-700 text-xs"><p className="font-bold">رسالة المدرب:</p><p>{plan.motivationalMessage}</p></div>
            </CardContent>
        </Card>
    )
  }

  const renderInitialState = () => {
    if (!userProfile || !userProfile.monthlyIncome || !userProfile.familyMembers || userProfile.familyMembers.length === 0) {
         return (
             <Alert variant="destructive" className="p-3">
                <GoalIcon className="h-4 w-4" />
                <AlertTitle className="text-xs font-bold">معلومات غير مكتملة</AlertTitle>
                <AlertDescription className="text-xs">لإنشاء خطة، أكمل ملفك الشخصي (الدخل والأسرة) في الإعدادات.</AlertDescription>
            </Alert>
        )
    }
    return null;
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-base font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            الأهداف والمخطط الذكي
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
            أضف أهدافك، ودع الذكاء الاصطناعي يرسم لك الطريق.
        </p>
      </div>
      
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="add-goal" className="border-b-0">
          <Card>
            <AccordionTrigger className="hover:no-underline w-full p-0">
              <CardHeader className="w-full py-3">
                <CardTitle className="flex items-center gap-2 text-xs font-semibold">
                  <PlusCircle className="h-4 w-4" /> إضافة هدف جديد
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <form onSubmit={form.handleSubmit(handleAddGoal)} className="space-y-3">
                  <div className="space-y-1"><Label htmlFor="name" className="text-xs">ما هو هدفك؟</Label><Input id="name" {...form.register('name')} placeholder="مثال: شراء سيارة" className="h-9 text-xs" />{form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}</div>
                  <div className="space-y-1">
                    <Label htmlFor="targetAmount" className="text-xs">المبلغ المطلوب (د.ع)</Label>
                     <Controller
                        name="targetAmount"
                        control={form.control}
                        render={({ field: { onChange, value, ...restField } }) => (
                            <Input
                                {...restField}
                                id="targetAmount"
                                type="text"
                                inputMode="decimal"
                                placeholder="15,000,000"
                                className="h-9 text-xs"
                                value={value === 0 ? '' : formatNumberWithCommas(value)}
                                onChange={(e) => {
                                    const parsed = parseFormattedNumber(e.target.value);
                                    if (parsed === '' || !isNaN(Number(parsed))) {
                                        onChange(parsed === '' ? 0 : Number(parsed));
                                    }
                                }}
                                onFocus={(e) => {
                                    if (parseFormattedNumber(e.target.value) === '0') {
                                        onChange(undefined);
                                    }
                                }}
                                onBlur={(e) => {
                                    if (parseFormattedNumber(e.target.value) === '') {
                                        onChange(0);
                                    }
                                }}
                            />
                        )}
                    />
                    {form.formState.errors.targetAmount && <p className="text-xs text-destructive mt-1">{form.formState.errors.targetAmount.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">متى تريد تحقيقه؟</Label>
                    <Controller 
                      name="targetDate" 
                      control={form.control} 
                      render={({ field }) => (
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-xs", !field.value && "text-muted-foreground")}>
                                    <CalendarIconLucide className="mr-2 h-3 w-3" />
                                    {field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخاً</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar 
                                    mode="single" 
                                    selected={field.value} 
                                    onSelect={(date) => {
                                        field.onChange(date);
                                        setIsCalendarOpen(false);
                                    }} 
                                    initialFocus 
                                    dir="rtl" 
                                    locale={arIQ} 
                                    disabled={(date) => date < new Date() || date < new Date("1900-01-01")} 
                                />
                            </PopoverContent>
                        </Popover>
                      )} 
                    />
                    {form.formState.errors.targetDate && <p className="text-xs text-destructive mt-1">{form.formState.errors.targetDate.message}</p>}
                  </div>
                  <Button type="submit" className="w-full text-xs h-9" disabled={addGoalMutation.isPending}>{addGoalMutation.isPending ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin" /> جاري الإضافة...</> : 'أضف الهدف'}</Button>
                </form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
      
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">قائمة الأهداف والمخطط</h2>
        {goals.length === 0 ? (
          <Card className='text-center py-10'>
            <CardContent className="flex flex-col items-center gap-3"><Flag className="h-10 w-10 text-muted-foreground" /><p className="text-xs text-muted-foreground">لا توجد أهداف. ابدأ بإضافة هدفك الأول!</p></CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {goals.map(goal => {
               const monthsLeft = calculateMonthsLeft(goal.targetDate);
               const monthlySavings = goal.targetAmount / monthsLeft;
               const isSelected = selectedGoalId === goal.id;
               return (
                  <Card key={goal.id} className={cn("flex flex-col", isSelected && "border-primary ring-2 ring-primary")}>
                    <CardHeader className='pb-3 pt-4'>
                      <CardTitle className='flex justify-between items-start text-sm font-semibold'>
                        <span className="truncate pr-4">{goal.name}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"><Trash2Icon className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف هذا الهدف بشكل دائم. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteGoal(goal.id)}>نعم، قم بالحذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </CardTitle>
                      <CardDescription className="text-xs">تاريخ الهدف: {format(new Date(goal.targetDate), 'MMMM yyyy', { locale: arIQ })}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2">
                        <p className="text-lg font-bold text-primary">{formatCurrency(goal.targetAmount)}</p>
                        <p className="text-xs text-muted-foreground">تحتاج لتوفير ~<span className="font-bold text-foreground">{formatCurrency(Math.round(monthlySavings))}</span> شهريًا.</p>
                        {/* ── Progress bar ── */}
                        {(() => {
                          const saved = goal.savedAmount ?? 0;
                          const pct = Math.min(Math.round((saved / goal.targetAmount) * 100), 100);
                          return (
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1"><Vault className="h-3 w-3" /> وفّرت: <span className="font-bold text-foreground">{formatCurrency(saved)}</span></span>
                                <span className="font-bold text-primary">{pct}%</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                <div
                                  className={cn("h-2 rounded-full transition-all duration-500", pct >= 100 ? "bg-green-500" : "bg-primary")}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              {/* Edit saving */}
                              {editingSavingId === goal.id ? (
                                <div className="flex gap-1 pt-1">
                                  <Input
                                    autoFocus
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="المبلغ المُوفَّر"
                                    className="h-7 text-xs flex-1"
                                    value={savingInput}
                                    onChange={e => setSavingInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveSaving(goal.id, saved); if (e.key === 'Escape') setEditingSavingId(null); }}
                                  />
                                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleSaveSaving(goal.id, saved)} disabled={updateSavingMutation.isPending}>
                                    {updateSavingMutation.isPending ? <Loader2Icon className="h-3 w-3 animate-spin" /> : 'حفظ'}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingSavingId(null)}>إلغاء</Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingSavingId(goal.id); setSavingInput(String(saved)); }}
                                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors pt-0.5"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  {saved > 0 ? 'تحديث المبلغ المُوفَّر' : 'أدخل المبلغ المُوفَّر'}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                    </CardContent>
                    <CardFooter>
                      <Button onClick={() => setSelectedGoalId(goal.id)} className="w-full h-9 text-xs" variant={isSelected ? "default" : "outline"}>
                        {isSelected ? 'محدد' : 'حدد الهدف'}
                      </Button>
                    </CardFooter>
                  </Card>
               )
            })}
          </div>
        )}
      </div>
      
      {goals.length > 0 && (
         <Card>
            <CardContent className="p-4 space-y-2 text-center">
                 <Label className="text-xs">الهدف المختار: <span className="font-bold text-primary">{selectedGoal?.name || "اختر هدفًا"}</span></Label>
                <Button onClick={handleGeneratePlan} disabled={isGenerating || !selectedGoalId || !userProfile?.monthlyIncome} className="w-full h-10 text-sm">
                    {isGenerating
                      ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin" /> جاري الإنشاء...</>
                      : plan
                        ? <><Bot className="ml-2 h-4 w-4" /> تحديث الخطة</>
                        : <><Bot className="ml-2 h-4 w-4" /> أنشئ الخطة الذكية</>
                    }
                </Button>
            </CardContent>
        </Card>
      )}

      {!userProfile?.monthlyIncome && goals.length > 0 && renderInitialState()}

      {error && <Alert variant="destructive" className="p-3 text-xs"><XCircle className="h-4 w-4" /><AlertTitle className="font-semibold">خطأ</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      
      {isGenerating &&
        <div className='space-y-3 mt-4'>
            <Skeleton className='h-10 w-full' /><Skeleton className='h-20 w-full' /><Skeleton className='h-40 w-full' />
        </div>
      }

      {plan && !isGenerating && renderPlan()}

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
