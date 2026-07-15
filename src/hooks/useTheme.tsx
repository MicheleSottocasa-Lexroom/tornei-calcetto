import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type ColorThemeId = 'lexroom' | 'forest' | 'sunset' | 'ruby' | 'amethyst';

export interface ColorTheme {
  id: ColorThemeId;
  name: string;
  /** Colore primario di anteprima (swatch) nella variante chiara/scura. */
  light: string;
  dark: string;
}

/** Temi colore disponibili. Il default è "lexroom" (colori ufficiali aziendali). */
export const COLOR_THEMES: ColorTheme[] = [
  { id: 'lexroom', name: 'Lexroom', light: 'hsl(214 82% 34%)', dark: 'hsl(214 82% 48%)' },
  { id: 'forest', name: 'Foresta', light: 'hsl(142 72% 30%)', dark: 'hsl(142 60% 42%)' },
  { id: 'sunset', name: 'Tramonto', light: 'hsl(24 88% 46%)', dark: 'hsl(25 85% 52%)' },
  { id: 'ruby', name: 'Rubino', light: 'hsl(346 77% 45%)', dark: 'hsl(346 80% 58%)' },
  { id: 'amethyst', name: 'Ametista', light: 'hsl(265 60% 50%)', dark: 'hsl(265 68% 62%)' },
];

const MODE_KEY = 'theme';
const LIGHT_KEY = 'theme-light';
const DARK_KEY = 'theme-dark';
const DEFAULT_COLOR: ColorThemeId = 'lexroom';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  /** Tema colore scelto per la modalità chiara. */
  lightTheme: ColorThemeId;
  /** Tema colore scelto per la modalità scura. */
  darkTheme: ColorThemeId;
  setMode: (mode: ThemeMode) => void;
  setLightTheme: (id: ColorThemeId) => void;
  setDarkTheme: (id: ColorThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage non disponibile: default.
  }
  return 'system';
}

function readStoredColor(key: string): ColorThemeId {
  try {
    const v = localStorage.getItem(key);
    if (v && COLOR_THEMES.some((t) => t.id === v)) return v as ColorThemeId;
  } catch {
    // localStorage non disponibile: default.
  }
  return DEFAULT_COLOR;
}

/** Applica tema: classe .dark + attributi data-light/data-dark + barra browser. */
function applyTheme(resolved: ResolvedTheme, lightId: ColorThemeId, darkId: ColorThemeId): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.setAttribute('data-light', lightId);
  root.setAttribute('data-dark', darkId);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#ffffff');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [lightTheme, setLightThemeState] = useState<ColorThemeId>(() => readStoredColor(LIGHT_KEY));
  const [darkTheme, setDarkThemeState] = useState<ColorThemeId>(() => readStoredColor(DARK_KEY));
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    readStoredMode() === 'system' ? getSystemTheme() : (readStoredMode() as ResolvedTheme),
  );

  // Applica ad ogni cambio di modalità/tema e segue il sistema quando mode='system'.
  useEffect(() => {
    const apply = () => {
      const resolved = mode === 'system' ? getSystemTheme() : mode;
      setResolvedTheme(resolved);
      applyTheme(resolved, lightTheme, darkTheme);
    };
    apply();
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode, lightTheme, darkTheme]);

  const setMode = useCallback((next: ThemeMode) => {
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // ignora
    }
    setModeState(next);
  }, []);

  const setLightTheme = useCallback((id: ColorThemeId) => {
    try {
      localStorage.setItem(LIGHT_KEY, id);
    } catch {
      // ignora
    }
    setLightThemeState(id);
  }, []);

  const setDarkTheme = useCallback((id: ColorThemeId) => {
    try {
      localStorage.setItem(DARK_KEY, id);
    } catch {
      // ignora
    }
    setDarkThemeState(id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedTheme, lightTheme, darkTheme, setMode, setLightTheme, setDarkTheme }),
    [mode, resolvedTheme, lightTheme, darkTheme, setMode, setLightTheme, setDarkTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme deve essere usato dentro <ThemeProvider>');
  }
  return ctx;
}
