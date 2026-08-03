-- Kaking Store Cash checker auto-account extension
-- Run after supabase/checker_scope_extension.sql.
-- This preserves the checker's entered amount and scoped expected amount while
-- recording whether unassigned payment types should be carried at store-reported
-- values for full-branch reconciliation.

begin;

alter table public.deposit_verifications
  add column if not exists auto_account_unassigned boolean not null default false;

create or replace function public.sync_verification()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor uuid := auth.uid();
  actor_role public.app_role;
  actor_scope jsonb;
  selected_types text[];
  expected numeric(14,2);
  current_status public.report_status;
  auto_account boolean := false;
begin
  if actor is not null and not public.has_permission('checker_verify') then
    raise exception 'You are not authorized to verify deposits.';
  end if;

  if actor is not null and new.verified_by is distinct from actor then
    raise exception 'The verifier must match the signed-in account.';
  end if;

  select role,checker_scope
    into actor_role,actor_scope
    from public.profiles
   where id = coalesce(actor,new.verified_by)
     and active = true;

  if actor_role is null then
    raise exception 'An active verifier profile is required.';
  end if;

  selected_types := case
    when actor_role = 'checker'::public.app_role
      then public.checker_scope_payment_types(actor_scope)
    else array['cash','gcash','maya','credit','debit','cheque','salmon','other']::text[]
  end;

  if not public.valid_checker_payment_types(selected_types) then
    raise exception 'The Deposit Checker has no valid authorized payment fields.';
  end if;

  auto_account := actor_role = 'checker'::public.app_role
    and coalesce((actor_scope ->> 'all')::boolean,false) = false
    and coalesce((actor_scope ->> 'auto_account_unassigned')::boolean,false) = true;

  select report.status,
         round(
           (case when 'cash' = any(selected_types) then report.cash else 0 end)
         + (case when 'gcash' = any(selected_types) then report.gcash else 0 end)
         + (case when 'maya' = any(selected_types) then report.maya else 0 end)
         + (case when 'credit' = any(selected_types) then report.credit else 0 end)
         + (case when 'debit' = any(selected_types) then report.debit else 0 end)
         + (case when 'cheque' = any(selected_types) then report.cheque else 0 end)
         + (case when 'salmon' = any(selected_types) then report.salmon else 0 end)
         + (case when 'other' = any(selected_types) then report.other else 0 end),
           2
         )
    into current_status,expected
    from public.daily_reports report
   where report.id = new.report_id
   for update;

  if expected is null then
    raise exception 'Report not found.';
  end if;

  if current_status in ('draft','reopened') then
    raise exception 'Only submitted reports can be verified.';
  end if;

  new.actual_received := round(new.actual_received,2);
  new.reading := round(new.reading,2);
  new.expected_amount := expected;
  new.checked_payment_types := selected_types;
  new.auto_account_unassigned := auto_account;
  new.difference := round(new.actual_received-expected,2);
  new.updated_at := now();

  if new.difference <> 0 and length(trim(coalesce(new.remarks,''))) = 0 then
    raise exception 'Verification remarks are required when there is a difference.';
  end if;

  update public.daily_reports
     set status = case
       when new.difference = 0 then 'matched'::public.report_status
       else 'with_difference'::public.report_status
     end
   where id = new.report_id;

  return new;
end;
$$;

comment on column public.deposit_verifications.auto_account_unassigned is
  'True when unassigned payment types are carried at store-reported values for full-branch reconciliation. The checker-entered actual_received remains unchanged.';

commit;
notify pgrst, 'reload schema';
