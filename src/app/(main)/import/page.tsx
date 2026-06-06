// src/app/(main)/import/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, MessageSquareText, Sparkles, CreditCard, Info, ClipboardPaste } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/use-categories';
import { parseBankSmsAction } from '@/app/actions';
import type { Expense } from '@/types';
import ManualExpenseForm from '@/components/expenses/manual-expense-form';

function ImportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { categories } = useCategories();

  const [smsText, setSmsText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Partial<Expense> | null>(null);
  const [detectedCard, setDetectedCard] = useState<string | null>(null);
  const [notExpenseWarning, setNotExpenseWarning] = useState<string | null>(null);

  const categoryMapForAI = useMemo(() => {
    return categories.reduce((acc, cat) => {
      acc[cat.id] = cat.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  // Pull shared text from the Web Share Target query params (?text= &title= &url=)
  const sharedText = useMemo(() => {
    const parts = [
      searchParams.get('title'),
      searchParams.get('text'),
      searchParams.get('url'),
    ].filter(Boolean);
    return parts.join('\n').trim();
  }, [searchParams]);

  const handleParse = async (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) {
      toast({
        title: 'لا يوجد نص',
        description: 'الصق رسالة البنك أولاً.',
        variant: 'destructive',
      });
      return;
    }

    setIsParsing(true);
    setParsedData(null);
    setNotExpenseWarning(null);
    setDetectedCard(null);

    try {
      const response = await parseBankSmsAction({
        smsText: cleaned,
        categories: categoryMapForAI,
      });

      if (!response.ok) throw new Error(response.error);

      const data = response.data;

      if (!data.isExpense) {
        setNotExpenseWarning(
          'يبدو أن هذه الرسالة ليست عملية خصم (قد تكون إيداعاً، رمز تحقق، أو إعلاناً). راجع النص أو الصق رسالة خصم.'
        );
        return;
      }

      setDetectedCard(data.cardOrBank || null);
      setParsedData({
        title: data.description,
        amount: data.amount || undefined,
        category: data.category,
        date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
      });
    } catch (err) {
      console.error('Bank SMS parse error:', err);
      toast({
        title: 'تعذّر تحليل الرسالة',
        description: 'حاول مرة أخرى أو تأكد من نص الرسالة.',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Auto-parse when arriving via the share sheet with text already present.
  useEffect(() => {
    if (sharedText && categories.length > 0) {
      setSmsText(sharedText);
      handleParse(sharedText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedText, categories.length]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSmsText(text);
        handleParse(text);
      } else {
        toast({ title: 'الحافظة فارغة', description: 'انسخ رسالة البنك أولاً.' });
      }
    } catch {
      toast({
        title: 'تعذّر القراءة من الحافظة',
        description: 'الصق الرسالة يدوياً في الحقل.',
        variant: 'destructive',
      });
    }
  };

  // After the expense is saved, ManualExpenseForm calls setOpen(false) → go home.
  const handleAfterSave = (open: boolean) => {
    if (!open) {
      router.push('/');
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-base font-bold flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" />
          إدخال من رسالة البنك
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          الصق إشعار الخصم من بطاقتك ودع الذكاء الاصطناعي يحوّله إلى مصروف جاهز.
        </p>
      </div>

      {!parsedData && (
        <>
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-xs font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                رسالة البنك
              </CardTitle>
              <CardDescription className="text-xs">
                انسخ نص رسالة SMS أو الإشعار من تطبيق المصرف الأهلي / كي كارد / تبادل والصقه هنا.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder="مثال: تم خصم 25,000 د.ع من بطاقتك في سوبرماركت السلام بتاريخ 2026-06-06"
                className="min-h-[120px] text-xs"
                dir="auto"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleParse(smsText)}
                  disabled={isParsing}
                  className="flex-1 h-10 text-sm"
                >
                  {isParsing ? (
                    <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري التحليل...</>
                  ) : (
                    <><Sparkles className="ml-2 h-4 w-4" /> حلّل الرسالة</>
                  )}
                </Button>
                <Button
                  onClick={handlePasteFromClipboard}
                  disabled={isParsing}
                  variant="outline"
                  className="h-10 px-3"
                  title="لصق من الحافظة"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {notExpenseWarning && (
            <Alert variant="destructive" className="p-3">
              <Info className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">ليست عملية خصم</AlertTitle>
              <AlertDescription className="text-xs">{notExpenseWarning}</AlertDescription>
            </Alert>
          )}

          <Alert className="p-3 bg-muted/40">
            <CreditCard className="h-4 w-4" />
            <AlertTitle className="text-xs font-semibold">نصيحة: إدخال بنقرة واحدة</AlertTitle>
            <AlertDescription className="text-[11px] leading-relaxed">
              بعد تثبيت تدبير على شاشتك الرئيسية، اضغط مطوّلاً على إشعار البنك ثم
              «مشاركة» واختر «تدبير» — ستفتح هذه الشاشة وتُحلّل الرسالة تلقائياً.
            </AlertDescription>
          </Alert>
        </>
      )}

      {parsedData && (
        <Card className="animate-in fade-in duration-300">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              راجع المصروف واحفظه
            </CardTitle>
            {detectedCard && (
              <CardDescription className="text-xs flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                البطاقة المكتشفة: <span className="font-semibold text-foreground">{detectedCard}</span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <ManualExpenseForm
              key={JSON.stringify(parsedData)}
              setOpen={handleAfterSave}
              initialData={parsedData}
            />
            <Button
              variant="ghost"
              className="w-full mt-2 text-xs text-muted-foreground"
              onClick={() => {
                setParsedData(null);
                setDetectedCard(null);
              }}
            >
              تحليل رسالة أخرى
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }
    >
      <ImportContent />
    </Suspense>
  );
}
