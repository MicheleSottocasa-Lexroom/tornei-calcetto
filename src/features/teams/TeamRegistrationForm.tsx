import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { useCreateTeam, teamErrorMessage } from './hooks';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Inserisci almeno 2 caratteri')
    .max(40, 'Massimo 40 caratteri'),
  shirtNumber: z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 99),
      'Numero non valido (0-99)',
    ),
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
  const createTeam = useCreateTeam(tournamentId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', shirtNumber: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createTeam.mutateAsync({
        name: values.name,
        shirtNumber: values.shirtNumber ? Number(values.shirtNumber) : null,
      });
      reset();
      onCreated?.();
    } catch {
      // L'errore viene mostrato tramite createTeam.error.
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
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

      <FormField
        label="Il tuo numero di maglia"
        htmlFor="team-shirt"
        hint="Opzionale"
        error={errors.shirtNumber?.message}
      >
        <Input
          id="team-shirt"
          type="number"
          min={0}
          max={99}
          placeholder="Es. 10"
          invalid={!!errors.shirtNumber}
          {...register('shirtNumber')}
        />
      </FormField>

      {createTeam.isError && (
        <p className="text-sm text-red-400">{teamErrorMessage(createTeam.error)}</p>
      )}

      <Button type="submit" fullWidth loading={createTeam.isPending}>
        Crea squadra e diventa capitano
      </Button>
    </form>
  );
}
