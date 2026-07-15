import { Outlet, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, Calendar, Pencil, UserPlus } from 'lucide-react';
import { useTournament } from '@/hooks/queries';
import { useRealtimeTournament } from '@/hooks/useRealtimeTournament';
import { useSession } from '@/hooks/useSession';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshButton } from '@/components/RefreshButton';
import type { BadgeProps } from '@/components/ui';
import type { TournamentFormat, TournamentStatus } from '@/types';

type Tone = NonNullable<BadgeProps['tone']>;

const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'Bozza',
  registration_open: 'Iscrizioni aperte',
  in_progress: 'In corso',
  completed: 'Concluso',
  archived: 'Archiviato',
};

const STATUS_TONE: Record<TournamentStatus, Tone> = {
  draft: 'default',
  registration_open: 'primary',
  in_progress: 'success',
  completed: 'default',
  archived: 'default',
};

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  round_robin: "Girone all'italiana",
  knockout: 'Eliminazione diretta',
  groups_playoff: 'Gironi + Playoff',
  league: 'Campionato',
};

export default function TournamentDetailLayout() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useSession();
  const { data: tournament, isLoading, error } = useTournament(id);

  // Aggiornamenti live di partite/eventi per questo torneo.
  useRealtimeTournament(id);

  const tabs: TabItem[] = [
    { to: 'classifica', label: 'Classifica' },
    { to: 'calendario', label: 'Calendario' },
    { to: 'marcatori', label: 'Marcatori' },
    { to: 'squadre', label: 'Squadre' },
  ];

  // Il tabellone non ha senso per il formato campionato.
  if (tournament && tournament.format !== 'league') {
    tabs.push({ to: 'bracket', label: 'Tabellone' });
  }

  return (
    <section className="space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Tornei
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner label="Caricamento torneo…" />
        </div>
      ) : error ? (
        <EmptyState
          title="Errore di caricamento"
          description="Impossibile caricare il torneo. Riprova più tardi."
        />
      ) : !tournament ? (
        <EmptyState
          title="Torneo non trovato"
          description="Il torneo richiesto non esiste o è stato rimosso."
        />
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">
                  {tournament.name}
                </h1>
                <Badge tone={STATUS_TONE[tournament.status]}>
                  {STATUS_LABELS[tournament.status] ?? tournament.status}
                </Badge>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isAdmin && (
                  <Link to={`/admin/tornei/${id}/modifica`}>
                    <Button variant="secondary" size="sm">
                      <Pencil className="h-4 w-4" />
                      Modifica
                    </Button>
                  </Link>
                )}
                <RefreshButton queryKeys={[['tournament', id]]} />
              </div>
            </div>
            {tournament.description && (
              <p className="text-sm text-muted-foreground">{tournament.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{FORMAT_LABELS[tournament.format] ?? tournament.format}</span>
              {(tournament.starts_at || tournament.ends_at) && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatRange(tournament.starts_at, tournament.ends_at)}
                </span>
              )}
            </div>
          </div>

          {tournament.status === 'registration_open' && (
            <Link to={`/tornei/${tournament.id}/iscrizione`} className="block">
              <Button fullWidth>
                <UserPlus className="h-4 w-4" />
                Iscrivi la tua squadra
              </Button>
            </Link>
          )}

          <Tabs items={tabs} />

          <div className="pt-2">
            <Outlet />
          </div>
        </>
      )}
    </section>
  );
}

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: it });
  } catch {
    return '';
  }
}

function formatRange(start: string | null, end: string | null): string {
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  if (start) return `Dal ${fmtDate(start)}`;
  if (end) return `Fino al ${fmtDate(end)}`;
  return '';
}
