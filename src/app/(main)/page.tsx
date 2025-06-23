
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePenLine, ScanLine, CreditCardIcon, SettingsIcon, Trash2Icon, Loader2Icon, ChevronLeft, Mic, StopCircleIcon, RefreshCwIcon, AlertTriangleIcon, DollarSign } from "lucide-react";
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import ReceiptScanForm from '@/components/expenses/receipt-scan-form';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { recordExpenseWithVoice } from '@/ai/flows/record-expense-voice';

// Grouping the dialogs for easier mapping
const AddExpenseDialogs = [
  {
    label: "إدخال يدوي",
    description: "أضف مصروفاً جديداً بنفسك",
    IconComponent: FilePenLine,
    formComponent: <ManualExpenseForm />,
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "text-blue-600 dark:text-blue-300"
  },
  {
    label: "مسح الفاتورة",
    description: "التقط صورة لفاتورتك",
    IconComponent: ScanLine,
    formComponent: <ReceiptScanForm />,
    iconBg: "bg-teal-100 dark:bg-teal-900/50",
    iconColor: "text-teal-600 dark:text-teal-300"
  },
  {
    label: "بطاقة إلكترونية",
    description: "مزامنة تلقائية (قريباً)",
    IconComponent: CreditCardIcon,
    formComponent: <div className="p-6 text-center"><p>سيتم إضافة مزامنة البطاقة الإلكترونية قريباً.</p><Image src="https://placehold.co/200x150.png" alt="Coming soon" width={200} height={150} className="mx-auto mt-4 rounded-md" data-ai-hint="credit card technology" /></div>,
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    iconColor: "text-amber-600 dark:text-amber-300"
  },
];

interface UserBudgetSettings {
  totalBudget: number;
  weeklyBudget: number;
}

// Main Dashboard Component
export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [userBudget, setUserBudget] = useState<UserBudgetSettings>({ totalBudget: 0, weeklyBudget: 0 });

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
          setUserBudget(JSON.parse(storedBudget));
        } catch {
          setUserBudget({ totalBudget: 0, weeklyBudget: 0 });
        }
      } else {
         setUserBudget({ totalBudget: 0, weeklyBudget: 0 });
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

  const handleDeleteExpense = (expenseId: string) => {
    if (!isMounted) return;
    const updatedExpenses = expenses.filter(exp => exp.id !== expenseId);
    setExpenses(updatedExpenses);
    localStorage.setItem('expenses', JSON.stringify(updatedExpenses));
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
        category: (analysisResult.category.toLowerCase().replace(/\s+/g, '') || 'other') as keyof typeof defaultCategories,
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
      toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
    } finally {
      setIsVoiceLoading(false);
    }
  }, [isMounted, toast]);
  
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
      toast({ title: "خطأ", description: "تأكد من صلاحيات الميكروفون.", variant: "destructive" });
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
  }, [isMounted, processVoiceAndSave, toast]);
  
  const renderVoiceCardContent = () => {
    if (isVoiceLoading) {
      return (
        <div className="flex flex-col items-center space-y-2 text-primary">
          <Loader2Icon className="h-8 w-8 animate-spin" />
          <p>جاري التحليل والحفظ...</p>
        </div>
      );
    }
    
    if (voiceError) {
      return (
        <div className="flex flex-col items-center space-y-4 text-destructive">
          <AlertTriangleIcon className="h-8 w-8" />
          <p className="text-center text-sm">{voiceError}</p>
        </div>
      );
    }
    
    if (isVoiceRecording) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 w-full">
          <div className="text-center">
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
            <span className={cn("p-3 rounded-full", "bg-rose-100 dark:bg-rose-900/50")}>
                <Mic className={cn("h-7 w-7", "text-rose-600 dark:text-rose-300")} />
            </span>
            <div className="flex-1">
                <p className="font-semibold">إدخال صوتي</p>
                <p className="text-xs text-muted-foreground">سجل مصروفك بصوتك</p>
            </div>
        </>
    );
  };
  
  // ===================================
  
  const today = new Date();
  const startOfCurrentMonth = startOfMonth(today);
  const endOfCurrentMonth = endOfMonth(today);
  
  const monthlyExpenses = expenses.filter(exp => {
    try {
        const expenseDate = new Date(exp.date);
        return isWithinInterval(expenseDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
    } catch {
        return false;
    }
  });

  const currentExpenses = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const remainingBudget = userBudget.totalBudget - currentExpenses;

  // Weekly spending calculation
  const weeklyIntervals = [
    { start: startOfCurrentMonth, end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 7, 23, 59, 59) },
    { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 8), end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 14, 23, 59, 59) },
    { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 15), end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 21, 23, 59, 59) },
    { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 22), end: endOfCurrentMonth }
  ];

  const weeklySpending = weeklyIntervals.map(interval => 
      monthlyExpenses
          .filter(exp => {
              try {
                  return isWithinInterval(new Date(exp.date), interval);
              } catch {
                  return false;
              }
          })
          .reduce((sum, exp) => sum + exp.amount, 0)
  );
  const weeklyTarget = userBudget.totalBudget > 0 ? userBudget.totalBudget / 4 : 0;


  if (!isMounted || isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const sortedExpenses = [...monthlyExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const recentExpensesToDisplay = sortedExpenses.slice(0, 5);
  const allExpensesCount = sortedExpenses.length;

  return (
    <div className="space-y-8 pb-24 sm:pb-8">
      
      {/* Hero Balance Card */}
      <Card className="relative overflow-hidden bg-slate-900 text-primary-foreground shadow-2xl rounded-2xl">
        <CardHeader className="z-10 relative border-b border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl font-bold text-white">ملخص الميزانية الشهرية</CardTitle>
              <CardDescription className="text-slate-400 text-xs">نظرة شاملة لوضعك المالي هذا الشهر</CardDescription>
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
            <div className="grid grid-cols-3 divide-x-reverse divide-x divide-slate-700 text-center">
              <div>
                  <p className="text-sm text-slate-400">الميزانية</p>
                  <p className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">{userBudget.totalBudget.toLocaleString()} د.ع</p>
              </div>
              <div>
                  <p className="text-sm text-slate-400">المصروف</p>
                  <p className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">{currentExpenses.toLocaleString()} د.ع</p>
              </div>
              <div>
                  <p className="text-sm text-slate-400">المتبقي</p>
                  <p className={`text-xl md:text-2xl font-bold whitespace-nowrap ${remainingBudget >= 0 ? 'text-green-400' : 'text-red-400'}`}>{remainingBudget.toLocaleString()} د.ع</p>
              </div>
            </div>

            {/* Weekly progress section */}
            {userBudget.totalBudget > 0 && (
                <div className="pt-4">
                  <div className="flex justify-around mb-2 text-xs text-slate-300">
                    <span>الأسبوع 1</span>
                    <span>الأسبوع 2</span>
                    <span>الأسبوع 3</span>
                    <span>الأسبوع 4</span>
                  </div>
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
                </div>
              )}
        </CardContent>
      </Card>
      
      {userBudget.totalBudget === 0 && !isLoading && (
        <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
            <p>لم تقم بتعيين ميزانية شهرية بعد.</p>
            <p className="text-sm">اذهب إلى <Link href="/settings" className="text-primary underline font-semibold">الإعدادات</Link> لتعيين ميزانيتك.</p>
        </div>
      )}

      {/* Add Expense Horizontal Scroll */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">إضافة مصروف جديد</h2>
        <div className="relative">
          <div className="flex w-full space-x-4 space-x-reverse overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
            
            {/* INLINE VOICE CARD */}
            <div className="flex-shrink-0 w-48">
                <Card 
                  onClick={!isVoiceRecording && !isVoiceLoading && !voiceError ? startVoiceRecording : undefined}
                  className={cn(
                    "h-full hover:border-primary hover:shadow-md transition-all flex flex-col",
                    !isVoiceRecording && !isVoiceLoading && !voiceError && "cursor-pointer"
                  )}
                >
                    <CardContent className="p-4 flex flex-col flex-1 items-center justify-center text-center gap-3">
                        {renderVoiceCardContent()}
                    </CardContent>
                    {voiceError && (
                      <CardFooter className="flex-col gap-2 p-2 pt-0">
                        <Button onClick={startVoiceRecording} variant="ghost" className="w-full text-xs">
                           <RefreshCwIcon className="ml-2 h-3 w-3" />
                           {'حاول مرة أخرى'}
                        </Button>
                      </CardFooter>
                    )}
                </Card>
            </div>

            {AddExpenseDialogs.map(({ label, description, IconComponent, formComponent, iconBg, iconColor }) => (
              <Dialog key={label}>
                <DialogTrigger asChild>
                  <div className="flex-shrink-0 w-48 cursor-pointer">
                    <Card className="h-full hover:border-primary hover:shadow-md transition-all">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                        <span className={cn("p-3 rounded-full", iconBg)}>
                           <IconComponent className={cn("h-7 w-7", iconColor)} />
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold">{label}</p>
                          <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle as="h2">{label}</DialogTitle>
                  </DialogHeader>
                  {formComponent}
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle>أحدث المصاريف</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentExpensesToDisplay.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-4" />
              <h3 className="text-lg font-semibold">لا توجد مصاريف بعد</h3>
              <p className="text-sm">ابدأ بإضافة أول مصروف لك من الأعلى!</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentExpensesToDisplay.map((expense) => {
                const categoryInfo = defaultCategories[expense.category as keyof typeof defaultCategories] || defaultCategories.other;
                return (
                  <li key={expense.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
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
                              {new Date(expense.date).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long' })}
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
                );
              })}
            </ul>
          )}
        </CardContent>
         {allExpensesCount > 5 && (
           <CardFooter className="border-t p-4">
            <Button variant="outline" className="w-full" onClick={() => toast({ title: "قيد التطوير", description: "صفحة عرض كل المصاريف ستتوفر قريباً." })}>
              عرض كل المصاريف ({allExpensesCount})
              <ChevronLeft className="mr-2 h-4 w-4"/>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

    