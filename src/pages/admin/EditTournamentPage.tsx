import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info, Lock } from 'lucide-react';
import { useMatches, useTournament } from '@/hooks/queries';
import {
  useUpdateTournament,
  type UpdateTournamentInput,
} from '@/features/admin/hooks';
import {
  TournamentForm,
  type TournamentFormValues,
} from '@/features/admin/TournamentForm';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Tournament } from '@/types';

/** Config del torneo → valori del form (con fallback sui default). */
function toFormDefaults(t: Tournament): Partial<TournamentFormValues> {
  const c = (t.config ?? {}) as {
    points?: { win?: number; draw?: number; loss?: number };
    round_robin?: { double_round?: boolean };
    groups?: { num_groups?: number; advance_per_group?: number };
    knockout?: { seeding?: 'seeded' | 'random'; third_place?: boolean };
    manual_matches?: boolean;
  };
  return {
    name: t.name,
    description: t.description ?? '',
    format: t.format,
    status: t.status,
    starts_at: t.starts_at ?? '',
    ends_at: t.ends_at ?? '',
    points_win: c.points?.win ?? 3,
    points_draw: c.points?.draw ?? 1,
    points_loss: c.points?.loss ?? 0,
    double_round: c.round_robin?.double_round ?? false,
    num_groups: c.groups?.num_groups ?? 2,
    advance_per_group: c.groups?.advance_per_group ?? 2,
    seeding: c.knockout?.seeding ?? 'seeded',
    third_place: c.knockout?.third_place ?? false,
    manual_matches: c.manual_matches ?? false,
  };
}

export default function EditTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tournament, isLoading, error } = useTournament(id);
  const { data: matches } = useMatches(id);
  const update = useUpdateTournament();
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Caricamento torneo…" />
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <section className="space-y-4">
        <BackLink id={id} />
        <EmptyState
          title="Torneo non trovato"
          description="Il torneo richiesto non esiste o non è accessibile."
        />
      </section>
    );
  }

  const hasSchedule = (matches?.length ?? 0) > 0;
  const editableStatus =
    tournament.status === 'draft' || tournament.status === 'registration_open';
  const structureLocked = hasSchedule || !editableStatus;

  return (
    <section className="space-y-4">
      <BackLink id={id} />
      <h1 className="text-xl font-bold text-foreground">Modifica torneo</h1>

      {structureLocked ? (
        <Card className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            Puoi modificare <strong className="text-foreground">nome, descrizione, date e stato</strong>.
            Formato e configurazione sono <strong className="text-foreground">bloccati</strong>{' '}
            {hasSchedule
              ? 'perché il calendario è già stato generato'
              : 'perché il torneo non è più in bozza/iscrizioni'}
            : cambiarli comprometterebbe partite e classifica.
          </span>
        </Card>
      ) : (
        <Card className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Puoi modificare <strong className="text-foreground">tutti i campi, incluso il formato</strong>:
            il calendario non è ancora stato generato.
          </span>
        </Card>
      )}

      {saveError && (
        <Card className="text-sm text-destructive">Errore nel salvataggio: {saveError}</Card>
      )}

      <TournamentForm
        submitLabel="Salva modifiche"
        loading={update.isPending}
        structureLocked={structureLocked}
        defaultValues={toFormDefaults(tournament)}
        onSubmit={(input) => {
          setSaveError(null);
          // A struttura bloccata invio solo i campi "meta" (mai formato/config).
          const payload: UpdateTournamentInput = structureLocked
            ? {
                id: tournament.id,
                name: input.name,
                description: input.description,
                status: input.status,
                starts_at: input.starts_at,
                ends_at: input.ends_at,
              }
            : { id: tournament.id, ...input };

          update.mutate(payload, {
            onSuccess: () => navigate(`/tornei/${tournament.id}`),
            onError: (e) => setSaveError(e.message),
          });
        }}
      />
    </section>
  );
}

function BackLink({ id }: { id: string | undefined }) {
  return (
    <Link
      to={id ? `/tornei/${id}` : '/admin'}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Torna al torneo
    </Link>
  );
}
