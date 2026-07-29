-- ============================================================================
-- KAKING STORE CASH - COMPLETE SUPABASE SQL EDITOR SETUP
-- Version: 2026-07-29
--
-- PURPOSE
--   Creates and updates the complete Kaking Store Cash database safely.
--
-- SAFETY
--   * Idempotent: designed to be run again when needed.
--   * Does NOT drop tables, truncate data, or delete financial records.
--   * Does NOT deploy Supabase Edge Functions. Edge Functions must be deployed
--     separately after this SQL succeeds.
--
-- IMPORTANT
--   Change v_admin_email below only when your administrator email is different.
-- ============================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- 1. ENUM TYPES
-- --------------------------------------------------------------------------

do $$
begin
  create type public.app_role as enum ('store_user', 'checker', 'executive', 'admin');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.report_status as enum (
    'draft',
    'pending_verification',
    'matched',
    'with_difference',
    'reopened'
  );
exception
  when duplicate_object then null;
end
$$;

-- --------------------------------------------------------------------------
-- 2. TABLES
-- --------------------------------------------------------------------------

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null,
  role public.app_role not null default 'store_user',
  branch_id uuid references public.branches(id) on delete restrict,
  active boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  business_date date not null,
  cash numeric(14,2) not null default 0,
  gcash numeric(14,2) not null default 0,
  maya numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  debit numeric(14,2) not null default 0,
  cheque numeric(14,2) not null default 0,
  salmon numeric(14,2) not null default 0,
  other numeric(14,2) not null default 0,
  reported_total numeric(14,2)
    generated always as (
      cash + gcash + maya + credit + debit + cheque + salmon + other
    ) stored,
  customer_count integer not null default 0,
  store_remarks text,
  status public.report_status not null default 'draft',
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, business_date)
);

create table if not exists public.deposit_verifications (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.daily_reports(id) on delete restrict,
  actual_received numeric(14,2) not null,
  reading numeric(14,2) not null default 0,
  difference numeric(14,2) not null default 0,
  remarks text,
  verified_by uuid not null references public.profiles(id) on delete restrict,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

-- --------------------------------------------------------------------------
-- 3. ADD MISSING COLUMNS FOR EXISTING INSTALLATIONS
-- --------------------------------------------------------------------------

alter table public.branches
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role public.app_role not null default 'store_user',
  add column if not exists branch_id uuid references public.branches(id) on delete restrict,
  add column if not exists active boolean not null default false,
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.daily_reports
  add column if not exists business_date date,
  add column if not exists cash numeric(14,2) not null default 0,
  add column if not exists gcash numeric(14,2) not null default 0,
  add column if not exists maya numeric(14,2) not null default 0,
  add column if not exists credit numeric(14,2) not null default 0,
  add column if not exists debit numeric(14,2) not null default 0,
  add column if not exists cheque numeric(14,2) not null default 0,
  add column if not exists salmon numeric(14,2) not null default 0,
  add column if not exists other numeric(14,2) not null default 0,
  add column if not exists customer_count integer not null default 0,
  add column if not exists store_remarks text,
  add column if not exists status public.report_status not null default 'draft',
  add column if not exists submitted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.deposit_verifications
  add column if not exists actual_received numeric(14,2) not null default 0,
  add column if not exists reading numeric(14,2) not null default 0,
  add column if not exists difference numeric(14,2) not null default 0,
  add column if not exists remarks text,
  add column if not exists verified_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.audit_logs
  add column if not exists actor_name text,
  add column if not exists old_data jsonb,
  add column if not exists new_data jsonb,
  add column if not exists created_at timestamptz not null default now();

-- --------------------------------------------------------------------------
-- 4. DATA BACKFILL AND VALIDATION CONSTRAINTS
-- --------------------------------------------------------------------------

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is distinct from u.email;

update public.profiles
set permissions = '{}'::jsonb
where permissions is null
   or jsonb_typeof(permissions) is distinct from 'object';

alter table public.profiles
  alter column permissions set default '{}'::jsonb,
  alter column permissions set not null;

-- Remove an obsolete constraint that prevented safe creation of inactive users.
alter table public.profiles drop constraint if exists branch_required_for_store;

-- Recreate safe checks without deleting existing data.
alter table public.branches drop constraint if exists branches_code_length;
alter table public.branches
  add constraint branches_code_length
  check (length(trim(code)) between 2 and 20) not valid;

alter table public.branches drop constraint if exists branches_name_length;
alter table public.branches
  add constraint branches_name_length
  check (length(trim(name)) between 2 and 120) not valid;

alter table public.profiles drop constraint if exists profiles_full_name_length;
alter table public.profiles
  add constraint profiles_full_name_length
  check (length(trim(full_name)) between 2 and 120) not valid;

alter table public.profiles drop constraint if exists profiles_permissions_object;
alter table public.profiles
  add constraint profiles_permissions_object
  check (jsonb_typeof(permissions) = 'object');

alter table public.profiles drop constraint if exists active_store_user_requires_branch;
alter table public.profiles
  add constraint active_store_user_requires_branch
  check (not (active and role = 'store_user' and branch_id is null)) not valid;

alter table public.daily_reports drop constraint if exists daily_reports_nonnegative_amounts;
alter table public.daily_reports
  add constraint daily_reports_nonnegative_amounts
  check (
    cash >= 0 and gcash >= 0 and maya >= 0 and credit >= 0 and
    debit >= 0 and cheque >= 0 and salmon >= 0 and other >= 0 and
    customer_count >= 0
  ) not valid;

alter table public.daily_reports drop constraint if exists daily_reports_remarks_length;
alter table public.daily_reports
  add constraint daily_reports_remarks_length
  check (store_remarks is null or length(store_remarks) <= 500) not valid;

alter table public.daily_reports drop constraint if exists submitted_time_required;
alter table public.daily_reports
  add constraint submitted_time_required
  check (status in ('draft', 'reopened') or submitted_at is not null) not valid;

alter table public.deposit_verifications drop constraint if exists verification_nonnegative_amounts;
alter table public.deposit_verifications
  add constraint verification_nonnegative_amounts
  check (actual_received >= 0 and reading >= 0) not valid;

alter table public.deposit_verifications drop constraint if exists verification_remarks_length;
alter table public.deposit_verifications
  add constraint verification_remarks_length
  check (remarks is null or length(remarks) <= 500) not valid;

alter table public.deposit_verifications drop constraint if exists remarks_required_for_difference;
alter table public.deposit_verifications
  add constraint remarks_required_for_difference
  check (difference = 0 or length(trim(coalesce(remarks, ''))) > 0) not valid;

-- --------------------------------------------------------------------------
-- 5. INDEXES
-- --------------------------------------------------------------------------

create index if not exists daily_reports_business_date_idx
  on public.daily_reports (business_date desc);

create index if not exists daily_reports_branch_date_idx
  on public.daily_reports (branch_id, business_date desc);

create index if not exists daily_reports_status_idx
  on public.daily_reports (status);

create index if not exists deposit_verifications_verified_at_idx
  on public.deposit_verifications (verified_at desc);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists profiles_branch_idx
  on public.profiles (branch_id);

create index if not exists profiles_email_idx
  on public.profiles (lower(email));

create index if not exists profiles_active_role_idx
  on public.profiles (active, role);

-- --------------------------------------------------------------------------
-- 6. ROLE AND PERMISSION FUNCTIONS
-- --------------------------------------------------------------------------

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true
$$;

create or replace function public.current_branch()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.branch_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true
$$;

create or replace function public.role_default_permissions(target_role public.app_role)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case target_role
    when 'store_user' then jsonb_build_object(
      'dashboard_view', true,
      'entry_view', true,
      'entry_create', true,
      'checker_view', false,
      'checker_verify', false,
      'reports_view', true,
      'reports_all_branches', false,
      'reports_manage', false,
      'summary_view', false,
      'audit_view', false,
      'export_data', false,
      'manage_branches', false,
      'manage_users', false
    )
    when 'checker' then jsonb_build_object(
      'dashboard_view', true,
      'entry_view', false,
      'entry_create', false,
      'checker_view', true,
      'checker_verify', true,
      'reports_view', true,
      'reports_all_branches', true,
      'reports_manage', false,
      'summary_view', true,
      'audit_view', false,
      'export_data', true,
      'manage_branches', false,
      'manage_users', false
    )
    when 'executive' then jsonb_build_object(
      'dashboard_view', true,
      'entry_view', false,
      'entry_create', false,
      'checker_view', false,
      'checker_verify', false,
      'reports_view', true,
      'reports_all_branches', true,
      'reports_manage', false,
      'summary_view', true,
      'audit_view', true,
      'export_data', true,
      'manage_branches', false,
      'manage_users', false
    )
    when 'admin' then jsonb_build_object(
      'dashboard_view', true,
      'entry_view', true,
      'entry_create', true,
      'checker_view', true,
      'checker_verify', true,
      'reports_view', true,
      'reports_all_branches', true,
      'reports_manage', true,
      'summary_view', true,
      'audit_view', true,
      'export_data', true,
      'manage_branches', true,
      'manage_users', true
    )
  end
$$;

create or replace function public.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case
      when p.role = 'admin' then true
      when p.permissions ? permission_name
        then (p.permissions -> permission_name) = 'true'::jsonb
      else (public.role_default_permissions(p.role) -> permission_name) = 'true'::jsonb
    end,
    false
  )
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true
$$;

revoke all on function public.current_role() from public;
revoke all on function public.current_branch() from public;
revoke all on function public.role_default_permissions(public.app_role) from public;
revoke all on function public.has_permission(text) from public;

grant execute on function public.current_role() to authenticated;
grant execute on function public.current_branch() to authenticated;
grant execute on function public.role_default_permissions(public.app_role) to authenticated;
grant execute on function public.has_permission(text) to authenticated;

-- --------------------------------------------------------------------------
-- 7. AUTOMATIC TIMESTAMPS AND AUTH PROFILE CREATION
-- --------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    branch_id,
    active,
    permissions
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'New User'
    ),
    'store_user',
    null,
    false,
    '{}'::jsonb
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = case
        when public.profiles.full_name is null
          or trim(public.profiles.full_name) = ''
        then excluded.full_name
        else public.profiles.full_name
      end;

  return new;
end
$$;

-- Ensure every existing Auth user has a profile without overwriting assigned roles.
insert into public.profiles (
  id,
  email,
  full_name,
  role,
  branch_id,
  active,
  permissions
)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(u.email, '@', 1),
    'New User'
  ),
  'store_user',
  null,
  false,
  '{}'::jsonb
from auth.users u
on conflict (id) do update
set email = excluded.email;

drop trigger if exists branches_updated_at on public.branches;
create trigger branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists daily_reports_updated on public.daily_reports;
drop trigger if exists daily_reports_updated_at on public.daily_reports;
create trigger daily_reports_updated_at
before update on public.daily_reports
for each row execute function public.set_updated_at();

drop trigger if exists deposit_verifications_updated_at on public.deposit_verifications;
create trigger deposit_verifications_updated_at
before update on public.deposit_verifications
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- 8. REPORT LOCKING, DEPOSIT CALCULATION, AND AUDIT
-- --------------------------------------------------------------------------

create or replace function public.protect_submitted_report()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Financial reports cannot be deleted.';
  end if;

  if old.status in ('pending_verification', 'matched', 'with_difference')
     and not public.has_permission('reports_manage')
     and not public.has_permission('checker_verify') then
    raise exception 'Submitted reports are locked.';
  end if;

  return new;
end
$$;

create or replace function public.sync_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total numeric(14,2);
begin
  select r.reported_total
  into total
  from public.daily_reports r
  where r.id = new.report_id
  for update;

  if total is null then
    raise exception 'Report not found.';
  end if;

  new.difference = round(new.actual_received - total, 2);
  new.updated_at = now();

  update public.daily_reports
  set status = case
    when new.difference = 0 then 'matched'::public.report_status
    else 'with_difference'::public.report_status
  end
  where id = new.report_id;

  return new;
end
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_display text;
  entity uuid;
begin
  select p.full_name
  into actor_display
  from public.profiles p
  where p.id = actor;

  entity = case when tg_op = 'DELETE' then old.id else new.id end;

  insert into public.audit_logs (
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  values (
    actor,
    coalesce(actor_display, 'System'),
    lower(tg_op),
    tg_table_name,
    entity,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists protect_daily_report on public.daily_reports;
create trigger protect_daily_report
before update or delete on public.daily_reports
for each row execute function public.protect_submitted_report();

drop trigger if exists sync_deposit on public.deposit_verifications;
create trigger sync_deposit
before insert or update on public.deposit_verifications
for each row execute function public.sync_verification();

drop trigger if exists audit_daily_reports on public.daily_reports;
create trigger audit_daily_reports
after insert or update or delete on public.daily_reports
for each row execute function public.write_audit_log();

drop trigger if exists audit_deposit_verifications on public.deposit_verifications;
create trigger audit_deposit_verifications
after insert or update or delete on public.deposit_verifications
for each row execute function public.write_audit_log();

drop trigger if exists audit_branches on public.branches;
create trigger audit_branches
after insert or update on public.branches
for each row execute function public.write_audit_log();

-- --------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- --------------------------------------------------------------------------

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_reports enable row level security;
alter table public.deposit_verifications enable row level security;
alter table public.audit_logs enable row level security;

-- Branches: users see only their branch unless authorized for all branches.
drop policy if exists branches_read on public.branches;
drop policy if exists branches_admin_manage on public.branches;
drop policy if exists branches_permission_manage on public.branches;
drop policy if exists branches_insert on public.branches;
drop policy if exists branches_update on public.branches;

create policy branches_read on public.branches
for select to authenticated
using (
  id = public.current_branch()
  or public.has_permission('manage_branches')
  or public.has_permission('reports_all_branches')
);

create policy branches_insert on public.branches
for insert to authenticated
with check (public.has_permission('manage_branches'));

create policy branches_update on public.branches
for update to authenticated
using (public.has_permission('manage_branches'))
with check (public.has_permission('manage_branches'));

-- Profiles: users read themselves; authorized managers read and update users.
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_permission_update on public.profiles;

create policy profiles_read on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or public.has_permission('manage_users')
);

create policy profiles_update on public.profiles
for update to authenticated
using (public.has_permission('manage_users'))
with check (public.has_permission('manage_users'));

-- Reports: branch users are isolated; all-branch users can review all reports.
drop policy if exists reports_read on public.daily_reports;
drop policy if exists reports_insert on public.daily_reports;
drop policy if exists reports_update on public.daily_reports;

create policy reports_read on public.daily_reports
for select to authenticated
using (
  public.has_permission('reports_view')
  and (
    public.has_permission('reports_all_branches')
    or branch_id = public.current_branch()
  )
);

create policy reports_insert on public.daily_reports
for insert to authenticated
with check (
  public.has_permission('entry_create')
  and submitted_by = (select auth.uid())
  and (
    public.has_permission('reports_all_branches')
    or branch_id = public.current_branch()
  )
);

create policy reports_update on public.daily_reports
for update to authenticated
using (
  public.has_permission('reports_manage')
  or (
    public.has_permission('entry_create')
    and branch_id = public.current_branch()
    and submitted_by = (select auth.uid())
    and status in ('draft', 'reopened')
  )
)
with check (
  public.has_permission('reports_manage')
  or (
    public.has_permission('entry_create')
    and branch_id = public.current_branch()
    and submitted_by = (select auth.uid())
  )
);

-- Deposit verification: checker permission is required to write.
drop policy if exists verification_read on public.deposit_verifications;
drop policy if exists verification_write on public.deposit_verifications;
drop policy if exists verification_insert on public.deposit_verifications;
drop policy if exists verification_update on public.deposit_verifications;

create policy verification_read on public.deposit_verifications
for select to authenticated
using (
  exists (
    select 1
    from public.daily_reports r
    where r.id = report_id
      and (
        public.has_permission('reports_all_branches')
        or r.branch_id = public.current_branch()
      )
  )
  and (
    public.has_permission('reports_view')
    or public.has_permission('checker_view')
    or public.has_permission('summary_view')
  )
);

create policy verification_insert on public.deposit_verifications
for insert to authenticated
with check (
  public.has_permission('checker_verify')
  and verified_by = (select auth.uid())
);

create policy verification_update on public.deposit_verifications
for update to authenticated
using (public.has_permission('checker_verify'))
with check (
  public.has_permission('checker_verify')
  and verified_by = (select auth.uid())
);

-- Audit logs are read-only to authorized application users.
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
for select to authenticated
using (public.has_permission('audit_view'));

-- --------------------------------------------------------------------------
-- 10. DATABASE PRIVILEGES
-- --------------------------------------------------------------------------

revoke all on public.branches from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.daily_reports from anon, authenticated;
revoke all on public.deposit_verifications from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant usage on schema public to authenticated;

grant select on
  public.branches,
  public.profiles,
  public.daily_reports,
  public.deposit_verifications,
  public.audit_logs
  to authenticated;

grant insert, update on public.branches to authenticated;
grant update on public.profiles to authenticated;
grant insert, update on public.daily_reports to authenticated;
grant insert, update on public.deposit_verifications to authenticated;

-- No authenticated DELETE grants are intentionally provided.

-- --------------------------------------------------------------------------
-- 11. INITIAL BRANCHES
-- --------------------------------------------------------------------------

insert into public.branches (code, name, active)
values
  ('KPM', 'Parkmall', true),
  ('KMAC', 'Mactan', true),
  ('KTBK', 'Tabunok', true),
  ('KSTO', 'KSTO', true),
  ('K138', 'K138', true),
  ('K168', 'K168', true),
  ('KHWR', 'Hardware', true)
on conflict (code) do nothing;

-- --------------------------------------------------------------------------
-- 12. PROMOTE THE FIRST SYSTEM ADMINISTRATOR
-- --------------------------------------------------------------------------

-- This is customized for the administrator account shown in the current system.
do $$
declare
  v_admin_email text := 'admin@gmail.com';
  v_admin_id uuid;
begin
  select id
  into v_admin_id
  from auth.users
  where lower(email) = lower(v_admin_email)
  limit 1;

  if v_admin_id is null then
    raise notice 'Administrator Auth user % was not found. Create it in Authentication > Users, then rerun this script.', v_admin_email;
  else
    insert into public.profiles (
      id,
      email,
      full_name,
      role,
      branch_id,
      active,
      permissions
    )
    values (
      v_admin_id,
      v_admin_email,
      'System Administrator',
      'admin',
      null,
      true,
      '{}'::jsonb
    )
    on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when trim(coalesce(public.profiles.full_name, '')) = ''
          then excluded.full_name
          else public.profiles.full_name
        end,
        role = 'admin',
        branch_id = null,
        active = true,
        permissions = '{}'::jsonb,
        updated_at = now();

    raise notice 'Administrator account % is active and configured.', v_admin_email;
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- 13. COMMENTS
-- --------------------------------------------------------------------------

comment on function public.has_permission(text)
is 'Returns the signed-in user permission using an explicit override or role default.';

comment on table public.daily_reports
is 'One protected daily payment report per branch and business date.';

comment on table public.deposit_verifications
is 'Checker reconciliation records linked one-to-one with daily reports.';

-- --------------------------------------------------------------------------
-- 14. FINAL VERIFICATION RESULTS
-- --------------------------------------------------------------------------

select
  'TABLE' as object_type,
  table_name as object_name,
  'READY' as status
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'branches',
    'profiles',
    'daily_reports',
    'deposit_verifications',
    'audit_logs'
  )

union all

select
  'FUNCTION' as object_type,
  routine_name as object_name,
  'READY' as status
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'current_role',
    'current_branch',
    'role_default_permissions',
    'has_permission',
    'handle_new_user',
    'protect_submitted_report',
    'sync_verification',
    'write_audit_log'
  )
order by object_type, object_name;

select
  u.email,
  p.full_name,
  p.role,
  p.active,
  p.branch_id,
  p.permissions
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('admin@gmail.com');

select
  code,
  name,
  active
from public.branches
order by name;
