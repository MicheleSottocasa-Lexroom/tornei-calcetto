/// <reference lib="webworker" />
// Service worker custom (entry per la strategia injectManifest di vite-plugin-pwa).
// Responsabilita:
//  - precache dell'app-shell per l'uso offline (self.__WB_MANIFEST iniettato al build);
//  - SPA navigation fallback su index.html (denylist per /auth e /functions);
//  - gestione notifiche push (payload JSON: title/body/url/tag/icon/badge);
//  - deep-link su click notifica (focus/navigate finestra esistente oppure openWindow).
// NB: i dati Supabase sono online-first e NON vengono mai cachati qui (li gestisce
// TanStack Query in memoria); il SW cachea solo gli asset statici dell'app-shell.
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// Precache dell'app-shell (iniettato al build da vite-plugin-pwa).
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback: tutte le navigazioni servono index.html dalla cache.
// Escludiamo il callback OAuth (/auth) e le Edge Functions (/functions).
const navigationRoute = new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/auth/, /^\/functions/],
});
registerRoute(navigationRoute);

self.addEventListener('install', () => {
  // Attiva subito la nuova versione senza attendere la chiusura dei tab.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Prende il controllo di tutte le finestre aperte.
  event.waitUntil(self.clients.claim());
});

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

// ---- Notifiche push ----
self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  if (event.data) {
    try {
      payload = event.data.json() as PushPayload;
    } catch {
      // Payload non-JSON: usa il testo grezzo come corpo.
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title ?? 'Tornei Calcetto';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: payload.badge ?? '/icons/badge-72.png',
    // Con lo stesso tag una notifica sostituisce la precedente (es. correzione risultato).
    tag: payload.tag,
    data: { url: payload.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---- Click sulla notifica: deep-link ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl =
    (event.notification.data && (event.notification.data as { url?: string }).url) || '/';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Se una finestra dell'app e' gia' aperta, portala in primo piano e naviga.
      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && client.url !== targetUrl) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // Alcuni browser vietano navigate cross-context: ignora.
            }
          }
          return;
        }
      }

      // Altrimenti apri una nuova finestra sul deep-link.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
