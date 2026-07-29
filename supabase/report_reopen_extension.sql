-- ============================================================================
-- KAKING STORE CASH - PROTECTED REPORT REOPEN EXTENSION
-- Run once in Supabase SQL Editor after FULL_SQL_EDITOR_SETUP.sql.
-- Safe to run again. Does not delete reports or financial history.
-- ============================================================================

alter table public.daily_reports
  add column if not exists reopen_reason text,
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz;

alter table public.daily_reports
  drop constraint if exists daily_reports_reopen_reason_length;

alter table public.daily_reports
  add constraint daily_reports_reopen_reason_length
  check (reopen_reason is null or length(trim(reopen_reason)) between 5 and 500)
  not valid;

create index if not exists daily_reports_reopened_at_idx
  on public.daily_reports (reopened_at desc)
  where reopened_at is not null;

create or replace function public.reopen_daily_report(
  p_report_id uuid,
  p_reason text
)
returns public.daily_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_reason text := trim(coalesce(p_reason, ''));
  v_old_report public.daily_reports%rowtype;
  v_new_report public.daily_reports%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.has_permission('reports_manage') then
    raise exception 'You are not authorized to reopen finalized reports.';
  end if;

  if length(v_reason) < 5 or length(v_reason) > 500 then
    raise exception 'Reopen reason must contain 5 to 500 characters.';
  end if;

  select *
  into v_old_report
  from public.daily_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'The selected report does not exist.';
  end if;

  if v_old_report.status not in (
    'pending_verification'::public.report_status,
    'matched'::public.report_status,
    'with_difference'::public.report_status
  ) then
    raise exception 'Only a finalized or submitted report can be reopened.';
  end if;

  select full_name
  into v_actor_name
  from public.profiles
  where id = v_actor_id
    and active = true;

  if v_actor_name is null then
    raise exception 'Your active system profile could not be verified.';
  end if;

  update public.daily_reports
  set status = 'reopened'::public.report_status,
      submitted_at = null,
      reopen_reason = v_reason,
      reopened_by = v_actor_id,
      reopened_at = now(),
      updated_at = now()
  where id = p_report_id
  returning * into v_new_report;

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
    v_actor_id,
    v_actor_name,
    'reopen_report',
    'daily_reports',
    p_report_id,
    jsonb_build_object(
      'status', v_old_report.status,
      'submitted_at', v_old_report.submitted_at,
      'reported_total', v_old_report.reported_total,
      'customer_count', v_old_report.customer_count
    ),
    jsonb_build_object(
      'status', v_new_report.status,
      'reopen_reason', v_reason,
      'reopened_by', v_actor_id,
      'reopened_at', v_new_report.reopened_at
    )
  );

  return v_new_report;
end
$$;

revoke all on function public.reopen_daily_report(uuid, text) from public;
grant execute on function public.reopen_daily_report(uuid, text) to authenticated;

comment on function public.reopen_daily_report(uuid, text)
is 'Safely reopens a finalized daily report, records the reason and administrator, and preserves audit history.';

-- Verification
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'reopen_daily_report';

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'daily_reports'
  and column_name in ('reopen_reason', 'reopened_by', 'reopened_at')
order by column_name;