-- KakingStoreCash production database schema
-- Run this entire file once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('store_user','checker','executive','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('draft','pending_verification','matched','with_difference','reopened');
exception when duplicate_object then null; end $$;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) between 2 and 20),
  name text not null unique check (length(trim(name)) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  role public.app_role not null default 'store_user',
  branch_id uuid references public.branches(id) on delete restrict,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  business_date date not null,
  cash numeric(14,2) not null default 0 check (cash >= 0),
  gcash numeric(14,2) not null default 0 check (gcash >= 0),
  maya numeric(14,2) not null default 0 check (maya >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  debit numeric(14,2) not null default 0 check (debit >= 0),
  cheque numeric(14,2) not null default 0 check (cheque >= 0),
  salmon numeric(14,2) not null default 0 check (salmon >= 0),
  other numeric(14,2) not null default 0 check (other >= 0),
  reported_total numeric(14,2) generated always as (cash+gcash+maya+credit+debit+cheque+salmon+other) stored,
  customer_count integer not null default 0 check (customer_count >= 0),
  store_remarks text check (store_remarks is null or length(store_remarks) <= 500),
  status public.report_status not null default 'draft',
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id,business_date),
  constraint submitted_time_required check (status in ('draft','reopened') or submitted_at is not null)
);

create table if not exists public.deposit_verifications (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.daily_reports(id) on delete restrict,
  actual_received numeric(14,2) not null check (actual_received >= 0),
  reading numeric(14,2) not null default 0 check (reading >= 0),
  difference numeric(14,2) not null default 0,
  remarks text check (remarks is null or length(remarks) <= 500),
  verified_by uuid not null references public.profiles(id) on delete restrict,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint remarks_required_for_difference check (difference = 0 or length(trim(coalesce(remarks,''))) > 0)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.branches add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles drop constraint if exists branch_required_for_store;
alter table public.deposit_verifications add column if not exists created_at timestamptz not null default now();
alter table public.deposit_verifications add column if not exists updated_at timestamptz not null default now();
alter table public.audit_logs add column if not exists actor_name text;

create index if not exists daily_reports_business_date_idx on public.daily_reports(business_date desc);
create index if not exists daily_reports_branch_date_idx on public.daily_reports(branch_id,business_date desc);
create index if not exists daily_reports_status_idx on public.daily_reports(status);
create index if not exists deposit_verifications_verified_at_idx on public.deposit_verifications(verified_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists profiles_branch_idx on public.profiles(branch_id);

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path=public
as $$
  select role from public.profiles where id=(select auth.uid()) and active=true
$$;

create or replace function public.current_branch()
returns uuid
language sql
stable
security definer
set search_path=public
as $$
  select branch_id from public.profiles where id=(select auth.uid()) and active=true
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists branches_updated_at on public.branches;
create trigger branches_updated_at before update on public.branches for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists daily_reports_updated on public.daily_reports;
drop trigger if exists daily_reports_updated_at on public.daily_reports;
create trigger daily_reports_updated_at before update on public.daily_reports for each row execute function public.set_updated_at();
drop trigger if exists deposit_verifications_updated_at on public.deposit_verifications;
create trigger deposit_verifications_updated_at before update on public.deposit_verifications for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id,full_name,role,active)
  values(
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1), 'New User'),
    'store_user',
    false
  )
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.profiles(id,full_name,role,active)
select id,coalesce(nullif(trim(raw_user_meta_data->>'full_name'),''),split_part(email,'@',1),'New User'),'store_user',false
from auth.users
on conflict(id) do nothing;

create or replace function public.protect_submitted_report()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.status in ('pending_verification','matched','with_difference')
     and public.current_role() not in ('admin','checker') then
    raise exception 'Submitted reports are locked.';
  end if;
  if tg_op='DELETE' then
    raise exception 'Financial reports cannot be deleted.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_daily_report on public.daily_reports;
create trigger protect_daily_report before update or delete on public.daily_reports for each row execute function public.protect_submitted_report();

create or replace function public.sync_verification()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  total numeric(14,2);
begin
  select reported_total into total from public.daily_reports where id=new.report_id for update;
  if total is null then raise exception 'Report not found.'; end if;
  new.difference:=round(new.actual_received-total,2);
  new.updated_at:=now();
  update public.daily_reports
     set status=case when new.difference=0 then 'matched'::public.report_status else 'with_difference'::public.report_status end
   where id=new.report_id;
  return new;
end;
$$;

drop trigger if exists sync_deposit on public.deposit_verifications;
create trigger sync_deposit before insert or update on public.deposit_verifications for each row execute function public.sync_verification();

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  actor_display text;
  entity uuid;
begin
  select full_name into actor_display from public.profiles where id=actor;
  entity := case when tg_op='DELETE' then old.id else new.id end;
  insert into public.audit_logs(actor_id,actor_name,action,entity_type,entity_id,old_data,new_data)
  values(
    actor,
    coalesce(actor_display,'System'),
    lower(tg_op),
    tg_table_name,
    entity,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_daily_reports on public.daily_reports;
create trigger audit_daily_reports after insert or update or delete on public.daily_reports for each row execute function public.write_audit_log();
drop trigger if exists audit_deposit_verifications on public.deposit_verifications;
create trigger audit_deposit_verifications after insert or update or delete on public.deposit_verifications for each row execute function public.write_audit_log();

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_reports enable row level security;
alter table public.deposit_verifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select to authenticated
using (active=true or public.current_role() in ('admin','executive'));
drop policy if exists branches_admin_manage on public.branches;
create policy branches_admin_manage on public.branches for all to authenticated
using (public.current_role()='admin') with check (public.current_role()='admin');

drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id=(select auth.uid()) or public.current_role() in ('admin','executive'));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.current_role()='admin') with check (public.current_role()='admin');

drop policy if exists reports_read on public.daily_reports;
create policy reports_read on public.daily_reports for select to authenticated
using (public.current_role() in ('admin','executive','checker') or branch_id=public.current_branch());
drop policy if exists reports_insert on public.daily_reports;
create policy reports_insert on public.daily_reports for insert to authenticated
with check (
  (public.current_role()='store_user' and branch_id=public.current_branch() and submitted_by=(select auth.uid()))
  or public.current_role()='admin'
);
drop policy if exists reports_update on public.daily_reports;
create policy reports_update on public.daily_reports for update to authenticated
using (
  (public.current_role()='store_user' and branch_id=public.current_branch() and status in ('draft','reopened'))
  or public.current_role() in ('admin','checker')
)
with check (
  (public.current_role()='store_user' and branch_id=public.current_branch() and submitted_by=(select auth.uid()))
  or public.current_role() in ('admin','checker')
);

drop policy if exists verification_read on public.deposit_verifications;
create policy verification_read on public.deposit_verifications for select to authenticated
using (
  public.current_role() in ('admin','executive','checker')
  or exists(select 1 from public.daily_reports r where r.id=report_id and r.branch_id=public.current_branch())
);
drop policy if exists verification_write on public.deposit_verifications;
drop policy if exists verification_insert on public.deposit_verifications;
create policy verification_insert on public.deposit_verifications for insert to authenticated
with check (public.current_role() in ('admin','checker') and verified_by=(select auth.uid()));
drop policy if exists verification_update on public.deposit_verifications;
create policy verification_update on public.deposit_verifications for update to authenticated
using (public.current_role() in ('admin','checker'))
with check (public.current_role() in ('admin','checker') and verified_by=(select auth.uid()));

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
using (public.current_role() in ('admin','executive'));

grant usage on schema public to authenticated;
grant select on public.branches,public.profiles,public.daily_reports,public.deposit_verifications,public.audit_logs to authenticated;
grant insert,update on public.daily_reports,public.deposit_verifications to authenticated;
grant update on public.profiles to authenticated;
grant insert,update on public.branches to authenticated;
grant usage,select on sequence public.audit_logs_id_seq to authenticated;
revoke all on public.audit_logs from anon,authenticated;
grant select on public.audit_logs to authenticated;

insert into public.branches(code,name) values
  ('KPM','Parkmall'),
  ('KMAC','Mactan'),
  ('KTBK','Tabunok'),
  ('KSTO','KSTO'),
  ('K138','K138'),
  ('K168','K168'),
  ('KHWR','Hardware')
on conflict(code) do update set name=excluded.name,active=true;

-- After creating the first user in Authentication > Users, promote it securely:
-- update public.profiles
-- set full_name='System Administrator', role='admin', active=true
-- where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL');
--
-- Assign a store user to a branch:
-- update public.profiles
-- set full_name='Parkmall Store User', role='store_user',
--     branch_id=(select id from public.branches where code='KPM'), active=true
-- where id=(select id from auth.users where email='STORE-EMAIL');
