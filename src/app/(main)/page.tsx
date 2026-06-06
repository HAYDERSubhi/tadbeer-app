// src/app/(main)/page.tsx

"use client";

import { useState, useMemo, Fragment, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles, History, Pencil, CreditCard, Mic, MoreHorizontal, DollarSign, Loader2, ArrowRight, Receipt, Plus, FileScan } from "lucide-react";
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, isToday, isYesterday, addDays, isSameDay, addMonths, addQuarters, addYears, startOfDay, isFuture, startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth, startOfWeek, endOfWeek, addWeeks, parseISO, isPast, differenceInDays, getDate, compareDesc, isThisWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import { financialCoach, type FinancialCoachOutput, type FinancialCoachInput } from '@/ai/flows/financial-coach';
import { recordExpenseWithVoiceAction, recordExpenseAction } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import OnboardingTour from '@/components/tour/onboarding-tour';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteExpense } from '@/services/firestore';
import { useAppData } from '@/hooks/use-app-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InsightIcon } from '@/components/dashboard/insight-icon';
import { useIsMobile } from '@/hooks/use-mobile';
import Image from 'next/image';
import { useCategories } from '@/hooks/use-categories';
import BudgetSummaryCard from '@/components/dashboard/budget-summary-card';
import { useCurrency } from '@/hooks/use-currency';
import { IncomeVsExpensesCard } from '@/components/dashboard/income-vs-expenses-card';


// ── Voice waveform: 5 bars driven by real audio level ────────────────────────
function VoiceWaveBars({ level, className }: { level: number; className?: string }) {
  const multipliers = [0.45, 0.75, 1.0, 0.75, 0.45];
  return (
    <div className={cn('flex items-center justify-center gap-[3px]', className)}>
      {multipliers.map((m, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-current transition-all duration-75"
          // level is already amplified (0–1). min height keeps bars visible.
          style={{ height: `${Math.max(4, Math.min(22, 4 + level * m * 18))}px` }}
        />
      ))}
    </div>
  );
}

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

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { categories, categoryMap, getIconComponent } = useCategories();
  const { format: formatCurrency } = useCurrency();

  const { expenses, userSettings, isLoading: isAppDataLoading } = useAppData();

  const [isVoiceReviewOpen, setIsVoiceReviewOpen] = useState(false);
  const [voiceExpenseData, setVoiceExpenseData] = useState<Partial<Expense> | null>(null);
  const [isCardSheetOpen, setIsCardSheetOpen] = useState(false);
  
  // --- Voice Recording State & Refs ---
  const mediaRecorderRef      = useRef<MediaRecorder | null>(null);
  const audioChunksRef        = useRef<Blob[]>([]);
  const audioContextRef       = useRef<AudioContext | null>(null);
  const analyserRef           = useRef<AnalyserNode | null>(null);
  const rafRef                = useRef<number | null>(null);
  const recognitionRef        = useRef<any>(null);
  const voiceTranscriptRef    = useRef('');
  const isVoiceRecordingRef   = useRef(false); // mirror of state for use inside callbacks

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading,   setIsVoiceLoading]   = useState(false);
  const [audioLevel,       setAudioLevel]        = useState(0);
  const [voiceTranscript,  setVoiceTranscript]   = useState('');

  // helper: keep ref in sync with state
  const setRecordingState = (val: boolean) => {
    isVoiceRecordingRef.current = val;
    setIsVoiceRecording(val);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioContextRef.current?.close().catch(() => {});
      recognitionRef.current?.abort();
    };
  }, []);

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

  const stopAudioVisualization = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // FIX 1: async + ctx.resume() to unblock suspended AudioContext on mobile
  // FIX 2: fftSize=256 for real frequency data, amplify ×5 so speech is visible
  const startAudioVisualization = async (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      await ctx.resume();                      // ← critical on Android Chrome
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;                  // ← 16× more resolution than before
      analyser.smoothingTimeConstant = 0.4;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        setAudioLevel(Math.min(1, avg * 5));   // ← amplify so quiet speech moves bars
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* AudioContext not supported – visualization skipped */ }
  };

  const handleToggleVoiceRecording = async () => {
    // ── STOP ─────────────────────────────────────────────────────────────────
    if (isVoiceRecordingRef.current) {
      setRecordingState(false);
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      stopAudioVisualization();
      return;
    }

    // ── START ─────────────────────────────────────────────────────────────────
    voiceTranscriptRef.current = '';
    setVoiceTranscript('');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({
        title: 'خطأ في الميكروفون',
        description: 'امنح التطبيق إذن الوصول إلى الميكروفون وأعد المحاولة.',
        variant: 'destructive',
      });
      return;
    }

    startAudioVisualization(stream);  // fire-and-forget async
    setRecordingState(true);

    const SR =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (SR) {
      // ── PRIMARY: SpeechRecognition restart-loop ──────────────────────────
      // FIX: continuous:false + manual restart avoids the Android Chrome bug
      // where continuous:true stops immediately without capturing anything.

      const processTranscript = async () => {
        stopAudioVisualization();
        stream.getTracks().forEach(t => t.stop());

        const text = voiceTranscriptRef.current.trim();
        if (!text) {
          toast({
            title: 'لم يُتعرف على كلام',
            description: 'تحدث بوضوح وقرب الهاتف من فمك ثم حاول مجدداً.',
            variant: 'destructive',
          });
          return;
        }

        setIsVoiceLoading(true);
        try {
          const result = await recordExpenseAction({
            expenseText: text,
            categories: categoryMapForAI,
          });
          setVoiceExpenseData({
            title: result.description || text,
            amount: result.amount || undefined,
            category: result.category,
            date: result.date ? new Date(result.date).toISOString() : new Date().toISOString(),
          });
          voiceTranscriptRef.current = '';
          setVoiceTranscript('');
          setIsVoiceReviewOpen(true);
        } catch {
          toast({
            title: 'خطأ في تحليل الكلام',
            description: 'لم نتمكن من استخراج بيانات المصروف. حاول مجدداً.',
            variant: 'destructive',
          });
        } finally {
          setIsVoiceLoading(false);
        }
      };

      const startRecognitionSession = () => {
        const recognition = new SR() as any;
        recognitionRef.current = recognition;
        recognition.lang = 'ar-SA';          // most compatible Arabic locale
        recognition.continuous = false;       // ← FIX: avoid Android bug
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (e: any) => {
          // Accumulate results across multiple sessions
          const sessionText = Array.from<any>(e.results)
            .map((r: any) => r[0].transcript)
            .join('');
          const full = (voiceTranscriptRef.current + ' ' + sessionText).trim();
          voiceTranscriptRef.current = full;
          setVoiceTranscript(full);
        };

        recognition.onend = () => {
          if (isVoiceRecordingRef.current) {
            // User hasn't pressed stop yet → restart for next phrase
            try { startRecognitionSession(); } catch { /* ignore */ }
          } else {
            // User pressed stop → process what we have
            processTranscript();
          }
        };

        recognition.onerror = (e: any) => {
          if (e.error === 'aborted') return;  // user-triggered, not an error
          if (e.error === 'no-speech') {
            // Restart silently if still recording
            if (isVoiceRecordingRef.current) {
              try { startRecognitionSession(); } catch { /* ignore */ }
            }
            return;
          }
          // Genuine error
          toast({
            title: 'خطأ في التعرف على الصوت',
            description: `(${e.error}) — جرّب مجدداً`,
            variant: 'destructive',
          });
          setRecordingState(false);
          stopAudioVisualization();
          stream.getTracks().forEach(t => t.stop());
        };

        recognition.start();
      };

      startRecognitionSession();

    } else {
      // ── FALLBACK: MediaRecorder → audio blob → Gemini ───────────────────
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopAudioVisualization();
        stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setIsVoiceLoading(true);
        try {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror   = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(blob);
          });

          const result = await recordExpenseWithVoiceAction({
            voiceRecordingDataUri: base64Audio,
            categories: categoryMapForAI,
          });

          setVoiceExpenseData({
            title: result.description,
            amount: result.amount,
            category: result.category,
            date: result.date ? new Date(result.date).toISOString() : new Date().toISOString(),
          });
          setIsVoiceReviewOpen(true);
        } catch {
          toast({
            title: 'خطأ في تحليل الصوت',
            description: 'تأكد من الاتصال وحاول مرة أخرى.',
            variant: 'destructive',
          });
        } finally {
          setIsVoiceLoading(false);
        }
      };

      mediaRecorder.start();
    }
  };


  const allSortedExpenses = useMemo(() => {
    if (!expenses) return [];
    return [...expenses].sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)));
  }, [expenses]);

  // Group expenses by date label
  const groupedExpenses = useMemo(() => {
    const recent = allSortedExpenses.slice(0, 15);
    const groups: { label: string; expenses: typeof recent }[] = [];
    const seen = new Set<string>();

    recent.forEach(exp => {
      const date = parseISO(exp.date);
      let label: string;
      if (isToday(date)) label = 'اليوم';
      else if (isYesterday(date)) label = 'أمس';
      else if (isThisWeek(date, { weekStartsOn: 6 })) label = 'هذا الأسبوع';
      else label = format(date, 'MMMM yyyy', { locale: ar });

      if (!seen.has(label)) {
        seen.add(label);
        groups.push({ label, expenses: [] });
      }
      groups.find(g => g.label === label)!.expenses.push(exp);
    });

    return groups;
  }, [allSortedExpenses]);

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

  // Stable cache key — only changes when actual expense data or budget changes
  // MUST be declared AFTER monthlyExpenses and financialCoachInput
  const insightsCacheKey = useMemo(() => {
    if (!financialCoachInput) return null;
    const expensesHash = monthlyExpenses.map(e => `${e.id}:${e.amount}`).join('|');
    const budgetHash = userSettings?.budget?.totalBudget ?? 0;
    return `coach-${expensesHash}-${budgetHash}`;
  }, [monthlyExpenses, userSettings?.budget?.totalBudget, financialCoachInput]);

  // Use React Query for AI insights — cached for 10 minutes, won't re-fetch unless data changes
  const { data: insightsData, isLoading: isInsightsLoading } = useQuery({
    queryKey: ['financial-coach', insightsCacheKey],
    queryFn: async () => {
      if (!financialCoachInput) return { insights: [] };
      const result = await financialCoach(financialCoachInput);
      return result;
    },
    enabled: !!user && !!financialCoachInput && !isAppDataLoading,
    staleTime: 1000 * 60 * 10,   // 10 minutes — don't re-fetch if data unchanged
    gcTime: 1000 * 60 * 30,      // Keep in cache 30 minutes
    retry: 1,
  });

  const insights = insightsData?.insights ?? null;
  
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
    const isBudgetSet = totalBudget > 0;
    
    const inBudgetExpenses = monthlyExpenses.filter(e => !e.isOutOfBudget);
    const outOfBudgetExpenses = monthlyExpenses.filter(e => e.isOutOfBudget);

    const totalSpent = inBudgetExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const spentOutOfBudget = outOfBudgetExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const remaining = totalBudget - totalSpent;
    
    const today = new Date();
    const daysInMonth = getDaysInMonth(today);
    const currentDay = getDate(today);
    const timeProgress = (currentDay / daysInMonth) * 100;
    const spentPercentage = isBudgetSet ? (totalSpent / totalBudget) * 100 : 0;
    
    return {
      isBudgetSet,
      totalBudget,
      totalSpent,
      remaining,
      spentOutOfBudget,
      spentPercentage,
      timeProgress,
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
              <p className="font-bold text-foreground text-sm">{formatCurrency(expense.amount)}</p>
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
                <li key={p.id}>- {p.title} بمبلغ {formatCurrency(p.amount)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Budget Alert */}
      {!isAppDataLoading && budgetData.isBudgetSet && budgetData.spentPercentage >= 80 && (
        <Alert
          variant={budgetData.spentPercentage >= 100 ? "destructive" : "default"}
          className={cn(
            "animate-in fade-in border-2",
            budgetData.spentPercentage >= 100
              ? "border-destructive"
              : "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          )}
        >
          <AlertTitle className="flex items-center gap-2 text-sm font-bold">
            {budgetData.spentPercentage >= 100 ? (
              <><DollarSign className="h-4 w-4" /> تجاوزت الميزانية الشهرية!</>
            ) : (
              <><DollarSign className="h-4 w-4" /> تحذير: اقتربت من حد الميزانية</>
            )}
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {budgetData.spentPercentage >= 100
              ? `أنفقت ${budgetData.totalSpent.toLocaleString()} د.ع من أصل ${budgetData.totalBudget.toLocaleString()} د.ع — تجاوزت الميزانية بـ ${Math.abs(budgetData.remaining).toLocaleString()} د.ع.`
              : `أنفقت ${budgetData.spentPercentage.toFixed(0)}% من ميزانيتك — تبقى ${budgetData.remaining.toLocaleString()} د.ع فقط.`
            }
          </AlertDescription>
        </Alert>
      )}

      {isAppDataLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : budgetData.isBudgetSet ? (
        <BudgetSummaryCard
            isBudgetSet={budgetData.isBudgetSet}
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
      
      <IncomeVsExpensesCard />

      <Card id="expense-input-card" className="overflow-hidden">
        <CardContent className="py-2 px-4 space-y-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <Link href="/add-expense" className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Pencil className="w-6 h-6 sm:w-7 sm:h-7" />
                </span>
                <p className="font-semibold text-xs">يدوي</p>
            </Link>
            
            <div
              onClick={(isVoiceLoading) ? undefined : handleToggleVoiceRecording}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-2 rounded-lg group transition-colors",
                isVoiceLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50"
              )}
            >
              <span className={cn(
                "flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg transition-all duration-200",
                isVoiceRecording
                  ? "bg-destructive/15 text-destructive ring-2 ring-destructive/40 ring-offset-background ring-offset-1"
                  : "bg-primary/10 text-primary group-hover:bg-primary/20"
              )}>
                {isVoiceLoading ? (
                  <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
                ) : isVoiceRecording ? (
                  <VoiceWaveBars level={audioLevel} className="w-7 h-7 sm:w-8 sm:h-8" />
                ) : (
                  <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
                )}
              </span>
              <p className="font-semibold text-xs">
                {isVoiceLoading ? 'تحليل...' : isVoiceRecording ? 'استماع' : 'صوت'}
              </p>
            </div>

            <VoiceReviewComponent open={isVoiceReviewOpen} onOpenChange={setIsVoiceReviewOpen}>
              {isMobile ? (
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
              ) : (
                <DialogContent>
                  <ManualExpenseForm
                    key={JSON.stringify(voiceExpenseData)}
                    setOpen={setIsVoiceReviewOpen}
                    initialData={voiceExpenseData}
                  />
                </DialogContent>
              )}
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
              {isMobile ? (
                <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      ربط البطاقة المصرفية
                      <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-normal">قريباً</span>
                    </SheetTitle>
                    <SheetDescription className="text-right leading-relaxed">
                      نعمل حالياً على تطوير هذه الميزة لتعتمد على <span className="font-semibold text-foreground">رسائل SMS البنكية</span> — حيث سيتعرف التطبيق تلقائياً على رسائل بنكك ويضيف المعاملات دون أي إدخال يدوي.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="p-4 space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        📱 المخطط: عند وصول رسالة مثل <span className="font-mono bg-white/50 px-1 rounded">"تمت عملية شراء 25,000 د.ع"</span> سيضيفها تدبير تلقائياً بإذنك.
                      </p>
                    </div>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/settings">استعراض المحاكاة الحالية</Link>
                    </Button>
                  </div>
                </SheetContent>
              ) : (
                <DialogContent>
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      ربط البطاقة المصرفية
                      <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-normal">قريباً</span>
                    </SheetTitle>
                    <SheetDescription className="text-right leading-relaxed">
                      نعمل على تطوير هذه الميزة لتعتمد على <span className="font-semibold text-foreground">رسائل SMS البنكية</span> لإضافة معاملاتك تلقائياً.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="p-4 space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        📱 المخطط: التعرف التلقائي على رسائل البنك وإضافة المعاملات بإذنك.
                      </p>
                    </div>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/settings">استعراض المحاكاة الحالية</Link>
                    </Button>
                  </div>
                </DialogContent>
              )}
            </CardComponent>
          </div>

          {/* Live transcript shown while recording via SpeechRecognition */}
          {isVoiceRecording && voiceTranscript && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 animate-in fade-in slide-in-from-bottom-1">
              <Mic className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-foreground leading-relaxed">{voiceTranscript}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <span>أحدث المصاريف</span>
              </div>
              {!isAppDataLoading && allSortedExpenses.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  {allSortedExpenses.length} مصروف
                </span>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isAppDataLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : groupedExpenses.length > 0 ? (
            <div>
              {groupedExpenses.map(group => (
                <div key={group.label}>
                  <div className="px-4 py-1.5 bg-muted/40 border-y border-border/50">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </span>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {group.expenses.map(expense => (
                      <ExpenseListItem key={expense.id} expense={expense} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <Receipt className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-sm text-muted-foreground">لا توجد مصاريف بعد</p>
              <p className="text-xs text-muted-foreground/70 mt-1">ابدأ بإضافة أول مصروف لك</p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/add-expense">
                  <Plus className="h-4 w-4 ml-1" /> إضافة مصروف
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
        {!isAppDataLoading && allSortedExpenses.length > 15 && (
          <CardFooter className="p-2">
            <Button variant="ghost" asChild className="w-full h-8 text-xs">
              <Link href="/expenses">
                عرض كل المصاريف ({allSortedExpenses.length})
                <ArrowRight className="mr-2 h-3 w-3" />
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

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
            <p className="text-center text-muted-foreground p-4 text-xs">
              {hasExpenses 
                ? "حدد ميزانية شهرية في الإعدادات لتفعيل نصائح المدرب المالي."
                : "لا توجد نصائح حالياً. أضف بعض المصاريف للحصول على تحليلات."
              }
            </p>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
}
