# KakingStoreCash

Professional daily branch cash reporting, deposit verification, and executive reconciliation system.

## Production features

- Secure Supabase email and password authentication
- Store User, Deposit Checker, Executive Reviewer, and System Administrator roles
- Branch-restricted access using Row Level Security
- Daily entry for CASH, G-CASH, MAYA, CREDIT, DEBIT, CHEQUE, SALMON, and OTHER
- Automatic reported total and customer-count tracking
- Deposit checking against the actual amount received
- Automatic difference and reconciliation status
- Required verification remarks whenever a difference exists
- One report per branch and business date
- Submitted-report locking
- Executive daily summary and CSV export
- Immutable financial-record protection and audit trail
- Responsive desktop, tablet, and mobile interface

## Supabase project connection

The web application is configured to use the assigned Supabase project through `config.js`. Only the browser-safe publishable key is used. Never add a database password, secret key, or `service_role` key to this repository or to client-side code.

## Required one-time database setup

1. Open the Supabase Dashboard.
2. Go to **SQL Editor** and create a new query.
3. Open `supabase/schema.sql` from this repository.
4. Copy the entire file into the SQL Editor and select **Run**.
5. Confirm that the following tables are created:
   - `branches`
   - `profiles`
   - `daily_reports`
   - `deposit_verifications`
   - `audit_logs`
6. Go to **Authentication > Users** and create the first system user.
7. Return to the SQL Editor and promote that account using the command below.

```sql
update public.profiles
set full_name = 'System Administrator',
    role = 'admin',
    active = true
where id = (
  select id from auth.users where email = 'YOUR-ADMIN-EMAIL'
);
```

Replace `YOUR-ADMIN-EMAIL` with the actual email address created in Authentication.

## Assign a store account

Create the store account under **Authentication > Users**, then run:

```sql
update public.profiles
set full_name = 'Parkmall Store User',
    role = 'store_user',
    branch_id = (select id from public.branches where code = 'KPM'),
    active = true
where id = (
  select id from auth.users where email = 'STORE-EMAIL'
);
```

Available initial branch codes:

| Code | Branch |
|---|---|
| KPM | Parkmall |
| KMAC | Mactan |
| KTBK | Tabunok |
| KSTO | KSTO |
| K138 | K138 |
| K168 | K168 |
| KHWR | Hardware |

## Assign other roles

Use one of these role values:

- `store_user`
- `checker`
- `executive`
- `admin`

Example checker activation:

```sql
update public.profiles
set full_name = 'Deposit Checker',
    role = 'checker',
    branch_id = null,
    active = true
where id = (
  select id from auth.users where email = 'CHECKER-EMAIL'
);
```

## Calculation rules

```text
Reported Total = CASH + G-CASH + MAYA + CREDIT + DEBIT + CHEQUE + SALMON + OTHER
Difference = Actual Received - Reported Total
```

- Difference `0.00` = `Matched`
- Non-zero difference = `With Difference`
- No verification = `Pending Verification`

## Deployment

Import this repository into Vercel and request the project name `kakingstorecash`. The expected address is `kakingstorecash.vercel.app` when that name is available.

Before using real business data:

- Change the GitHub repository to private.
- Run the complete Supabase schema.
- Create and activate authorized accounts.
- Test each role using separate accounts.
- Verify report locking, branch restrictions, calculations, exports, and audit records.
- Configure database backups and recovery procedures.
