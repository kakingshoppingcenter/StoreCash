# KakingStoreCash

Professional daily branch cash reporting, deposit verification, and executive reconciliation system.

## Current implementation

The repository contains a working responsive web application connected to Supabase. It includes:

- Secure Supabase email and password authentication
- Store User, Deposit Checker, Executive Reviewer, and System Administrator roles
- Individual permission overrides
- Branch-restricted access using Row Level Security
- Daily entry for CASH, G-CASH, MAYA, CREDIT, DEBIT, CHEQUE, SALMON, and OTHER
- Automatic reported total and customer-count tracking
- Deposit checking against the actual amount received
- Automatic difference and reconciliation status
- Required verification remarks whenever a difference exists
- One report per branch and business date
- Submitted-report locking and authorized reopening
- Executive daily summary and protected CSV export
- Administration for branches, accounts, roles, and permissions
- Password-change controls
- Immutable audit records for financial changes
- Responsive desktop, tablet, and mobile interface
- Manila-local business-date handling
- Cent-accurate browser calculations with server-side PostgreSQL recalculation

## Security rule

Only the Supabase browser-safe publishable key belongs in `config.js`. Never commit any of the following:

- Supabase secret key or legacy `service_role` key
- Database password
- User passwords
- `.env` files containing secrets
- Production database exports
- Real employee or customer information

Row Level Security must remain enabled for every exposed table.

## Required database setup

Run the SQL files in this exact order from **Supabase Dashboard > SQL Editor**:

1. `supabase/schema.sql`
2. `supabase/admin_extension.sql`
3. `supabase/production_hardening.sql`
4. `supabase/report_reopen_extension.sql`
5. Any other documented feature migration that has not yet been applied

The production hardening file adds server-side enforcement for:

- Valid report status transitions
- Immutable original submitter identity
- Store-user restrictions against assigning reconciliation statuses
- Checker restrictions against changing store-entered payment values
- Verification of submitted reports only
- Verifier identity matching the signed-in account
- Mandatory remarks for non-zero differences
- Branch-scoped verification permissions

## Required Supabase Edge Function

Deploy the `admin-users` Edge Function before using web-based user administration. Configure its server-side secrets in Supabase. Never put its privileged key in browser code.

## Initial administrator

1. Create the first account under **Authentication > Users**.
2. Run the following SQL using the account's real email address:

```sql
update public.profiles
set full_name = 'System Administrator',
    role = 'admin',
    active = true
where id = (
  select id from auth.users where email = 'YOUR-ADMIN-EMAIL'
);
```

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

Initial branch codes:

| Code | Branch |
|---|---|
| KPM | Parkmall |
| KMAC | Mactan |
| KTBK | Tabunok |
| KSTO | KSTO |
| K138 | K138 |
| K168 | K168 |
| KHWR | Hardware |

Available roles:

- `store_user`
- `checker`
- `executive`
- `admin`

## Calculation rules

```text
Reported Total = CASH + G-CASH + MAYA + CREDIT + DEBIT + CHEQUE + SALMON + OTHER
Difference = Actual Received - Reported Total
```

- Difference `0.00` = `Matched`
- Non-zero difference = `With Difference`
- No verification = `Pending Verification`

PostgreSQL is the final source of truth for totals, differences, report status, permissions, and audit enforcement. Browser calculations are for immediate display and validation only.

## Deployment

Import this repository into Vercel and request the project name `kakingstorecash`. The expected public address is:

```text
https://kakingstorecash.vercel.app
```

The exact address is available only when that Vercel project name has not already been claimed.

## Production release checklist

Before entering real business data:

1. Change this GitHub repository from **public** to **private**.
2. Run all required SQL files in the documented order.
3. Deploy and secure the `admin-users` Edge Function.
4. Create separate test accounts for every role.
5. Confirm that each store account sees only its assigned branch.
6. Confirm that submitted reports cannot be changed by store users.
7. Confirm that checkers cannot alter payment amounts.
8. Confirm that reports with differences require remarks.
9. Confirm that unauthorized API requests are rejected by Row Level Security.
10. Confirm that audit records are created for report and verification changes.
11. Test CSV exports using remarks beginning with `=`, `+`, `-`, and `@`.
12. Test dates near midnight using the Asia/Manila timezone.
13. Test on mobile, tablet, laptop, and large desktop displays.
14. Configure automated Supabase backups and perform a real restoration test.
15. Document the recovery process and responsible administrators.

Do not treat the system as fully production-ready until this checklist is completed and signed off by both operations and accounting.
