-- Leader portraits chosen automatically by the ai-matches function: for each leader, the best photo found on
-- Wikimedia Commons, judged by Gemini, copied into the public "portraits" bucket. Each leader is judged once.
create table if not exists public.leader_portraits (
  key text primary key,                 -- the leader's name, lower-cased
  name text not null,
  status text not null check (status in ('pending', 'ok', 'none')),
  big_url text,                         -- the chosen photo, about 1280px wide, in the portraits bucket
  small_url text,                       -- a 330px copy for the small circle
  source text,                          -- where it came from (Commons file name)
  score int,                            -- Gemini's 0-100 quality score for the chosen photo
  reason text,                          -- why it was chosen, or why nothing was
  tries int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.leader_portraits enable row level security;
-- No policies: only the server function reads and writes it.
revoke all on public.leader_portraits from anon, authenticated;

-- Public bucket for the chosen photos (read by everyone, written only by the server).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits', 'portraits', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
