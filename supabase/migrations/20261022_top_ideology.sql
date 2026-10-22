-- The named ideology closest to each person (the first one on their result card, found by the AI), kept with the
-- account so it can be shown as a coloured tag beside their name everywhere on the site.
alter table public.profiles add column if not exists top_ideology text;

-- Saves it for the signed-in person. A short plain name only (letters, spaces and a few marks), or null to clear it.
create or replace function public.save_top_ideology(p_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  my_id uuid := auth.uid();
  v text := nullif(btrim(p_name), '');
begin
  if my_id is null then raise exception 'Not authenticated'; end if;
  if v is not null and (length(v) > 50 or v !~ '^[[:alpha:][:space:]''.,()&/-]+$') then raise exception 'Bad ideology name'; end if;
  update profiles set top_ideology = v where id = my_id;
end;
$$;
revoke all on function public.save_top_ideology(text) from public, anon;
grant execute on function public.save_top_ideology(text) to authenticated;

-- The public profile view gains the column, shown on the same terms as the compass (public profiles, or your own).
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
    CASE WHEN v.ok THEN p.philosophy_axes ELSE NULL::jsonb END AS philosophy_axes,
    CASE WHEN v.ok THEN p.top_ideology ELSE NULL::text END AS top_ideology
   FROM profiles p
     LEFT JOIN guild_members gm ON gm.user_id = p.id
     CROSS JOIN LATERAL ( SELECT p.profile_visibility = 'public'::text OR p.id = auth.uid() AS ok) v;
