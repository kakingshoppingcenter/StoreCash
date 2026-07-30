-- Kaking Store Cash deposit-checker scope extension
-- Run after schema.sql, admin_extension.sql, and production_hardening.sql.
-- This migration lets administrators choose which payment fields each Deposit
-- Checker can view and verify. Unselected store-entry values are not returned
-- to checker accounts by the Supabase Data API.

begin;

create or replace function public.valid_checker_scope(value jsonb)
returns boolean
language sql
immutable
set search_path=public,pg_temp
as $$
  select
    jsonb_typeof(value) = 'object'
    and jsonb_typeof(value -> 'all') = 'boolean'
    and jsonb_typeof(value -> 'payment_types') = 'array'
    and jsonb_array_length(value -> 'payment_types') between 1 and 8
    and not exists (
      select 1
      from jsonb_array_elements_text(value -> 'payment_types') as item(value)
      where item.value not in ('cash','gcash','maya','credit','debit','cheque','salmon','other')
    )
    and (
      select count(*) = count(distinct item.value)
      from jsonb_array_elements_text(value -> 'payment_types') as item(value)
    );
$$;

create or replace function public.checker_scope_payment_types(value jsonb)
returns text[]
language sql
immutable
set search_path=public,pg_temp
as $$
  select case
    when coalesce((value ->> 'all')::boolean,true) then
      array['cash','gcash','maya','credit','debit','cheque','salmon','other']::text[]
    else coalesce((
      select array_agg(item.value order by array_position(
        array['cash','gcash','maya','credit','debit','cheque','salmon','other']::text[],
        item.value
      ))
      from (
        select distinct value
        from jsonb_array_elements_text(value -> 'payment_types') as values_list(value)
        where value in ('cash','gcash','maya','credit','debit','cheque','salmon','other')
      ) as item
    ), array[]::text[])
  end;
$$;

alter table public.profiles
  add column if not exists checker_scope jsonb not null default
  '{"all":true,"payment_types":["cash","gcash","maya","credit","debit","cheque","salmon","other"]}'::jsonb;

update public.profiles
set checker_scope = '{"all":true,"payment_types":["cash","gcash","maya","credit","debit","cheque","salmon","other"]}'::jsonb
where checker_scope is null
   or not public.valid_checker_scope(checker_scope);

alter table public.profiles
  drop constraint if exists profiles_checker_scope_valid;

alter table public.profiles
  add constraint profiles_checker_scope_valid
  check (public.valid_checker_scope(checker_scope));

alter table public.deposit_verifications
  add column if not exists expected_amount numeric(14,2) not null default 0
  check (expected_amount >= 0);

alter table public.deposit_verifications
  add column if not exists checked_payment_types text[] not null default
  array['cash','gcash','maya','credit','debit','cheque','salmon','other']::text[];

update public.deposit_verifications verification
set expected_amount = report.reported_total,
    checked_payment_types = array['cash','gcash','maya','credit','debit','cheque','salmon','other']::text[]
from public.daily_reports report
where report.id = verification.report_id
  and (
    verification.expected_amount is distinct from report.reported_total
    or verification.checked_payment_types is null
    or cardinality(verification.checked_payment_types) = 0
  );

alter table public.deposit_verifications
  drop constraint if exists deposit_verifications_checked_payment_types_valid;

alter table public.deposit_verifications
  add constraint deposit_verifications_checked_payment_types_valid
  check (
    cardinality(checked_payment_types) between 1 and 8
    and checked_payment_types <@ array['cash','gcash','maya','credit','debit','cheque','salmon','other']::text[]
  );

create or replace function public.checker_can_access_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists (
    select 1
    from public.daily_reports report
    where report.id = target_report_id
      and report.status not in ('draft','reopened')
      and public.has_permission('checker_verify')
      and (
        public.has_permission('reports_all_branches')
        or report.branch_id = public.current_branch()
      )
  );
$$;

revoke all on function public.checker_can_access_report(uuid) from public;
grant execute on function public.checker_can_access_report(uuid) to authenticated;

-- A Deposit Checker must use the scoped RPC below. Direct daily_reports SELECT
-- is blocked so hidden payment fields cannot be recovered through the browser API.
drop policy if exists reports_read on public.daily_reports;
create policy reports_read on public.daily_reports
for select to authenticated
using (
  public.current_role() is distinct from 'checker'::public.app_role
  and public.has_permission('reports_view')
  and (
    public.has_permission('reports_all_branches')
    or branch_id = public.current_branch()
  )
);

-- Verification writes remain available to checker accounts without requiring a
-- direct SELECT policy on the underlying daily report.
drop policy if exists verification_insert on public.deposit_verifications;
create policy verification_insert on public.deposit_verifications
for insert to authenticated
with check (
  public.has_permission('checker_verify')
  and verified_by = (select auth.uid())
  and public.checker_can_access_report(report_id)
);

drop policy if exists verification_update on public.deposit_verifications;
create policy verification_update on public.deposit_verifications
for update to authenticated
using (
  public.has_permission('checker_verify')
  and public.checker_can_access_report(report_id)
)
with check (
  public.has_permission('checker_verify')
  and verified_by = (select auth.uid())
  and public.checker_can_access_report(report_id)
);

-- Calculate the expected amount from the verifier's authorized payment scope.
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

  if cardinality(selected_types) = 0 then
    raise exception 'The Deposit Checker has no authorized payment fields.';
  end if;

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

drop trigger if exists sync_deposit on public.deposit_verifications;
create trigger sync_deposit
before insert or update on public.deposit_verifications
for each row execute function public.sync_verification();

create or replace function public.get_scoped_daily_reports(p_business_date date)
returns setof jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  actor_branch uuid;
  actor_scope jsonb;
  selected_types text[];
  expose_complete_entry boolean;
  can_view_all_branches boolean;
begin
  select role,branch_id,checker_scope
    into actor_role,actor_branch,actor_scope
    from public.profiles
   where id = actor_id
     and active = true;

  if actor_role is null then
    raise exception 'An active system profile is required.';
  end if;

  if not public.has_permission('checker_view')
     and not public.has_permission('reports_view') then
    raise exception 'You are not authorized to view branch reports.';
  end if;

  expose_complete_entry := actor_role <> 'checker'::public.app_role
    or coalesce((actor_scope ->> 'all')::boolean,true);

  selected_types := case
    when actor_role = 'checker'::public.app_role
      then public.checker_scope_payment_types(actor_scope)
    else array['cash','gcash','maya','credit','debit','cheque','salmon','other']::text[]
  end;

  if cardinality(selected_types) = 0 then
    raise exception 'The Deposit Checker has no authorized payment fields.';
  end if;

  can_view_all_branches := public.has_permission('reports_all_branches');

  return query
  select jsonb_build_object(
    'id',report.id,
    'branch_id',report.branch_id,
    'business_date',report.business_date,
    'cash',case when 'cash' = any(selected_types) then report.cash else null end,
    'gcash',case when 'gcash' = any(selected_types) then report.gcash else null end,
    'maya',case when 'maya' = any(selected_types) then report.maya else null end,
    'credit',case when 'credit' = any(selected_types) then report.credit else null end,
    'debit',case when 'debit' = any(selected_types) then report.debit else null end,
    'cheque',case when 'cheque' = any(selected_types) then report.cheque else null end,
    'salmon',case when 'salmon' = any(selected_types) then report.salmon else null end,
    'other',case when 'other' = any(selected_types) then report.other else null end,
    'reported_total',round(
        (case when 'cash' = any(selected_types) then report.cash else 0 end)
      + (case when 'gcash' = any(selected_types) then report.gcash else 0 end)
      + (case when 'maya' = any(selected_types) then report.maya else 0 end)
      + (case when 'credit' = any(selected_types) then report.credit else 0 end)
      + (case when 'debit' = any(selected_types) then report.debit else 0 end)
      + (case when 'cheque' = any(selected_types) then report.cheque else 0 end)
      + (case when 'salmon' = any(selected_types) then report.salmon else 0 end)
      + (case when 'other' = any(selected_types) then report.other else 0 end),
      2
    ),
    'customer_count',case when expose_complete_entry then report.customer_count else null end,
    'store_remarks',case when expose_complete_entry then report.store_remarks else null end,
    'status',report.status,
    'submitted_at',report.submitted_at,
    'created_at',report.created_at,
    'updated_at',report.updated_at,
    'checker_scope',jsonb_build_object(
      'all',expose_complete_entry,
      'payment_types',to_jsonb(selected_types)
    ),
    'branches',jsonb_build_object(
      'id',branch.id,
      'code',branch.code,
      'name',branch.name
    ),
    'deposit_verifications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',verification.id,
        'actual_received',verification.actual_received,
        'reading',verification.reading,
        'expected_amount',verification.expected_amount,
        'difference',verification.difference,
        'remarks',verification.remarks,
        'checked_payment_types',to_jsonb(verification.checked_payment_types),
        'verified_by',verification.verified_by,
        'verified_at',verification.verified_at
      ))
      from public.deposit_verifications verification
      where verification.report_id = report.id
    ),'[]'::jsonb)
  )
  from public.daily_reports report
  join public.branches branch on branch.id = report.branch_id
  where report.business_date = p_business_date
    and (can_view_all_branches or report.branch_id = actor_branch)
  order by report.created_at desc;
end;
$$;

revoke all on function public.get_scoped_daily_reports(date) from public;
revoke all on function public.get_scoped_daily_reports(date) from anon;
grant execute on function public.get_scoped_daily_reports(date) to authenticated;

comment on column public.profiles.checker_scope is
  'Administrator-defined payment fields visible to a Deposit Checker. all=true exposes the complete store entry.';
comment on column public.deposit_verifications.expected_amount is
  'Server-calculated total of the payment fields authorized for the verifier.';
comment on column public.deposit_verifications.checked_payment_types is
  'Payment-field scope used for this verification, preserved for audit accuracy.';
comment on function public.get_scoped_daily_reports(date) is
  'Returns complete reports to authorized non-checkers and masked, scope-limited reports to Deposit Checker accounts.';

commit;
notify pgrst, 'reload schema';
