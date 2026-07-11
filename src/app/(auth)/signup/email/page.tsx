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
import { Loader2Icon, Eye, EyeOff, ChevronRight, Lock } from 'lucide-react';
import { recordReferral } from '@/services/firestore';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';
import { trackMetaEvent } from '@/lib/meta-pixel';

const emailSchema = z.object({
  email: z.string().email({ message: 'الرجاء إدخال بريد إلكتروني صالح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
});
type EmailFormData = z.infer<typeof emailSchema>;

export default function EmailSignupPage() {
  const { signUpWithEmailPassword, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) sessionStorage.setItem('tadbeer-ref', ref);
  }, []);

  const form = useForm<EmailFormData>({ resolver: zodResolver(emailSchema) });

  const onSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
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

  if (authLoading || user) return null;

  return (
    <div className="w-full max-w-sm flex flex-col gap-6">

      {/* Hero */}
      <div className="flex flex-col items-center gap-3 text-white text-center">
        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl p-2.5 shadow-xl ring-2 ring-white/30">
          <img src="/logo.png" alt="تدبير" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">أنشئ حسابك</h1>
      </div>

      {/* Card */}
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl p-6 space-y-5">
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
            disabled={isLoading}
          >
            {isLoading
              ? <><Loader2Icon className="animate-spin ml-2 h-5 w-5" /> جاري الإنشاء...</>
              : 'إنشاء الحساب'}
          </Button>
        </form>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          بياناتك آمنة ولا نشاركها مع أحد
        </p>

        <div className="border-t border-gray-100 pt-4 text-center">
          <Link href="/signup" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-teal-600 transition-colors">
            <ChevronRight className="h-4 w-4" />
            رجوع لخيارات التسجيل
          </Link>
        </div>
      </div>
    </div>
  );
}
