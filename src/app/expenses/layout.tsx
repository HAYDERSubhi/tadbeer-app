
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-xl font-bold">كل المصاريف</h1>
          <Link href="/" passHref legacyBehavior>
            <Button as="a" variant="ghost" size="icon">
              <ChevronRight className="h-6 w-6" />
              <span className="sr-only">العودة للرئيسية</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-6">
        {children}
      </main>
    </div>
  );
}
