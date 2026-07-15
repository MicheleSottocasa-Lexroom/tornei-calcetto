import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import {
  useAddAdminByEmail,
  useAdminAllowlist,
  useProfiles,
  useRemoveAllowlist,
  useSetProfileAdmin,
} from '@/features/admin/hooks';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Profile } from '@/types';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function displayName(p: Profile): string {
  return p.full_name ?? p.email;
}

export default function AdminManagePage() {
  const { user } = useSession();
  const { data: profiles, isLoading } = useProfiles();
  const { data: allowlist } = useAdminAllowlist();
  const setAdmin = useSetProfileAdmin();
  const addByEmail = useAddAdminByEmail();
  const removeAllow = useRemoveAllowlist();

  const [newUserId, setNewUserId] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const admins = useMemo(() => (profiles ?? []).filter((p) => p.is_admin), [profiles]);
  const nonAdmins = useMemo(() => (profiles ?? []).filter((p) => !p.is_admin), [profiles]);
  const adminEmails = useMemo(
    () => new Set(admins.map((a) => a.email.toLowerCase())),
    [admins],
  );
  const pendingAllow = useMemo(
    () => (allowlist ?? []).filter((a) => !adminEmails.has(a.email.toLowerCase())),
    [allowlist, adminEmails],
  );

  const onError = (e: Error) => {
    setInfo(null);
    setError(e.message);
  };

  const promoteExisting = () => {
    const p = nonAdmins.find((x) => x.id === newUserId);
    if (!p) return;
    setError(null);
    setInfo(null);
    setAdmin.mutate(
      { profileId: p.id, email: p.email, value: true },
      {
        onSuccess: () => {
          setInfo(`${displayName(p)} è ora amministratore.`);
          setNewUserId('');
        },
        onError,
      },
    );
  };

  const demote = (p: Profile) => {
    setError(null);
    setInfo(null);
    setAdmin.mutate({ profileId: p.id, email: p.email, value: false }, { onError });
  };

  const addEmail = () => {
    const em = email.trim().toLowerCase();
    setError(null);
    setInfo(null);
    if (!EMAIL_RE.test(em)) {
      setError('Inserisci un indirizzo email valido.');
      return;
    }
    addByEmail.mutate(
      { email: em },
      {
        onSuccess: (r) => {
          setInfo(
            r.promoted
              ? 'Utente già registrato: promosso ad amministratore.'
              : 'Email pre-autorizzata: diventerà admin al primo accesso.',
          );
          setEmail('');
        },
        onError,
      },
    );
  };

  return (
    <section className="space-y-4">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard admin
      </Link>

      <h1 className="text-xl font-bold text-foreground">Amministratori</h1>

      {error && <Card className="text-sm text-destructive">{error}</Card>}
      {info && <Card className="text-sm text-primary">{info}</Card>}

      {/* Elenco admin attuali */}
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Amministratori attuali</p>
        {isLoading ? (
          <Spinner size="sm" label="Caricamento…" />
        ) : admins.length === 0 ? (
          <EmptyState title="Nessun amministratore" />
        ) : (
          <ul className="space-y-2">
            {admins.map((p) => {
              const isSelf = p.id === user?.id;
              const lastOne = admins.length <= 1;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                >
                  <Avatar src={p.avatar_url} name={displayName(p)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {displayName(p)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSelf || lastOne || setAdmin.isPending}
                    title={
                      isSelf
                        ? 'Non puoi rimuovere te stesso'
                        : lastOne
                          ? 'Deve restare almeno un amministratore'
                          : 'Rimuovi amministratore'
                    }
                    onClick={() => demote(p)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Rimuovi
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Aggiungi admin */}
      <Card className="space-y-4">
        <p className="text-sm font-semibold text-foreground">Aggiungi amministratore</p>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Utente già registrato
          </label>
          <div className="flex gap-2">
            <Select value={newUserId} onChange={(e) => setNewUserId(e.target.value)}>
              <option value="">Seleziona utente…</option>
              {nonAdmins.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)} · {p.email}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              disabled={!newUserId || setAdmin.isPending}
              onClick={promoteExisting}
            >
              <UserPlus className="h-4 w-4" />
              Rendi admin
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <label className="text-xs font-medium text-muted-foreground">
            Pre-autorizza via email
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="nome.cognome@lexroom.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              variant="secondary"
              loading={addByEmail.isPending}
              onClick={addEmail}
            >
              <Mail className="h-4 w-4" />
              Aggiungi
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Se la persona non ha ancora effettuato l&apos;accesso, diventerà admin al primo
            login. Se è già registrata, viene promossa subito.
          </p>
        </div>
      </Card>

      {/* Pre-autorizzazioni in attesa */}
      {pendingAllow.length > 0 && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Pre-autorizzazioni in attesa
          </p>
          <ul className="space-y-2">
            {pendingAllow.map((a) => (
              <li
                key={a.email}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {a.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removeAllow.isPending}
                  onClick={() => removeAllow.mutate({ email: a.email }, { onError })}
                >
                  <Trash2 className="h-4 w-4" />
                  Rimuovi
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
