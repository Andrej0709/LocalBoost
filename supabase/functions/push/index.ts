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
//   VAPID_PRIVATE_KEY  the private half of PUBLIC_KEY below - never in the site's code
//   VAPID_SUBJECT      optional; an https address to contact about the pushes
//                      (the site's own address when it is missing or a mailto:)
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

// The public key is public anyway (it is in push.js), so it lives here and not
// in a secret. Secrets pasted into the dashboard often pick up quotes, spaces
// or a trailing "=", which web-push refuses - clean() strips those.
const PUBLIC_KEY = "BMTI2s98ftv2SBWRjOEXqJjcIDFxhVONxaxYixJIDjnWJHN3ebYOkile1NYxrxdZZIXuLbUZsnP_Hb7SUgPOrB0";

function clean(v: string | undefined) {
  return (v || "").trim().replace(/^["']+|["']+$/g, "").trim();
}

// Set up on the first call rather than at start-up, so a bad secret comes back
// as a readable error in net._http_response instead of crashing the function.
let vapidError: string | null | undefined;
function vapid() {
  if (vapidError !== undefined) return vapidError;
  try {
    // web-push checks the subject with Node's url.parse, which under Deno finds
    // no host in a mailto: address and refuses it - so only an https address
    // is used, and the site's own one otherwise. Apple accepts either kind.
    const given = clean(Deno.env.get("VAPID_SUBJECT"));
    const subject = /^https:\/\//i.test(given) ? given : SITE;
    const privateKey = clean(Deno.env.get("VAPID_PRIVATE_KEY")).replace(/=+$/, "")
      .replace(/\+/g, "-").replace(/\//g, "_");
    webpush.setVapidDetails(subject, PUBLIC_KEY, privateKey);
    vapidError = null;
  } catch (err) {
    vapidError = "VAPID setup failed: " + (err as Error).message;
  }
  return vapidError;
}

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
  const setupError = vapid();
  if (setupError) return Response.json({ sent: 0, error: setupError }, { status: 500 });

  // A test send: {"test": "someone@example.com"} sends one notification to
  // every device that account turned notifications on for, and nothing else.
  // Run from the SQL editor (see the end of section 13 in schema.sql).
  const body = await req.json().catch(() => ({}));
  if (body && typeof body.test === "string" && body.test.includes("@")) {
    const who = await db.from("profiles").select("id").ilike("email", body.test.trim()).maybeSingle();
    if (who.error || !who.data) return Response.json({ sent: 0, error: "No account with that email." });
    const devices = await db.from("push_subscriptions").select("*").eq("user_id", who.data.id);
    if (devices.error) return new Response(devices.error.message, { status: 500 });
    if (!devices.data?.length) return Response.json({ sent: 0, error: "That account hasn't turned notifications on yet." });
    let sent = 0;
    const errors: string[] = [];
    for (const s of devices.data) {
      const m = message({ kind: "ready", drop_id: "test", user_id: who.data.id, waiting: 4, auto_approve: false }, s.lang);
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: "test" }),
          { TTL: 600 },
        );
        sent++;
      } catch (err) {
        errors.push(((err as { statusCode?: number }).statusCode || "") + " " + (err as Error).message);
      }
    }
    return Response.json({ sent, devices: devices.data.length, errors });
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
