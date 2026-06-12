create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.households (name) values (coalesce(nullif(p_name,''), 'Our Household'))
    returning id into new_id;
  insert into public.household_members (household_id, user_id, role, display_name)
    values (new_id, auth.uid(), 'owner', p_display_name);
  insert into public.assumptions (household_id) values (new_id)
    on conflict (household_id) do nothing;
  return new_id;
end;
$$;

revoke execute on function public.create_household(text, text) from public;
revoke execute on function public.create_household(text, text) from anon;
grant execute on function public.create_household(text, text) to authenticated;
