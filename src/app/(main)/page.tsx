
"use client";

import { useState, useMemo, Fragment, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2Icon, Sparkles, History, Terminal, PencilIcon, BrainCircuit, FilePenLine, FileScan, CreditCard, Mic, Link2, Bell, AlertTriangleIcon, Loader2, StopCircle } from "lucide-react";
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
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { financialCoach, type FinancialCoachOutput } from '@/ai/flows/financial-coach';
import { recordExpenseAction } from '@/app/actions';
import type { RecordExpenseWithTextInput, RecordExpenseWithTextOutput } from '@/ai/flows/record-expense-text';
import { Skeleton } from '@/components/ui/skeleton';
import OnboardingTour from '@/components/tour/onboarding-tour';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteExpense } from '@/services/firestore';
import { useAppData } from '@/hooks/use-app-data';
import BudgetSummaryCard from '@/components/dashboard/budget-summary-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InsightIcon } from '@/components/dashboard/insight-icon';

const tourSteps = [
  {
    selector: '',
    title: 'أهلاً بك في تطبيق مصروفات!',
    content: 'هذه جولة سريعة لمساعدتك على استكشاف الميزات الرئيسية. يمكنك تخطيها في أي وقت.',
    placement: 'center',
  },
  {
    selector: '#budget-summary-card',
    title: 'لوحة التحكم الرئيسية',
    content: 'هنا يمكنك رؤية ملخص سريع لميزانيتك، مصروفاتك، والمبلغ المتبقي لك هذا الشهر.',
    placement: 'bottom',
  },
  {
    selector: '#expense-input-methods',
    title: 'طرق إضافة المصروفات',
    content: 'يمكنك إضافة مصروفاتك يدويًا، عبر الصوت، من خلال تحليل فاتورة، أو بمزامنة بطاقتك الإلكترونية.',
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
    content: 'استخدم هذا الشريط للتنقل بين الصفحات الرئيسية: الإحصائيات، المخطط المالي، والإعدادات.',
    placement: 'top',
  }
];

// Main Dashboard Component
export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { expenses, userSettings, goals } = useAppData();

  const [insights, setInsights] = useState<FinancialCoachOutput['insights'] | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
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

  // --- Voice Recording Logic ---
  useEffect(() => {
    // Check for SpeechRecognition API
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
        if (isVoiceRecording) { // If it ends prematurely, stop it.
            setIsVoiceRecording(false);
            setIsVoiceLoading(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceError("متصفحك لا يدعم ميزة التعرف على الصوت.");
    }
  }, [isVoiceRecording]); // Re-attach listeners if isVoiceRecording changes

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
  
  // Memoized data for the financial coach
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

  // Effect to fetch insights when input data changes
  useEffect(() => {
    if (!user || !financialCoachInput) {
      setInsights([]);
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
      toast({
        title: "تم الحذف",
        description: "تم حذف المصروف بنجاح.",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "لم نتمكن من حذف المصروف.",
        variant: "destructive",
      });
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
        <li className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
          <div className="flex flex-1 items-center gap-3 overflow-hidden">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-xl", categoryInfo.color)}>
              {categoryInfo.icon}
            </span>
            <div className='overflow-hidden'>
              <p className="font-semibold truncate">{expense.title}</p>
              <p className="text-sm text-muted-foreground">{categoryInfo.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-end">
              <p className="font-semibold text-foreground">{expense.amount.toLocaleString()}&nbsp;د.ع</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(expense.date), 'd MMM', { locale: arIQ })}
              </p>
            </div>
            <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DialogTrigger asChild>
                       <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary">
                          <PencilIcon className="h-4 w-4" />
                       </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
                      <DialogHeader><DialogTitle as="h2">تعديل المصروف</DialogTitle></DialogHeader>
                      <EditExpenseForm expense={expense} setOpen={setIsEditOpen} />
                  </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteExpense(expense.id)}>
                  <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </li>
      </Fragment>
    );
  }

  const userBudget = userSettings?.budget || { totalBudget: 0 };

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      <OnboardingTour steps={tourSteps} tourKey="masroofat-onboarding-tour-v1" />
      
      <BudgetSummaryCard />
      
      {userBudget.totalBudget === 0 && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>لم تقم بتحديد ميزانية!</AlertTitle>
            <AlertDescription>
                <p>اذهب إلى <Link href="/settings" className="font-bold underline">الإعدادات</Link> لتحديد ميزانيتك الشهرية والبدء في تتبع مصاريفك بفعالية.</p>
            </AlertDescription>
        </Alert>
      )}

      {/* Add Expense Section */}
      <div id="expense-input-methods" className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
          <DialogTrigger asChild>
            <div className="flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <span className="flex items-center justify-center h-16 w-16 mb-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
                <FilePenLine className="h-8 w-8 text-blue-600 dark:text-blue-300" />
              </span>
              <p className="font-semibold">إدخال يدوي</p>
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
            <DialogHeader><DialogTitle as="h2">إدخال يدوي</DialogTitle></DialogHeader>
            <ManualExpenseForm setOpen={setIsManualEntryOpen} />
          </DialogContent>
        </Dialog>
        
        <div 
          className="flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={handleToggleVoiceRecording}
          aria-disabled={isVoiceLoading}
        >
          <span className={cn(
            "flex items-center justify-center h-16 w-16 mb-2 rounded-full bg-green-100 dark:bg-green-900/50",
            isVoiceRecording && 'animate-pulse ring-4 ring-green-400'
            )}>
            {isVoiceLoading ? <Loader2 className="h-8 w-8 text-green-600 dark:text-green-300 animate-spin" /> : 
             isVoiceRecording ? <StopCircle className="h-8 w-8 text-green-600 dark:text-green-300" /> : 
             <Mic className="h-8 w-8 text-green-600 dark:text-green-300" />}
          </span>
          <p className="font-semibold">
            {isVoiceLoading ? 'جاري التحليل...' : isVoiceRecording ? 'جاري الاستماع...' : 'سجل بالصوت'}
          </p>
        </div>
        
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

        <Link href="/receipts" className="flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
           <span className="flex items-center justify-center h-16 w-16 mb-2 rounded-full bg-teal-100 dark:bg-teal-900/50">
            <FileScan className="h-8 w-8 text-teal-600 dark:text-teal-300" />
           </span>
          <p className="font-semibold">تحليل فاتورة</p>
        </Link>
        
        <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
          <DialogTrigger asChild>
            <div className="flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
               <span className="flex items-center justify-center h-16 w-16 mb-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
                <CreditCard className="h-8 w-8 text-orange-600 dark:text-orange-300" />
               </span>
              <p className="font-semibold">بطاقة إلكترونية</p>
            </div>
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
      </div>

      
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
        <CardContent className="p-0">
          {allSortedExpenses.length > 0 ? (
            <ul className="divide-y divide-border">
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

    
