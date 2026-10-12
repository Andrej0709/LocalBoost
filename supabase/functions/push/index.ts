// Adronis push notifications. pg_cron calls this every 15 minutes (section 13
// of supabase/schema.sql); it asks push_due() what is due and sends it to every
// device the customer turned notifications on for (push.js on the site):
//
//   ready     the week's ads just landed in Approvals
//   reminder  a day later, some are still waiting
//
// A device that has gone away (the browser says 404 or 410) is forgotten.
//
// Deploy with "Verify JWT" OFF: pg_cron sends no Supabase JWT. The call is
// checked against PUSH_CRON_SECRET instead.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY   the same key as PUBLIC_KEY in the site's push.js
//   VAPID_PRIVATE_KEY  its private half - never in the site's code
//   VAPID_SUBJECT      who to contact about the pushes, e.g. mailto:you@gmail.com
//   PUSH_CRON_SECRET   the same value as the Vault secret 'push_cron_secret'
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SITE = "https://adronis.vercel.app";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:hello@adronis.app",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

type Due = { kind: "ready" | "reminder"; drop_id: string; user_id: string; waiting: number; auto_approve: boolean };

// Serbian counts: 1 oglas, 2-4 oglasa, 5+ oglasa - "oglasa" from 2 up, but
// "čeka" for 1 and 5+, "čekaju" for 2-4.
function srAds(n: number) {
  const ten = n % 10, hundred = n % 100;
  if (ten === 1 && hundred !== 11) return { ads: n + " oglas", waits: "čeka" };
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return { ads: n + " oglasa", waits: "čekaju" };
  return { ads: n + " oglasa", waits: "čeka" };
}

function message(d: Due, lang: string) {
  const url = SITE + "/approvals.html";
  if (lang === "sr") {
    const s = srAds(d.waiting);
    if (d.kind === "ready") {
      return { title: "Stigli su novi oglasi", body: s.ads + " te " + s.waits + " u Odobravanjima. Pregledaš ih za minut.", url };
    }
    return {
      title: "Oglasi te još čekaju",
      body: s.ads + " te još " + s.waits + ". " + (d.auto_approve
        ? "Ako ih ne pogledaš, odobrićemo ih za tebe sutra."
        : "Oni koje ne pregledaš ističu kad stignu oglasi za sledeću nedelju."),
      url,
    };
  }
  const ads = d.waiting === 1 ? "1 ad" : d.waiting + " ads";
  if (d.kind === "ready") {
    return { title: "Your new ads are here", body: ads + " waiting for you in Approvals. A minute is all it takes.", url };
  }
  return {
    title: "Your ads are still waiting",
    body: ads + " still waiting. " + (d.auto_approve
      ? "If you don't get to them, we'll approve them for you tomorrow."
      : "Unreviewed ads expire when next week's arrive."),
    url,
  };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  const due = await db.rpc("push_due");
  if (due.error) return new Response(due.error.message, { status: 500 });
  const rows = (due.data || []) as Due[];
  if (!rows.length) return Response.json({ sent: 0 });

  const users = [...new Set(rows.map((r) => r.user_id))];
  const subs = await db.from("push_subscriptions").select("*").in("user_id", users);
  if (subs.error) return new Response(subs.error.message, { status: 500 });

  let sent = 0;
  const gone: number[] = [];
  const ok: number[] = [];
  for (const d of rows) {
    for (const s of (subs.data || []).filter((x) => x.user_id === d.user_id)) {
      const m = message(d, s.lang);
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: "drop-" + d.drop_id }),
          { TTL: 12 * 3600, urgency: "normal" },
        );
        sent++;
        ok.push(s.id);
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error("push failed", code, (err as Error).message);
      }
    }
  }

  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  if (ok.length) await db.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", ok);
  return Response.json({ sent, forgotten: gone.length });
});
