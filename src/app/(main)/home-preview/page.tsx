// src/app/(main)/home-preview/page.tsx
"use client";

import { useState, useMemo, Fragment, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2Icon, Sparkles, History, PencilIcon, FilePenLine, FileScan, CreditCard, Mic, Link2, Bell, AlertTriangleIcon, Loader2, StopCircle, CalendarClock, MoreHorizontal, DollarSign } from "lucide-react";
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, isToday, addDays, isSameDay, addMonths, addQuarters, addYears, startOfDay, startOfMonth, endOfMonth, isWithinInterval, isFuture } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { financialCoach, type FinancialCoachOutput } from '@/ai/flows/financial-coach';
import { recordExpenseAction } from '@/app/actions';
import type { RecordExpenseWithTextInput, RecordExpenseWithTextOutput } from '@/ai/flows/record-expense-text';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteExpense } from '@/services/firestore';
import { useAppData } from '@/hooks/use-app-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InsightIcon } from '@/components/dashboard/insight-icon';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

// Main Dashboard Component
export default function HomePreviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { expenses, userSettings } = useAppData();

  const [insights, setInsights] = useState<FinancialCoachOutput['insights'] | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(true);
  const [visibleExpensesCount, setVisibleExpensesCount] = useState(5);
  
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isVoiceReviewOpen, setIsVoiceReviewOpen] = useState(false);
  const [voiceExpenseData, setVoiceExpenseData] = useState<Partial<Expense> | null>(null);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  
  const recognitionRef = useRef<any | null>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    return Object.entries(defaultCategories).reduce((acc, [id, { name }]) => {
      acc[id] = name;
      return acc;
    }, {} as Record<string, string>);
  }, []);

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

  const budgetData = useMemo(() => {
    const today = new Date();
    const start = startOfDay(startOfMonth(today));
    const end = startOfDay(endOfMonth(today));
    const budget = userSettings?.budget || { totalBudget: 0 };

    const monthlyExpenses = expenses.filter(exp => {
        try {
            return isWithinInterval(startOfDay(new Date(exp.date)), { start, end });
        } catch {
            return false;
        }
    });

    const totalSpent = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const todaySpent = monthlyExpenses
      .filter(exp => isToday(new Date(exp.date)))
      .reduce((sum, exp) => sum + exp.amount, 0);

    const budgetTotal = budget.totalBudget;
    const remaining = budgetTotal - totalSpent;
    const progress = budgetTotal > 0 ? (totalSpent / budgetTotal) * 100 : 0;

    return {
        totalBudget: budgetTotal,
        monthlySpent: totalSpent,
        todaySpent,
        remainingBudget: remaining,
        progress: Math.min(progress, 100) // Cap at 100% for visual
    };
  }, [expenses, userSettings]);

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
        setIsVoiceRecording(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setVoiceError(`خطأ في التعرف على الصوت: ${event.error}`);
        setIsVoiceRecording(false);
        setIsVoiceLoading(false);
      };
      
      recognition.onend = () => {
        if (isVoiceRecording) {
            setIsVoiceRecording(false);
            setIsVoiceLoading(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceError("متصفحك لا يدعم ميزة التعرف على الصوت.");
    }
  }, [isVoiceRecording]);

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
      recognitionRef.current.start();
    }
  };
  
  const handleVoiceTranscript = async (transcript: string) => {
    if (!transcript.trim()) {
        toast({ title: "لم يتم تسجيل أي صوت", variant: "destructive" });
        return;
    }
    
    setIsVoiceLoading(true);
    try {
        const input: RecordExpenseWithTextInput = {
            expenseText: transcript,
            categories: categoryMap
        };
        const result: RecordExpenseWithTextOutput = await recordExpenseAction(input);
        
        setVoiceExpenseData({
            title: result.description || 'مصروف صوتي',
            amount: result.amount,
            category: result.category,
            date: result.date
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
     return [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses]);
  
  const financialCoachInput = useMemo(() => {
    const userBudget = userSettings?.budget;
    const monthlyExpenses = expenses; 
    const categoryBudgets = userSettings?.categoryBudgets;
    const userProfile = userSettings?.profile;
    
    if (monthlyExpenses.length === 0 || !userBudget || userBudget.totalBudget === 0) {
      return null;
    }
    
    return {
      totalBudget: userBudget.totalBudget,
      zeroSpendDaysTarget: userBudget.zeroSpendDaysTarget,
      expenses: monthlyExpenses.map(e => ({
        title: e.title,
        amount: e.amount,
        category: defaultCategories[e.category as keyof typeof defaultCategories]?.name || e.category,
        date: format(new Date(e.date), 'yyyy-MM-dd'),
      })),
      categoryBudgets: categoryBudgets,
      userProfile: userProfile ? {
        monthlyIncome: userProfile.monthlyIncome,
        familyMembers: userProfile.familyMembers?.map(({ id, ...rest }) => rest) || [],
      } : undefined,
    };
  }, [expenses, userSettings]);

  useEffect(() => {
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
  }, [user, financialCoachInput]);
  
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
  
  const ExpenseListItem = ({ expense }: { expense: Expense }) => {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const categoryInfo = defaultCategories[expense.category as keyof typeof defaultCategories] || defaultCategories.other;
    return (
      <Fragment>
        <li className="flex items-center p-3 transition-colors hover:bg-muted/50 rounded-lg">
          <div className="flex flex-1 items-center gap-4 overflow-hidden">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-2xl", categoryInfo.color)}>
              {categoryInfo.icon}
            </span>
            <div className='overflow-hidden'>
              <p className="font-semibold truncate">{expense.title}</p>
              <p className="text-sm text-muted-foreground">{categoryInfo.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-end">
              <p className="font-bold text-foreground text-base">{expense.amount.toLocaleString()}&nbsp;د.ع</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(expense.date), 'd MMM', { locale: arIQ })}
              </p>
            </div>
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DialogTrigger asChild>
                    <DropdownMenuItem>
                      <PencilIcon className="ml-2 h-4 w-4" />
                      تعديل
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DropdownMenuItem onClick={() => handleDeleteExpense(expense.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2Icon className="ml-2 h-4 w-4" />
                    حذف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
               <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
                  <DialogHeader><DialogTitle as="h2">تعديل المصروف</DialogTitle></DialogHeader>
                  <EditExpenseForm expense={expense} setOpen={setIsEditOpen} />
              </DialogContent>
            </Dialog>
          </div>
        </li>
      </Fragment>
    );
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      {upcomingPayments.length > 0 && (
        <Alert variant="destructive" className="animate-in fade-in">
          <CalendarClock className="h-4 w-4" />
          <AlertTitle>تذكير بدفعة مستحقة غداً!</AlertTitle>
          <AlertDescription>
            <ul>
              {upcomingPayments.map(p => (
                <li key={p.id}>- {p.title} بمبلغ {p.amount.toLocaleString()} د.ع</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {userSettings?.budget?.totalBudget === 0 ? (
          <Card className="text-center py-8">
            <CardContent className="flex flex-col items-center gap-4">
              <DollarSign className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-xl font-bold">ابدأ بتحديد ميزانيتك</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">اذهب إلى الإعدادات لتحديد ميزانيتك الشهرية والبدء في تتبع مصاريفك بفعالية.</p>
              <Button asChild className="mt-2">
                <Link href="/settings">
                  الذهاب إلى الإعدادات
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card id="budget-summary-card">
            <CardHeader>
                <CardTitle>ملخص الميزانية الشهرية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Progress value={budgetData.progress} className="h-3" indicatorcolor={budgetData.progress > 85 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                <div className="flex justify-between items-baseline font-medium">
                    <span className="text-muted-foreground">المصروف</span>
                    <span className="text-foreground text-lg">{budgetData.monthlySpent.toLocaleString()}&nbsp;د.ع</span>
                </div>
                <div className="flex justify-between items-baseline text-sm">
                    <span className="text-muted-foreground">المتبقي</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{budgetData.remainingBudget.toLocaleString()}&nbsp;د.ع</span>
                </div>
                <Separator />
                <div className="flex justify-between items-baseline text-sm">
                    <span className="text-muted-foreground">مصروف اليوم</span>
                    <span className="font-semibold text-foreground">{budgetData.todaySpent.toLocaleString()}&nbsp;د.ع</span>
                </div>
            </CardContent>
          </Card>
        )}

      {/* Add Expense Section */}
      <Card id="expense-input-methods">
        <CardHeader>
            <CardTitle>إضافة مصروف جديد</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-col h-24 gap-2">
                    <FilePenLine className="h-8 w-8 text-blue-500" />
                    <span className="font-semibold">إدخال يدوي</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
                <DialogHeader><DialogTitle as="h2">إدخال يدوي</DialogTitle></DialogHeader>
                <ManualExpenseForm setOpen={setIsManualEntryOpen} />
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" className="flex-col h-24 gap-2" onClick={handleToggleVoiceRecording} aria-disabled={isVoiceLoading}>
                {isVoiceLoading ? <Loader2 className="h-8 w-8 text-green-500 animate-spin" /> : 
                isVoiceRecording ? <StopCircle className="h-8 w-8 text-green-500 animate-pulse" /> : 
                <Mic className="h-8 w-8 text-green-500" />}
                <span className="font-semibold">{isVoiceLoading ? 'جاري التحليل...' : isVoiceRecording ? 'جاري الاستماع...' : 'سجل بالصوت'}</span>
            </Button>
            
            <Dialog open={isVoiceReviewOpen} onOpenChange={setIsVoiceReviewOpen}>
              <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle as="h2">مراجعة المصروف الصوتي</DialogTitle>
                  <DialogDescription>
                    يرجى مراجعة البيانات التي تم تحليلها من تسجيلك الصوتي قبل حفظها.
                  </DialogDescription>
                </DialogHeader>
                <ManualExpenseForm setOpen={setIsVoiceReviewOpen} initialData={voiceExpenseData} />
              </DialogContent>
            </Dialog>

            <Button asChild variant="outline" className="flex-col h-24 gap-2">
               <Link href="/receipts">
                <FileScan className="h-8 w-8 text-teal-500" />
                <span className="font-semibold">تحليل فاتورة</span>
               </Link>
            </Button>
            
            <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-col h-24 gap-2">
                    <CreditCard className="h-8 w-8 text-orange-500" />
                    <span className="font-semibold">بطاقة إلكترونية</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle as="h2">ربط بطاقة إلكترونية</DialogTitle>
                    <DialogDescription>
                      هذه الميزة قيد التطوير. حاليًا يمكنك تجربة محاكاة ربط البطاقة ومزامنة معاملاتها من صفحة الإعدادات.
                    </DialogDescription>
                  </DialogHeader>
                  <Button asChild className="w-full mt-4">
                      <Link href="/settings">الذهاب إلى الإعدادات</Link>
                  </Button>
              </DialogContent>
            </Dialog>
        </CardContent>
      </Card>

      
      {/* Smart Insights Card */}
      <Card id="smart-insights-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            نصائح المدرب المالي
          </CardTitle>
          <CardDescription>تحليلات وتوصيات ذكية بناءً على إنفاقك الأخير.</CardDescription>
        </CardHeader>
        <CardContent>
          {isInsightsLoading ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 space-x-reverse"><Skeleton className="h-12 w-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>
              <div className="flex items-center space-x-4 space-x-reverse"><Skeleton className="h-12 w-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>
            </div>
          ) : insights && insights.length > 0 ? (
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
                   <span className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    insight.type === 'praise' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                    insight.type === 'tip' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                    insight.type === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                  )}>
                    <InsightIcon name={insight.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{insight.title}</p>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground p-4">لا توجد نصائح حاليًا. أضف المزيد من المصاريف للحصول على تحليلات.</p>
          )}
        </CardContent>
      </Card>

      {/* All Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            أحدث المصاريف
          </CardTitle>
          <CardDescription>قائمة بآخر المصاريف التي قمت بتسجيلها.</CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          {allSortedExpenses.length > 0 ? (
            <ul className="space-y-1">
              {allSortedExpenses.slice(0, visibleExpensesCount).map((expense) => (
                <ExpenseListItem key={expense.id} expense={expense} />
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-10">لا توجد مصاريف مسجلة بعد.</p>
          )}
        </CardContent>
        {allSortedExpenses.length > visibleExpensesCount && (
          <CardFooter className="p-4">
            <Button variant="outline" className="w-full" onClick={() => setVisibleExpensesCount(prev => prev + 20)}>
              عرض المزيد
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
