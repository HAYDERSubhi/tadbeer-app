
// src/app/(main)/receipts/page.tsx
"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Upload, FileScan, Loader2, XCircle, Trash2, PlusCircle, Sparkles,
  AlertTriangleIcon, Camera, Check, X, ArrowRight, Crop, ZoomIn,
  Receipt, Calendar as CalendarIcon, Pencil, ShieldCheck, ShieldAlert,
  ShieldQuestion, Info, CheckCircle2, AlertCircle, TriangleAlert
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { AnalyzeDetailedReceiptOutput } from '@/ai/flows/analyze-detailed-receipt';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addExpensesBatch } from '@/services/firestore';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import type { Point, Area } from 'react-easy-crop';
import getCroppedImg from '@/lib/crop-image';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { cn } from '@/lib/utils';
import { useCategories } from '@/hooks/use-categories';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

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
const compressDataUri = (src: string, maxDim = 2000, quality = 0.82): Promise<string> =>
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

/** Runs a quick brightness + contrast check on a data URI image. */
const checkImageQuality = (src: string): Promise<ImageQuality> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const SIZE = 120;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve('good'); return; }
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
      let totalBrightness = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4)
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      const avg = totalBrightness / pixels;
      let variance = 0;
      for (let i = 0; i < data.length; i += 4)
        variance += Math.pow((data[i] + data[i + 1] + data[i + 2]) / 3 - avg, 2);
      variance /= pixels;
      // variance < 150 → very uniform / blurry  |  avg < 55 → very dark
      if (avg < 55 || variance < 150) resolve('bad');
      else if (avg < 90 || variance < 400) resolve('warn');
      else resolve('good');
    };
    img.onerror = () => resolve('good');
    img.src = src;
  });

const qualityMeta: Record<ImageQuality, { label: string; color: string; icon: React.ElementType }> = {
  good:     { label: 'واضحة',    color: 'text-green-500',  icon: ShieldCheck    },
  warn:     { label: 'مقبولة',   color: 'text-yellow-500', icon: ShieldQuestion },
  bad:      { label: 'ضعيفة',    color: 'text-red-500',    icon: ShieldAlert    },
  checking: { label: 'فحص...',   color: 'text-muted-foreground', icon: Loader2  },
};

const confidenceMeta = {
  high:   { label: 'مؤكد',    className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',  dot: 'bg-green-500'  },
  medium: { label: 'مقبول',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', dot: 'bg-yellow-500' },
  low:    { label: 'راجع',    className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',            dot: 'bg-red-500'    },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DetailedReceiptPage() {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { categories } = useCategories();

  const [viewState, setViewState] = useState<ViewState>('initial');
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [imageToCrop, setImageToCrop] = useState<ImageEntry | null>(null);
  const [analyzedItems, setAnalyzedItems] = useState<EditableItem[]>([]);
  const [storeInfo, setStoreInfo] = useState<{ name: string; date: string | null }>({ name: '', date: null });
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);
  const [receiptType, setReceiptType] = useState<'itemized' | 'simple'>('itemized');
  const [overallConfidence, setOverallConfidence] = useState<'high' | 'medium' | 'low'>('high');
  const [isLoading, setIsLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  // نسبة الاقتصاص — قابلة للتغيير لتناسب الفواتير الطويلة (P3)
  const [cropAspect, setCropAspect] = useState(3 / 4);
  const ASPECT_PRESETS: { label: string; value: number }[] = [
    { label: 'قصيرة', value: 3 / 4 },
    { label: 'طويلة', value: 1 / 2 },
    { label: 'ممتدّة', value: 9 / 21 },
  ];

  const categoryMapForAI = useMemo(() =>
    categories.reduce((acc, cat) => { acc[cat.id] = cat.name; return acc; }, {} as Record<string, string>),
    [categories]
  );

  // computed: sum of items vs receipt total
  const itemsSum = useMemo(() => analyzedItems.reduce((s, i) => s + (i.price || 0), 0), [analyzedItems]);
  const totalMismatch = receiptTotal !== null && Math.abs(itemsSum - receiptTotal) > 1;
  const lowConfidenceCount = analyzedItems.filter(i => i.confidence === 'low').length;
  const hasQualityWarning = images.some(i => i.quality === 'bad');

  // Camera
  useEffect(() => {
    let mounted = true;
    const stop = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
    if (viewState !== 'camera') { stop(); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (!mounted || !videoRef.current) return;
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch(() => {
        if (mounted) {
          toast({ title: 'خطأ في الكاميرا', description: 'تحقق من أذونات الكاميرا.', variant: 'destructive' });
          setViewState('initial');
        }
      });
    return () => { mounted = false; stop(); };
  }, [viewState, toast]);

  const addImage = useCallback(async (src: string) => {
    const id = crypto.randomUUID();
    setImages(prev => [...prev, { id, src, quality: 'checking' }]);
    const quality = await checkImageQuality(src);
    setImages(prev => prev.map(img => img.id === id ? { ...img, quality } : img));
    if (quality === 'bad') {
      toast({
        title: '⚠️ جودة الصورة ضعيفة',
        description: 'الصورة مظلمة أو ضبابية جداً. أعد التصوير في ضوء أفضل للحصول على نتائج دقيقة.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), []);

  const confirmCrop = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const cropped = await getCroppedImg(imageToCrop.src, croppedAreaPixels);
      const quality = await checkImageQuality(cropped);
      setImages(prev => prev.map(img => img.id === imageToCrop.id ? { ...img, src: cropped, quality } : img));
      setImageToCrop(null); setZoom(1); setCrop({ x: 0, y: 0 }); setViewState('initial');
    } catch { toast({ title: 'خطأ في الاقتصاص', variant: 'destructive' }); }
  }, [imageToCrop, croppedAreaPixels, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addImage(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const takePhoto = () => {
    if (!videoRef.current || !photoRef.current) return;
    const v = videoRef.current, c = photoRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    addImage(c.toDataURL('image/jpeg'));
    setViewState('initial');
  };

  const handleAnalyze = async () => {
    if (!user || images.length === 0) {
      toast({ title: 'لا توجد صور', description: 'أضف صورة فاتورة واحدة على الأقل.', variant: 'destructive' });
      return;
    }
    setIsLoading(true); setProcessingStep('uploading'); setError(null); setAnalyzedItems([]);
    try {
      // P1/H4: ضغط الصور قبل الإرسال — يقلّص الحجم بشدة (سرعة + نت + تجنّب التعليق).
      const compressedImages = await Promise.all(images.map(i => compressDataUri(i.src)));

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
      const date = result.transactionDate
        ? format(new Date(result.transactionDate), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');
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
      item.id === id ? { ...item, [field]: field === 'price' ? Number(value) || 0 : value } : item
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
      setImages([]); setAnalyzedItems([]); setStoreInfo({ name: '', date: null }); setReceiptTotal(null);
    },
    onError: () => toast({ title: 'خطأ في الحفظ', variant: 'destructive' }),
  });

  const handleSaveAll = () => {
    if (!user) return;
    const toSave = analyzedItems.map(item => ({
      title: item.name,
      amount: item.price,
      category: item.suggestedCategory,
      date: storeInfo.date ? new Date(storeInfo.date).toISOString() : new Date().toISOString(),
      description: storeInfo.name ? `فاتورة: ${storeInfo.name}` : 'مصروف من فاتورة',
    }));
    if (toSave.some(e => !e.title || e.amount <= 0)) {
      toast({ title: 'بيانات غير مكتملة', description: 'تأكد أن كل عنصر له اسم وسعر صحيح.', variant: 'destructive' });
      return;
    }
    addMultipleExpensesMutation.mutate(toSave);
  };

  const progressValue = processingStep === 'uploading' ? 25 : processingStep === 'analyzing' ? 65 : processingStep === 'extracting' ? 90 : 0;
  const progressLabel =
    processingStep === 'uploading'  ? 'جاري تجهيز الصورة...' :
    processingStep === 'analyzing'  ? 'الذكاء الاصطناعي يقرأ الفاتورة...' :
    processingStep === 'extracting' ? 'جاري استخراج البيانات المالية...' : '';

  // ── Camera view ──────────────────────────────────────────────────────────────
  if (viewState === 'camera') return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <header className="absolute top-0 left-0 right-0 p-4 z-10 bg-gradient-to-b from-black/60 to-transparent">
        <Button variant="ghost" size="icon" onClick={() => setViewState('initial')} className="text-white hover:bg-white/10 hover:text-white">
          <ArrowRight />
        </Button>
      </header>
      <div className="flex-1 relative">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
        <canvas ref={photoRef} className="hidden" />
        {/* Framing guide — إطار طويل يناسب الفواتير الحرارية الطويلة (P2) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[70vw] h-[72vh] border-2 border-white/70 rounded-xl" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
        </div>
        <div className="absolute bottom-48 left-0 right-0 text-center px-6 pointer-events-none">
          <p className="text-white text-sm font-medium opacity-95 drop-shadow">ضع الفاتورة كاملةً داخل الإطار</p>
          <p className="text-white text-xs opacity-70 mt-1 drop-shadow">فاتورة طويلة؟ صوّرها على دفعتين</p>
        </div>
      </div>
      <footer className="absolute bottom-0 left-0 right-0 p-6 flex justify-center z-10 bg-gradient-to-t from-black/60 to-transparent pb-24">
        <button onClick={takePhoto} className="w-20 h-20 rounded-full border-4 border-white bg-white/30 hover:bg-white/50 flex items-center justify-center transition-transform active:scale-95">
          <Camera className="h-8 w-8 text-white" />
        </button>
      </footer>
    </div>
  );

  // ── Crop view ─────────────────────────────────────────────────────────────────
  if (viewState === 'cropping' && imageToCrop) return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="p-4 flex justify-between items-center border-b">
        <h2 className="text-base font-bold flex items-center gap-2"><Crop className="h-5 w-5 text-primary" /> اقتصاص الفاتورة</h2>
        <Button variant="ghost" size="icon" onClick={() => { setImageToCrop(null); setViewState('initial'); }}><X /></Button>
      </header>
      <div className="flex-1 relative bg-muted/50">
        <Cropper image={imageToCrop.src} crop={crop} zoom={zoom} aspect={cropAspect}
          onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} showGrid />
      </div>
      <div className="p-4 border-t space-y-4 pb-24">
        {/* اختيار شكل الاقتصاص حسب طول الفاتورة (P3) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">شكل الفاتورة:</span>
          <div className="flex gap-1.5 flex-1">
            {ASPECT_PRESETS.map(p => (
              <button key={p.label} onClick={() => setCropAspect(p.value)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  Math.abs(cropAspect - p.value) < 0.001 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider value={[zoom]} onValueChange={([v]) => setZoom(v)} min={1} max={3} step={0.1} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={() => { setImageToCrop(null); setViewState('initial'); }}>إلغاء</Button>
          <Button onClick={confirmCrop}><Check className="ml-2 h-4 w-4" /> تأكيد</Button>
        </div>
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
                          onClick={() => { setImageToCrop(img); setViewState('cropping'); }}>
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

          <Button onClick={handleAnalyze} disabled={isLoading || images.length === 0} className="w-full h-12">
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
              {/* Total mismatch warning */}
              {totalMismatch && (
                <Alert className="py-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                  <TriangleAlert className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                    مجموع العناصر ({itemsSum.toLocaleString()}) لا يطابق المجموع الكلي للفاتورة ({receiptTotal?.toLocaleString()}).
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
                        <Input type="number" value={item.price || ''} onChange={e => handleItemChange(item.id, 'price', e.target.value)}
                          placeholder="0" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">الفئة</Label>
                        <Select value={item.suggestedCategory} onValueChange={v => handleItemChange(item.id, 'suggestedCategory', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {categories.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
