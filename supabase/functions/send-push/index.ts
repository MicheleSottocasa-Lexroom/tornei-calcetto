// Edge Function: send-push
// Riceve { userIds?, title, body, url, tag } e invia una notifica Web Push a tutte
// le subscription interessate (tutte, oppure solo quelle degli utenti in `userIds`).
// Le subscription scadute (410 Gone / 404) vengono rimosse.
//
// Protezione: header segreto condiviso `x-shared-secret` (== secret SEND_PUSH_SHARED_SECRET).
// Deploy consigliato: `supabase functions deploy send-push --no-verify-jwt`
// (viene chiamata da webhook DB e da send-reminders, non dal browser).
//
// Secrets richiesti (supabase secrets set ...):
//   VAPID_PUBLIC_KEY   chiave VAPID pubblica  (base64url, la stessa di VITE_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY  chiave VAPID privata   (base64url)
//   VAPID_SUBJECT      es. mailto:admin@lexroom.ai
//   SEND_PUSH_SHARED_SECRET
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   (iniettati automaticamente)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@^0.3.0';

interface SendPushBody {
  userIds?: string[] | null;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Conversione chiavi VAPID base64url -> CryptoKeyPair per @negrel/webpush ---
function base64UrlToBytes(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importVapidCryptoKeys(
  publicKeyB64: string,
  privateKeyB64: string,
): Promise<CryptoKeyPair> {
  const pub = base64UrlToBytes(publicKeyB64); // punto EC non compresso: 0x04 + X(32) + Y(32)
  const priv = base64UrlToBytes(privateKeyB64); // scalare privato d (32 byte)
  const x = bytesToBase64Url(pub.slice(1, 33));
  const y = bytesToBase64Url(pub.slice(33, 65));
  const d = bytesToBase64Url(priv);

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  );
  return { publicKey, privateKey };
}

// ApplicationServer riusato tra invocazioni a caldo (evita re-import chiavi).
let appServerPromise: Promise<webpush.ApplicationServer> | null = null;
function getAppServer(): Promise<webpush.ApplicationServer> {
  if (!appServerPromise) {
    appServerPromise = (async () => {
      const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@lexroom.ai';
      if (!publicKey || !privateKey) {
        throw new Error('Chiavi VAPID mancanti (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).');
      }
      const vapidKeys = await importVapidCryptoKeys(publicKey, privateKey);
      return webpush.ApplicationServer.new({
        contactInformation: subject,
        vapidKeys,
      });
    })();
  }
  return appServerPromise;
}

// Riconosce l'errore "subscription non piu' valida" (da rimuovere).
function isGoneError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 404 || status === 410) return true;
  const isGone = (err as { isGone?: () => boolean })?.isGone;
  if (typeof isGone === 'function') {
    try {
      return isGone.call(err);
    } catch {
      return false;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo non consentito' }, 405);
  }

  const sharedSecret = Deno.env.get('SEND_PUSH_SHARED_SECRET');
  const provided = req.headers.get('x-shared-secret');
  if (!sharedSecret || provided !== sharedSecret) {
    return jsonResponse({ error: 'Non autorizzato' }, 401);
  }

  let input: SendPushBody;
  try {
    input = (await req.json()) as SendPushBody;
  } catch {
    return jsonResponse({ error: 'Body JSON non valido' }, 400);
  }
  if (!input.title) {
    return jsonResponse({ error: 'Campo "title" obbligatorio' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Selezione subscription: tutte, oppure ristrette agli userIds indicati.
  let query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth');
  if (input.userIds !== undefined && input.userIds !== null) {
    if (!Array.isArray(input.userIds)) {
      return jsonResponse({ error: '"userIds" deve essere un array' }, 400);
    }
    if (input.userIds.length === 0) {
      return jsonResponse({ sent: 0, message: 'Nessun destinatario' }, 200);
    }
    query = query.in('profile_id', input.userIds);
  }

  const { data: subs, error } = await query;
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  if (!subs || subs.length === 0) {
    return jsonResponse({ sent: 0, message: 'Nessuna subscription' }, 200);
  }

  let appServer: webpush.ApplicationServer;
  try {
    appServer = await getAppServer();
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Configurazione VAPID non valida' },
      500,
    );
  }

  const messagePayload = JSON.stringify({
    title: input.title,
    body: input.body ?? '',
    url: input.url ?? '/',
    tag: input.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
  });

  const staleIds: string[] = [];
  const results = await Promise.allSettled(
    subs.map(async (s) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        const subscriber = appServer.subscribe(subscription);
        await subscriber.pushTextMessage(messagePayload, {});
      } catch (err) {
        if (isGoneError(err)) staleIds.push(s.id);
        throw err;
      }
    }),
  );

  // Pulizia delle subscription scadute.
  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;
  return jsonResponse({ sent, failed, removed: staleIds.length }, 200);
});
