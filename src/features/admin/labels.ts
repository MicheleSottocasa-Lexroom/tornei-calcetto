/** Etichette e helper condivisi tra le pagine admin. */
import type { MatchEventType, MatchStage, MatchStatus } from '@/types';

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'In programma',
  live: 'In corso',
  finished: 'Conclusa',
  walkover: 'A tavolino',
  cancelled: 'Annullata',
};

export const MATCH_STAGE_LABELS: Record<MatchStage, string> = {
  round_robin: 'Girone all’italiana',
  group: 'Gironi',
  knockout: 'Eliminazione diretta',
  league: 'Campionato',
};

export const EVENT_TYPE_LABELS: Record<MatchEventType, string> = {
  goal: 'Gol',
  penalty_goal: 'Rigore',
  own_goal: 'Autogol',
  assist: 'Assist',
  yellow_card: 'Ammonizione',
  red_card: 'Espulsione',
  mvp: 'MVP',
};

/** Ordine di visualizzazione degli eventi nel form. */
export const EVENT_TYPES: MatchEventType[] = [
  'goal',
  'penalty_goal',
  'own_goal',
  'assist',
  'yellow_card',
  'red_card',
  'mvp',
];
