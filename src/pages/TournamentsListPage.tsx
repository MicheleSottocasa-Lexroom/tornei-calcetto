import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertTriangle, Calendar, Trophy } from 'lucide-react';
import { useTournaments } from '@/hooks/queries';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui';
import { RefreshButton } from '@/components/RefreshButton';
import type { BadgeProps } from '@/components/ui';
import type { Tournament, TournamentFormat, TournamentStatus } from '@/types';

type Tone = NonNullable<BadgeProps['tone']>;

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  round_robin: "Girone all'italiana",
  knockout: 'Eliminazione diretta',
  groups_playoff: 'Gironi + Playoff',
  league: 'Campionato',
};

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

const ACTIVE_STATUSES: TournamentStatus[] = [
  'draft',
  'registration_open',
  'in_progress',
];

export default function TournamentsListPage() {
  const { data, isLoading, error } = useTournaments();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Caricamento tornei…" />
      </div>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Tornei</h1>
        <EmptyState
          icon={<AlertTriangle className="h-10 w-10 text-destructive" />}
          title="Errore di caricamento"
          description="Impossibile caricare i tornei. Riprova più tardi."
        />
      </section>
    );
  }

  const tournaments = data ?? [];

  if (tournaments.length === 0) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Tornei</h1>
          <RefreshButton queryKeys={[['tournaments']]} />
        </div>
        <EmptyState
          icon={<Trophy className="h-10 w-10" />}
          title="Nessun torneo"
          description="Non ci sono ancora tornei. Torna più tardi."
        />
      </section>
    );
  }

  const active = tournaments.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const past = tournaments.filter((t) => !ACTIVE_STATUSES.includes(t.status));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">Tornei</h1>
        <RefreshButton queryKeys={[['tournaments']]} />
      </div>
      {active.length > 0 && (
        <TournamentSection title="Attivi" tournaments={active} />
      )}
      {past.length > 0 && (
        <TournamentSection title="Conclusi" tournaments={past} />
      )}
    </section>
  );
}

function TournamentSection({
  title,
  tournaments,
}: {
  title: string;
  tournaments: Tournament[];
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-3">
        {tournaments.map((t) => (
          <TournamentCard key={t.id} tournament={t} />
        ))}
      </div>
    </div>
  );
}

function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  return (
    <Link to={`/tornei/${t.id}`} className="block">
      <Card className="transition-colors hover:border-primary hover:bg-accent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">
              {t.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {FORMAT_LABELS[t.format]}
            </p>
          </div>
          <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
        </div>
        {t.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {t.description}
          </p>
        )}
        {(t.starts_at || t.ends_at) && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatRange(t.starts_at, t.ends_at)}</span>
          </div>
        )}
      </Card>
    </Link>
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
