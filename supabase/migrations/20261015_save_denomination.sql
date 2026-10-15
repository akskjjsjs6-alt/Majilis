-- Fills in your religious tradition on its own, when the AI was too busy to name it during the test.
create or replace function public.save_denomination(p_denomination text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  my_id uuid := auth.uid();
begin
  if my_id is null then raise exception 'Not authenticated'; end if;
  update profiles set denomination = nullif(left(trim(p_denomination), 120), '')
  where id = my_id and religion is not null;
end;
$$;
revoke all on function public.save_denomination(text) from public, anon;
grant execute on function public.save_denomination(text) to authenticated;
