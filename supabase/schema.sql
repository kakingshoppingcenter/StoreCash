create extension if not exists pgcrypto;

create type public.app_role as enum ('store_user','checker','executive','admin');
create type public.report_status as enum ('draft','pending_verification','matched','with_difference','reopened');

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'store_user',
  branch_id uuid references public.branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint branch_required_for_store check (role <> 'store_user' or branch_id is not null)
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
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
  store_remarks text,
  status public.report_status not null default 'draft',
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id,business_date)
);

create table public.deposit_verifications (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.daily_reports(id) on delete restrict,
  actual_received numeric(14,2) not null check (actual_received >= 0),
  reading numeric(14,2) not null default 0 check (reading >= 0),
  difference numeric(14,2) not null,
  remarks text,
  verified_by uuid not null references public.profiles(id),
  verified_at timestamptz not null default now(),
  constraint remarks_required_for_difference check (difference = 0 or length(trim(coalesce(remarks,''))) > 0)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid() and active=true
$$;

create or replace function public.current_branch() returns uuid language sql stable security definer set search_path=public as $$
  select branch_id from public.profiles where id=auth.uid() and active=true
$$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
create trigger daily_reports_updated before update on public.daily_reports for each row execute function public.set_updated_at();

create or replace function public.protect_submitted_report() returns trigger language plpgsql as $$
begin
  if old.status in ('pending_verification','matched','with_difference') and public.current_role() not in ('admin','checker') then
    raise exception 'Submitted reports are locked.';
  end if;
  return new;
end $$;
create trigger protect_daily_report before update or delete on public.daily_reports for each row execute function public.protect_submitted_report();

create or replace function public.sync_verification() returns trigger language plpgsql security definer set search_path=public as $$
declare total numeric(14,2);
begin
  select reported_total into total from public.daily_reports where id=new.report_id;
  new.difference:=new.actual_received-total;
  update public.daily_reports set status=case when new.difference=0 then 'matched'::public.report_status else 'with_difference'::public.report_status end where id=new.report_id;
  return new;
end $$;
create trigger sync_deposit before insert or update on public.deposit_verifications for each row execute function public.sync_verification();

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_reports enable row level security;
alter table public.deposit_verifications enable row level security;
alter table public.audit_logs enable row level security;

create policy branches_read on public.branches for select to authenticated using (active=true or public.current_role() in ('admin','executive'));
create policy profiles_self_read on public.profiles for select to authenticated using (id=auth.uid() or public.current_role() in ('admin','executive'));
create policy reports_read on public.daily_reports for select to authenticated using (public.current_role() in ('admin','executive','checker') or branch_id=public.current_branch());
create policy reports_insert on public.daily_reports for insert to authenticated with check ((public.current_role()='store_user' and branch_id=public.current_branch() and submitted_by=auth.uid()) or public.current_role()='admin');
create policy reports_update on public.daily_reports for update to authenticated using ((public.current_role()='store_user' and branch_id=public.current_branch() and status in ('draft','reopened')) or public.current_role() in ('admin','checker')) with check (true);
create policy verification_read on public.deposit_verifications for select to authenticated using (public.current_role() in ('admin','executive','checker') or exists(select 1 from public.daily_reports r where r.id=report_id and r.branch_id=public.current_branch()));
create policy verification_write on public.deposit_verifications for all to authenticated using (public.current_role() in ('admin','checker')) with check (public.current_role() in ('admin','checker'));
create policy audit_read on public.audit_logs for select to authenticated using (public.current_role() in ('admin','executive'));

insert into public.branches(code,name) values
('KPM','Parkmall'),('KMAC','Mactan'),('KTBK','Tabunok'),('KSTO','KSTO'),('K138','K138'),('K168','K168'),('KHWR','Hardware')
on conflict do nothing;
