"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Loader2Icon, AlertTriangle, User, Mail, LogIn, Mic, ScanText, Wallet } from 'lucide-react';
import { recordReferral } from '@/services/firestore';
import { getAdditionalUserInfo } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle as AlertTitleComponent } from '@/components/ui/alert';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';
import { trackMetaEvent } from '@/lib/meta-pixel';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.591 44 30.033 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

const features = [
  { icon: Mic,      text: 'سجّل مصاريفك بصوتك' },
  { icon: ScanText, text: 'اقرأ الفواتير تلقائياً' },
  { icon: Wallet,   text: 'تتبّع ميزانيتك بذكاء' },
];

export default function SignupPage() {
  const { signInWithGoogle, signInAsGuest, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading]   = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [webviewHelp, setWebviewHelp] = useState(false);

  // مستخدم مسجّل أصلاً وصل لصفحة التسجيل؟ حوّله للتطبيق مباشرة.
  useEffect(() => {
    if (!authLoading && user) router.replace('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) sessionStorage.setItem('tadbeer-ref', ref);
  }, []);

  const anyLoading = isGoogleLoading || isGuestLoading;

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setUnauthorizedDomain(null);
    setWebviewHelp(false);
    if (analytics) { try { logEvent(analytics, 'signup_google_click'); } catch {} }
    // داخل متصفّح فيسبوك/إنستغرام المدمج قد تفشل نافذة جوجل أو تعلّق بصمت.
    const inApp = typeof navigator !== 'undefined' && /FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent || '');
    let userCredential: any;
    try {
      const googlePromise = signInWithGoogle();
      if (inApp) {
        googlePromise.catch(() => {});
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('inapp-timeout')), 8000));
        userCredential = await Promise.race([googlePromise, timeout]);
      } else {
        userCredential = await googlePromise;
      }
    } catch (error: any) {
      console.error('google signup error:', error?.code, error);
      if (error.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(window.location.hostname);
      } else if (inApp) {
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

  if (authLoading || user) return null;

  return (
    <div className="w-full max-w-sm flex flex-col gap-7">

      {/* ── Hero ── */}
      <div className="flex flex-col items-center gap-5 text-white text-center">
        <img
          src="/logo.png"
          alt="تدبير"
          className="w-24 h-24 object-contain"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
        <div>
          <h1 className="text-4xl font-black tracking-tight">تدبير</h1>
          <p className="text-white/85 text-base mt-1.5">مساعدك المالي الذكي</p>
        </div>
        <div className="flex gap-5 mt-1">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-white/80 leading-tight text-center max-w-[68px]">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Options card ── */}
      <div className="bg-card text-card-foreground rounded-[26px] shadow-[0_18px_40px_rgba(4,52,44,0.28)] p-6 space-y-3">

        {/* 1. Google — recommended */}
        <Button
          variant="outline"
          className="w-full h-12 border-2 border-teal-400 bg-teal-50 hover:bg-teal-100 text-teal-800 gap-2 text-base font-semibold transition-colors rounded-[14px]"
          onClick={handleGoogleSignUp}
          disabled={anyLoading}
        >
          {isGoogleLoading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
          التسجيل بـ Google
        </Button>

        {/* إرشاد سياقي: يظهر فقط إن تعذّر دخول جوجل داخل متصفّح مدمج */}
        {webviewHelp && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[13px] leading-relaxed text-amber-900">
            <p className="font-bold">جوجل قد لا يعمل داخل إنستغرام/فيسبوك</p>
            <p className="mt-1">افتح تدبير في متصفّحك (⋮ ← فتح في المتصفّح) — أو أنشئ حساباً بالبريد.</p>
          </div>
        )}

        {/* 2. Login */}
        <Button
          asChild
          variant="outline"
          className="w-full h-12 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 gap-2 text-base font-medium rounded-[14px]"
        >
          <Link href="/login">
            <LogIn className="h-5 w-5 text-teal-600" />
            لديك حساب؟ سجّل الدخول
          </Link>
        </Button>

        {/* 3. Create with email */}
        <Button
          asChild
          variant="outline"
          className="w-full h-12 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 gap-2 text-base font-medium rounded-[14px]"
        >
          <Link href="/signup/email">
            <Mail className="h-5 w-5 text-teal-600" />
            أنشئ حساب بالبريد
          </Link>
        </Button>

        {/* 4. Guest */}
        <Button
          variant="outline"
          className="w-full h-12 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 gap-2 text-base font-medium rounded-[14px]"
          onClick={handleGuestSignIn}
          disabled={anyLoading}
        >
          {isGuestLoading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <User className="h-5 w-5 text-teal-600" />}
          الدخول كزائر — جرّب بدون حساب
        </Button>

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
      </div>
    </div>
  );
}
