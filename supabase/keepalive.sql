-- Kaking Store Cash lightweight keep-alive endpoint
-- Run once in the Supabase SQL Editor. Safe to run again.
-- This function performs no writes and returns only a tiny response.

create or replace function public.ksc_keepalive()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', true);
$$;

revoke all on function public.ksc_keepalive() from public;
grant execute on function public.ksc_keepalive() to anon, authenticated;

comment on function public.ksc_keepalive() is
  'Minimal no-write endpoint used by the scheduled GitHub keep-alive request.';
