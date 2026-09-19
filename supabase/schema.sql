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

do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.drop_status as enum ('rendering', 'awaiting_approval', 'approved', 'published', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.creative_status as enum ('pending', 'approved', 'rejected', 'published');
exception when duplicate_object then null; end $$;

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
  city                text,
  vertical            text,
  website             text,
  what_you_sell       text,
  typical_customer    text,
  differentiator      text,

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
/* 8. Auto-create a profile whenever a user signs up. */
/*    Reads the metadata passed in supabase.auth.signUp({ options: { data: ... } }). */
/* ------------------------------------------------------------ */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, business_name, city, vertical, website,
    what_you_sell, typical_customer, differentiator,
    brand_vibe, brand_colors, avoid_notes, channels, plan
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'business_name', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'vertical', ''),
    nullif(new.raw_user_meta_data ->> 'website', ''),
    nullif(new.raw_user_meta_data ->> 'what_you_sell', ''),
    nullif(new.raw_user_meta_data ->> 'typical_customer', ''),
    nullif(new.raw_user_meta_data ->> 'differentiator', ''),
    nullif(new.raw_user_meta_data ->> 'brand_vibe', ''),
    nullif(new.raw_user_meta_data ->> 'brand_colors', ''),
    nullif(new.raw_user_meta_data ->> 'avoid_notes', ''),
    coalesce(
      (select array_agg(value #>> '{}')
         from jsonb_array_elements(
           case jsonb_typeof(new.raw_user_meta_data -> 'channels')
             when 'array' then new.raw_user_meta_data -> 'channels'
             else '[]'::jsonb
           end)),
      '{}'
    ),
    (nullif(new.raw_user_meta_data ->> 'plan', ''))::public.plan_tier
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
set search_path = public
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

grant execute on function public.start_trial(public.plan_tier, text) to authenticated;

/* ------------------------------------------------------------ */
/* 8c. finalize_billing_period - fast-forwards a subscription past any renewal */
/*     dates that have already come and gone, applying whatever was scheduled  */
/*     for each one: a cancellation, or a pending plan/cycle switch. Called    */
/*     from auth.js on every profile load, so the account.html gate reflects   */
/*     a cancellation or plan switch the moment its date arrives - nothing     */
/*     needs to run in the background to make that happen. */
/* ------------------------------------------------------------ */
create or replace function public.finalize_billing_period()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out     public.profiles;
  plan_months int;
  guard       int := 0;
  period_start timestamptz;
  entry        jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;

  select * into row_out from public.profiles where id = auth.uid();

  if row_out.current_period_end is null
     or row_out.subscription_status not in ('trialing', 'active') then
    return row_out;
  end if;

  while row_out.current_period_end <= now() and guard < 1000 loop
    guard := guard + 1;

    if row_out.cancel_at_period_end then
      update public.profiles
         set subscription_status = 'canceled'
       where id = auth.uid()
       returning * into row_out;
      exit;
    end if;

    if row_out.pending_plan is not null then
      update public.profiles
         set plan                  = row_out.pending_plan,
             billing_cycle         = coalesce(row_out.pending_billing_cycle, row_out.billing_cycle),
             pending_plan          = null,
             pending_billing_cycle = null
       where id = auth.uid()
       returning * into row_out;
    end if;

    /* The period that just renewed is charged at whatever plan/cycle is now
       active (after the switch above, if any) - matches "a plan change takes
       effect at the next renewal". Snapshot it so this period's invoice never
       changes retroactively if the plan changes again later. */
    period_start := row_out.current_period_end;
    plan_months  := case when row_out.billing_cycle = 'annual' then 12 else 1 end;
    entry := jsonb_build_object(
      'period_start', period_start,
      'plan', row_out.plan,
      'cycle', coalesce(row_out.billing_cycle, 'monthly')
    );

    update public.profiles
       set subscription_status = 'active',
           current_period_end  = period_start + (plan_months || ' months')::interval,
           billing_history      = row_out.billing_history || jsonb_build_array(entry)
     where id = auth.uid()
     returning * into row_out;
  end loop;

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
set search_path = public
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

grant execute on function public.cancel_at_period_end() to authenticated;

create or replace function public.resume_subscription()
returns public.profiles
language plpgsql
security definer
set search_path = public
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

grant execute on function public.resume_subscription() to authenticated;

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
set search_path = public
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

grant execute on function public.schedule_plan_change(public.plan_tier, text) to authenticated;

create or replace function public.cancel_plan_change()
returns public.profiles
language plpgsql
security definer
set search_path = public
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

grant execute on function public.cancel_plan_change() to authenticated;

/* ------------------------------------------------------------ */
/* 8f. Free plan - a monthly allowance of creatives for every account without  */
/*     a running trial or subscription (never paid, or canceled). Months are   */
/*     calendar months in UTC. The limit lives only here - the site reads it  */
/*     through free_quota(), and the trigger below refuses to insert past it,  */
/*     so the engine can't over-deliver to a free account by mistake. */
/* ------------------------------------------------------------ */
create or replace function public.free_images_per_month()
returns int
language sql
immutable
as $$ select 3 $$;

create or replace function public.free_quota()
returns json
language plpgsql
stable
set search_path = public
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
set search_path = public
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
set search_path = public
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
       or new.billing_history <> '[]'::jsonb then
      raise exception 'Billing details can only be set through checkout.';
    end if;
    return new;
  end if;

  editable                  := old;
  editable.email            := new.email;
  editable.business_name    := new.business_name;
  editable.city             := new.city;
  editable.vertical         := new.vertical;
  editable.website          := new.website;
  editable.what_you_sell    := new.what_you_sell;
  editable.typical_customer := new.typical_customer;
  editable.differentiator   := new.differentiator;
  editable.brand_vibe       := new.brand_vibe;
  editable.brand_colors     := new.brand_colors;
  editable.avoid_notes      := new.avoid_notes;
  editable.channels         := new.channels;
  editable.onboarded_at     := new.onboarded_at;
  editable.plan             := new.plan;
  editable.updated_at       := new.updated_at;

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

  return new;
end;
$$;

drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing
  before insert or update on public.profiles
  for each row execute function public.protect_profile_billing();

/* Approving and rejecting is all a customer does to a creative. */
create or replace function public.protect_creative_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  editable public.creatives;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  editable            := old;
  editable.status     := new.status;
  editable.updated_at := new.updated_at;

  if new is distinct from editable then
    raise exception 'Only a creative''s approval can be changed.';
  end if;

  if new.status is distinct from old.status
     and (old.status = 'published' or new.status = 'published') then
    raise exception 'Publishing is handled by Adronis.';
  end if;

  return new;
end;
$$;

drop trigger if exists creatives_protect_fields on public.creatives;
create trigger creatives_protect_fields
  before update on public.creatives
  for each row execute function public.protect_creative_fields();

/* ------------------------------------------------------------ */
/* 9. Row Level Security */
/*    RLS is NOT enabled by default on new tables - turn it on explicitly. */
/* ------------------------------------------------------------ */
alter table public.profiles         enable row level security;
alter table public.drops            enable row level security;
alter table public.creatives        enable row level security;
alter table public.contact_requests enable row level security;
alter table public.messages         enable row level security;

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
/* Supabase dashboard, which bypasses RLS. */
drop policy if exists "contact insert public" on public.contact_requests;
create policy "contact insert public" on public.contact_requests
  for insert to anon, authenticated with check (true);

drop policy if exists "messages insert public" on public.messages;
create policy "messages insert public" on public.messages
  for insert to anon, authenticated with check (true);
