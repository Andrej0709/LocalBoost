// Adronis push notifications. pg_cron calls this every 15 minutes (section 13
// of supabase/schema.sql); it asks push_due() what is due and sends it to every
// device the customer turned notifications on for (push.js on the site):
//
//   ready      the week's ads just landed in Approvals
//   reminder   a day later, some are still waiting
//   last_call  the evening before next week's arrive, some are still waiting
//   trial      three days or less left of the free trial
//   published  ads that just went out
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

const SITE = "https://www.adronis.app";

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

type Due = {
  kind: "ready" | "reminder" | "last_call" | "trial" | "published";
  drop_id: string | null;
  user_id: string;
  waiting: number;
  auto_approve: boolean;
  channel: string | null;
  days: number | null;
  canceled: boolean | null;
};

// Serbian counts: 1 oglas, 2-4 oglasa, 5+ oglasa - "oglasa" from 2 up, but
// the verb is singular for 1 and 5+ and plural for 2-4 ("čeka" / "čekaju").
// New ones: 1 novi oglas, 2-4 nova oglasa, 5+ novih oglasa.
function srAds(n: number) {
  const ten = n % 10, hundred = n % 100;
  if (ten === 1 && hundred !== 11) {
    return { ads: n + " oglas", fresh: n + " novi oglas", waits: "čeka", expire: "ističe", live: "je objavljen", one: true };
  }
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) {
    return { ads: n + " oglasa", fresh: n + " nova oglasa", waits: "čekaju", expire: "ističu", live: "su objavljena", one: false };
  }
  return { ads: n + " oglasa", fresh: n + " novih oglasa", waits: "čeka", expire: "ističe", live: "je objavljeno", one: false };
}

// The business's own name leads the title ("Kafić Mia: 4 nova oglasa ✨"), so
// the notification reads as theirs. Without one, the rest stands alone.
function titled(business: string | undefined, rest: string) {
  const name = (business || "").replace(/\s+/g, " ").trim();
  if (!name) return rest.charAt(0).toUpperCase() + rest.slice(1);
  return (name.length > 40 ? name.slice(0, 39).trimEnd() + "…" : name) + ": " + rest;
}

function message(d: Due, lang: string, business?: string) {
  const approvals = SITE + "/approvals.html";
  const n = d.waiting;
  const days = d.days || 1;
  if (lang === "sr") {
    const s = srAds(n);
    switch (d.kind) {
      case "ready":
        return {
          title: titled(business, s.fresh + " ✨"),
          body: (s.one ? "Spreman je" : "Spremni su") + " za pregled u Odobravanjima. Treba ti minut.",
          url: approvals,
        };
      case "reminder":
        return {
          title: titled(business, s.one ? "oglas te još čeka" : "oglasi te još čekaju"),
          body: s.ads + " te još " + s.waits + ". " + (d.auto_approve
            ? "Ako ih ne pogledaš, odobrićemo ih za tebe sutra."
            : "Oni koje ne pregledaš ističu kad stignu oglasi za sledeću nedelju."),
          url: approvals,
        };
      case "last_call":
        return {
          title: titled(business, s.ads + " " + s.expire + " sutra ⏳"),
          body: "Pogledaj " + (s.one ? "ga" : "ih") + " danas, ujutru stižu novi za sledeću nedelju.",
          url: approvals,
        };
      case "trial":
        return {
          title: titled(business, days === 1 ? "probni period ističe sutra" : "probni period ističe za " + days + " dana"),
          body: d.canceled
            ? "Posle toga oglasi prestaju da stižu. Plan možeš ponovo da uključiš na stranici naloga."
            : "Tog dana ide prva uplata i plan se nastavlja sam. Ne moraš ništa da radiš.",
          url: SITE + "/account.html",
        };
      case "published":
        return {
          title: titled(business, (s.one ? "oglas" : s.ads) + " " + s.live + " ✅"),
          body: (s.one ? "Upravo je izašao" : "Upravo su izašli") + " na " + (d.channel || "tvoje kanale") + ".",
          url: SITE + "/history.html",
        };
    }
  }
  const ads = n === 1 ? "1 ad" : n + " ads";
  switch (d.kind) {
    case "ready":
      return {
        title: titled(business, (n === 1 ? "1 new ad" : n + " new ads") + " ✨"),
        body: "Ready for you in Approvals. A minute is all it takes.",
        url: approvals,
      };
    case "reminder":
      return {
        title: titled(business, n === 1 ? "your ad is still waiting" : "your ads are still waiting"),
        body: ads + " still waiting. " + (d.auto_approve
          ? "If you don't get to them, we'll approve them for you tomorrow."
          : "Unreviewed ads expire when next week's arrive."),
        url: approvals,
      };
    case "last_call":
      return {
        title: titled(business, ads + (n === 1 ? " expires" : " expire") + " tomorrow ⏳"),
        body: "Take a look today. Next week's ads arrive in the morning.",
        url: approvals,
      };
    case "trial":
      return {
        title: titled(business, days === 1 ? "your trial ends tomorrow" : "your trial ends in " + days + " days"),
        body: d.canceled
          ? "After that your ads stop. You can switch your plan back on from your account."
          : "Your first payment goes through that day and your plan carries on. Nothing to do.",
        url: SITE + "/account.html",
      };
    case "published":
      return {
        title: titled(business, (n === 1 ? "your ad is live" : ads + " are live") + " ✅"),
        body: (n === 1 ? "It just went out on " : "They just went out on ") + (d.channel || "your channels") + ".",
        url: SITE + "/history.html",
      };
  }
}

// What the service worker gets. count sets the red number on the home-screen
// icon, so only the kinds about ads still waiting carry it.
function payload(d: Due, m: { title: string; body: string; url: string }) {
  const waitingKind = d.kind === "ready" || d.kind === "reminder" || d.kind === "last_call";
  const tag = d.drop_id ? "drop-" + d.drop_id : d.kind + "-" + d.user_id;
  return JSON.stringify({ title: m.title, body: m.body, url: m.url, tag, count: waitingKind ? d.waiting : 0 });
}

Deno.serve(async (req) => {
  const secret = clean(Deno.env.get("PUSH_CRON_SECRET"));
  if (!secret || clean(req.headers.get("x-cron-secret") ?? undefined) !== secret) {
    return new Response("Forbidden", { status: 403 });
  }
  const setupError = vapid();
  if (setupError) return Response.json({ sent: 0, error: setupError }, { status: 500 });

  // A test send: {"test": "someone@example.com"} sends one notification to
  // every device that account turned notifications on for, and nothing else;
  // with "all": true, one of every kind, a few seconds apart. Run from the SQL
  // editor (see the end of section 13 in schema.sql).
  const body = await req.json().catch(() => ({}));
  if (body && typeof body.test === "string" && body.test.includes("@")) {
    const who = await db.from("profiles").select("id, business_name").ilike("email", body.test.trim()).maybeSingle();
    if (who.error || !who.data) return Response.json({ sent: 0, error: "No account with that email." });
    const devices = await db.from("push_subscriptions").select("*").eq("user_id", who.data.id);
    if (devices.error) return new Response(devices.error.message, { status: 500 });
    if (!devices.data?.length) return Response.json({ sent: 0, error: "That account hasn't turned notifications on yet." });
    const base = { drop_id: null, user_id: who.data.id, auto_approve: false, channel: null, days: null, canceled: null };
    const samples: Due[] = body.all === true
      ? [
        { ...base, kind: "ready", drop_id: "test-ready", waiting: 4 },
        { ...base, kind: "reminder", drop_id: "test-reminder", waiting: 3 },
        { ...base, kind: "last_call", drop_id: "test-last-call", waiting: 2 },
        { ...base, kind: "trial", waiting: 0, days: 3, canceled: false },
        { ...base, kind: "published", waiting: 1, channel: "Instagram" },
      ]
      : [{ ...base, kind: "ready", drop_id: "test", waiting: 4 }];
    let sent = 0;
    const errors: string[] = [];
    for (const [i, d] of samples.entries()) {
      if (i) await new Promise((r) => setTimeout(r, 1500));
      for (const s of devices.data) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload(d, message(d, s.lang, who.data.business_name)),
            { TTL: 600 },
          );
          sent++;
        } catch (err) {
          errors.push(d.kind + ": " + ((err as { statusCode?: number }).statusCode || "") + " " + (err as Error).message);
        }
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

  // Each account's business name, for the titles. Without it a title just
  // goes without the name, so a failed look-up sends nothing less.
  const names = new Map<string, string>();
  const profiles = await db.from("profiles").select("id, business_name").in("id", users);
  for (const p of profiles.data || []) if (p.business_name) names.set(p.id, p.business_name);

  let sent = 0;
  const gone = new Set<number>();
  const ok = new Set<number>();
  for (const d of rows) {
    for (const s of (subs.data || []).filter((x) => x.user_id === d.user_id && !gone.has(x.id))) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload(d, message(d, s.lang, names.get(d.user_id))),
          { TTL: 12 * 3600, urgency: "normal" },
        );
        sent++;
        ok.add(s.id);
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.add(s.id);
        else console.error("push failed", d.kind, code, (err as Error).message);
      }
    }
  }

  if (gone.size) await db.from("push_subscriptions").delete().in("id", [...gone]);
  if (ok.size) await db.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", [...ok]);
  return Response.json({ sent, forgotten: gone.size });
});
