alter table public.assumptions
  add column if not exists forecast_band text not null default 'mid',
  add column if not exists growth_qqq_low_pct numeric not null default 4,
  add column if not exists growth_qqq_high_pct numeric not null default 12,
  add column if not exists growth_amzn_low_pct numeric not null default 5,
  add column if not exists growth_amzn_high_pct numeric not null default 16,
  add column if not exists salary_growth_low_pct numeric not null default 2,
  add column if not exists salary_growth_high_pct numeric not null default 6;

-- Seed the new general band from the prior zoox-specific one where unset.
update public.assumptions set forecast_band = zoox_forecast_band where forecast_band = 'mid';
