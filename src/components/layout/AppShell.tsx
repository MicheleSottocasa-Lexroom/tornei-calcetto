import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { ClaimBanner } from '@/components/ClaimBanner';

/**
 * Guscio applicativo: header in alto, contenuto scrollabile al centro,
 * bottom nav in basso. Mobile-first, larghezza massima contenuta.
 */
export function AppShell() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <ClaimBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
