
// src/app/(main)/receipts/page.tsx
"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { Expense, TripCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload, FileScan, Loader2, XCircle, Trash2, PlusCircle, Sparkles,
  AlertTriangleIcon, Camera, Check, X, ArrowRight, Crop,
  Receipt, Calendar as CalendarIcon, Pencil, ShieldCheck, ShieldAlert,
  ShieldQuestion, Info, CheckCircle2, AlertCircle, TriangleAlert,
  Flashlight, FlashlightOff, Zap
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { AnalyzeDetailedReceiptOutput } from '@/ai/flows/analyze-detailed-receipt';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { useCurrency } from '@/hooks/use-currency';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpensesBatch } from '@/services/firestore';
import ReactCrop, { type Crop as CropRect, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import getCroppedImg from '@/lib/crop-image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isValid, differenceInCalendarDays } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { cn } from '@/lib/utils';
import { normalizeDigits } from '@/lib/normalize-digits';
import { useCategories } from '@/hooks/use-categories';
import { useActiveTrips } from '@/hooks/use-active-trips';
import { TripExpenseToggle } from '@/components/expenses/trip-expense-field';
import { TRIP_CATEGORIES, TRIP_CATEGORY_LABEL } from '@/app/(main)/tools/safarati/calc';
import { TRAVEL_CATEGORY_ID } from '@/lib/constants';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

type EditableItem = AnalyzeDetailedReceiptOutput['items'][0] & { id: string };
type ViewState = 'initial' | 'camera' | 'cropping';
type ProcessingStep = 'uploading' | 'analyzing' | 'extracting' | null;
type ImageQuality = 'good' | 'warn' | 'bad' | 'checking';

interface ImageEntry {
  id: string;
  src: string;
  quality: ImageQuality;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: mimeString });
};

/**
 * يضغط صورة data URI قبل إرسالها للتحليل:
 * يصغّر الحافة الأطول إلى maxDim ويحوّلها JPEG بجودة معقولة.
 * يقلّص حجم الرفع من ~4MB إلى ~400KB مع إبقاء نص الفاتورة مقروءاً —
 * يعالج بطء/تعليق التحليل واستهلاك الإنترنت (P1/H4).
 */
/**
 * دقّة الإرسال: المطلوب النصّ لا الصورة. تصغير الحافة الأطول لفاتورة طويلة
 * يمحو الأرقام الصغيرة — وهو ما أنتج قراءة السنة 2023 بدل 2026.
 *
 * كان الحدّ 2000 ثابتاً: صورة الاستوديو من كاميرا الهاتف (≈4000px) تُنصَّف،
 * بينما لقطة التطبيق (≤1920 غالباً) لا تُمسّ أصلاً — فكان الرفع أسوأ دقّةً
 * من الالتقاط رغم أن مصدره كاميرا أفضل (بلاغ 2026-09-04).
 *
 * والحدّ يتدرّج بعدد الصور كي لا تنتفخ الحمولة وتتجاوز مهلة التحليل:
 * صورة واحدة تحمل الفاتورة كلها فتحتاج أعلى دقّة، وعدة صور تعني أن كل
 * واحدة تغطّي جزءاً — فنصّها كبير أصلاً ولا يحتاج نفس الحدّ.
 */
const maxDimForCount = (n: number) => (n <= 1 ? 3000 : n === 2 ? 2600 : 2200);

// جودة JPEG أعلى قليلاً: ضغط النصّ الدقيق يولّد تشويشاً حول الحروف يربك القراءة.
const JPEG_QUALITY_TEXT = 0.87;

const compressDataUri = (src: string, maxDim = 2000, quality = JPEG_QUALITY_TEXT): Promise<string> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const r = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(src); return; }
      ctx.drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL('image/jpeg', quality)); }
      catch { resolve(src); }
    };
    img.onerror = () => resolve(src); // فشل التحميل → أرسل الأصل بدل الانهيار
    img.src = src;
  });

/**
 * فحص جودة الصورة: هل حروف الفاتورة كبيرة كفايةً لتُقرأ؟
 *
 * الفحص السابق كان يصغّر الصورة إلى 120×120 ثم يقيس السطوع والتباين — وبهذا
 * الحجم لا وجود للحروف أصلاً. فوسم صورتَي فاتورة بـ«واضحة ✓» ثم قرأ النموذج
 * سنتها 2023 بدل 2026 (2026-09-03). شارة تطمئن بلا أن تفحص أخطر من لا شارة.
 *
 * ⚠️ مقاييس «الحدّة» (تباين لابلاس) خاطئة لهذه المشكلة تحديداً، وأعطت فرقاً
 * **مقلوباً** في ست تجارب على صورتي معايرة حقيقيتين: الحدّة تقيس كمّية التفاصيل
 * الدقيقة، وصورة قريبة لحروف كبيرة تحوي تفاصيل أقل من لقطة بعيدة لطاولة مزدحمة.
 * الصورتان مركّزتان كلتاهما — الفرق **مسافة** لا حدّة.
 *
 * المقياس الصحيح: **سُمك الحرف بالبكسل** = وسيط أطوال المقاطع الداكنة أفقياً.
 * معايَر على صورتَي صاحب المشروع (2026-09-04) بدقّة موحَّدة 2000px:
 *   قريبة واضحة = 4px  ·  بعيدة = 2px  ·  فصل ×2.00  ·  ~17ms للصورة
 * (المتوسّط بدل الوسيط يعطي ×1.22 فقط، ودقّة 2500 تعطي ×1.67 — فالإعداد مثبَّت.)
 *
 * ⚠️ حدود الثقة: صورتان فقط، وقيم صحيحة صغيرة فالهامش ±1px. لذلك 3px منطقة
 * «مقبولة» لا تُحسم، والنتيجة **تُخبر ولا تمنع** التحليل.
 */
const QUALITY_NORM_PX = 2000;   // دقّة موحَّدة: العتبة يجب ألّا تتغيّر بحجم الصورة
const QUALITY_ROW_STEP = 8;     // عيّنة صفوف — نفس النتيجة بربع الزمن
const STROKE_GOOD = 4;          // ≥ 4px: الحروف مقروءة
const STROKE_BAD = 2;           // ≤ 2px: أصغر من أن تُقرأ

/**
 * ── الالتقاط التلقائي عند ثبات الكاميرا ──────────────────────────────────────
 * الفكرة لصاحب المشروع: يوجّه الكاميرا على جزء الفاتورة، وحين تثبت يده تُلتقط
 * الصورة وحدها، فينزل للجزء التالي بلا ضغط زر في كل مرّة.
 *
 * المقياس: متوسّط الفرق المطلق بين إطارين متتاليين على شبكة 160×120، بعد طرح
 * الانزياح العام (فتغيّر التعريض التلقائي لا يُقرأ حركةً — مقيس: 0.50 لا أكثر).
 *
 * ⚠️ العتبات قِيست في المتصفّح على مسار drawImage/getImageData نفسه، لا على
 *    نموذج نظري. النموذج النظري أعطى أرقاماً أصغر بسبع مرّات وكاد يضع عتبة
 *    تمنع الالتقاط في الإضاءة الضعيفة منعاً تامّاً وصامتاً:
 *
 *      ساكن + ضجيج إضاءة عادية  0.50   |  إزاحة 1px    2.37
 *      ساكن + إضاءة خافتة       1.44   |  إزاحة 2px   17.62
 *      ساكن + إضاءة سيّئة جداً   2.83   |  إزاحة 8px   36.13
 *
 *    فالعتبتان تقعان في فجوة ×6 بين أسوأ ضجيج (2.83) وأقلّ حركة معتبرة (17.6).
 */
const AUTO_SAMPLE_W = 160;      // عرض شبكة العيّنة (الارتفاع تبعاً لنسبة الفيديو)
// 150ms لا 100: كلفة getImageData ‏16.6ms ثابتة (انتظار مزامنة، لا حساب — قيست
// عند أربعة أحجام فكانت واحدة)، فتقليل التواتر هو ما يخفّف الضغط على المعاينة.
const AUTO_TICK_MS = 150;
const AUTO_STILL_MAD = 5;       // ≤ هذا = ثابتة (1.8× فوق أسوأ ضجيج · 3.5× دون أقلّ حركة)
const AUTO_MOVE_MAD = 12;       // ≥ هذا = تحرّكت ⇒ يُعاد التسليح للجزء التالي
const AUTO_STILL_TICKS = 5;     // 0.75 ثانية ثبات متصل — وقفة التصويب أقصر منها
// صمّام أمان: لو كان ضجيج المستشعر أسوأ ممّا قِيس (كاميرا رديئة، ظلام)، ترتفع
// عتبة السكون مع أرضية الضجيج المرصودة فعلياً بدل أن تصمت الميزة بلا تفسير.
const AUTO_FLOOR_FACTOR = 2;    // العتبة ≥ ضِعف الأرضية المرصودة
// النافذة: أهدأ لحظة في آخر ٣ ثوانٍ هي الأرضية. أدنى قيمة لا متوسّط — لأن
// الاهتزاز فيه لحظات هادئة فتبقى الأرضية منخفضة ويُرفض، بينما الضجيج الحقيقي
// لا لحظة هادئة فيه فترتفع الأرضية فوراً. وهذا وحده ما يفرّق بين الحالتين.
const AUTO_FLOOR_WINDOW = 20;
const AUTO_STORAGE_KEY = 'tadbeer_receipt_autocapture';

const checkImageQuality = (src: string): Promise<ImageQuality> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const r = Math.min(QUALITY_NORM_PX / img.width, QUALITY_NORM_PX / img.height, 1);
      const w = Math.round(img.width * r), h = Math.round(img.height * r);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve('good'); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);

      // صورة مظلمة جداً تفشل قبل أي كلام عن الحروف — يبقى هذا الفحص من السابق.
      let total = 0;
      for (let i = 0; i < data.length; i += 4) total += (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (total / (data.length / 4) < 55) { resolve('bad'); return; }

      // أطوال المقاطع الداكنة أفقياً = سُمك الحرف. العتبة محلية لكل صف فتتكيّف
      // مع الظلّ والإضاءة غير المتساوية على الورق.
      const runs: number[] = [];
      for (let y = 0; y < h; y += QUALITY_ROW_STEP) {
        const base = y * w * 4;
        let mn = 255, mx = 0;
        for (let x = 0; x < w; x++) {
          const p = base + x * 4;
          const lum = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
          if (lum < mn) mn = lum;
          if (lum > mx) mx = lum;
        }
        if (mx - mn < 60) continue; // صف بلا تباين — لا نصّ فيه
        const th = mn + (mx - mn) * 0.55;
        let run = 0;
        for (let x = 0; x < w; x++) {
          const p = base + x * 4;
          const lum = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
          if (lum < th) run++;
          else { if (run >= 1 && run <= 60) runs.push(run); run = 0; }
        }
      }
      // لا نصّ يُقاس (صورة فارغة أو معتمة) — لا ندّعي جودة ولا نُفزع.
      if (runs.length < 200) { resolve('warn'); return; }

      runs.sort((a, b) => a - b);
      const median = runs[runs.length >> 1];
      resolve(median >= STROKE_GOOD ? 'good' : median <= STROKE_BAD ? 'bad' : 'warn');
    };
    img.onerror = () => resolve('good');
    img.src = src;
  });

const qualityMeta: Record<ImageQuality, { label: string; color: string; icon: React.ElementType }> = {
  good:     { label: 'واضحة',     color: 'text-green-500',  icon: ShieldCheck    },
  warn:     { label: 'نصّ صغير',  color: 'text-yellow-500', icon: ShieldQuestion },
  bad:      { label: 'اقترب',     color: 'text-red-500',    icon: ShieldAlert    },
  checking: { label: 'فحص...',   color: 'text-muted-foreground', icon: Loader2  },
};

// أقصى عمر مقبول لتاريخ فاتورة يقرأه الذكاء. ما تجاوزه يُستبدل بتاريخ اليوم
// مع لافتة ظاهرة. الشهر قرار صاحب المشروع (2026-09-04) — يسع الفاتورة
// المتأخّرة المعقولة، ويمسك خطأ السنة الذي أضاع ٤٥ عنصراً في تاريخ 2023.
const MAX_RECEIPT_AGE_DAYS = 30;

// حدّ اعتبار الفرق بين مجموع العناصر والمجموع المطبوع «عدم تطابق».
//
// كان دينـاراً واحداً — أي أن أي تقريب يُطلق التحذير. وأول فاتورة حقيقية
// أثبتت ذلك (2026-09-04): ٤٥ صنفاً فيها موزونات بالكيلو (2,166 و2,184)،
// فارقها 564 د.ع من 128,750 أي 0.44% — تقريب لا خطأ. والتحذير الكاذب
// المتكرّر يُعلّم المستخدم التجاهل، فيمرّ الخطأ الحقيقي بعده.
//
// النسبة وحدها لا تكفي في الفواتير الصغيرة، والمبلغ وحده لا يكفي في الكبيرة،
// فيؤخذ الأوسع منهما. مُعايَر ليمرّر 564 على تلك الفاتورة (حدّها 1,931)،
// ويمسك رقماً زائداً أو صنفاً مفقوداً ذا شأن.
const MISMATCH_ABS_IQD = 1000;
const MISMATCH_PCT = 0.015;

const confidenceMeta = {
  high:   { label: 'مؤكد',    className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',  dot: 'bg-green-500'  },
  medium: { label: 'مقبول',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', dot: 'bg-yellow-500' },
  low:    { label: 'راجع',    className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',            dot: 'bg-red-500'    },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DetailedReceiptPage() {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // الفئات القابلة للاختيار فقط — «سفر» النظامية مستثناة مركزياً (سفراتي).
  const { selectableCategories: categories } = useCategories();

  // ── سفراتي: لا يظهر أي شيء بغياب سفرة فعّالة ──
  const { activeTrips, travelingTrip } = useActiveTrips();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [itemTripCats, setItemTripCats] = useState<Record<string, TripCategory>>({});
  // التأشير الافتراضي مرة واحدة فقط، وإلا استحال على المستخدم شيله.
  const [tripDefaultApplied, setTripDefaultApplied] = useState(false);
  useEffect(() => {
    if (!tripDefaultApplied && activeTrips.length > 0) {
      // التأشير الافتراضي **فقط** إن كان اليوم ضمن أيام السفرة الفعلية.
      // قبل السفر (حجوزات) وبعد العودة: المربع يظهر غير مؤشَّر.
      if (travelingTrip) setSelectedTripId(travelingTrip.id);
      setTripDefaultApplied(true);
      }
  }, [activeTrips, travelingTrip, tripDefaultApplied]);
  const selectedTrip = activeTrips.find(t => t.id === selectedTripId) ?? null;

  const [viewState, setViewState] = useState<ViewState>('initial');
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [imageToCrop, setImageToCrop] = useState<ImageEntry | null>(null);
  const [analyzedItems, setAnalyzedItems] = useState<EditableItem[]>([]);
  const [storeInfo, setStoreInfo] = useState<{ name: string; date: string | null }>({ name: '', date: null });
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);
  const [receiptType, setReceiptType] = useState<'itemized' | 'simple'>('itemized');
  const [overallConfidence, setOverallConfidence] = useState<'high' | 'medium' | 'low'>('high');
  // التاريخ الذي قرأه الذكاء ورُفض لأنه مستبعد — يُعرض للمستخدم ولا يُبتلع.
  const [rejectedDate, setRejectedDate] = useState<string | null>(null);
  // مصاريف بانتظار تأكيد صريح لأن أرقامها لا تطابق الفاتورة.
  const [pendingSave, setPendingSave] = useState<Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  // ── الكاميرا الاحترافية ──
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  // ⛔ حُذف «وضع الفاتورة الطويلة» (2026-09-04) بعد تجربتين على الجهاز:
  //    شريطه العريض دعا لإدارة الفاتورة أفقياً فيقلب النصّ، وبحذف الشريط
  //    لم يبقَ منه إلا عدّاد غامض بلا أثر. أُضيف بلا فائدة مُثبَتة فأُزيل.
  //    البديل المقترح (التقاط تلقائي عند الوضوح) يحتاج معايرة على جهاز
  //    حقيقي — لا يُبنى بالتخمين.
  const [isCapturing, setIsCapturing] = useState(false);  // وميض الالتقاط
  // مصدر فتح شاشة القص: بعد الالتقاط مباشرة (camera) أو من مصغّرات الشاشة الرئيسية (gallery)
  const [cropSource, setCropSource] = useState<'camera' | 'gallery'>('gallery');

  // ── الالتقاط التلقائي: يحلّ مشكلة الفاتورة الطويلة بلا شريط ولا وضع خاصّ ──
  // بديل «وضع الفاتورة الطويلة» المحذوف: بدل تعليم المستخدم وضعاً جديداً،
  // نلغي الحاجة لضغط الزر أصلاً — يوجّه، يثبت، تُلتقط، ينزل للجزء التالي.
  const [autoCapture, setAutoCapture] = useState(true);
  const [autoStillTicks, setAutoStillTicks] = useState(0);   // للعدّاد المرئي فقط
  const autoPrevRef = useRef<Float32Array | null>(null);     // إطار العيّنة السابق
  const autoArmedRef = useRef(false);   // لا يلتقط مرّتين لنفس الوضع: يتطلّب حركة بينهما
  const autoStillRef = useRef(0);
  const autoFloorRef = useRef<number[]>([]);   // نافذة قراءات الهدوء الأخيرة
  const autoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isCapturingRef = useRef(false);                      // تُقرأ داخل المؤقّت
  const captureRef = useRef<(mode: 'manual' | 'auto') => void>(() => {});

  // تفضيل المستخدم يبقى بين الجلسات — من أطفأه لا يُعاد تشغيله عليه
  useEffect(() => {
    try { if (localStorage.getItem(AUTO_STORAGE_KEY) === '0') setAutoCapture(false); } catch { /* وضع خاصّ */ }
  }, []);
  const toggleAutoCapture = () => {
    setAutoCapture(v => {
      const next = !v;
      try { localStorage.setItem(AUTO_STORAGE_KEY, next ? '1' : '0'); } catch { /* وضع خاصّ */ }
      if (!next) { autoStillRef.current = 0; setAutoStillTicks(0); }
      return next;
    });
  };

  // ── الاقتصاص الحر: مستطيل يسحبه المستخدم فوق الفاتورة — بلا نسب ثابتة ──
  const [cropRect, setCropRect] = useState<CropRect>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);

  const categoryMapForAI = useMemo(() =>
    categories.reduce((acc, cat) => { acc[cat.id] = cat.name; return acc; }, {} as Record<string, string>),
    [categories]
  );

  // computed: sum of items vs receipt total
  const itemsSum = useMemo(() => analyzedItems.reduce((s, i) => s + (i.price || 0), 0), [analyzedItems]);
  const mismatchDiff = receiptTotal !== null ? Math.abs(itemsSum - receiptTotal) : 0;
  const mismatchAllowance = receiptTotal !== null
    ? Math.max(MISMATCH_ABS_IQD, receiptTotal * MISMATCH_PCT)
    : 0;
  const totalMismatch = receiptTotal !== null && mismatchDiff > mismatchAllowance;

  // (ب) لا مجموع مطبوع ⇒ لا مرجع للمقارنة. الصمت هنا كان يشبه «تحقّقنا ووجدناه
  // سليماً» تماماً، فيُقال صراحةً بدل أن يُفهَم طمأنينةً.
  const noPrintedTotal = analyzedItems.length > 0 && receiptTotal === null;

  // (ج) عنصر واحد أغلى من الفاتورة كلّها مستحيل — رقم زائد غالباً. صفر إنذار
  // كاذب: الشرط لا يتحقّق إلا بخطأ مؤكَّد.
  const impossibleItems = useMemo(
    () => (receiptTotal === null ? [] : analyzedItems.filter(i => (i.price || 0) > receiptTotal)),
    [analyzedItems, receiptTotal],
  );
  const lowConfidenceCount = analyzedItems.filter(i => i.confidence === 'low').length;
  const hasQualityWarning = images.some(i => i.quality === 'bad');

  // Camera — نطلب أعلى دقة يوفرها المستشعر + تركيز مستمر، لا الدقة الافتراضية للفيديو
  useEffect(() => {
    let mounted = true;
    const stop = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
    if (viewState !== 'camera') { stop(); setTorchOn(false); return; }
    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 4096 },
        height: { ideal: 3072 },
      },
    })
      .then(async stream => {
        if (!mounted || !videoRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        videoRef.current.play();
        const track = stream.getVideoTracks()[0];
        // تركيز تلقائي مستمر — حاسم لوضوح نص الفاتورة عن قرب (يتجاهله المتصفح إن لم يدعمه)
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }); } catch { /* غير مدعوم */ }
        try {
          const caps: any = track.getCapabilities?.() ?? {};
          if (mounted) setTorchSupported(!!caps.torch);
        } catch { /* غير مدعوم */ }
      })
      .catch(() => {
        if (mounted) {
          toast({ title: 'خطأ في الكاميرا', description: 'تحقق من أذونات الكاميرا.', variant: 'destructive' });
          setViewState('initial');
        }
      });
    return () => { mounted = false; stop(); };
  }, [viewState, toast]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(v => !v);
    } catch { /* بعض الأجهزة لا تدعم الفلاش أثناء البث */ }
  };

  /**
   * محرّك الثبات: يقيس الحركة بين إطارين كل 100ms ويقرّر متى يلتقط وحده.
   *
   * ثلاث حالات، والتسليح هو مفتاح ألّا يلتقط مرّتين لنفس الجزء:
   *   غير مسلَّح → لا يلتقط مهما ثبتت. يُسلَّح فقط بحركة واضحة (≥ AUTO_MOVE_MAD).
   *   مسلَّح      → يعدّ إطارات السكون المتصلة؛ أي حركة تصفّر العدّ.
   *   اكتمل العدّ → التقاط، ثم يعود «غير مسلَّح» — فبعد اللقطة تبقى اليد ثابتة
   *                 فوق نفس الجزء ولا شيء يحدث حتى ينزل المستخدم للجزء التالي.
   *
   * لا يبدأ مسلَّحاً: فتح الكاميرا لا يلتقط قبل أن يوجّه المستخدم فعلاً.
   */
  useEffect(() => {
    if (viewState !== 'camera' || !autoCapture) {
      autoPrevRef.current = null; autoArmedRef.current = false;
      autoStillRef.current = 0; autoFloorRef.current = []; setAutoStillTicks(0);
      return;
    }
    if (!autoCanvasRef.current) autoCanvasRef.current = document.createElement('canvas');

    const id = setInterval(() => {
      const v = videoRef.current, c = autoCanvasRef.current;
      if (!v || !c || isCapturingRef.current || !v.videoWidth) return;

      const h = Math.max(1, Math.round(AUTO_SAMPLE_W * v.videoHeight / v.videoWidth));
      if (c.width !== AUTO_SAMPLE_W || c.height !== h) {
        c.width = AUTO_SAMPLE_W; c.height = h; autoPrevRef.current = null;   // تغيّر الأبعاد يبطل المقارنة
      }
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      let data: Uint8ClampedArray;
      try { ctx.drawImage(v, 0, 0, AUTO_SAMPLE_W, h); data = ctx.getImageData(0, 0, AUTO_SAMPLE_W, h).data; }
      catch { return; }   // إطار غير جاهز

      const n = AUTO_SAMPLE_W * h;
      const cur = new Float32Array(n);
      for (let i = 0, p = 0; i < n; i++, p += 4) {
        cur[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) / 256;   // لوما سريعة
      }
      const prev = autoPrevRef.current;
      autoPrevRef.current = cur;
      if (!prev || prev.length !== n) return;

      // طرح الانزياح العام: تغيّر التعريض التلقائي يرفع الإطار كلّه بالتساوي،
      // ولولا طرحه لقُرئ حركةً فمُنع الالتقاط بلا سبب.
      let mean = 0;
      for (let i = 0; i < n; i++) mean += cur[i] - prev[i];
      mean /= n;
      let mad = 0;
      for (let i = 0; i < n; i++) mad += Math.abs(cur[i] - prev[i] - mean);
      mad /= n;

      if (mad >= AUTO_MOVE_MAD) {                    // تحرّكت الكاميرا: سلّح واصفر
        autoArmedRef.current = true;
        if (autoStillRef.current !== 0) { autoStillRef.current = 0; setAutoStillTicks(0); }
        return;                                      // ولا تُحدَّث الأرضية: الحركة لا تخبر عن الضجيج
      }

      // أرضية الضجيج تُقدَّر من الإطارات الهادئة وحدها — أثناء الحركة الواضحة
      // لا معلومة عن الضجيج أصلاً، فلا تُحدَّث (انظر return أعلاه).
      const win = autoFloorRef.current;
      win.push(mad);
      if (win.length > AUTO_FLOOR_WINDOW) win.shift();
      let floor = win[0];
      for (let i = 1; i < win.length; i++) if (win[i] < floor) floor = win[i];
      // العتبة الفعلية: الثابتة المقيسة، أو ضِعف الأرضية إن كانت الكاميرا أسوأ
      // ممّا قِيس — ومحدودة دون عتبة التسليح كي لا تلتمس الحركةَ سكوناً.
      const stillLimit = Math.min(AUTO_MOVE_MAD * 0.8, Math.max(AUTO_STILL_MAD, floor * AUTO_FLOOR_FACTOR));

      if (!autoArmedRef.current) return;             // ثابتة لكن غير مسلَّحة — لا شيء
      if (mad > stillLimit) {                        // بين العتبتين: لا سكون ولا تسليح
        if (autoStillRef.current !== 0) { autoStillRef.current = 0; setAutoStillTicks(0); }
        return;
      }

      const ticks = autoStillRef.current + 1;
      autoStillRef.current = ticks;
      setAutoStillTicks(ticks);
      if (ticks >= AUTO_STILL_TICKS) {
        autoArmedRef.current = false;                // يتطلّب حركة قبل اللقطة التالية
        autoStillRef.current = 0; setAutoStillTicks(0);
        captureRef.current('auto');
      }
    }, AUTO_TICK_MS);

    return () => clearInterval(id);
  }, [viewState, autoCapture]);

  // يضيف الصورة فوراً ويعيد مدخلها (فحص الجودة يكمل بالخلفية) — الإرجاع الفوري
  // ضروري لفتح شاشة القص مباشرة بعد الالتقاط دون انتظار الفحص
  const addImage = useCallback((src: string): ImageEntry => {
    const entry: ImageEntry = { id: crypto.randomUUID(), src, quality: 'checking' };
    setImages(prev => [...prev, entry]);
    checkImageQuality(src).then(quality => {
      setImages(prev => prev.map(img => img.id === entry.id ? { ...img, quality } : img));
      if (quality === 'bad') {
        toast({
          title: '⚠️ النصّ أصغر من أن يُقرأ',
          description: 'اقترب من الفاتورة حتى تملأ الشاشة، أو صوّرها جزءاً جزءاً. الأرقام الصغيرة تُقرأ خطأً.',
          variant: 'destructive',
        });
      }
    });
    return entry;
  }, [toast]);

  // عند فتح صورة للتحديد: مستطيل ابتدائي يغطي 84% منها — إزاحة 8% تُبقي زوايا
  // السحب كاملةً داخل الصورة فتبان واضحة وقابلة للإمساك (لا مقصوصة على الحافة)
  const onCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCropRect({ unit: 'px', x: width * 0.08, y: height * 0.08, width: width * 0.84, height: height * 0.84 });
  }, []);

  /**
   * يطبّق القص (إن حدّد المستخدم مستطيلاً) ثم ينتقل للوجهة المطلوبة:
   * initial = الشاشة الرئيسية · camera = التقاط صورة أخرى · analyze = بدء التحليل فوراً.
   * بلا تحديد → تبقى الصورة كاملة كما هي (القص اختياري).
   */
  const finishCrop = async (next: 'initial' | 'camera' | 'analyze') => {
    if (!imageToCrop) return;
    let updated = images;
    try {
      const img = cropImgRef.current;
      if (completedCrop && img && completedCrop.width >= 10 && completedCrop.height >= 10) {
        // تحويل إحداثيات المستطيل من أبعاد العرض إلى أبعاد الصورة الأصلية
        const scaleX = img.naturalWidth / img.width;
        const scaleY = img.naturalHeight / img.height;
        const pixels = {
          x: Math.round(completedCrop.x * scaleX),
          y: Math.round(completedCrop.y * scaleY),
          width: Math.round(completedCrop.width * scaleX),
          height: Math.round(completedCrop.height * scaleY),
        };
        if (pixels.width >= 10 && pixels.height >= 10) {
          const cropped = await getCroppedImg(imageToCrop.src, pixels);
          const quality = await checkImageQuality(cropped);
          updated = images.map(i => i.id === imageToCrop.id ? { ...i, src: cropped, quality } : i);
          setImages(updated);
        }
      }
    } catch { toast({ title: 'خطأ في الاقتصاص', variant: 'destructive' }); return; }
    setImageToCrop(null); setCropRect(undefined); setCompletedCrop(null);
    if (next === 'analyze') { setViewState('initial'); handleAnalyze(updated); }
    else setViewState(next);
  };

  /** إعادة التقاط: حذف اللقطة الحالية والعودة للكاميرا */
  const retakePhoto = () => {
    if (imageToCrop) setImages(prev => prev.filter(i => i.id !== imageToCrop.id));
    setImageToCrop(null); setCropRect(undefined); setCompletedCrop(null);
    setViewState('camera');
  };

  // ⚠️ صورة الاستوديو تُفتح على شاشة القص كما لقطة الكاميرا بالضبط.
  //
  // كانت تُضاف كما هي: صورة هاتف عادية تشغل فيها الفاتورة جزءاً صغيراً من
  // إطار فيه طاولة وأرضية. ثم يُصغَّر كل شيء قبل الإرسال، فيصل نصّ الفاتورة
  // إلى الذكاء أصغر بكثير ممّا يصل من لقطة التطبيق — وهذا ما لاحظه صاحب
  // المشروع (2026-09-04): الرفع أسوأ دقّةً من الالتقاط.
  //
  // شاشة القص كانت تدعم مصدر gallery أصلاً (زرّا «تخطي» و«تأكيد»)، لكن لا
  // شيء كان يوجّه الصور المرفوعة إليها. والقص يجعل الفاتورة تملأ الإطار،
  // فتذهب كل البكسلات إلى النصّ لا إلى الطاولة.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const entry = addImage(reader.result as string);
      setCropRect(undefined); setCompletedCrop(null);
      setImageToCrop(entry);
      setCropSource('gallery');
      setViewState('cropping');
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * الالتقاط — بمصدرين ومآلين مختلفين عمداً:
   *   manual: ضغطة الزر = «هذه لقطتي» ⇒ تُفتح شاشة القص فوراً لتأطيرها.
   *   auto:   ثبات اليد = «جزء من فاتورة طويلة» ⇒ تبقى الكاميرا مفتوحة
   *           لينزل للجزء التالي. الانتقال للقص هنا كان سيقطع التسلسل الذي
   *           بُنيت الميزة كلّها من أجله. القص متاح لاحقاً بضغط المصغّرة.
   */
  const capturePhoto = async (mode: 'manual' | 'auto') => {
    if (isCapturingRef.current) return; // منع الضغط المزدوج أثناء الالتقاط
    isCapturingRef.current = true;
    setIsCapturing(true);
    let dataUri: string | null = null;

    // 1) ImageCapture: صورة فوتوغرافية بدقة المستشعر الكاملة (وليس لقطة فيديو) — مدعوم في كروم أندرويد
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && typeof (window as any).ImageCapture !== 'undefined') {
      try {
        const imageCapture = new (window as any).ImageCapture(track);
        const blob: Blob = await imageCapture.takePhoto();
        dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(blob);
        });
      } catch { /* بعض الأجهزة تفشل → نسقط للطريقة الاحتياطية */ }
    }

    // 2) احتياط: لقطة من إطار الفيديو (النمط القديم) — أفضل من لا شيء
    if (!dataUri && videoRef.current && photoRef.current) {
      const v = videoRef.current, c = photoRef.current;
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d')?.drawImage(v, 0, 0);
      dataUri = c.toDataURL('image/jpeg', 0.95);
    }

    if (!dataUri) { isCapturingRef.current = false; setIsCapturing(false); return; }
    const entry = addImage(dataUri);
    // اهتزازة قصيرة: تأكيد يُحسّ بلا نظر — المستخدم عينه على الفاتورة لا على الشاشة
    if (mode === 'auto') { try { navigator.vibrate?.(40); } catch { /* غير مدعوم */ } }

    setTimeout(() => {
      isCapturingRef.current = false;
      setIsCapturing(false);
      autoPrevRef.current = null;   // إطار ما قبل الوميض لا يُقارَن بما بعده
      if (mode === 'auto') return;  // ابقَ بالكاميرا للجزء التالي
      // وميض قصير ثم فتح شاشة القص مباشرة — الصورة تبقى أمام المستخدم بدل مصغّرة بالزاوية
      setCropRect(undefined); setCompletedCrop(null);
      setImageToCrop(entry);
      setCropSource('camera');
      setViewState('cropping');
    }, 220);
  };
  captureRef.current = capturePhoto;   // المؤقّت يستدعي أحدث نسخة بلا إعادة تشغيله
  const takePhoto = () => capturePhoto('manual');

  // imagesToAnalyze: تُمرَّر عند التحليل الفوري من شاشة القص لأن setImages لم تُحدَّث بعد
  const handleAnalyze = async (imagesToAnalyze: ImageEntry[] = images) => {
    if (!user || imagesToAnalyze.length === 0) {
      toast({ title: 'لا توجد صور', description: 'أضف صورة فاتورة واحدة على الأقل.', variant: 'destructive' });
      return;
    }
    setIsLoading(true); setProcessingStep('uploading'); setError(null); setAnalyzedItems([]); setRejectedDate(null);
    try {
      // P1/H4: ضغط الصور قبل الإرسال — يقلّص الحجم بشدة (سرعة + نت + تجنّب التعليق).
      const maxDim = maxDimForCount(imagesToAnalyze.length);
      const compressedImages = await Promise.all(imagesToAnalyze.map(i => compressDataUri(i.src, maxDim)));

      // مهلة client-side: تُلغي الطلب إن تجاوز 75 ثانية بدل التعليق اللانهائي.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 75000);

      setProcessingStep('analyzing');
      let res: Response;
      try {
        res = await fetch('/api/receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptImages: compressedImages, categories: categoryMapForAI }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const response: { ok: boolean; data?: AnalyzeDetailedReceiptOutput; error?: string } = await res.json();
      if (!response.ok || !response.data) throw new Error(response.error ?? 'خطأ غير معروف من الخادم');
      const result = response.data;

      setProcessingStep('extracting');
      // ⚠️ تاريخ الفاتورة يقرأه الذكاء من صورة قد تكون باهتة أو ممزّقة، فيخطئ
      // في السنة أحياناً. وقعت الحادثة فعلاً (2026-09-03): فاتورة اليوم حُفظت
      // بتاريخ 2023، فذهبت ٤٥ عنصراً إلى أسفل القائمة ولم يتحرّك مجموع الشهر —
      // والمستخدم رأى «تم الحفظ ✅» بحق، فالحفظ نجح والخطأ في تاريخ لم يُراجَع.
      //
      // فالتاريخ المستخرَج لا يُعتمد صامتاً: ما تجاوز شهراً أو كان مستقبلياً أو
      // غير مفهوم يُستبدل بتاريخ اليوم، ويُعرض ما قُرئ في لافتة ليصحّحه المستخدم
      // إن كانت الفاتورة قديمة فعلاً. (منتقي التاريخ اليدوي يمنع المستقبل أصلاً،
      // وكان التاريخ المستخرَج يتخطّى ذلك المنع تماماً.)
      const today = new Date();
      const parsed = result.transactionDate ? new Date(result.transactionDate) : null;
      const ageDays = parsed && isValid(parsed) ? differenceInCalendarDays(today, parsed) : null;
      const dateIsSane = ageDays !== null && ageDays >= 0 && ageDays <= MAX_RECEIPT_AGE_DAYS;

      const date = dateIsSane ? format(parsed!, 'yyyy-MM-dd') : format(today, 'yyyy-MM-dd');
      setRejectedDate(
        dateIsSane || !result.transactionDate
          ? null
          : parsed && isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : String(result.transactionDate),
      );
      setStoreInfo({ name: result.storeName || '', date });
      setReceiptTotal(result.totalAmount ?? null);
      setReceiptType(result.receiptType ?? 'itemized');
      setOverallConfidence(result.overallConfidence ?? 'high');
      setAnalyzedItems(result.items.map(item => ({ ...item, id: crypto.randomUUID() })));
      setProcessingStep(null);
    } catch (e: any) {
      console.error('Receipt analysis error:', e);
      // انتهاء المهلة (إلغاء الطلب) → رسالة واضحة بدل تعليق صامت
      if (e?.name === 'AbortError') {
        setError('استغرق التحليل وقتاً أطول من المتوقع. تأكد من قوة الإنترنت وأن الفاتورة واضحة، ثم حاول مجدداً.');
        setProcessingStep(null);
        return;
      }
      const detail = e instanceof Error ? e.message : String(e);
      setError(
        detail && detail.length < 120
          ? `حدث خطأ أثناء التحليل: ${detail}`
          : 'حدث خطأ أثناء تحليل الفاتورة. تأكد أن الصور واضحة وحاول مرة أخرى.'
      );
      setProcessingStep(null);
    } finally { setIsLoading(false); }
  };

  const handleItemChange = (id: string, field: keyof EditableItem, value: string | number) => {
    setAnalyzedItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: field === 'price' ? Number(normalizeDigits(String(value)).replace(/[^\d.]/g, '')) || 0 : value } : item
    ));
  };

  const addMultipleExpensesMutation = useMutation({
    mutationFn: (exps: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[]) => {
      if (!user) throw new Error('not auth');
      // Atomic batch — all items saved together or none (no partial saves).
      return addExpensesBatch(user.uid, exps, householdId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
      toast({ title: 'تم الحفظ ✅', description: `تم حفظ ${vars.length} مصروف بنجاح.` });
      if (analytics) {
        const a = analytics;
        try {
          vars.forEach(v => {
            logEvent(a, 'expense_added', {
              category: v.category,
              amount: v.amount,
              input_method: 'receipt',
            });
          });
        } catch {}
      }
      setImages([]); setAnalyzedItems([]); setStoreInfo({ name: '', date: null }); setReceiptTotal(null); setRejectedDate(null);
    },
    onError: () => toast({ title: 'خطأ في الحفظ', variant: 'destructive' }),
  });

  const handleSaveAll = () => {
    if (!user) return;
    const toSave = analyzedItems.map(item => {
      const base = {
        title: item.name,
        amount: item.price,
        category: item.suggestedCategory,
        date: storeInfo.date ? new Date(storeInfo.date).toISOString() : new Date().toISOString(),
        description: storeInfo.name ? `فاتورة: ${storeInfo.name}` : 'مصروف من فاتورة',
      };
      // ضمن سفرة: اختيار واحد يُطبَّق على كل عناصر الفاتورة.
      return selectedTrip
        ? {
            ...base,
            category: TRAVEL_CATEGORY_ID,
            tripId: selectedTrip.id,
            tripCategory: itemTripCats[item.id] ?? ('other' as TripCategory),
            isOutOfBudget: !selectedTrip.countsInBudget,
          }
        : base;
    });
    if (toSave.some(e => !e.title || e.amount <= 0)) {
      toast({ title: 'بيانات غير مكتملة', description: 'تأكد أن كل عنصر له اسم وسعر صحيح.', variant: 'destructive' });
      return;
    }
    // (أ) الرقم لا يطابق الفاتورة ⇒ قرار صريح لا ضغطة. كان التحذير يُخبر ولا
    // يمنع، فزرّ «تأكيد وحفظ» يبقى فعّالاً — وهو نفس شكل عطل التاريخ: مرئي لو
    // نظرتَ، ولا شيء يجبرك على النظر.
    if (totalMismatch || impossibleItems.length > 0) {
      setPendingSave(toSave);
      return;
    }
    addMultipleExpensesMutation.mutate(toSave);
  };

  const confirmPendingSave = () => {
    if (!pendingSave) return;
    addMultipleExpensesMutation.mutate(pendingSave);
    setPendingSave(null);
  };

  const progressValue = processingStep === 'uploading' ? 25 : processingStep === 'analyzing' ? 65 : processingStep === 'extracting' ? 90 : 0;
  const progressLabel =
    processingStep === 'uploading'  ? 'جاري تجهيز الصورة...' :
    processingStep === 'analyzing'  ? 'الذكاء الاصطناعي يقرأ الفاتورة...' :
    processingStep === 'extracting' ? 'جاري استخراج البيانات المالية...' : '';

  // ── Camera view — كاميرا احترافية بنمط الماسح الضوئي ─────────────────────────
  if (viewState === 'camera') return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <header className="absolute top-0 left-0 right-0 p-4 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
        <Button variant="ghost" size="icon" onClick={() => setViewState('initial')} className="text-white hover:bg-white/10 hover:text-white">
          <ArrowRight />
        </Button>
        <div className="flex items-center gap-2">
          {/* مفتاح التلقائي — ظاهر دائماً: من لا يريده يطفئه بضغطة، ويبقى مطفأً */}
          <button onClick={toggleAutoCapture} aria-label="الالتقاط التلقائي"
            aria-pressed={autoCapture}
            className={cn(
              "h-11 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-bold transition-colors backdrop-blur-sm",
              autoCapture ? "bg-white text-black" : "bg-white/15 text-white"
            )}>
            <Zap className={cn("h-4 w-4", autoCapture ? "fill-black" : "")} />
            تلقائي
          </button>
          {torchSupported && (
            <button onClick={toggleTorch} aria-label="الفلاش"
              className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm",
                torchOn ? "bg-yellow-400 text-black" : "bg-white/15 text-white"
              )}>
              {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 relative">
        <video ref={videoRef} className="w-full h-full object-contain" autoPlay muted playsInline />
        <canvas ref={photoRef} className="hidden" />

        {/* وميض الالتقاط */}
        <div className={cn(
          "absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 z-10",
          isCapturing ? "opacity-70" : "opacity-0"
        )} />

        {/* لا إطار ولا أركان: المعاينة (object-contain) تعرض كامل ما سيُلتقط،
            فرسم حدود حولها لا يضيف معلومة — بل يوحي بمنطقة داخلية لا وجود
            لها، ويدفع المستخدم للتصويب على شيء ثابت لا يتحرّك (ملاحظة صاحب
            المشروع 2026-09-04). ما تراه هو ما تحصل عليه، وهذا يكفي. */}

        {/* عدّاد الالتقاط التلقائي — يُرى قبل أن يحدث، فلا يفاجئ: من لا يريد
            اللقطة يحرّك الهاتف قليلاً فيتوقّف العدّ فوراً. */}
        {autoCapture && autoStillTicks > 0 && !isCapturing && (
          <div className="absolute bottom-60 inset-x-0 flex justify-center pointer-events-none animate-in fade-in duration-150">
            <div className="px-4 py-2.5 rounded-2xl bg-emerald-600/90 backdrop-blur-sm shadow-lg text-center">
              <p className="text-white text-sm font-bold drop-shadow">ثابتة — التقاط تلقائي</p>
              {/* شريط يمتلئ من اليمين تلقائياً (RTL) لأنه في تدفّق عادي لا مطلق */}
              <div className="mt-2 h-1.5 w-32 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                  style={{ width: `${Math.min(100, (autoStillTicks / AUTO_STILL_TICKS) * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-40 inset-x-4 text-center pointer-events-none">
          <div className="inline-block px-4 py-2.5 rounded-2xl bg-black/45 backdrop-blur-sm">
          {/* سطران قصيران لا أكثر: أربعة أسطر كانت تُقرأ «معقّدة».
              والسطر الثاني يتبع حالة المفتاح — تعليمة لا تصف ما يفعله
              التطبيق فعلاً أسوأ من لا تعليمة. */}
          <p className="text-white text-sm font-medium drop-shadow">
            {images.length === 0 ? 'قرّب حتى تملأ الفاتورة الشاشة' : `التقطت ${images.length} — تابع بقية الفاتورة`}
          </p>
          <p className="text-white/60 text-[11px] mt-1 drop-shadow">
            {autoCapture ? 'ثبّت يدك وتُلتقط وحدها — ثم انزل للجزء التالي' : 'أطول من الشاشة؟ صوّرها جزءاً جزءاً وهي عمودية'}
          </p>
          </div>
        </div>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent pb-24 pt-8 px-6">
        <div className="grid grid-cols-3 items-center">
          {/* معاينة آخر صورة مجمّعة + العدّاد */}
          <div className="flex justify-start">
            {images.length > 0 && (
              <div className="relative animate-in zoom-in-75 duration-200" key={images.length}>
                <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white/90 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={images[images.length - 1].src} alt="آخر لقطة" className="w-full h-full object-cover" />
                </div>
                <span className="absolute -top-2 -left-2 min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shadow">
                  {images.length}
                </span>
              </div>
            )}
          </div>

          {/* زر الغالق — حلقة بيضاء بقرص داخلي، نمط كاميرات الهواتف */}
          <div className="flex justify-center">
            <button onClick={takePhoto} aria-label="التقاط"
              className="w-[76px] h-[76px] rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-90">
              <span className={cn(
                "rounded-full bg-white transition-all duration-150",
                isCapturing ? "w-12 h-12" : "w-[60px] h-[60px]"
              )} />
            </button>
          </div>

          {/* زر إنهاء الجلسة */}
          <div className="flex justify-end">
            {images.length > 0 && (
              <button onClick={() => setViewState('initial')}
                className="h-12 px-5 rounded-full bg-white text-black text-sm font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform animate-in fade-in">
                <Check className="h-4 w-4" />
                تم
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );

  // ── Crop view — تحديد حر لحدود الفاتورة: اسحب الزوايا لتطويقها، بلا نسب ثابتة ──
  if (viewState === 'cropping' && imageToCrop) return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="p-4 flex justify-between items-center border-b">
        <h2 className="text-base font-bold flex items-center gap-2"><Crop className="h-5 w-5 text-primary" /> تحديد حدود الفاتورة</h2>
        {/* X بعد الالتقاط = تجاهل اللقطة والعودة للكاميرا · من المصغّرات = إغلاق فقط */}
        <Button variant="ghost" size="icon" onClick={() => {
          if (cropSource === 'camera') retakePhoto();
          else { setImageToCrop(null); setCropRect(undefined); setCompletedCrop(null); setViewState('initial'); }
        }}><X /></Button>
      </header>
      <div className="flex-1 overflow-auto bg-black/90 flex items-center justify-center p-3" dir="ltr">
        <ReactCrop
          className="receipt-crop"
          crop={cropRect}
          onChange={c => setCropRect(c)}
          onComplete={c => setCompletedCrop(c)}
          keepSelection
          ruleOfThirds
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={cropImgRef} src={imageToCrop.src} alt="الفاتورة"
            onLoad={onCropImageLoad}
            style={{ maxHeight: 'calc(100vh - 220px)', maxWidth: '100%', objectFit: 'contain' }} />
        </ReactCrop>
      </div>
      <div className="p-4 border-t space-y-3 pb-24">
        <p className="text-xs text-muted-foreground text-center">اسحب الزوايا والحواف حتى تطوّق الفاتورة فقط</p>
        {cropSource === 'camera' ? (
          <>
            {/* بعد الالتقاط مباشرة: تحليل فوري أو لقطة إضافية (فاتورة طويلة) — القص اختياري */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12" onClick={() => finishCrop('camera')}>
                <Camera className="ml-2 h-4 w-4" /> صورة أخرى
              </Button>
              <Button className="h-12" onClick={() => finishCrop('analyze')}>
                <Sparkles className="ml-2 h-4 w-4" /> تحليل
              </Button>
            </div>
            <Button variant="ghost" className="w-full h-11 text-muted-foreground" onClick={retakePhoto}>
              <XCircle className="ml-2 h-4 w-4" /> إعادة التقاط
            </Button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => { setImageToCrop(null); setCropRect(undefined); setCompletedCrop(null); setViewState('initial'); }}>إلغاء</Button>
            <Button onClick={() => finishCrop('initial')}>
              <Check className="ml-2 h-4 w-4" /> تأكيد
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // ── Main view ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-28">

      {/* ── Upload Card ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-primary" />
            تحليل الفواتير المفصلة
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            صوّر فاتورتك أو حمّلها — سيستخرج الذكاء الاصطناعي كل عنصر وسعره تلقائياً
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* (٦) التلميحات قبل التصوير لا بعده. أكثر ثلاثة أسباب تفسد اللقطة في
              صور صاحب المشروع: اليد على الأسطر، الوهج على السطح اللامع، والابتعاد. */}
          <div className="rounded-lg bg-muted/50 border p-3 space-y-1.5">
            <p className="text-[11px] font-semibold">للحصول على أدقّ قراءة</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">• امسك الفاتورة من حافتها — يدك على الأسطر تخفيها عن الذكاء</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">• ضعها على سطح غير لامع، ولا تستعمل الفلاش على الورق اللامع</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">• قرّب حتى تملأ عرض الإطار — والطويلة تُصوَّر جزءاً جزءاً</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-14 flex-col gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-5 w-5" />
              تحميل فاتورة
            </Button>
            <Button variant="outline" className="h-14 flex-col gap-1 text-xs" onClick={() => setViewState('camera')}>
              <Camera className="h-5 w-5" />
              تصوير فاتورة
            </Button>
          </div>
          <Input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          {/* Quality warning banner */}
          {hasQualityWarning && (
            <Alert variant="destructive" className="py-2">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">
                إحدى الصور ذات جودة منخفضة. أعد تصويرها في ضوء جيد للحصول على دقة أفضل.
              </AlertDescription>
            </Alert>
          )}

          {/* Thumbnails */}
          {images.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{images.length} صورة مضافة</p>
              <div className="flex gap-3 flex-wrap">
                {images.map(img => {
                  const q = qualityMeta[img.quality];
                  const QIcon = q.icon;
                  return (
                    <div key={img.id} className="flex flex-col items-center gap-1">
                      <div className="relative w-20 h-28">
                        <div className="relative w-full h-full rounded-lg overflow-hidden border-2 border-border">
                          <Image src={img.src} alt="فاتورة" fill className="object-cover" />
                        </div>
                        {/* Quality badge */}
                        <div className={cn("absolute top-1 right-1 flex items-center gap-0.5 bg-white/90 dark:bg-black/70 rounded px-1 py-0.5", q.color)}>
                          <QIcon className={cn("h-3 w-3", img.quality === 'checking' && "animate-spin")} />
                          <span className="text-[9px] font-semibold">{q.label}</span>
                        </div>
                      </div>
                      {/* Action buttons — always visible for touch */}
                      <div className="flex gap-1">
                        <button className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center active:scale-90 transition-transform"
                          onClick={() => { setCropRect(undefined); setCompletedCrop(null); setImageToCrop(img); setCropSource('gallery'); setViewState('cropping'); }}>
                          <Crop className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button className="h-8 w-8 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center active:scale-90 transition-transform"
                          onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button onClick={() => handleAnalyze()} disabled={isLoading || images.length === 0} className="w-full h-12">
            {isLoading ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : <Sparkles className="ml-2 h-5 w-5" />}
            بدء التحليل الذكي
          </Button>
        </CardContent>
      </Card>

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {isLoading && (
        <Card className="animate-in fade-in zoom-in-95">
          <CardContent className="py-10 flex flex-col items-center gap-5">
            <div className="relative">
              <Loader2 className="h-16 w-16 text-primary/30 animate-spin" />
              <FileScan className="absolute inset-0 m-auto h-8 w-8 text-primary" />
            </div>
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-primary font-semibold">{progressLabel}</span>
                <span className="text-muted-foreground">{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              قد تستغرق العملية 10–20 ثانية حسب حجم الفاتورة
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>خطأ في التحليل</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {analyzedItems.length > 0 && !isLoading && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">مراجعة وتأكيد المصاريف</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  تم استخراج {analyzedItems.length} عنصر — راجع وعدّل إذا لزم ثم احفظ
                </CardDescription>
              </div>
              {/* Overall confidence badge */}
              <span className={cn(
                "shrink-0 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
                overallConfidence === 'high'   && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                overallConfidence === 'medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
                overallConfidence === 'low'    && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
              )}>
                {overallConfidence === 'high'   && <CheckCircle2 className="h-3 w-3" />}
                {overallConfidence === 'medium' && <AlertCircle  className="h-3 w-3" />}
                {overallConfidence === 'low'    && <ShieldAlert  className="h-3 w-3" />}
                جودة القراءة: {overallConfidence === 'high' ? 'عالية' : overallConfidence === 'medium' ? 'متوسطة' : 'منخفضة'}
              </span>
            </div>

            {/* Warnings */}
            <div className="space-y-2 mt-2">
              {/* تاريخ مستبعد: يُعرض ما قرأه الذكاء صراحةً بدل ابتلاعه */}
              {rejectedDate && (
                <Alert className="py-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                  <TriangleAlert className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                    قرأنا من الفاتورة تاريخ <bdi className="font-semibold">{rejectedDate}</bdi> وهو مستبعد —
                    استُعمل <span className="font-semibold">تاريخ اليوم</span> بدلاً منه.
                    عدّله من «تاريخ الفاتورة» أدناه إن كانت قديمة فعلاً.
                  </AlertDescription>
                </Alert>
              )}
              {/* (ج) عنصر أغلى من الفاتورة كلّها — خطأ مؤكَّد لا احتمال */}
              {impossibleItems.length > 0 && (
                <Alert variant="destructive" className="py-2">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {impossibleItems.length === 1
                      ? <>عنصر «{impossibleItems[0].name}» سعره <bdi className="font-semibold">{formatCurrency(impossibleItems[0].price)}</bdi> أي أغلى من الفاتورة كلّها — رقم زائد غالباً.</>
                      : <>{impossibleItems.length} عناصر أسعارها أغلى من الفاتورة كلّها — أرقام زائدة غالباً.</>}
                    {' '}صحّح السعر قبل الحفظ.
                  </AlertDescription>
                </Alert>
              )}

              {/* (ب) لا مجموع مطبوع ⇒ لا فحص. يُقال بدل أن يُفهَم الصمت طمأنينةً */}
              {noPrintedTotal && (
                <Alert className="py-2 border-sky-300 bg-sky-50 dark:bg-sky-950/30">
                  <Info className="h-4 w-4 text-sky-600" />
                  <AlertDescription className="text-xs text-sky-800 dark:text-sky-200">
                    لا يوجد مجموع كلّي مطبوع على هذه الفاتورة، فلم نستطع التحقّق من الأسعار —
                    راجعها بنفسك قبل الحفظ.
                  </AlertDescription>
                </Alert>
              )}

              {/* Total mismatch warning */}
              {totalMismatch && (
                <Alert className="py-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                  <TriangleAlert className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                    فرق <bdi className="font-semibold">{formatCurrency(mismatchDiff)}</bdi> بين مجموع العناصر
                    (<bdi>{itemsSum.toLocaleString()}</bdi>) والمجموع المطبوع (<bdi>{receiptTotal?.toLocaleString()}</bdi>).
                    راجع الأسعار أو أضف عناصر مفقودة.
                  </AlertDescription>
                </Alert>
              )}
              {/* Low confidence items warning */}
              {lowConfidenceCount > 0 && (
                <Alert className="py-2 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30">
                  <Info className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
                    {lowConfidenceCount} عنصر مميز بـ <span className="font-semibold">«راجع»</span> — تحقق منه قبل الحفظ.
                  </AlertDescription>
                </Alert>
              )}
              {/* Total match confirmation */}
              {receiptTotal !== null && !totalMismatch && (
                <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  مجموع العناصر يطابق المبلغ الكلي للفاتورة ✓
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Store & Date */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-xs">اسم المتجر</Label>
                <Input value={storeInfo.name} onChange={e => setStoreInfo(p => ({ ...p, name: e.target.value }))}
                  placeholder="اختياري" className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">تاريخ الفاتورة</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-9 text-xs justify-start font-normal", !storeInfo.date && "text-muted-foreground")}>
                      <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                      {storeInfo.date ? format(new Date(storeInfo.date), 'dd/MM/yyyy') : 'اختر تاريخاً'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single"
                      selected={storeInfo.date ? new Date(storeInfo.date) : new Date()}
                      onSelect={d => setStoreInfo(p => ({ ...p, date: d ? format(d, 'yyyy-MM-dd') : null }))}
                      initialFocus dir="rtl" locale={arIQ}
                      disabled={d => d > new Date()} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* ─── سفراتي: اختيار واحد يُطبَّق على كل مصاريف الفاتورة ─── */}
            <TripExpenseToggle activeTrips={activeTrips} selectedTripId={selectedTripId} onSelect={setSelectedTripId} />

            {/* Items list */}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {analyzedItems.map((item, idx) => {
                const conf = confidenceMeta[item.confidence];
                return (
                  <div key={item.id}
                    className={cn(
                      "p-3 border rounded-xl space-y-2 animate-in fade-in transition-colors",
                      item.confidence === 'low'    && "border-red-200    bg-red-50/50    dark:border-red-800    dark:bg-red-950/20",
                      item.confidence === 'medium' && "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20",
                      item.confidence === 'high'   && "bg-background",
                    )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">{idx + 1}</span>
                        {/* Confidence badge */}
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold", conf.className)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", conf.dot)} />
                          {conf.label}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => setAnalyzedItems(prev => prev.filter(i => i.id !== item.id))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Input value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                        placeholder="اسم العنصر" className="h-8 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">السعر</Label>
                        <Input type="text" inputMode="decimal" value={item.price || ''} onChange={e => handleItemChange(item.id, 'price', e.target.value)}
                          placeholder="0" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">الفئة</Label>
                        {/* ضمن سفرة: التصنيف الثماني يحلّ محل فئات تدبير، وتُحفظ
                            الفئة العامة «سفر» برمجياً عند الحفظ. */}
                        {selectedTrip ? (
                          <Select value={itemTripCats[item.id] ?? 'other'}
                                  onValueChange={v => setItemTripCats(p => ({ ...p, [item.id]: v as TripCategory }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TRIP_CATEGORIES.map(c => (
                                <SelectItem key={c} value={c} className="text-xs">{TRIP_CATEGORY_LABEL[c]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                        <Select value={item.suggestedCategory} onValueChange={v => handleItemChange(item.id, 'suggestedCategory', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {categories.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button variant="outline" className="w-full h-9 text-xs" onClick={() => setAnalyzedItems(prev => [
              ...prev,
              { id: crypto.randomUUID(), name: '', price: 0, suggestedCategory: 'other', confidence: 'high' }
            ])}>
              <PlusCircle className="ml-2 h-4 w-4" />
              إضافة عنصر يدوياً
            </Button>
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            {/* Summary row */}
            <div className="flex justify-between items-center w-full px-1 pb-1 text-sm">
              <span className="text-muted-foreground text-xs">مجموع العناصر:</span>
              <span className={cn("font-bold", totalMismatch ? "text-amber-600" : "text-foreground")}>
                {itemsSum.toLocaleString()} {receiptTotal !== null && `/ ${receiptTotal.toLocaleString()}`}
              </span>
            </div>
            {/* (أ) نافذة تعرض الرقمين والفرق — يقرّر المستخدم على بيّنة */}
            <AlertDialog open={!!pendingSave} onOpenChange={o => { if (!o) setPendingSave(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>الأرقام لا تطابق الفاتورة</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs leading-relaxed space-y-2">
                    {totalMismatch && (
                      <span className="block">
                        مجموع العناصر <bdi className="font-semibold">{formatCurrency(itemsSum)}</bdi>،
                        والمطبوع على الفاتورة <bdi className="font-semibold">{receiptTotal !== null ? formatCurrency(receiptTotal) : ''}</bdi> —
                        بفرق <bdi className="font-semibold">{formatCurrency(mismatchDiff)}</bdi>.
                      </span>
                    )}
                    {impossibleItems.length > 0 && (
                      <span className="block">و{impossibleItems.length} عنصر سعره أغلى من الفاتورة كلّها.</span>
                    )}
                    <span className="block">تستطيع الحفظ كما هو، أو الرجوع لتصحيح الأسعار أولاً.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>رجوع للتصحيح</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmPendingSave}>احفظ كما هو</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button onClick={handleSaveAll} className="w-full h-12" disabled={addMultipleExpensesMutation.isPending}>
              {addMultipleExpensesMutation.isPending
                ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...</>
                : <><Check className="ml-2 h-4 w-4" /> تأكيد وحفظ {analyzedItems.length} مصروف</>
              }
            </Button>
          </CardFooter>
        </Card>
      )}

    </div>
  );
}
