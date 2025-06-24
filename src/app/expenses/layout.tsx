
import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      {children}
      <PageNavigation />
    </AppShell>
  );
}
