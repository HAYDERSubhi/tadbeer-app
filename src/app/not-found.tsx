// src/app/not-found.tsx
// صفحة 404 عربية بهوية تدبير — تظهر لأي رابط غير موجود بدل صفحة Next الافتراضية الإنكليزية
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        <Image src="/logo.png" alt="شعار تدبير" width={64} height={64} />
      </div>

      <p className="text-7xl font-black text-primary/80" dir="ltr">404</p>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
        <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
          يبدو أن الرابط الذي وصلت إليه غير صحيح أو أن الصفحة لم تعد متوفرة.
        </p>
      </div>

      <Button asChild className="h-12 px-8">
        <Link href="/">
          <Home className="ml-2 h-5 w-5" />
          العودة إلى تدبير
        </Link>
      </Button>
    </main>
  );
}
