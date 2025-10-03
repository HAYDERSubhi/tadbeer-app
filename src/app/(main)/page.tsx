// src/app/(main)/page.tsx

"use client";

import { useState, useMemo, Fragment, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles, History, Pencil, CreditCard, Mic, StopCircle, MoreHorizontal, DollarSign, Loader2, ArrowRight, Receipt, Plus, FileScan } from "lucide-react";
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, isToday, addDays, isSameDay, addMonths, addQuarters, addYears, startOfDay, isFuture, startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth, startOfWeek, endOfWeek, addWeeks, parseISO, isPast, differenceInDays, getDate, compareDesc } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { financialCoach, type FinancialCoachOutput, type FinancialCoachInput } from '@/ai/flows/financial-coach';
import { recordExpenseAction } from '@/app/actions';
import type { RecordExpenseWithTextInput, RecordExpenseWithTextOutput } from '@/ai/flows/record-expense-text';
import { Skeleton } from '@/components/ui/skeleton';
import OnboardingTour from '@/components/tour/onboarding-tour';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteExpense } from '@/services/firestore';
import { useAppData } from '@/hooks/use-app-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InsightIcon } from '@/components/dashboard/insight-icon';
import { useIsMobile } from '@/hooks/use-mobile';
import Image from 'next/image';
import { useCategories } from '@/hooks/use-categories';
import BudgetSummaryCard from '@/components/dashboard/budget-summary-card';


const tourSteps = [
  {
    selector: '',
    title: 'أهلاً بك في تطبيق تدبير!',
    content: 'هذه جولة سريعة لمساعدتك على استكشاف الميزات الرئيسية. يمكنك تخطيها في أي وقت.',
    placement: 'center',
  },
  {
    selector: '#budget-summary-card',
    title: 'ملخص الميزانية',
    content: 'هنا يمكنك رؤية ملخص سريع لميزانيتك. اضغط على أيقونة العين لإخفاء الأرقام.',
    placement: 'bottom',
  },
  {
    selector: '#expense-input-card',
    title: 'إضافة المصروفات',
    content: 'استخدم هذه الأزرار لإضافة مصروفاتك بسهولة عبر الكتابة، الصوت، أو مسح الفواتير.',
    placement: 'bottom',
  },
   {
    selector: '#smart-insights-card',
    title: 'النصائح الذكية',
    content: 'يقوم مدربك المالي بتحليل إنفاقك وتقديم نصائح مخصصة لك هنا.',
    placement: 'top',
  },
  {
    selector: '#main-navigation',
    title: 'التنقل في التطبيق',
    content: 'استخدم هذا الشريط للتنقل بين الصفحات الرئيسية: الإحصائيات، الأهداف، والإعدادات.',
    placement: 'top',
  }
];

// Main Dashboard Component
export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { categories, categoryMap, getIconComponent } = useCategories();

  const { expenses, userSettings, isLoading: isAppDataLoading } = useAppData();

  const [insights, setInsights] = useState<FinancialCoachOutput['insights'] | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(true);
  
  const [isVoiceReviewOpen, setIsVoiceReviewOpen] = useState(false);
  const [voiceExpenseData, setVoiceExpenseData] = useState<Partial<Expense> | null>(null);
  const [isCardSheetOpen, setIsCardSheetOpen] = useState(false);
  
  const recognitionRef = useRef<any | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const categoryMapForAI = useMemo(() => {
    return categories.reduce((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  const upcomingPayments = useMemo(() => {
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const allPayments = userSettings?.recurringPayments || [];
    
    return allPayments.filter(p => {
        const startDate = new Date(p.startDate);
        let nextDueDate = startDate;

        if (isFuture(nextDueDate) && !isSameDay(nextDueDate, tomorrow)) {
          return false;
        }

        switch (p.frequency) {
            case 'one-time':
                nextDueDate = startDate;
                break;
            case 'monthly':
                nextDueDate = new Date();
                nextDueDate.setDate(startDate.getDate());
                if (nextDueDate < new Date()) {
                    nextDueDate = addMonths(nextDueDate, 1);
                }
                const daysInMonth = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
                if(startDate.getDate() > daysInMonth) {
                  nextDueDate.setDate(daysInMonth);
                }
                break;
            case 'quarterly':
                nextDueDate = startDate;
                while (nextDueDate < new Date()) {
                    nextDueDate = addQuarters(nextDueDate, 1);
                }
                break;
            case 'annually':
                nextDueDate = startDate;
                while (nextDueDate < new Date()) {
                    nextDueDate = addYears(nextDueDate, 1);
                }
                break;
            default:
                return false;
        }

        return isSameDay(startOfDay(nextDueDate), tomorrow);
    });
  }, [userSettings]);


  // --- Voice Recording Logic ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'ar-IQ';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceTranscript(transcript);
      };

      recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          console.error('Speech recognition error', event.error);
          setVoiceError(`خطأ في التعرف على الصوت: \${event.error}`);
        }
        setIsVoiceRecording(false);
        setIsVoiceLoading(false);
      };
      
      recognition.onend = () => {
        setIsVoiceRecording(false);
        if(!isVoiceLoading) {
            setIsVoiceLoading(false); 
        }
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceError("متصفحك لا يدعم ميزة التعرف على الصوت.");
    }
  }, [isVoiceLoading]);

  const handleToggleVoiceRecording = () => {
    if (!recognitionRef.current) {
        toast({ title: "الميزة غير مدعومة", description: voiceError, variant: "destructive" });
        return;
    }
    if (isVoiceRecording) {
      recognitionRef.current.stop(); 
    } else {
      setVoiceError(null);
      setIsVoiceRecording(true);
      setIsVoiceLoading(false); 
      recognitionRef.current.start();
    }
  };
  
  const handleVoiceTranscript = async (transcript: string) => {
    setIsVoiceLoading(true);
    if (!transcript.trim()) {
        toast({ title: "لم يتم تسجيل أي صوت", variant: "destructive" });
        setIsVoiceLoading(false);
        return;
    }
    
    try {
        const input: RecordExpenseWithTextInput = {
            expenseText: transcript,
            categories: categoryMapForAI
        };
        const result: RecordExpenseWithTextOutput = await recordExpenseAction(input);
        
        setVoiceExpenseData({
            title: result.description, 
            amount: result.amount,
            category: result.category,
            date: result.date // Pass date string directly
        });
        setIsVoiceReviewOpen(true);

    } catch (e: any) {
        console.error("Error processing voice transcript:", e);
        toast({
            title: "خطأ في تحليل الصوت",
            description: "لم نتمكن من فهم طلبك. حاول التحدث بوضوح أكثر.",
            variant: "destructive",
        });
    } finally {
        setIsVoiceLoading(false);
        setIsVoiceRecording(false);
    }
  };


  const allSortedExpenses = useMemo(() => {
    if (!expenses) return [];
    return [...expenses].sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)));
  }, [expenses]);

  const monthlyExpenses = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return expenses.filter(exp => {
        try {
            return isWithinInterval(parseISO(exp.date), { start, end });
        } catch { return false; }
    });
  }, [expenses]);
  
  const financialCoachInput = useMemo(() => {
    // Crucially, wait for userSettings to be loaded before creating the input
    if (isAppDataLoading || !userSettings) return null;

    const userBudget = userSettings.budget;
    
    if (monthlyExpenses.length === 0) {
        return null;
    }
    
    const categoryBudgets = userSettings.categoryBudgets;
    const userProfile = userSettings.profile;
    
    const input: FinancialCoachInput = {
        totalBudget: userBudget?.totalBudget || 0,
        zeroSpendDaysTarget: userBudget?.zeroSpendDaysTarget || 4,
        expenses: monthlyExpenses.map(e => ({
            title: e.title,
            amount: e.amount,
            category: categoryMap[e.category]?.name || e.category,
            date: format(new Date(e.date), 'yyyy-MM-dd'),
        })),
        appTone: userSettings.appTone || 'formal',
    };
    
    if (categoryBudgets) {
        input.categoryBudgets = categoryBudgets;
    }

    if (userProfile) {
        input.userProfile = {
            monthlyIncome: userProfile.monthlyIncome,
            familyMembers: userProfile.familyMembers?.map(({ id, ...rest }) => rest) || [],
        };
    }
    
    return input;
  }, [monthlyExpenses, userSettings, categoryMap, isAppDataLoading]);

  useEffect(() => {
    if (isAppDataLoading) {
      setIsInsightsLoading(true);
      return;
    }

    if (!user || !financialCoachInput) {
      setInsights([]);
      setIsInsightsLoading(false);
      return;
    }

    const getInsights = async () => {
      setIsInsightsLoading(true);
      try {
        const result = await financialCoach(financialCoachInput);
        setInsights(result.insights);
      } catch (e) {
        console.error("Failed to get financial insights", e);
        setInsights(null);
      } finally {
        setIsInsightsLoading(false);
      }
    };
    getInsights();
  }, [user, financialCoachInput, isAppDataLoading]);
  
  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(user!.uid, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
      toast({ title: "تم الحذف", description: "تم حذف المصروف بنجاح." });
    },
    onError: () => {
      toast({ title: "خطأ", description: "لم نتمكن من حذف المصروف.", variant: "destructive" });
    }
  });

  const handleDeleteExpense = (expenseId: string) => {
    if (!user) return;
    deleteMutation.mutate(expenseId);
  };

  const budgetData = useMemo(() => {
    const totalBudget = userSettings?.budget?.totalBudget || 0;
    
    const inBudgetExpenses = monthlyExpenses.filter(e => !e.isOutOfBudget);
    const outOfBudgetExpenses = monthlyExpenses.filter(e => e.isOutOfBudget);

    const totalSpent = inBudgetExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const spentOutOfBudget = outOfBudgetExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const remaining = totalBudget - totalSpent;
    
    const today = new Date();
    const daysInMonth = getDaysInMonth(today);
    const currentDay = getDate(today);
    const timeProgress = (currentDay / daysInMonth) * 100;
    const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    
    return {
      totalBudget,
      totalSpent,
      remaining,
      spentOutOfBudget,
      timeProgress,
      spentPercentage,
    };
  }, [monthlyExpenses, userSettings]);
  
  const ExpenseListItem = ({ expense }: { expense: Expense }) => {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const categoryInfo = categoryMap[expense.category];
    
    const EditComponent = isMobile ? Sheet : Dialog;
    
    return (
      <Fragment>
        <li className="flex items-center p-2 transition-colors hover:bg-muted/50 rounded-lg">
          <div className="flex flex-1 items-center gap-3 overflow-hidden">
            <span className={cn("flex h-auto w-auto shrink-0 items-center justify-center text-xl text-muted-foreground")}>
              {categoryInfo ? getIconComponent(categoryInfo.icon) : '💸'}
            </span>
            <div className='overflow-hidden'>
              <p className="font-semibold truncate text-xs">{expense.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-end">
              <p className="font-bold text-foreground text-sm">{expense.amount.toLocaleString()}&nbsp;د.ع</p>
            </div>
            <EditComponent open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                   <DropdownMenuItem onSelect={() => setIsEditOpen(true)}>
                      <Pencil className="ml-2 h-4 w-4" />
                      تعديل
                    </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDeleteExpense(expense.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="ml-2 h-4 w-4" />
                    حذف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {isMobile ? (
                 <SheetContent side="bottom" className="flex flex-col">
                    <div className="flex-1 overflow-y-auto px-6 pb-6">
                       <SheetHeader className="sr-only"><SheetTitle>تعديل المصروف</SheetTitle></SheetHeader>
                       <EditExpenseForm expense={expense} setOpen={setIsEditOpen} />
                    </div>
                </SheetContent>
              ) : (
                <DialogContent>
                    <EditExpenseForm expense={expense} setOpen={setIsEditOpen} />
                </DialogContent>
              )}
            </EditComponent>
          </div>
        </li>
      </Fragment>
    );
  }

  const userBudget = userSettings?.budget || { totalBudget: 0 };
  const hasExpenses = expenses.length > 0;
  
  const VoiceReviewComponent = isMobile ? Sheet : Dialog;
  const CardComponent = isMobile ? Sheet : Dialog;
  
  return (
    <div className="space-y-3 pb-24">
      <OnboardingTour steps={tourSteps} tourKey="tadbeer-onboarding-tour-v2" />
      
      {upcomingPayments.length > 0 && (
        <Alert variant="destructive" className="animate-in fade-in">
          <AlertTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" />تذكير بدفعة مستحقة غداً!</AlertTitle>
          <AlertDescription>
            <ul>
              {upcomingPayments.map(p => (
                <li key={p.id}>- {p.title} بمبلغ {p.amount.toLocaleString()} د.ع</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {userBudget.totalBudget > 0 ? (
        <BudgetSummaryCard
            totalBudget={budgetData.totalBudget}
            totalSpent={budgetData.totalSpent}
            remaining={budgetData.remaining}
            outOfBudget={budgetData.spentOutOfBudget}
            spentPercentage={budgetData.spentPercentage}
            timeProgress={budgetData.timeProgress}
        />
      ) : (
        <Card>
            <CardContent className="p-4 text-center">
               <h3 className='font-semibold text-sm'>أهلاً بك في تدبير</h3>
               <p className='text-xs text-muted-foreground'>ابدأ بتحديد ميزانية شهرية من الإعدادات لإطلاق العنان لقوة التطبيق.</p>
               <Button asChild size="sm" className='mt-3'>
                    <Link href="/settings">الذهاب إلى الإعدادات</Link>
               </Button>
            </CardContent>
        </Card>
      )}
      
      {/* --- Combined Budget and Input Card --- */}
      <Card id="expense-input-card" className="overflow-hidden">
        <CardContent className="py-2 px-4 space-y-3">
          {/* --- Expense Input Methods --- */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <Link href="/add-expense" className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Pencil className="w-6 h-6 sm:w-7 sm:h-7" />
                </span>
                <p className="font-semibold text-xs">يدوي</p>
            </Link>
            
            <div onClick={handleToggleVoiceRecording} aria-disabled={isVoiceLoading} className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                <span className={cn(
                    "flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors", 
                    isVoiceRecording && "bg-destructive/20 animate-pulse"
                )}>
                    {isVoiceLoading ? <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 text-foreground animate-spin" /> : 
                    isVoiceRecording ? <StopCircle className="w-6 h-6 sm:w-7 sm:h-7 text-destructive" /> : 
                    <Mic className="w-6 h-6 sm:w-7 sm:h-7" />}
                </span>
                <p className="font-semibold text-xs">
                    {isVoiceLoading ? 'تحليل' : isVoiceRecording ? 'استماع' : 'صوت'}
                </p>
            </div>

            <VoiceReviewComponent open={isVoiceReviewOpen} onOpenChange={setIsVoiceReviewOpen}>
              <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()}>
                 <SheetHeader className="sr-only">
                    <SheetTitle>مراجعة المصروف الصوتي</SheetTitle>
                    <SheetDescription>راجع المصروف الذي تم تحليله من صوتك واحفظه.</SheetDescription>
                 </SheetHeader>
                 <ManualExpenseForm 
                    key={JSON.stringify(voiceExpenseData)}
                    setOpen={setIsVoiceReviewOpen} 
                    initialData={voiceExpenseData} 
                 />
              </SheetContent>
            </VoiceReviewComponent>

            <Link href="/receipts" className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <FileScan className="w-6 h-6 sm:w-7 sm:h-7" />
                </span>
                <p className="font-semibold text-xs">فاتورة</p>
            </Link>
            
            <CardComponent open={isCardSheetOpen} onOpenChange={setIsCardSheetOpen}>
              <div onClick={() => setIsCardSheetOpen(true)} className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                  <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                      <CreditCard className="w-6 h-6 sm:w-7 sm:h-7" />
                  </span>
                  <p className="font-semibold text-xs">بطاقة</p>
              </div>
              <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <SheetHeader>
                    <SheetTitle>ربط بطاقة إلكترونية</SheetTitle>
                    <SheetDescription>
                      هذه الميزة قيد التطوير. حاليًا يمكنك تجربة محاكاة ربط البطاقة ومزامنة معاملاتها من صفحة الإعدادات.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="p-4 sm:p-6">
                    <Button asChild className="w-full mt-4">
                        <Link href="/settings">الذهاب إلى الإعدادات</Link>
                    </Button>
                  </div>
              </SheetContent>
            </CardComponent>
          </div>
        </CardContent>
      </Card>

      {/* Recent Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span>أحدث المصاريف</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          {allSortedExpenses.length > 0 ? (
            <ul className="divide-y divide-border">
              {allSortedExpenses.slice(0, 5).map((expense) => (
                <ExpenseListItem key={expense.id} expense={expense} />
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-10">لا توجد مصاريف مسجلة بعد.</p>
          )}
        </CardContent>
        {allSortedExpenses.length > 5 && (
            <CardFooter className="p-2">
                 <Button variant="ghost" asChild className="w-full">
                     <Link href="/expenses">
                        عرض كل المصاريف
                        <ArrowRight className="mr-2 h-4 w-4" />
                     </Link>
                </Button>
            </CardFooter>
        )}
      </Card>

      {/* Smart Insights Card */}
      <Card id="smart-insights-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>نصائح المدرب المالي</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isInsightsLoading ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 space-x-reverse"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>
              <div className="flex items-center space-x-4 space-x-reverse"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>
            </div>
          ) : insights && insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                   <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    insight.type === 'praise' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                    insight.type === 'tip' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                    insight.type === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                  )}>
                    <InsightIcon name={insight.icon} className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{insight.title}</p>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground p-4">
              {hasExpenses 
                ? "حدد ميزانية شهرية في الإعدادات لتفعيل نصائح المدرب المالي."
                : "لا توجد نصائح حاليًا. أضف بعض المصاريف للحصول على تحليلات."
              }
            </p>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
}
