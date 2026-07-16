/**
 * Mostra le partite generate raggruppate per fase/turno e consente di impostare
 * data/ora e campo di ciascuna partita.
 */
import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import type { Match, Team } from '@/types';
import { MATCH_STAGE_LABELS, MATCH_STATUS_LABELS } from './labels';
import { useUpdateMatchSchedule } from './hooks';

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function statusTone(status: Match['status']) {
  switch (status) {
    case 'live':
      return 'live' as const;
    case 'finished':
      return 'success' as const;
    case 'walkover':
      return 'warning' as const;
    case 'cancelled':
      return 'danger' as const;
    default:
      return 'default' as const;
  }
}

interface MatchRowProps {
  match: Match;
  tournamentId: string;
  teamName: (id: string | null) => string;
}

function MatchRow({ match, tournamentId, teamName }: MatchRowProps) {
  const updateSchedule = useUpdateMatchSchedule();
  const [scheduled, setScheduled] = useState(toDatetimeLocal(match.scheduled_at));
  const [venue, setVenue] = useState(match.venue ?? '');

  const dirty =
    scheduled !== toDatetimeLocal(match.scheduled_at) || venue !== (match.venue ?? '');

  const save = () => {
    updateSchedule.mutate({
      tournamentId,
      matchId: match.id,
      scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
      venue: venue.trim() ? venue.trim() : null,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {teamName(match.home_team_id)}{' '}
            <span className="text-muted-foreground">vs</span>{' '}
            {teamName(match.away_team_id)}
          </p>
        </div>
        <Badge tone={statusTone(match.status)}>
          {MATCH_STATUS_LABELS[match.status]}
        </Badge>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
          aria-label="Data e ora"
        />
        <Input
          type="text"
          value={venue}
          placeholder="Campo / luogo"
          onChange={(e) => setVenue(e.target.value)}
          aria-label="Campo"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={save}
          disabled={!dirty}
          loading={updateSchedule.isPending}
        >
          Salva
        </Button>
      </div>
    </div>
  );
}

export interface MatchSchedulerProps {
  matches: Match[];
  teams: Team[];
  tournamentId: string;
  groupNames?: Record<string, string>;
}

export function MatchScheduler({
  matches,
  teams,
  tournamentId,
  groupNames,
}: MatchSchedulerProps) {
  const teamName = useMemo(() => {
    const map = new Map(teams.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? map.get(id) ?? 'Squadra' : 'Da definire');
  }, [teams]);

  const sections = useMemo(() => {
    const groups = new Map<string, { title: string; sub: string | null; items: Match[] }>();
    for (const m of matches) {
      const key = `${m.stage}|${m.group_id ?? ''}|${m.round ?? 0}`;
      if (!groups.has(key)) {
        let title: string;
        if (m.stage === 'knockout') {
          title = m.round_name ?? `Turno ${m.round ?? ''}`;
        } else {
          title = `Giornata ${m.round ?? ''}`;
        }
        const sub =
          m.group_id && groupNames?.[m.group_id]
            ? groupNames[m.group_id]
            : m.stage === 'group'
              ? 'Girone'
              : MATCH_STAGE_LABELS[m.stage];
        groups.set(key, { title, sub, items: [] });
      }
      groups.get(key)!.items.push(m);
    }
    return Array.from(groups.values());
  }, [matches, groupNames]);

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-10 w-10" />}
        title="Nessuna partita generata"
        description="Genera il calendario per vedere qui le partite."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <Card key={i} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-foreground">{section.title}</p>
            {section.sub && (
              <span className="text-xs text-muted-foreground">{section.sub}</span>
            )}
          </div>
          <div className="space-y-2">
            {section.items.map((m) => (
              <MatchRow
                key={`${m.id}:${m.scheduled_at ?? ''}:${m.venue ?? ''}`}
                match={m}
                tournamentId={tournamentId}
                teamName={teamName}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
