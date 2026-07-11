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
import { Loader2Icon, AlertTriangle, Mic, ScanText, Wallet, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle as AlertTitleComponent } from '@/components/ui/alert';
import React from 'react';

const loginSchema = z.object({
  email: z.string().email({ message: 'الرجاء إدخال بريد إلكتروني صحيح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
});
type LoginFormData = z.infer<typeof loginSchema>;

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

export default function LoginPage() {
  const { signInWithEmailPassword, signInWithGoogle, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // مستخدم مسجّل أصلاً وصل لصفحة الدخول؟ حوّله للتطبيق مباشرة —
  // يعالج أيضاً حالات نجاح الدخول بجوجل التي تعود للصفحة دون إكمال التوجيه.
  useEffect(() => {
    if (!authLoading && user) router.replace('/');
  }, [user, authLoading, router]);
  const { toast } = useToast();
  const [isLoading, setIsLoading]             = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });
  const anyLoading = isLoading || isGoogleLoading;

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setUnauthorizedDomain(null);
    try {
      await signInWithEmailPassword(data.email, data.password);
      toast({ title: 'أهلاً بعودتك!' });
      router.push('/');
    } catch (error: any) {
      let description = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
      if (['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(error.code))
        description = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      else if (error.code === 'auth/network-request-failed')
        description = 'فشل الاتصال بالشبكة. تحقق من اتصالك بالإنترنت.';
      toast({ title: 'خطأ في تسجيل الدخول', description, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setUnauthorizedDomain(null);
    try {
      await signInWithGoogle();
      toast({ title: 'أهلاً بعودتك!' });
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(window.location.hostname);
      } else {
        let description = 'فشل تسجيل الدخول باستخدام Google.';
        if (error.code === 'auth/popup-closed-by-user') description = 'أغلقت نافذة Google قبل اكتمال الدخول.';
        toast({ title: 'خطأ في تسجيل الدخول', description, variant: 'destructive' });
      }
    } finally { setIsGoogleLoading(false); }
  };

  // أثناء تحديد حالة الدخول أو عند وجود مستخدم (سيُحوَّل فوراً) لا تعرض النموذج —
  // نفس أسلوب صفحة landing، يمنع وميض نموذج الدخول لمستخدم مسجّل.
  if (authLoading || user) return null;

  return (
    <div className="w-full max-w-sm flex flex-col gap-7">

      {/* ── Hero ──────────────────────────────────────────────── */}
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

      {/* ── Card ──────────────────────────────────────────────── */}
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-bold">تسجيل الدخول</h2>
          <p className="text-sm text-muted-foreground mt-1">أهلاً بعودتك!</p>
        </div>

        {/* Google — primary CTA */}
        <Button
          variant="outline"
          className="w-full h-12 border-2 border-border hover:border-teal-400 hover:bg-teal-50 transition-all gap-2 text-base font-semibold"
          onClick={handleGoogleSignIn}
          disabled={anyLoading}
        >
          {isGoogleLoading
            ? <Loader2Icon className="h-5 w-5 animate-spin" />
            : <GoogleIcon />}
          الدخول بـ Google
        </Button>

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
            {isLoading ? <><Loader2Icon className="animate-spin ml-2 h-5 w-5" /> جاري الدخول...</> : 'دخول'}
          </Button>
        </form>

        {unauthorizedDomain && (
          <Alert variant="destructive" className="p-3 text-sm">
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

        {/* Footer link — مخرج لمن لا يملك حساباً */}
        <div className="pt-1 text-center text-sm text-muted-foreground">
          ليس لديك حساب؟{' '}
          <Link href="/signup" className="font-semibold text-teal-600 hover:text-teal-700">
            أنشئ حساب
          </Link>
        </div>
      </div>

    </div>
  );
}
