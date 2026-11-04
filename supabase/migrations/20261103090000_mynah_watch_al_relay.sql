-- Private queue for authenticated Mynah Watch requests to an Al host.
create table if not exists public.mynah_watch_al_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input text not null check (char_length(input) between 1 and 4000),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed', 'expired')),
  result text,
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists mynah_watch_al_requests_pending
  on public.mynah_watch_al_requests (created_at) where status = 'pending';
create index if not exists mynah_watch_al_requests_user_created
  on public.mynah_watch_al_requests (user_id, created_at desc);

alter table public.mynah_watch_al_requests enable row level security;
revoke all on public.mynah_watch_al_requests from anon, authenticated;
grant all on public.mynah_watch_al_requests to service_role;

create or replace function public.claim_mynah_watch_al_request()
returns setof public.mynah_watch_al_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.mynah_watch_al_requests;
begin
  update public.mynah_watch_al_requests
     set status = 'expired', completed_at = now()
   where status in ('pending', 'processing') and expires_at <= now();

  select * into claimed
    from public.mynah_watch_al_requests
   where status = 'pending' and expires_at > now()
   order by created_at
   for update skip locked
   limit 1;
  if not found then return; end if;

  update public.mynah_watch_al_requests
     set status = 'processing', claimed_at = now()
   where id = claimed.id
   returning * into claimed;
  return next claimed;
end;
$$;

revoke all on function public.claim_mynah_watch_al_request() from public, anon, authenticated;
grant execute on function public.claim_mynah_watch_al_request() to service_role;
