import { Check, Monitor, Moon, Sun } from 'lucide-react';
import {
  COLOR_THEMES,
  useTheme,
  type ColorThemeId,
  type ResolvedTheme,
  type ThemeMode,
} from '@/hooks/useTheme';
import { cn } from '@/lib/cn';

const MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

function ColorSwatches({
  preview,
  value,
  onChange,
  label,
}: {
  preview: ResolvedTheme;
  value: ColorThemeId;
  onChange: (id: ColorThemeId) => void;
  label: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {COLOR_THEMES.map((theme) => {
          const active = value === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={active}
              aria-label={theme.name}
              title={theme.name}
              onClick={() => onChange(theme.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors',
                active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/60',
              )}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: preview === 'dark' ? theme.dark : theme.light }}
              >
                {active && <Check className="h-4 w-4 text-white" />}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">{theme.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Controllo completo: modalità + tema colore per chiaro e per scuro. */
export function ThemeSelector({ className }: { className?: string }) {
  const { mode, setMode, lightTheme, setLightTheme, darkTheme, setDarkTheme } = useTheme();

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Modalità</p>
        <div role="radiogroup" aria-label="Modalità tema" className="grid grid-cols-3 gap-2">
          {MODES.map(({ value, label, icon: Icon }) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <ColorSwatches
        preview="light"
        value={lightTheme}
        onChange={setLightTheme}
        label="Colore in modalità chiara"
      />
      <ColorSwatches
        preview="dark"
        value={darkTheme}
        onChange={setDarkTheme}
        label="Colore in modalità scura"
      />
    </div>
  );
}

/** Toggle compatto per l'header: cicla Chiaro -> Scuro -> Sistema. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const currentIndex = MODES.findIndex((o) => o.value === mode);
  const current = MODES[currentIndex] ?? MODES[2];
  const Icon = current.icon;

  const cycle = () => {
    const next = MODES[(currentIndex + 1) % MODES.length] ?? MODES[0];
    setMode(next.value);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Tema: ${current.label}. Tocca per cambiare.`}
      title={`Tema: ${current.label}`}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
