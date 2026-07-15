import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useMatches, useTeams, useTournament } from '@/hooks/queries';
import { useRealtimeTournament } from '@/hooks/useRealtimeTournament';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ResultEntryForm } from '@/features/admin/ResultEntryForm';
import { MATCH_STATUS_LABELS } from '@/features/admin/labels';
import { useMatchEvents, useSaveMatchResult } from '@/features/admin/hooks';
import type { Match, MatchStatus } from '@/types';

function statusTone(status: MatchStatus) {
  switch (status) {
    case 'live':
      return 'live' as const;
    case 'finished':
      return 'success' as const;
    case 'walkover':
      return 'warning' as const;
    case 'cancelled':
      return 'danger' as const;
    default:
      return 'default' as const;
  }
}

function matchLabel(m: Match): string {
  if (m.stage === 'knockout') return m.round_name ?? `Turno ${m.round ?? ''}`;
  return `Giornata ${m.round ?? ''}`;
}

export default function ResultsEntryPage() {
  const { id } = useParams<{ id: string }>();
  useRealtimeTournament(id);

  const { data: tournament, isLoading: loadingT } = useTournament(id);
  const { data: teams } = useTeams(id);
  const { data: matches } = useMatches(id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveResult = useSaveMatchResult();
  const { data: events, isLoading: loadingEvents } = useMatchEvents(
    selectedId ?? undefined,
  );

  const teamName = useMemo(() => {
    const map = new Map((teams ?? []).map((t) => [t.id, t.name]));
    return (tid: string | null) => (tid ? map.get(tid) ?? 'Squadra' : 'Da definire');
  }, [teams]);

  const selectedMatch = useMemo(
    () => (matches ?? []).find((m) => m.id === selectedId) ?? null,
    [matches, selectedId],
  );

  const homeTeam = useMemo(
    () => (teams ?? []).find((t) => t.id === selectedMatch?.home_team_id) ?? null,
    [teams, selectedMatch],
  );
  const awayTeam = useMemo(
    () => (teams ?? []).find((t) => t.id === selectedMatch?.away_team_id) ?? null,
    [teams, selectedMatch],
  );

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

  /* ---- Dettaglio: form di inserimento risultato ---- */
  if (selectedMatch) {
    return (
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setError(null);
          }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tutte le partite
        </button>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{matchLabel(selectedMatch)}</p>
          <h1 className="text-lg font-bold text-foreground">
            {teamName(selectedMatch.home_team_id)}{' '}
            <span className="text-muted-foreground">vs</span>{' '}
            {teamName(selectedMatch.away_team_id)}
          </h1>
        </div>

        {error && (
          <Card className="text-sm text-destructive">Errore nel salvataggio: {error}</Card>
        )}

        {loadingEvents ? (
          <div className="py-6">
            <Spinner label="Caricamento eventi…" />
          </div>
        ) : (
          <ResultEntryForm
            key={selectedMatch.id}
            match={selectedMatch}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            existingEvents={events ?? []}
            saving={saveResult.isPending}
            onSave={(payload) => {
              setError(null);
              saveResult.mutate(
                {
                  tournamentId: tournament.id,
                  matchId: selectedMatch.id,
                  ...payload,
                },
                {
                  onSuccess: () => setSelectedId(null),
                  onError: (e) => setError(e.message),
                },
              );
            }}
          />
        )}
      </section>
    );
  }

  /* ---- Elenco partite ---- */
  const list = matches ?? [];

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
        <h1 className="text-xl font-bold text-foreground">Risultati</h1>
        <p className="text-sm text-muted-foreground">{tournament.name}</p>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Nessuna partita"
          description="Genera prima il calendario dalla pagina Calendario."
          action={
            <Link
              to={`/admin/tornei/${tournament.id}/calendario`}
              className="text-sm text-primary hover:text-primary"
            >
              Vai al calendario
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {list.map((m) => {
            const playable = !!m.home_team_id && !!m.away_team_id;
            const scored = m.home_score != null && m.away_score != null;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!playable}
                onClick={() => {
                  setError(null);
                  setSelectedId(m.id);
                }}
                className="w-full rounded-xl border border-border bg-card/60 p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{matchLabel(m)}</span>
                  <Badge tone={statusTone(m.status)}>
                    {MATCH_STATUS_LABELS[m.status]}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {teamName(m.home_team_id)}{' '}
                    <span className="text-muted-foreground">vs</span>{' '}
                    {teamName(m.away_team_id)}
                  </span>
                  <span className="flex items-center gap-2">
                    {scored && (
                      <span className="tabular-nums text-sm font-semibold text-foreground">
                        {m.home_score} - {m.away_score}
                      </span>
                    )}
                    {playable && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
