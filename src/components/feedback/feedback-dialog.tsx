// src/components/feedback/feedback-dialog.tsx
// استمارة «شاركنا رأيك» — مشتركة بين شاشة الإعدادات وشاشة الفواتير.
// أُخرجت من settings/page.tsx (2026-09-05) لتُستدعى عند فشل تحليل فاتورة
// دون الانتقال إلى الإعدادات — فالانتقال يُضيع الصور الملتقطة في الحالة.
"use client";

import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Lightbulb, Bug, Heart, MessageSquare, ChevronRight, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ⚠️ الحدّان يطابقان قاعدة أمان Firestore (2026-09-05). بدون حدّ في الشاشة
//    كانت القاعدة ترفض النصّ الأطول فيرى المستخدم «خطأ» ويضيع ما كتبه —
//    نفس عائلة العطل الذي أُصلح في نفس اليوم. يُمنع هنا قبل أن يُرفض هناك.
const FEEDBACK_MAX_SUBJECT = 200;
const FEEDBACK_MAX_DETAILS = 5000;

const feedbackSchema = z.object({
  type: z.enum(['suggestion', 'bug', 'compliment', 'other']),
  subject: z.string().max(FEEDBACK_MAX_SUBJECT, { message: `الموضوع أطول من ${FEEDBACK_MAX_SUBJECT} حرفاً` }),
  details: z.string().min(1, { message: 'التفاصيل مطلوبة' })
    .max(FEEDBACK_MAX_DETAILS, { message: `التفاصيل أطول من ${FEEDBACK_MAX_DETAILS} حرفاً` }),
});
type FeedbackFormData = z.infer<typeof feedbackSchema>;

// --- Feedback Dialog Component ---
const FEEDBACK_TYPES = [
  { value: 'suggestion', label: 'اقتراح ميزة', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  { value: 'bug',        label: 'مشكلة تقنية', icon: Bug,       color: 'text-red-500',   bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
  { value: 'compliment', label: 'إطراء',        icon: Heart,     color: 'text-pink-500',  bg: 'bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800' },
  { value: 'other',      label: 'أخرى',         icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
] as const;

export const FeedbackDialog = ({ isOpen, setIsOpen, initialType = 'suggestion' }: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  /** يُفتح على هذا النوع — «مشكلة تقنية» عند الاستدعاء بعد عطل. */
  initialType?: 'suggestion' | 'bug' | 'compliment' | 'other';
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sent, setSent] = useState(false);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: initialType, subject: '', details: '' },
  });

  const selectedType = form.watch('type');
  const detailsLength = (form.watch('details') || '').length;

  const feedbackMutation = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      if (!user) throw new Error('يرجى تسجيل الدخول');
      const subject = data.subject.trim() || 'بدون موضوع';
      const details = data.details.trim();
      const { addFeedback } = await import('@/services/firestore');
      // الحفظ هو النجاح. ما بعده إشعار لصاحب التطبيق لا يخصّ المستخدم.
      await addFeedback(user.uid, { type: data.type, subject, details });

      // ⚠️ كان فشل الإشعار يُرمى فيرى المستخدم «خطأ» رغم أن ملاحظته حُفظت
      //    فعلاً — ووقع ذلك: ستّ ملاحظات في قاعدة البيانات ورسالتان فقط
      //    وصلتا (2026-09-05). أربعة أشخاص ظنّوا أن كلامهم ضاع وهو محفوظ.
      //    الآن يُبتلع فشل الإشعار: الملاحظة وصلت، والباقي شأن الخادم.
      try {
        const token = await user.getIdToken();
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type: data.type, subject, details }),
        });
      } catch { /* الملاحظة محفوظة — لا شأن للمستخدم بالإشعار */ }
    },
    onSuccess: () => setSent(true),
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => { setSent(false); form.reset({ type: initialType, subject: '', details: '' }); }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
        <button
          type="button"
          onClick={handleClose}
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">شاركنا رأيك</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {sent ? (
          <div className="flex flex-col items-center justify-center gap-5 py-20 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Send className="h-9 w-9 text-primary" />
            </div>
            <div className="space-y-3 max-w-sm">
              <p className="font-bold text-xl">وصلت رسالتك 🌿</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                رسالتك وصلت إلى فريق تدبير، وستُراجَع بكل اهتمام ودراسة.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/60 rounded-lg px-4 py-3">
                {/* ⚠️ كانت «قد لا يصلك ردّ مباشر» — صارت كاذبة منذ ربط reply-to
                    (2026-09-05): الردّ صار ممكناً بضغطة. وتسمية العنوان ضرورية
                    كي لا يُقرأ ردّ تدبير بريداً مجهولاً فيذهب للمهملات. */}
                كل ملاحظة تُقرأ ولها أثر في تطوير تدبير. وإن احتاجت ردّاً، يصلك من <bdi className="font-semibold">hello@tadbeer.app</bdi> — أضِفه لجهات اتصالك كي لا يقع في المهملات. صوتك مسموع 💚
              </p>
            </div>
            <Button onClick={handleClose} className="mt-2 px-8">إغلاق</Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit((d) => feedbackMutation.mutate(d))} className="p-4 space-y-5">
            <p className="text-sm text-muted-foreground">ملاحظتك تصلنا مباشرة وتساعدنا على تحسين تدبير</p>

            {/* Type selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">نوع الملاحظة</Label>
              <div className="grid grid-cols-2 gap-2.5">
                {FEEDBACK_TYPES.map(({ value, label, icon: Icon, color, bg }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => form.setValue('type', value)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border p-3.5 text-sm font-medium transition-all',
                      selectedType === value ? bg : 'border-border bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', selectedType === value ? color : '')} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">الموضوع <span className="text-muted-foreground font-normal">(اختياري)</span></Label>
              <Input {...form.register('subject')} maxLength={FEEDBACK_MAX_SUBJECT} placeholder="عنوان مختصر..." className="h-11" />
            </div>

            {/* Details */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">التفاصيل <span className="text-destructive">*</span></Label>
              <Textarea
                {...form.register('details')}
                maxLength={FEEDBACK_MAX_DETAILS}
                placeholder="اشرح فكرتك أو المشكلة بأكبر قدر من التفاصيل..."
                className="min-h-[140px] resize-none"
              />
              {/* عدّاد يظهر عند الاقتراب من الحدّ فقط — لا يزحم الشاشة على
                  من يكتب سطرين، ويحذّر من يكتب شكوى مطوّلة قبل أن يُقصّ نصّه */}
              {detailsLength > FEEDBACK_MAX_DETAILS - 1000 && (
                <p className="text-[11px] text-muted-foreground text-end tabular-nums">
                  <bdi>{detailsLength} / {FEEDBACK_MAX_DETAILS}</bdi>
                </p>
              )}
              {form.formState.errors.details && (
                <p className="text-xs text-destructive">{form.formState.errors.details.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button type="submit" disabled={feedbackMutation.isPending} className="w-full h-12 text-base gap-2">
              {feedbackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إرسال
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
