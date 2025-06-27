// src/app/(auth)/layout.tsx
import { WalletIcon } from 'lucide-react';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
       <div className="absolute top-8 left-8">
         <Link href="/" className="flex items-center gap-2 text-xl">
            <WalletIcon className="h-7 w-7 text-primary" />
            <span className='font-bold'>مصروفات</span>
          </Link>
       </div>
      {children}
    </div>
  );
}
