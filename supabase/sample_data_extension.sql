-- Kaking Store Cash protected July 2026 sample-data generator
-- Run after the production, reset-data, checker-scope, and checker auto-account migrations.
-- This migration creates no sample records by itself. It only installs a server-only
-- function that an authenticated System Administrator can invoke through the
-- admin-sample-data Edge Function.

begin;

-- Keep all production report protections while allowing only the controlled
-- generator transaction to update report reconciliation status through the
-- existing verification trigger.
create or replace function public.protect_submitted_report()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op = 'UPDATE'
     and current_setting('app.allow_sample_generation', true) = 'on' then
    return new;
  end if;

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

create or replace function public.admin_generate_sample_data(
  p_actor_id uuid,
  p_start_date date,
  p_end_date date,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor_name text;
  existing_reports bigint := 0;
  active_branches integer := 0;
  report_count integer := 0;
  verification_count integer := 0;
  matched_count integer := 0;
  difference_count integer := 0;
  pending_count integer := 0;
  branch_record record;
  business_day date;
  day_number integer;
  cash_value numeric(14,2);
  gcash_value numeric(14,2);
  maya_value numeric(14,2);
  credit_value numeric(14,2);
  debit_value numeric(14,2);
  cheque_value numeric(14,2);
  salmon_value numeric(14,2);
  other_value numeric(14,2);
  report_id uuid;
  report_total numeric(14,2);
  variance numeric(14,2);
  actual_amount numeric(14,2);
  submitted_time timestamptz;
  variance_note text;
begin
  if p_start_date is distinct from date '2026-07-01'
     or p_end_date is distinct from date '2026-07-31' then
    raise exception 'This protected generator is limited to July 1-31, 2026.';
  end if;

  if p_confirmation is distinct from 'GENERATE JULY 2026 SAMPLE DATA' then
    raise exception 'The sample-data confirmation phrase is incorrect.';
  end if;

  select full_name
    into actor_name
    from public.profiles
   where id = p_actor_id
     and active = true
     and role = 'admin';

  if actor_name is null then
    raise exception 'Only an active System Administrator can generate sample data.';
  end if;

  perform pg_advisory_xact_lock(hashtext('kakingstorecash-july-2026-sample-data'));

  select count(*)
    into existing_reports
    from public.daily_reports
   where business_date between p_start_date and p_end_date;

  if existing_reports > 0 then
    raise exception 'July 2026 already contains % report(s). Reset or preserve those records before generating sample data.', existing_reports;
  end if;

  select count(*) into active_branches from public.branches where active = true;
  if active_branches = 0 then
    raise exception 'No active branches are available for sample-data generation.';
  end if;

  -- This transaction-local flag permits only status updates caused by the
  -- verification trigger. It expires automatically when the transaction ends.
  perform set_config('app.allow_sample_generation','on',true);

  for branch_record in
    select
      branch.id,
      branch.code,
      branch.name,
      row_number() over(order by branch.code)::integer as branch_number,
      coalesce((
        select user_profile.id
          from public.profiles user_profile
         where user_profile.active = true
           and user_profile.role = 'store_user'
           and user_profile.branch_id = branch.id
         order by user_profile.created_at, user_profile.id
         limit 1
      ), p_actor_id) as submitter_id
    from public.branches branch
    where branch.active = true
    order by branch.code
  loop
    for business_day in
      select generated_day::date
        from generate_series(p_start_date::timestamp,p_end_date::timestamp,interval '1 day') generated_day
    loop
      day_number := extract(day from business_day)::integer;

      cash_value := round((1800 + branch_record.branch_number * 325 + day_number * 47.35
        + case when extract(isodow from business_day) in (6,7) then 450 else 0 end)::numeric,2);
      gcash_value := round((650 + branch_record.branch_number * 75 + day_number * 23.15)::numeric,2);
      maya_value := round((320 + branch_record.branch_number * 52 + day_number * 15.45)::numeric,2);
      credit_value := round((520 + branch_record.branch_number * 68 + day_number * 20.25)::numeric,2);
      debit_value := round((610 + branch_record.branch_number * 61 + day_number * 18.75)::numeric,2);
      cheque_value := case when mod(day_number + branch_record.branch_number,7) = 0
        then round((700 + branch_record.branch_number * 100 + day_number * 11.50)::numeric,2)
        else 0 end;
      salmon_value := case when mod(day_number,3) = 0
        then round((280 + branch_record.branch_number * 35 + day_number * 7.25)::numeric,2)
        else 0 end;
      other_value := case when mod(day_number + branch_record.branch_number,4) = 0
        then round((150 + day_number * 9.50)::numeric,2)
        else 0 end;
      submitted_time := (business_day + time '21:00') at time zone 'Asia/Manila';

      insert into public.daily_reports(
        branch_id,business_date,cash,gcash,maya,credit,debit,cheque,salmon,other,
        customer_count,store_remarks,status,submitted_by,submitted_at,created_at,updated_at
      ) values (
        branch_record.id,
        business_day,
        cash_value,
        gcash_value,
        maya_value,
        credit_value,
        debit_value,
        cheque_value,
        salmon_value,
        other_value,
        55 + branch_record.branch_number * 8 + day_number * 3
          + case when extract(isodow from business_day) in (6,7) then 24 else 0 end,
        format('[SAMPLE DATA JULY 2026] Performance test record for %s on %s.',branch_record.code,to_char(business_day,'YYYY-MM-DD')),
        'pending_verification',
        branch_record.submitter_id,
        submitted_time,
        submitted_time - interval '20 minutes',
        submitted_time
      )
      returning id,reported_total into report_id,report_total;

      report_count := report_count + 1;

      -- About 20 percent remain pending. The verified records contain a
      -- controlled mix of exact matches, shortages, and overages.
      if mod(day_number + branch_record.branch_number,5) = 0 then
        pending_count := pending_count + 1;
      else
        variance := case
          when mod(day_number + branch_record.branch_number,7) = 0 then
            case when mod(day_number + branch_record.branch_number,2) = 0 then 100.00 else -75.00 end
          else 0.00
        end;
        actual_amount := round(report_total + variance,2);
        variance_note := case
          when variance < 0 then format('[SAMPLE DATA] Simulated shortage of %s for performance and alert testing.',to_char(abs(variance),'FM999999990.00'))
          when variance > 0 then format('[SAMPLE DATA] Simulated overage of %s for performance and alert testing.',to_char(variance,'FM999999990.00'))
          else null
        end;

        insert into public.deposit_verifications(
          report_id,actual_received,reading,remarks,verified_by,verified_at,created_at,updated_at
        ) values (
          report_id,
          actual_amount,
          actual_amount,
          variance_note,
          p_actor_id,
          submitted_time + interval '2 hours',
          submitted_time + interval '2 hours',
          submitted_time + interval '2 hours'
        );

        verification_count := verification_count + 1;
        if variance = 0 then
          matched_count := matched_count + 1;
        else
          difference_count := difference_count + 1;
        end if;
      end if;
    end loop;
  end loop;

  insert into public.audit_logs(
    actor_id,actor_name,action,entity_type,entity_id,old_data,new_data
  ) values (
    p_actor_id,
    actor_name,
    'sample_data_generated',
    'system',
    null,
    null,
    jsonb_build_object(
      'sample', true,
      'period', jsonb_build_object('from',p_start_date,'to',p_end_date),
      'active_branches', active_branches,
      'reports', report_count,
      'verifications', verification_count,
      'matched', matched_count,
      'with_difference', difference_count,
      'pending', pending_count
    )
  );

  return jsonb_build_object(
    'success', true,
    'period', jsonb_build_object('from',p_start_date,'to',p_end_date),
    'active_branches', active_branches,
    'reports', report_count,
    'verifications', verification_count,
    'matched', matched_count,
    'with_difference', difference_count,
    'pending', pending_count,
    'generated_at', now(),
    'generated_by', actor_name
  );
end;
$$;

revoke all on function public.admin_generate_sample_data(uuid,date,date,text) from public;
revoke all on function public.admin_generate_sample_data(uuid,date,date,text) from anon;
revoke all on function public.admin_generate_sample_data(uuid,date,date,text) from authenticated;
grant execute on function public.admin_generate_sample_data(uuid,date,date,text) to service_role;

comment on function public.admin_generate_sample_data(uuid,date,date,text) is
  'Server-only generator for clearly marked July 2026 performance-test reports. Refuses to run when the period already contains reports.';

commit;
notify pgrst, 'reload schema';
