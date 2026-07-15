import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { Spinner } from '@/components/ui/Spinner';

/** Protegge le rotte che richiedono un utente autenticato. */
export function RequireAuth() {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" label="Caricamento…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
