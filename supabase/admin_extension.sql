-- Kaking Store Cash administration and fine-grained permissions extension
-- Run this file once AFTER supabase/schema.sql.

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists permissions jsonb not null default '{}'::jsonb;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

alter table public.profiles
  drop constraint if exists profiles_permissions_object;

alter table public.profiles
  add constraint profiles_permissions_object
  check (jsonb_typeof(permissions) = 'object');

create or replace function public.role_default_permissions(target_role public.app_role)
returns jsonb
language sql
immutable
set search_path=public
as $$
  select case target_role
    when 'store_user' then jsonb_build_object(
      'dashboard_view',true,
      'entry_view',true,
      'entry_create',true,
      'checker_view',false,
      'checker_verify',false,
      'reports_view',true,
      'reports_all_branches',false,
      'reports_manage',false,
      'summary_view',false,
      'audit_view',false,
      'export_data',false,
      'manage_branches',false,
      'manage_users',false
    )
    when 'checker' then jsonb_build_object(
      'dashboard_view',true,
      'entry_view',false,
      'entry_create',false,
      'checker_view',true,
      'checker_verify',true,
      'reports_view',true,
      'reports_all_branches',true,
      'reports_manage',false,
      'summary_view',true,
      'audit_view',false,
      'export_data',true,
      'manage_branches',false,
      'manage_users',false
    )
    when 'executive' then jsonb_build_object(
      'dashboard_view',true,
      'entry_view',false,
      'entry_create',false,
      'checker_view',false,
      'checker_verify',false,
      'reports_view',true,
      'reports_all_branches',true,
      'reports_manage',false,
      'summary_view',true,
      'audit_view',true,
      'export_data',true,
      'manage_branches',false,
      'manage_users',false
    )
    when 'admin' then jsonb_build_object(
      'dashboard_view',true,
      'entry_view',true,
      'entry_create',true,
      'checker_view',true,
      'checker_verify',true,
      'reports_view',true,
      'reports_all_branches',true,
      'reports_manage',true,
      'summary_view',true,
      'audit_view',true,
      'export_data',true,
      'manage_branches',true,
      'manage_users',true
    )
  end;
$$;

create or replace function public.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path=public
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
    and p.active = true;
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.role_default_permissions(public.app_role) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id,email,full_name,role,active,permissions)
  values(
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1), 'New User'),
    'store_user',
    false,
    '{}'::jsonb
  )
  on conflict(id) do update
    set email = excluded.email,
        full_name = case
          when public.profiles.full_name is null or trim(public.profiles.full_name) = ''
            then excluded.full_name
          else public.profiles.full_name
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Branch access
drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches
for select to authenticated
using (
  active = true
  or public.has_permission('manage_branches')
  or public.has_permission('reports_all_branches')
);

drop policy if exists branches_admin_manage on public.branches;
drop policy if exists branches_permission_manage on public.branches;
create policy branches_permission_manage on public.branches
for all to authenticated
using (public.has_permission('manage_branches'))
with check (public.has_permission('manage_branches'));

-- Profile access
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or public.has_permission('manage_users')
);

drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_permission_update on public.profiles;
create policy profiles_permission_update on public.profiles
for update to authenticated
using (public.has_permission('manage_users'))
with check (public.has_permission('manage_users'));

-- Daily report access
drop policy if exists reports_read on public.daily_reports;
create policy reports_read on public.daily_reports
for select to authenticated
using (
  public.has_permission('reports_view')
  and (
    public.has_permission('reports_all_branches')
    or branch_id = public.current_branch()
  )
);

drop policy if exists reports_insert on public.daily_reports;
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

drop policy if exists reports_update on public.daily_reports;
create policy reports_update on public.daily_reports
for update to authenticated
using (
  public.has_permission('reports_manage')
  or (
    public.has_permission('entry_create')
    and branch_id = public.current_branch()
    and status in ('draft','reopened')
  )
)
with check (
  public.has_permission('reports_manage')
  or (
    public.has_permission('entry_create')
    and submitted_by = (select auth.uid())
    and branch_id = public.current_branch()
  )
);

-- Deposit verification access
drop policy if exists verification_read on public.deposit_verifications;
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

drop policy if exists verification_write on public.deposit_verifications;
drop policy if exists verification_insert on public.deposit_verifications;
create policy verification_insert on public.deposit_verifications
for insert to authenticated
with check (
  public.has_permission('checker_verify')
  and verified_by = (select auth.uid())
);

drop policy if exists verification_update on public.deposit_verifications;
create policy verification_update on public.deposit_verifications
for update to authenticated
using (public.has_permission('checker_verify'))
with check (
  public.has_permission('checker_verify')
  and verified_by = (select auth.uid())
);

-- Audit access
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
for select to authenticated
using (public.has_permission('audit_view'));

create index if not exists profiles_email_idx on public.profiles(lower(email));
create index if not exists profiles_active_role_idx on public.profiles(active,role);

-- Ensure authenticated clients have only the table privileges required by RLS.
grant select on public.branches,public.profiles,public.daily_reports,public.deposit_verifications,public.audit_logs to authenticated;
grant insert,update on public.branches to authenticated;
grant insert,update on public.daily_reports,public.deposit_verifications to authenticated;
grant update on public.profiles to authenticated;

comment on function public.has_permission(text) is 'Returns the signed-in user permission using an explicit override or role default.';
