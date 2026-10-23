-- The profile write guard runs with an empty search_path (so nothing on the path can stand in for what it calls),
-- but it called is_staff() without its schema, so every profile insert or update by a signed-in person, and every new
-- account's profile, failed with "function is_staff(uuid) does not exist". Same function, with public.is_staff.
--
-- It also ran as SECURITY DEFINER, so inside it current_user was always its owner and it could not tell a person
-- editing their own row from the site's own trusted functions (save_ideology_vector and the like, which run as their
-- owner but keep the person's auth.uid()). It treated both as the person and quietly put the old values back, so a
-- finished test never saved its compass, labels or archetype. It now runs as the caller: a direct write by a signed-in
-- person (current_user 'authenticated') is guarded as before; writes from the server's own functions go through.
create or replace function public.guard_profile_write()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  protected_cols text[] := array[
    'role',
    'debate_points', 'reading_elo', 'reading_points',
    'pages_read', 'books_finished', 'insight_points',
    'placement_taken',
    'compass_economic_x', 'compass_economic_y',
    'compass_political_x', 'compass_political_y',
    'compass_social_x', 'compass_social_y',
    'ideology_economic_label', 'ideology_political_label', 'ideology_social_label',
    'archetype'
  ];
  col text;
  col_default jsonb;
begin
  -- Edge functions / DB triggers run without a user JWT, and the server's own functions run as their owner: trusted.
  if auth.uid() is null or current_user not in ('authenticated', 'anon') or public.is_staff(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Signup may create the row but cannot choose its own powers or starting stats.
    new.role := 'member';
    new.debate_points := 0;
    new.reading_elo := 0;
    new.reading_points := 0;
    new.pages_read := 0;
    new.books_finished := 0;
    new.insight_points := 0;
    new.placement_taken := false;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    foreach col in array protected_cols loop
      col_default := to_jsonb(old) -> col;
      if (to_jsonb(new) -> col) is distinct from col_default then
        -- Forgive the change by restoring the server-owned value instead of erroring,
        -- so a buggy client edit doesn't break saving name/bio in the same statement.
        new := jsonb_populate_record(new, (to_jsonb(old) || (to_jsonb(new) - protected_cols::text[]))::jsonb);
        exit;
      end if;
    end loop;
    return new;
  end if;

  return new;
end;
$function$;
