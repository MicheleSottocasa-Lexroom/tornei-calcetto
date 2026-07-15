import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { useMatches, useTeams } from '@/hooks/queries';
import { EmptyState, Spinner } from '@/components/ui';
import { ScheduleList } from '@/features/tournaments/ScheduleList';
import type { Team } from '@/types';

export default function ScheduleTab() {
  const { id } = useParams<{ id: string }>();
  const {
    data: matches,
    isLoading: matchesLoading,
    error: matchesError,
  } = useMatches(id);
  const {
    data: teams,
    isLoading: teamsLoading,
    error: teamsError,
  } = useTeams(id);

  const teamsById = useMemo<Map<string, Team>>(
    () => new Map((teams ?? []).map((t) => [t.id, t])),
    [teams],
  );

  if (matchesLoading || teamsLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Caricamento calendario…" />
      </div>
    );
  }

  if (matchesError || teamsError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10 text-destructive" />}
        title="Errore di caricamento"
        description="Impossibile caricare il calendario. Riprova più tardi."
      />
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-10 w-10" />}
        title="Nessuna partita in calendario"
        description="Il calendario verrà generato dall'amministratore."
      />
    );
  }

  return <ScheduleList matches={matches} teamsById={teamsById} />;
}
