import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Plus, Trash2, Wand2 } from 'lucide-react';
import { useMatches, useTeams, useTournament } from '@/hooks/queries';
import { useRealtimeTournament } from '@/hooks/useRealtimeTournament';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { MatchScheduler } from '@/features/admin/MatchScheduler';
import { ManualMatchForm } from '@/features/admin/ManualMatchForm';
import { FORMAT_LABELS } from '@/features/admin/TournamentForm';
import {
  useAcceptCandidacy,
  useAssignTeamToGroup,
  useAutoScheduleMatches,
  useCreateGroup,
  useDeleteGroup,
  useGenerateBracket,
  useGeneratePlayoff,
  useGenerateSchedule,
  useGroups,
  useRemoveTeamFromGroup,
} from '@/features/admin/hooks';

function nextGroupName(count: number): string {
  return `Girone ${String.fromCharCode(65 + count)}`;
}

export default function ManageSchedulePage() {
  const { id } = useParams<{ id: string }>();
  useRealtimeTournament(id);

  const { data: tournament, isLoading: loadingT } = useTournament(id);
  const { data: teams } = useTeams(id);
  const { data: matches } = useMatches(id);
  const { data: groups } = useGroups(id);

  const generateSchedule = useGenerateSchedule();
  const generateBracket = useGenerateBracket();
  const generatePlayoff = useGeneratePlayoff();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const assignTeam = useAssignTeamToGroup();
  const removeTeam = useRemoveTeamFromGroup();
  const autoSchedule = useAutoScheduleMatches();
  const acceptCandidacy = useAcceptCandidacy();

  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [schedStart, setSchedStart] = useState('');
  const [perHour, setPerHour] = useState('2');

  const activeTeams = useMemo(
    () => (teams ?? []).filter((t) => t.status !== 'withdrawn' && !t.pending),
    [teams],
  );

  const pendingTeams = useMemo(
    () => (teams ?? []).filter((t) => t.pending),
    [teams],
  );

  const assignedTeamIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups ?? []) for (const tid of g.team_ids) set.add(tid);
    return set;
  }, [groups]);

  const unassignedTeams = useMemo(
    () => activeTeams.filter((t) => !assignedTeamIds.has(t.id)),
    [activeTeams, assignedTeamIds],
  );

  const teamNameById = useMemo(() => {
    const map = new Map((teams ?? []).map((t) => [t.id, t.name]));
    return (tid: string) => map.get(tid) ?? 'Squadra';
  }, [teams]);

  const groupNames = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const g of groups ?? []) rec[g.id] = g.name;
    return rec;
  }, [groups]);

  const onError = (e: Error) => setError(e.message);
  const clearError = () => setError(null);

  if (loadingT) {
    return (
      <div className="py-8">
        <Spinner label="Caricamento…" />
      </div>
    );
  }

  if (!tournament) {
    return <Card className="text-sm text-muted-foreground">Torneo non trovato.</Card>;
  }

  const format = tournament.format;
  const hasMatches = (matches ?? []).length > 0;
  const manual = Boolean(
    (tournament.config as { manual_matches?: boolean } | null)?.manual_matches,
  );

  return (
    <section className="space-y-4">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard admin
      </Link>

      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          {tournament.name} · {FORMAT_LABELS[format]} · {activeTeams.length} squadre
        </p>
      </div>

      {error && (
        <Card className="flex items-center justify-between gap-2 text-sm text-destructive">
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Chiudi
          </button>
        </Card>
      )}

      {/* Candidature in attesa (iscrizioni a torneo in corso) */}
      {pendingTeams.length > 0 && (
        <Card className="space-y-3 border-warning/40">
          <p className="text-sm font-semibold text-foreground">Candidature in attesa</p>
          <ul className="space-y-2">
            {pendingTeams.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5"
              >
                <span className="min-w-0 truncate text-sm text-foreground">{t.name}</span>
                <Button
                  size="sm"
                  loading={
                    acceptCandidacy.isPending &&
                    acceptCandidacy.variables?.teamId === t.id
                  }
                  onClick={() => {
                    clearError();
                    acceptCandidacy.mutate(
                      { tournamentId: tournament.id, teamId: t.id },
                      { onError },
                    );
                  }}
                >
                  Accetta
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Accettando, la squadra entra nel torneo. Per girone all&apos;italiana / campionato
            vengono aggiunte in coda le sue partite con orari automatici.
          </p>
        </Card>
      )}

      {/* Gestione manuale: aggiunta partita al volo */}
      {manual && (
        <ManualMatchForm
          tournamentId={tournament.id}
          format={format}
          teams={activeTeams}
        />
      )}

      {/* Generazione automatica per formato (nascosta in gestione manuale) */}
      {!manual && (format === 'round_robin' || format === 'league') && (
        <Card className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Genera automaticamente tutte le giornate del{' '}
            {format === 'league' ? 'campionato' : 'girone all’italiana'}.
            {hasMatches && ' Le partite esistenti verranno sostituite.'}
          </p>
          <Button
            fullWidth
            loading={generateSchedule.isPending}
            disabled={activeTeams.length < 2}
            onClick={() => {
              if (
                hasMatches &&
                !window.confirm(
                  'Rigenerare il calendario? Le partite esistenti verranno sostituite.',
                )
              )
                return;
              clearError();
              generateSchedule.mutate({ tournamentId: tournament.id }, { onError });
            }}
          >
            <Wand2 className="h-4 w-4" />
            Genera calendario
          </Button>
          {activeTeams.length < 2 && (
            <p className="text-xs text-muted-foreground">Servono almeno 2 squadre.</p>
          )}
        </Card>
      )}

      {!manual && format === 'knockout' && (
        <Card className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Genera il tabellone a eliminazione diretta (i bye vengono gestiti
            automaticamente).
            {hasMatches && ' Il tabellone esistente verrà sostituito.'}
          </p>
          <Button
            fullWidth
            loading={generateBracket.isPending}
            disabled={activeTeams.length < 2}
            onClick={() => {
              if (
                hasMatches &&
                !window.confirm(
                  'Rigenerare il tabellone? Quello esistente verrà sostituito.',
                )
              )
                return;
              clearError();
              generateBracket.mutate({ tournamentId: tournament.id }, { onError });
            }}
          >
            <Wand2 className="h-4 w-4" />
            Genera tabellone
          </Button>
          {activeTeams.length < 2 && (
            <p className="text-xs text-muted-foreground">Servono almeno 2 squadre.</p>
          )}
        </Card>
      )}

      {!manual && format === 'groups_playoff' && (
        <>
          {/* Creazione gironi */}
          <Card className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Gironi</p>
            <div className="flex gap-2">
              <Input
                value={groupName}
                placeholder={nextGroupName((groups ?? []).length)}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <Button
                variant="secondary"
                loading={createGroup.isPending}
                onClick={() => {
                  clearError();
                  const name =
                    groupName.trim() || nextGroupName((groups ?? []).length);
                  createGroup.mutate(
                    {
                      tournamentId: tournament.id,
                      name,
                      position: (groups ?? []).length,
                    },
                    { onSuccess: () => setGroupName(''), onError },
                  );
                }}
              >
                <Plus className="h-4 w-4" />
                Aggiungi
              </Button>
            </div>
          </Card>

          {(groups ?? []).map((g) => {
            const groupTeamCount = g.team_ids.length;
            return (
              <Card key={g.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{g.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Eliminare ${g.name}?`)) return;
                      clearError();
                      deleteGroup.mutate(
                        { groupId: g.id, tournamentId: tournament.id },
                        { onError },
                      );
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Elimina girone"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {groupTeamCount === 0 ? (
                  <p className="text-xs text-muted-foreground">Nessuna squadra assegnata.</p>
                ) : (
                  <ul className="space-y-1">
                    {g.team_ids.map((tid) => (
                      <li
                        key={tid}
                        className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-1.5 text-sm text-foreground"
                      >
                        <span className="truncate">{teamNameById(tid)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            clearError();
                            removeTeam.mutate(
                              { tournamentId: tournament.id, teamId: tid },
                              { onError },
                            );
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                          aria-label="Rimuovi squadra dal girone"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {unassignedTeams.length > 0 && (
                  <Select
                    defaultValue=""
                    onChange={(e) => {
                      const teamId = e.target.value;
                      if (!teamId) return;
                      clearError();
                      assignTeam.mutate(
                        { tournamentId: tournament.id, groupId: g.id, teamId },
                        { onError },
                      );
                      e.target.value = '';
                    }}
                  >
                    <option value="">Assegna squadra…</option>
                    {unassignedTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  loading={generateSchedule.isPending}
                  disabled={groupTeamCount < 2}
                  onClick={() => {
                    clearError();
                    generateSchedule.mutate(
                      { tournamentId: tournament.id, groupId: g.id },
                      { onError },
                    );
                  }}
                >
                  <Wand2 className="h-4 w-4" />
                  Genera calendario {g.name}
                </Button>
              </Card>
            );
          })}

          {(groups ?? []).length > 0 && (
            <Card className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Quando tutte le partite dei gironi sono concluse, genera il tabellone
                playoff con le squadre qualificate.
              </p>
              <Button
                fullWidth
                loading={generatePlayoff.isPending}
                onClick={() => {
                  clearError();
                  generatePlayoff.mutate(
                    { tournamentId: tournament.id },
                    { onError },
                  );
                }}
              >
                <Wand2 className="h-4 w-4" />
                Genera playoff
              </Button>
            </Card>
          )}
        </>
      )}

      {/* Date e orari automatici */}
      {hasMatches && (
        <Card className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Date e orari automatici</p>
            <p className="text-xs text-muted-foreground">
              Assegna gli orari a partire dall&apos;inizio scelto, {Number(perHour) || 2}{' '}
              partite per ora. Sovrascrive gli orari esistenti.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Inizio" htmlFor="sched_start">
              <Input
                id="sched_start"
                type="datetime-local"
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
              />
            </FormField>
            <FormField label="Partite/ora" htmlFor="sched_per_hour">
              <Input
                id="sched_per_hour"
                type="number"
                min={1}
                max={4}
                value={perHour}
                onChange={(e) => setPerHour(e.target.value)}
              />
            </FormField>
          </div>
          <Button
            fullWidth
            loading={autoSchedule.isPending}
            disabled={!schedStart}
            onClick={() => {
              if (!schedStart) return;
              clearError();
              autoSchedule.mutate(
                {
                  tournamentId: tournament.id,
                  start: new Date(schedStart).toISOString(),
                  perHour: Number(perHour) || 2,
                },
                { onError },
              );
            }}
          >
            <CalendarClock className="h-4 w-4" />
            Genera date e orari
          </Button>
        </Card>
      )}

      {/* Partite generate */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Partite</h2>
          {hasMatches && (
            <Badge tone="default">{(matches ?? []).length} partite</Badge>
          )}
        </div>
        <MatchScheduler
          matches={matches ?? []}
          teams={teams ?? []}
          tournamentId={tournament.id}
          groupNames={groupNames}
        />
      </div>
    </section>
  );
}
