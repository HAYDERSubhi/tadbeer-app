
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

  // Voice recording state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const recognitionRef = useRef<any | null>(null);
  const finalTranscriptRef = useRef('');
  
  const cardForm = useForm<LinkCardFormData>({
    resolver: zodResolver(linkCardSchema),
    defaultValues: { name: '', last4: '' }
  });
  
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
  
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'ar-IQ';

        recognitionRef.current.onstart = () => {
            setIsVoiceRecording(true);
            setVoiceError(null);
            finalTranscriptRef.current = '';
            setLiveTranscript('');
        };

        recognitionRef.current.onresult = (event: any) => {
            let interim_transcript = '';
            let final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
            finalTranscriptRef.current += final_transcript;
            setLiveTranscript(interim_transcript);
        };

        recognitionRef.current.onend = () => {
            setIsVoiceRecording(false);
            if (finalTranscriptRef.current.trim()) {
              processTranscriptAndSave(finalTranscriptRef.current);
            }
            setLiveTranscript('');
        };
        
        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          let errorMsg = `خطأ في التعرف على الصوت: ${event.error}`;
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            errorMsg = 'الرجاء السماح بالوصول للميكروفون.';
          } else if (event.error === 'no-speech') {
            errorMsg = 'لم يتم اكتشاف أي كلام. حاول مرة أخرى.';
          }
          setVoiceError(errorMsg);
          setIsVoiceRecording(false);
        };

    } else {
        setVoiceError("متصفحك لا يدعم خاصية التعرف على الصوت.");
    }
    
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    }
  }, [processTranscriptAndSave]);
  
  const handleToggleRecording = useCallback(() => {
    if (isVoiceRecording) {
      if(recognitionRef.current) {
          recognitionRef.current.stop();
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Could not start recognition", e);
          setVoiceError("فشل بدء التعرف. هل تم منح الإذن؟");
        }
      }
    }
  }, [isVoiceRecording]);
  
  // === Card Linking & Syncing Logic ===
  const updateSettingsMutation = useMutation({
      mutationFn: (newSettings: Partial<any>) => updateUserSettings(user!.uid, newSettings),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['userSettings', user?.uid] });
          toast({
              title: "تم الحفظ",
              description: "تم ربط بطاقتك بنجاح.",
          });
          setIsCardDialogOpen(false);
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
            <>
              <DialogHeader>
                  <DialogTitle as="h2" className='text-center'>{linkedCard.name}</DialogTitle>
                  <DialogDescription className='text-center'>
                    بطاقة إلكترونية مرتبطة | **** **** **** {linkedCard.last4}
                  </DialogDescription>
              </DialogHeader>
              <div className='p-6 text-center space-y-6'>
                  <div className='flex flex-col items-center gap-2'>
                      <CreditCardIcon className="h-16 w-16 text-primary" />
                  </div>
                  <Button onClick={handleSyncCard} disabled={isSyncingCard || addMultipleExpensesMutation.isPending} className="w-full" size="lg">
                     {isSyncingCard ? <><Loader2Icon className="ml-2 h-4 w-4 animate-spin"/> جاري المزامنة...</> : <><Bell className="ml-2 h-4 w-4"/> مزامنة المعاملات</>}
                  </Button>
              </div>
            </>
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

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      <OnboardingTour steps={tourSteps} tourKey="masroofat-onboarding-tour-v1" />
      
      {/* Hero Balance Card */}
      <Card id="budget-summary-card" className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background shadow-lg rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">الميزانية المتبقية</p>
            <p className="text-4xl font-bold text-primary tracking-tighter">
              {remainingBudget.toLocaleString()}&nbsp;د.ع
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 text-center text-sm pt-4 border-t">
              <div>
                <p className="text-muted-foreground text-xs">إجمالي الميزانية</p>
                <p className="font-semibold">{(userBudget?.totalBudget ?? 0).toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">المصروف الشهري</p>
                <p className="font-semibold text-destructive">{currentExpenses.toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">مصروف اليوم</p>
                <p className="font-semibold text-amber-500">{dailySpend.toLocaleString()} د.ع</p>
              </div>
              <div className='col-span-2 md:col-span-1'>
                <p className="text-muted-foreground text-xs">الهدف الأسبوعي</p>
                <p className="font-semibold">{weeklyTarget > 0 ? weeklyTarget.toLocaleString() : '---'} د.ع</p>
              </div>
          </div>
          <div className="space-y-4 pt-4 border-t">
              <p className="text-center text-xs text-muted-foreground font-semibold">تتبع الإنفاق الأسبوعي</p>
              <div className="grid grid-cols-4 gap-2">
                {weeklySpending.map((spend, i) => (
                  <div key={i} className="flex flex-col items-center text-center">
                     <p className="text-xs text-muted-foreground mb-1">الأسبوع {i + 1}</p>
                     <p className="text-xs font-bold">{spend.toLocaleString()} د.ع</p>
                  </div>
                ))}
              </div>
          </div>
        </CardContent>
      </Card>
      
      {(userBudget?.totalBudget ?? 0) === 0 && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>لم تقم بتحديد ميزانية!</AlertTitle>
            <AlertDescription>
                <p>اذهب إلى <Link href="/settings" className="font-bold underline">الإعدادات</Link> لتحديد ميزانيتك الشهرية والبدء في تتبع مصاريفك بفعالية.</p>
            </AlertDescription>
        </Alert>
      )}

      {/* Add Expense Section */}
      <div id="expense-input-methods" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Voice Button */}
        <div 
          className={cn(
              "relative flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-all h-40 cursor-pointer",
              voiceError && "ring-2 ring-destructive/50 bg-destructive/10",
              isVoiceLoading && "bg-muted/50"
          )}
        >
            {voiceError ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-destructive p-2">
                    <AlertTriangleIcon className="h-8 w-8" />
                    <p className="text-sm font-semibold text-center">{voiceError}</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVoiceError(null)}
                        className="mt-2"
                    >
                        <RefreshCwIcon className="ml-2 h-4 w-4" />
                        حاول مرة أخرى
                    </Button>
                </div>
            ) : isVoiceLoading ? (
                <>
                    <span className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-900/50">
                        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
                    </span>
                    <p className="font-semibold">جاري التحليل...</p>
                </>
            ) : (
                <button
                    onClick={handleToggleRecording}
                    disabled={!recognitionRef.current}
                    className="flex flex-col items-center justify-center text-center gap-3 w-full h-full disabled:opacity-50"
                    aria-label={isVoiceRecording ? "إيقاف التسجيل" : "بدء التسجيل الصوتي"}
                >
                    <span className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                        isVoiceRecording ? "bg-red-500 text-primary-foreground animate-pulse" : "bg-green-100 dark:bg-green-900/50"
                    )}>
                        {isVoiceRecording ? (
                            <StopCircleIcon className="h-8 w-8" />
                        ) : (
                            <Mic className="h-8 w-8 text-green-600 dark:text-green-300" />
                        )}
                    </span>
                    <p className="font-semibold h-5 truncate">
                        {liveTranscript || (isVoiceRecording ? "...يتم التسجيل" : "سجل بالصوت")}
                    </p>
                </button>
            )}
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
        <CardContent className='p-6 flex flex-col md:flex-row items-center gap-6'>
            <div className='text-center md:text-right'>
                <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                    <Target className="h-6 w-6 text-primary"/>
                    هل لديك هدف مالي؟
                </h3>
                <p className="text-muted-foreground">
                    اذهب إلى المخطط المالي الذكي لتحصل على خطة مخصصة تساعدك على تحقيقه.
                </p>
            </div>
             <Button asChild className="w-full md:w-auto md:mr-auto shrink-0">
                <Link href="/planner">اذهب إلى المخطط</Link>
            </Button>
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
