revoke execute on function public.is_household_member(uuid) from public;
revoke execute on function public.is_household_member(uuid) from anon;
grant execute on function public.is_household_member(uuid) to authenticated;
