import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

/**
 * Guscio applicativo: header in alto, contenuto scrollabile al centro,
 * bottom nav in basso. Mobile-first, larghezza massima contenuta.
 */
export function AppShell() {
  return (
    <div className="flex min-h-full flex-col bg-surface-900">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
