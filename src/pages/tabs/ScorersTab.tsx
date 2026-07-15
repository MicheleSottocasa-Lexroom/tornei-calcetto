import { useParams } from 'react-router-dom';
import { AlertTriangle, Target } from 'lucide-react';
import { useTopScorers } from '@/hooks/queries';
import { EmptyState, Spinner } from '@/components/ui';
import { ScorersTable } from '@/features/tournaments/ScorersTable';

export default function ScorersTab() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useTopScorers(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Caricamento marcatori…" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10 text-red-400" />}
        title="Errore di caricamento"
        description="Impossibile caricare i marcatori. Riprova più tardi."
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Target className="h-10 w-10" />}
        title="Nessun marcatore"
        description="I marcatori compariranno dopo i primi gol."
      />
    );
  }

  return <ScorersTable scorers={data} />;
}
