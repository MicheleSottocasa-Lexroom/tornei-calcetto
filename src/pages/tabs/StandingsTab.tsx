import { useParams } from 'react-router-dom';
import { AlertTriangle, ListOrdered } from 'lucide-react';
import { useStandings, useTournament } from '@/hooks/queries';
import { EmptyState, Spinner } from '@/components/ui';
import { StandingsTable } from '@/features/tournaments/StandingsTable';

export default function StandingsTab() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament } = useTournament(id);
  const { data, isLoading, error } = useStandings(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Caricamento classifica…" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10 text-destructive" />}
        title="Errore di caricamento"
        description="Impossibile caricare la classifica. Riprova più tardi."
      />
    );
  }

  if (!data || data.length === 0) {
    const knockout = tournament?.format === 'knockout';
    return (
      <EmptyState
        icon={<ListOrdered className="h-10 w-10" />}
        title={knockout ? 'Classifica non disponibile' : 'Nessuna classifica'}
        description={
          knockout
            ? 'I tornei a eliminazione diretta non hanno una classifica: consulta il tabellone.'
            : 'La classifica comparirà dopo le prime partite.'
        }
      />
    );
  }

  return <StandingsTable standings={data} />;
}
