-- The card's detail and philosophy axes, kept with the account (they were only on the device that took the test,
-- so other devices showed just the 6 compass axes).
alter table public.profiles add column if not exists extra_scores jsonb;
alter table public.profiles add column if not exists philosophy_axes jsonb;

-- Saves them for the signed-in person. Only small objects of whole numbers 0-100 are accepted.
create or replace function public.save_card_extras(p_extra jsonb, p_phil jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  my_id uuid := auth.uid();
  k text; v jsonb;
begin
  if my_id is null then raise exception 'Not authenticated'; end if;
  if p_extra is not null then
    if jsonb_typeof(p_extra) <> 'object' or (select count(*) from jsonb_object_keys(p_extra)) > 40 then raise exception 'Bad scores'; end if;
    for k, v in select * from jsonb_each(p_extra) loop
      if length(k) > 40 or jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0 or (v::text)::numeric > 100 then raise exception 'Bad scores'; end if;
    end loop;
  end if;
  if p_phil is not null then
    if jsonb_typeof(p_phil) <> 'object' or (select count(*) from jsonb_object_keys(p_phil)) > 40 then raise exception 'Bad scores'; end if;
    for k, v in select * from jsonb_each(p_phil) loop
      if length(k) > 40 or jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0 or (v::text)::numeric > 100 then raise exception 'Bad scores'; end if;
    end loop;
  end if;
  update profiles set extra_scores = coalesce(p_extra, extra_scores), philosophy_axes = coalesce(p_phil, philosophy_axes)
  where id = my_id;
end;
$$;
revoke all on function public.save_card_extras(jsonb, jsonb) from public, anon;
grant execute on function public.save_card_extras(jsonb, jsonb) to authenticated;

-- The public profile view gains the two columns, shown on the same terms as the compass (public profiles, or your own).
create or replace view public.profiles_public as
 SELECT p.id, p.username, p.name, p.bio, p.avatar_url, p.role, p.profile_visibility, p.show_on_leaderboard, p.allow_followers,
    CASE WHEN v.ok THEN p.reading_elo ELSE NULL::integer END AS reading_elo,
    CASE WHEN v.ok THEN p.reading_points ELSE NULL::integer END AS reading_points,
    CASE WHEN v.ok THEN p.pages_read ELSE NULL::integer END AS pages_read,
    CASE WHEN v.ok THEN p.books_finished ELSE NULL::integer END AS books_finished,
    CASE WHEN v.ok THEN p.debate_points ELSE NULL::integer END AS debate_points,
    CASE WHEN v.ok THEN p.insight_points ELSE NULL::integer END AS insight_points,
    CASE WHEN v.ok THEN p.placement_taken ELSE NULL::boolean END AS placement_taken,
    CASE WHEN v.ok THEN p.compass_economic_x ELSE NULL::integer END AS compass_economic_x,
    CASE WHEN v.ok THEN p.compass_economic_y ELSE NULL::integer END AS compass_economic_y,
    CASE WHEN v.ok THEN p.compass_political_x ELSE NULL::integer END AS compass_political_x,
    CASE WHEN v.ok THEN p.compass_political_y ELSE NULL::integer END AS compass_political_y,
    CASE WHEN v.ok THEN p.compass_social_x ELSE NULL::integer END AS compass_social_x,
    CASE WHEN v.ok THEN p.compass_social_y ELSE NULL::integer END AS compass_social_y,
    CASE WHEN v.ok THEN p.ideology_economic_label ELSE NULL::text END AS ideology_economic_label,
    CASE WHEN v.ok THEN p.ideology_political_label ELSE NULL::text END AS ideology_political_label,
    CASE WHEN v.ok THEN p.ideology_social_label ELSE NULL::text END AS ideology_social_label,
    CASE WHEN v.ok THEN p.archetype ELSE NULL::text END AS archetype,
    CASE WHEN v.ok THEN p.religion ELSE NULL::text END AS religion,
    CASE WHEN v.ok THEN p.denomination ELSE NULL::text END AS denomination,
    CASE WHEN v.ok THEN p.fallacy_stats ELSE NULL::jsonb END AS fallacy_stats,
    CASE WHEN v.ok THEN gm.guild_id ELSE NULL::uuid END AS guild_id,
    p.is_ai,
    p.ai_retired,
    p.suspended_until IS NOT NULL AND p.suspended_until > now() AS suspended,
    p.suspended_until IS NOT NULL AND p.suspended_until > (now() + '1 year'::interval) AS banned,
    CASE WHEN v.ok THEN p.extra_scores ELSE NULL::jsonb END AS extra_scores,
    CASE WHEN v.ok THEN p.philosophy_axes ELSE NULL::jsonb END AS philosophy_axes
   FROM profiles p
     LEFT JOIN guild_members gm ON gm.user_id = p.id
     CROSS JOIN LATERAL ( SELECT p.profile_visibility = 'public'::text OR p.id = auth.uid() AS ok) v;
