"use client";

// تسجيل دخل (يومي أو غير ثابت) من شاشة الإضافة — ويُستعمل نفسه للتعديل (خاصية `income`) من صفّ الدخل
// في الرئيسية وشاشة المصاريف. في وضع التعديل: زرّ الحفظ ضمن المحتوى لا مثبَّتاً أسفل الشاشة (لأنه داخل نافذة).
//
// يُحفظ سجلاً من نوع one-time في مجموعة incomes نفسها التي تستعملها الإعدادات — ولا يلمس
// `profile.monthlyIncome` (= مجموع الدخل المتكرر). فالأدوات والمخطط والمدرب والمستشار تبقى
// على الرقم الشهري كما هو، والبطاقة في الرئيسية تعرض «المستلَم فعلاً» بجانبه لا مجموعاً معه.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { arIQ } from '@/lib/arabic-date';
import { cn } from '@/lib/utils';
import { normalizeDigits } from '@/lib/normalize-digits';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { addIncome, updateIncome } from '@/services/firestore';
import type { Income } from '@/types';
import { track } from '@/lib/track';

const withCommas = (n: number) => (n > 0 ? new Intl.NumberFormat('en-US').format(n) : '');

export function IncomeEntryForm({ income, onDone }: { income?: Income; onDone?: () => void } = {}) {
  const isEdit = !!income;
  const { user } = useAuth();
  const { householdId } = useAppData();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // العنوان الافتراضي «دخل» يُعرض فارغاً (يعود افتراضياً عند الحفظ) كي لا يضطر المستخدم لمسحه.
  const [title, setTitle] = useState(income && income.title !== 'دخل' ? income.title : '');
  const [amount, setAmount] = useState(income?.amount ?? 0);
  const [date, setDate] = useState<Date>(() => {
    const d = income?.date ? new Date(income.date) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const [amountError, setAmountError] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || saving) return;
    if (!(amount > 0)) {
      setAmountError(true);
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim() || 'دخل',
      amount,
      type: 'one-time' as const,
      date: date.toISOString(),
    };
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['incomes', user.uid] });
    const finish = () => {
      if (isEdit) {
        toast({ title: 'تم تحديث الدخل' });
        onDone?.();
        return;
      }
      toast({ title: 'تم حفظ الدخل', description: 'ستجده في «آخر الحركات» بالرئيسية.' });
      track('income_added');
      router.push('/');
    };
    const write = (): Promise<unknown> => income
      ? updateIncome(user.uid, income.id, { title: payload.title, amount: payload.amount, date: payload.date }, householdId, income.scope)
      : addIncome(user.uid, payload, householdId);

    // بلا إنترنت: وعد Firestore لا يُحسم إلا بتأكيد الخادم، فالانتظار يُبقي الزرّ يدور بلا نهاية
    // ويظنّ المستخدم أن الحفظ فشل ويعيده (فيصير دخلان). الكتابة تُصفّ محلياً وتُرفع عند عودة الشبكة،
    // فنمضي فوراً. (نفس المنطق الموثَّق في `onMutate` لشاشة المصروف.)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      write().then(refresh).catch(() => {});
      finish();
      return;
    }

    try {
      await write();
      refresh();
      finish();
    } catch {
      toast({
        title: 'خطأ في الحفظ',
        description: 'تعذّر حفظ الدخل. تحقّق من الاتصال وحاول مرة أخرى.',
        variant: 'destructive',
      });
      setSaving(false);
    }
  };

  return (
    <>
      <div className={cn('flex-1 space-y-3 p-4 overflow-y-auto', !isEdit && 'pb-40')}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مصدر الدخل (اختياري)"
          className="h-11"
          maxLength={60}
        />

        <div>
          <div className="relative">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="المبلغ"
              className="h-14 text-xl font-bold ps-14 text-start"
              value={withCommas(amount)}
              onChange={(e) => {
                const parsed = normalizeDigits(e.target.value).replace(/,/g, '');
                if (parsed === '' || !isNaN(Number(parsed))) {
                  setAmount(parsed === '' ? 0 : Number(parsed));
                  setAmountError(false);
                }
              }}
            />
            <span className="absolute end-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none select-none">
              د.ع
            </span>
          </div>
          {amountError && <p className="text-sm text-destructive mt-1">المبلغ يجب أن يكون أكبر من صفر</p>}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full justify-start h-11 font-normal gap-2')}>
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">التاريخ:</span>
              <bdi className="font-semibold">{format(date, 'dd/MM/yyyy')}</bdi>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
              dir="rtl"
              locale={arIQ}
              disabled={(d) => d > new Date() || d < new Date('1900-01-01')}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className={isEdit ? 'px-4 pb-4' : 'fixed bottom-16 inset-x-0 px-4 py-3 bg-background/80 backdrop-blur-sm border-t border-border'}>
        <Button onClick={handleSave} className="w-full h-12 text-base gap-2" disabled={saving}>
          {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
          <span>{isEdit ? 'حفظ التعديل' : 'حفظ الدخل'}</span>
        </Button>
      </div>
    </>
  );
}
