import { supabase } from '@/lib/supabase';

/**
 * Iscrizione/annullamento alle notifiche push del browser + persistenza su Supabase.
 * L'iscrizione richiede il permesso e va invocata SOLO su un gesto utente (onClick).
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Converte una chiave VAPID pubblica in base64url nel formato Uint8Array
 * richiesto da pushManager.subscribe({ applicationServerKey }).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service worker non supportato da questo browser.');
  }
  return navigator.serviceWorker.ready;
}

/** Restituisce la subscription push corrente, o null se non attiva. */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Attiva le notifiche per l'utente indicato:
 *  1. chiede il permesso (deve avvenire su gesto utente);
 *  2. crea/riusa la subscription del PushManager con la chiave VAPID;
 *  3. la salva (upsert idempotente su endpoint) in push_subscriptions.
 * Lancia un Error con messaggio in italiano in caso di problema.
 */
export async function subscribeToPush(profileId: string): Promise<PushSubscription> {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Chiave VAPID pubblica mancante (VITE_VAPID_PUBLIC_KEY).');
  }
  if (!('Notification' in window)) {
    throw new Error('Le notifiche non sono supportate da questo browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      'Permesso notifiche negato. Puoi riattivarlo dalle impostazioni del browser.',
    );
  }

  const registration = await getRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error('Subscription push non valida (chiavi mancanti).');
  }

  // La colonna reale e' `profile_id` (vedi migration 0001 + RLS 0004);
  // i tipi generati sono allineati, quindi niente cast.
  const row = {
    profile_id: profileId,
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent,
  };
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' });
  if (error) {
    throw new Error(`Salvataggio della subscription fallito: ${error.message}`);
  }

  return subscription;
}

/**
 * Disattiva le notifiche: rimuove la riga su Supabase e annulla la subscription locale.
 */
export async function unsubscribe(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint);
  if (error) {
    // Non blocchiamo l'annullamento locale: logghiamo soltanto.
    console.error('Rimozione della subscription dal server fallita:', error.message);
  }

  await subscription.unsubscribe();
}
