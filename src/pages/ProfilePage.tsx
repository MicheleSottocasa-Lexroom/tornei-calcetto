import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, LogOut } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { useMyTeams, useUpdateProfile } from '@/features/teams/hooks';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ProfilePage() {
  const { user, isAdmin, signOut } = useSession();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: myTeams, isLoading: teamsLoading } = useMyTeams();

  const [name, setName] = useState('');
  useEffect(() => {
    setName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  const trimmed = name.trim();
  const dirty = trimmed !== (profile?.full_name ?? '').trim();

  const onSave = async () => {
    try {
      await updateProfile.mutateAsync({ full_name: trimmed || null });
    } catch {
      // Errore mostrato tramite updateProfile.error.
    }
  };

  const displayName = profile?.full_name ?? user?.email ?? '—';

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Profilo</h1>

      {/* Intestazione account */}
      <Card className="flex items-center gap-3">
        <Avatar src={profile?.avatar_url} name={displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-foreground">{displayName}</p>
            {isAdmin && <Badge tone="primary">Amministratore</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </Card>

      {/* Modifica nome */}
      <Card>
        <CardHeader>
          <CardTitle>I tuoi dati</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <FormField label="Nome visualizzato" htmlFor="profile-name">
            <Input
              id="profile-name"
              value={name}
              placeholder="Il tuo nome"
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          {updateProfile.isError && (
            <p className="text-sm text-destructive">
              Impossibile salvare le modifiche. Riprova.
            </p>
          )}
          {updateProfile.isSuccess && !dirty && (
            <p className="text-sm text-primary">Profilo aggiornato.</p>
          )}
          <Button
            onClick={() => void onSave()}
            disabled={!dirty}
            loading={updateProfile.isPending}
          >
            Salva
          </Button>
        </div>
      </Card>

      {/* Le mie squadre */}
      <Card>
        <CardHeader>
          <CardTitle>Le mie squadre</CardTitle>
        </CardHeader>
        {teamsLoading ? (
          <Spinner size="sm" label="Caricamento…" />
        ) : !myTeams || myTeams.length === 0 ? (
          <EmptyState
            title="Nessuna squadra"
            description="Non fai ancora parte di nessuna squadra."
          />
        ) : (
          <ul className="space-y-2">
            {myTeams.map((entry) => {
              const inner = (
                <>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {entry.team.name}
                    </p>
                    {entry.tournament && (
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.tournament.name}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      tone={entry.membership.role === 'captain' ? 'primary' : 'default'}
                    >
                      {entry.membership.role === 'captain' ? 'Capitano' : 'Giocatore'}
                    </Badge>
                    {entry.tournament && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </>
              );

              return (
                <li key={entry.membership.id}>
                  {entry.tournament ? (
                    <Link
                      to={`/tornei/${entry.tournament.id}/squadre`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-accent/60"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Collegamenti utili */}
      <Card padded={false}>
        <Link
          to="/impostazioni/notifiche"
          className="flex items-center justify-between gap-3 p-4 hover:bg-accent/60"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Bell className="h-4 w-4 text-primary" />
            Impostazioni notifiche
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </Card>

      <Button
        variant="secondary"
        fullWidth
        onClick={() => void signOut()}
        className="gap-2"
      >
        <LogOut className="h-4 w-4" />
        Esci
      </Button>
    </section>
  );
}
