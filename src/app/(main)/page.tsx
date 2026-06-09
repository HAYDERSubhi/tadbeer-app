// src/app/(main)/page.tsx

"use client";

import { useState, useMemo, Fragment, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles, History, Pencil, CreditCard, Mic, MoreHorizontal, DollarSign, Loader2, ChevronLeft, Receipt, Plus, FileScan } from "lucide-react";
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, isToday, isYesterday, addDays, startOfDay, startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth, startOfWeek, endOfWeek, addWeeks, parseISO, isPast, differenceInDays, getDate, compareDesc, isThisWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
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
import OnboardingSheet from '@/components/onboarding/onboarding-sheet';
import { ZeroStreakCard } from '@/components/dashboard/zero-streak-card';
import { UpcomingBillsCard } from '@/components/dashboard/upcoming-bills-card';


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

  const { expenses, userSettings, isLoading: isAppDataLoading, isSettingsFetched, isExpensesFetched } = useAppData();

  const [isVoiceReviewOpen, setIsVoiceReviewOpen] = useState(false);
  const [voiceExpenseData, setVoiceExpenseData] = useState<Partial<Expense> | null>(null);
  
  // --- Voice Recording State & Refs ---
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const audioChunksRef      = useRef<Blob[]>([]);
  const audioContextRef     = useRef<AudioContext | null>(null);
  const analyserRef         = useRef<AnalyserNode | null>(null);
  const rafRef              = useRef<number | null>(null);
  const isVoiceRecordingRef = useRef(false);

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading,   setIsVoiceLoading]   = useState(false);
  const [audioLevel,       setAudioLevel]        = useState(0);

  const setRecordingState = (val: boolean) => {
    isVoiceRecordingRef.current = val;
    setIsVoiceRecording(val);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  const categoryMapForAI = useMemo(() => {
    return categories.reduce((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  // upcomingPayments moved to UpcomingBillsCard component


  // --- Voice Recording: MediaRecorder → Gemini (reliable on all mobile browsers) ---

  const stopAudioVisualization = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const startAudioVisualization = async (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        setAudioLevel(Math.min(1, avg * 5));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* skip if AudioContext unsupported */ }
  };

  const handleToggleVoiceRecording = async () => {
    // ── STOP: user finished speaking ─────────────────────────────────────────
    if (isVoiceRecordingRef.current) {
      setRecordingState(false);
      stopAudioVisualization();
      mediaRecorderRef.current?.stop(); // triggers onstop → Gemini analysis
      return;
    }

    // ── START ─────────────────────────────────────────────────────────────────
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

    // Pick a supported MIME type that Gemini accepts
    const preferredTypes = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    const supportedMime = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const mediaRecorder = supportedMime
      ? new MediaRecorder(stream, { mimeType: supportedMime })
      : new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());

      if (audioChunksRef.current.length === 0) {
        toast({
          title: 'التسجيل فارغ',
          description: 'لم يتم التقاط أي صوت. تأكد من عمل الميكروفون وحاول مجدداً.',
          variant: 'destructive',
        });
        return;
      }

      // Send webm directly — gemini-2.5-flash supports audio/webm natively.
      // The earlier WAV conversion was only needed because gemini-2.0-flash
      // was retired (404 error). webm is smaller and faster to send.
      const recordedMime = (mediaRecorder.mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(audioChunksRef.current, { type: recordedMime });
      setIsVoiceLoading(true);

      try {
        const audioDataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const raw = reader.result as string;
            resolve(raw.replace(/^data:[^;]+/, `data:${recordedMime}`));
          };
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(blob);
        });

        const response = await recordExpenseWithVoiceAction({
          voiceRecordingDataUri: audioDataUri,
          categories: categoryMapForAI,
        });

        if (!response.ok) {
          throw new Error(response.error);
        }

        const result = response.data;
        setVoiceExpenseData({
          title: result.description ?? undefined,
          amount: result.amount,
          category: result.category,
          date: result.date ? new Date(result.date).toISOString() : new Date().toISOString(),
        });
        setIsVoiceReviewOpen(true);
      } catch (err) {
        console.error('Voice analysis error:', err);
        toast({
          title: 'خطأ في تحليل الصوت',
          description: 'لم يتمكن التطبيق من فهم التسجيل. حاول مرة أخرى وتحدث بوضوح.',
          variant: 'destructive',
        });
      } finally {
        setIsVoiceLoading(false);
      }
    };

    await startAudioVisualization(stream);
    mediaRecorder.start(250); // collect chunks every 250ms for reliability
    setRecordingState(true);
  };


  const allSortedExpenses = useMemo(() => {
    if (!expenses) return [];
    return [...expenses].sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)));
  }, [expenses]);

  // Group expenses by date label
  const groupedExpenses = useMemo(() => {
    const recent = allSortedExpenses.slice(0, 5);
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

    // Predict the day budget will run out
    // dailyRate = totalSpent / days elapsed; predictedEndDay = budget / dailyRate
    let predictedEndDay: number | null = null;
    if (isBudgetSet && totalSpent > 0 && remaining > 0 && currentDay >= 3) {
      const dailyRate = totalSpent / currentDay;
      const daysUntilEmpty = remaining / dailyRate;
      const endDay = Math.floor(currentDay + daysUntilEmpty);
      if (endDay <= daysInMonth) predictedEndDay = endDay;
    }

    return {
      isBudgetSet,
      totalBudget,
      totalSpent,
      remaining,
      spentOutOfBudget,
      spentPercentage,
      timeProgress,
      predictedEndDay,
    };
  }, [monthlyExpenses, userSettings]);
  
  const ExpenseListItem = ({ expense }: { expense: Expense }) => {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const categoryInfo = categoryMap[expense.category];

    const EditComponent = isMobile ? Sheet : Dialog;

    return (
      <Fragment>
        {/* Delete confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف المصروف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف "{expense.title}"؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleDeleteExpense(expense.id)}
              >
                نعم، احذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                  <DropdownMenuItem
                    onSelect={() => setIsDeleteOpen(true)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
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

  return (
    <div className="space-y-3 pb-24">
      <OnboardingSheet />
      <OnboardingTour steps={tourSteps} tourKey="tadbeer-onboarding-tour-v2" />
      
      <UpcomingBillsCard />

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

      {isAppDataLoading || !isSettingsFetched ? (
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
            predictedEndDay={budgetData.predictedEndDay}
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

      <ZeroStreakCard />

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
            
            <Link href="/import" className="flex flex-col items-center justify-center gap-2 cursor-pointer p-2 rounded-lg group hover:bg-muted/50 transition-colors">
                <span className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <CreditCard className="w-6 h-6 sm:w-7 sm:h-7" />
                </span>
                <p className="font-semibold text-xs">بطاقة</p>
            </Link>
          </div>

          {/* Recording status indicator */}
          {isVoiceRecording && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 animate-in fade-in slide-in-from-bottom-1">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
              <p className="text-xs text-muted-foreground">جاري التسجيل... اضغط مرة أخرى عند الانتهاء</p>
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
              {!isAppDataLoading && isExpensesFetched && allSortedExpenses.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  {allSortedExpenses.length} مصروف
                </span>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isAppDataLoading || !isExpensesFetched ? (
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
        {!isAppDataLoading && allSortedExpenses.length > 5 && (
          <CardFooter className="p-2 border-t">
            <Button variant="ghost" asChild className="w-full h-9 text-xs text-primary">
              <Link href="/expenses">
                عرض كل المصاريف ({allSortedExpenses.length})
                <ChevronLeft className="mr-1 h-3 w-3" />
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

    </div>
  );
}
