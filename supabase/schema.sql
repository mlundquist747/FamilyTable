-- ════════════════════════════════════════════════════════════════════════════
-- FamilyTable schema + Row Level Security (PRD §6).
--
-- Multi-tenant: every row belongs to a household; a user may only read/write
-- rows for the household they own. Public grocery-list sharing is token-based
-- and resolved server-side via the service role (see src/lib/supabase/admin.ts),
-- so no broad anonymous SELECT policy is granted on user tables.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Households ───────────────────────────────────────────────────────────────
create table if not exists households (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  owner_id          uuid not null references auth.users (id) on delete cascade,
  prefer_leftovers  boolean not null default false,
  created_at        timestamptz not null default now()
);
-- For existing projects, add the column if it's missing:
alter table households
  add column if not exists prefer_leftovers boolean not null default false;
create index if not exists households_owner_idx on households (owner_id);

-- ── Family members ───────────────────────────────────────────────────────────
create table if not exists members (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households (id) on delete cascade,
  name              text not null,
  dietary_patterns  text[] not null default '{}',
  allergens         text[] not null default '{}',
  dislikes          text[] not null default '{}',
  preferences       text[] not null default '{}',
  portion_size      text not null default 'medium'
                      check (portion_size in ('small','medium','large')),
  created_at        timestamptz not null default now()
);
create index if not exists members_household_idx on members (household_id);

-- ── Busy nights (manual flags; calendar-detected ones are computed live) ──────
create table if not exists busy_nights (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households (id) on delete cascade,
  date          date not null,
  source        text not null default 'manual' check (source in ('manual','calendar')),
  reason        text,
  unique (household_id, date)
);

-- ── Meal plans ───────────────────────────────────────────────────────────────
create table if not exists meal_plans (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households (id) on delete cascade,
  week_start    date not null,
  meals         jsonb not null default '[]',
  created_at    timestamptz not null default now()
);
create index if not exists meal_plans_household_idx on meal_plans (household_id);

-- ── Grocery lists ────────────────────────────────────────────────────────────
create table if not exists grocery_lists (
  id            uuid primary key default gen_random_uuid(),
  meal_plan_id  uuid not null references meal_plans (id) on delete cascade,
  household_id  uuid not null references households (id) on delete cascade,
  items         jsonb not null default '[]',
  share_token   text unique,
  created_at    timestamptz not null default now()
);
create index if not exists grocery_lists_token_idx on grocery_lists (share_token);

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table households    enable row level security;
alter table members       enable row level security;
alter table busy_nights   enable row level security;
alter table meal_plans    enable row level security;
alter table grocery_lists enable row level security;

-- Helper: is the current user the owner of this household?
create or replace function owns_household(h_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from households
    where id = h_id and owner_id = auth.uid()
  );
$$;

-- Households: owner-only.
drop policy if exists households_select on households;
create policy households_select on households
  for select using (owner_id = auth.uid());
drop policy if exists households_insert on households;
create policy households_insert on households
  for insert with check (owner_id = auth.uid());
drop policy if exists households_modify on households;
create policy households_modify on households
  for update using (owner_id = auth.uid());
drop policy if exists households_delete on households;
create policy households_delete on households
  for delete using (owner_id = auth.uid());

-- Generic per-household policy applied to child tables.
do $$
declare t text;
begin
  foreach t in array array['members','busy_nights','meal_plans','grocery_lists']
  loop
    execute format('drop policy if exists %I_all on %I;', t, t);
    execute format(
      'create policy %I_all on %I for all
         using (owns_household(household_id))
         with check (owns_household(household_id));', t, t);
  end loop;
end $$;

-- NOTE: No anonymous SELECT policy on grocery_lists. Public share links are
-- resolved by the server using the service-role key, which bypasses RLS for
-- exactly one row matched by its unguessable share_token.
