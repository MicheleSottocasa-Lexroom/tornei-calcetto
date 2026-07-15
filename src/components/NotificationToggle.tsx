import { useEffect, useState } from 'react';
import { Bell, BellOff, AlertTriangle } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { Card, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { getPushSubscription, subscribeToPush, unsubscribe } from '@/lib/push';

/**
 * Interruttore per attivare/disattivare le notifiche push.
 * La richiesta del permesso avviene solo al tap dell'utente (gesto richiesto dai browser).
 */
export function NotificationToggle() {
  const { user } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  useEffect(() => {
    let active = true;
    getPushSubscription()
      .then((sub) => {
        if (active) setEnabled(Boolean(sub));
      })
      .catch(() => {
        /* nessuna subscription: rimane disattivato */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleToggle() {
    if (busy || loading) return;
    setError(null);
    setBusy(true);
    try {
      if (enabled) {
        await unsubscribe();
        setEnabled(false);
      } else {
        if (!user) {
          throw new Error('Devi accedere per attivare le notifiche.');
        }
        await subscribeToPush(user.id);
        setEnabled(true);
        setPermission('granted');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita.');
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission);
      }
    } finally {
      setBusy(false);
    }
  }

  const denied = permission === 'denied';

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'rounded-lg p-2',
            enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">Notifiche push</p>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? 'Riceverai promemoria delle partite e i risultati.'
              : 'Attiva per ricevere promemoria e risultati in tempo reale.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Attiva o disattiva le notifiche push"
          onClick={() => void handleToggle()}
          disabled={busy || loading || denied}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-60',
            enabled ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full bg-white transition-transform',
              enabled ? 'translate-x-6' : 'translate-x-1',
            )}
          >
            {(busy || loading) && <Spinner size="sm" />}
          </span>
        </button>
      </div>

      {denied && (
        <p className="flex items-start gap-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Le notifiche sono bloccate. Sbloccale dalle impostazioni del browser per questo sito.
        </p>
      )}

      {error && !denied && (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </Card>
  );
}
