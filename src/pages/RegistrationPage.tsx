import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Users } from 'lucide-react';
import { useTournament, useTeams } from '@/hooks/queries';
import { useSession } from '@/hooks/useSession';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { TeamRegistrationForm } from '@/features/teams/TeamRegistrationForm';
import { RosterEditor } from '@/features/teams/RosterEditor';
import {
  useJoinTeam,
  useLeaveTeam,
  useRenameTeam,
  useTeamParticipants,
  useTransferCaptaincy,
  teamErrorMessage,
} from '@/features/teams/hooks';
import type { TournamentStatus } from '@/types';

const statusLabels: Record<TournamentStatus, string> = {
  draft: 'Bozza',
  registration_open: 'Iscrizioni aperte',
  in_progress: 'In corso',
  completed: 'Concluso',
  archived: 'Archiviato',
};

export default function RegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = id ?? '';
  const { user } = useSession();

  const { data: tournament, isLoading: tournamentLoading } = useTournament(id);
  const { data: teams, isLoading: teamsLoading } = useTeams(id);

  const joinTeam = useJoinTeam(tournamentId);
  const leaveTeam = useLeaveTeam();
  const transfer = useTransferCaptaincy(tournamentId);
  const rename = useRenameTeam(tournamentId);
  const [newCaptain, setNewCaptain] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const { data: allParticipants } = useTeamParticipants(id);

  const registrationOpen = tournament?.status === 'registration_open';

  const { myTeam, myMembership } = useMemo(() => {
    if (!user || !teams) {
      return { myTeam: undefined, myMembership: undefined };
    }
    for (const t of teams) {
      const mem = t.members.find((m) => m.profile_id === user.id);
      if (mem) return { myTeam: t, myMembership: mem };
    }
    return { myTeam: undefined, myMembership: undefined };
  }, [teams, user]);

  const myParticipants = useMemo(
    () => (allParticipants ?? []).filter((p) => myTeam && p.team_id === myTeam.id),
    [allParticipants, myTeam],
  );

  const otherMembers = useMemo(
    () => (myTeam ? myTeam.members.filter((m) => m.profile_id !== user?.id) : []),
    [myTeam, user?.id],
  );

  const takenProfileIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams ?? []) {
      for (const m of t.members) set.add(m.profile_id);
    }
    return set;
  }, [teams]);

  const joinableTeams = useMemo(
    () => (teams ?? []).filter((t) => t.status !== 'withdrawn'),
    [teams],
  );

  if (tournamentLoading || teamsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Caricamento…" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <EmptyState
        title="Torneo non trovato"
        description="Il torneo che cerchi non esiste o è stato rimosso."
        action={
          <Link to="/">
            <Button variant="secondary" size="sm">
              Torna ai tornei
            </Button>
          </Link>
        }
      />
    );
  }

  const isCaptain = myMembership?.role === 'captain';

  return (
    <section className="space-y-4">
      <Link
        to={`/tornei/${tournamentId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna al torneo
      </Link>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Iscrizione</h1>
          <Badge tone={registrationOpen ? 'success' : 'default'}>
            {statusLabels[tournament.status] ?? tournament.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{tournament.name}</p>
      </div>

      {/* Nessuna squadra e iscrizioni chiuse */}
      {!myTeam && !registrationOpen && (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Iscrizioni chiuse"
          description="Le iscrizioni per questo torneo non sono aperte."
          action={
            <Link to={`/tornei/${tournamentId}/squadre`}>
              <Button variant="secondary" size="sm">
                Vedi le squadre
              </Button>
            </Link>
          }
        />
      )}

      {/* L'utente è già in una squadra */}
      {myTeam && (
        <Card>
          <CardHeader>
            <CardTitle>La tua squadra</CardTitle>
            <Badge tone="primary">{isCaptain ? 'Capitano' : 'Giocatore'}</Badge>
          </CardHeader>

          {isCaptain && editingName ? (
            <div className="mb-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  aria-label="Nome squadra"
                />
                <Button
                  size="sm"
                  loading={rename.isPending}
                  disabled={!nameDraft.trim() || nameDraft.trim() === myTeam.name}
                  onClick={() => {
                    const n = nameDraft.trim();
                    if (!n || n === myTeam.name) {
                      setEditingName(false);
                      return;
                    }
                    rename.mutate(
                      { teamId: myTeam.id, name: n },
                      { onSuccess: () => setEditingName(false) },
                    );
                  }}
                >
                  Salva
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                  Annulla
                </Button>
              </div>
              {rename.isError && (
                <p className="text-sm text-destructive">{teamErrorMessage(rename.error)}</p>
              )}
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2">
              <p className="text-lg font-semibold text-foreground">{myTeam.name}</p>
              {isCaptain && (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(myTeam.name);
                    setEditingName(true);
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Modifica nome squadra"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {myParticipants.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Partecipanti</p>
              <ul className="space-y-1.5">
                {myParticipants.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-foreground">{p.full_name}</span>
                    {p.profile_id ? (
                      <Badge tone="success">Associato</Badge>
                    ) : (
                      <Badge tone="default">In attesa</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <RosterEditor
            team={myTeam}
            tournamentId={tournamentId}
            canManage={!!isCaptain && registrationOpen}
            takenProfileIds={takenProfileIds}
          />

          {!registrationOpen && (
            <p className="mt-3 text-xs text-muted-foreground">
              Le iscrizioni sono chiuse: la rosa non è più modificabile.
            </p>
          )}

          {isCaptain && otherMembers.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground">
                Passa la fascia di capitano
              </p>
              <div className="flex gap-2">
                <Select value={newCaptain} onChange={(e) => setNewCaptain(e.target.value)}>
                  <option value="">Scegli un giocatore…</option>
                  {otherMembers.map((m) => (
                    <option key={m.id} value={m.profile_id}>
                      {m.profile?.full_name ?? m.profile?.email ?? 'Giocatore'}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  disabled={!newCaptain}
                  loading={transfer.isPending}
                  onClick={() => {
                    if (!newCaptain) return;
                    if (
                      !window.confirm(
                        'Passare la fascia di capitano? Diventerai un giocatore normale.',
                      )
                    )
                      return;
                    transfer.mutate(
                      { teamId: myTeam.id, newCaptainId: newCaptain },
                      { onSuccess: () => setNewCaptain('') },
                    );
                  }}
                >
                  Passa
                </Button>
              </div>
              {transfer.isError && (
                <p className="text-sm text-destructive">
                  {teamErrorMessage(transfer.error)}
                </p>
              )}
            </div>
          )}

          {!isCaptain && (
            <div className="mt-4 border-t border-border pt-3">
              <Button
                variant="danger"
                size="sm"
                loading={leaveTeam.isPending}
                onClick={() => {
                  if (!window.confirm(`Uscire da ${myTeam.name}?`)) return;
                  leaveTeam.mutate({ teamId: myTeam.id });
                }}
              >
                Esci dalla squadra
              </Button>
              {leaveTeam.isError && (
                <p className="mt-2 text-sm text-destructive">
                  {teamErrorMessage(leaveTeam.error)}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Nessuna squadra e iscrizioni aperte: crea o unisciti */}
      {!myTeam && registrationOpen && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crea una nuova squadra</CardTitle>
            </CardHeader>
            <p className="mb-3 text-sm text-muted-foreground">
              Diventerai il capitano e potrai gestire la rosa.
            </p>
            <TeamRegistrationForm tournamentId={tournamentId} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unisciti a una squadra</CardTitle>
            </CardHeader>
            {joinableTeams.length === 0 ? (
              <EmptyState
                icon={<Users className="h-10 w-10" />}
                title="Nessuna squadra"
                description="Non ci sono ancora squadre. Creane una nuova!"
              />
            ) : (
              <ul className="space-y-2">
                {joinableTeams.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.members.length}{' '}
                        {t.members.length === 1 ? 'giocatore' : 'giocatori'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      loading={
                        joinTeam.isPending && joinTeam.variables?.teamId === t.id
                      }
                      onClick={() => joinTeam.mutate({ teamId: t.id })}
                    >
                      Unisciti
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {joinTeam.isError && (
              <p className="mt-2 text-sm text-destructive">
                {teamErrorMessage(joinTeam.error)}
              </p>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
