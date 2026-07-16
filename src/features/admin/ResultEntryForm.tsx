/**
 * Form di inserimento risultato di una partita: punteggio, rigori, stato e
 * gestione degli eventi (gol/rigore/autogol/assist/cartellini/mvp).
 * Gli eventi vengono raccolti in locale e sincronizzati al salvataggio.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import type {
  Match,
  MatchEvent,
  MatchEventType,
  MatchStatus,
  TeamWithMembers,
} from '@/types';
import type { MatchEventDraft } from './hooks';
import { EVENT_TYPE_LABELS, EVENT_TYPES } from './labels';

const STATUS_OPTIONS: { value: MatchStatus; label: string }[] = [
  { value: 'scheduled', label: 'In programma' },
  { value: 'live', label: 'In corso' },
  { value: 'finished', label: 'Conclusa' },
  { value: 'walkover', label: 'Mancata presentazione' },
  { value: 'cancelled', label: 'Annullata' },
];

export interface SaveResultPayload {
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  home_no_show: boolean;
  away_no_show: boolean;
  events: MatchEventDraft[];
}

export interface ResultEntryFormProps {
  match: Match;
  homeTeam: TeamWithMembers | null;
  awayTeam: TeamWithMembers | null;
  existingEvents: MatchEvent[];
  saving?: boolean;
  onSave: (payload: SaveResultPayload) => void;
}

function memberName(m: TeamWithMembers['members'][number]): string {
  return m.profile?.full_name ?? m.profile?.email ?? 'Giocatore';
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ResultEntryForm({
  match,
  homeTeam,
  awayTeam,
  existingEvents,
  saving = false,
  onSave,
}: ResultEntryFormProps) {
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [homeNoShow, setHomeNoShow] = useState(match.home_no_show);
  const [awayNoShow, setAwayNoShow] = useState(match.away_no_show);
  const [homeScore, setHomeScore] = useState(
    match.home_score != null ? String(match.home_score) : '',
  );
  const [awayScore, setAwayScore] = useState(
    match.away_score != null ? String(match.away_score) : '',
  );
  const [homePen, setHomePen] = useState(
    match.home_penalties != null ? String(match.home_penalties) : '',
  );
  const [awayPen, setAwayPen] = useState(
    match.away_penalties != null ? String(match.away_penalties) : '',
  );

  const [events, setEvents] = useState<MatchEventDraft[]>(() =>
    existingEvents.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      team_id: e.team_id,
      player_id: e.player_id,
      assist_player_id: e.assist_player_id,
      minute: e.minute,
    })),
  );

  // Stato del sotto-form "aggiungi evento"
  const [newType, setNewType] = useState<MatchEventType>('goal');
  const [newSide, setNewSide] = useState<'home' | 'away'>('home');
  const [newPlayer, setNewPlayer] = useState('');
  const [newAssist, setNewAssist] = useState('');
  const [newMinute, setNewMinute] = useState('');
  const [eventError, setEventError] = useState<string | null>(null);

  // Mappa id giocatore -> nome (entrambe le rose) per la lista eventi
  const playerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of [homeTeam, awayTeam]) {
      for (const m of t?.members ?? []) {
        if (m.profile_id) map.set(m.profile_id, memberName(m));
      }
    }
    return map;
  }, [homeTeam, awayTeam]);

  const teamNameById = (id: string | null): string => {
    if (!id) return '—';
    if (id === homeTeam?.id) return homeTeam?.name ?? 'Casa';
    if (id === awayTeam?.id) return awayTeam?.name ?? 'Ospite';
    return 'Squadra';
  };

  const bothTeamsKnown = !!homeTeam && !!awayTeam;
  const scored = status === 'scheduled' || status === 'live' || status === 'finished';
  const isWalkover = status === 'walkover';
  const isCancelled = status === 'cancelled';
  const noShowValid = !isWalkover || homeNoShow || awayNoShow;
  const isOwnGoal = newType === 'own_goal';
  const showAssist = newType === 'goal' || newType === 'penalty_goal';

  // Squadra accreditata (team_id) e squadra da cui pescare il giocatore.
  const creditedTeam = newSide === 'home' ? homeTeam : awayTeam;
  // Per l'autogol il giocatore appartiene alla squadra avversaria.
  const scorerTeam = isOwnGoal
    ? newSide === 'home'
      ? awayTeam
      : homeTeam
    : creditedTeam;
  const scorerRoster = scorerTeam?.members ?? [];
  const assistRoster = creditedTeam?.members ?? [];

  const addEvent = () => {
    setEventError(null);
    if (!bothTeamsKnown) {
      setEventError('Le due squadre non sono ancora definite.');
      return;
    }
    if (!newPlayer) {
      setEventError('Seleziona un giocatore.');
      return;
    }
    const draft: MatchEventDraft = {
      event_type: newType,
      team_id: creditedTeam?.id ?? null,
      player_id: newPlayer,
      assist_player_id: showAssist && newAssist ? newAssist : null,
      minute: numOrNull(newMinute),
    };
    setEvents((prev) => [...prev, draft]);
    setNewPlayer('');
    setNewAssist('');
    setNewMinute('');
  };

  const removeEvent = (index: number) => {
    setEvents((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = () => {
    onSave({
      status,
      home_score: scored ? numOrNull(homeScore) : null,
      away_score: scored ? numOrNull(awayScore) : null,
      home_penalties: scored ? numOrNull(homePen) : null,
      away_penalties: scored ? numOrNull(awayPen) : null,
      home_no_show: isWalkover ? homeNoShow : false,
      away_no_show: isWalkover ? awayNoShow : false,
      events: scored ? events : [],
    });
  };

  return (
    <div className="space-y-4">
      {/* Stato ed esito */}
      <Card className="space-y-3">
        <FormField label="Stato" htmlFor="status">
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MatchStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>

        {scored && (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <FormField label={homeTeam?.name ?? 'Casa'} htmlFor="home_score">
                <Input
                  id="home_score"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                />
              </FormField>
              <span className="pb-3 text-muted-foreground">-</span>
              <FormField label={awayTeam?.name ?? 'Ospite'} htmlFor="away_score">
                <Input
                  id="away_score"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <FormField label="Rigori casa" htmlFor="home_pen">
                <Input
                  id="home_pen"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="—"
                  value={homePen}
                  onChange={(e) => setHomePen(e.target.value)}
                />
              </FormField>
              <span className="pb-3 text-muted-foreground">-</span>
              <FormField label="Rigori ospite" htmlFor="away_pen">
                <Input
                  id="away_pen"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="—"
                  value={awayPen}
                  onChange={(e) => setAwayPen(e.target.value)}
                />
              </FormField>
            </div>
          </>
        )}

        {isWalkover && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Chi non si è presentato?</p>
            <label htmlFor="home_no_show" className="flex cursor-pointer items-center gap-2.5">
              <input
                id="home_no_show"
                type="checkbox"
                checked={homeNoShow}
                onChange={(e) => setHomeNoShow(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-sm text-foreground">{homeTeam?.name ?? 'Casa'}</span>
            </label>
            <label htmlFor="away_no_show" className="flex cursor-pointer items-center gap-2.5">
              <input
                id="away_no_show"
                type="checkbox"
                checked={awayNoShow}
                onChange={(e) => setAwayNoShow(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-sm text-foreground">{awayTeam?.name ?? 'Ospite'}</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Se manca una sola squadra, vince l’altra a tavolino. Chi non si presenta
              perde 2 punti in classifica; se mancano entrambe, -2 a entrambe.
            </p>
            {!noShowValid && (
              <p className="text-xs text-destructive">
                Seleziona almeno una squadra assente.
              </p>
            )}
          </div>
        )}

        {isCancelled && (
          <p className="text-xs text-muted-foreground">
            La partita è annullata: non viene conteggiata in classifica.
          </p>
        )}
      </Card>

      {/* Eventi (solo per partite giocate) */}
      {scored && (
      <Card className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Eventi partita</p>
          <p className="text-xs text-muted-foreground">
            Facoltativi: puoi salvare anche solo il punteggio finale, senza indicare
            chi e quando ha segnato.
          </p>
        </div>

        {events.length === 0 ? (
          <EmptyState
            title="Nessun evento"
            description="Aggiungi gol, cartellini o l’MVP della partita."
          />
        ) : (
          <ul className="space-y-2">
            {events.map((ev, i) => (
              <li
                key={ev.id ?? `new-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-medium">
                      {EVENT_TYPE_LABELS[ev.event_type]}
                    </span>{' '}
                    — {ev.player_id ? (playerNames.get(ev.player_id) ?? 'Giocatore') : '—'}
                    {ev.minute != null && (
                      <span className="text-muted-foreground"> · {ev.minute}'</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {teamNameById(ev.team_id)}
                    {ev.assist_player_id &&
                      ` · assist ${playerNames.get(ev.assist_player_id) ?? ''}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeEvent(i)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  aria-label="Rimuovi evento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Sotto-form aggiungi evento */}
        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Tipo" htmlFor="ev_type">
              <Select
                id="ev_type"
                value={newType}
                onChange={(e) => {
                  setNewType(e.target.value as MatchEventType);
                  setNewPlayer('');
                  setNewAssist('');
                }}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label={isOwnGoal ? 'Squadra che beneficia' : 'Squadra'}
              htmlFor="ev_side"
            >
              <Select
                id="ev_side"
                value={newSide}
                onChange={(e) => {
                  setNewSide(e.target.value as 'home' | 'away');
                  setNewPlayer('');
                  setNewAssist('');
                }}
              >
                <option value="home">{homeTeam?.name ?? 'Casa'}</option>
                <option value="away">{awayTeam?.name ?? 'Ospite'}</option>
              </Select>
            </FormField>
          </div>

          <FormField
            label={isOwnGoal ? 'Giocatore (autore autogol)' : 'Giocatore'}
            htmlFor="ev_player"
            hint={
              scorerRoster.length === 0
                ? 'Rosa vuota: aggiungi giocatori dalla pagina Squadre.'
                : undefined
            }
          >
            <Select
              id="ev_player"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
            >
              <option value="">Seleziona…</option>
              {scorerRoster.map((m) => (
                <option key={m.id} value={m.profile_id}>
                  {memberName(m)}
                </option>
              ))}
            </Select>
          </FormField>

          {showAssist && (
            <FormField label="Assist (facoltativo)" htmlFor="ev_assist">
              <Select
                id="ev_assist"
                value={newAssist}
                onChange={(e) => setNewAssist(e.target.value)}
              >
                <option value="">Nessuno</option>
                {assistRoster.map((m) => (
                  <option key={m.id} value={m.profile_id}>
                    {memberName(m)}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label="Minuto (facoltativo)" htmlFor="ev_minute">
            <Input
              id="ev_minute"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="—"
              value={newMinute}
              onChange={(e) => setNewMinute(e.target.value)}
            />
          </FormField>

          {eventError && <p className="text-xs text-destructive">{eventError}</p>}

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={addEvent}
            disabled={!bothTeamsKnown}
          >
            <Plus className="h-4 w-4" />
            Aggiungi evento
          </Button>
        </div>
      </Card>
      )}

      <Button
        type="button"
        fullWidth
        loading={saving}
        disabled={!noShowValid}
        onClick={submit}
      >
        Salva risultato
      </Button>
    </div>
  );
}
