import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { useMatches, useTeams } from '@/hooks/queries';
import {
  useCheckInMatch,
  useMatchCheckIns,
  useTeamParticipants,
} from '@/features/teams/hooks';
import { useSession } from '@/hooks/useSession';
import { EmptyState, Spinner } from '@/components/ui';
import { ScheduleList } from '@/features/tournaments/ScheduleList';
import type { TeamParticipant, TeamWithMembers } from '@/types';

export default function ScheduleTab() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
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
  const { data: checkIns } = useMatchCheckIns(id);
  const checkIn = useCheckInMatch();

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

  // Insieme "matchId|teamId" dei check-in registrati (già filtrati dalla RLS
  // alle sole partite dell'utente): la presenza per casa/ospite si ricava dai
  // team id della partita.
  const checkedSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of checkIns ?? []) set.add(`${c.match_id}|${c.team_id}`);
    return set;
  }, [checkIns]);

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
      currentUserId={user?.id ?? null}
      isChecked={(matchId, teamId) => checkedSet.has(`${matchId}|${teamId}`)}
      onCheckIn={(matchId) => id && checkIn.mutate({ tournamentId: id, matchId })}
      checkInPendingId={checkIn.isPending ? (checkIn.variables?.matchId ?? null) : null}
    />
  );
}
