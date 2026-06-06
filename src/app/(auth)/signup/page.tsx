"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Loader2Icon, AlertTriangle, User, CheckCircle2 } from 'lucide-react';
import { addExpense, recordReferral } from '@/services/firestore';
import { getAdditionalUserInfo } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle as AlertTitleComponent } from '@/components/ui/alert';
import React from 'react';

const signupSchema = z.object({
  email: z.string().email({ message: 'الرجاء إدخال بريد إلكتروني صالح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});
type SignupFormData = z.infer<typeof signupSchema>;

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.591 44 30.033 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

const perks = [
  'مزامنة بياناتك على كل أجهزتك',
  'نسخ احتياطي تلقائي آمن',
  'إحصائيات وتقارير ذكية',
];

const sampleExpenses = [
  { title: 'قهوة الصباح',         amount: 3000,  category: 'food',          date: new Date().toISOString() },
  { title: 'تعبئة وقود السيارة',  amount: 45000, category: 'private_car',   date: new Date(Date.now() - 86400000 * 2).toISOString() },
  { title: 'فاتورة انترنت',       amount: 30000, category: 'subscriptions', date: new Date(Date.now() - 86400000 * 5).toISOString() },
];

export default function SignupPage() {
  const { signUpWithEmailPassword, signInWithGoogle, signInAsGuest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading]             = useState(false);

  // Persist referral code from URL into sessionStorage
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) sessionStorage.setItem('tadbeer-ref', ref);
  }, [searchParams]);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading]   = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);

  const form = useForm<SignupFormData>({ resolver: zodResolver(signupSchema) });
  const anyLoading = isLoading || isGoogleLoading || isGuestLoading;

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setUnauthorizedDomain(null);
    try {
      const userCredential = await signUpWithEmailPassword(data.email, data.password);
      if (userCredential.user) {
        await Promise.all(sampleExpenses.map(exp => addExpense(userCredential.user.uid, exp)));
        // Record referral if came via invite link
        const refUid = sessionStorage.getItem('tadbeer-ref');
        if (refUid) { recordReferral(refUid, userCredential.user.uid).catch(() => {}); sessionStorage.removeItem('tadbeer-ref'); }
      }
      toast({ title: 'مرحباً بك في تدبير! 🎉', description: 'أضفنا لك مصاريف تجريبية للبداية.' });
      router.push('/');
    } catch (error: any) {
      let description = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
      if (error.code === 'auth/email-already-in-use') description = 'هذا البريد مسجّل بالفعل. جرّب تسجيل الدخول.';
      else if (error.code === 'auth/network-request-failed') description = 'فشل الاتصال بالشبكة.';
      toast({ title: 'خطأ في إنشاء الحساب', description, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setUnauthorizedDomain(null);
    try {
      const userCredential = await signInWithGoogle();
      const additionalInfo = getAdditionalUserInfo(userCredential);
      if (additionalInfo?.isNewUser && userCredential.user) {
        await Promise.all(sampleExpenses.map(exp => addExpense(userCredential.user.uid, exp)));
        const refUid = sessionStorage.getItem('tadbeer-ref');
        if (refUid) { recordReferral(refUid, userCredential.user.uid).catch(() => {}); sessionStorage.removeItem('tadbeer-ref'); }
        toast({ title: 'مرحباً بك في تدبير! 🎉', description: 'أضفنا لك مصاريف تجريبية للبداية.' });
      } else {
        toast({ title: 'أهلاً بعودتك!' });
      }
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(window.location.hostname);
      } else {
        let description = 'فشل إنشاء الحساب باستخدام Google.';
        if (error.code === 'auth/popup-closed-by-user') description = 'أغلقت نافذة Google قبل اكتمال التسجيل.';
        toast({ title: 'خطأ في إنشاء الحساب', description, variant: 'destructive' });
      }
    } finally { setIsGoogleLoading(false); }
  };

  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    try {
      await signInAsGuest();
      toast({ title: 'أهلاً بك كزائر!', description: 'بياناتك مؤقتة على هذا الجهاز فقط.' });
      router.push('/');
    } catch (error: any) {
      toast({ title: 'خطأ في الدخول كزائر', description: error.message, variant: 'destructive' });
    } finally { setIsGuestLoading(false); }
  };

  return (
    <div className="w-full max-w-sm flex flex-col gap-5">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 text-white text-center">
        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl p-2.5 shadow-xl ring-2 ring-white/30">
          <img src="/logo.png" alt="تدبير" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">انضم إلى تدبير</h1>
          <p className="text-white/75 text-xs mt-1">سجّل مجاناً وابدأ إدارة مصاريفك الآن</p>
        </div>
        {/* Perks */}
        <div className="flex flex-col gap-1.5 w-full max-w-[260px]">
          {perks.map(perk => (
            <div key={perk} className="flex items-center gap-2 text-white/85 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-white/60 shrink-0" />
              {perk}
            </div>
          ))}
        </div>
      </div>

      {/* ── Card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">إنشاء حساب جديد</h2>
          <p className="text-xs text-gray-500 mt-0.5">مجاني تماماً</p>
        </div>

        {/* Google — primary CTA */}
        <Button
          variant="outline"
          className="w-full h-11 border-2 border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all gap-2 text-sm font-semibold"
          onClick={handleGoogleSignUp}
          disabled={anyLoading}
        >
          {isGoogleLoading
            ? <Loader2Icon className="h-4 w-4 animate-spin" />
            : <GoogleIcon />}
          التسجيل بـ Google (الأسرع)
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-[11px] text-gray-400">أو بالبريد الإلكتروني</span>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-medium text-gray-700">البريد الإلكتروني</Label>
            <Input
              id="email" type="email" placeholder="email@example.com"
              className="h-10 text-sm border-gray-200 focus:border-teal-400"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs font-medium text-gray-700">كلمة المرور</Label>
            <Input
              id="password" type="password"
              className="h-10 text-sm border-gray-200 focus:border-teal-400"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-700">تأكيد كلمة المرور</Label>
            <Input
              id="confirmPassword" type="password"
              className="h-10 text-sm border-gray-200 focus:border-teal-400"
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-red-500">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full h-11 bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm"
            disabled={anyLoading}
          >
            {isLoading
              ? <><Loader2Icon className="animate-spin ml-2 h-4 w-4" /> جاري الإنشاء...</>
              : 'إنشاء الحساب'}
          </Button>
        </form>

        {unauthorizedDomain && (
          <Alert variant="destructive" className="p-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitleComponent className="text-xs font-semibold">نطاق غير مصرح</AlertTitleComponent>
            <AlertDescription className="text-xs">
              أضف <code className="font-mono bg-white/20 px-1 rounded">{unauthorizedDomain}</code> إلى{' '}
              <a href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/authentication/settings`}
                target="_blank" rel="noopener noreferrer" className="underline font-bold">
                Firebase Authorized Domains
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* Footer links */}
        <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={anyLoading}
            className="flex items-center gap-1 hover:text-teal-600 transition-colors disabled:opacity-50"
          >
            {isGuestLoading ? <Loader2Icon className="h-3 w-3 animate-spin" /> : <User className="h-3 w-3" />}
            دخول كزائر
          </button>
          <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700">
            لديك حساب؟ ادخل ←
          </Link>
        </div>
      </div>

    </div>
  );
}
