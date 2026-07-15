import { Share, Plus, Smartphone } from 'lucide-react';
import { Card } from '@/components/ui';

/**
 * Istruzioni per installare la PWA su iOS/iPadOS (nessun prompt automatico
 * disponibile in Safari). L'installazione in schermata Home e' obbligatoria
 * per poter ricevere le notifiche push su iPhone/iPad.
 */
export function InstallPrompt() {
  const steps = [
    {
      icon: <Share className="h-5 w-5" />,
      text: (
        <>
          Tocca il pulsante <strong className="text-surface-100">Condividi</strong> nella barra
          di Safari.
        </>
      ),
    },
    {
      icon: <Plus className="h-5 w-5" />,
      text: (
        <>
          Scegli <strong className="text-surface-100">Aggiungi a schermata Home</strong> e
          conferma.
        </>
      ),
    },
    {
      icon: <Smartphone className="h-5 w-5" />,
      text: (
        <>
          Apri l&apos;app dall&apos;icona in schermata Home e torna qui per attivare le
          notifiche.
        </>
      ),
    },
  ];

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-primary-600/15 p-2 text-primary-400">
          <Smartphone className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-semibold text-surface-100">Installa l&apos;app</h2>
          <p className="text-sm text-surface-400">
            Su iPhone e iPad le notifiche funzionano solo dopo aver aggiunto Tornei Calcetto
            alla schermata Home.
          </p>
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-700 text-sm font-semibold text-surface-100">
              {index + 1}
            </span>
            <span className="text-primary-400">{step.icon}</span>
            <span className="text-sm text-surface-300">{step.text}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
