/* ============================================================ */
/* Adronis - Supabase schema */
/* Run this whole file once in: Supabase Dashboard -> SQL Editor. */
/* Safe to re-run (idempotent). */
/* ============================================================ */

/* ------------------------------------------------------------ */
/* 1. Enums */
/* ------------------------------------------------------------ */
do $$ begin
  create type public.plan_tier as enum ('counter', 'storefront', 'franchise');
exception when duplicate_object then null; end $$;

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

  /* Already on a trial or paying: don't restart the clock. */
  if row_out.subscription_status in ('trialing', 'active') then
    return row_out;
  end if;

  update public.profiles
     set plan                = coalesce(p_plan, plan),
         billing_cycle       = coalesce(p_cycle, 'monthly'),
         payment_method_at   = now(),
         subscription_status = 'trialing',
         trial_started_at    = now(),
         trial_ends_at       = now() + interval '7 days'
   where id = auth.uid()
   returning * into row_out;

  return row_out;
end;
$$;

grant execute on function public.start_trial(public.plan_tier, text) to authenticated;

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
