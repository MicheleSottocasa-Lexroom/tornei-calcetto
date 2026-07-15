import { useParams } from 'react-router-dom';
import { AlertTriangle, Users } from 'lucide-react';
import { useTeams } from '@/hooks/queries';
import { EmptyState, Spinner } from '@/components/ui';
import { TeamsList } from '@/features/tournaments/TeamsList';

export default function TeamsTab() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useTeams(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Caricamento squadre…" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10 text-red-400" />}
        title="Errore di caricamento"
        description="Impossibile caricare le squadre. Riprova più tardi."
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-10 w-10" />}
        title="Nessuna squadra iscritta"
        description="Le squadre iscritte compariranno qui."
      />
    );
  }

  return <TeamsList teams={data} />;
}
