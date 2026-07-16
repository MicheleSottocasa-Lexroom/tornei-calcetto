import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Badge, Modal } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Match, MatchStatus, TeamParticipant, TeamWithMembers } from '@/types';
import { TeamRoster } from './TeamRoster';

const GROUP_LETTERS = 'ABCDEFGH';

const STAGE_ORDER: Record<string, number> = {
  league: 0,
  round_robin: 0,
  group: 1,
  knockout: 2,
};

type Tone = NonNullable<BadgeProps['tone']>;

const STATUS_META: Record<MatchStatus, { label: string; tone: Tone }> = {
  scheduled: { label: 'In programma', tone: 'default' },
  live: { label: 'LIVE', tone: 'live' },
  finished: { label: 'Finita', tone: 'success' },
  walkover: { label: 'A tavolino', tone: 'warning' },
  cancelled: { label: 'Annullata', tone: 'danger' },
};

export interface ScheduleListProps {
  matches: Match[];
  teamsById: Map<string, TeamWithMembers>;
  /** Partecipanti (nomi liberi) per squadra: se presenti, sono la rosa mostrata. */
  participantsByTeam?: Map<string, TeamParticipant[]>;
}

interface Section {
  key: string;
  label: string;
  matches: Match[];
}

/** Elenco partite raggruppate per giornata / turno, con punteggi e stato live. */
export function ScheduleList({
  matches,
  teamsById,
  participantsByTeam,
}: ScheduleListProps) {
  const groupLabels = useMemo(() => buildGroupLabels(matches), [matches]);
  const sections = useMemo(() => buildSections(matches), [matches]);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  const openTeam = openTeamId ? teamsById.get(openTeamId) ?? null : null;

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.key} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{section.label}</h3>
          <div className="space-y-2">
            {section.matches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                teamsById={teamsById}
                groupLabels={groupLabels}
                onTeamClick={setOpenTeamId}
              />
            ))}
          </div>
        </div>
      ))}

      {openTeam && (
        <Modal open onClose={() => setOpenTeamId(null)} title={openTeam.name}>
          <TeamRoster
            team={openTeam}
            participants={participantsByTeam?.get(openTeam.id)}
          />
        </Modal>
      )}
    </div>
  );
}

function MatchRow({
  match,
  teamsById,
  groupLabels,
  onTeamClick,
}: {
  match: Match;
  teamsById: Map<string, TeamWithMembers>;
  groupLabels: Map<string, string>;
  onTeamClick: (teamId: string) => void;
}) {
  const meta = STATUS_META[match.status];
  const homeName = teamName(match.home_team_id, teamsById);
  const awayName = teamName(match.away_team_id, teamsById);
  const hasScore = match.home_score != null && match.away_score != null;
  const showScore =
    match.status === 'live' ||
    ((match.status === 'finished' || match.status === 'walkover') && hasScore);
  const homeWin = !!match.winner_team_id && match.winner_team_id === match.home_team_id;
  const awayWin = !!match.winner_team_id && match.winner_team_id === match.away_team_id;
  const groupLabel = match.group_id ? groupLabels.get(match.group_id) : null;
  const hasPens =
    match.home_penalties != null && match.away_penalties != null;

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{formatTime(match.scheduled_at)}</span>
        <div className="flex shrink-0 items-center gap-2">
          {groupLabel && <span className="text-muted-foreground">{groupLabel}</span>}
          <Badge tone={meta.tone}>
            {match.status === 'live' && (
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            )}
            {meta.label}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamName
          id={match.home_team_id}
          name={homeName}
          win={homeWin}
          align="right"
          onTeamClick={onTeamClick}
        />
        <div className="flex flex-col items-center">
          {showScore ? (
            <span className="whitespace-nowrap text-base font-bold text-foreground">
              {match.home_score ?? 0}
              <span className="mx-1 text-muted-foreground">-</span>
              {match.away_score ?? 0}
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">vs</span>
          )}
          {hasPens && (
            <span className="text-[10px] text-muted-foreground">
              rig. {match.home_penalties}-{match.away_penalties}
            </span>
          )}
        </div>
        <TeamName
          id={match.away_team_id}
          name={awayName}
          win={awayWin}
          align="left"
          onTeamClick={onTeamClick}
        />
      </div>
      {match.venue && (
        <div className="mt-2 text-center text-xs text-muted-foreground">{match.venue}</div>
      )}
    </div>
  );
}

/** Nome squadra: cliccabile (apre la rosa) quando l'id è definito. */
function TeamName({
  id,
  name,
  win,
  align,
  onTeamClick,
}: {
  id: string | null;
  name: string;
  win: boolean;
  align: 'left' | 'right';
  onTeamClick: (teamId: string) => void;
}) {
  const base = cn(
    'min-w-0 truncate text-sm',
    align === 'right' ? 'text-right' : 'text-left',
    win ? 'font-bold text-foreground' : 'text-foreground',
  );
  if (!id) {
    return <span className={cn(base, 'text-muted-foreground')}>{name}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onTeamClick(id)}
      className={cn(base, 'hover:underline focus:underline focus:outline-none')}
    >
      {name}
    </button>
  );
}

function teamName(id: string | null, teamsById: Map<string, TeamWithMembers>): string {
  if (!id) return 'Da definire';
  return teamsById.get(id)?.name ?? 'Squadra';
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Orario da definire';
  try {
    return format(new Date(iso), 'HH:mm');
  } catch {
    return 'Orario da definire';
  }
}

function buildGroupLabels(matches: Match[]): Map<string, string> {
  const ids = Array.from(
    new Set(
      matches.map((m) => m.group_id).filter((x): x is string => x != null),
    ),
  ).sort();
  const map = new Map<string, string>();
  ids.forEach((id, i) => map.set(id, `Girone ${GROUP_LETTERS[i] ?? i + 1}`));
  return map;
}

function buildSections(matches: Match[]): Section[] {
  // Ordine cronologico (le partite senza data in fondo), poi raggruppa per giorno reale.
  const sorted = [...matches].sort((a, b) => {
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
    if (ta !== tb) return ta - tb;
    const sa = STAGE_ORDER[a.stage] ?? 9;
    const sb = STAGE_ORDER[b.stage] ?? 9;
    if (sa !== sb) return sa - sb;
    const ra = a.round ?? 0;
    const rb = b.round ?? 0;
    if (ra !== rb) return ra - rb;
    return (a.bracket_position ?? 0) - (b.bracket_position ?? 0);
  });

  const sections: Section[] = [];
  let current: Section | null = null;
  for (const m of sorted) {
    const key = dayKey(m.scheduled_at);
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(m.scheduled_at), matches: [] };
      sections.push(current);
    }
    current.matches.push(m);
  }
  return sections;
}

/** Chiave giorno (locale) per il raggruppamento; le partite senza data in fondo. */
function dayKey(iso: string | null): string {
  if (!iso) return '__none__';
  try {
    return format(new Date(iso), 'yyyy-MM-dd');
  } catch {
    return '__none__';
  }
}

/** Etichetta del giorno, es. "Lunedì 20 luglio". */
function dayLabel(iso: string | null): string {
  if (!iso) return 'Data da definire';
  try {
    const s = format(new Date(iso), 'EEEE d MMMM', { locale: it });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return 'Data da definire';
  }
}
