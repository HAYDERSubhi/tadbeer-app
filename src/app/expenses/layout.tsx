import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
       <div className="flex items-center mb-4">
         <Button asChild variant="ghost" size="icon" className='ml-2'>
            <Link href="/" aria-label='العودة للصفحة الرئيسية'>
                <ArrowLeft className="h-5 w-5" />
            </Link>
         </Button>
        <h1 className="text-2xl font-bold">كل المصاريف</h1>
      </div>
      {children}
      <PageNavigation />
    </AppShell>
  );
}
