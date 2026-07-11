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
import { Loader2Icon, AlertTriangle, User, Eye, EyeOff, Lock } from 'lucide-react';
import { recordReferral } from '@/services/firestore';
import { getAdditionalUserInfo } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle as AlertTitleComponent } from '@/components/ui/alert';
import React from 'react';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';
import { trackMetaEvent } from '@/lib/meta-pixel';

const signupSchema = z.object({
  email: z.string().email({ message: 'الرجاء إدخال بريد إلكتروني صالح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
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

export default function SignupPage() {
  const { signUpWithEmailPassword, signInWithGoogle, signInAsGuest, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading]             = useState(false);

  // مستخدم مسجّل أصلاً وصل لصفحة التسجيل؟ حوّله للتطبيق مباشرة —
  // يعالج أيضاً حالات نجاح الدخول بجوجل التي تعود للصفحة دون إكمال التوجيه.
  useEffect(() => {
    if (!authLoading && user) router.replace('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) sessionStorage.setItem('tadbeer-ref', ref);
  }, []);

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading]   = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [webviewHelp, setWebviewHelp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignupFormData>({ resolver: zodResolver(signupSchema) });
  const anyLoading = isLoading || isGoogleLoading || isGuestLoading;

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setUnauthorizedDomain(null);
    let userCredential: any;
    try {
      userCredential = await signUpWithEmailPassword(data.email, data.password);
    } catch (error: any) {
      console.error('signup auth error:', error?.code, error);
      let description = `حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى. (${error?.code ?? 'unknown'})`;
      if (error.code === 'auth/email-already-in-use') description = 'هذا البريد مسجّل بالفعل. جرّب تسجيل الدخول.';
      else if (error.code === 'auth/network-request-failed') description = 'فشل الاتصال بالشبكة. تأكد من اتصالك وحاول مجدداً.';
      else if (error.code === 'auth/invalid-email') description = 'البريد الإلكتروني غير صالح.';
      else if (error.code === 'auth/weak-password' || error.code === 'auth/password-does-not-meet-requirements')
        description = 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.';
      else if (error.code === 'auth/operation-not-allowed')
        description = 'التسجيل بالبريد غير مفعّل حالياً. جرّب التسجيل بـ Google.';
      else if (error.code === 'auth/too-many-requests')
        description = 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.';
      toast({ title: 'خطأ في إنشاء الحساب', description, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    if (userCredential?.user) {
      const refUid = sessionStorage.getItem('tadbeer-ref');
      if (refUid) { recordReferral(refUid, userCredential.user.uid).catch(() => {}); sessionStorage.removeItem('tadbeer-ref'); }
    }

    if (analytics) { try { logEvent(analytics, 'sign_up', { method: 'password' }); } catch {} }
    trackMetaEvent('CompleteRegistration', { content_name: 'password' });
    toast({ title: 'مرحباً بك في تدبير! 🎉', description: 'حسابك جاهز — لنبدأ.' });
    router.push('/');
    setIsLoading(false);
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setUnauthorizedDomain(null);
    // قياس بحت: نعدّ كل نقرة على زر جوجل (المحاولة) لنقارنها بنجاحات sign_up(google)
    // ونكشف نسبة فشل نافذة جوجل المنبثقة (خصوصاً داخل متصفّحات التطبيقات).
    if (analytics) { try { logEvent(analytics, 'signup_google_click'); } catch {} }
    // داخل متصفّح فيسبوك/إنستغرام المدمج قد تفشل نافذة جوجل أو تعلّق بصمت.
    const inApp = typeof navigator !== 'undefined' && /FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent || '');
    let userCredential: any;
    try {
      const googlePromise = signInWithGoogle();
      if (inApp) {
        // نمنع unhandled rejection لو فاز المؤقّت ثم رُفضت النافذة لاحقاً.
        googlePromise.catch(() => {});
        // مؤقّت يلتقط التعليق الصامت (بلا خطأ) داخل المتصفّح المدمج.
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('inapp-timeout')), 8000)
        );
        userCredential = await Promise.race([googlePromise, timeout]);
      } else {
        userCredential = await googlePromise;
      }
    } catch (error: any) {
      console.error('google signup error:', error?.code, error);
      if (error.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(window.location.hostname);
      } else if (inApp) {
        // متصفّح مدمج: الأرجح أن النافذة لا تعمل — إرشاد سياقي بدل رسالة خطأ عامة.
        setWebviewHelp(true);
      } else {
        let description = 'فشل إنشاء الحساب باستخدام Google.';
        if (error.code === 'auth/popup-closed-by-user') description = 'أغلقت نافذة Google قبل اكتمال التسجيل.';
        else if (error.code === 'auth/popup-blocked') description = 'المتصفح منع النافذة المنبثقة. اسمح بها وحاول مجدداً.';
        else if (error.code === 'auth/network-request-failed') description = 'فشل الاتصال بالشبكة.';
        toast({ title: 'خطأ في إنشاء الحساب', description, variant: 'destructive' });
      }
      setIsGoogleLoading(false);
      return;
    }

    const additionalInfo = getAdditionalUserInfo(userCredential);
    const isNewUser = additionalInfo?.isNewUser;
    if (isNewUser && userCredential.user) {
      const refUid = sessionStorage.getItem('tadbeer-ref');
      if (refUid) { recordReferral(refUid, userCredential.user.uid).catch(() => {}); sessionStorage.removeItem('tadbeer-ref'); }
      if (analytics) { try { logEvent(analytics, 'sign_up', { method: 'google' }); } catch {} }
      trackMetaEvent('CompleteRegistration', { content_name: 'google' });
      toast({ title: 'مرحباً بك في تدبير! 🎉', description: 'حسابك جاهز — لنبدأ.' });
    } else {
      toast({ title: 'أهلاً بعودتك!' });
    }
    router.push('/');
    setIsGoogleLoading(false);
  };

  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    try {
      await signInAsGuest();
      if (analytics) { try { logEvent(analytics, 'guest_signin'); } catch {} }
      router.push('/');
    } catch (error: any) {
      toast({ title: 'خطأ في الدخول كزائر', description: error.message, variant: 'destructive' });
    } finally { setIsGuestLoading(false); }
  };

  // أثناء تحديد حالة الدخول أو عند وجود مستخدم (سيُحوَّل فوراً) لا تعرض النموذج —
  // نفس أسلوب صفحة landing، يمنع وميض نموذج التسجيل لمستخدم مسجّل.
  if (authLoading || user) return null;

  return (
    <div className="w-full max-w-sm flex flex-col gap-7">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-4 text-white text-center">
        <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl p-3 shadow-xl ring-2 ring-white/30">
          <img src="/logo.png" alt="تدبير" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">أهلاً بك في تدبير</h1>
          <p className="text-white/85 text-base mt-1.5">نظّم مصاريفك بسهولة، بالعربي</p>
          <div className="inline-block bg-white/15 text-white/90 text-xs px-3 py-1 rounded-full mt-3">
            مجاني تماماً · بدون تثبيت
          </div>
        </div>
      </div>

      {/* ── Card ──────────────────────────────────────────────── */}
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Google — primary CTA */}
        <Button
          variant="outline"
          className="w-full h-12 border-2 border-border hover:border-teal-400 hover:bg-teal-50 transition-all gap-2 text-base font-semibold"
          onClick={handleGoogleSignUp}
          disabled={anyLoading}
        >
          {isGoogleLoading
            ? <Loader2Icon className="h-5 w-5 animate-spin" />
            : <GoogleIcon />}
          التسجيل بـ Google
        </Button>

        {/* إرشاد سياقي: يظهر فقط إن تعذّر دخول جوجل داخل متصفّح مدمج */}
        {webviewHelp && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[13px] leading-relaxed text-amber-900">
            <p className="font-bold">جوجل قد لا يعمل داخل إنستغرام/فيسبوك</p>
            <p className="mt-1">
              افتح تدبير في متصفّحك: اضغط <span className="font-bold">⋮</span> بالأعلى ثم «فتح في المتصفّح» —
              أو ببساطة <span className="font-bold">سجّل بالبريد بالأسفل</span>.
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">أو بالبريد الإلكتروني</span>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">البريد الإلكتروني</Label>
            <Input
              id="email" type="email" placeholder="email@example.com"
              className="h-12 text-base focus:border-teal-400"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">كلمة المرور</Label>
            <div className="relative">
              <Input
                id="password" type={showPassword ? 'text' : 'password'}
                className="h-12 text-base focus:border-teal-400 pl-11"
                {...form.register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full h-12 bg-teal-500 hover:bg-teal-600 text-white font-semibold text-base"
            disabled={anyLoading}
          >
            {isLoading
              ? <><Loader2Icon className="animate-spin ml-2 h-5 w-5" /> جاري الإنشاء...</>
              : 'إنشاء الحساب'}
          </Button>
        </form>

        {unauthorizedDomain && (
          <Alert variant="destructive" className="p-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitleComponent className="text-sm font-semibold">نطاق غير مصرح</AlertTitleComponent>
            <AlertDescription className="text-sm">
              أضف <code className="font-mono bg-white/20 px-1 rounded">{unauthorizedDomain}</code> إلى{' '}
              <a href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/authentication/settings`}
                target="_blank" rel="noopener noreferrer" className="underline font-bold">
                Firebase Authorized Domains
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* سطر الثقة — أسفل النموذج مباشرة، لا معزولاً */}
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          بياناتك آمنة ولا نشاركها مع أحد
        </p>

        {/* خيارات ثانوية — كلٌّ بسطره، مفصولة بوضوح */}
        <div className="border-t border-gray-100 pt-4 space-y-3 text-center text-sm">
          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={anyLoading}
            className="w-full flex items-center justify-center gap-1.5 text-muted-foreground hover:text-teal-600 transition-colors disabled:opacity-50"
          >
            {isGuestLoading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
            الدخول كزائر — جرّب بدون حساب
          </button>
          <p className="text-muted-foreground">
            لديك حساب؟{' '}
            <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700">
              سجّل الدخول
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
}
