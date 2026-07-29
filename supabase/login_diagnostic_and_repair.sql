-- Kaking Store Cash login diagnostic and administrator profile repair
-- Run in Supabase SQL Editor only when an existing Auth user cannot enter the system.
-- Replace YOUR-ADMIN-EMAIL before running.

-- 1. DIAGNOSTIC: Check whether the Auth user and system profile exist.
select
  u.id,
  u.email,
  u.email_confirmed_at,
  u.banned_until,
  p.full_name,
  p.role,
  p.branch_id,
  p.active
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('YOUR-ADMIN-EMAIL');

-- Expected for an administrator:
-- email_confirmed_at is not null
-- banned_until is null or in the past
-- role = admin
-- active = true

-- 2. REPAIR: Create the missing profile or restore administrator access.
do $$
declare
  target_email text := 'YOUR-ADMIN-EMAIL';
  target_user_id uuid;
  target_name text;
begin
  if target_email = 'YOUR-ADMIN-EMAIL' then
    raise exception 'Replace YOUR-ADMIN-EMAIL with the real administrator email before running this repair.';
  end if;

  select
    id,
    coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), split_part(email, '@', 1), 'System Administrator')
  into target_user_id, target_name
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No Supabase Auth user exists for %', target_email;
  end if;

  insert into public.profiles (id, full_name, role, branch_id, active)
  values (target_user_id, target_name, 'admin', null, true)
  on conflict (id) do update
  set full_name = coalesce(nullif(trim(public.profiles.full_name), ''), excluded.full_name),
      role = 'admin',
      branch_id = null,
      active = true,
      updated_at = now();
end $$;

-- 3. VERIFY: Confirm the repaired profile.
select
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  p.active
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('YOUR-ADMIN-EMAIL');
