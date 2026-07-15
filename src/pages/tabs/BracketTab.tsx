import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, GitBranch } from 'lucide-react';
import { useMatches, useTeams } from '@/hooks/queries';
import { EmptyState, Spinner } from '@/components/ui';
import { Bracket } from '@/features/tournaments/Bracket';
import type { Team } from '@/types';

export default function BracketTab() {
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
        <Spinner label="Caricamento tabellone…" />
      </div>
    );
  }

  if (matchesError || teamsError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10 text-red-400" />}
        title="Errore di caricamento"
        description="Impossibile caricare il tabellone. Riprova più tardi."
      />
    );
  }

  const knockoutMatches = (matches ?? []).filter((m) => m.stage === 'knockout');

  if (knockoutMatches.length === 0) {
    return (
      <EmptyState
        icon={<GitBranch className="h-10 w-10" />}
        title="Tabellone non disponibile"
        description="Il tabellone comparirà dopo la generazione della fase a eliminazione."
      />
    );
  }

  return <Bracket matches={knockoutMatches} teamsById={teamsById} />;
}
