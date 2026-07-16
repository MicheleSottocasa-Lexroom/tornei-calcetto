import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, ListOrdered } from 'lucide-react';
import { useStandings, useTeams, useTournament } from '@/hooks/queries';
import { useTeamParticipants } from '@/features/teams/hooks';
import { EmptyState, Spinner } from '@/components/ui';
import { StandingsTable } from '@/features/tournaments/StandingsTable';
import type { TeamParticipant, TeamWithMembers } from '@/types';

export default function StandingsTab() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament } = useTournament(id);
  const { data, isLoading, error } = useStandings(id);
  const { data: teams } = useTeams(id);
  const { data: participants } = useTeamParticipants(id);

  const teamsById = useMemo<Map<string, TeamWithMembers>>(
    () => new Map((teams ?? []).map((t) => [t.id, t])),
    [teams],
  );

  const participantsByTeam = useMemo(() => {
    const map = new Map<string, TeamParticipant[]>();
    for (const p of participants ?? []) {
      const arr = map.get(p.team_id) ?? [];
      arr.push(p);
      map.set(p.team_id, arr);
    }
    return map;
  }, [participants]);

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

  return (
    <StandingsTable
      standings={data}
      teamsById={teamsById}
      participantsByTeam={participantsByTeam}
    />
  );
}
