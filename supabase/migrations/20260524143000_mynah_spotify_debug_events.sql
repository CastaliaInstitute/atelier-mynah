create table if not exists public.mynah_spotify_debug_events (
  id bigserial primary key,
  event text not null,
  user_id uuid,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists mynah_spotify_debug_events_created_at
  on public.mynah_spotify_debug_events (created_at desc);

alter table public.mynah_spotify_debug_events enable row level security;
