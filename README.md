# Tornei Calcetto

PWA mobile-first (installabile su Android e iOS) per gestire i **tornei di calcetto aziendali**: classifiche e calendario automatici, marcatori, iscrizioni autonome, risultati **live** e **notifiche push**. Accesso con SSO Google Workspace (dominio `lexroom.ai`).

**Stack**: React + TypeScript + Vite · Tailwind CSS · React Router v7 · TanStack Query v5 · Supabase (Postgres + Auth + Realtime + Edge Functions) · deploy statico su Vercel.

> Costo: €0 di nuova spesa (Supabase Free + Vercel già a pagamento).

---

## 1. Setup locale

Prerequisiti: **Node.js 20+** e npm.

```bash
# 1. Installa le dipendenze
npm install

# 2. Copia le variabili d'ambiente e compilale (vedi §6)
cp .env.example .env

# 3. Genera le icone PWA da public/icons/icon.svg (una tantum)
npm run gen-icons

# 4. Avvia in sviluppo
npm run dev
```

L'app parte su `http://localhost:5173`.

### Script disponibili
| Script | Descrizione |
|---|---|
| `npm run dev` | Server di sviluppo Vite (con service worker attivo). |
| `npm run build` | `tsc -b` + build di produzione (`dist/`). |
| `npm run preview` | Anteprima locale della build di produzione. |
| `npm run test` | Test unitari (Vitest). |
| `npm run typecheck` | Controllo dei tipi senza emettere output. |
| `npm run gen-icons` | Rasterizza `icon.svg` nei PNG del manifest. |

---

## 2. Creazione del progetto Supabase

1. Crea un progetto su [supabase.com](https://supabase.com) (piano **Free**).
2. Segna **Project URL** e **anon public key** da *Project Settings → API* (serviranno per `.env`, §6).
3. Installa la CLI e collega il progetto:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <project-ref>
   ```
   Il `project-ref` è nell'URL del progetto (`https://<project-ref>.supabase.co`).

> Nota Supabase Free: il progetto va in pausa dopo ~7 giorni di inattività totale del DB. L'uso normale lo tiene sveglio; nei periodi morti un cron di keep-alive gratuito lo previene. L'upgrade a Pro ($25/mese) elimina la pausa.

---

## 3. Applicazione delle migrazioni

Le migrazioni SQL (schema, viste, motore torneo, RLS) vivono in `supabase/migrations/`.

**Opzione A — CLI (consigliata):**
```bash
supabase db push
```

**Opzione B — SQL Editor:** apri il *SQL Editor* nella dashboard Supabase ed esegui in ordine i file `0001_schema.sql`, `0002_views.sql`, `0003_engine.sql`, `0004_rls_auth.sql`.

Applica anche `supabase/seed.sql` (allowlist admin + eventuali dati demo) tramite CLI (`supabase db reset` in locale) o incollandolo nel SQL Editor.

Ricordati di aggiungere `matches` e `match_events` alla publication realtime:
```sql
alter publication supabase_realtime add table matches, match_events;
```

---

## 4. Generazione dei tipi TypeScript

I tipi in `src/types/database.types.ts` sono scritti a mano ma restano allineati allo schema. Dopo aver applicato/variato le migrazioni puoi rigenerarli:

```bash
supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.types.ts
```

Mantieni invariato l'export `Database`: gli alias in `src/types/index.ts` e tutte le query dipendono da esso.

---

## 5. Configurazione Google Workspace SSO

Segui i passi dettagliati nel piano (§6). In sintesi:

1. **Google Cloud Console** → nuovo progetto *dentro l'organizzazione* `lexroom.ai`.
2. **OAuth consent screen** → *User type: **Internal*** (solo account `@lexroom.ai`).
3. **Credentials → OAuth client ID → Web application**:
   - *Authorized JavaScript origins*: URL di produzione + `http://localhost:5173`.
   - *Authorized redirect URIs*: **il callback Supabase** `https://<project-ref>.supabase.co/auth/v1/callback`.
4. **Supabase → Authentication → Providers → Google**: incolla Client ID/Secret.
   - *URL Configuration*: **Site URL** = URL di produzione; **Redirect URLs** = URL di produzione + `http://localhost:5173`.
5. Il frontend chiama `signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin, queryParams:{ hd:'lexroom.ai', prompt:'select_account' } } })` (già implementato in `src/hooks/useSession.tsx`).
6. **Bootstrap admin**: la tabella `admin_allowlist` (seed) determina chi è admin al primo login; gli admin successivi si promuovono dall'UI.

---

## 6. Notifiche push — VAPID e Edge Function

1. **Genera le chiavi VAPID** (una tantum):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Metti la chiave **pubblica** in `.env` come `VITE_VAPID_PUBLIC_KEY`.
3. Imposta i **secret** della Edge Function (la privata **non** va mai al client):
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@lexroom.ai SEND_PUSH_SHARED_SECRET=...
   ```
4. **Deploy della Edge Function**:
   ```bash
   supabase functions deploy send-push --no-verify-jwt
   ```
5. Configura il **Database Webhook** su `matches` (UPDATE → `status = finished`) verso `send-push`, e il **pg_cron** per i promemoria partita (vedi piano §5).

---

## 7. Variabili d'ambiente

`.env` (frontend, vedi `.env.example`):

| Variabile | Descrizione |
|---|---|
| `VITE_SUPABASE_URL` | Project URL Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Chiave anon public. |
| `VITE_VAPID_PUBLIC_KEY` | Chiave VAPID pubblica per le push. |

Secret Supabase (Edge Function): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SEND_PUSH_SHARED_SECRET` (oltre a `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` iniettati automaticamente).

---

## 8. Deploy su Vercel

1. Importa il repository su Vercel (framework preset: **Vite**).
2. Build command `npm run build`, output directory `dist`.
3. Aggiungi le Environment Variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
4. Dopo il primo deploy, aggiorna in Google Cloud e Supabase gli URL di produzione (§5).
5. Verifica: manifest raggiungibile, service worker attivo, login Google, installazione PWA e push.

> Il piano **Team/Pro** di Vercel consente l'uso commerciale (un tool interno vi rientra). Essendo una build statica, il progetto è portabile anche su Cloudflare Pages senza modifiche.

---

## 9. Struttura del progetto

```
src/
  main.tsx  App.tsx  router.tsx     # bootstrap, provider, rotte
  lib/        supabase.ts, queryClient.ts, cn.ts
  hooks/      useSession.tsx, useProfile.ts, useRealtimeTournament.ts, queries/*
  components/ ui/ (Button, Card, Tabs, Badge, Spinner, EmptyState, Modal, Input, Select, FormField, Avatar)
              layout/ (AppShell, Header, BottomNav, RequireAuth, RequireAdmin)
  pages/      # componenti-rotta (placeholder sostituiti dagli agenti feature)
  types/      database.types.ts, index.ts
  sw.ts       # service worker custom (entry injectManifest)
public/manifest.webmanifest  public/icons/*
supabase/migrations/*  supabase/functions/*   # gestiti dagli agenti backend/PWA
```

Contratto per le feature: importa il client da `@/lib/supabase`, i tipi da `@/types`, le query condivise da `@/hooks/queries`, l'auth da `@/hooks/useSession`, i primitivi da `@/components/ui`. Le mutation specifiche di una feature vanno in un file dedicato della feature stessa (non modificare i file della Fondazione) e devono invalidare le query TanStack pertinenti.
