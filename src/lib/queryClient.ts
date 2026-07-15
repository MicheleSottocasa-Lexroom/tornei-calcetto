import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // I dati live vengono invalidati dal Realtime; teniamo una cache breve
      // per deduplicare e non ricaricare a ogni cambio di tab.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
