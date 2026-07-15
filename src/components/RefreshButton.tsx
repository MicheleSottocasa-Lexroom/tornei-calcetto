import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { cn } from '@/lib/cn';

interface RefreshButtonProps {
  /** Chiavi query da invalidare (match parziale: ['tournament', id] aggiorna anche le sotto-query). */
  queryKeys: QueryKey[];
  label?: string;
  className?: string;
}

/** Pulsante "Aggiorna": invalida le query indicate e mostra lo spin durante il refetch. */
export function RefreshButton({ queryKeys, label = 'Aggiorna', className }: RefreshButtonProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await Promise.all(
        queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-60',
        className,
      )}
    >
      <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
