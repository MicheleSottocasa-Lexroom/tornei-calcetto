import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { useMatches, useTeams } from '@/hooks/queries';
import { useTeamParticipants } from '@/features/teams/hooks';
import { EmptyState, Spinner } from '@/components/ui';
import { ScheduleList } from '@/features/tournaments/ScheduleList';
import type { TeamParticipant, TeamWithMembers } from '@/types';

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

  return (
    <ScheduleList
      matches={matches}
      teamsById={teamsById}
      participantsByTeam={participantsByTeam}
    />
  );
}
