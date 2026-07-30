-- Kaking Store Cash protected operational-data reset extension
-- Run after schema.sql, admin_extension.sql, and production_hardening.sql.
-- This migration is idempotent. It preserves users, profiles, branches, roles,
-- permissions, and schema objects while allowing a server-authorized reset of
-- daily reports, deposit verifications, and historical audit entries.

begin;

-- Preserve all production hardening rules. The only delete exception is a
-- transaction-local flag that can be set only inside the protected reset RPC.
create or replace function public.protect_submitted_report()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('app.allow_operational_reset', true) = 'on' then
      return old;
    end if;
    raise exception 'Financial reports cannot be deleted.';
  end if;

  if new.submitted_by is distinct from old.submitted_by then
    raise exception 'The original report submitter cannot be changed.';
  end if;

  if public.has_permission('reports_manage') then
    return new;
  end if;

  if public.has_permission('checker_verify') then
    if row(
      new.branch_id,new.business_date,new.cash,new.gcash,new.maya,new.credit,
      new.debit,new.cheque,new.salmon,new.other,new.customer_count,
      new.store_remarks,new.submitted_by,new.submitted_at,new.created_at
    ) is distinct from row(
      old.branch_id,old.business_date,old.cash,old.gcash,old.maya,old.credit,
      old.debit,old.cheque,old.salmon,old.other,old.customer_count,
      old.store_remarks,old.submitted_by,old.submitted_at,old.created_at
    ) then
      raise exception 'Deposit checkers cannot change store report values.';
    end if;

    if new.status not in ('matched','with_difference') then
      raise exception 'Invalid deposit verification status transition.';
    end if;
    return new;
  end if;

  if public.has_permission('entry_create') then
    if old.status not in ('draft','reopened') then
      raise exception 'Submitted reports are locked.';
    end if;
    if new.status not in ('draft','pending_verification') then
      raise exception 'Store users cannot assign reconciliation statuses.';
    end if;
    if new.branch_id is distinct from public.current_branch() then
      raise exception 'A store user cannot move a report to another branch.';
    end if;
    return new;
  end if;

  raise exception 'You are not authorized to update this financial report.';
end;
$$;

drop trigger if exists protect_daily_report on public.daily_reports;
create trigger protect_daily_report
before update or delete on public.daily_reports
for each row execute function public.protect_submitted_report();

create or replace function public.admin_reset_operational_data(
  p_actor_id uuid,
  p_reason text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor_name text;
  report_count bigint;
  verification_count bigint;
  audit_count bigint;
begin
  if p_confirmation is distinct from 'RESET ALL RECORDS' then
    raise exception 'The confirmation phrase is incorrect.';
  end if;

  p_reason := trim(coalesce(p_reason,''));
  if length(p_reason) < 10 or length(p_reason) > 500 then
    raise exception 'The reset reason must contain 10 to 500 characters.';
  end if;

  select full_name
    into actor_name
    from public.profiles
   where id = p_actor_id
     and active = true
     and role = 'admin';

  if actor_name is null then
    raise exception 'Only an active System Administrator can reset operational records.';
  end if;

  -- Prevent two administrators from resetting at the same time.
  perform pg_advisory_xact_lock(hashtext('kakingstorecash-operational-reset'));

  select count(*) into report_count from public.daily_reports;
  select count(*) into verification_count from public.deposit_verifications;
  select count(*) into audit_count from public.audit_logs;

  -- The trigger reads this transaction-local flag. It cannot persist beyond
  -- this transaction and is not available to ordinary client requests.
  perform set_config('app.allow_operational_reset','on',true);

  delete from public.deposit_verifications;
  delete from public.daily_reports;
  delete from public.audit_logs;

  insert into public.audit_logs(
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) values (
    p_actor_id,
    actor_name,
    'system_reset',
    'system',
    null,
    null,
    jsonb_build_object(
      'reason', p_reason,
      'deleted', jsonb_build_object(
        'reports', report_count,
        'verifications', verification_count,
        'audit_logs', audit_count
      ),
      'preserved', jsonb_build_array(
        'branches','profiles','auth_users','roles','permissions','database_schema'
      )
    )
  );

  return jsonb_build_object(
    'deleted', jsonb_build_object(
      'reports', report_count,
      'verifications', verification_count,
      'audit_logs', audit_count
    ),
    'reset_at', now(),
    'actor_name', actor_name
  );
end;
$$;

revoke all on function public.admin_reset_operational_data(uuid,text,text) from public;
revoke all on function public.admin_reset_operational_data(uuid,text,text) from anon;
revoke all on function public.admin_reset_operational_data(uuid,text,text) from authenticated;
grant execute on function public.admin_reset_operational_data(uuid,text,text) to service_role;

comment on function public.admin_reset_operational_data(uuid,text,text) is
  'Server-only transactional reset of operational finance records. Preserves identities, branches, permissions, and schema, then writes one reset audit entry.';

commit;
