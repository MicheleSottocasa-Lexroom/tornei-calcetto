import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { useSession } from '@/hooks/useSession';
import { useCreateTeam, teamErrorMessage } from './hooks';

const emailField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine(
    (v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    'Email non valida',
  );

const nameOpt = z.string().trim().max(60, 'Massimo 60 caratteri').optional().or(z.literal(''));

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Inserisci almeno 2 caratteri')
    .max(40, 'Massimo 40 caratteri'),
  p1_name: z.string().trim().min(2, 'Inserisci il tuo nome').max(60),
  p1_email: emailField,
  p2_name: nameOpt,
  p2_email: emailField,
  p3_name: nameOpt,
  p3_email: emailField,
});

type FormValues = z.infer<typeof schema>;

export interface TeamRegistrationFormProps {
  tournamentId: string;
  onCreated?: () => void;
}

export function TeamRegistrationForm({
  tournamentId,
  onCreated,
}: TeamRegistrationFormProps) {
  const { user, profile } = useSession();
  const createTeam = useCreateTeam(tournamentId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      p1_name: profile?.full_name ?? '',
      p1_email: user?.email ?? '',
      p2_name: '',
      p2_email: '',
      p3_name: '',
      p3_email: '',
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    const participants = [
      { full_name: v.p1_name, email: v.p1_email || user?.email || null },
      { full_name: v.p2_name ?? '', email: v.p2_email || null },
      { full_name: v.p3_name ?? '', email: v.p3_email || null },
    ].filter((p) => p.full_name.trim().length > 0);

    try {
      await createTeam.mutateAsync({ name: v.name, participants });
      reset();
      onCreated?.();
    } catch {
      // Errore mostrato tramite createTeam.error.
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField
        label="Nome squadra"
        htmlFor="team-name"
        required
        error={errors.name?.message}
      >
        <Input
          id="team-name"
          placeholder="Es. I Leoni"
          autoComplete="off"
          invalid={!!errors.name}
          {...register('name')}
        />
      </FormField>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          Partecipanti <span className="text-muted-foreground">(max 3)</span>
        </p>

        {/* Partecipante 1 = tu (capitano) */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            Tu · capitano
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField label="Nome e cognome" htmlFor="p1_name" required error={errors.p1_name?.message}>
              <Input id="p1_name" autoComplete="off" invalid={!!errors.p1_name} {...register('p1_name')} />
            </FormField>
            <FormField label="Email" htmlFor="p1_email" error={errors.p1_email?.message}>
              <Input id="p1_email" type="email" autoComplete="off" {...register('p1_email')} />
            </FormField>
          </div>
        </div>

        {/* Partecipante 2 */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Partecipante 2 <span className="normal-case">(facoltativo)</span>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField label="Nome e cognome" htmlFor="p2_name" error={errors.p2_name?.message}>
              <Input id="p2_name" autoComplete="off" placeholder="—" {...register('p2_name')} />
            </FormField>
            <FormField label="Email (facoltativa)" htmlFor="p2_email" error={errors.p2_email?.message}>
              <Input id="p2_email" type="email" autoComplete="off" placeholder="—" {...register('p2_email')} />
            </FormField>
          </div>
        </div>

        {/* Partecipante 3 */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Partecipante 3 <span className="normal-case">(facoltativo)</span>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField label="Nome e cognome" htmlFor="p3_name" error={errors.p3_name?.message}>
              <Input id="p3_name" autoComplete="off" placeholder="—" {...register('p3_name')} />
            </FormField>
            <FormField label="Email (facoltativa)" htmlFor="p3_email" error={errors.p3_email?.message}>
              <Input id="p3_email" type="email" autoComplete="off" placeholder="—" {...register('p3_email')} />
            </FormField>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Chi indichi con nome/cognome o email, al primo accesso verrà avvisato e potrà
          associare questa squadra al proprio profilo.
        </p>
      </div>

      {createTeam.isError && (
        <p className="text-sm text-destructive">{teamErrorMessage(createTeam.error)}</p>
      )}

      <Button type="submit" fullWidth loading={createTeam.isPending}>
        Crea squadra e diventa capitano
      </Button>
    </form>
  );
}
