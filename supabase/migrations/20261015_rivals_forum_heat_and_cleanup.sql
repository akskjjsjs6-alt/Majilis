-- AI rivals: forum pacing by heat, a forum run every minute, and deleting what a retired rival leaves behind.

-- Applied 2026-10-15
alter table public.rival_forum_threads add column if not exists heat int not null default 0;
alter table public.rival_forum_threads add column if not exists next_reply_at timestamptz;

-- Applied 2026-10-15
create or replace function public.srv_claim_forum_run()
 returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  update public.rival_forum_meta set last_run = now()
   where id = 1 and (last_run is null or last_run < now() - interval '1 minute');
  return found;
end $$;

-- To apply (needs approval because it deletes data): what a retired rival leaves behind is removed: its forum
-- threads and replies, and any debate it had with another rival. Debates with real people are kept, whoever won.
create or replace function public.srv_rival_cleanup(p_rival uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.rival_forum_threads t using public.forum_posts p
   where p.author_id = p_rival and t.post_id = p.id::text;
  delete from public.forum_posts where author_id = p_rival;
  delete from public.forum_replies where author_id = p_rival;
  delete from public.debates d
   where (d.participant1_id = p_rival or d.participant2_id = p_rival)
     and exists (select 1 from public.profiles o
                  where o.id = case when d.participant1_id = p_rival then d.participant2_id else d.participant1_id end
                    and o.is_ai);
end $$;
revoke all on function public.srv_rival_cleanup(uuid) from public, anon, authenticated;

-- srv_rivals_tick: unchanged except that each retired rival is cleaned up:
--   update public.profiles set ai_retired = true, show_on_leaderboard = false where id = r.id;
--   delete from public.books where user_id = r.id;
--   delete from public.follows where follower_id = r.id or following_id = r.id;
--   perform public.srv_rival_cleanup(r.id);        -- new

-- Then, once: clean up the rivals that have already retired.
-- do $$ declare r record; begin
--   for r in select id from public.profiles where is_ai and ai_retired loop perform public.srv_rival_cleanup(r.id); end loop;
-- end $$;
