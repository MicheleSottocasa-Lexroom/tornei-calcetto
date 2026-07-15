import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useTeams, useTournaments } from '@/hooks/queries';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import type { Profile, TeamWithMembers } from '@/types';
import {
  useAddTeamMember,
  useCreateTeam,
  useProfiles,
  useRemoveTeamMember,
  useSetCaptain,
  useUpdateTeam,
} from '@/features/admin/hooks';

function profileName(p: Profile | null): string {
  return p?.full_name ?? p?.email ?? 'Giocatore';
}

interface TeamCardProps {
  tournamentId: string;
  team: TeamWithMembers;
  availableProfiles: Profile[];
  onError: (msg: string) => void;
}

function TeamCard({ tournamentId, team, availableProfiles, onError }: TeamCardProps) {
  const updateTeam = useUpdateTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const setCaptain = useSetCaptain();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [newProfile, setNewProfile] = useState('');
  const [newShirt, setNewShirt] = useState('');

  const withdrawn = team.status === 'withdrawn';
  const err = (e: Error) => onError(e.message);

  return (
    <Card className="space-y-3">
      {/* Intestazione squadra */}
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              aria-label="Salva nome"
              className="rounded-lg p-1.5 text-primary hover:bg-accent"
              onClick={() => {
                const trimmed = name.trim();
                if (!trimmed) return;
                updateTeam.mutate(
                  { tournamentId, teamId: team.id, name: trimmed },
                  { onSuccess: () => setEditing(false), onError: err },
                );
              }}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Annulla"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
              onClick={() => {
                setName(team.name);
                setEditing(false);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate font-semibold text-foreground">{team.name}</h3>
              {withdrawn && <Badge tone="danger">Ritirata</Badge>}
            </div>
            <button
              type="button"
              aria-label="Rinomina"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Rosa */}
      {team.members.length === 0 ? (
        <p className="text-xs text-muted-foreground">Rosa vuota.</p>
      ) : (
        <ul className="space-y-1.5">
          {team.members.map((m) => {
            const isCaptain = m.role === 'captain';
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2.5 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar
                    src={m.profile?.avatar_url}
                    name={profileName(m.profile)}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {profileName(m.profile)}
                      {m.shirt_number != null && (
                        <span className="text-muted-foreground"> · #{m.shirt_number}</span>
                      )}
                    </p>
                    {isCaptain && (
                      <span className="text-xs text-primary">Capitano</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!isCaptain && (
                    <button
                      type="button"
                      aria-label="Imposta capitano"
                      title="Imposta capitano"
                      className="rounded p-1.5 text-muted-foreground hover:text-primary"
                      onClick={() =>
                        setCaptain.mutate(
                          {
                            tournamentId,
                            teamId: team.id,
                            memberId: m.id,
                            profileId: m.profile_id,
                          },
                          { onError: err },
                        )
                      }
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Rimuovi giocatore"
                    className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      removeMember.mutate(
                        { tournamentId, memberId: m.id },
                        { onError: err },
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Aggiungi giocatore */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select value={newProfile} onChange={(e) => setNewProfile(e.target.value)}>
            <option value="">Aggiungi giocatore…</option>
            {availableProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {profileName(p)}
              </option>
            ))}
          </Select>
        </div>
        <Input
          type="number"
          min={0}
          className="w-20"
          placeholder="#"
          value={newShirt}
          onChange={(e) => setNewShirt(e.target.value)}
          aria-label="Numero maglia"
        />
        <Button
          variant="secondary"
          size="md"
          disabled={!newProfile}
          loading={addMember.isPending}
          onClick={() => {
            if (!newProfile) return;
            addMember.mutate(
              {
                tournamentId,
                teamId: team.id,
                profileId: newProfile,
                shirtNumber: newShirt.trim() ? Number(newShirt) : null,
              },
              {
                onSuccess: () => {
                  setNewProfile('');
                  setNewShirt('');
                },
                onError: err,
              },
            );
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Stato squadra */}
      <div className="flex justify-end">
        {withdrawn ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateTeam.mutate(
                { tournamentId, teamId: team.id, status: 'registered' },
                { onError: err },
              )
            }
          >
            Riattiva squadra
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (!window.confirm(`Ritirare ${team.name}?`)) return;
              updateTeam.mutate(
                { tournamentId, teamId: team.id, status: 'withdrawn' },
                { onError: err },
              );
            }}
          >
            Ritira squadra
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function AdminTeamsPage() {
  const { data: tournaments, isLoading: loadingTournaments } = useTournaments();
  const { data: profiles } = useProfiles();

  const [selectedId, setSelectedId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');

  const { data: teams, isLoading: loadingTeams } = useTeams(selectedId || undefined);
  const createTeam = useCreateTeam();

  // Un giocatore può stare in una sola squadra per torneo: escludi i già assegnati.
  const availableProfiles = useMemo(() => {
    const assigned = new Set<string>();
    for (const t of teams ?? []) for (const m of t.members) assigned.add(m.profile_id);
    return (profiles ?? []).filter((p) => !assigned.has(p.id));
  }, [teams, profiles]);

  return (
    <section className="space-y-4">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard admin
      </Link>

      <h1 className="text-xl font-bold text-foreground">Gestione squadre</h1>

      <FormField label="Torneo" htmlFor="tournament">
        <Select
          id="tournament"
          value={selectedId}
          disabled={loadingTournaments}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setError(null);
          }}
        >
          <option value="">Seleziona un torneo…</option>
          {(tournaments ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </FormField>

      {error && (
        <Card className="flex items-center justify-between gap-2 text-sm text-destructive">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Chiudi
          </button>
        </Card>
      )}

      {!selectedId ? (
        <EmptyState
          title="Seleziona un torneo"
          description="Scegli un torneo per gestirne squadre e giocatori."
        />
      ) : loadingTeams ? (
        <div className="py-8">
          <Spinner label="Caricamento squadre…" />
        </div>
      ) : (
        <>
          {/* Crea squadra */}
          <Card className="flex items-end gap-2">
            <div className="flex-1">
              <FormField label="Nuova squadra" htmlFor="new_team">
                <Input
                  id="new_team"
                  value={newTeamName}
                  placeholder="Nome squadra"
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </FormField>
            </div>
            <Button
              loading={createTeam.isPending}
              disabled={!newTeamName.trim()}
              onClick={() => {
                const name = newTeamName.trim();
                if (!name) return;
                setError(null);
                createTeam.mutate(
                  { tournamentId: selectedId, name },
                  {
                    onSuccess: () => setNewTeamName(''),
                    onError: (e) => setError(e.message),
                  },
                );
              }}
            >
              <Plus className="h-4 w-4" />
              Crea
            </Button>
          </Card>

          {(teams ?? []).length === 0 ? (
            <EmptyState
              title="Nessuna squadra"
              description="Crea la prima squadra di questo torneo."
            />
          ) : (
            <div className="space-y-3">
              {(teams ?? []).map((team) => (
                <TeamCard
                  key={team.id}
                  tournamentId={selectedId}
                  team={team}
                  availableProfiles={availableProfiles}
                  onError={setError}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
