import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

export interface SessionContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Errore nel caricamento del profilo:', error.message);
    return null;
  }
  return data;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        setProfile(await fetchProfile(data.session.user.id));
      }
      setLoading(false);
    });

    // Il callback DEVE restare sincrono: eseguire chiamate supabase (come
    // fetchProfile) direttamente qui può bloccare il lock interno dell'auth
    // (deadlock / eventi persi). Il fetch del profilo viene quindi differito.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      if (next?.user) {
        const userId = next.user.id;
        setTimeout(() => {
          if (!active) return;
          void fetchProfile(userId).then((p) => {
            if (active) setProfile(p);
          });
        }, 0);
      } else {
        setProfile(null);
      }
      // Invalida le cache legate all'utente al cambio di sessione.
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(() => {
    return {
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.is_admin ?? false,
      loading,
      signInWithGoogle: async () => {
        // signInWithOAuth NON lancia: ritorna { error }. Va propagato a mano,
        // altrimenti l'errore del provider viene ignorato dal chiamante.
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
            queryParams: {
              prompt: 'select_account',
            },
          },
        });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        queryClient.clear();
      },
    };
  }, [session, profile, loading, queryClient]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession deve essere usato dentro <SessionProvider>');
  }
  return ctx;
}
