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
import { Loader2Icon, WalletIcon } from 'lucide-react';
import { addExpense } from '@/services/firestore';

const signupSchema = z.object({
  email: z.string().email({ message: 'الرجاء إدخال بريد إلكتروني صالح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { signUpWithEmailPassword } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const userCredential = await signUpWithEmailPassword(data.email, data.password);
      const newUser = userCredential.user;

      // Add some sample data for a better first-time user experience
      if (newUser) {
        const sampleExpenses = [
          { title: 'قهوة الصباح', amount: 3000, category: 'food', date: new Date().toISOString() },
          { title: 'تعبئة وقود السيارة', amount: 45000, category: 'private_car', date: new Date(Date.now() - 86400000 * 2).toISOString() },
          { title: 'فاتورة انترنت', amount: 30000, category: 'subscriptions', date: new Date(Date.now() - 86400000 * 5).toISOString() },
        ];
        
        await Promise.all(sampleExpenses.map(exp => addExpense(newUser.uid, exp)));
      }

      toast({ title: 'تم إنشاء الحساب بنجاح!', description: 'أهلاً بك. أضفنا لك بعض المصاريف التجريبية لتبدأ.' });
      router.push('/');
    } catch (error: any) {
      const description = error.code === 'auth/email-already-in-use'
        ? 'هذا البريد الإلكتروني مسجل بالفعل.'
        : 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
      toast({
        title: 'خطأ في إنشاء الحساب',
        description,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
        <Link href="/" className="flex items-center gap-2 text-2xl font-display">
            <WalletIcon className="h-8 w-8 text-primary" />
            <span>مصروفات</span>
        </Link>
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <CardTitle className="text-2xl">إنشاء حساب جديد</CardTitle>
            <CardDescription>أدخل بياناتك لإنشاء حساب ومزامنة بياناتك</CardDescription>
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
            <div className="space-y-2">
                <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
                {form.formState.errors.confirmPassword && <p className="text-sm text-destructive mt-1">{form.formState.errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2Icon className="animate-spin ml-2" /> جاري الإنشاء...</> : 'إنشاء الحساب'}
            </Button>
            </form>
            <div className="mt-4 text-center text-sm">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="underline font-semibold text-primary">
                تسجيل الدخول
            </Link>
            </div>
        </CardContent>
        </Card>
    </div>
  );
}
