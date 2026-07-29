-- ============================================================================
-- KAKING STORE CASH - PROTECTED BRANCH DELETION
-- Run once in Supabase SQL Editor after schema.sql and admin_extension.sql.
-- Safe to run again. This migration does not delete any existing branch.
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('public.has_permission(text)') is null then
    raise exception 'Run supabase/admin_extension.sql before branch_delete_extension.sql';
  end if;

  if to_regprocedure('public.write_audit_log()') is null then
    raise exception 'Run supabase/schema.sql before branch_delete_extension.sql';
  end if;
end
$$;

-- Only an authenticated account with manage_branches permission may delete.
-- The trigger checks dependencies before PostgreSQL foreign keys apply, so the
-- administrator receives a clear and safe explanation instead of a raw error.
create or replace function public.protect_branch_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_users integer := 0;
  financial_reports integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.has_permission('manage_branches') then
    raise exception 'You are not authorized to delete branches.';
  end if;

  select count(*)
    into assigned_users
    from public.profiles
   where branch_id = old.id;

  select count(*)
    into financial_reports
    from public.daily_reports
   where branch_id = old.id;

  if financial_reports > 0 then
    raise exception 'Branch % has % financial report(s) and cannot be deleted.', old.code, financial_reports;
  end if;

  if assigned_users > 0 then
    raise exception 'Branch % has % assigned user(s) and cannot be deleted.', old.code, assigned_users;
  end if;

  return old;
end
$$;

revoke all on function public.protect_branch_delete() from public;

-- Keep the database-level foreign keys as a second layer of protection.
drop trigger if exists protect_branch_deletion on public.branches;
create trigger protect_branch_deletion
before delete on public.branches
for each row execute function public.protect_branch_delete();

-- Record branch creation, updates, and successful deletion in the immutable
-- audit log. A blocked deletion creates no change and therefore no audit row.
drop trigger if exists audit_branches on public.branches;
create trigger audit_branches
after insert or update or delete on public.branches
for each row execute function public.write_audit_log();

-- The existing branches_permission_manage RLS policy from admin_extension.sql
-- applies to SELECT, INSERT, UPDATE, and DELETE. Table privilege is still
-- required before PostgreSQL evaluates that policy.
grant delete on public.branches to authenticated;

comment on function public.protect_branch_delete() is
  'Allows deletion only for unused branches and blocks removal when users or financial reports reference the branch.';

commit;

-- Optional verification query:
select
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'branches'
order by trigger_name, event_manipulation;
