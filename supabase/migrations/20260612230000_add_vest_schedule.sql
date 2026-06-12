alter table public.equity_grants add column if not exists vest_schedule jsonb;
comment on column public.equity_grants.vest_schedule is 'Optional custom graded vesting: array of {month:int offset from grant_date, fraction:0..1}. When present it overrides cliff/period/duration even-tranche vesting.';
