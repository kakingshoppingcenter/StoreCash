-- Kaking Store Cash production security hardening
-- Run AFTER supabase/schema.sql and supabase/admin_extension.sql.
-- This script is idempotent and may be run again after future deployments.

begin;

do $$
begin
  if to_regprocedure('public.has_permission(text)') is null then
    raise exception 'Run supabase/admin_extension.sql before production_hardening.sql';
  end if;
end
$$;

-- Protect the original submitter and enforce server-side status transitions.
create or replace function public.protect_submitted_report()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Financial reports cannot be deleted.';
  end if;

  if new.submitted_by is distinct from old.submitted_by then
    raise exception 'The original report submitter cannot be changed.';
  end if;

  -- Authorized report managers may correct or reopen a record, but the
  -- original submitter remains immutable for audit accuracy.
  if public.has_permission('reports_manage') then
    return new;
  end if;

  -- Deposit checkers may only change the reconciliation status. The update
  -- issued by sync_verification must never alter store-entered amounts.
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

  -- Store-entry users may work only on drafts or formally reopened reports,
  -- and may transition only to draft or pending verification.
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

-- Keep the existing protection trigger attached to the hardened function.
drop trigger if exists protect_daily_report on public.daily_reports;
create trigger protect_daily_report
before update or delete on public.daily_reports
for each row execute function public.protect_submitted_report();

-- Recalculate differences in PostgreSQL and reject verification of drafts.
create or replace function public.sync_verification()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  total numeric(14,2);
  current_status public.report_status;
  actor uuid := auth.uid();
begin
  if actor is not null and not public.has_permission('checker_verify') then
    raise exception 'You are not authorized to verify deposits.';
  end if;

  if actor is not null and new.verified_by is distinct from actor then
    raise exception 'The verifier must match the signed-in account.';
  end if;

  select reported_total,status
    into total,current_status
    from public.daily_reports
   where id=new.report_id
   for update;

  if total is null then
    raise exception 'Report not found.';
  end if;
  if current_status in ('draft','reopened') then
    raise exception 'Only submitted reports can be verified.';
  end if;

  new.actual_received := round(new.actual_received,2);
  new.reading := round(new.reading,2);
  new.difference := round(new.actual_received-total,2);
  new.updated_at := now();

  if new.difference <> 0 and length(trim(coalesce(new.remarks,''))) = 0 then
    raise exception 'Verification remarks are required when there is a difference.';
  end if;

  update public.daily_reports
     set status=case
       when new.difference=0 then 'matched'::public.report_status
       else 'with_difference'::public.report_status
     end
   where id=new.report_id;

  return new;
end;
$$;

-- Daily-report policies: a store account may create only draft or submitted
-- records and may never assign matched/variance statuses through the API.
drop policy if exists reports_insert on public.daily_reports;
create policy reports_insert on public.daily_reports
for insert to authenticated
with check (
  public.has_permission('entry_create')
  and submitted_by=(select auth.uid())
  and status in ('draft','pending_verification')
  and (
    public.has_permission('reports_all_branches')
    or branch_id=public.current_branch()
  )
);

drop policy if exists reports_update on public.daily_reports;
create policy reports_update on public.daily_reports
for update to authenticated
using (
  public.has_permission('reports_manage')
  or (
    public.has_permission('entry_create')
    and branch_id=public.current_branch()
    and status in ('draft','reopened')
  )
)
with check (
  public.has_permission('reports_manage')
  or (
    public.has_permission('entry_create')
    and submitted_by=(select auth.uid())
    and branch_id=public.current_branch()
    and status in ('draft','pending_verification')
  )
);

-- Verification policies additionally require a submitted report and enforce
-- branch scope when checker permissions are assigned to a branch account.
drop policy if exists verification_insert on public.deposit_verifications;
create policy verification_insert on public.deposit_verifications
for insert to authenticated
with check (
  public.has_permission('checker_verify')
  and verified_by=(select auth.uid())
  and exists (
    select 1
      from public.daily_reports r
     where r.id=report_id
       and r.status not in ('draft','reopened')
       and (
         public.has_permission('reports_all_branches')
         or r.branch_id=public.current_branch()
       )
  )
);

drop policy if exists verification_update on public.deposit_verifications;
create policy verification_update on public.deposit_verifications
for update to authenticated
using (
  public.has_permission('checker_verify')
  and exists (
    select 1
      from public.daily_reports r
     where r.id=report_id
       and r.status not in ('draft','reopened')
       and (
         public.has_permission('reports_all_branches')
         or r.branch_id=public.current_branch()
       )
  )
)
with check (
  public.has_permission('checker_verify')
  and verified_by=(select auth.uid())
  and exists (
    select 1
      from public.daily_reports r
     where r.id=report_id
       and r.status not in ('draft','reopened')
       and (
         public.has_permission('reports_all_branches')
         or r.branch_id=public.current_branch()
       )
  )
);

comment on function public.protect_submitted_report() is
  'Enforces immutable submitter identity and authorized financial-report status transitions.';
comment on function public.sync_verification() is
  'Calculates deposit differences server-side and permits verification only for submitted reports.';

commit;
