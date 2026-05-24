create table if not exists public.mynah_spotify_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spotify_user_id text,
  display_name text,
  access_token text,
  refresh_token text not null,
  expires_at_ms bigint,
  scope text,
  token_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mynah_spotify_connections_updated_at on public.mynah_spotify_connections;
create trigger mynah_spotify_connections_updated_at
before update on public.mynah_spotify_connections
for each row
execute function public.set_updated_at();

alter table public.mynah_spotify_connections enable row level security;

drop policy if exists "Users can read their own Spotify connection"
  on public.mynah_spotify_connections;
create policy "Users can read their own Spotify connection"
  on public.mynah_spotify_connections
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own Spotify connection"
  on public.mynah_spotify_connections;
create policy "Users can delete their own Spotify connection"
  on public.mynah_spotify_connections
  for delete
  using (auth.uid() = user_id);

create table if not exists public.mynah_spotify_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create index if not exists mynah_spotify_oauth_states_expires_at
  on public.mynah_spotify_oauth_states (expires_at);

alter table public.mynah_spotify_oauth_states enable row level security;
