import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import { SessionProvider } from './hooks/useSession';
import { queryClient } from './lib/queryClient';
import './index.css';

// Registra il service worker (auto-update). Lo stub in src/sw.ts fornisce
// l'app-shell offline; l'agente PWA aggiungerà push e notificationclick.
registerSW({ immediate: true });

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Elemento #root non trovato in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
