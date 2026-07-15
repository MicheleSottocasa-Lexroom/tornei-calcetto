import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShieldAlert } from 'lucide-react';

/** Protegge le rotte riservate agli amministratori. */
export function RequireAdmin() {
  const { user, isAdmin, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Caricamento…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-10 w-10" />}
        title="Accesso riservato"
        description="Questa sezione è disponibile solo agli amministratori."
      />
    );
  }

  return <Outlet />;
}
