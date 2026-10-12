/* ============================================================ */
/* Adronis - Supabase schema */
/* Run this whole file once in: Supabase Dashboard -> SQL Editor. */
/* Safe to re-run (idempotent). */
/* ============================================================ */

/* ------------------------------------------------------------ */
/* 1. Enums */
/* ------------------------------------------------------------ */
do $$ begin
  create type public.plan_tier as enum ('counter', 'storefront', 'franchise', 'free');
exception when duplicate_object then null; end $$;

/* Databases created before the free plan existed. 'free' only records that
   the customer chose the free plan at signup (so they skip checkout) - what
   actually decides free vs paid everywhere is subscription_status: anyone
   without a running trial or subscription is on the free allowance. */
alter type public.plan_tier add value if not exists 'free';

/* 'beta' is the plan of the businesses picked for the beta, until the public
   launch in Q1 2027. It has no price and is never sold: it is not in the
   pricing section or at checkout, Paddle has no price for it, and only the
   Adronis Portal gives it to an account (admin_set_plan_state, mode 'beta'),
   as a plan with no renewal date that is never charged. It includes what the
   beta plan promises: 4 ads a week on up to 4 channels (channel_limit below,
   PLANS.beta in account.js). A new enum value can't be used in the same
   transaction that adds it, so the SQL functions below compare plan::text
   with 'beta' instead of the enum itself. */
alter type public.plan_tier add value if not exists 'beta';

do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.drop_status as enum ('rendering', 'awaiting_approval', 'approved', 'published', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.creative_status as enum ('pending', 'approved', 'rejected', 'published');
exception when duplicate_object then null; end $$;

/* 'expired': an ad the customer neither approved nor rejected before the next
   week's ads arrived (expire_unreviewed, section 11b). It is never posted; the
   customer sees it under Expired in Approvals. Like 'beta' above, it can't be
   used in the transaction that adds it, so the functions below compare
   status::text with 'expired'. */
alter type public.creative_status add value if not exists 'expired';

do $$ begin
  create type public.lead_status as enum ('new', 'contacted', 'closed');
exception when duplicate_object then null; end $$;

/* ------------------------------------------------------------ */
/* 2. profiles - one row per auth user. */
/*    Everything the client types about their account + business brief. */
/* ------------------------------------------------------------ */
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text not null,
  business_name       text,

  /* About the business */
  country             text,
  city                text,
  vertical            text,
  website             text,
  what_you_sell       text,
  typical_customer    text,
  differentiator      text,
  why_us              text,

  /* Brand and voice */
  brand_vibe          text,
  brand_colors        text,
  avoid_notes         text,

  /* Publishing */
  channels            text[] not null default '{}',

  /* Billing / trial.
     A fresh account has subscription_status null - the trial does NOT start at
     signup. It starts only once the business brief is filled in (onboarded_at)
     and a card has been captured at checkout (payment_method_at); at that point
     start_trial() sets the status to 'trialing' and stamps the trial dates. */
  plan                public.plan_tier,
  billing_cycle       text,
  subscription_status public.subscription_status,
  trial_started_at    timestamptz,
  trial_ends_at       timestamptz,
  payment_method_at   timestamptz,

  /* current_period_end is the next charge date - what a real Stripe subscription
     calls current_period_end. finalize_billing_period() advances it every time a
     period rolls over, and applies whatever was scheduled for that renewal:
     a cancellation (cancel_at_period_end) or a plan/cycle switch (pending_plan). */
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  pending_plan          public.plan_tier,
  pending_billing_cycle text,

  /* One entry per completed billing period, appended by finalize_billing_period()
     at the plan/cycle that was actually charged for that period. Past invoices
     must never be recomputed from the CURRENT plan - a plan change must not
     rewrite what earlier periods actually billed. */
  billing_history     jsonb not null default '[]'::jsonb,

  /* Paddle links. Written only by the paddle Edge Function (service role). */
  paddle_customer_id     text,
  paddle_subscription_id text,
  paddle_period_start    timestamptz,
  paddle_updated_at      timestamptz,
  paddle_discount        jsonb,

  /* Proof of what the customer accepted and when. Written once at signup from
     the consent checkbox, and again whenever they accept a newer version. Never
     cleared - it is the evidence that the contract was formed. */
  terms_accepted_at   timestamptz,
  terms_version       text,

  onboarded_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

/* --- Migration for databases created before the checkout gate --------------- */
/* Removes the automatic trial defaults and adds the columns the gate needs.     */
/* Existing rows keep whatever trial they already have. Safe to re-run.          */
alter table public.profiles add column if not exists billing_cycle     text;
alter table public.profiles add column if not exists payment_method_at timestamptz;

/* --- Migration for self-serve plan changes and cancellation ----------------- */
alter table public.profiles add column if not exists current_period_end    timestamptz;
alter table public.profiles add column if not exists cancel_at_period_end  boolean not null default false;
alter table public.profiles add column if not exists pending_plan          public.plan_tier;
alter table public.profiles add column if not exists pending_billing_cycle text;
alter table public.profiles add column if not exists billing_history       jsonb not null default '[]'::jsonb;

/* --- Migration for Paddle billing ------------------------------------------- */
/* Paddle is the source of truth for subscriptions. supabase/functions/paddle   */
/* mirrors every subscription event onto these columns (and the billing ones    */
/* above) using the service role, so none of them are writable from the browser. */
/* paddle_period_start: start of the billing period the plan was set for - a    */
/* plan switch waits in pending_plan until Paddle starts a newer period.        */
/* paddle_updated_at: the subscription's own updated_at, so an out-of-order     */
/* webhook never overwrites a newer state.                                      */
/* paddle_discount: what Paddle takes off the subscription's charges - a promo  */
/* code from checkout or a discount agreed in the portal - with its dates, so   */
/* the account page and the portal show the price Paddle will really charge.    */
alter table public.profiles add column if not exists paddle_customer_id     text;
alter table public.profiles add column if not exists paddle_subscription_id text;
alter table public.profiles add column if not exists paddle_period_start    timestamptz;
alter table public.profiles add column if not exists paddle_updated_at      timestamptz;
alter table public.profiles add column if not exists paddle_discount        jsonb;
create unique index if not exists profiles_paddle_subscription_idx
  on public.profiles (paddle_subscription_id);

/* --- Migration for the "what made you come to us?" answer ------------------- */
/* Rows created before the question stay null - they were never asked.           */
alter table public.profiles add column if not exists why_us text;

/* --- Migration for recorded acceptance of the legal terms ------------------- */
/* Rows created before the consent checkbox stay null: no record, no claim that  */
/* they accepted anything. Ask those accounts to re-accept on next login.        */
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version     text;

/* --- Migration for the business's country ----------------------------------- */
/* Stored by its English name, e.g. 'Serbia'. Rows created before the signup     */
/* form asked for it stay null.                                                   */
alter table public.profiles add column if not exists country text;

/* --- Migration for the optional "help the engine" extras -------------------- */
/* next_week_note: whatever the customer wants next week's drop built around - a */
/* sale, holiday hours, a new product. Optional; the engine reads it when it     */
/* renders. next_week_note_at is stamped by protect_profile_billing whenever the */
/* note changes, so the engine can tell a fresh note from a stale one.            */
alter table public.profiles add column if not exists next_week_note    text;
alter table public.profiles add column if not exists next_week_note_at timestamptz;

/* Only the new column is capped here: a cap on an older brief field would make
   every later update of a row that already exceeds it fail, billing included. */
do $$ begin
  alter table public.profiles add constraint profiles_next_week_note_size
    check (char_length(coalesce(next_week_note, '')) <= 1000);
exception when duplicate_object then null; end $$;

/* --- Migration for the first-visit guided tours (tour.js) ------------------- */
/* The ids of the tours this customer has already been shown, e.g.               */
/* {control_room, approvals}, so a tour never repeats on another device.         */
alter table public.profiles add column if not exists tours_seen text[] not null default '{}';

do $$ begin
  alter table public.profiles add constraint profiles_tours_seen_size
    check (cardinality(tours_seen) <= 20);
exception when duplicate_object then null; end $$;

/* --- Migration for the practical facts a local ad leans on ------------------ */
/* address: the street address ("Bulevar oslobođenja 12"), opening_hours in the  */
/* customer's own words ("Mon-Fri 7-22, Sat 8-23, closed Sunday"), phone for     */
/* ads that say "call to book" and for us to reach them. All optional; the      */
/* engine puts them in an ad only where they help. Rows from before stay null.   */
alter table public.profiles add column if not exists address       text;
alter table public.profiles add column if not exists opening_hours text;
alter table public.profiles add column if not exists phone         text;

do $$ begin
  alter table public.profiles add constraint profiles_contact_sizes check (
    char_length(coalesce(address, '')) <= 200
    and char_length(coalesce(opening_hours, '')) <= 300
    and char_length(coalesce(phone, '')) <= 40
  ) not valid;
exception when duplicate_object then null; end $$;

/* --- Migration for the Google Maps link and clearing the old profiles ------ */
/* google_maps_url: the business on Google Maps, as the Share button gives it   */
/* (signup and the account page check it is a Maps link). Optional.             */
/* profile_cleanup: the signup's answer to "should we delete what's on your     */
/* profiles now, before we start posting?" - 'delete', 'keep', 'you_decide'     */
/* (we judge it) or 'other', with the customer's own words in                   */
/* profile_cleanup_note. Rows from before stay null.                            */
alter table public.profiles add column if not exists google_maps_url      text;
alter table public.profiles add column if not exists profile_cleanup      text;
alter table public.profiles add column if not exists profile_cleanup_note text;

do $$ begin
  alter table public.profiles add constraint profiles_maps_cleanup check (
    char_length(coalesce(google_maps_url, '')) <= 500
    and (profile_cleanup is null or profile_cleanup in ('delete', 'keep', 'you_decide', 'other'))
    and char_length(coalesce(profile_cleanup_note, '')) <= 500
  );
exception when duplicate_object then null; end $$;

/* --- Migration for "approve it for me if I don't get to it" ----------------- */
/* auto_approve: the customer's own switch (account page). While it is on, an   */
/* ad still waiting 48 hours after its drop landed is approved for them by      */
/* auto_approve_due() below. auto_approve_at is stamped by                       */
/* protect_profile_billing when the switch goes on, and the 48 hours never      */
/* count from before it, so turning it on never approves a backlog at once.     */
alter table public.profiles add column if not exists auto_approve    boolean not null default false;
alter table public.profiles add column if not exists auto_approve_at timestamptz;

/* --- Migration for the days a business is closed ---------------------------- */
/* closed_days: the stretches the customer told us they're shut - a holiday,    */
/* a week off, a renovation - as a list of {"from": "2026-12-30",               */
/* "to": "2027-01-02", "note": "New Year"}, dates in the business's own time.   */
/* Their usual weekly day off belongs in opening_hours, not here. The engine    */
/* reads it when it renders: no ad is slotted for a closed day, no ad tells     */
/* people to come by while the door is shut, and a week that is closed from     */
/* Monday to Sunday gets no drop at all - nobody pays to make ads nobody can    */
/* use. The control room writes it (closed-days.js); protect_profile_billing    */
/* checks each entry, and the browser drops entries long past.                  */
alter table public.profiles add column if not exists closed_days jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.profiles add constraint profiles_closed_days_shape check (
    jsonb_typeof(closed_days) = 'array'
    and jsonb_array_length(closed_days) <= 30
    and octet_length(closed_days::text) <= 8000
  );
exception when duplicate_object then null; end $$;

/* --- Migration for the quick "never in my ads" picks ------------------------ */
/* avoid_tags: the common things a customer can rule out with one tap in the    */
/* control room, next to avoid_notes (their own words, which still wins when    */
/* the two disagree). The engine reads both. The keys are fixed so the engine   */
/* and both languages agree on what each one means:                             */
/*   no_emoji      no emojis                                                    */
/*   no_prices     never show or mention prices                                 */
/*   no_discounts  no sales talk - no "% off", no "cheapest"                    */
/*   no_faces      no people's faces in the images                              */
/*   no_alcohol    no alcohol in the images or the text                         */
/*   no_jokes      no jokes or puns - keep it straight                          */
/*   no_slang      no slang or street talk                                      */
/*   no_english    no English words in Serbian ads                              */
/*   no_competitors never name or hint at another business                     */
/*   no_urgency    no pressure lines - "last chance", "hurry"                   */
alter table public.profiles add column if not exists avoid_tags text[] not null default '{}';

do $$ begin
  alter table public.profiles add constraint profiles_avoid_tags_known check (
    avoid_tags <@ array['no_emoji', 'no_prices', 'no_discounts', 'no_faces', 'no_alcohol',
                        'no_jokes', 'no_slang', 'no_english', 'no_competitors', 'no_urgency']::text[]
  );
exception when duplicate_object then null; end $$;

/* --- Migration for the alphabet and the weather ------------------------------ */
/* ad_script: which alphabet the engine writes Serbian ads in - 'latin' or      */
/* 'cyrillic'. Asked only where Cyrillic is in everyday use (Serbia, Bosnia and */
/* Herzegovina, Montenegro); null means nobody picked, and the engine writes    */
/* Latin, the one most people read online. It changes the letters, never the   */
/* words, and says nothing about ads in English.                                */
/* weather_ads: on unless the customer switches it off in the control room      */
/* (weather.js). While on, the engine reads the forecast for the business's     */
/* city when it renders a drop and fits each ad to the weather of the day it    */
/* posts: something warm on a cold wet day, the terrace and cold drinks in a    */
/* heat wave, and never "come and sit outside" on a day set to pour. Off, the   */
/* ads ignore the weather.                                                      */
alter table public.profiles add column if not exists ad_script   text;
alter table public.profiles add column if not exists weather_ads boolean not null default true;

do $$ begin
  alter table public.profiles add constraint profiles_ad_script check (
    ad_script is null or ad_script in ('latin', 'cyrillic')
  );
exception when duplicate_object then null; end $$;

/* Existing paying accounts predate current_period_end - seed it from the trial
   date they already have so finalize_billing_period() has an anchor to work from. */
update public.profiles
   set current_period_end = trial_ends_at
 where current_period_end is null
   and trial_ends_at is not null;

alter table public.profiles alter column trial_started_at    drop not null;
alter table public.profiles alter column trial_ends_at       drop not null;
alter table public.profiles alter column subscription_status drop not null;
alter table public.profiles alter column trial_started_at    drop default;
alter table public.profiles alter column trial_ends_at       drop default;
alter table public.profiles alter column subscription_status drop default;

/* ------------------------------------------------------------ */
/* 3. drops - one weekly batch of creatives per account */
/* ------------------------------------------------------------ */
create table if not exists public.drops (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  week_starting date not null,
  status        public.drop_status not null default 'rendering',
  theme         text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, week_starting)
);

create index if not exists drops_user_idx on public.drops (user_id, week_starting desc);

/* ------------------------------------------------------------ */
/* 4. creatives - individual ads inside a drop (swipe approval) */
/* ------------------------------------------------------------ */
create table if not exists public.creatives (
  id           uuid primary key default gen_random_uuid(),
  drop_id      uuid not null references public.drops (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  channel      text not null,
  format       text,
  headline     text,
  caption      text,
  image_url    text,
  status       public.creative_status not null default 'pending',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

/* --- Migration for customer feedback and text edits ------------------------ */
/* reject_reason / reject_note: why the customer killed a creative, read by the  */
/* engine when it renders the next drop. Cleared when the creative goes back to  */
/* the queue or gets approved.                                                    */
/* original_headline / original_caption: what the engine wrote, kept the first   */
/* time the customer edits the text so the engine can learn from the difference. */
/* Null means the text was never edited.                                          */
alter table public.creatives add column if not exists reject_reason     text;
alter table public.creatives add column if not exists reject_note       text;
alter table public.creatives add column if not exists original_headline text;
alter table public.creatives add column if not exists original_caption  text;
alter table public.creatives add column if not exists edited_at         timestamptz;

do $$ begin
  alter table public.creatives add constraint creatives_customer_fields check (
    (reject_reason is null or reject_reason in ('image', 'tone', 'facts', 'timing', 'other'))
    and char_length(coalesce(reject_note, '')) <= 500
    and char_length(coalesce(headline, '')) <= 200
    and char_length(coalesce(caption, '')) <= 2200
  ) not valid;
exception when duplicate_object then null; end $$;

/* --- Migration for customer-picked posting times ---------------------------- */
/* rescheduled_at: stamped by protect_creative_fields when the customer moves an */
/* approved creative to a time of their own. While it is set, the engine keeps   */
/* scheduled_at as the customer left it instead of picking its own best time.    */
/* Null means the time (if any) is the engine's.                                  */
alter table public.creatives add column if not exists rescheduled_at timestamptz;

/* --- Migration for "did this ad bring anyone in?" --------------------------- */
/* outcome: the customer's answer, asked in the control room a couple of days   */
/* after an ad went out - 'yes' (someone came in or mentioned it), 'unsure' or  */
/* 'no'. outcome_at is stamped by protect_creative_fields. Null: not asked yet. */
alter table public.creatives add column if not exists outcome    text;
alter table public.creatives add column if not exists outcome_at timestamptz;

do $$ begin
  alter table public.creatives add constraint creatives_outcome check (
    outcome is null or outcome in ('yes', 'unsure', 'no')
  ) not valid;
exception when duplicate_object then null; end $$;

/* --- Migration for auto-approval -------------------------------------------- */
/* decided_at: the last time the customer approved, rejected or put back this   */
/* creative (stamped by protect_creative_fields). An ad they have touched is     */
/* never approved for them - "undo approval" stays undone.                      */
/* auto_approved_at: set by auto_approve_due() when it approved the ad because  */
/* the customer didn't get to it in 48 hours; cleared the moment the customer   */
/* decides it themselves. The engine reads it too: silence isn't a "yes, more   */
/* like this".                                                                   */
alter table public.creatives add column if not exists decided_at       timestamptz;
alter table public.creatives add column if not exists auto_approved_at timestamptz;

/* expired_at: when expire_unreviewed() let this ad go (status 'expired'). */
alter table public.creatives add column if not exists expired_at timestamptz;

/* ready_at: when the drop landed in Approvals (its status became               */
/* awaiting_approval), stamped by drops_stamp_ready below. The 48 hours of      */
/* auto-approval count from here.                                                */
alter table public.drops add column if not exists ready_at timestamptz;

update public.drops
   set ready_at = coalesce(updated_at, created_at)
 where ready_at is null
   and status <> 'rendering';

create index if not exists creatives_drop_idx on public.creatives (drop_id);
create index if not exists creatives_user_idx on public.creatives (user_id, created_at desc);

/* ------------------------------------------------------------ */
/* 5. contact_requests - the "Contact" / talk-to-sales form. */
/*    Public form: anyone may insert, nobody may read from the browser. */
/* ------------------------------------------------------------ */
create table if not exists public.contact_requests (
  id            uuid primary key default gen_random_uuid(),
  business_name text,
  full_name     text,
  email         text not null,
  plan_interest text,
  message       text,
  status        public.lead_status not null default 'new',
  created_at    timestamptz not null default now()
);

/* ------------------------------------------------------------ */
/* 6. messages - the "Message us" form */
/* ------------------------------------------------------------ */
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  full_name  text,
  email      text not null,
  message    text not null,
  status     public.lead_status not null default 'new',
  created_at timestamptz not null default now()
);

/* ------------------------------------------------------------ */
/* 6b. cancellation_feedback - the optional "why are you leaving?" answer */
/*     from the account page's Cancel subscription step. A customer may add  */
/*     their own answer, nobody may read them from the browser - read them in */
/*     the Supabase dashboard. The plan columns are copied from the profile   */
/*     by the trigger below, never taken from the browser. Deleting the       */
/*     account keeps the answer but drops who gave it (on delete set null).   */
/* ------------------------------------------------------------ */
create table if not exists public.cancellation_feedback (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid default auth.uid() references public.profiles (id) on delete set null,
  reason              text,
  note                text,
  plan                public.plan_tier,
  billing_cycle       text,
  subscription_status public.subscription_status,
  subscribed_since    timestamptz,
  created_at          timestamptz not null default now()
);

do $$ begin
  alter table public.cancellation_feedback add constraint cancellation_feedback_fields check (
    (reason is null or reason in ('price', 'quality', 'time', 'results', 'closing', 'other'))
    and char_length(coalesce(note, '')) <= 1000
    and (reason is not null or note is not null)
  );
exception when duplicate_object then null; end $$;

create or replace function public.fill_cancellation_feedback()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.user_id := auth.uid();
  new.created_at := now();
  select p.plan, p.billing_cycle, p.subscription_status, p.trial_started_at
    into new.plan, new.billing_cycle, new.subscription_status, new.subscribed_since
    from public.profiles p
   where p.id = auth.uid();
  return new;
end;
$$;

drop trigger if exists cancellation_feedback_fill on public.cancellation_feedback;
create trigger cancellation_feedback_fill
  before insert on public.cancellation_feedback
  for each row execute function public.fill_cancellation_feedback();

/* ------------------------------------------------------------ */
/* 7. updated_at trigger */
/* ------------------------------------------------------------ */
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists drops_set_updated_at on public.drops;
create trigger drops_set_updated_at
  before update on public.drops
  for each row execute function public.set_updated_at();

drop trigger if exists creatives_set_updated_at on public.creatives;
create trigger creatives_set_updated_at
  before update on public.creatives
  for each row execute function public.set_updated_at();

/* ------------------------------------------------------------ */
/* 7b. channel_limit - how many channels a plan publishes to: one on Free,  */
/*     two on Counter, four on Storefront and Beta, every one (null) on     */
/*     Franchise. Mirrors CHANNEL_LIMITS in brief-fields.js and the pricing */
/*     section.                                                             */
/* ------------------------------------------------------------ */
create or replace function public.channel_limit(p_plan public.plan_tier)
returns int
language sql
immutable
as $$
  select case p_plan::text
    when 'counter'    then 2
    when 'storefront' then 4
    when 'beta'       then 4
    when 'franchise'  then null
    else 1
  end
$$;

/* The plan whose channel allowance applies to an account: the one running (a
   failed charge included - it is still their plan), the one picked at signup
   while no plan has ever run, and Free once a plan has ended. */
create or replace function public.channel_plan(p public.profiles)
returns public.plan_tier
language sql
immutable
as $$
  select case
    when p.subscription_status in ('trialing', 'active', 'past_due') then p.plan
    when p.subscription_status is null then p.plan
    else 'free'::public.plan_tier
  end
$$;

/* --- Migration for referrals ------------------------------------------------ */
/* referred_by: the code of the tester whose invite link brought this account   */
/* (the first 8 characters of their id - see referrer_name and my_referrals).    */
/* Set once, at signup, from the link (?ref= on invite.html, kept by signup);    */
/* the customer can't change it afterwards (protect_profile_billing).            */
alter table public.profiles add column if not exists referred_by text;

/* ------------------------------------------------------------ */
/* 8. Auto-create a profile whenever a user signs up. */
/*    Reads the metadata passed in supabase.auth.signUp({ options: { data: ... } }). */
/* ------------------------------------------------------------ */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  /* 'beta' is never a signup's pick - only the portal gives it. */
  picked public.plan_tier := (nullif(nullif(new.raw_user_meta_data ->> 'plan', ''), 'beta'))::public.plan_tier;
begin
  insert into public.profiles (
    id, email, business_name, country, city, vertical, website,
    address, opening_hours, phone,
    google_maps_url, profile_cleanup, profile_cleanup_note,
    what_you_sell, typical_customer, differentiator, why_us,
    brand_vibe, brand_colors, avoid_notes, ad_script, channels, plan,
    terms_accepted_at, terms_version, referred_by
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'business_name', ''),
    nullif(new.raw_user_meta_data ->> 'country', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'vertical', ''),
    nullif(new.raw_user_meta_data ->> 'website', ''),
    left(nullif(btrim(new.raw_user_meta_data ->> 'address'), ''), 200),
    left(nullif(btrim(new.raw_user_meta_data ->> 'opening_hours'), ''), 300),
    left(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), 40),
    left(nullif(btrim(new.raw_user_meta_data ->> 'google_maps_url'), ''), 500),
    case when new.raw_user_meta_data ->> 'profile_cleanup' in ('delete', 'keep', 'you_decide', 'other')
      then new.raw_user_meta_data ->> 'profile_cleanup' end,
    case when new.raw_user_meta_data ->> 'profile_cleanup' = 'other'
      then left(nullif(btrim(new.raw_user_meta_data ->> 'profile_cleanup_note'), ''), 500) end,
    nullif(new.raw_user_meta_data ->> 'what_you_sell', ''),
    nullif(new.raw_user_meta_data ->> 'typical_customer', ''),
    nullif(new.raw_user_meta_data ->> 'differentiator', ''),
    nullif(new.raw_user_meta_data ->> 'why_us', ''),
    nullif(new.raw_user_meta_data ->> 'brand_vibe', ''),
    nullif(new.raw_user_meta_data ->> 'brand_colors', ''),
    nullif(new.raw_user_meta_data ->> 'avoid_notes', ''),
    case when new.raw_user_meta_data ->> 'ad_script' in ('latin', 'cyrillic')
      then new.raw_user_meta_data ->> 'ad_script' end,
    /* No more channels than the picked plan publishes to (limit null = all). */
    coalesce(
      (select array_agg(value #>> '{}')
         from (select value
                 from jsonb_array_elements(
                   case jsonb_typeof(new.raw_user_meta_data -> 'channels')
                     when 'array' then new.raw_user_meta_data -> 'channels'
                     else '[]'::jsonb
                   end)
                limit public.channel_limit(picked)) picked_channels),
      '{}'
    ),
    picked,
    /* The server clock, not the browser's: the signup request is the moment the
       box was ticked, and a timestamp the browser sends could say anything. */
    case when nullif(new.raw_user_meta_data ->> 'terms_version', '') is not null then now() end,
    nullif(new.raw_user_meta_data ->> 'terms_version', ''),
    case when (new.raw_user_meta_data ->> 'ref') ~ '^[0-9a-f]{8}$' then new.raw_user_meta_data ->> 'ref' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* profiles.email follows the login email. The customer can't edit it directly
   (see protect_profile_billing) - it changes only once Supabase has confirmed a
   new address, so mail meant for the account never goes somewhere unverified. */
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email();

/* Bring rows already out of step (email changed before this trigger existed). */
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

/* ------------------------------------------------------------ */
/* 8a. delete_my_account - self-serve account deletion. */
/*     Removes the login itself; profiles, drops and creatives go with it      */
/*     through their on delete cascade. The account page asks for the         */
/*     password first. auth.js cancels the Paddle subscription (through the   */
/*     paddle Edge Function) before this runs. */
/* ------------------------------------------------------------ */
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

/* ------------------------------------------------------------ */
/* 8a-beta. apply_for_beta - a signed-in account applies for a beta place. */
/*     During the beta, applying IS signing up: the account and the business */
/*     brief come first, so whoever is picked can log straight in. This turns */
/*     the account into an application: one contact_requests row with       */
/*     plan_interest 'beta' (the portal's inbox, and the email notify.sql    */
/*     sends), built here from the profile so the browser can't put words in */
/*     it, and profiles.beta_applied_at stamped so it is only sent once.     */
/*     The customer can't set beta_applied_at themselves: it isn't among the */
/*     fields protect_profile_billing lets them change. */
/* ------------------------------------------------------------ */
alter table public.profiles add column if not exists beta_applied_at timestamptz;

/* beta_seats - how many beta places there are, how many are taken and how
   many are left: {"seats": 12, "taken": 9, "left": 3}. The number of places
   is set in the Adronis Portal (app_settings 'beta_seats', {"seats": 12});
   taken is every account with the Beta plan on. null while no number is set
   - then nothing is limited. signup.html and beta.html read it to say the
   beta is full instead of taking an application, and apply_for_beta refuses
   one while it is. Anyone may ask: it says no more than the page does. */
create or replace function public.beta_seats()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  seats int;
  taken int;
begin
  /* app_settings comes with the portal's portal-admin.sql. */
  if to_regclass('public.app_settings') is null then
    return null;
  end if;
  select case when jsonb_typeof(value->'seats') = 'number' then (value->>'seats')::int end
    into seats
    from public.app_settings where key = 'beta_seats';
  if seats is null then
    return null;
  end if;
  select count(*) into taken
    from public.profiles
   where plan::text = 'beta' and subscription_status = 'active';
  return json_build_object('seats', seats, 'taken', taken, 'left', greatest(seats - taken, 0));
end;
$$;

grant execute on function public.beta_seats() to anon, authenticated;

create or replace function public.apply_for_beta(p_note text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p    public.profiles;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Not signed in.';
  end if;
  if p.onboarded_at is null then
    raise exception 'Tell us about your business first.';
  end if;
  if p.beta_applied_at is not null then
    return p.beta_applied_at;
  end if;
  if coalesce((public.beta_seats() ->> 'left')::int, 1) <= 0 then
    raise exception 'The beta is full right now - every place is taken.';
  end if;

  insert into public.contact_requests (business_name, email, plan_interest, message)
  values (
    left(p.business_name, 200),
    p.email,
    'beta',
    left(concat_ws(E'\n',
      'Beta application',
      'Where: '         || nullif(concat_ws(', ', p.city, p.country), ''),
      'Business type: ' || p.vertical,
      'Website / Instagram: ' || nullif(p.website, ''),
      'Address: '       || nullif(p.address, ''),
      'Opening hours: ' || nullif(p.opening_hours, ''),
      'Phone: '         || nullif(p.phone, ''),
      'Google Maps: '   || nullif(p.google_maps_url, ''),
      'Alphabet for Serbian ads: ' || case p.ad_script when 'cyrillic' then 'Cyrillic' when 'latin' then 'Latin' end,
      'Channels: '      || nullif(array_to_string(p.channels, ', '), ''),
      'Clear the old profiles first: ' || case p.profile_cleanup
        when 'delete' then 'yes, delete everything'
        when 'keep' then 'no, keep everything'
        when 'you_decide' then 'up to us'
        when 'other' then coalesce(p.profile_cleanup_note, 'other')
      end,
      '',
      'What they sell: '    || p.what_you_sell,
      'Typical customer: '  || p.typical_customer,
      'What makes them different: ' || nullif(p.differentiator, ''),
      'Why they came to us: '       || p.why_us,
      case when note is not null then E'\nNote: ' || left(note, 1000) end
    ), 5000)
  );

  update public.profiles set beta_applied_at = now() where id = p.id;
  return now();
end;
$$;

revoke execute on function public.apply_for_beta(text) from public, anon;
grant execute on function public.apply_for_beta(text) to authenticated;

/* ------------------------------------------------------------ */
/* 8a-seen. touch_last_seen - when the customer was last on the site.  */
/*     auth.js calls it when a signed-in page loads, so the Adronis     */
/*     Portal can tell a beta tester who has gone quiet. Only the       */
/*     database's own clock is stored, and at most every 10 minutes.    */
/*     The customer can't write last_seen_at directly: it isn't among   */
/*     the fields protect_profile_billing lets them change. */
/* ------------------------------------------------------------ */
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
$$;

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

/* ------------------------------------------------------------ */
/* 8b. start_trial - the only way a trial ever begins. */
/*     Called from checkout.js once the card has been captured. Refuses to run  */
/*     while the business brief is missing, so the trial can never start        */
/*     straight off a plan click. */
/*     One trial per account: trial_started_at is never cleared, so a customer */
/*     who already had a trial (then canceled) starts paid from day one - the  */
/*     first period is charged now instead of handing out another free week.  */
/* ------------------------------------------------------------ */
create or replace function public.start_trial(
  p_plan  public.plan_tier,
  p_cycle text default 'monthly'
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select * into row_out from public.profiles where id = auth.uid();

  if row_out.onboarded_at is null then
    raise exception 'Finish the business brief before starting a trial.';
  end if;

  if coalesce(p_plan, row_out.plan) is null or coalesce(p_plan, row_out.plan) = 'free' then
    raise exception 'Pick a paid plan to start a trial.';
  end if;

  /* Already on a trial or paying: don't restart the clock. */
  if row_out.subscription_status in ('trialing', 'active') then
    return row_out;
  end if;

  /* Returning customer: no second trial. The first period starts and is
     billed today, snapshotted into billing_history like any renewal. */
  if row_out.trial_started_at is not null then
    update public.profiles
       set plan                  = coalesce(p_plan, plan),
           billing_cycle         = coalesce(p_cycle, 'monthly'),
           payment_method_at     = now(),
           subscription_status   = 'active',
           current_period_end    = now() + case when coalesce(p_cycle, 'monthly') = 'annual'
                                                then interval '12 months' else interval '1 month' end,
           cancel_at_period_end  = false,
           pending_plan          = null,
           pending_billing_cycle = null,
           billing_history       = billing_history || jsonb_build_array(jsonb_build_object(
                                     'period_start', now(),
                                     'plan', coalesce(p_plan, row_out.plan),
                                     'cycle', coalesce(p_cycle, 'monthly')))
     where id = auth.uid()
     returning * into row_out;

    return row_out;
  end if;

  update public.profiles
     set plan                  = coalesce(p_plan, plan),
         billing_cycle         = coalesce(p_cycle, 'monthly'),
         payment_method_at     = now(),
         subscription_status   = 'trialing',
         trial_started_at      = now(),
         trial_ends_at         = now() + interval '7 days',
         current_period_end    = now() + interval '7 days',
         cancel_at_period_end  = false,
         pending_plan          = null,
         pending_billing_cycle = null
   where id = auth.uid()
   returning * into row_out;

  return row_out;
end;
$$;

/* Paddle handles this now (supabase/functions/paddle) - the browser may not call it. */
revoke execute on function public.start_trial(public.plan_tier, text) from public, anon, authenticated;

/* ------------------------------------------------------------ */
/* 8c. finalize_billing_period - ends a plan whose date has passed with no    */
/*     Paddle subscription behind it. Every trial and paid plan is a Paddle    */
/*     subscription, which renews, switches and ends through Paddle's own     */
/*     webhooks. A dated plan without one (only ever set by hand, before       */
/*     Paddle) is never renewed here - nobody would be charged for it - so    */
/*     once its date passes it ends and the account drops to Free. Called     */
/*     from auth.js on every profile load, so the account.html gate reflects  */
/*     it the moment the date arrives. A plan given for good has no date and  */
/*     is left alone. */
/* ------------------------------------------------------------ */
create or replace function public.finalize_billing_period()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select * into row_out from public.profiles where id = auth.uid();

  if row_out.paddle_subscription_id is not null
     or row_out.current_period_end is null
     or row_out.current_period_end > now()
     or row_out.subscription_status not in ('trialing', 'active') then
    return row_out;
  end if;

  update public.profiles
     set subscription_status   = 'canceled',
         cancel_at_period_end  = false,
         pending_plan          = null,
         pending_billing_cycle = null
   where id = auth.uid()
   returning * into row_out;

  return row_out;
end;
$$;

grant execute on function public.finalize_billing_period() to authenticated;

/* ------------------------------------------------------------ */
/* 8d. cancel_at_period_end / resume_subscription - self-serve cancellation.   */
/*     Cancelling never revokes access immediately - it flips                  */
/*     cancel_at_period_end, and finalize_billing_period() is what actually    */
/*     ends the plan once current_period_end arrives. */
/* ------------------------------------------------------------ */
create or replace function public.cancel_at_period_end()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  update public.profiles
     set cancel_at_period_end = true
   where id = auth.uid()
     and subscription_status in ('trialing', 'active')
   returning * into row_out;

  if row_out is null then
    raise exception 'No active plan to cancel.';
  end if;

  return row_out;
end;
$$;

/* Paddle handles this now (supabase/functions/paddle) - the browser may not call it. */
revoke execute on function public.cancel_at_period_end() from public, anon, authenticated;

create or replace function public.resume_subscription()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  update public.profiles
     set cancel_at_period_end = false
   where id = auth.uid()
   returning * into row_out;

  return row_out;
end;
$$;

/* Paddle handles this now (supabase/functions/paddle) - the browser may not call it. */
revoke execute on function public.resume_subscription() from public, anon, authenticated;

/* ------------------------------------------------------------ */
/* 8e. schedule_plan_change / cancel_plan_change - self-serve plan switching.  */
/*     A switch is only ever scheduled for the next renewal, never applied on  */
/*     the spot - matches "you paid for this period, the new plan starts next  */
/*     billing date" rather than prorating a switch mid-period. */
/* ------------------------------------------------------------ */
create or replace function public.schedule_plan_change(
  p_plan  public.plan_tier,
  p_cycle text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select * into row_out from public.profiles where id = auth.uid();

  if row_out.subscription_status not in ('trialing', 'active') then
    raise exception 'No active plan to change.';
  end if;
  if row_out.cancel_at_period_end then
    raise exception 'Your plan is set to cancel - resume it first.';
  end if;
  if p_plan = 'free' then
    raise exception 'To move to Free, cancel your plan - it drops to Free when this period ends.';
  end if;

  /* Picking what's already running just clears any pending switch. */
  if p_plan = row_out.plan and coalesce(p_cycle, row_out.billing_cycle) = row_out.billing_cycle then
    update public.profiles
       set pending_plan = null, pending_billing_cycle = null
     where id = auth.uid()
     returning * into row_out;
    return row_out;
  end if;

  update public.profiles
     set pending_plan          = p_plan,
         pending_billing_cycle = coalesce(p_cycle, row_out.billing_cycle)
   where id = auth.uid()
   returning * into row_out;

  return row_out;
end;
$$;

/* Paddle handles this now (supabase/functions/paddle) - the browser may not call it. */
revoke execute on function public.schedule_plan_change(public.plan_tier, text) from public, anon, authenticated;

create or replace function public.cancel_plan_change()
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_out public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  update public.profiles
     set pending_plan = null, pending_billing_cycle = null
   where id = auth.uid()
   returning * into row_out;

  return row_out;
end;
$$;

/* Paddle handles this now (supabase/functions/paddle) - the browser may not call it. */
revoke execute on function public.cancel_plan_change() from public, anon, authenticated;

/* ------------------------------------------------------------ */
/* 8f. Free plan - a monthly allowance of creatives for every account without  */
/*     a running trial or subscription (never paid, or canceled). Months are   */
/*     calendar months in UTC. The limit lives only here - the site reads it  */
/*     through free_quota(), and the trigger below refuses to insert past it,  */
/*     so the engine can't over-deliver to a free account by mistake. */
/* ------------------------------------------------------------ */
/* Beta (until the public launch in Q1 2027): 0, so no account gets a creative
   unless its plan was switched on from the portal - only beta testers use
   Adronis. Back to 3 at launch, with BETA in auth.js. */
create or replace function public.free_images_per_month()
returns int
language sql
immutable
as $$ select 0 $$;

create or replace function public.free_quota()
returns json
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  used        int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select count(*) into used
    from public.creatives
   where user_id = auth.uid()
     and created_at >= month_start;

  return json_build_object(
    'used', used,
    'limit', public.free_images_per_month(),
    'resets_at', month_start + interval '1 month'
  );
end;
$$;

grant execute on function public.free_quota() to authenticated;

create or replace function public.enforce_free_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_status public.subscription_status;
  month_start  timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  used         int;
begin
  select subscription_status into owner_status
    from public.profiles
   where id = new.user_id;

  if owner_status in ('trialing', 'active') then
    return new;
  end if;

  /* Rows inserted earlier in the same statement are visible here, so a bulk
     insert of five into a free account fails as a whole instead of slipping
     all five through. */
  select count(*) into used
    from public.creatives
   where user_id = new.user_id
     and created_at >= month_start;

  if used >= public.free_images_per_month() then
    raise exception 'Free plan limit reached: this account already has % creatives this month.',
      public.free_images_per_month();
  end if;

  return new;
end;
$$;

drop trigger if exists creatives_enforce_free_quota on public.creatives;
create trigger creatives_enforce_free_quota
  before insert on public.creatives
  for each row execute function public.enforce_free_quota();

/* ------------------------------------------------------------ */
/* 8g. What a customer may write from the browser. */
/*     RLS lets a customer update their own profiles/creatives rows, but on   */
/*     its own it can't limit WHICH columns - so a signed-in customer could   */
/*     set subscription_status = 'active' from the browser console and get a */
/*     paid plan (and dodge the free quota) without paying, or backdate their */
/*     creatives' created_at so this month's free allowance looked unused.   */
/*     Browser requests run as the 'authenticated' / 'anon' roles. The        */
/*     billing functions above are security definer and run as their owner,  */
/*     and the dashboard / service role run as themselves, so none of those  */
/*     are affected by these checks. Both guards start from the stored row    */
/*     and copy over only the columns the customer may edit, so a column     */
/*     added later is locked by default. */
/* ------------------------------------------------------------ */
create or replace function public.protect_profile_billing()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  editable public.profiles;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  /* Only auth.js's fallback insert (for an account whose row the signup
     trigger never made) gets here - it carries the brief, never billing. */
  if tg_op = 'INSERT' then
    if new.subscription_status is not null
       or new.billing_cycle is not null
       or new.trial_started_at is not null
       or new.trial_ends_at is not null
       or new.payment_method_at is not null
       or new.current_period_end is not null
       or new.cancel_at_period_end
       or new.pending_plan is not null
       or new.pending_billing_cycle is not null
       or new.billing_history <> '[]'::jsonb
       or new.paddle_customer_id is not null
       or new.paddle_subscription_id is not null
       or new.paddle_period_start is not null
       or new.paddle_updated_at is not null
       or new.paddle_discount is not null then
      raise exception 'Billing details can only be set through checkout.';
    end if;
    if new.plan::text = 'beta' then
      raise exception 'The Beta plan is switched on by Adronis.';
    end if;
    /* The row's email is the signed-in account's, whatever the browser sent. */
    new.email := coalesce(auth.jwt() ->> 'email', new.email);
    new.auto_approve_at := case when new.auto_approve then now() end;
    return new;
  end if;

  editable                  := old;
  editable.business_name    := new.business_name;
  editable.country          := new.country;
  editable.city             := new.city;
  editable.vertical         := new.vertical;
  editable.website          := new.website;
  editable.address          := new.address;
  editable.opening_hours    := new.opening_hours;
  editable.phone            := new.phone;
  editable.google_maps_url  := new.google_maps_url;
  editable.profile_cleanup  := new.profile_cleanup;
  editable.profile_cleanup_note := new.profile_cleanup_note;
  editable.auto_approve     := new.auto_approve;
  editable.what_you_sell    := new.what_you_sell;
  editable.typical_customer := new.typical_customer;
  editable.differentiator   := new.differentiator;
  editable.why_us           := new.why_us;
  editable.brand_vibe       := new.brand_vibe;
  editable.brand_colors     := new.brand_colors;
  editable.avoid_notes      := new.avoid_notes;
  editable.avoid_tags       := new.avoid_tags;
  editable.closed_days      := new.closed_days;
  editable.ad_script        := new.ad_script;
  editable.weather_ads      := new.weather_ads;
  editable.channels         := new.channels;
  editable.next_week_note   := new.next_week_note;
  editable.tours_seen       := new.tours_seen;
  editable.onboarded_at     := new.onboarded_at;
  editable.plan             := new.plan;
  editable.updated_at       := new.updated_at;
  /* The signup brief re-sends the consent line. Accepted here, but the date
     is stamped by the database below, never taken from the browser. */
  editable.terms_version     := new.terms_version;
  editable.terms_accepted_at := new.terms_accepted_at;

  if new is distinct from editable then
    raise exception 'Billing details can only be changed through checkout or your account page.';
  end if;

  /* plan is only the customer's pick until a subscription starts. While one
     is running, the engine renders to it - switching goes through
     schedule_plan_change(), so what's rendered always matches what's billed. */
  if new.plan is distinct from old.plan
     and old.subscription_status in ('trialing', 'active', 'past_due') then
    raise exception 'Change your plan from the account page - it switches at your next billing date.';
  end if;

  /* Only the portal gives the Beta plan (admin_set_plan_state). Picked from
     the browser it would pass for a tester's plan and its four channels. */
  if new.plan is distinct from old.plan and new.plan::text = 'beta' then
    raise exception 'The Beta plan is switched on by Adronis.';
  end if;

  /* No more channels than the plan publishes to. Checked only when the
     channels change, so an account left over its number by a smaller plan
     can still save everything else while it picks which ones to keep. */
  if new.channels is distinct from old.channels
     and public.channel_limit(public.channel_plan(new)) is not null
     and cardinality(new.channels) > public.channel_limit(public.channel_plan(new)) then
    raise exception 'Your plan publishes to % channel(s) - untick some before saving.',
      public.channel_limit(public.channel_plan(new));
  end if;

  if new.next_week_note is distinct from old.next_week_note then
    new.next_week_note_at := now();
  end if;

  /* Every closed stretch is two real dates in order, at most three months
     long, with a short note at most. */
  if new.closed_days is distinct from old.closed_days then
    if exists (
      select 1 from jsonb_array_elements(new.closed_days) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e->>'from', '') !~ '^\d{4}-\d{2}-\d{2}$'
          or coalesce(e->>'to', '') !~ '^\d{4}-\d{2}-\d{2}$'
          or char_length(coalesce(e->>'note', '')) > 120
    ) then
      raise exception 'Each closed stretch needs a first and a last day.';
    end if;
    begin
      if exists (
        select 1 from jsonb_array_elements(new.closed_days) e
         where (e->>'to')::date < (e->>'from')::date
            or (e->>'to')::date - (e->>'from')::date > 92
      ) then
        raise exception 'The last closed day has to be on or after the first, at most three months later.';
      end if;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Each closed stretch needs a first and a last day.';
    end;
  end if;

  /* The 48 hours of auto-approval count from when the switch went on. */
  if new.auto_approve is distinct from old.auto_approve then
    new.auto_approve_at := case when new.auto_approve then now() end;
  end if;

  /* Consent evidence is never cleared or backdated: a new version gets
     today's date, anything else keeps what was already recorded. */
  if new.terms_version is not null and new.terms_version is distinct from old.terms_version then
    new.terms_accepted_at := now();
  else
    new.terms_version     := old.terms_version;
    new.terms_accepted_at := old.terms_accepted_at;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing
  before insert or update on public.profiles
  for each row execute function public.protect_profile_billing();

/* A customer approves or rejects a creative, says why they rejected it, and
   may rewrite its headline and caption before it goes out. Once it has gone
   out, they may say whether it brought anyone in. The image, channel,
   schedule and everything else belong to the engine. */
create or replace function public.protect_creative_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  editable public.creatives;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  editable               := old;
  editable.status        := new.status;
  editable.reject_reason := new.reject_reason;
  editable.reject_note   := new.reject_note;
  editable.headline      := new.headline;
  editable.caption       := new.caption;
  editable.scheduled_at  := new.scheduled_at;
  editable.outcome       := new.outcome;
  editable.updated_at    := new.updated_at;

  if new is distinct from editable then
    raise exception 'Only a creative''s approval, feedback, text and posting time can be changed.';
  end if;

  /* An expired ad stays as it was: it went when the next week's ads arrived,
     and only expire_unreviewed() lets an ad expire. */
  if old.status::text = 'expired' then
    raise exception 'This ad expired when the next week''s ads arrived - it can''t be changed now.';
  end if;
  if new.status::text = 'expired' then
    raise exception 'Ads expire on their own when the next week''s ads arrive.';
  end if;

  /* The customer may move an approved creative that hasn't gone out, or hand
     the time back to the engine (null). A slot about to go out (or going out
     right now) stays put, so the engine is never publishing something whose
     time just changed under it. */
  if new.scheduled_at is distinct from old.scheduled_at then
    if old.status <> 'approved' or new.status <> 'approved' then
      raise exception 'Only an approved creative that hasn''t gone out can be rescheduled.';
    end if;
    if old.scheduled_at is not null
       and old.scheduled_at > now() - interval '15 minutes'
       and old.scheduled_at < now() + interval '10 minutes' then
      raise exception 'This creative is about to go out - its time can''t change now.';
    end if;
    if new.scheduled_at is not null then
      if new.scheduled_at < now() + interval '10 minutes' then
        raise exception 'Pick a time at least 10 minutes from now.';
      end if;
      if new.scheduled_at > now() + interval '90 days' then
        raise exception 'Pick a time within the next 90 days.';
      end if;
      new.rescheduled_at := now();
    else
      new.rescheduled_at := null;
    end if;
  end if;

  if new.status is distinct from old.status
     and (old.status = 'published' or new.status = 'published') then
    raise exception 'Publishing is handled by Adronis.';
  end if;

  /* The customer decided this one themselves: it is theirs from now on, and
     auto-approval never touches it again. */
  if new.status is distinct from old.status then
    new.decided_at       := now();
    new.auto_approved_at := null;
  end if;

  if new.outcome is distinct from old.outcome then
    if old.status <> 'published' then
      raise exception 'Only an ad that has gone out can say whether it brought people in.';
    end if;
    new.outcome_at := case when new.outcome is null then null else now() end;
  end if;

  if new.headline is distinct from old.headline or new.caption is distinct from old.caption then
    if old.status = 'published' then
      raise exception 'This creative is already live - its text can''t change now.';
    end if;
    /* Keep what the engine wrote, once - later edits never overwrite it. */
    if old.edited_at is null then
      new.original_headline := old.headline;
      new.original_caption  := old.caption;
    end if;
    new.edited_at := now();
  end if;

  /* A reason only means something while the creative stays rejected. */
  if new.status <> 'rejected' then
    new.reject_reason := null;
    new.reject_note   := null;
  end if;

  return new;
end;
$$;

drop trigger if exists creatives_protect_fields on public.creatives;
create trigger creatives_protect_fields
  before update on public.creatives
  for each row execute function public.protect_creative_fields();

/* A drop row moves through the queue on its own; the only thing the customer
   does to it is close it out once nothing is left waiting. The engine owns
   'rendering', 'published' and 'skipped'. */
create or replace function public.protect_drop_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  editable public.drops;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  editable            := old;
  editable.status     := new.status;
  editable.updated_at := new.updated_at;

  if new is distinct from editable then
    raise exception 'Only a drop''s status can be changed.';
  end if;

  if new.status is distinct from old.status
     and (new.status not in ('awaiting_approval', 'approved')
          or old.status not in ('awaiting_approval', 'approved')) then
    raise exception 'Adronis moves a drop through the rest of the queue.';
  end if;

  return new;
end;
$$;

drop trigger if exists drops_protect_fields on public.drops;
create trigger drops_protect_fields
  before update on public.drops
  for each row execute function public.protect_drop_fields();

/* ------------------------------------------------------------ */
/* 9. Row Level Security */
/*    RLS is NOT enabled by default on new tables - turn it on explicitly. */
/* ------------------------------------------------------------ */
alter table public.profiles         enable row level security;
alter table public.drops            enable row level security;
alter table public.creatives        enable row level security;
alter table public.contact_requests enable row level security;
alter table public.messages         enable row level security;
alter table public.cancellation_feedback enable row level security;

/* profiles: a user reads and edits only their own row */
drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

/* drops: read own, approve or skip own */
drop policy if exists "drops select own" on public.drops;
create policy "drops select own" on public.drops
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "drops update own" on public.drops;
create policy "drops update own" on public.drops
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* creatives: read own, approve or reject own */
drop policy if exists "creatives select own" on public.creatives;
create policy "creatives select own" on public.creatives
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "creatives update own" on public.creatives;
create policy "creatives update own" on public.creatives
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* contact_requests / messages: public forms. */
/* Anyone may submit. Nobody may read them from the browser - read them in the */
/* Supabase dashboard, which bypasses RLS. A beta application is only ever     */
/* written by apply_for_beta() from a real account's brief, so the browser may */
/* not post one itself (it would land in the portal as an application from    */
/* whatever email it named). */
drop policy if exists "contact insert public" on public.contact_requests;
create policy "contact insert public" on public.contact_requests
  for insert to anon, authenticated
  with check (status = 'new' and plan_interest is distinct from 'beta');

drop policy if exists "messages insert public" on public.messages;
create policy "messages insert public" on public.messages
  for insert to anon, authenticated with check (status = 'new');

/* ------------------------------------------------------------ */
/* demo_events - what visitors do in the public demo (demo.js), so the   */
/* Adronis Portal can tell whether it sells: opened, tried approving or  */
/* rejecting, looked at the control room, clicked Join the beta - and    */
/* opened a proposal (proposal.html) or the date calendar               */
/* (calendar.html). Each is sent once per browser tab, with no account,  */
/* cookie or IP - only a random tab id, where the visitor came from      */
/* (?src=, e.g. the QR card) and, from a link made for one business in   */
/* the portal's Sales tab, that business's code (prospects.code). Anyone */
/* may add a row, nobody may read them from the browser; the portal      */
/* reads them through its admin policy. */
/* ------------------------------------------------------------ */
create table if not exists public.demo_events (
  id         bigserial primary key,
  visit      text not null,
  event      text not null,
  src        text,
  created_at timestamptz not null default now()
);

alter table public.demo_events add column if not exists code text;

alter table public.demo_events enable row level security;

/* Dropped and added again on every run, so a new kind of event only needs
   adding here. */
alter table public.demo_events drop constraint if exists demo_events_fields;
alter table public.demo_events add constraint demo_events_fields check (
  event in ('open', 'approve', 'reject', 'control_room', 'join', 'proposal', 'calendar', 'review', 'invite')
  and char_length(visit) between 8 and 40
  and char_length(coalesce(src, '')) <= 40
  and char_length(coalesce(code, '')) <= 40
);

/* The time is the database's, whatever the browser sent. */
create or replace function public.stamp_demo_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists demo_events_stamp on public.demo_events;
create trigger demo_events_stamp
  before insert on public.demo_events
  for each row execute function public.stamp_demo_event();

drop policy if exists "demo events insert public" on public.demo_events;
create policy "demo events insert public" on public.demo_events
  for insert to anon, authenticated with check (true);

/* ------------------------------------------------------------ */
/* updates - short notes from the Adronis team in the control room:      */
/* "on your suggestion, you can now ..." for one customer (user_id), or  */
/* news for everyone (user_id null). The portal writes them              */
/* (admin_post_update in portal-admin.sql); a customer reads the ones    */
/* for them and the ones for everyone, and nothing else.                 */
/* ------------------------------------------------------------ */
create table if not exists public.updates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  body       text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists updates_user_idx on public.updates (user_id, created_at desc);

do $$ begin
  alter table public.updates add constraint updates_fields check (
    char_length(body) between 1 and 600
    and char_length(coalesce(created_by, '')) <= 100
  );
exception when duplicate_object then null; end $$;

alter table public.updates enable row level security;

drop policy if exists "updates select own" on public.updates;
create policy "updates select own" on public.updates
  for select to authenticated using (user_id is null or user_id = auth.uid());

/* ------------------------------------------------------------ */
/* local_events - dates worth an ad that belong to one town, or that move */
/* from year to year: a beer festival, the town's day, a match of the     */
/* national team (city null: the whole country). The portal adds them as  */
/* they're announced (portal-admin.sql gives admins the writes); the      */
/* control room offers the next one for the customer's own city and       */
/* country in its "coming up" card, next to the fixed dates in            */
/* dates-rs.js. Public facts, so anyone may read them.                    */
/* city and country are stored the way the brief stores them: country by  */
/* its English name, city as typed ("Novi Sad"); the browser matches the  */
/* city loosely (case, accents, Cyrillic, Belgrade = Beograd).            */
/* ------------------------------------------------------------ */
create table if not exists public.local_events (
  id         uuid primary key default gen_random_uuid(),
  country    text not null default 'Serbia',
  city       text,
  starts_on  date not null,
  ends_on    date,
  name_sr    text not null,
  name_en    text,
  idea_sr    text,
  idea_en    text,
  lead_days  int not null default 14,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists local_events_starts_idx on public.local_events (starts_on);

do $$ begin
  alter table public.local_events add constraint local_events_fields check (
    char_length(country) between 1 and 100
    and char_length(coalesce(city, '')) <= 100
    and char_length(name_sr) between 1 and 120
    and char_length(coalesce(name_en, '')) <= 120
    and char_length(coalesce(idea_sr, '')) <= 300
    and char_length(coalesce(idea_en, '')) <= 300
    and char_length(coalesce(created_by, '')) <= 100
    and (ends_on is null or ends_on >= starts_on)
    and lead_days between 1 and 60
  );
exception when duplicate_object then null; end $$;

alter table public.local_events enable row level security;

drop policy if exists "local events select all" on public.local_events;
create policy "local events select all" on public.local_events
  for select to anon, authenticated using (true);

/* ------------------------------------------------------------ */
/* ratings - "would you recommend Adronis?", asked in the control room   */
/* after three weeks of ads and again every six months, in the beta and  */
/* after it: one to five stars, a sentence, and whether we may publish   */
/* it with the business's name. Every answer is kept, so the portal can  */
/* show how a customer's view changes over time (portal-admin.sql).      */
/* ------------------------------------------------------------ */
create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  stars       int not null,
  comment     text,
  may_publish boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

/* The first version kept one rating per account (user_id was the key).
   Move an existing table to one row per answer, keeping what's there. */
alter table public.ratings add column if not exists id uuid not null default gen_random_uuid();
do $$ begin
  if exists (select 1 from pg_constraint c
              where c.conrelid = 'public.ratings'::regclass and c.contype = 'p'
                and pg_get_constraintdef(c.oid) like '%(user_id)%') then
    alter table public.ratings drop constraint ratings_pkey;
    alter table public.ratings add primary key (id);
  end if;
end $$;

create index if not exists ratings_user_idx on public.ratings (user_id, created_at desc);

do $$ begin
  alter table public.ratings add constraint ratings_fields check (
    stars between 1 and 5
    and char_length(coalesce(comment, '')) <= 500
  );
exception when duplicate_object then null; end $$;

drop trigger if exists ratings_set_updated_at on public.ratings;
create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

alter table public.ratings enable row level security;

drop policy if exists "ratings select own" on public.ratings;
create policy "ratings select own" on public.ratings
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "ratings insert own" on public.ratings;
create policy "ratings insert own" on public.ratings
  for insert to authenticated with check (user_id = auth.uid());
/* An answer, once given, stays as it was: a new one is a new row. */
drop policy if exists "ratings update own" on public.ratings;

/* ------------------------------------------------------------ */
/* Referrals - a tester's invite link is /u/<code>, the first 8          */
/* characters of their account id. referrer_name tells invite.html whose */
/* link it is (only a tester in the beta can invite); my_referrals tells */
/* the tester how many signed up through it, without saying who.         */
/* ------------------------------------------------------------ */
create or replace function public.referrer_name(p_code text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select business_name
    from public.profiles
   where p_code ~ '^[0-9a-f]{8}$'
     and left(id::text, 8) = p_code
     and plan::text = 'beta'
     and subscription_status in ('trialing', 'active')
   limit 1;
$$;

revoke execute on function public.referrer_name(text) from public;
grant execute on function public.referrer_name(text) to anon, authenticated;

create or replace function public.my_referrals()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'signed_up', count(*),
           'in_beta',   count(*) filter (where plan::text = 'beta'
                                           and subscription_status in ('trialing', 'active')))
    from public.profiles
   where referred_by = left(auth.uid()::text, 8);
$$;

revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

/* cancellation_feedback: a signed-in customer adds their own answer only. */
drop policy if exists "cancellation feedback insert own" on public.cancellation_feedback;
create policy "cancellation feedback insert own" on public.cancellation_feedback
  for insert to authenticated with check (user_id = auth.uid());

/* Size caps on the public forms. Anyone can insert, so without these a script
   could post megabytes per row. Generous for a real person; not valid-checked
   against rows already stored, so re-running never fails on old data. */
do $$ begin
  alter table public.contact_requests add constraint contact_requests_sizes check (
    char_length(email) <= 320
    and char_length(coalesce(business_name, '')) <= 200
    and char_length(coalesce(full_name, '')) <= 200
    and char_length(coalesce(plan_interest, '')) <= 50
    and char_length(coalesce(message, '')) <= 5000
  ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.messages add constraint messages_sizes check (
    char_length(email) <= 320
    and char_length(coalesce(full_name, '')) <= 200
    and char_length(message) <= 5000
  ) not valid;
exception when duplicate_object then null; end $$;

/* The business brief goes into every drop's prompt, so a pasted wall of text
   would cost on every render. Same caps as the brief fields in signup.html,
   account.html and the control room. */
do $$ begin
  alter table public.profiles add constraint profiles_brief_sizes check (
    char_length(coalesce(business_name, '')) <= 200
    and char_length(coalesce(country, '')) <= 100
    and char_length(coalesce(city, '')) <= 200
    and char_length(coalesce(vertical, '')) <= 200
    and char_length(coalesce(website, '')) <= 300
    and char_length(coalesce(what_you_sell, '')) <= 500
    and char_length(coalesce(typical_customer, '')) <= 500
    and char_length(coalesce(differentiator, '')) <= 1000
    and char_length(coalesce(why_us, '')) <= 2000
    and char_length(coalesce(brand_vibe, '')) <= 100
    and char_length(coalesce(brand_colors, '')) <= 200
    and char_length(coalesce(avoid_notes, '')) <= 1000
  ) not valid;
exception when duplicate_object then null; end $$;

/* ------------------------------------------------------------ */
/* 10. Brand material - the logo, photos and menu a customer uploads */
/*     in the control room (brand-assets.js). Files live in the private */
/*     "brand-assets" Storage bucket at <user id>/<kind>/<file>, where kind */
/*     is logo, photos or menu. Each account reads, adds and deletes only */
/*     its own folder; nobody can overwrite a file in place. The engine and */
/*     the admin portal read the bucket with the service role. */
/*     Deleting the account doesn't reach Storage, so LBAuth.deleteAccount */
/*     removes the files first (LBBrand.removeAll). */
/* ------------------------------------------------------------ */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* How many files of each kind an account may keep: one logo, twelve photos,
   three pages of menu. Keep in step with KINDS in brand-assets.js. */
create or replace function public.brand_asset_has_room(kind text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) < case kind when 'logo' then 1 when 'photos' then 12 when 'menu' then 3 else 0 end
    from storage.objects o
   where o.bucket_id = 'brand-assets'
     and (storage.foldername(o.name))[1] = auth.uid()::text
     and (storage.foldername(o.name))[2] = kind;
$$;

revoke execute on function public.brand_asset_has_room(text) from public, anon;
grant execute on function public.brand_asset_has_room(text) to authenticated;

drop policy if exists "brand assets select own" on storage.objects;
create policy "brand assets select own" on storage.objects
  for select to authenticated using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

/* A PDF is only a menu; the logo and photos are pictures. */
drop policy if exists "brand assets insert own" on storage.objects;
create policy "brand assets insert own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] in ('logo', 'photos', 'menu')
    and array_length(storage.foldername(name), 1) = 2
    and (lower(storage.extension(name)) in ('jpg', 'png', 'webp')
         or ((storage.foldername(name))[2] = 'menu' and lower(storage.extension(name)) = 'pdf'))
    and public.brand_asset_has_room((storage.foldername(name))[2])
  );

drop policy if exists "brand assets delete own" on storage.objects;
create policy "brand assets delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

/* ------------------------------------------------------------ */
/* 11. Auto-approval - "approve it for me if I don't get to it".     */
/*     A customer who switches profiles.auto_approve on (account      */
/*     page) has every ad still waiting 48 hours after it landed in   */
/*     Approvals approved for them. Ads they touched themselves       */
/*     (creatives.decided_at) are never approved for them. Runs every */
/*     15 minutes through pg_cron (section 13).                       */
/* ------------------------------------------------------------ */

/* drops.ready_at: when the drop landed in Approvals. Stamped the first time it
   is awaiting approval, and again if the engine renders it over (rendering ->
   awaiting_approval), so a re-rendered week gets its own 48 hours. Runs after
   drops_protect_fields (triggers fire in name order), which already refuses a
   ready_at sent from the browser. */
create or replace function public.stamp_drop_ready()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'awaiting_approval'
     and (new.ready_at is null or (tg_op = 'UPDATE' and old.status = 'rendering')) then
    new.ready_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists drops_stamp_ready on public.drops;
create trigger drops_stamp_ready
  before insert or update on public.drops
  for each row execute function public.stamp_drop_ready();

/* Approves what is due and returns how many ads it approved. The 48 hours count
   from the latest of: the drop landing, the ad itself appearing (a replacement
   added later gets its own two days) and the switch going on. An ad whose
   posting slot has already gone by loses the slot (scheduled_at null), so it is
   posted at the next good time instead of showing up as late. Only accounts
   with a running plan - a beta tester's included - are touched. */
create or replace function public.auto_approve_due()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  with due as (
    select c.id
      from public.creatives c
      join public.drops d    on d.id = c.drop_id
      join public.profiles p on p.id = c.user_id
     where c.status = 'pending'
       and c.decided_at is null
       and d.status = 'awaiting_approval'
       and p.auto_approve
       and p.subscription_status in ('trialing', 'active')
       and greatest(coalesce(d.ready_at, d.created_at), c.created_at, p.auto_approve_at)
           <= now() - interval '48 hours'
       for update of c skip locked
  )
  update public.creatives c
     set status           = 'approved',
         auto_approved_at = now(),
         scheduled_at     = case when c.scheduled_at < now() + interval '10 minutes'
                                 then null else c.scheduled_at end
    from due
   where c.id = due.id;
  get diagnostics n = row_count;

  /* A drop with nothing left waiting is approved, as when the customer clears it. */
  if n > 0 then
    update public.drops d
       set status = 'approved'
     where d.status = 'awaiting_approval'
       and exists (select 1 from public.creatives c
                    where c.drop_id = d.id and c.auto_approved_at is not null)
       and not exists (select 1 from public.creatives c
                        where c.drop_id = d.id and c.status = 'pending');
  end if;

  return n;
end;
$$;

revoke execute on function public.auto_approve_due() from public, anon, authenticated;

/* ------------------------------------------------------------ */
/* 11b. Expiry - an ad still waiting when the next week's ads       */
/*      arrive expires. It isn't carried over: a week-old ad can     */
/*      be about an offer or a date that has passed, and a pile of   */
/*      old ads is no help to an owner who didn't get to four. It    */
/*      is never posted, and the customer finds it under Expired in  */
/*      Approvals. The engine reads 'expired' too - an ad nobody     */
/*      looked at says nothing about whether it was any good.        */
/*      Runs every 15 minutes through pg_cron (section 13).          */
/* ------------------------------------------------------------ */

/* Expires every ad still waiting in a drop that has a newer drop of the same
   account in Approvals already, and returns how many. A drop left with
   nothing waiting is closed: approved if the customer kept anything from it,
   skipped if not. */
create or replace function public.expire_unreviewed()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
begin
  with stale as (
    select c.id
      from public.creatives c
      join public.drops d on d.id = c.drop_id
     where c.status = 'pending'
       and exists (select 1 from public.drops newer
                    where newer.user_id = d.user_id
                      and newer.week_starting > d.week_starting
                      and newer.ready_at is not null
                      and newer.status <> 'rendering')
       for update of c skip locked
  )
  update public.creatives c
     set status = 'expired'::text::public.creative_status,
         expired_at = now()
    from stale
   where c.id = stale.id;
  get diagnostics n = row_count;

  if n > 0 then
    update public.drops d
       set status = case when exists (select 1 from public.creatives c
                                       where c.drop_id = d.id and c.status in ('approved', 'published'))
                         then 'approved'::public.drop_status
                         else 'skipped'::public.drop_status end
     where d.status = 'awaiting_approval'
       and exists (select 1 from public.creatives c
                    where c.drop_id = d.id and c.status::text = 'expired')
       and not exists (select 1 from public.creatives c
                        where c.drop_id = d.id and c.status = 'pending');
  end if;

  return n;
end;
$$;

revoke execute on function public.expire_unreviewed() from public, anon, authenticated;

/* ------------------------------------------------------------ */
/* 12. client_errors - a JavaScript error a visitor's browser hit   */
/*     (errors.js, on every page), so a broken page on a tester's    */
/*     phone shows up in the Adronis Portal's Errors tab instead of  */
/*     going unnoticed. Anyone may add a row, nobody may read them   */
/*     from the browser; the portal reads them through its admin     */
/*     policy (portal-admin.sql). Kept 30 days. Stored: the page,    */
/*     the error and where in the code, the browser's user agent and */
/*     language, a random id for the tab - and the account, when a   */
/*     signed-in customer hit it, so we can tell them it's fixed.    */
/* ------------------------------------------------------------ */
create table if not exists public.client_errors (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  user_id    uuid references public.profiles (id) on delete cascade,
  page       text,
  message    text not null,
  source     text,
  line       int,
  col        int,
  stack      text,
  user_agent text,
  lang       text,
  visit      text
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

/* The time and the account are the database's, whatever the browser sent.
   Long fields are cut rather than refused - a cut error still tells us
   something. A runaway loop or a script posting junk stops at 20 rows per tab
   and 500 in all per hour; the rest are dropped without an error. */
create or replace function public.stamp_client_error()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.message := left(nullif(btrim(coalesce(new.message, '')), ''), 1000);
  if new.message is null then
    return null;
  end if;
  new.created_at := now();
  new.user_id    := (select id from public.profiles where id = auth.uid());
  new.page       := left(new.page, 300);
  new.source     := left(new.source, 500);
  new.stack      := left(new.stack, 4000);
  new.user_agent := left(new.user_agent, 400);
  new.lang       := left(new.lang, 10);
  new.visit      := left(new.visit, 40);

  if (select count(*) from public.client_errors
       where created_at > now() - interval '1 hour') >= 500 then
    return null;
  end if;
  if new.visit is not null
     and (select count(*) from public.client_errors
           where visit = new.visit and created_at > now() - interval '1 hour') >= 20 then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists client_errors_stamp on public.client_errors;
create trigger client_errors_stamp
  before insert on public.client_errors
  for each row execute function public.stamp_client_error();

drop policy if exists "client errors insert public" on public.client_errors;
create policy "client errors insert public" on public.client_errors
  for insert to anon, authenticated with check (true);

/* ------------------------------------------------------------ */
/* 12b. generation_costs - what making each ad cost us. The ad      */
/*     engine (Claude + Higgsfield, running with the service role)   */
/*     writes one row per paid API call: writing the copy, making    */
/*     the image, checking it. The Adronis Portal adds the rows up   */
/*     per tester against the beta budget (portal-admin.sql gives    */
/*     admins read access). Customers can neither read nor write it. */
/*                                                                  */
/*     What the engine fills in:                                    */
/*       user_id      the account the ad is for (required)          */
/*       drop_id      the week's drop, when there is one            */
/*       creative_id  the ad, once it exists (a call that made no   */
/*                    ad - a failed or thrown-away image - leaves    */
/*                    it null; it still cost money)                  */
/*       provider     'claude' or 'higgsfield' ('other' otherwise)  */
/*       model        the exact model id, e.g. claude-sonnet-5-5    */
/*       step         'copy', 'image', 'check', 'reel' or 'other'   */
/*       input_tokens, output_tokens, cached_tokens  for Claude     */
/*       units        images or video seconds, for Higgsfield       */
/*       cost_usd     what the provider bills for this call, in USD */
/*       note         anything worth keeping (retry, batch, ...)    */
/*                                                                  */
/*     A deleted account keeps its rows (user_id goes null): the    */
/*     money was spent either way.                                  */
/* ------------------------------------------------------------ */
create table if not exists public.generation_costs (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  user_id       uuid references public.profiles (id) on delete set null,
  drop_id       uuid references public.drops (id) on delete set null,
  creative_id   uuid references public.creatives (id) on delete set null,
  provider      text not null default 'other',
  model         text,
  step          text not null default 'other',
  input_tokens  int,
  output_tokens int,
  cached_tokens int,
  units         numeric(10, 2),
  cost_usd      numeric(12, 6) not null,
  note          text
);

do $$ begin
  alter table public.generation_costs add constraint generation_costs_values check (
    provider in ('claude', 'higgsfield', 'other')
    and step in ('copy', 'image', 'check', 'reel', 'other')
    and cost_usd >= 0
    and coalesce(input_tokens, 0) >= 0
    and coalesce(output_tokens, 0) >= 0
    and coalesce(cached_tokens, 0) >= 0
    and coalesce(units, 0) >= 0
  );
exception when duplicate_object then null; end $$;

create index if not exists generation_costs_created_idx on public.generation_costs (created_at desc);
create index if not exists generation_costs_user_idx on public.generation_costs (user_id, created_at desc);

/* RLS on with no policy for anon or authenticated: only the service role
   (the engine) writes, and only portal admins read. */
alter table public.generation_costs enable row level security;

/* ------------------------------------------------------------ */
/* 12c. Push notifications - "your new ads are here" on the phone,  */
/*     without email. A customer turns them on in the control room  */
/*     or Approvals (push.js); the browser hands over an address to */
/*     send to, kept here. The push Edge Function                   */
/*     (supabase/functions/push) runs every 15 minutes (section 13) */
/*     and sends, per week's drop: once when it lands in Approvals, */
/*     a reminder a day later and a last call the evening before   */
/*     the next week's ads land if ads are still waiting. Also: the */
/*     trial ending in three days, and ads that went out. It asks  */
/*     push_due() what to send.                                     */
/* ------------------------------------------------------------ */
create table if not exists public.push_subscriptions (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  lang         text not null default 'en',
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

/* Read and removed by their owner; written only by save_push_subscription
   below, and sent to only by the Edge Function (service role). */
alter table public.push_subscriptions enable row level security;

drop policy if exists "push select own" on public.push_subscriptions;
create policy "push select own" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "push delete own" on public.push_subscriptions;
create policy "push delete own" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

/* A device's address belongs to whoever turned notifications on last on it -
   two people sharing a phone each get only their own ads. At most 10 devices
   an account; the oldest goes first. */
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_lang     text default 'en',
  p_ua       text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Not signed in.';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or char_length(p_endpoint) > 1000
     or char_length(coalesce(p_p256dh, '')) not between 40 and 200
     or char_length(coalesce(p_auth, '')) not between 8 and 100 then
    raise exception 'This browser sent a notification address we can''t use.';
  end if;

  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, lang, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth,
          case when p_lang = 'sr' then 'sr' else 'en' end, left(p_ua, 300));

  delete from public.push_subscriptions
   where user_id = auth.uid()
     and id not in (select id from public.push_subscriptions
                     where user_id = auth.uid() order by created_at desc limit 10);
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text) to authenticated;

/* When each notification went out, so each goes once. Locked to the browser:
   protect_drop_fields lets it change only a drop's status, and the guards on
   profiles and creatives copy over only the columns a customer may edit. */
alter table public.drops     add column if not exists push_ready_at     timestamptz;
alter table public.drops     add column if not exists push_reminder_at  timestamptz;
alter table public.drops     add column if not exists push_last_call_at timestamptz;
alter table public.profiles  add column if not exists push_trial_at     timestamptz;
alter table public.creatives add column if not exists push_published_at timestamptz;

/* What to send now, stamped as sent in the same step so two runs never send
   the same thing twice. Only accounts that have a device to send to.

     ready      a drop that landed in Approvals in the last day.
     reminder   a drop that landed more than a day ago with ads still waiting,
                at least 12 hours after its 'ready'.
     last_call  the evening before next week's ads land (Sunday 18:00 Belgrade
                time - drops render Monday at 09:00), ads still waiting: those
                expire when the new ones arrive. Not with auto-approval on
                (they'd be approved, not lost), nor when the plan ends before
                Monday (no new drop comes, so nothing expires).
     trial      three days or less left of the free trial, sent once, between
                09:00 and 21:00 Belgrade time. days is how many are left;
                canceled says the plan stops when the trial ends.
     published  ads that went out in the last two hours, one notification
                per account; channel is set when they all went to one.

   The three about a drop only for accounts with a running plan - a beta
   tester's included. waiting is how many ads are still waiting (or went
   out); auto_approve says whether they'd be approved for the customer if
   left. The three drop kinds never overlap for one drop, so the stamping
   update meets each drop once. */
drop function if exists public.push_due();
create or replace function public.push_due()
returns table (kind text, drop_id uuid, user_id uuid, waiting int, auto_approve boolean,
               channel text, days int, canceled boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select d.id, d.user_id, d.ready_at, d.push_ready_at, d.push_reminder_at, d.push_last_call_at,
           p.auto_approve, p.cancel_at_period_end, p.current_period_end,
           /* Monday 00:00 after the drop landed, Belgrade time: the next drop lands that morning. */
           date_trunc('week', d.ready_at at time zone 'Europe/Belgrade') + interval '7 days' as next_monday,
           (select count(*)::int from public.creatives c
             where c.drop_id = d.id and c.status = 'pending') as n
      from public.drops d
      join public.profiles p on p.id = d.user_id
     where d.status = 'awaiting_approval'
       and d.ready_at is not null
       and d.ready_at > now() - interval '8 days'
       and p.subscription_status in ('trialing', 'active')
       and exists (select 1 from public.push_subscriptions s where s.user_id = d.user_id)
  ),
  windowed as (
    select c.*,
           (c.next_monday - interval '6 hours') at time zone 'Europe/Belgrade' as last_call_from,
           (c.next_monday + interval '9 hours') at time zone 'Europe/Belgrade' as last_call_until
      from candidates c
  ),
  due as (
    select 'ready'::text as k, w.id, w.user_id, w.n, w.auto_approve from windowed w
     where w.push_ready_at is null and w.ready_at > now() - interval '1 day' and w.n > 0
    union all
    select 'reminder'::text, w.id, w.user_id, w.n, w.auto_approve from windowed w
     where w.push_reminder_at is null and w.ready_at <= now() - interval '1 day' and w.n > 0
       and w.ready_at > now() - interval '6 days'
       and now() < w.last_call_from
       and (w.push_ready_at is null or w.push_ready_at <= now() - interval '12 hours')
    union all
    select 'last_call'::text, w.id, w.user_id, w.n, w.auto_approve from windowed w
     where w.push_last_call_at is null and w.ready_at <= now() - interval '1 day' and w.n > 0
       and not w.auto_approve
       and now() >= w.last_call_from and now() < w.last_call_until
       and not (w.cancel_at_period_end and w.current_period_end <= w.last_call_until)
  ),
  stamped as (
    update public.drops d
       set push_ready_at     = case when due.k = 'ready'     then now() else d.push_ready_at end,
           push_reminder_at  = case when due.k = 'reminder'  then now() else d.push_reminder_at end,
           push_last_call_at = case when due.k = 'last_call' then now() else d.push_last_call_at end
      from due
     where d.id = due.id
    returning d.id
  )
  select due.k, due.id, due.user_id, due.n, due.auto_approve, null::text, null::int, null::boolean
    from due
   where due.id in (select id from stamped);

  return query
  with due as (
    select p.id,
           greatest(1, ceil(extract(epoch from p.trial_ends_at - now()) / 86400))::int as left_days,
           p.cancel_at_period_end
      from public.profiles p
     where p.subscription_status = 'trialing'
       and p.trial_ends_at is not null
       and p.push_trial_at is null
       and p.trial_ends_at > now() + interval '1 hour'
       and p.trial_ends_at <= now() + interval '3 days'
       and extract(hour from now() at time zone 'Europe/Belgrade') between 9 and 20
       and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  ),
  stamped as (
    update public.profiles p set push_trial_at = now() from due where p.id = due.id returning p.id
  )
  select 'trial'::text, null::uuid, due.id, 0, false, null::text, due.left_days, due.cancel_at_period_end
    from due
   where due.id in (select id from stamped);

  return query
  with fresh as (
    select c.id, c.user_id, c.channel
      from public.creatives c
     where c.status = 'published'
       and c.push_published_at is null
       and c.published_at > now() - interval '2 hours'
       and exists (select 1 from public.push_subscriptions s where s.user_id = c.user_id)
       for update of c skip locked
  ),
  stamped as (
    update public.creatives c set push_published_at = now() from fresh where c.id = fresh.id
    returning c.id, c.user_id, c.channel
  )
  select 'published'::text, null::uuid, s.user_id, count(*)::int, false,
         case when count(distinct s.channel) = 1 then min(s.channel) end, null::int, null::boolean
    from stamped s
   group by s.user_id;
end;
$$;

revoke execute on function public.push_due() from public, anon, authenticated;

/* ------------------------------------------------------------ */
/* 13. Scheduled jobs (pg_cron): auto-approval and expiry every 15   */
/*     minutes (expiry 7 minutes after, so an ad due both ways is    */
/*     approved), and error reports older than 30 days cleared every */
/*     night. If                                                      */
/*     pg_cron can't be switched on from here, turn it on under       */
/*     Database -> Extensions (or Integrations -> Cron) and re-run    */
/*     this file; until then auto-approval doesn't run. To check:     */
/*       select jobname, schedule, active from cron.job;              */
/* ------------------------------------------------------------ */
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('adronis-auto-approve', '*/15 * * * *',
    'select public.auto_approve_due()');
  perform cron.schedule('adronis-expire-unreviewed', '7-59/15 * * * *',
    'select public.expire_unreviewed()');
  perform cron.schedule('adronis-clear-old-errors', '17 3 * * *',
    'delete from public.client_errors where created_at < now() - interval ''30 days''');
exception when others then
  raise notice 'pg_cron is not available yet (%). Turn it on in Database -> Extensions and re-run this file.', sqlerrm;
end $$;

/* The push notifications (section 12c): every 15 minutes pg_net calls the push
   Edge Function, which sends whatever push_due() says is due. The function
   only answers a call carrying the secret saved in Vault as
   'push_cron_secret' - the same value as the function's PUSH_CRON_SECRET.
   Until pg_net is on and the secret saved, nothing is sent and nothing else
   is affected. The address is this project's own. */
do $$
begin
  create extension if not exists pg_net with schema extensions;
  perform cron.schedule('adronis-push', '11-59/15 * * * *', $job$
    select net.http_post(
      url     := 'https://jctvpizlzznabcjaxlgk.supabase.co/functions/v1/push',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets
                                               where name = 'push_cron_secret'), '')),
      body    := '{}'::jsonb)
  $job$);
exception when others then
  raise notice 'Push notifications are not scheduled yet (%). Turn on pg_net and pg_cron in Database -> Extensions and re-run this file.', sqlerrm;
end $$;

/* To try a notification on your own phone: turn notifications on from the
   site's account page (or the control room) on that phone, then run this in
   the SQL editor with that account's email - not as part of this file:

     select net.http_post(
       url     := 'https://jctvpizlzznabcjaxlgk.supabase.co/functions/v1/push',
       headers := jsonb_build_object('Content-Type', 'application/json',
                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                                       where name = 'push_cron_secret')),
       body    := jsonb_build_object('test', 'you@example.com'));

   To see one of every kind instead, a few seconds apart:
       body    := jsonb_build_object('test', 'you@example.com', 'all', true),
       timeout_milliseconds := 30000);

   A few seconds later, what the function answered:
     select status_code, content from net._http_response order by id desc limit 1; */
