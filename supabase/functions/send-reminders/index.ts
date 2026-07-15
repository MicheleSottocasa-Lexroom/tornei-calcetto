// Edge Function: send-reminders
// Da eseguire ogni 5 minuti via pg_cron (vedi 0005_push_triggers.sql).
// Seleziona le partite programmate con kickoff tra ~25 e ~30 minuti e reminder_sent=false,
// invia un promemoria ai giocatori delle due squadre (delegando a send-push) e marca
// reminder_sent=true (consegna una-tantum, evita duplicati).
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

Deno.serve(async (req) => {
  const sharedSecret = Deno.env.get('SEND_PUSH_SHARED_SECRET');
  const provided = req.headers.get('x-shared-secret');
  if (!sharedSecret || provided !== sharedSecret) {
    return jsonResponse({ error: 'Non autorizzato' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Finestra 25-30 minuti nel futuro.
  const now = Date.now();
  const fromIso = new Date(now + 25 * 60 * 1000).toISOString();
  const toIso = new Date(now + 30 * 60 * 1000).toISOString();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, tournament_id, scheduled_at, venue, home_team_id, away_team_id')
    .eq('status', 'scheduled')
    .eq('reminder_sent', false)
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  if (!matches || matches.length === 0) {
    return jsonResponse({ reminders: 0, total: 0 }, 200);
  }

  // Nomi e giocatori delle squadre coinvolte (una query cumulativa).
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
    members?.forEach((m) => {
      const arr = teamMembers.get(m.team_id) ?? [];
      arr.push(m.profile_id);
      teamMembers.set(m.team_id, arr);
    });
  }

  const sendPushUrl = `${supabaseUrl}/functions/v1/send-push`;

  const results = await Promise.allSettled(
    matches.map(async (m) => {
      const userIds = [
        ...(m.home_team_id ? teamMembers.get(m.home_team_id) ?? [] : []),
        ...(m.away_team_id ? teamMembers.get(m.away_team_id) ?? [] : []),
      ];

      const home = m.home_team_id ? teamNames.get(m.home_team_id) ?? 'Casa' : 'Da definire';
      const away = m.away_team_id
        ? teamNames.get(m.away_team_id) ?? 'Ospiti'
        : 'Da definire';
      const when = m.scheduled_at ? new Date(m.scheduled_at) : null;
      const hhmm = when
        ? when.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Rome',
          })
        : '';
      const body = `${home} vs ${away}${hhmm ? ` alle ${hhmm}` : ''}${
        m.venue ? ` · ${m.venue}` : ''
      }`;

      // Invia solo se ci sono destinatari con subscription.
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
            title: 'Promemoria partita',
            body,
            url: `/tornei/${m.tournament_id}/calendario`,
            tag: `reminder-${m.id}`,
          }),
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`send-push ${resp.status}: ${txt}`);
        }
      }

      // Marca come inviato (anche senza destinatari: evita retry inutili).
      const { error: updErr } = await supabase
        .from('matches')
        .update({ reminder_sent: true })
        .eq('id', m.id);
      if (updErr) throw new Error(updErr.message);
    }),
  );

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - ok;
  return jsonResponse({ reminders: ok, failed, total: matches.length }, 200);
});
