
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FilePenLine, FileScan, CreditCardIcon, SettingsIcon, Trash2Icon, Loader2Icon, Mic, StopCircleIcon, RefreshCwIcon, AlertTriangleIcon, DollarSign, Trophy, Salad, CookingPot, TrendingUp, Lightbulb, PiggyBank, Sparkles, Target, Baby, School, History, Terminal, PencilIcon } from "lucide-react";
import type { Expense, UserBudgetSettings, UserProfile } from '@/types';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { recordExpenseWithText } from '@/ai/flows/record-expense-text';
import { financialCoach, type FinancialCoachOutput } from '@/ai/flows/financial-coach';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteExpense, addExpense } from '@/services/firestore';
import { useAppData } from '@/hooks/use-app-data';


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

// Define stable default objects outside the component to prevent re-creation on each render.
const DEFAULT_BUDGET_SETTINGS: UserBudgetSettings = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };
const DEFAULT_CATEGORY_BUDGETS = {};
const DEFAULT_USER_PROFILE: UserProfile = { monthlyIncome: 0, familyMembers: []};

// Main Dashboard Component
export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get data from the central provider
  const { expenses, userSettings } = useAppData();

  // Memoize derived settings to prevent an infinite loop.
  const categoryBudgets = useMemo(() => userSettings?.categoryBudgets || DEFAULT_CATEGORY_BUDGETS, [userSettings]);
  const userProfile = useMemo(() => userSettings?.profile || DEFAULT_USER_PROFILE, [userSettings]);
  
  const [insights, setInsights] = useState<FinancialCoachOutput['insights'] | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [visibleExpensesCount, setVisibleExpensesCount] = useState(20);

  // === Voice Recording State ===
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const recognitionRef = useRef<any | null>(null);
  // =============================

   useEffect(() => {
    // Cleanup for voice recorder
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
    };
  }, [expenses, userSettings]);

  // Memoize the input for the financial coach to prevent unnecessary re-renders and AI calls.
  // This creates a stable, stringified representation of the data needed by the AI.
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
        // The AI needs the category name, not the ID.
        category: defaultCategories[e.category as keyof typeof defaultCategories]?.name || e.category,
        date: format(new Date(e.date), 'yyyy-MM-dd'),
      })),
      categoryBudgets: categoryBudgets,
      userProfile: userProfile ? {
        monthlyIncome: userProfile.monthlyIncome,
        // The AI doesn't need the local 'id' field for family members.
        familyMembers: userProfile.familyMembers?.map(({ id, ...rest }) => rest) || [],
      } : undefined,
    };
    
    return JSON.stringify(coachInput);
  }, [monthlyExpenses, userBudget, categoryBudgets, userProfile]);


  // Effect for calling the AI coach. It runs only when the memoized input string changes.
  useEffect(() => {
    if (!user || !financialCoachInputString) {
      setInsights([]); // Set to empty if no data, preventing old insights from showing.
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
        setInsights(null); // Set to null on error to potentially show an error state.
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
          console.error("Error adding voice expense:", e);
          const errorMessage = e?.message || "حدث خطأ أثناء تحليل وحفظ المصروف. حاول مرة أخرى.";
          setVoiceError(errorMessage);
          toast({
              title: "خطأ في الحفظ",
              description: errorMessage,
              variant: "destructive"
          });
      }
  });

  // === Voice Recording Functions ===
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
    if (isVoiceRecording) {
      recognitionRef.current?.stop();
      // onend will handle the state change
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("متصفحك لا يدعم ميزة التعرف على الصوت. الرجاء استخدام متصفح Chrome أو Edge.");
      return;
    }

    setVoiceError(null);
    setLiveTranscript('');

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = 'ar-IQ';
    recognition.interimResults = true;
    recognition.continuous = true; // We will stop it manually

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsVoiceRecording(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      finalTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setLiveTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
       if (event.error === 'no-speech') {
             setVoiceError("لم يتم التقاط أي صوت. يرجى المحاولة مرة أخرى.");
        } else if (event.error === 'not-allowed') {
             setVoiceError("تم رفض الوصول إلى الميكروفون.");
        } else {
             setVoiceError("حدث خطأ أثناء التعرف على الصوت.");
        }
      setIsVoiceRecording(false);
    };

    recognition.onend = () => {
      setIsVoiceRecording(false);
      if (finalTranscript.trim()) {
        processTranscriptAndSave(finalTranscript);
      }
    };

    recognition.start();
  }, [isVoiceRecording, processTranscriptAndSave]);
  
  const renderVoiceButtonContent = () => {
    if (isVoiceLoading) {
      return (
        <div className="flex flex-col h-full items-center justify-center space-y-2 text-primary">
          <Loader2Icon className="h-8 w-8 animate-spin" />
          <p>جاري التحليل...</p>
        </div>
      );
    }
    
    if (voiceError) {
      return (
        <div className="flex flex-col h-full items-center justify-center space-y-2 text-destructive">
          <AlertTriangleIcon className="h-8 w-8" />
          <p className="text-center text-sm flex-1">{voiceError}</p>
        </div>
      );
    }
    
    if (isVoiceRecording) {
      return (
        <button
          onClick={handleToggleRecording}
          className="relative flex flex-col h-full w-full items-center justify-center gap-2 text-center"
          aria-label="إيقاف التسجيل"
        >
           <div className="absolute -inset-2 rounded-full bg-rose-500/20 animate-ping"></div>
           <div className="relative flex items-center justify-center w-16 h-16 bg-rose-500 text-white rounded-full shadow-lg">
               <StopCircleIcon className="w-8 h-8" />
           </div>
            <p className="text-base font-semibold text-foreground min-h-[24px] mt-2 px-2">
                {liveTranscript || 'جاري الاستماع...'}
            </p>
        </button>
      );
    }

    return (
        <button
            onClick={handleToggleRecording}
            className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-full w-full"
            aria-label="بدء التسجيل الصوتي"
        >
            <span className={cn("w-16 h-16 rounded-full flex items-center justify-center", "bg-rose-100 dark:bg-rose-900/50")}>
                <Mic className={cn("h-8 w-8", "text-rose-600 dark:text-rose-300")} />
            </span>
            <p className="font-semibold">إدخال صوتي</p>
        </button>
    );
  };
  
  // ===================================
  
  const weeklyTarget = (userBudget?.totalBudget ?? 0) > 0 ? (userBudget?.totalBudget ?? 0) / 4 : 0;
  
  const ExpenseListItem = ({ expense }: { expense: Expense }) => {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const categoryInfo = defaultCategories[expense.category as keyof typeof defaultCategories] || defaultCategories.other;
    const expenseDate = new Date(expense.date);

    return (
       <li className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/50 border-b">
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xl">
              {categoryInfo.icon}
          </span>
          <div className="min-w-0">
              <p className="font-semibold truncate">{expense.title}</p>
              <p className="text-sm text-muted-foreground">
                  {categoryInfo.name}
              </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
            <div className="text-end min-w-0">
              <p className="font-semibold text-foreground">
                  {expense.amount.toLocaleString()}&nbsp;د.ع
              </p>
              <p className="text-sm text-muted-foreground">
                  {expenseDate.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long' })}
              </p>
            </div>

            <div className="flex items-center gap-0 opacity-0 transition-opacity group-hover:opacity-100">
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary">
                        <PencilIcon className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader>
                        <DialogTitle>تعديل المصروف</DialogTitle>
                      </DialogHeader>
                      <EditExpenseForm expense={expense} setOpen={setIsEditDialogOpen} />
                  </DialogContent>
                </Dialog>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteExpense(expense.id)}
                    aria-label="حذف المصروف"
                >
                    <Trash2Icon className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      
      {/* Hero Balance Card */}
      <Card className="relative overflow-hidden bg-slate-900 text-primary-foreground shadow-2xl rounded-2xl">
        <CardHeader className="z-10 relative border-b border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle as="h2" className="text-xl font-bold text-white">ملخص الميزانية الشهرية</CardTitle>
            </div>
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-slate-700 hover:text-white rounded-full">
                <SettingsIcon className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="z-10 relative p-6 space-y-6">
            {/* Main numbers */}
            <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:gap-0 sm:divide-x-reverse sm:divide-x sm:divide-slate-700">
              <div>
                  <p className="text-sm text-slate-400">الميزانية</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-white">{(userBudget?.totalBudget ?? 0).toLocaleString()} د.ع</p>
              </div>
              <div>
                  <p className="text-sm text-slate-400">المصروف</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-white">{(currentExpenses ?? 0).toLocaleString()} د.ع</p>
              </div>
              <div>
                  <p className="text-sm text-slate-400">المتبقي</p>
                  <p className={`text-lg sm:text-xl md:text-2xl font-bold ${(remainingBudget ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(remainingBudget ?? 0).toLocaleString()} د.ع</p>
              </div>
            </div>

            {/* Weekly progress section */}
            <div className="pt-4">
                <div className="flex justify-around mb-2 text-xs text-slate-300">
                    <span>الأسبوع 1</span>
                    <span>الأسبوع 2</span>
                    <span>الأسبوع 3</span>
                    <span>الأسبوع 4</span>
                </div>
                {(userBudget?.totalBudget ?? 0) > 0 ? (
                    <>
                    <div className="flex w-full space-x-2 space-x-reverse">
                        {weeklySpending.map((spent, index) => {
                        const percentage = weeklyTarget > 0 ? Math.min((spent / weeklyTarget) * 100, 100) : 0;
                        const isOverBudget = spent > weeklyTarget;
                        return (
                            <div key={index} className="w-1/4 group relative">
                            <div className="h-3 w-full bg-slate-700 rounded-full overflow-hidden">
                                <div
                                className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : 'bg-teal-400'}`}
                                style={{ width: `${percentage}%` }}
                                />
                            </div>
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max p-2 text-xs text-white bg-slate-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                <p>المصروف: {spent.toLocaleString()} د.ع</p>
                                {isOverBudget && <p className="text-red-400 font-bold">تجاوزت الهدف!</p>}
                            </div>
                            </div>
                        );
                        })}
                    </div>
                    <div className="text-center text-xs text-slate-400 mt-2">
                        <span>الهدف الأسبوعي: {weeklyTarget.toLocaleString()} د.ع</span>
                    </div>
                    </>
                ) : (
                    <div className="grid grid-cols-4 gap-2 text-center mt-1">
                        {weeklySpending.map((spent, index) => (
                            <div key={index}>
                                <p className="font-semibold text-white text-sm">{spent.toLocaleString()}</p>
                                <p className="text-xs text-slate-500">د.ع</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </CardContent>
      </Card>
      
      {(userBudget?.totalBudget ?? 0) === 0 && (
        <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
            <p>لم تقم بتعيين ميزانية شهرية بعد.</p>
            <p className="text-sm">اذهب إلى <Link href="/settings" className="text-primary underline font-semibold">الإعدادات</Link> لتعيين ميزانيتك.</p>
        </div>
      )}

      {/* Add Expense Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div
            className={cn(
              "relative flex flex-col items-center justify-center text-center p-4 rounded-xl transition-all h-40",
              (isVoiceLoading || isVoiceRecording || voiceError) && "bg-muted/30 dark:bg-muted/10",
              voiceError && "ring-2 ring-destructive/50"
            )}
          >
              {renderVoiceButtonContent()}
              {voiceError && (
                <div className="absolute bottom-1 right-1 left-1 px-1">
                  <Button onClick={(e) => { e.stopPropagation(); setVoiceError(null); }} variant="ghost" size="sm" className="w-full text-xs">
                     <RefreshCwIcon className="ml-2 h-3 w-3" />
                     {'حاول مرة أخرى'}
                  </Button>
                </div>
              )}
          </div>
          
          {/* Manual Entry Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40">
                <span className="w-16 h-16 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/50">
                   <FilePenLine className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                </span>
                <p className="font-semibold">إدخال يدوي</p>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle as="h2">إدخال يدوي</DialogTitle>
              </DialogHeader>
              <ManualExpenseForm />
            </DialogContent>
          </Dialog>

          {/* Detailed Receipt Analysis Link */}
          <Link href="/receipts" className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40">
            <span className="w-16 h-16 rounded-full flex items-center justify-center bg-teal-100 dark:bg-teal-900/50">
               <FileScan className="h-8 w-8 text-teal-600 dark:text-teal-300" />
            </span>
            <p className="font-semibold">تحليل فاتورة</p>
          </Link>
          
          {/* E-Card Dialog */}
          <Dialog>
              <DialogTrigger asChild>
                <button className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-colors h-40">
                  <span className="w-16 h-16 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/50">
                     <CreditCardIcon className="h-8 w-8 text-amber-600 dark:text-amber-300" />
                  </span>
                  <p className="font-semibold">بطاقة إلكترونية</p>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle as="h2">بطاقة إلكترونية</DialogTitle>
                </DialogHeader>
                 <div className="p-6 text-center"><p>سيتم إضافة مزامنة البطاقة الإلكترونية قريباً.</p><Image src="https://placehold.co/200x150.png" alt="Coming soon" width={200} height={150} className="mx-auto mt-4 rounded-md" data-ai-hint="credit card technology" /></div>
              </DialogContent>
            </Dialog>
      </div>

       {/* Goal Setting CTA Card */}
      <Card className="bg-gradient-to-br from-primary/20 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className='space-y-1.5'>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              حدد أهدافك المالية
            </CardTitle>
            <CardDescription>
              هل تخطط لشراء سيارة أو منزل؟ دعنا نساعدك في تحقيق ذلك.
            </CardDescription>
          </div>
           <Link href="/goals" className={cn(buttonVariants({ size: "lg" }))}>
              إدارة الأهداف
            </Link>
        </CardHeader>
      </Card>
      
      {/* Smart Insights Card */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            نصائح ذكية
          </CardTitle>
          <CardDescription>تحليلات ونصائح مخصصة من مدربك المالي الذكي.</CardDescription>
        </CardHeader>
        <CardContent>
          {isInsightsLoading ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 space-x-reverse">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[250px]" />
                </div>
              </div>
              <div className="flex items-center space-x-4 space-x-reverse">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[180px]" />
                  <Skeleton className="h-4 w-[220px]" />
                </div>
              </div>
            </div>
          ) : insights && insights.length > 0 ? (
            <ul className="space-y-4">
              {insights.map((insight, index) => (
                <li
                  key={index}
                  className="flex animate-in fade-in slide-in-from-bottom-5 items-start gap-4 duration-500 fill-mode-both"
                  style={{ animationDelay: `${100 + index * 100}ms` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <InsightIcon name={insight.icon} className="h-6 w-6 text-primary" />
                  </span>
                  <div>
                    <p className="font-semibold">{insight.title}</p>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              <p>لا توجد نصائح حاليًا. أضف بعض المصاريف لتبدأ!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Expenses List */}
      <Card>
        <CardHeader>
           <CardTitle as="h2" className="flex items-center gap-2">
                <History className="h-6 w-6 text-primary" />
                سجل المصاريف
            </CardTitle>
            <CardDescription>
                هنا قائمة بآخر مصاريفك، مرتبة من الأحدث إلى الأقدم.
            </CardDescription>
        </CardHeader>
        <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
          {allSortedExpenses.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-4" />
              <h3 className="text-lg font-semibold">لا توجد مصاريف بعد</h3>
              <p className="text-sm">ابدأ بإضافة أول مصروف لك من الأعلى!</p>
            </div>
          ) : (
            <ul className="relative">
              {(() => {
                let lastMonth: string | null = null;
                return allSortedExpenses.slice(0, visibleExpensesCount).map((expense) => {
                  const expenseDate = new Date(expense.date);
                  const currentMonth = format(expenseDate, 'yyyy-MM');
                  const showSeparator = currentMonth !== lastMonth;
                  lastMonth = currentMonth;
                  
                  return (
                    <Fragment key={expense.id}>
                      {showSeparator && (
                        <li className="py-1 px-4 bg-muted/80 backdrop-blur-sm sticky top-0 z-10 border-b">
                            <div className="flex items-center gap-2">
                                <Separator className="flex-1" />
                                <p className="text-xs font-medium text-muted-foreground shrink-0">
                                    {format(expenseDate, 'MMMM yyyy', { locale: arIQ })}
                                </p>
                                <Separator className="flex-1" />
                            </div>
                        </li>
                      )}
                      <ExpenseListItem expense={expense} />
                    </Fragment>
                  );
                });
              })()}
            </ul>
          )}
        </CardContent>
        {allSortedExpenses.length > visibleExpensesCount && (
            <CardFooter className="p-4 justify-center border-t">
                <Button
                    variant="outline"
                    onClick={() => setVisibleExpensesCount(prev => prev + 20)}
                >
                    عرض المزيد
                </Button>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}

    