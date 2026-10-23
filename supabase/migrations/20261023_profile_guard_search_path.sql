-- The profile write guard runs with an empty search_path (so nothing on the path can stand in for what it calls),
-- but it called is_staff() without its schema, so every profile insert or update by a signed-in person, and every new
-- account's profile, failed with "function is_staff(uuid) does not exist". Same function, with public.is_staff.
create or replace function public.guard_profile_write()
returns trigger
language plpgsql
security definer
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
  -- Edge functions / DB triggers run without a user JWT: always trusted.
  if auth.uid() is null or public.is_staff(auth.uid()) then
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
