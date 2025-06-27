
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FilePenLine, FileScan, CreditCardIcon, SettingsIcon, Trash2Icon, Loader2Icon, Mic, StopCircleIcon, RefreshCwIcon, AlertTriangleIcon, DollarSign, Trophy, Salad, CookingPot, TrendingUp, Lightbulb, PiggyBank, Sparkles, Target, Baby, School, History } from "lucide-react";
import type { Expense, UserProfile } from '@/types';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { recordExpenseWithVoice } from '@/ai/flows/record-expense-voice';
import { financialCoach, type FinancialCoachOutput } from '@/ai/flows/financial-coach';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

interface UserBudgetSettings {
  totalBudget: number;
  weeklyBudget: number;
  zeroSpendDaysTarget: number;
}

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

// Main Dashboard Component
export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [userBudget, setUserBudget] = useState<UserBudgetSettings>({ totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 });
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [insights, setInsights] = useState<FinancialCoachOutput['insights'] | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);

  // === Voice Recording State ===
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceRecordingTime, setVoiceRecordingTime] = useState(0);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const voiceMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceAudioChunksRef = useRef<Blob[]>([]);
  const voiceTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // =============================

  useEffect(() => {
    setIsMounted(true);
    
    const refreshData = () => {
      // Refresh Budget
      const storedBudget = localStorage.getItem('userBudgetSettings');
      if (storedBudget) {
        try {
          const budget = JSON.parse(storedBudget);
          setUserBudget({
            totalBudget: budget.totalBudget || 0,
            weeklyBudget: budget.weeklyBudget || 0,
            zeroSpendDaysTarget: budget.zeroSpendDaysTarget || 4,
          });
        } catch {
          setUserBudget({ totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 });
        }
      } else {
         setUserBudget({ totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 });
      }

      // Refresh Category Budgets
      const storedCategoryBudgets = localStorage.getItem('categoryBudgets');
      if (storedCategoryBudgets) {
        try {
          setCategoryBudgets(JSON.parse(storedCategoryBudgets));
        } catch {
          setCategoryBudgets({});
        }
      }
      
      // Refresh User Profile
      const storedUserProfile = localStorage.getItem('userProfile');
      if (storedUserProfile) {
        try {
          setUserProfile(JSON.parse(storedUserProfile));
        } catch {
          setUserProfile(null);
        }
      }

      // Refresh Expenses
      const storedExpenses = localStorage.getItem('expenses');
      if (storedExpenses) {
        try {
          const parsedExpenses = JSON.parse(storedExpenses);
           if (Array.isArray(parsedExpenses)) {
            setExpenses(parsedExpenses);
          } else {
             setExpenses([]);
          }
        } catch (error) {
          console.error("Failed to parse expenses from localStorage", error);
          setExpenses([]);
          localStorage.setItem('expenses', '[]');
        }
      } else {
        setExpenses([]);
      }
    };
    
    refreshData();
    setIsLoading(false);

    window.addEventListener('expensesUpdated', refreshData);
    window.addEventListener('budgetUpdated', refreshData);
    
    return () => {
      window.removeEventListener('expensesUpdated', refreshData);
      window.removeEventListener('budgetUpdated', refreshData);
      
      // Cleanup for voice recorder
      if (voiceMediaRecorderRef.current && voiceMediaRecorderRef.current.state === 'recording') {
        voiceMediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (voiceTimerIntervalRef.current) {
        clearInterval(voiceTimerIntervalRef.current);
      }
    };
  }, []);
  
  const {
    monthlyExpenses,
    currentExpenses,
    remainingBudget,
    weeklySpending,
    allSortedExpenses,
  } = useMemo(() => {
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const endOfCurrentMonth = endOfMonth(today);

    const currentMonthExpenses = expenses.filter(exp => {
        try {
            const expenseDate = new Date(exp.date);
            return isWithinInterval(expenseDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
        } catch {
            return false;
        }
    });

    const totalCurrentExpenses = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const budgetRemaining = userBudget.totalBudget - totalCurrentExpenses;

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
    };
  }, [expenses, userBudget.totalBudget]);


  // Effect for calling the AI coach
  useEffect(() => {
    if (!isMounted) return;

    const getInsights = async () => {
      // Use monthlyExpenses which is already calculated for the current calendar month.
      if (monthlyExpenses.length > 0 && userBudget.totalBudget > 0) {
        setIsInsightsLoading(true);
        try {
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
              familyMembers: userProfile.familyMembers.map(({ id, ...rest }) => rest), // Strip id for AI
            } : undefined,
          };
          const result = await financialCoach(coachInput);
          setInsights(result.insights);
        } catch (e) {
          console.error("Failed to get financial insights", e);
          setInsights(null);
        } finally {
          setIsInsightsLoading(false);
        }
      } else {
        // If there are no expenses this month, don't show any insights.
        setInsights([]);
      }
    };

    getInsights();
  }, [monthlyExpenses, userBudget, categoryBudgets, userProfile, isMounted]);


  const handleDeleteExpense = (expenseId: string) => {
    if (!isMounted) return;
    const updatedExpenses = expenses.filter(exp => exp.id !== expenseId);
    setExpenses(updatedExpenses);
    localStorage.setItem('expenses', JSON.stringify(updatedExpenses));
    window.dispatchEvent(new CustomEvent('expensesUpdated'));
    toast({
      title: "تم الحذف",
      description: "تم حذف المصروف بنجاح.",
    });
  };

  // === Voice Recording Functions ===
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const processVoiceAndSave = useCallback(async (dataUri: string) => {
    setIsVoiceLoading(true);
    setVoiceError(null);
    try {
      const analysisResult = await recordExpenseWithVoice({ voiceRecordingDataUri: dataUri });

      if (!analysisResult || !analysisResult.amount) {
        throw new Error("لم يتمكن الذكاء الاصطناعي من تحليل المصروف. يرجى المحاولة بصوت أوضح.");
      }
      
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        title: analysisResult.description || `مصروف صوتي (${analysisResult.category})`,
        amount: analysisResult.amount,
        category: (Object.keys(defaultCategories).find(key => defaultCategories[key as keyof typeof defaultCategories].name === analysisResult.category) || 'other'),
        date: analysisResult.date ? new Date(analysisResult.date).toISOString() : new Date().toISOString(),
        description: analysisResult.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingExpenses: Expense[] = JSON.parse(localStorage.getItem('expenses') || '[]');
      localStorage.setItem('expenses', JSON.stringify([...existingExpenses, newExpense]));
      
      toast({
        title: "تمت الإضافة بنجاح!",
        description: `أضيف مصروف صوتي بمبلغ ${newExpense.amount.toLocaleString()} د.ع.`,
      });
      
      window.dispatchEvent(new CustomEvent('expensesUpdated'));
    } catch (e: any) {
      console.error("Error processing and saving voice expense:", e);
      const errorMessage = e?.message || "حدث خطأ أثناء تحليل وحفظ المصروف. حاول مرة أخرى.";
      setVoiceError(errorMessage);
    } finally {
      setIsVoiceLoading(false);
    }
  }, [toast]);
  
  const stopVoiceRecording = useCallback(() => {
    if (voiceMediaRecorderRef.current && isVoiceRecording) {
      voiceMediaRecorderRef.current.stop();
      setIsVoiceRecording(false);
      if (voiceTimerIntervalRef.current) {
        clearInterval(voiceTimerIntervalRef.current);
      }
    }
  }, [isVoiceRecording]);

  const startVoiceRecording = useCallback(async () => {
    if (!isMounted || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError("الوصول إلى الميكروفون غير مدعوم أو مسموح به.");
      return;
    }
    
    setVoiceError(null);
    setVoiceRecordingTime(0);
    if (voiceTimerIntervalRef.current) clearInterval(voiceTimerIntervalRef.current);
    voiceAudioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceMediaRecorderRef.current = new MediaRecorder(stream);

      voiceMediaRecorderRef.current.ondataavailable = (event) => {
        voiceAudioChunksRef.current.push(event.data);
      };

      voiceMediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(voiceAudioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const dataUri = reader.result as string;
          if (dataUri) {
            processVoiceAndSave(dataUri);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      voiceMediaRecorderRef.current.start();
      setIsVoiceRecording(true);
      
      voiceTimerIntervalRef.current = setInterval(() => {
        setVoiceRecordingTime(prevTime => prevTime + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Error starting recording:", err);
      setIsVoiceRecording(false);
      setVoiceError("لم يتمكن من بدء التسجيل. تأكد من صلاحيات الميكروفون.");
    }
  }, [isMounted, processVoiceAndSave]);
  
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
        <div className="flex flex-col h-full items-center justify-center space-y-4 w-full">
          <div className="flex-1 flex flex-col items-center justify-center">
             <p className="text-sm text-muted-foreground animate-pulse">جاري التسجيل...</p>
             <p className="text-4xl font-mono tracking-wider text-foreground mt-1">
              {formatTime(voiceRecordingTime)}
            </p>
          </div>
          <Button
            onClick={stopVoiceRecording}
            variant="destructive"
            size="sm"
            className="w-full"
          >
            <StopCircleIcon />
            إيقاف
          </Button>
        </div>
      );
    }

    // Default/Idle state
    return (
        <>
            <span className={cn("w-16 h-16 rounded-full flex items-center justify-center", "bg-rose-100 dark:bg-rose-900/50")}>
                <Mic className={cn("h-8 w-8", "text-rose-600 dark:text-rose-300")} />
            </span>
            <p className="font-semibold">إدخال صوتي</p>
        </>
    );
  };
  
  // ===================================
  
  const weeklyTarget = userBudget.totalBudget > 0 ? userBudget.totalBudget / 4 : 0;


  if (!isMounted || isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;
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
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-white whitespace-nowrap">{userBudget.totalBudget.toLocaleString()} د.ع</p>
              </div>
              <div>
                  <p className="text-sm text-slate-400">المصروف</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-white whitespace-nowrap">{currentExpenses.toLocaleString()} د.ع</p>
              </div>
              <div>
                  <p className="text-sm text-slate-400">المتبقي</p>
                  <p className={`text-lg sm:text-xl md:text-2xl font-bold whitespace-nowrap ${remainingBudget >= 0 ? 'text-green-400' : 'text-red-400'}`}>{remainingBudget.toLocaleString()} د.ع</p>
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
                {userBudget.totalBudget > 0 ? (
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
                                <p className="font-semibold text-white text-sm whitespace-nowrap">{spent.toLocaleString()}</p>
                                <p className="text-xs text-slate-500">د.ع</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </CardContent>
      </Card>
      
      {userBudget.totalBudget === 0 && !isLoading && (
        <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
            <p>لم تقم بتعيين ميزانية شهرية بعد.</p>
            <p className="text-sm">اذهب إلى <Link href="/settings" className="text-primary underline font-semibold">الإعدادات</Link> لتعيين ميزانيتك.</p>
        </div>
      )}

      {/* Add Expense Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* INLINE VOICE BUTTON */}
          <div 
            onClick={!isVoiceRecording && !isVoiceLoading && !voiceError ? startVoiceRecording : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-all h-40",
              !isVoiceRecording && !isVoiceLoading && !voiceError && "cursor-pointer hover:bg-muted/50",
              (isVoiceLoading || isVoiceRecording || voiceError) && "bg-muted/30 dark:bg-muted/10",
              voiceError && "ring-2 ring-destructive/50"
            )}
          >
              {renderVoiceButtonContent()}
              {voiceError && (
                <div className="w-full mt-auto pt-2">
                  <Button onClick={startVoiceRecording} variant="ghost" size="sm" className="w-full text-xs">
                     <RefreshCwIcon className="ml-2 h-3 w-3" />
                     {'حاول مرة أخرى'}
                  </Button>
                </div>
              )}
          </div>
          
          {/* Manual Entry Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl hover:bg-muted/50 transition-colors h-40">
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
          <Link href="/receipts" className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl hover:bg-muted/50 transition-colors h-40">
            <span className="w-16 h-16 rounded-full flex items-center justify-center bg-teal-100 dark:bg-teal-900/50">
               <FileScan className="h-8 w-8 text-teal-600 dark:text-teal-300" />
            </span>
            <p className="font-semibold">تحليل فاتورة</p>
          </Link>
          
          {/* E-Card Dialog */}
          <Dialog>
              <DialogTrigger asChild>
                <button className="flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl hover:bg-muted/50 transition-colors h-40">
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
                هنا قائمة بجميع مصاريفك، مرتبة من الأحدث إلى الأقدم.
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
                return allSortedExpenses.map((expense) => {
                  const expenseDate = new Date(expense.date);
                  const currentMonth = format(expenseDate, 'yyyy-MM');
                  const showSeparator = currentMonth !== lastMonth;
                  lastMonth = currentMonth;

                  const categoryInfo = defaultCategories[expense.category as keyof typeof defaultCategories] || defaultCategories.other;
                  
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
                      <li className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/50 border-b">
                        <div className="flex flex-1 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xl">
                              {categoryInfo.icon}
                          </span>
                          <div>
                              <p className="font-semibold">{expense.title}</p>
                              <p className="text-sm text-muted-foreground">
                                  {categoryInfo.name}
                              </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-end">
                              <p className="font-semibold text-foreground whitespace-nowrap">
                                  {expense.amount.toLocaleString()}&nbsp;د.ع
                              </p>
                              <p className="text-sm text-muted-foreground">
                                  {expenseDate.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long' })}
                              </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                onClick={() => handleDeleteExpense(expense.id)}
                                aria-label="حذف المصروف"
                            >
                                <Trash2Icon className="h-4 w-4" />
                            </Button>
                        </div>
                      </li>
                    </Fragment>
                  );
                });
              })()}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
