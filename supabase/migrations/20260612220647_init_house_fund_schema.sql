-- House Fund Tracker schema
create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Household',
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  display_name text,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- SECURITY DEFINER helper avoids RLS recursion when checking membership.
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  ticker text not null,
  shares numeric not null default 0,
  cost_basis numeric not null default 0,
  account_type text not null default 'brokerage',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  ticker text not null,
  type text not null check (type in ('buy','sell')),
  shares numeric not null,
  price numeric not null,
  fees numeric not null default 0,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.equity_grants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  type text not null check (type in ('amazon_rsu','zoox_option')),
  grant_date date not null,
  total_units numeric not null,
  strike_price numeric,
  fmv_per_share numeric,
  cliff_months integer not null default 12,
  period_months integer not null default 3,
  duration_months integer not null default 48,
  created_at timestamptz not null default now()
);

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  owner text not null default 'you' check (owner in ('you','spouse','joint')),
  type text not null default 'salary' check (type in ('salary','hourly','shift','other')),
  annual_amount numeric not null default 0,
  shift_rate numeric not null default 0,
  shifts_per_month numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  amount numeric not null default 0,
  cadence text not null default 'monthly' check (cadence in ('weekly','monthly','quarterly','annual')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.assumptions (
  household_id uuid primary key references public.households(id) on delete cascade,
  filing_status text not null default 'mfj',
  state text not null default 'CA',
  target_house_price numeric not null default 900000,
  down_payment_pct numeric not null default 0.20,
  closing_cost_pct numeric not null default 0.03,
  mortgage_rate_override numeric,
  property_tax_rate numeric not null default 1.1,
  home_insurance_annual numeric not null default 1800,
  hoa_monthly numeric not null default 0,
  inflation_pct numeric not null default 3,
  growth_qqq_pct numeric not null default 8,
  growth_amzn_pct numeric not null default 10,
  growth_zoox_pct numeric not null default 5,
  salary_growth_pct numeric not null default 4,
  zoox_fmv_per_share numeric not null default 0,
  projection_years integer not null default 7,
  dti_max_pct numeric not null default 0.36,
  reinvest_savings boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.market_cache (
  ticker text primary key,
  price numeric not null,
  as_of timestamptz not null default now(),
  source text not null default 'unknown'
);
