# Kaking Store Cash — Complete Supabase Setup

This guide is for Supabase project reference `cdmghdexjcqcmrwnbglw`.

## 1. Correct client configuration

Use the base project URL, not the REST endpoint:

```text
https://cdmghdexjcqcmrwnbglw.supabase.co
```

The browser application must use only the Supabase publishable key. Never place a secret key, legacy `service_role` key, database password, or direct database connection string in client code or GitHub.

The current application reads its client settings from `config.js`.

## 2. Run the database schema

1. Open the Supabase Dashboard and select **Kaking Store Cash**.
2. Open **SQL Editor**.
3. Select **New query**.
4. Open `supabase/schema.sql` from this repository.
5. Copy the complete file into the SQL Editor.
6. Select **Run**.
7. Wait for a successful result before creating application users.

The schema creates:

- `branches`
- `profiles`
- `daily_reports`
- `deposit_verifications`
- `audit_logs`
- automatic user-profile creation
- automatic totals and reconciliation status
- Row Level Security policies
- report locking and audit triggers

## 3. Confirm the tables

Run this query:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'branches',
    'profiles',
    'daily_reports',
    'deposit_verifications',
    'audit_logs'
  )
order by table_name;
```

Expected result: five rows.

## 4. Confirm Row Level Security

Run:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'branches',
    'profiles',
    'daily_reports',
    'deposit_verifications',
    'audit_logs'
  )
order by tablename;
```

Every `rowsecurity` value must be `true`.

## 5. Confirm the initial branches

Run:

```sql
select code, name, active
from public.branches
order by name;
```

Initial codes:

| Code | Branch |
|---|---|
| KPM | Parkmall |
| KMAC | Mactan |
| KTBK | Tabunok |
| KSTO | KSTO |
| K138 | K138 |
| K168 | K168 |
| KHWR | Hardware |

## 6. Configure email authentication

1. Open **Authentication**.
2. Open **Sign In / Providers**.
3. Ensure the **Email** provider is enabled.
4. This system has no public registration screen. Keep account creation controlled by an administrator.
5. In the general Auth configuration, turn off public sign-ups after the required users have been created.
6. When the Vercel site is live, set the Auth **Site URL** to the production website address.
7. Add the same production address to the allowed redirect URLs if invitations or password-reset emails will be used.

## 7. Create the first administrator

1. Open **Authentication > Users**.
2. Select **Add user**.
3. Create or invite the administrator email.
4. Complete email confirmation or password setup.
5. Run this SQL, replacing the email:

```sql
update public.profiles
set full_name = 'System Administrator',
    role = 'admin',
    branch_id = null,
    active = true
where id = (
  select id
  from auth.users
  where lower(email) = lower('YOUR-ADMIN-EMAIL')
);
```

Confirm:

```sql
select u.email, p.full_name, p.role, p.active
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('YOUR-ADMIN-EMAIL');
```

## 8. Create a store account

Create or invite the store user under **Authentication > Users**, then assign the branch.

Example for Parkmall:

```sql
update public.profiles
set full_name = 'Parkmall Store User',
    role = 'store_user',
    branch_id = (
      select id from public.branches where code = 'KPM'
    ),
    active = true
where id = (
  select id
  from auth.users
  where lower(email) = lower('PARKMALL-EMAIL')
);
```

Example for Mactan:

```sql
update public.profiles
set full_name = 'Mactan Store User',
    role = 'store_user',
    branch_id = (
      select id from public.branches where code = 'KMAC'
    ),
    active = true
where id = (
  select id
  from auth.users
  where lower(email) = lower('MACTAN-EMAIL')
);
```

Repeat using the correct branch code for every store.

## 9. Create the deposit checker

```sql
update public.profiles
set full_name = 'Deposit Checker',
    role = 'checker',
    branch_id = null,
    active = true
where id = (
  select id
  from auth.users
  where lower(email) = lower('CHECKER-EMAIL')
);
```

## 10. Create the executive reviewer

```sql
update public.profiles
set full_name = 'Executive Reviewer',
    role = 'executive',
    branch_id = null,
    active = true
where id = (
  select id
  from auth.users
  where lower(email) = lower('EXECUTIVE-EMAIL')
);
```

## 11. Review all accounts and roles

```sql
select
  u.email,
  p.full_name,
  p.role,
  b.code as branch_code,
  b.name as branch_name,
  p.active
from public.profiles p
join auth.users u on u.id = p.id
left join public.branches b on b.id = p.branch_id
order by p.role, b.name, p.full_name;
```

Do not activate a `store_user` without assigning a branch.

## 12. Test the Store User role

1. Sign in using one store account.
2. Confirm the Branch field is locked to that user's assigned branch.
3. Enter test values for all payment types.
4. Confirm **IN TOTAL** equals the sum of all eight payment types.
5. Save as Draft.
6. Edit the draft and confirm it saves.
7. Submit the report.
8. Confirm the submitted report becomes locked.
9. Sign in using another branch account and confirm it cannot see the first branch's data.

## 13. Test the Deposit Checker role

1. Sign in using the checker account.
2. Select a submitted report.
3. Enter the actual received amount and reading/reference.
4. For an exact match, confirm the difference is `0.00` and the status becomes **Matched**.
5. Enter a different actual amount and confirm remarks become required.
6. Save and confirm the status becomes **With Difference**.

The calculation is:

```text
Reported Total = CASH + G-CASH + MAYA + CREDIT + DEBIT + CHEQUE + SALMON + OTHER
Difference = Actual Received - Reported Total
```

## 14. Test the Executive and Administrator roles

Executive Reviewer:

- can view all branch reports
- can review daily summaries
- can view audit records
- cannot submit store entries or perform deposit verification

Administrator:

- can review all branches and reports
- can manage branch and profile records through authorized administration procedures
- should be used only by trusted system administrators

## 15. Verify the audit trail

After submitting and checking a report, run:

```sql
select
  created_at,
  actor_name,
  action,
  entity_type,
  entity_id
from public.audit_logs
order by created_at desc
limit 50;
```

You should see entries for `daily_reports` and `deposit_verifications`.

## 16. Production security checklist

- Make the GitHub repository private.
- Use the publishable key only in browser code.
- Never expose a secret key, `service_role` key, or database password.
- Keep RLS enabled on every exposed table.
- Do not create public access policies for financial tables.
- Use separate accounts for stores, checker, executive, and administrator.
- Disable accounts immediately when staff leave or change responsibilities.
- Test every role before entering real financial data.
- Use strong unique passwords.
- Enable multi-factor authentication for high-privilege users when available.
- Review audit records regularly.

## 17. Backup setup

For paid Supabase plans, review **Database > Backups** and confirm daily backups are available. For a free project, create regular logical exports using the Supabase CLI and keep an encrypted off-site copy. Test restoration before relying on the system for live operations.

## 18. Final production test

Before real use, complete one full test day:

1. Every test branch submits a report.
2. The checker verifies every report.
3. The executive account confirms totals and differences.
4. Export the CSV and compare it with the Supabase table values.
5. Confirm unauthorized branch access is blocked.
6. Confirm submitted reports cannot be edited by store users.
7. Confirm differences require remarks.
8. Confirm audit records were generated.
9. Confirm a backup exists or a manual export was completed.

Only start live encoding after all nine checks pass.
