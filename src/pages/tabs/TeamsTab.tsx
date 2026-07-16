import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, UserCheck, UserPlus, Users } from 'lucide-react';
import { useTeams, useTournament } from '@/hooks/queries';
import { useSession } from '@/hooks/useSession';
import { useTeamParticipants } from '@/features/teams/hooks';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { TeamsList } from '@/features/tournaments/TeamsList';
import type { TeamParticipant } from '@/types';

export default function TeamsTab() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament } = useTournament(id);
  const { data, isLoading, error } = useTeams(id);
  const { data: participants } = useTeamParticipants(id);
  const { user } = useSession();

  const registrationOpen = tournament?.status === 'registration_open';
  const myTeam = (data ?? []).find((t) =>
    t.members.some((m) => m.profile_id === user?.id),
  );

  const registerCta = myTeam ? (
    <Link to={`/tornei/${id}/iscrizione`} className="block">
      <Button variant="secondary" fullWidth>
        <UserCheck className="h-4 w-4" />
        Sei iscritto con {myTeam.name} · gestisci
      </Button>
    </Link>
  ) : registrationOpen ? (
    <Link to={`/tornei/${id}/iscrizione`} className="block">
      <Button fullWidth>
        <UserPlus className="h-4 w-4" />
        Iscrivi la tua squadra
      </Button>
    </Link>
  ) : null;

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
      <div className="space-y-4">
        {registerCta}
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nessuna squadra iscritta"
          description={
            registrationOpen
              ? 'Sii il primo: crea la tua squadra e iscriviti al torneo.'
              : 'Le squadre iscritte compariranno qui.'
          }
          action={
            registrationOpen ? (
              <Link to={`/tornei/${id}/iscrizione`}>
                <Button size="sm">
                  <UserPlus className="h-4 w-4" />
                  Crea la tua squadra
                </Button>
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {registerCta}
      <TeamsList teams={data} participantsByTeam={participantsByTeam} />
    </div>
  );
}
