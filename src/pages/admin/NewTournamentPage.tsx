import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TournamentForm } from '@/features/admin/TournamentForm';
import { useCreateTournament } from '@/features/admin/hooks';

export default function NewTournamentPage() {
  const navigate = useNavigate();
  const createTournament = useCreateTournament();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard admin
      </Link>

      <h1 className="text-xl font-bold text-foreground">Nuovo torneo</h1>

      {error && (
        <Card className="text-sm text-destructive">Errore nella creazione: {error}</Card>
      )}

      <TournamentForm
        submitLabel="Crea torneo"
        loading={createTournament.isPending}
        onSubmit={(input) => {
          setError(null);
          createTournament.mutate(input, {
            onSuccess: (t) => navigate(`/admin/tornei/${t.id}/calendario`),
            onError: (e) => setError(e.message),
          });
        }}
      />
    </section>
  );
}
