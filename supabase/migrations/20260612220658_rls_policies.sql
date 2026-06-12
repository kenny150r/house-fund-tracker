-- Enable RLS everywhere
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.holdings enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.equity_grants enable row level security;
alter table public.income_sources enable row level security;
alter table public.expenses enable row level security;
alter table public.assumptions enable row level security;
alter table public.market_cache enable row level security;

-- households: members can see/update their household; any authed user can create one.
create policy households_select on public.households for select
  using (public.is_household_member(id));
create policy households_insert on public.households for insert
  with check (auth.uid() is not null);
create policy households_update on public.households for update
  using (public.is_household_member(id));
create policy households_delete on public.households for delete
  using (public.is_household_member(id));

-- household_members: you can read rows of households you belong to; you can add
-- yourself, and members can add others to their household.
create policy members_select on public.household_members for select
  using (user_id = auth.uid() or public.is_household_member(household_id));
create policy members_insert on public.household_members for insert
  with check (user_id = auth.uid() or public.is_household_member(household_id));
create policy members_update on public.household_members for update
  using (public.is_household_member(household_id));
create policy members_delete on public.household_members for delete
  using (public.is_household_member(household_id));

-- Generic household-scoped tables: full access for members.
do $$
declare t text;
begin
  foreach t in array array['holdings','stock_transactions','equity_grants','income_sources','expenses','assumptions']
  loop
    execute format('create policy %1$s_all on public.%1$s for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));', t);
  end loop;
end $$;

-- market_cache: any authenticated user may read (public market data).
create policy market_cache_select on public.market_cache for select
  using (auth.uid() is not null);
