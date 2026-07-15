import { BellRing } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { InstallPrompt } from '@/components/InstallPrompt';
import { NotificationToggle } from '@/components/NotificationToggle';
import { canUsePush, isIos, isStandalone } from '@/lib/platform';

export default function NotificationsSettingsPage() {
  // Su iOS le push richiedono la PWA installata: se non lo e', mostriamo le istruzioni.
  const iosNotInstalled = isIos() && !isStandalone();
  const supported = canUsePush();

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Notifiche</h1>
        <p className="text-sm text-muted-foreground">
          Ricevi i promemoria delle partite e i risultati in tempo reale.
        </p>
      </header>

      {iosNotInstalled ? (
        <InstallPrompt />
      ) : !supported ? (
        <EmptyState
          icon={<BellRing className="h-10 w-10" />}
          title="Notifiche non disponibili"
          description="Questo browser non supporta le notifiche push. Prova con un browser aggiornato oppure installa l'app in schermata Home."
        />
      ) : (
        <NotificationToggle />
      )}
    </section>
  );
}
