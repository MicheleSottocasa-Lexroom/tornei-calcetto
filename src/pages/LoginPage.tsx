import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Caricamento…" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // Il redirect OAuth avviene lato Supabase/Google.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accesso non riuscito. Riprova.');
      setSigningIn(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm space-y-6 text-center" padded>
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Tornei Calcetto</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Accedi con il tuo account aziendale
            </p>
          </div>
        </div>

        <Button
          onClick={handleSignIn}
          loading={signingIn}
          fullWidth
          size="lg"
        >
          Accedi con Google
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <p className="text-xs text-muted-foreground">
          Accedi con il tuo account Google.
        </p>
      </Card>
    </div>
  );
}
