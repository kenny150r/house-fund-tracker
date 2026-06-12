alter table public.assumptions
  add column if not exists current_home_value numeric not null default 0,
  add column if not exists current_mortgage_balance numeric not null default 0,
  add column if not exists home_appreciation_pct numeric not null default 4,
  add column if not exists home_sale_cost_pct numeric not null default 0.06,
  add column if not exists sell_home_for_down_payment boolean not null default true;
