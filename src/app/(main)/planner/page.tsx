
// src/app/(main)/planner/page.tsx
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { UserProfile, Goal } from '@/types';
import { financialPlanner, FinancialPlannerOutput, FinancialPlannerInput } from '@/ai/flows/financial-planner';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2Icon, Goal as GoalIcon, Target, CheckCircle2, XCircle, ArrowRight, Lightbulb, PlusCircle, Trash2Icon, ChevronsRight, Flag, Calendar as CalendarIconLucide, Bot } from 'lucide-react';
import { format, differenceInMonths, isFuture } from 'date-fns';
import { arIQ } from 'date-fns/locale';
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
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addGoal, deleteGoal } from '@/services/firestore';
import { useToast } from '@/hooks/use-toast';

const goalSchema = z.object({
  name: z.string().min(3, { message: 'اسم الهدف مطلوب (3 أحرف على الأقل)' }),
  targetAmount: z.coerce.number().min(1, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  targetDate: z.date({ required_error: 'تاريخ الهدف مطلوب' }).refine(date => isFuture(date), { message: "يجب أن يكون التاريخ في المستقبل" }),
});
type GoalFormData = z.infer<typeof goalSchema>;

function PlannerContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const goalIdFromQuery = searchParams.get('goalId');

  const { goals, expenses, userSettings } = useAppData();

  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [activePlanId, setActivePlanId] = useState<string>('');
  
  const [plan, setPlan] = useState<FinancialPlannerOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
      if(selectedGoalId === deletedId) setSelectedGoalId('');
      if(activePlanId === deletedId) {
        setActivePlanId('');
        setPlan(null);
      }
    }
  });

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
    setActivePlanId(selectedGoal.id);
    setError(null);
    setPlan(null);

    try {
        const plannerInput: FinancialPlannerInput = {
            goal: { name: selectedGoal.name, targetAmount: selectedGoal.targetAmount, targetDate: format(new Date(selectedGoal.targetDate), 'yyyy-MM-dd') },
            userProfile: { monthlyIncome: userProfile.monthlyIncome, familyMembers: userProfile.familyMembers.map(({ id, ...rest}) => rest) },
            expenses: expenses.map(e => ({ ...e, category: defaultCategories[e.category as keyof typeof defaultCategories]?.name || e.category })),
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

  const calculateMonthsLeft = (targetDate: string) => {
    const months = differenceInMonths(new Date(targetDate), new Date());
    return months <= 0 ? 1 : months;
  };
  
  const renderPlan = () => {
    if (!plan || activePlanId !== selectedGoalId) return null;
    return (
        <Card className='mt-6 animate-in fade-in duration-500'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base font-semibold'>
                    {plan.isAchievable ? <CheckCircle2 className='h-5 w-5 text-green-500' /> : <XCircle className='h-5 w-5 text-orange-500' />}
                    خطة تحقيق هدف: {selectedGoal?.name}
                </CardTitle>
                <CardDescription>{plan.initialAssessment}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Alert variant={plan.isAchievable ? "default" : "destructive"}>
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>{plan.isAchievable ? "الهدف قابل للتحقيق!" : "الهدف قد يكون صعب التحقيق"}</AlertTitle>
                    <AlertDescription>
                        تحتاج لتوفير مبلغ <span className='font-bold'>{plan.savingsRequiredPerMonth.toLocaleString()} د.ع</span> شهريًا.
                        {!plan.isAchievable && " بناءً على دخلك ومصاريفك الحالية، قد يكون هذا المبلغ مرتفعاً. الخطة أدناه ستساعدك على محاولة الوصول إليه."}
                    </AlertDescription>
                </Alert>
                <div>
                    <h3 className='font-semibold mb-2'>خطواتك المقترحة:</h3>
                    <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                        {plan.suggestedPlan.map((step, index) => (
                           <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className='text-base'><div className='flex items-center gap-3 text-right'><div className='bg-primary/10 text-primary p-2 rounded-full h-10 w-10 flex items-center justify-center font-bold text-lg'>{index + 1}</div><span>{step.title}</span></div></AccordionTrigger>
                                <AccordionContent className="p-4 space-y-2 text-base"><p>{step.description}</p><p className='text-sm text-muted-foreground'><span className='font-semibold text-primary'>التوفير الشهري المقترح:</span> {step.suggestedMonthlySaving.toLocaleString()} د.ع</p>{step.categoryToImpact && (<p className='text-sm text-muted-foreground'><span className='font-semibold'>الفئة المتأثرة:</span> {step.categoryToImpact}</p>)}</AccordionContent>
                           </AccordionItem>
                        ))}
                    </Accordion>
                </div>
                 <div className="p-4 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200 rounded-lg border border-teal-200 dark:border-teal-700"><p className="font-bold">رسالة من مدربك المالي:</p><p>{plan.motivationalMessage}</p></div>
            </CardContent>
        </Card>
    )
  }

  const renderInitialState = () => {
    if (!userProfile || !userProfile.monthlyIncome || !userProfile.familyMembers || userProfile.familyMembers.length === 0) {
         return (
             <Alert variant="destructive">
                <GoalIcon className="h-4 w-4" />
                <AlertTitle>معلومات غير مكتملة</AlertTitle>
                <AlertDescription>لإنشاء خطة مالية دقيقة، يرجى إكمال ملفك الشخصي (الدخل الشهري وأفراد الأسرة) في صفحة الإعدادات.</AlertDescription>
            </Alert>
        )
    }
    return null;
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            أهدافي والمخطط الذكي
        </h1>
        <p className="text-muted-foreground mt-1">
            أضف أهدافك الكبيرة، ثم اختر هدفًا ودع الذكاء الاصطناعي يرسم لك خريطة الطريق.
        </p>
      </div>
      
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="add-goal" className="border-b-0">
          <Card>
            <AccordionTrigger className="hover:no-underline w-full p-0">
              <CardHeader className="w-full">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <PlusCircle className="h-5 w-5" /> إضافة هدف جديد
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <form onSubmit={form.handleSubmit(handleAddGoal)} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="name">ما هو هدفك؟</Label><Input id="name" {...form.register('name')} placeholder="مثال: شراء سيارة جديدة، السفر" />{form.formState.errors.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>}</div>
                  <div className="space-y-2"><Label htmlFor="targetAmount">كم المبلغ المطلوب؟ (د.ع)</Label><Input id="targetAmount" type="number" {...form.register('targetAmount')} placeholder="مثال: 15,000,000" />{form.formState.errors.targetAmount && <p className="text-sm text-destructive mt-1">{form.formState.errors.targetAmount.message}</p>}</div>
                  <div className="space-y-2"><Label>متى تريد تحقيق الهدف؟</Label><Controller name="targetDate" control={form.control} render={({ field }) => (<Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: arIQ }) : <span>اختر تاريخ الهدف</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus dir="rtl" locale={arIQ} disabled={(date) => date < new Date() || date < new Date("1900-01-01")} /></PopoverContent></Popover>)} />{form.formState.errors.targetDate && <p className="text-sm text-destructive mt-1">{form.formState.errors.targetDate.message}</p>}</div>
                  <Button type="submit" className="w-full" disabled={addGoalMutation.isPending}>{addGoalMutation.isPending ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin" /> جاري الإضافة...</> : 'أضف الهدف'}</Button>
                </form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
      
      <div className="space-y-4">
        <h2 className="text-lg font-bold">قائمة الأهداف والمخطط</h2>
        {goals.length === 0 ? (
          <Card className='text-center py-12'>
            <CardContent className="flex flex-col items-center gap-4"><Flag className="h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">لا توجد أهداف محددة بعد. ابدأ بإضافة هدفك الأول!</p></CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map(goal => {
               const monthsLeft = calculateMonthsLeft(goal.targetDate);
               const monthlySavings = goal.targetAmount / monthsLeft;
               const isSelected = selectedGoalId === goal.id;
               return (
                  <Card key={goal.id} className={cn("flex flex-col", isSelected && "border-primary ring-2 ring-primary")}>
                    <CardHeader className='pb-4'>
                      <CardTitle className='flex justify-between items-start text-base font-semibold'>
                        <span className="truncate pr-4">{goal.name}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"><Trash2Icon className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف هذا الهدف بشكل دائم. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteGoal(goal.id)}>نعم، قم بالحذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </CardTitle>
                      <CardDescription>تاريخ الهدف: {format(new Date(goal.targetDate), 'MMMM yyyy', { locale: arIQ })}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2">
                        <p className="text-2xl font-bold text-primary">{goal.targetAmount.toLocaleString()} د.ع</p>
                        <p className="text-sm text-muted-foreground">تحتاج لتوفير ما يقارب <span className="font-bold text-foreground">{monthlySavings.toLocaleString(undefined, {maximumFractionDigits: 0})} د.ع</span> شهريًا.</p>
                    </CardContent>
                    <CardFooter>
                      <Button onClick={() => setSelectedGoalId(goal.id)} className="w-full" variant={isSelected ? "default" : "outline"}>
                        {isSelected ? 'الهدف محدد' : 'حدد هذا الهدف'}
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
            <CardContent className="p-6 space-y-4 text-center">
                 <Label>الهدف المختار: <span className="font-bold text-primary">{selectedGoal?.name || "لم يتم اختيار هدف"}</span></Label>
                <Button onClick={handleGeneratePlan} disabled={isGenerating || !selectedGoalId || !userProfile?.monthlyIncome} className="w-full">
                    {isGenerating && activePlanId === selectedGoalId ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin" /> جاري إنشاء الخطة...</> : <><Bot className="ml-2 h-4 w-4" /> أنشئ الخطة الذكية لي</>}
                </Button>
            </CardContent>
        </Card>
      )}

      {!userProfile?.monthlyIncome && goals.length > 0 && renderInitialState()}

      {error && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertTitle>خطأ</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      
      {(isGenerating && activePlanId === selectedGoalId) && 
        <div className='space-y-4 mt-6'>
            <Skeleton className='h-12 w-full' /><Skeleton className='h-24 w-full' /><Skeleton className='h-48 w-full' />
        </div>
      }
      
      {plan && activePlanId === selectedGoalId && renderPlan()}

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

    