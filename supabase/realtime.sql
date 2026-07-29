-- Kaking Store Cash realtime setup
-- Run once in Supabase SQL Editor. Safe to run again.

alter table public.branches replica identity full;
alter table public.profiles replica identity full;
alter table public.daily_reports replica identity full;
alter table public.deposit_verifications replica identity full;
alter table public.audit_logs replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'branches'
  ) then
    alter publication supabase_realtime add table public.branches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_reports'
  ) then
    alter publication supabase_realtime add table public.daily_reports;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deposit_verifications'
  ) then
    alter publication supabase_realtime add table public.deposit_verifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end
$$;
