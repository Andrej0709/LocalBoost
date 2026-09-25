// Adronis <-> Paddle. One Supabase Edge Function with two jobs:
//
//   1. Webhook receiver. Paddle POSTs signed events here (subscription.*,
//      transaction.completed). Paddle is the source of truth for billing:
//      every subscription event is mirrored onto the customer's profiles row.
//
//   2. Billing actions for the signed-in customer (checkout, cancel, resume,
//      plan change). The browser never talks to the Paddle API directly and
//      never picks a price itself - this function decides which price applies
//      (trial or not, from the database) so a customer can't hand themselves a
//      second free trial from the browser console.
//
//   3. Plan changes from the Adronis Portal, for admins listed in
//      portal_admins, on accounts that pay through Paddle (see handleAdmin).
//
// Deploy with "Verify JWT" OFF: Paddle can't send a Supabase JWT. Customer
// calls are authenticated below with supabase.auth.getUser() instead.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   PADDLE_API_KEY         server-side API key (pdl_sdbx_... in sandbox)
//   PADDLE_WEBHOOK_SECRET  secret of the notification destination (pdl_ntfset_...)
//   PADDLE_ENV             "sandbox" or "production"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.

import { createClient } from "npm:@supabase/supabase-js@2";

const PADDLE_API = Deno.env.get("PADDLE_ENV") === "production"
  ? "https://api.paddle.com"
  : "https://sandbox-api.paddle.com";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAID_PLANS = ["counter", "storefront", "franchise"];
const CYCLES = ["monthly", "annual"];

// ------------------------------------------------------------------ helpers

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// A message meant for the customer - shown as-is on the page.
class UserError extends Error {}

async function paddle(method: string, path: string, body?: unknown) {
  const res = await fetch(PADDLE_API + path, {
    method,
    headers: {
      Authorization: "Bearer " + Deno.env.get("PADDLE_API_KEY"),
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Paddle API error", method, path, res.status, JSON.stringify(out));
    throw new Error("Paddle API " + res.status + ": " + (out?.error?.detail || out?.error?.code || "unknown error"));
  }
  return out.data;
}

// The catalog price for a plan/cycle. Prices carry { plan, cycle, trial } in
// custom_data (set when the catalog was created), so no price IDs are
// hard-coded here and the same code works in sandbox and live.
async function findPrice(plan: string, cycle: string, trial: boolean) {
  const prices = await paddle("GET", "/prices?status=active&per_page=200");
  const hit = (prices || []).find((p: any) =>
    p.custom_data?.plan === plan &&
    p.custom_data?.cycle === cycle &&
    !!p.custom_data?.trial === trial
  );
  if (!hit) throw new Error(`No Paddle price for ${plan}/${cycle}/${trial ? "trial" : "no trial"}`);
  return hit.id as string;
}

async function findDiscount(code: string) {
  const list = await paddle("GET", "/discounts?status=active&code=" + encodeURIComponent(code));
  const hit = (list || []).find((d: any) =>
    d.enabled_for_checkout && String(d.code).toUpperCase() === code.toUpperCase()
  );
  if (!hit) throw new UserError("That code isn't valid — check it and try again.");
  return hit.id as string;
}

async function profileById(id: string) {
  const { data, error } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function profileBySubscription(subId: string) {
  const { data, error } = await db.from("profiles").select("*")
    .eq("paddle_subscription_id", subId).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------- subscription -> profile
// Mirrors one Paddle subscription entity onto the profile. Convergent: any
// event, in any order, any number of times, lands on the same row - it only
// ever moves forward (older updated_at than what's stored is ignored).
//
// Plan changes are "from the next billing date" on this site: a switch
// updates the Paddle items straight away (so the next renewal is billed at
// the new price) but the engine keeps rendering the plan that was paid for
// until a new billing period starts. So: new subscription or new period ->
// the items' plan applies now; same period with different items -> it's
// pending_plan.
async function syncSubscription(sub: any, userIdHint?: string) {
  const userId = sub.custom_data?.user_id || userIdHint;
  let profile = userId ? await profileById(userId) : null;
  if (!profile) profile = await profileBySubscription(sub.id);
  if (!profile) {
    // An ended subscription nobody points at any more (the account was
    // deleted, or given its plan for good in the portal) has nothing to update.
    if (sub.status === "canceled") return null;
    throw new Error("No profile for subscription " + sub.id);
  }

  // A plan given for good in the Adronis Portal is not Paddle's to change:
  // the portal cancels the Paddle subscription behind it, and that
  // cancellation must not take the plan away again.
  if (profile.comped) return profile;

  const sameSub = profile.paddle_subscription_id === sub.id;
  // A late event from an older, ended subscription must not replace the one
  // that's running now.
  if (!sameSub && profile.paddle_subscription_id && sub.status === "canceled" &&
      ["trialing", "active", "past_due"].includes(profile.subscription_status)) {
    return profile;
  }
  if (sameSub && profile.paddle_updated_at &&
      new Date(sub.updated_at) < new Date(profile.paddle_updated_at)) {
    return profile; // stale event - a newer one was already applied
  }

  const item = (sub.items || [])[0] || {};
  const meta = item.price?.custom_data || {};
  const itemPlan = PAID_PLANS.includes(meta.plan) ? meta.plan : profile.plan;
  const itemCycle = CYCLES.includes(meta.cycle) ? meta.cycle : (profile.billing_cycle || "monthly");

  const periodStart = sub.current_billing_period?.starts_at || null;
  const newPeriod = !sameSub || !profile.paddle_period_start ||
    (periodStart && new Date(periodStart) > new Date(profile.paddle_period_start));

  const status = ({
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    paused: "canceled",
    canceled: "canceled",
  } as Record<string, string>)[sub.status] || "canceled";

  const patch: Record<string, unknown> = {
    paddle_subscription_id: sub.id,
    paddle_customer_id: sub.customer_id,
    paddle_updated_at: sub.updated_at,
    subscription_status: status,
    cancel_at_period_end: sub.scheduled_change?.action === "cancel",
  };

  if (newPeriod) {
    patch.plan = itemPlan;
    patch.billing_cycle = itemCycle;
    patch.pending_plan = null;
    patch.pending_billing_cycle = null;
    patch.paddle_period_start = periodStart;
  } else if (itemPlan !== profile.plan || itemCycle !== profile.billing_cycle) {
    patch.pending_plan = itemPlan;
    patch.pending_billing_cycle = itemCycle;
  } else {
    patch.pending_plan = null;
    patch.pending_billing_cycle = null;
  }

  if (status === "canceled") {
    patch.cancel_at_period_end = false;
    patch.pending_plan = null;
    patch.pending_billing_cycle = null;
  } else {
    patch.current_period_end = sub.next_billed_at || sub.current_billing_period?.ends_at || null;
    if (!profile.payment_method_at) patch.payment_method_at = new Date().toISOString();
  }

  // One trial per account: trial_started_at is stamped once and never cleared.
  const trial = item.trial_dates;
  if (!profile.trial_started_at && (sub.status === "trialing" || trial)) {
    patch.trial_started_at = trial?.starts_at || sub.started_at || sub.created_at;
    patch.trial_ends_at = trial?.ends_at || sub.current_billing_period?.ends_at || null;
  } else if (sub.status === "trialing" && trial?.ends_at) {
    // A running trial moved from the portal: follow its new end date.
    patch.trial_ends_at = trial.ends_at;
  }

  const { data, error } = await db.from("profiles").update(patch).eq("id", profile.id).select().single();
  if (error) throw error;
  return data;
}

// A paid invoice goes into billing_history at what was actually charged
// (promo codes included). €0 trial transactions are skipped.
async function recordTransaction(tx: any) {
  if (!tx.subscription_id) return;
  const total = Number(tx.details?.totals?.grand_total || 0);
  if (total <= 0) return;

  let profile = tx.custom_data?.user_id ? await profileById(tx.custom_data.user_id) : null;
  if (!profile) profile = await profileBySubscription(tx.subscription_id);
  if (!profile) throw new Error("No profile for transaction " + tx.id); // retried by Paddle

  const history = Array.isArray(profile.billing_history) ? profile.billing_history : [];
  if (history.some((e: any) => e.transaction_id === tx.id)) return; // already recorded

  const meta = tx.items?.[0]?.price?.custom_data || {};
  const entry = {
    period_start: tx.billing_period?.starts_at || tx.billed_at || tx.created_at,
    plan: meta.plan || profile.plan,
    cycle: meta.cycle || profile.billing_cycle || "monthly",
    amount: total / 100,
    currency: tx.currency_code,
    transaction_id: tx.id,
  };

  const { error } = await db.from("profiles")
    .update({ billing_history: [...history, entry] })
    .eq("id", profile.id);
  if (error) throw error;
}

// ----------------------------------------------------------------- webhook

async function verifySignature(raw: string, header: string) {
  const secret = Deno.env.get("PADDLE_WEBHOOK_SECRET") || "";
  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=") as [string, string]));
  const ts = parts.ts, h1 = parts.h1;
  if (!secret || !ts || !h1) return false;

  // Reject replays of old deliveries. Paddle re-signs every retry, so a
  // genuine delivery is always fresh.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts + ":" + raw));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (hex.length !== h1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ h1.charCodeAt(i);
  return diff === 0;
}

async function handleWebhook(req: Request, signature: string) {
  const raw = await req.text();
  if (!(await verifySignature(raw, signature))) {
    // Non-2xx so Paddle retries - a rotated secret recovers once it's fixed.
    return json({ error: "Bad signature" }, 401);
  }

  const event = JSON.parse(raw);
  try {
    if (String(event.event_type).startsWith("subscription.")) {
      await syncSubscription(event.data);
    } else if (event.event_type === "transaction.completed") {
      await recordTransaction(event.data);
    }
    return json({ received: true });
  } catch (e) {
    console.error("Webhook error", event.event_type, event.event_id, e);
    return json({ error: "Internal error" }, 500);
  }
}

// ----------------------------------------------------- customer actions

async function handleAction(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth?.user) return json({ error: "Not signed in." }, 401);

  const body = await req.json().catch(() => ({}));
  if (body.action === "admin_set_plan") return handleAdmin(auth.user.id, body);

  const profile = await profileById(auth.user.id);
  if (!profile) return json({ error: "No profile for this account." }, 400);

  const running = ["trialing", "active", "past_due"].includes(profile.subscription_status);
  const subId = profile.paddle_subscription_id;

  try {
    switch (body.action) {
      // Creates a Paddle transaction for the checkout overlay to open. The
      // trial/no-trial choice is made here from the database, never by the page.
      case "checkout": {
        if (!profile.onboarded_at) throw new UserError("Finish the business brief before checking out.");
        if (!PAID_PLANS.includes(body.plan)) throw new UserError("Pick a paid plan.");
        if (!CYCLES.includes(body.cycle)) throw new UserError("Pick monthly or annual billing.");
        if (running) throw new UserError("Your plan is already running.");

        const trial = !profile.trial_started_at;
        const tx: Record<string, unknown> = {
          items: [{ price_id: await findPrice(body.plan, body.cycle, trial), quantity: 1 }],
          custom_data: { user_id: profile.id },
          collection_mode: "automatic",
        };
        if (body.promo_code) tx.discount_id = await findDiscount(String(body.promo_code).trim());
        if (profile.paddle_customer_id) tx.customer_id = profile.paddle_customer_id;

        const created = await paddle("POST", "/transactions", tx);
        return json({ transaction_id: created.id, trial, has_customer: !!profile.paddle_customer_id });
      }

      case "cancel": {
        if (!subId || !running) throw new UserError("No active plan to cancel.");
        const sub = await paddle("POST", `/subscriptions/${subId}/cancel`, { effective_from: "next_billing_period" });
        return json({ profile: await syncSubscription(sub, profile.id) });
      }

      case "resume": {
        if (!subId || !running) throw new UserError("No active plan to resume.");
        const sub = await paddle("PATCH", `/subscriptions/${subId}`, { scheduled_change: null });
        return json({ profile: await syncSubscription(sub, profile.id) });
      }

      // Switches the Paddle items without billing now, so the NEXT renewal is
      // charged at the new plan; the profile shows it as pending_plan until
      // then (see syncSubscription). Picking the running plan undoes a switch.
      case "change_plan":
      case "undo_change": {
        if (!subId || !running) throw new UserError("No active plan to change.");
        if (profile.cancel_at_period_end) throw new UserError("Your plan is set to cancel - resume it first.");
        const plan = body.action === "undo_change" ? profile.plan : body.plan;
        const cycle = body.action === "undo_change" ? profile.billing_cycle : (body.cycle || profile.billing_cycle);
        if (plan === "free") throw new UserError("To move to Free, cancel your plan - it drops to Free when this period ends.");
        if (!PAID_PLANS.includes(plan) || !CYCLES.includes(cycle)) throw new UserError("Pick a paid plan.");

        const sub = await paddle("PATCH", `/subscriptions/${subId}`, {
          items: [{ price_id: await findPrice(plan, cycle, false), quantity: 1 }],
          proration_billing_mode: "do_not_bill",
        });
        return json({ profile: await syncSubscription(sub, profile.id) });
      }

      // Account deletion: stop billing on the spot before the login is removed.
      case "cancel_now": {
        if (subId && running) {
          await paddle("POST", `/subscriptions/${subId}/cancel`, { effective_from: "immediately" });
        }
        return json({ ok: true });
      }

      default:
        throw new UserError("Unknown action.");
    }
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error("Action error", body.action, e);
    return json({ error: "Payments are having a problem right now. Please try again in a minute." }, 502);
  }
}

// ------------------------------------------------------ portal (admins)
// The Adronis Portal changes the plan of an account that pays through Paddle
// by calling this, never by writing the profile itself: the change is made in
// Paddle - the card is charged, left alone or stopped for real - and the
// profile follows from Paddle's answer. Accounts with no running Paddle
// subscription are still set straight in the database by the portal.
//
// The four states are the portal's plan editor:
//   trial    move the end of a running trial (a paying plan can't go back)
//   paying   end a trial and charge today, or move the next charge date
//   forever  cancel the Paddle subscription today and give the plan for good
//   none     cancel at the end of the period, or today
// A plan or cycle switch applies from the next charge, the same as a
// customer switching on their own account page.

const RUNNING = ["trialing", "active", "past_due"];

async function handleAdmin(userId: string, body: any) {
  const { data: admin, error } = await db.from("portal_admins")
    .select("user_id, email").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("Admin check failed", error);
    return json({ error: "Could not check the admin list." }, 500);
  }
  if (!admin) return json({ error: "Not an admin." }, 403);

  try {
    return json({ profile: await adminSetPlan(admin, body) });
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error("Admin action error", body.mode, e);
    // Admins see what Paddle actually said.
    return json({ error: e instanceof Error ? e.message : "Paddle did not accept that change." }, 502);
  }
}

async function adminSetPlan(admin: { user_id: string; email: string }, body: any) {
  const profile = await profileById(String(body.user_id || ""));
  if (!profile) throw new UserError("No such account.");
  if (!profile.paddle_subscription_id) throw new UserError("This account has no Paddle subscription.");

  const mode = body.mode;
  if (!["trial", "paying", "forever", "none"].includes(mode)) throw new UserError("Unknown plan state.");

  let sub = await paddle("GET", `/subscriptions/${profile.paddle_subscription_id}`);
  if (!RUNNING.includes(sub.status)) {
    await syncSubscription(sub, profile.id);
    throw new UserError(`The Paddle subscription behind this account has already ended (${sub.status}). Reload the portal.`);
  }

  const meta = (sub.items || [])[0]?.price?.custom_data || {};
  const plan = body.plan || meta.plan || profile.plan;
  const cycle = body.cycle || meta.cycle || profile.billing_cycle || "monthly";
  if (mode !== "none" && mode !== "forever" && (!PAID_PLANS.includes(plan) || !CYCLES.includes(cycle))) {
    throw new UserError("Pick a paid plan - Paddle has no price for Free.");
  }

  const update = async (patch: unknown) => {
    sub = await paddle("PATCH", `/subscriptions/${sub.id}`, patch);
  };
  // A scheduled cancel or pause has to go before anything else is changed.
  const clearScheduled = async () => {
    if (sub.scheduled_change) await update({ scheduled_change: null });
  };
  // Paddle won't take new items and a new billing date in one request.
  const switchItems = async () => {
    if (plan === meta.plan && cycle === meta.cycle) return;
    await update({
      items: [{ price_id: await findPrice(plan, cycle, false), quantity: 1 }],
      proration_billing_mode: "do_not_bill",
    });
  };
  const moveNextCharge = async (iso: string) => {
    const at = new Date(iso);
    if (isNaN(at.getTime()) || at <= new Date()) throw new UserError("Pick a date in the future.");
    await update({ next_billed_at: at.toISOString(), proration_billing_mode: "do_not_bill" });
  };

  let after;
  try {
    if (mode === "trial") {
      if (sub.status !== "trialing") {
        throw new UserError("This account already pays through Paddle, so it can't go back on a trial. " +
          "To give it free days, use Paying and move the next charge date.");
      }
      await clearScheduled();
      await switchItems();
      if (body.days != null) {
        const days = Number(body.days);
        if (!(days >= 1 && days <= 3650)) throw new UserError("A trial runs between 1 and 3650 days.");
        await moveNextCharge(new Date(Date.now() + days * 86400000).toISOString());
      }
    } else if (mode === "paying") {
      await clearScheduled();
      await switchItems();
      if (sub.status === "trialing") {
        // Ends the trial and charges the card on file today.
        sub = await paddle("POST", `/subscriptions/${sub.id}/activate`);
      } else if (body.until) {
        await moveNextCharge(String(body.until));
      }
    } else if (mode === "forever") {
      await clearScheduled();
      await paddle("POST", `/subscriptions/${sub.id}/cancel`, { effective_from: "immediately" });
      // Whichever lands first, this write or the cancellation webhook, the
      // account ends up comped: a webhook after it finds comped and leaves the
      // row alone (see syncSubscription), and one before it is overwritten.
      const { data, error } = await db.from("profiles").update({
        plan: PAID_PLANS.includes(body.plan) ? body.plan : profile.plan,
        billing_cycle: CYCLES.includes(body.cycle) ? body.cycle : (profile.billing_cycle || "monthly"),
        subscription_status: "active",
        trial_ends_at: null,
        current_period_end: null,
        cancel_at_period_end: false,
        pending_plan: null,
        pending_billing_cycle: null,
        comped: true,
        comped_reason: String(body.reason || "").trim() || null,
        paddle_subscription_id: null,
        paddle_period_start: null,
        paddle_updated_at: null,
      }).eq("id", profile.id).select().single();
      if (error) throw error;
      after = data;
    } else {
      const runOut = !!body.at_period_end && ["trialing", "active"].includes(sub.status);
      if (!(runOut && sub.scheduled_change?.action === "cancel")) {
        await clearScheduled();
        sub = await paddle("POST", `/subscriptions/${sub.id}/cancel`, {
          effective_from: runOut ? "next_billing_period" : "immediately",
        });
      }
    }
  } catch (e) {
    // Whatever Paddle did accept before the failure still lands on the profile.
    if (mode !== "forever") await syncSubscription(sub, profile.id).catch(() => {});
    throw e;
  }

  if (!after) after = await syncSubscription(sub, profile.id);

  const { error: logError } = await db.from("admin_audit").insert({
    actor_id: admin.user_id,
    actor_email: admin.email,
    target_user: profile.id,
    target_email: profile.email,
    action: "set_plan_state",
    changes: {
      mode,
      via: "paddle",
      plan: after.plan,
      cycle: after.billing_cycle,
      status: after.subscription_status,
      runs_until: after.current_period_end,
      pending_plan: after.pending_plan,
      at_period_end: mode === "none" && after.cancel_at_period_end,
      comped: after.comped,
      reason: after.comped_reason,
      was: { plan: profile.plan, status: profile.subscription_status, comped: profile.comped },
    },
  });
  if (logError) console.error("Audit write failed", logError);

  return after;
}

// ------------------------------------------------------------------- entry

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const signature = req.headers.get("paddle-signature");
  if (signature) return handleWebhook(req, signature);
  return handleAction(req);
});
