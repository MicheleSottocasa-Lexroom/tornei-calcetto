import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { MatchStage, TournamentFormat } from '@/types';
import { useCreateMatch } from './hooks';

/** Stage coerente col formato, così la partita conta in classifica. */
function stageForFormat(format: TournamentFormat): MatchStage {
  return format === 'league' ? 'league' : 'round_robin';
}

export interface ManualMatchFormProps {
  tournamentId: string;
  format: TournamentFormat;
  teams: readonly { id: string; name: string }[];
}

export function ManualMatchForm({ tournamentId, format, teams }: ManualMatchFormProps) {
  const createMatch = useCreateMatch();
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [round, setRound] = useState('1');
  const [scheduledAt, setScheduledAt] = useState('');
  const [venue, setVenue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!home && !!away && home !== away;

  const submit = () => {
    setError(null);
    if (!canSubmit) {
      setError('Seleziona due squadre diverse.');
      return;
    }
    createMatch.mutate(
      {
        tournamentId,
        homeTeamId: home,
        awayTeamId: away,
        stage: stageForFormat(format),
        round: Number(round) || 1,
        homeScore: homeScore.trim() === '' ? null : Number(homeScore),
        awayScore: awayScore.trim() === '' ? null : Number(awayScore),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        venue: venue.trim() || null,
      },
      {
        onSuccess: () => {
          setHome('');
          setAway('');
          setHomeScore('');
          setAwayScore('');
          setScheduledAt('');
          setVenue('');
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  if (teams.length < 2) {
    return (
      <Card className="text-sm text-muted-foreground">
        Servono almeno 2 squadre iscritte per aggiungere una partita.
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Aggiungi partita</p>
        <p className="text-xs text-muted-foreground">
          Gestione manuale: crea la singola partita al momento. Il punteggio è facoltativo —
          se lo inserisci, la partita risulta subito conclusa e conta in classifica.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <FormField label="Casa" htmlFor="mm_home">
          <Select id="mm_home" value={home} onChange={(e) => setHome(e.target.value)}>
            <option value="">Squadra…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === away}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        <span className="pb-3 text-muted-foreground">vs</span>
        <FormField label="Ospite" htmlFor="mm_away">
          <Select id="mm_away" value={away} onChange={(e) => setAway(e.target.value)}>
            <option value="">Squadra…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === home}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <FormField label="Gol casa" htmlFor="mm_hs">
          <Input
            id="mm_hs"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="—"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
          />
        </FormField>
        <span className="pb-3 text-muted-foreground">-</span>
        <FormField label="Gol ospite" htmlFor="mm_as">
          <Input
            id="mm_as"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="—"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <FormField label="Giornata" htmlFor="mm_round">
          <Input
            id="mm_round"
            type="number"
            min={1}
            value={round}
            onChange={(e) => setRound(e.target.value)}
          />
        </FormField>
        <FormField label="Data/ora" htmlFor="mm_when">
          <Input
            id="mm_when"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </FormField>
        <FormField label="Campo" htmlFor="mm_venue">
          <Input
            id="mm_venue"
            placeholder="—"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </FormField>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button fullWidth loading={createMatch.isPending} disabled={!canSubmit} onClick={submit}>
        <Plus className="h-4 w-4" />
        Aggiungi partita
      </Button>
    </Card>
  );
}
