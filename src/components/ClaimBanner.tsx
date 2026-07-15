import { useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useClaimParticipant, usePendingClaims } from '@/features/teams/hooks';

/**
 * Avvisa l'utente se il suo nome/cognome o la sua email risultano tra i
 * partecipanti di una squadra, proponendo di associarla al proprio profilo.
 */
export function ClaimBanner() {
  const { data: claims } = usePendingClaims();
  const claim = useClaimParticipant();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = (claims ?? []).filter((c) => !dismissed.has(c.participant.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) =>
    setDismissed((prev) => new Set(prev).add(id));

  return (
    <div className="mb-4 space-y-2">
      {visible.map((c) => (
        <Card
          key={c.participant.id}
          className="flex flex-col gap-3 border-primary/40 bg-primary/5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2 text-sm text-foreground">
            <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Risulti tra i partecipanti di <strong>{c.teamName}</strong>
              {c.tournamentName ? ` · ${c.tournamentName}` : ''}. Vuoi associare questa
              squadra al tuo profilo?
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              loading={claim.isPending && claim.variables === c.participant.id}
              onClick={() =>
                claim.mutate(c.participant.id, {
                  onSuccess: () => dismiss(c.participant.id),
                })
              }
            >
              Associa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismiss(c.participant.id)}
            >
              <X className="h-4 w-4" />
              Ignora
            </Button>
          </div>
        </Card>
      ))}
      {claim.isError && (
        <p className="text-xs text-destructive">
          Associazione non riuscita: il partecipante potrebbe non corrispondere più.
        </p>
      )}
    </div>
  );
}
