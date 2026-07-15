import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardList, Plus, Trophy, Users } from 'lucide-react';
import { useTournaments } from '@/hooks/queries';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import type { Tournament, TournamentStatus } from '@/types';
import {
  FORMAT_LABELS,
  STATUS_LABELS,
} from '@/features/admin/TournamentForm';
import { useUpdateTournament } from '@/features/admin/hooks';

const STATUS_TONE: Record<TournamentStatus, Parameters<typeof Badge>[0]['tone']> = {
  draft: 'default',
  registration_open: 'primary',
  in_progress: 'success',
  completed: 'default',
  archived: 'default',
};

function TournamentRow({ tournament }: { tournament: Tournament }) {
  const updateTournament = useUpdateTournament();

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground">{tournament.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {FORMAT_LABELS[tournament.format]}
          </p>
        </div>
        <Badge tone={STATUS_TONE[tournament.status]}>
          {STATUS_LABELS[tournament.status]}
        </Badge>
      </div>

      <div>
        <label
          htmlFor={`status-${tournament.id}`}
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          Stato torneo
        </label>
        <Select
          id={`status-${tournament.id}`}
          value={tournament.status}
          disabled={updateTournament.isPending}
          onChange={(e) =>
            updateTournament.mutate({
              id: tournament.id,
              status: e.target.value as TournamentStatus,
            })
          }
        >
          {(Object.keys(STATUS_LABELS) as TournamentStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/admin/tornei/${tournament.id}/calendario`}>
          <Button variant="secondary" size="sm" fullWidth>
            <CalendarDays className="h-4 w-4" />
            Calendario
          </Button>
        </Link>
        <Link to={`/admin/tornei/${tournament.id}/risultati`}>
          <Button variant="secondary" size="sm" fullWidth>
            <ClipboardList className="h-4 w-4" />
            Risultati
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { data: tournaments, isLoading, error } = useTournaments();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">Dashboard admin</h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/admin/tornei/nuovo">
          <Button fullWidth>
            <Plus className="h-4 w-4" />
            Nuovo torneo
          </Button>
        </Link>
        <Link to="/admin/squadre">
          <Button variant="secondary" fullWidth>
            <Users className="h-4 w-4" />
            Gestione squadre
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8">
          <Spinner label="Caricamento tornei…" />
        </div>
      ) : error ? (
        <Card className="text-sm text-destructive">
          Errore nel caricamento dei tornei.
        </Card>
      ) : !tournaments || tournaments.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-10 w-10" />}
          title="Nessun torneo"
          description="Crea il primo torneo per iniziare."
          action={
            <Link to="/admin/tornei/nuovo">
              <Button>
                <Plus className="h-4 w-4" />
                Nuovo torneo
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <TournamentRow key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </section>
  );
}
