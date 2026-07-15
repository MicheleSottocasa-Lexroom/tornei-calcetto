import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Users } from 'lucide-react';
import { useTeams } from '@/hooks/queries';
import { useTeamParticipants } from '@/features/teams/hooks';
import { EmptyState, Spinner } from '@/components/ui';
import { TeamsList } from '@/features/tournaments/TeamsList';
import type { TeamParticipant } from '@/types';

export default function TeamsTab() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useTeams(id);
  const { data: participants } = useTeamParticipants(id);

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
        <Spinner label="Caricamento squadre…" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10 text-destructive" />}
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

  return <TeamsList teams={data} participantsByTeam={participantsByTeam} />;
}
