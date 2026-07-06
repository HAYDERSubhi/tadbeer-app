// src/app/(main)/page.tsx

"use client";

import { useState, useMemo, Fragment, useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles, History, Pencil, CreditCard, Mic, MoreHorizontal, DollarSign, Loader2, ChevronLeft, Receipt, Plus, FileScan, AlertTriangle } from "lucide-react";
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import dynamic from 'next/dynamic';

// تُحمَّل النماذج كسولاً — لا تظهر إلا داخل نافذة منبثقة بضغطة المستخدم،
// فلا داعي لتحميل react-day-picker + zod + react-hook-form عند فتح الصفحة.
const FormLoader = () => (
  <div className="flex items-center justify-center py-10">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);
const ManualExpenseForm = dynamic(() => import('@/components/expenses/manual-expense-form'), { loading: FormLoader, ssr: false });
const EditExpenseForm = dynamic(() => import('@/components/expenses/edit-expense-form'), { loading: FormLoader, ssr: false });
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, isToday, isYesterday, addDays, startOfDay, startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth, startOfWeek, endOfWeek, addWeeks, parseISO, isPast, differenceInDays, getDate, compareDesc, isThisWeek } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { recordExpenseAction } from '@/app/actions';
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
import { GuestUpgradeBanner } from '@/components/guest-upgrade-banner';
import { ZeroStreakCard } from '@/components/dashboard/zero-streak-card';
import { UpcomingBillsCard } from '@/components/dashboard/upcoming-bills-card';
import { WeeklySummaryCard } from '@/components/dashboard/weekly-summary-card';
import { GreetingHeader } from '@/components/dashboard/greeting-header';


// ── Voice waveform: 5 bars driven by real audio level ────────────────────────
// الأعمدة تُحدَّث مباشرة عبر DOM من حلقة rAF (بلا setState لكل إطار):
// إعادة رسم الصفحة كاملة 60 مرة/ثانية كانت تُضيع ضغطة الإيقاف على iOS Safari.
const WAVE_BAR_MULTIPLIERS = [0.45, 0.75, 1.0, 0.75, 0.45];

function VoiceWaveBars({ barsRef, className }: { barsRef: { current: HTMLDivElement | null }; className?: string }) {
  return (
    <div ref={(el) => { barsRef.current = el; }} className={cn('flex items-center justify-center gap-[3px]', className)}>
      {WAVE_BAR_MULTIPLIERS.map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-current transition-all duration-75"
          style={{ height: '4px' }}
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
    selector: '#financial-tools-card',
    title: 'الأدوات المالية الذكية 🧮',
    content: 'هنا كنزك: حاسبة العملات، هل يستحق؟، التقسيط، دفتر الديون، وأداة «سلفتنا» لإدارة السلف الدوّارة بسهولة. اضغط «عرض الكل» لاستكشافها.',
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

  const { expenses, userSettings, householdId, isLoading: isAppDataLoading, isSettingsFetched, isExpensesFetched } = useAppData();

  const [isVoiceReviewOpen, setIsVoiceReviewOpen] = useState(false);
  const [voiceExpenseData, setVoiceExpenseData] = useState<Partial<Expense> | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null); // النص المُفرّغ (P5)
  
  // --- Voice Recording State & Refs ---
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const audioChunksRef      = useRef<Blob[]>([]);
  const audioContextRef     = useRef<AudioContext | null>(null);
  const analyserRef         = useRef<AnalyserNode | null>(null);
  const rafRef              = useRef<number | null>(null);
  const isVoiceRecordingRef = useRef(false);
  const recordingTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartRef   = useRef<number>(0);
  const maxAudioLevelRef    = useRef<number>(0); // أعلى مستوى صوت أثناء التسجيل
  const waveBarsRef         = useRef<HTMLDivElement | null>(null);
  const stopFallbackTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeRecordingRef  = useRef<(() => void) | null>(null);
  const hasProcessedRecordingRef = useRef(false); // يمنع معالجة التسجيل مرتين (onstop + المهلة الاحتياطية)
  const isStartingVoiceRef    = useRef(false);    // يمنع بدء تسجيلَين من ضغطتين متتاليتين

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceLoading,   setIsVoiceLoading]   = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const setRecordingState = (val: boolean) => {
    isVoiceRecordingRef.current = val;
    setIsVoiceRecording(val);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (stopFallbackTimerRef.current) clearTimeout(stopFallbackTimerRef.current);
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

  const stopAudioVisualization = async () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    analyserRef.current = null;
    if (audioContextRef.current) {
      try { await audioContextRef.current.close(); } catch { /* ignore */ }
      audioContextRef.current = null;
    }
  };

  const stopRecordingTimers = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (autoStopTimerRef.current)  { clearTimeout(autoStopTimerRef.current);   autoStopTimerRef.current  = null; }
    setRecordingSeconds(0);
  };

  const safeStopMediaRecorder = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      try { mr.stop(); } catch { /* ignore race on iOS */ }
    }
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
        const level = Math.min(1, avg * 5); // level is already amplified (0–1)
        if (level > maxAudioLevelRef.current) maxAudioLevelRef.current = level;
        const bars = waveBarsRef.current?.children;
        if (bars) {
          for (let i = 0; i < bars.length; i++) {
            (bars[i] as HTMLElement).style.height =
              `${Math.max(4, Math.min(22, 4 + level * WAVE_BAR_MULTIPLIERS[i] * 18))}px`;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* skip if AudioContext unsupported */ }
  };

  const stopVoiceRecording = () => {
    setRecordingState(false);
    stopAudioVisualization();
    stopRecordingTimers();
    safeStopMediaRecorder(); // triggers onstop → API → Gemini
    // iOS Safari أحياناً لا يُطلق onstop إطلاقاً — مهلة احتياطية تعالج
    // المقاطع الملتقطة يدوياً. finalizeRecording محمي من التنفيذ المزدوج.
    if (stopFallbackTimerRef.current) clearTimeout(stopFallbackTimerRef.current);
    stopFallbackTimerRef.current = setTimeout(() => {
      stopFallbackTimerRef.current = null;
      finalizeRecordingRef.current?.();
    }, 1000);
  };

  const handleToggleVoiceRecording = async () => {
    // ── STOP: user tapped again ───────────────────────────────────────────────
    if (isVoiceRecordingRef.current) {
      stopVoiceRecording();
      return;
    }

    // ── START ─────────────────────────────────────────────────────────────────
    if (isStartingVoiceRef.current) return; // ضغطة ثانية سريعة قبل اكتمال البدء
    isStartingVoiceRef.current = true;
    // مهلة احتياطية معلّقة من تسجيل سابق تُلغى — التسجيل الجديد يتخلى عن السابق
    if (stopFallbackTimerRef.current) { clearTimeout(stopFallbackTimerRef.current); stopFallbackTimerRef.current = null; }
    finalizeRecordingRef.current = null;
    setVoiceExpenseData(null); // clear stale data from previous recording
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      isStartingVoiceRef.current = false;
      toast({
        title: 'خطأ في الميكروفون',
        description: 'امنح التطبيق إذن الوصول إلى الميكروفون وأعد المحاولة.',
        variant: 'destructive',
      });
      return;
    }

    // Pick a supported MIME type — Gemini accepts webm/ogg/mp4
    const preferredTypes = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    let mediaRecorder: MediaRecorder;
    try {
      const supportedMime = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
      mediaRecorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach(t => t.stop());
      isStartingVoiceRef.current = false;
      toast({
        title: 'التسجيل غير مدعوم',
        description: 'متصفحك لا يدعم تسجيل الصوت. حدّث نظام جهازك وحاول مجدداً.',
        variant: 'destructive',
      });
      return;
    }
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current   = [];
    recordingStartRef.current = Date.now();
    maxAudioLevelRef.current  = -1; // -1 = لم يعمل محلل الصوت بعد (يعطّل فحص الصمت إذا فشل المحلل)

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    const finalizeRecording = async () => {
      // ينفَّذ مرة واحدة فقط: إما من onstop أو من المهلة الاحتياطية (iOS)
      if (hasProcessedRecordingRef.current) return;
      hasProcessedRecordingRef.current = true;
      if (stopFallbackTimerRef.current) {
        clearTimeout(stopFallbackTimerRef.current);
        stopFallbackTimerRef.current = null;
      }
      stream.getTracks().forEach(t => t.stop());

      const durationMs = Date.now() - recordingStartRef.current;
      const blob = new Blob(audioChunksRef.current, {
        type: (mediaRecorder.mimeType || 'audio/webm').split(';')[0],
      });

      // Guard: no chunks at all
      if (audioChunksRef.current.length === 0 || blob.size === 0) {
        toast({
          title: 'التسجيل فارغ',
          description: 'لم يتم التقاط أي صوت. تأكد من عمل الميكروفون وحاول مجدداً.',
          variant: 'destructive',
        });
        return;
      }

      // Guard: recording too short (< 1.2s) — likely accidental tap, not real speech
      if (durationMs < 1200) {
        toast({
          title: 'التسجيل قصير جداً',
          description: 'تحدث لمدة أطول ثم أوقف التسجيل.',
        });
        return;
      }

      // Guard: blob too small — silence or near-silence produces < 2 KB
      if (blob.size < 2000) {
        toast({
          title: 'لم يُكتشف صوت',
          description: 'لم يتضمن المقطع أي كلام واضح. حاول مجدداً.',
        });
        return;
      }

      // Guard: الصمت الحقيقي — مستوى الصوت لم يتجاوز العتبة طوال التسجيل.
      // الكودك ينتج بيانات حتى بدون صوت لذا لا نعتمد على blob.size وحده.
      // (-1 = المحلل لم يعمل أصلاً، فنتخطى الفحص بدل رفض تسجيل سليم)
      if (maxAudioLevelRef.current !== -1 && maxAudioLevelRef.current < 0.04) {
        toast({
          title: 'لم نسمع أي كلام',
          description: 'تأكد من أن الميكروفون يعمل وتحدث بوضوح.',
        });
        return;
      }

      const recordedMime = blob.type;
      setIsVoiceLoading(true);

      try {
        // Convert blob → base64 data URI
        const audioDataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const raw = reader.result as string;
            // Ensure MIME type in the URI matches the actual format
            resolve(raw.replace(/^data:[^;]+/, `data:${recordedMime}`));
          };
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(blob);
        });

        // Use /api/voice route (isolated maxDuration=60) instead of server action
        // to avoid Vercel's 10s default timeout on server actions.
        const voiceAbortController = new AbortController();
        const voiceTimeoutId = setTimeout(() => voiceAbortController.abort(), 35_000);
        let res: Response;
        try {
          res = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              voiceRecordingDataUri: audioDataUri,
              categories: categoryMapForAI,
            }),
            signal: voiceAbortController.signal,
          });
        } finally {
          clearTimeout(voiceTimeoutId);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const response: { ok: boolean; data?: { amount: number; category: string; date: string; description?: string | null; transcript?: string | null }; error?: string } = await res.json();

        if (!response.ok) {
          throw new Error(response.error ?? 'خطأ غير معروف من الخادم');
        }

        const result = response.data!;
        setVoiceTranscript(result.transcript ?? null);
        setVoiceExpenseData({
          title:    result.description ?? undefined,
          amount:   result.amount,
          category: result.category,
          date:     result.date ? new Date(result.date).toISOString() : new Date().toISOString(),
        });
        setIsVoiceReviewOpen(true);

      } catch (err) {
        console.error('Voice analysis error:', err);
        const detail = err instanceof Error ? err.message : String(err);
        toast({
          title: 'خطأ في تحليل الصوت',
          description: detail.length < 120 ? detail : 'تعذّر تحليل التسجيل. تحقق من اتصالك وحاول مجدداً.',
          variant: 'destructive',
        });
      } finally {
        setIsVoiceLoading(false);
      }
    };

    mediaRecorder.onstop = finalizeRecording;
    finalizeRecordingRef.current = finalizeRecording;
    hasProcessedRecordingRef.current = false;

    try {
      mediaRecorder.start(250); // 250ms chunks for reliability
    } catch {
      // فشل start() يجب ألّا يترك قفل isStartingVoiceRef معلّقاً (زر ميت)
      stream.getTracks().forEach(t => t.stop());
      isStartingVoiceRef.current = false;
      toast({
        title: 'تعذّر بدء التسجيل',
        description: 'حدث خطأ في الميكروفون. حاول مجدداً.',
        variant: 'destructive',
      });
      return;
    }
    setRecordingState(true);
    setRecordingSeconds(0);
    isStartingVoiceRef.current = false;
    // بلا await: الرسم تجميلي، وctx.resume() قد يعلق على iOS فلا يجوز أن يمنع بدء التسجيل
    void startAudioVisualization(stream);

    // ── Recording timer (counts up every second for UX display) ──────────────
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(s => s + 1);
    }, 1000);

    // ── Auto-stop at 60s to prevent huge payloads ─────────────────────────────
    autoStopTimerRef.current = setTimeout(() => {
      if (!isVoiceRecordingRef.current) return;
      toast({ title: 'تم إيقاف التسجيل تلقائياً', description: 'الحد الأقصى للتسجيل هو 60 ثانية.' });
      stopVoiceRecording();
    }, 60_000);
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
      else label = format(date, 'MMMM yyyy', { locale: arIQ });

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
    mutationFn: (expenseId: string) => deleteExpense(user!.uid, expenseId, householdId),
    onSuccess: (_data, expenseId) => {
      // 1. Instantly remove from BOTH cache entries (recent + all) so UI
      //    updates without waiting for Firestore round-trip.
      const removeFromCache = (key: unknown[]) => {
        queryClient.setQueryData<import('@/types').Expense[]>(key, old =>
          old ? old.filter(e => e.id !== expenseId) : old
        );
      };
      removeFromCache(['expenses', user?.uid, householdId, 'recent']);
      removeFromCache(['expenses', user?.uid, householdId, 'all']);
      // 2. Invalidate so background refetch reconciles with Firestore.
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
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-1">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle>حذف المصروف</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف <span className="font-medium text-foreground">"{expense.title}"</span> نهائياً
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleDeleteExpense(expense.id)}
              >
                حذف
              </AlertDialogAction>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
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

  // Show full-page skeleton while auth + initial data settle.
  // This is ONE skeleton pass, not multiple cards flashing individually.
  const pageReady = !!user && isSettingsFetched && isExpensesFetched;
  if (!pageReady) {
    return (
      <div className="space-y-3 pb-24 animate-in fade-in duration-200">
        {/* Budget card skeleton */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        {/* Input card skeleton */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
            <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          </div>
        </div>
        {/* Recent expenses skeleton */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
        {/* Loading hint */}
        <p className="text-center text-xs text-muted-foreground pt-1 animate-pulse">
          جاري تحميل بياناتك...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* ملاحظة: OnboardingSheet انتقل إلى (main)/layout.tsx كي لا تُفكِّكه بوّابة pageReady. */}
      {/* الجولة تُؤجَّل حتى يضيف المستخدم أول مصروف — فتظهر على لوحة فيها محتوى حقيقي يُشرَح */}
      <OnboardingTour steps={tourSteps} tourKey="tadbeer-onboarding-tour-v2" enabled={hasExpenses} />

      <GreetingHeader />

      <GuestUpgradeBanner />

      <UpcomingBillsCard />

      <WeeklySummaryCard />

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
      
      <ZeroStreakCard />

      <Card id="expense-input-card" className="overflow-hidden">
        <CardContent className="py-2 px-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            {/* ── يدوي ── */}
            <Link href="/add-expense" className="flex flex-col items-center justify-center gap-2 cursor-pointer p-3 rounded-xl group hover:bg-muted/50 transition-colors">
                <span className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Pencil className="w-7 h-7" />
                </span>
                <p className="font-semibold text-sm">يدوي</p>
            </Link>

            {/* ── صوت ── */}
            {/* button حقيقي (لا div): iOS Safari قد لا يُطلق click على العناصر غير التفاعلية */}
            <button
              type="button"
              onClick={handleToggleVoiceRecording}
              disabled={isVoiceLoading}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-3 rounded-xl group transition-colors touch-manipulation select-none",
                isVoiceLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50"
              )}
            >
              <span className={cn(
                "flex items-center justify-center w-16 h-16 rounded-xl transition-all duration-200",
                isVoiceRecording
                  ? "bg-destructive/15 text-destructive ring-2 ring-destructive/40 ring-offset-background ring-offset-1"
                  : "bg-primary/10 text-primary group-hover:bg-primary/20"
              )}>
                {isVoiceLoading ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : isVoiceRecording ? (
                  <VoiceWaveBars barsRef={waveBarsRef} className="w-8 h-8" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </span>
              <span className="font-semibold text-sm tabular-nums">
                {isVoiceLoading
                  ? 'تحليل...'
                  : isVoiceRecording
                    ? `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, '0')}`
                    : 'صوت'}
              </span>
            </button>

            <VoiceReviewComponent open={isVoiceReviewOpen} onOpenChange={setIsVoiceReviewOpen}>
              {isMobile ? (
                <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <SheetHeader className="sr-only">
                    <SheetTitle>مراجعة المصروف الصوتي</SheetTitle>
                    <SheetDescription>راجع المصروف الذي تم تحليله من صوتك واحفظه.</SheetDescription>
                  </SheetHeader>
                  {voiceTranscript && (
                    <div className="mt-2 mb-1 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">🎙️ ما سمعناه:</p>
                      <p className="text-xs text-foreground leading-relaxed">«{voiceTranscript}»</p>
                    </div>
                  )}
                  <ManualExpenseForm
                    key={JSON.stringify(voiceExpenseData)}
                    setOpen={setIsVoiceReviewOpen}
                    initialData={voiceExpenseData}
                  />
                </SheetContent>
              ) : (
                <DialogContent>
                  {voiceTranscript && (
                    <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">🎙️ ما سمعناه:</p>
                      <p className="text-xs text-foreground leading-relaxed">«{voiceTranscript}»</p>
                    </div>
                  )}
                  <ManualExpenseForm
                    key={JSON.stringify(voiceExpenseData)}
                    setOpen={setIsVoiceReviewOpen}
                    initialData={voiceExpenseData}
                  />
                </DialogContent>
              )}
            </VoiceReviewComponent>

            {/* ── فاتورة ── */}
            <Link href="/receipts" className="flex flex-col items-center justify-center gap-2 cursor-pointer p-3 rounded-xl group hover:bg-muted/50 transition-colors">
                <span className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <FileScan className="w-7 h-7" />
                </span>
                <p className="font-semibold text-sm">فاتورة</p>
            </Link>
          </div>

          {/* Recording status indicator */}
          {isVoiceRecording && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 animate-in fade-in slide-in-from-bottom-1">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
              <p className="text-xs text-muted-foreground">جاري التسجيل... اضغط مرة أخرى عند الانتهاء</p>
            </div>
          )}

          {/* AI processing indicator — P9 */}
          {isVoiceLoading && (
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 animate-in fade-in slide-in-from-bottom-1">
              <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground leading-tight">الذكاء الاصطناعي يحلل تسجيلك</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">قد يستغرق حتى 20 ثانية — لا تغلق التطبيق</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── الأدوات المالية ── */}
      <Card id="financial-tools-card" className="overflow-hidden">
        <CardContent className="py-4 px-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">الأدوات المالية</p>
            <Link href="/tools" className="text-xs text-primary hover:underline">عرض الكل</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {[
              { href: '/tools/currency',     label: 'العملات',   icon: '💱', image: '/tools/currency.png', bg: 'linear-gradient(135deg,#60b8ff,#1a6fd4)' },
              { href: '/tools/worth-it',     label: 'يستحق؟',    icon: '⚡', image: '/tools/worth-it.png', bg: 'linear-gradient(135deg,#b47fff,#5b21b6)' },
              { href: '/tools/installment',  label: 'أقساطي',    icon: '📊', image: '/tools/installment.png', bg: 'linear-gradient(135deg,#38bdf8,#0369a1)' },
              { href: '/tools/habit-cost',   label: 'عاداتي',    icon: '☕', image: '/tools/habit-cost.png', bg: 'linear-gradient(135deg,#facc15,#b45309)' },
              { href: '/tools/wedding',      label: 'زواجي',    icon: '💍', image: '/tools/wedding.png', bg: 'linear-gradient(135deg,#f472b6,#9d174d)' },
              { href: '/tools/debts',        label: 'الديون',    icon: '🤝', image: '/tools/debts.png', bg: 'linear-gradient(135deg,#fb923c,#b45309)' },
              { href: '/tools/silftna',      label: 'سلفتنا',    icon: '🔄', image: '/tools/silftna.png', bg: 'linear-gradient(135deg,#2dd4bf,#0d9488)' },
            ].map(t => (
              <Link key={t.href} href={t.href} className="flex flex-col items-center gap-2 shrink-0 active:scale-95 transition-transform">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl overflow-hidden ${t.image ? '' : 'shadow-sm'}`} style={{ background: t.image ? 'transparent' : t.bg }}>
                  {t.image ? (
                    <img src={t.image} alt={t.label} className="w-full h-full object-contain scale-[1.35]" />
                  ) : (
                    t.icon
                  )}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">{t.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span>أحدث المصاريف</span>
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
                عرض كل المصاريف
                <ChevronLeft className="mr-1 h-3 w-3" />
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

    </div>
  );
}
