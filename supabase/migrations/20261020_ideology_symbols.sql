-- Ideology symbols chosen automatically by the ai-matches function: the recognised flag, emblem or logo associated
-- with each ideology, found on Wikipedia/Wikimedia Commons and judged by Gemini. Stored in the portraits bucket.
create table if not exists public.ideology_symbols (
  key text primary key,
  name text not null,
  status text not null check (status in ('pending', 'ok', 'none')),
  url text,
  source text,
  reason text,
  tries int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ideology_symbols enable row level security;
revoke all on public.ideology_symbols from anon, authenticated;
