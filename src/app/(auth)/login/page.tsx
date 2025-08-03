
"use client";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2Icon, AlertTriangle, User } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle as AlertTitleComponent } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email({ message: 'الرجاء إدخال بريد إلكتروني صالح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" {...props}>
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
        <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.591 44 30.033 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
);

const AppLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2L12 22" />
        <path d="M12 2C8.68629 2 6 4.68629 6 8C6 11.3137 8.68629 14 12 14" />
        <path d="M12 2C15.3137 2 18 4.68629 18 8C18 11.3137 15.3137 14 12 14" />
        <path d="M8 8H16" />
        <path d="M7 11H17" />
    </svg>
);

export default function LoginPage() {
  const { signInWithEmailPassword, signInWithGoogle, signInAsGuest } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setUnauthorizedDomain(null);
    try {
      await signInWithEmailPassword(data.email, data.password);
      toast({ title: 'أهلاً بعودتك!', description: 'تم تسجيل دخولك بنجاح.' });
      router.push('/');
    } catch (error: any) {
        let description = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.';
        if (error.code === 'auth/api-key-not-valid' || error.message.includes('api-key')) {
            description = 'مفتاح API لـ Firebase غير صالح. يرجى التأكد من صحة الإعدادات في ملف .env';
        } else if (error.code === 'auth/invalid-credential') {
            description = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.';
        }
        toast({
            title: 'خطأ في تسجيل الدخول',
            description,
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setUnauthorizedDomain(null);
    try {
      await signInWithGoogle();
      toast({ title: 'أهلاً بعودتك!', description: 'تم تسجيل دخولك بنجاح.' });
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(window.location.hostname);
      } else {
        let description = 'فشل تسجيل الدخول باستخدام Google. يرجى المحاولة مرة أخرى.';
        if (error.code === 'auth/popup-closed-by-user') {
          description = 'تم إلغاء تسجيل الدخول. لقد قمت بإغلاق نافذة Google المنبثقة.';
        } else if (error.code === 'auth/api-key-not-valid' || error.message.includes('api-key')) {
            description = 'مفتاح API لـ Firebase غير صالح. يرجى التأكد من صحة الإعدادات في ملف .env';
        } else if (error.code) {
          description = `حدث خطأ (${error.code}). يرجى المحاولة مرة أخرى.`;
        }
        toast({
          title: 'خطأ في تسجيل الدخول',
          description,
          variant: 'destructive',
        });
      }
    } finally {
        setIsGoogleLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    setUnauthorizedDomain(null);
    try {
      await signInAsGuest();
      toast({ title: 'أهلاً بك كزائر!', description: 'بياناتك ستكون مؤقتة على هذا الجهاز فقط.' });
      router.push('/');
    } catch (error: any) {
       toast({
          title: 'خطأ في الدخول كزائر',
          description: error.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
          variant: 'destructive',
        });
    } finally {
        setIsGuestLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading || isGuestLoading;

  return (
    <div className="flex flex-col items-center gap-6">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary">
            <AppLogo className="h-8 w-8" />
            <span className="text-foreground">تدبير</span>
        </Link>
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle as="h1" className="text-xl">تسجيل الدخول</CardTitle>
                <CardDescription>أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى حسابك</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input id="email" type="email" placeholder="email@example.com" {...form.register('email')} />
                    {form.formState.errors.email && <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input id="password" type="password" {...form.register('password')} />
                    {form.formState.errors.password && <p className="text-sm text-destructive mt-1">{form.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={anyLoading}>
                    {isLoading ? <><Loader2Icon className="animate-spin ml-2" /> جاري الدخول...</> : 'تسجيل الدخول'}
                </Button>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">أو استمر باستخدام</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={handleGoogleSignIn} disabled={anyLoading}>
                      {isGoogleLoading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="h-5 w-5 mr-2" />}
                      Google
                    </Button>
                     <Button variant="secondary" onClick={handleGuestSignIn} disabled={anyLoading}>
                      {isGuestLoading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <User className="h-5 w-5 mr-2" />}
                      الدخول كزائر
                    </Button>
                </div>


                {unauthorizedDomain && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitleComponent>خطأ في الإعدادات</AlertTitleComponent>
                    <AlertDescription>
                      <p className="mb-2">هذا النطاق غير مصرح له. لإصلاح هذا، اذهب إلى <a href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/authentication/settings`} target="_blank" rel="noopener noreferrer" className="font-bold underline">صفحة إعدادات المصادقة في Firebase</a> وأضف النطاق التالي إلى قائمة 'Authorized domains':</p>
                      <code className="block bg-muted text-foreground p-2 rounded-md my-2 text-center font-mono select-all">{unauthorizedDomain}</code>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 text-center text-sm">
                ليس لديك حساب؟{' '}
                <Link href="/signup" className="underline font-semibold text-primary">
                    أنشئ حسابًا جديدًا
                </Link>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
