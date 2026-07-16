import { useMemo } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Badge } from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Match, MatchStatus, Team } from '@/types';

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
  teamsById: Map<string, Team>;
}

interface Section {
  key: string;
  label: string;
  matches: Match[];
}

/** Elenco partite raggruppate per giornata / turno, con punteggi e stato live. */
export function ScheduleList({ matches, teamsById }: ScheduleListProps) {
  const groupLabels = useMemo(() => buildGroupLabels(matches), [matches]);
  const sections = useMemo(() => buildSections(matches), [matches]);

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
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchRow({
  match,
  teamsById,
  groupLabels,
}: {
  match: Match;
  teamsById: Map<string, Team>;
  groupLabels: Map<string, string>;
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
        <span className="truncate">{formatDateTime(match.scheduled_at)}</span>
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
        <span
          className={cn(
            'truncate text-right text-sm',
            homeWin ? 'font-bold text-foreground' : 'text-foreground',
          )}
        >
          {homeName}
        </span>
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
        <span
          className={cn(
            'truncate text-left text-sm',
            awayWin ? 'font-bold text-foreground' : 'text-foreground',
          )}
        >
          {awayName}
        </span>
      </div>
      {match.venue && (
        <div className="mt-2 text-center text-xs text-muted-foreground">{match.venue}</div>
      )}
    </div>
  );
}

function teamName(id: string | null, teamsById: Map<string, Team>): string {
  if (!id) return 'Da definire';
  return teamsById.get(id)?.name ?? 'Squadra';
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Data da definire';
  try {
    return format(new Date(iso), "EEE d MMM · HH:mm", { locale: it });
  } catch {
    return 'Data da definire';
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
  const sorted = [...matches].sort((a, b) => {
    const sa = STAGE_ORDER[a.stage] ?? 9;
    const sb = STAGE_ORDER[b.stage] ?? 9;
    if (sa !== sb) return sa - sb;
    const ra = a.round ?? 0;
    const rb = b.round ?? 0;
    if (ra !== rb) return ra - rb;
    const pa = a.bracket_position ?? 0;
    const pb = b.bracket_position ?? 0;
    if (pa !== pb) return pa - pb;
    return (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '');
  });

  const sections: Section[] = [];
  let current: Section | null = null;
  for (const m of sorted) {
    const { key, label } = sectionMeta(m);
    if (!current || current.key !== key) {
      current = { key, label, matches: [] };
      sections.push(current);
    }
    current.matches.push(m);
  }
  return sections;
}

function sectionMeta(m: Match): { key: string; label: string } {
  if (m.stage === 'knockout') {
    return {
      key: `ko-${m.round ?? 0}`,
      label: m.round_name || `Turno ${m.round ?? ''}`.trim(),
    };
  }
  if (m.round != null) {
    return { key: `${m.stage}-r${m.round}`, label: `Giornata ${m.round}` };
  }
  return { key: `${m.stage}-none`, label: 'Partite' };
}
