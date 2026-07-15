/**
 * Form di creazione/modifica torneo (React Hook Form + Zod).
 * I campi di configurazione mostrati dipendono dal formato scelto.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { TournamentFormat, TournamentStatus } from '@/types';
import type { CreateTournamentInput, TournamentConfig } from './hooks';

const schema = z.object({
  name: z.string().trim().min(1, 'Il nome è obbligatorio').max(120),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  format: z.enum(['round_robin', 'knockout', 'groups_playoff', 'league']),
  status: z.enum([
    'draft',
    'registration_open',
    'in_progress',
    'completed',
    'archived',
  ]),
  starts_at: z.string().optional().or(z.literal('')),
  ends_at: z.string().optional().or(z.literal('')),
  points_win: z.coerce.number().int().min(0).max(10),
  points_draw: z.coerce.number().int().min(0).max(10),
  points_loss: z.coerce.number().int().min(0).max(10),
  double_round: z.boolean(),
  num_groups: z.coerce.number().int().min(2).max(16),
  advance_per_group: z.coerce.number().int().min(1).max(8),
  seeding: z.enum(['seeded', 'random']),
  third_place: z.boolean(),
});

export type TournamentFormValues = z.infer<typeof schema>;

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  round_robin: 'Girone all’italiana',
  knockout: 'Eliminazione diretta',
  groups_playoff: 'Gironi + Playoff',
  league: 'Campionato',
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'Bozza',
  registration_open: 'Iscrizioni aperte',
  in_progress: 'In corso',
  completed: 'Concluso',
  archived: 'Archiviato',
};

const defaultFormValues: TournamentFormValues = {
  name: '',
  description: '',
  format: 'round_robin',
  status: 'draft',
  starts_at: '',
  ends_at: '',
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  double_round: false,
  num_groups: 2,
  advance_per_group: 2,
  seeding: 'seeded',
  third_place: false,
};

/** Converte una data ISO in valore per <input type="date"> (YYYY-MM-DD). */
function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/** Converte i valori del form nel payload della mutation. */
export function formValuesToInput(v: TournamentFormValues): CreateTournamentInput {
  const config: TournamentConfig = {
    points: { win: v.points_win, draw: v.points_draw, loss: v.points_loss },
    round_robin: { double_round: v.double_round },
    groups: { num_groups: v.num_groups, advance_per_group: v.advance_per_group },
    knockout: { seeding: v.seeding, legs: 1, third_place: v.third_place },
  };
  return {
    name: v.name.trim(),
    description: v.description?.trim() ? v.description.trim() : null,
    format: v.format,
    status: v.status,
    starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null,
    ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : null,
    config,
  };
}

export interface TournamentFormProps {
  defaultValues?: Partial<TournamentFormValues>;
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (input: CreateTournamentInput) => void;
}

export function TournamentForm({
  defaultValues,
  submitLabel = 'Crea torneo',
  loading = false,
  onSubmit,
}: TournamentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TournamentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaultFormValues,
      ...defaultValues,
      starts_at: toDateInput(defaultValues?.starts_at) || '',
      ends_at: toDateInput(defaultValues?.ends_at) || '',
    },
  });

  const format = watch('format');
  const showDoubleRound =
    format === 'round_robin' || format === 'league' || format === 'groups_playoff';
  const showGroups = format === 'groups_playoff';
  const showKnockout = format === 'knockout' || format === 'groups_playoff';

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(formValuesToInput(v)))}
      className="space-y-4"
    >
      <Card className="space-y-4">
        <FormField label="Nome torneo" htmlFor="name" required error={errors.name?.message}>
          <Input
            id="name"
            placeholder="Es. Torneo di Primavera"
            invalid={!!errors.name}
            {...register('name')}
          />
        </FormField>

        <FormField label="Descrizione" htmlFor="description" error={errors.description?.message}>
          <Input
            id="description"
            placeholder="Facoltativa"
            {...register('description')}
          />
        </FormField>

        <FormField label="Formato" htmlFor="format" required>
          <Select id="format" {...register('format')}>
            {(Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Inizio" htmlFor="starts_at">
            <Input id="starts_at" type="date" {...register('starts_at')} />
          </FormField>
          <FormField label="Fine" htmlFor="ends_at">
            <Input id="ends_at" type="date" {...register('ends_at')} />
          </FormField>
        </div>

        <FormField label="Stato" htmlFor="status" required>
          <Select id="status" {...register('status')}>
            {(Object.keys(STATUS_LABELS) as TournamentStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormField>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-semibold text-foreground">Punti classifica</p>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Vittoria" htmlFor="points_win">
            <Input id="points_win" type="number" min={0} max={10} {...register('points_win')} />
          </FormField>
          <FormField label="Pareggio" htmlFor="points_draw">
            <Input id="points_draw" type="number" min={0} max={10} {...register('points_draw')} />
          </FormField>
          <FormField label="Sconfitta" htmlFor="points_loss">
            <Input id="points_loss" type="number" min={0} max={10} {...register('points_loss')} />
          </FormField>
        </div>
      </Card>

      {(showDoubleRound || showGroups || showKnockout) && (
        <Card className="space-y-4">
          <p className="text-sm font-semibold text-foreground">Opzioni formato</p>

          {showDoubleRound && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-background accent-primary-600"
                {...register('double_round')}
              />
              Andata e ritorno (doppio girone)
            </label>
          )}

          {showGroups && (
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Numero gironi"
                htmlFor="num_groups"
                error={errors.num_groups?.message}
              >
                <Input
                  id="num_groups"
                  type="number"
                  min={2}
                  max={16}
                  {...register('num_groups')}
                />
              </FormField>
              <FormField
                label="Qualificate per girone"
                htmlFor="advance_per_group"
                error={errors.advance_per_group?.message}
              >
                <Input
                  id="advance_per_group"
                  type="number"
                  min={1}
                  max={8}
                  {...register('advance_per_group')}
                />
              </FormField>
            </div>
          )}

          {showKnockout && (
            <>
              <FormField label="Sorteggio tabellone" htmlFor="seeding">
                <Select id="seeding" {...register('seeding')}>
                  <option value="seeded">Teste di serie (per seed)</option>
                  <option value="random">Casuale</option>
                </Select>
              </FormField>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-background accent-primary-600"
                  {...register('third_place')}
                />
                Finale 3°/4° posto
              </label>
            </>
          )}
        </Card>
      )}

      <Button type="submit" fullWidth loading={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}
