// Edge Function: send-reminders
// Da eseguire ogni 5 minuti via pg_cron (vedi 0005/0006).
// Gestisce DUE promemoria per partita:
//   - ~30 minuti prima  (flag reminder_sent)
//   - ~5 minuti prima   (flag reminder_5_sent)
// Per ciascuna finestra invia ai giocatori delle due squadre (via send-push) e marca
// il rispettivo flag (consegna una-tantum, niente duplicati).
//
// Protezione: header segreto condiviso `x-shared-secret` (== SEND_PUSH_SHARED_SECRET).
// Deploy: `supabase functions deploy send-reminders --no-verify-jwt`.

import { createClient } from 'jsr:@supabase/supabase-js@2';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface ReminderWindow {
  kind: '30' | '5';
  flag: 'reminder_sent' | 'reminder_5_sent';
  fromMs: number;
  toMs: number;
  title: string;
  lead: string;
}

Deno.serve(async (req) => {
  const sharedSecret = Deno.env.get('SEND_PUSH_SHARED_SECRET');
  const provided = req.headers.get('x-shared-secret');
  if (!sharedSecret || provided !== sharedSecret) {
    return jsonResponse({ error: 'Non autorizzato' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const sendPushUrl = `${supabaseUrl}/functions/v1/send-push`;

  const now = Date.now();
  const windows: ReminderWindow[] = [
    {
      kind: '30',
      flag: 'reminder_sent',
      fromMs: now + 25 * 60 * 1000,
      toMs: now + 35 * 60 * 1000,
      title: 'Promemoria partita',
      lead: 'tra ~30 minuti',
    },
    {
      kind: '5',
      flag: 'reminder_5_sent',
      fromMs: now,
      toMs: now + 8 * 60 * 1000,
      title: 'La partita sta per iniziare',
      lead: 'tra pochi minuti',
    },
  ];

  const summary: Record<string, number> = {};
  let totalSent = 0;

  for (const w of windows) {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('id, tournament_id, scheduled_at, venue, home_team_id, away_team_id')
      .eq('status', 'scheduled')
      .eq(w.flag, false)
      .gte('scheduled_at', new Date(w.fromMs).toISOString())
      .lte('scheduled_at', new Date(w.toMs).toISOString());

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    if (!matches || matches.length === 0) {
      summary[w.kind] = 0;
      continue;
    }

    // Nomi e giocatori delle squadre coinvolte in questa finestra.
    const teamIds = [
      ...new Set(
        matches
          .flatMap((m) => [m.home_team_id, m.away_team_id])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const teamNames = new Map<string, string>();
    const teamMembers = new Map<string, string[]>();
    if (teamIds.length > 0) {
      const [{ data: teams }, { data: members }] = await Promise.all([
        supabase.from('teams').select('id, name').in('id', teamIds),
        supabase.from('team_members').select('team_id, profile_id').in('team_id', teamIds),
      ]);
      teams?.forEach((t) => teamNames.set(t.id, t.name));
      members?.forEach((mm) => {
        const arr = teamMembers.get(mm.team_id) ?? [];
        arr.push(mm.profile_id);
        teamMembers.set(mm.team_id, arr);
      });
    }

    const results = await Promise.allSettled(
      matches.map(async (m) => {
        const userIds = [
          ...(m.home_team_id ? teamMembers.get(m.home_team_id) ?? [] : []),
          ...(m.away_team_id ? teamMembers.get(m.away_team_id) ?? [] : []),
        ];

        const home = m.home_team_id ? teamNames.get(m.home_team_id) ?? 'Casa' : 'Da definire';
        const away = m.away_team_id ? teamNames.get(m.away_team_id) ?? 'Ospiti' : 'Da definire';
        const when = m.scheduled_at ? new Date(m.scheduled_at) : null;
        const hhmm = when
          ? when.toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Rome',
            })
          : '';
        const body = `${home} vs ${away} ${w.lead}${hhmm ? ` (${hhmm})` : ''}${
          m.venue ? ` · ${m.venue}` : ''
        }`;

        if (userIds.length > 0) {
          const resp = await fetch(sendPushUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-shared-secret': sharedSecret,
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              userIds,
              title: w.title,
              body,
              url: `/tornei/${m.tournament_id}/calendario`,
              tag: `reminder${w.kind}-${m.id}`,
            }),
          });
          if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`send-push ${resp.status}: ${txt}`);
          }
        }

        // Marca il flag della finestra (anche senza destinatari: evita retry inutili).
        const { error: updErr } = await supabase
          .from('matches')
          .update({ [w.flag]: true })
          .eq('id', m.id);
        if (updErr) throw new Error(updErr.message);
      }),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    summary[w.kind] = ok;
    totalSent += ok;
  }

  return jsonResponse({ sent: totalSent, window30: summary['30'] ?? 0, window5: summary['5'] ?? 0 }, 200);
});
