
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FilePenLine, FileScan, CreditCardIcon, SettingsIcon, Trash2Icon, Loader2Icon, Mic, StopCircleIcon, RefreshCwIcon, AlertTriangleIcon, DollarSign, Trophy, Salad, CookingPot, TrendingUp, Lightbulb, PiggyBank, Sparkles, Target, Baby, School, History, Terminal, PencilIcon, Link2, Bell } from "lucide-react";
import type { Expense, UserBudgetSettings, UserProfile, LinkedCard } from '@/types';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { startOfMonth, endOfMonth, isWithinInterval, format, isToday } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { recordExpenseWithText } from '@/ai/flows/record-expense-text';
import { financialCoach, type FinancialCoachOutput } from '@/ai/flows/financial-coach';
import { simulateCardTransactions } from '@/ai/flows/simulate-card-transactions';
import { Skeleton } from '@/components/ui/skeleton';
import OnboardingTour from '@/components/tour/onboarding-tour';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteExpense, addExpense, updateUserSettings } from '@/services/firestore';
import { useAppData } from '@/hooks/use-app-data';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';


const InsightIcon = ({ name, className }: { name: string; className?: string }) => {
  const icons: { [key: string]: React.ElementType } = {
    Trophy,
    Salad,
    CookingPot,
    TrendingUp,
    Lightbulb,
    PiggyBank,
    Baby,
    School,
  };
  const LucideIcon = icons[name] || Sparkles;
  return <LucideIcon className={className} />;
};

const DEFAULT_BUDGET_SETTINGS: UserBudgetSettings = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };
const DEFAULT_CATEGORY_BUDGETS = {};
const DEFAULT_USER_PROFILE: UserProfile = { monthlyIncome: 0, familyMembers: []};
const DEFAULT_LINKED_CARD: LinkedCard | null = null;

const linkCardSchema = z.object({
  name: z.string().min(3, { message: 'اسم البطاقة مطلوب (3 أحرف على الأقل)' }),
  last4: z.string().length(4, { message: 'يجب أن يكون 4 أرقام' }).regex(/^\d{4}$/, { message: 'أرقام فقط' }),
});

type LinkCardFormData = z.infer<typeof linkCardSchema>;

const tourSteps = [
  // ... (tour steps remain the same)
];


// Main Dashboard Component
export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { expenses, userSettings } = useAppData();

  const categoryBudgets = useMemo(() => userSettings?.categoryBudgets || DEFAULT_CATEGORY_BUDGETS, [userSettings]);
  const userProfile = useMemo(() => userSettings?.profile || DEFAULT_USER_PROFILE, [userSettings]);
  const linkedCard = useMemo(() => userSettings?.linkedCard || DEFAULT_LINKED_CARD, [userSettings]);
  
  const [insights, setInsights] = useState<FinancialCoachOutput['insights'] | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [visibleExpensesCount, setVisibleExpensesCount] = useState(20);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isSyncingCard, setIsSyncingCard] = useState(false);

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const recognitionRef = useRef<any | null>(null);
  
  const cardForm = useForm<LinkCardFormData>({
    resolver: zodResolver(linkCardSchema),
    defaultValues: { name: '', last4: '' }
  });

   useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    }
  }, []);
  
  const {
    monthlyExpenses,
    currentExpenses,
    remainingBudget,
    weeklySpending,
    allSortedExpenses,
    userBudget,
    dailySpend,
  } = useMemo(() => {
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const endOfCurrentMonth = endOfMonth(today);
    
    const userBudget = userSettings?.budget || DEFAULT_BUDGET_SETTINGS;

    const currentMonthExpenses = expenses.filter(exp => {
        try {
            const expenseDate = new Date(exp.date);
            return isWithinInterval(expenseDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
        } catch {
            return false;
        }
    });
    
    const dailySpend = expenses
        .filter(exp => {
            try {
                return isToday(new Date(exp.date));
            } catch {
                return false;
            }
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

    const totalCurrentExpenses = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const budgetRemaining = (userBudget?.totalBudget ?? 0) - totalCurrentExpenses;

    const weeklyIntervals = [
      { start: startOfCurrentMonth, end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 7, 23, 59, 59) },
      { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 8), end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 14, 23, 59, 59) },
      { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 15), end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 21, 23, 59, 59) },
      { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 22), end: endOfCurrentMonth }
    ];

    const spendingByWeek = weeklyIntervals.map(interval =>
        currentMonthExpenses
            .filter(exp => {
                try {
                    return isWithinInterval(new Date(exp.date), interval);
                } catch {
                    return false;
                }
            })
            .reduce((sum, exp) => sum + exp.amount, 0)
    );
    
    const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
        monthlyExpenses: currentMonthExpenses,
        currentExpenses: totalCurrentExpenses,
        remainingBudget: budgetRemaining,
        weeklySpending: spendingByWeek,
        allSortedExpenses: sorted,
        userBudget,
        dailySpend,
    };
  }, [expenses, userSettings]);

  const financialCoachInputString = useMemo(() => {
    if (monthlyExpenses.length === 0 || !userBudget || userBudget.totalBudget === 0) {
      return null;
    }
    
    const coachInput = {
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
    
    return JSON.stringify(coachInput);
  }, [monthlyExpenses, userBudget, categoryBudgets, userProfile]);


  useEffect(() => {
    if (!user || !financialCoachInputString) {
      setInsights([]);
      return;
    }

    const getInsights = async () => {
      setIsInsightsLoading(true);
      try {
        const parsedInput = JSON.parse(financialCoachInputString);
        const result = await financialCoach(parsedInput);
        setInsights(result.insights);
      } catch (e) {
        console.error("Failed to get financial insights", e);
        setInsights(null);
      } finally {
        setIsInsightsLoading(false);
      }
    };

    getInsights();
  }, [user, financialCoachInputString]);
  
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
  
  const addExpenseMutation = useMutation({
      mutationFn: (newExpense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>) => addExpense(user!.uid, newExpense),
      onSuccess: (docId, variables) => {
          queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
          toast({
              title: "تمت الإضافة بنجاح!",
              description: `أضيف مصروف "${variables.title}" بمبلغ ${variables.amount.toLocaleString()} د.ع.`,
          });
      },
      onError: (e: any) => {
          console.error("Error adding expense:", e);
          const errorMessage = e?.message || "حدث خطأ أثناء حفظ المصروف. حاول مرة أخرى.";
          toast({
              title: "خطأ في الحفظ",
              description: errorMessage,
              variant: "destructive"
          });
      }
  });
  
  const addMultipleExpensesMutation = useMutation({
        mutationFn: (expenses: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[]) => {
            if (!user) throw new Error("User not authenticated");
            const promises = expenses.map(exp => addExpense(user!.uid, exp));
            return Promise.all(promises);
        },
        onSuccess: (result, variables) => {
            queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
            toast({
                title: "تمت المزامنة بنجاح!",
                description: `تمت إضافة ${variables.length} معاملة جديدة من بطاقتك.`,
            });
        },
        onError: () => {
            toast({
                title: "خطأ في المزامنة",
                description: "لم يتم حفظ المعاملات. الرجاء المحاولة مرة أخرى.",
                variant: "destructive",
            });
        }
    });

  const categoryMap = useMemo(() => {
      return Object.entries(defaultCategories).reduce((acc, [id, { name }]) => {
          acc[id] = name;
          return acc;
      }, {} as Record<string, string>);
  }, []);

  const processTranscriptAndSave = useCallback(async (transcript: string) => {
    if (!transcript.trim()) {
        setVoiceError("لم يتم التعرف على أي كلام. يرجى المحاولة مرة أخرى.");
        setIsVoiceLoading(false);
        return;
    }
    
    setIsVoiceLoading(true);
    setVoiceError(null);

    try {
        const analysisResult = await recordExpenseWithText({
            expenseText: transcript,
            categories: categoryMap,
        });

        if (!analysisResult || !analysisResult.amount || analysisResult.amount <= 0) {
            throw new Error("لم يتمكن الذكاء الاصطناعي من تحليل مبلغ صحيح من النص. يرجى المحاولة بصوت أوضح.");
        }

        const newExpense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'> = {
            title: analysisResult.description || `مصروف صوتي`,
            amount: analysisResult.amount,
            category: analysisResult.category,
            date: analysisResult.date ? new Date(analysisResult.date).toISOString() : new Date().toISOString(),
            description: analysisResult.description,
        };

        await addExpenseMutation.mutateAsync(newExpense);
        
    } catch (e: any) {
        console.error("Error processing and saving voice expense:", e);
        const errorMessage = e?.message || "حدث خطأ أثناء تحليل وحفظ المصروف. حاول مرة أخرى.";
        setVoiceError(errorMessage);
    } finally {
        setIsVoiceLoading(false);
    }
  }, [addExpenseMutation, categoryMap]);
  
  const handleToggleRecording = useCallback(() => {
    // ... voice recording logic remains the same
  }, [isVoiceRecording, processTranscriptAndSave]);
  
  const renderVoiceButtonContent = () => {
    // ... voice button rendering logic remains the same
  };
  
  // === Card Linking & Syncing Logic ===
  const updateSettingsMutation = useMutation({
      mutationFn: (newSettings: Partial<any>) => updateUserSettings(user!.uid, newSettings),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
          toast({
              title: "تم الحفظ",
              description: "تم ربط بطاقتك بنجاح.",
          });
      },
      onError: () => {
          toast({ title: "خطأ", description: "فشل ربط البطاقة.", variant: "destructive" });
      }
  });

  const onLinkCardSubmit = (data: LinkCardFormData) => {
    updateSettingsMutation.mutate({ linkedCard: data });
  };
  
  const handleSyncCard = async () => {
      setIsSyncingCard(true);
      try {
        const lastCardTransaction = expenses.filter(e => e.description?.startsWith("معاملة بطاقة:")).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        const result = await simulateCardTransactions({
          categories: categoryMap,
          lastTransactionDate: lastCardTransaction?.date
        });

        if (result.transactions.length > 0) {
            const expensesToSave: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[] = result.transactions.map(item => ({
                title: item.title,
                amount: item.amount,
                category: item.category,
                date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
                description: `معاملة بطاقة: ${item.description || item.title}`,
            }));
            await addMultipleExpensesMutation.mutateAsync(expensesToSave);
        } else {
             toast({
                title: "لا توجد معاملات جديدة",
                description: "بطاقتك محدثة. لم يتم العثور على معاملات جديدة.",
            });
        }
      } catch (e) {
          console.error("Card sync failed", e);
          toast({ title: "خطأ في المزامنة", description: "فشل الاتصال بالذكاء الاصطناعي.", variant: "destructive" });
      } finally {
          setIsSyncingCard(false);
      }
  }

  const renderCardDialogContent = () => {
      if(linkedCard) {
          return (
            <div className='p-6 text-center space-y-6'>
                <div className='flex flex-col items-center gap-2'>
                    <CreditCardIcon className="h-16 w-16 text-primary" />
                    <h3 className='text-xl font-bold'>{linkedCard.name}</h3>
                    <p className='text-muted-foreground'>**** **** **** {linkedCard.last4}</p>
                </div>
                <Button onClick={handleSyncCard} disabled={isSyncingCard || addMultipleExpensesMutation.isPending} className="w-full" size="lg">
                   {isSyncingCard ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin"/> جاري المزامنة...</> : <><Bell className="ml-2 h-4 w-4"/> مزامنة المعاملات</>}
                </Button>
            </div>
          );
      }

      return (
        <>
        <DialogHeader>
          <DialogTitle as="h2">ربط بطاقة إلكترونية (محاكاة)</DialogTitle>
          <DialogDescription>
            هذه الميزة هي محاكاة آمنة. أدخل أي معلومات لربط بطاقة افتراضية وتجربة مزامنة المعاملات التي يولدها الذكاء الاصطناعي.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={cardForm.handleSubmit(onLinkCardSubmit)} className="space-y-4 p-1 pt-4">
            <div>
              <Label htmlFor="card-name">اسم البطاقة</Label>
              <Input id="card-name" {...cardForm.register('name')} placeholder="مثال: بطاقة المصرف" />
              {cardForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{cardForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="card-last4">آخر 4 أرقام</Label>
              <Input id="card-last4" type="text" maxLength={4} {...cardForm.register('last4')} placeholder="1234" inputMode='numeric' />
              {cardForm.formState.errors.last4 && <p className="text-sm text-destructive mt-1">{cardForm.formState.errors.last4.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={updateSettingsMutation.isPending}>
                {updateSettingsMutation.isPending ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin"/> جاري الربط...</> : <><Link2 className="ml-2 h-4 w-4" /> ربط البطاقة</>}
            </Button>
        </form>
        </>
      );
  }

  // ===================================
  
  const weeklyTarget = (userBudget?.totalBudget ?? 0) > 0 ? (userBudget?.totalBudget ?? 0) / 4 : 0;
  
  const ExpenseListItem = ({ expense }: { expense: Expense }) => {
    // ... ExpenseListItem logic remains the same
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      <OnboardingTour steps={tourSteps} tourKey="masroofat-onboarding-tour-v1" />
      
      {/* Hero Balance Card */}
      <Card id="budget-summary-card" className="relative overflow-hidden bg-slate-900 text-primary-foreground shadow-2xl rounded-2xl">
        {/* ... Hero card content remains the same */}
      </Card>
      
      {(userBudget?.totalBudget ?? 0) === 0 && (
        // ... No budget warning remains the same
      )}

      {/* Add Expense Section */}
      <div id="expense-input-methods" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className={cn("relative flex flex-col items-center justify-center text-center p-4 rounded-xl transition-all h-40", (isVoiceLoading || isVoiceRecording || voiceError) && "bg-muted/30 dark:bg-muted/10", voiceError && "ring-2 ring-destructive/50")}>
              {renderVoiceButtonContent()}
              {voiceError && ( /* ... error retry button */ )}
          </div>
          
          <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
            <DialogTrigger asChild>
              <div className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40 cursor-pointer">
                <span className="w-16 h-16 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/50">
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

          <Link href="/receipts" className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40">
            <span className="w-16 h-16 rounded-full flex items-center justify-center bg-teal-100 dark:bg-teal-900/50">
               <FileScan className="h-8 w-8 text-teal-600 dark:text-teal-300" />
            </span>
            <p className="font-semibold">تحليل فاتورة</p>
          </Link>
          
          <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
              <DialogTrigger asChild>
                <div className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40 cursor-pointer">
                  <span className="w-16 h-16 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/50">
                     <CreditCardIcon className="h-8 w-8 text-amber-600 dark:text-amber-300" />
                  </span>
                  <p className="font-semibold">بطاقة إلكترونية</p>
                </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                {renderCardDialogContent()}
              </DialogContent>
            </Dialog>
      </div>

       {/* Goal Setting CTA Card */}
      <Card className="bg-gradient-to-br from-primary/20 to-transparent">
        {/* ... Goal CTA remains the same */}
      </Card>
      
      {/* Smart Insights Card */}
      <Card id="smart-insights-card">
        {/* ... Smart insights remain the same */}
      </Card>

      {/* All Expenses List */}
      <Card>
        {/* ... All expenses list remains the same */}
      </Card>
    </div>
  );
}
