
// Re-export the main layout to apply it to this route
import MainLayout from '../(main)/layout';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
