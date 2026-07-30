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
- Administrator-defined payment scope for each Deposit Checker
- Server-masked checker reports that do not return unauthorized sales values
- Deposit checking against the actual amount received
- Automatic scoped expected amount, difference, and reconciliation status
- Required verification remarks whenever a difference exists
- One report per branch and business date
- Submitted-report locking and authorized reopening
- Executive daily summary and protected CSV export
- Administration for branches, accounts, roles, permissions, and checker scope
- Protected deletion of unused branches with typed confirmation
- Administrator-only operational-data reset with typed confirmation and audit recording
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
5. `supabase/branch_delete_extension.sql`
6. `supabase/checker_scope_extension.sql`
7. `supabase/reset_data_extension.sql`
8. Any other documented feature migration that has not yet been applied

The production hardening file adds server-side enforcement for:

- Valid report status transitions
- Immutable original submitter identity
- Store-user restrictions against assigning reconciliation statuses
- Checker restrictions against changing store-entered payment values
- Verification of submitted reports only
- Verifier identity matching the signed-in account
- Mandatory remarks for non-zero differences
- Branch-scoped verification permissions

The checker-scope extension adds:

- A payment-field scope on each checker profile
- A server-only scoped-report function
- Direct `daily_reports` read protection for Deposit Checker accounts
- Server-calculated expected amounts based only on authorized payment fields
- Historical recording of the payment fields used for each verification
- Restricted customer-count and store-remarks access unless **Check all** is enabled

The branch deletion extension allows permanent deletion only when a branch has no assigned users and no financial reports. Branches with historical or account references must be marked inactive instead. Successful branch changes and deletions are recorded in the audit trail.

## Required Supabase Edge Functions

Deploy these functions with their exact names and server-side secrets:

- `admin-users` — account, role, permission, and Deposit Checker scope management
- `admin-delete-user` — protected deletion of unused accounts
- `admin-reset-data` — protected operational-record reset

Never put a privileged Supabase key in browser code.

## Deposit Checker scope

When editing a user whose base role is **Deposit Checker**, Administration shows:

- **Check all store-entry payment types**
- CASH
- G-CASH
- MAYA
- CREDIT
- DEBIT
- CHEQUE
- SALMON
- OTHER

When **Check all** is disabled, at least one payment type must be selected. A restricted checker receives only the selected payment values from Supabase. The checker does not receive the complete reported total, unselected payment values, customer count, or store remarks.

Existing checker accounts default to **Check all** after the migration. Select each checker account in Administration and save the required scope.

See `docs/CHECKER_SCOPE_SETUP.md` for deployment and testing steps.

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
Complete Reported Total = CASH + G-CASH + MAYA + CREDIT + DEBIT + CHEQUE + SALMON + OTHER
Checker Expected Amount = Sum of the payment types authorized for that Deposit Checker
Difference = Actual Received - Checker Expected Amount
```

- Difference `0.00` = `Matched`
- Non-zero difference = `With Difference`
- No verification = `Pending Verification`

PostgreSQL is the final source of truth for totals, differences, checker scope, report status, permissions, and audit enforcement. Browser calculations are for immediate display and validation only.

## Deployment

The GitHub Pages deployment is available under the repository site. A Vercel deployment may also use the project name `kakingstorecash` when available.

## Production release checklist

Before entering real business data:

1. Change this GitHub repository from **public** to **private** if GitHub Pages is not required.
2. Run all required SQL files in the documented order.
3. Deploy and secure the required Edge Functions.
4. Create separate test accounts for every role.
5. Confirm that each store account sees only its assigned branch.
6. Confirm that submitted reports cannot be changed by store users.
7. Confirm that checkers cannot alter payment amounts.
8. Configure one checker for G-CASH only and confirm CASH, MAYA, cards, and other values are unavailable.
9. Configure another checker for CREDIT and DEBIT and confirm the expected total contains only those two fields.
10. Confirm **Check all** restores the complete payment breakdown, customer count, and store remarks.
11. Confirm a checker cannot retrieve complete `daily_reports` rows through the browser API.
12. Confirm reports with differences require remarks.
13. Confirm unauthorized API requests are rejected by Row Level Security.
14. Confirm audit records are created for report and verification changes.
15. Confirm used branches cannot be deleted and unused branches require code confirmation.
16. Test CSV and Excel exports using restricted checker accounts.
17. Test dates near midnight using the Asia/Manila timezone.
18. Test on mobile, tablet, laptop, and large desktop displays.
19. Configure automated Supabase backups and perform a real restoration test.
20. Document the recovery process and responsible administrators.

Do not treat the system as fully production-ready until this checklist is completed and signed off by both operations and accounting.
