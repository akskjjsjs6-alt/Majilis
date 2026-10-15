-- Which Majlis account belongs to which TikTok account (used only by the tiktok-auth edge function).
create table if not exists public.tiktok_identities (
  open_id text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.tiktok_identities enable row level security;
-- No policies: only the service role (the edge function) can read or write it.
revoke all on public.tiktok_identities from anon, authenticated;
