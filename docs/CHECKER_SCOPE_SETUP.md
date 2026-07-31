# Deposit Checker Scope Setup

This feature lets a System Administrator choose which Daily Store Entry payment fields each Deposit Checker may view and verify.

## Deployment order

Apply the feature in this order:

1. Back up the Supabase database.
2. Run `supabase/checker_scope_extension.sql` in **Supabase Dashboard > SQL Editor**.
3. Redeploy `supabase/functions/admin-users/index.ts` using the exact Edge Function name `admin-users`.
4. Deploy the updated website from the feature branch or merged `main` branch.
5. Sign out and sign in again before testing checker accounts.

Do not deploy the web interface first and leave the database migration pending. The server-side migration is what prevents a Deposit Checker from querying complete store reports.

## Configure a checker

1. Sign in as a System Administrator.
2. Open **Administration**.
3. Select a user from **Authorized Users**, or create a new user.
4. Choose **Deposit Checker** as the base role.
5. In **Deposit Checker Scope**:
   - Leave **Check all store-entry payment types** enabled for complete access; or
   - Disable it and select one or more payment types.
6. Save the user.

Available fields:

- CASH
- G-CASH
- MAYA
- CREDIT
- DEBIT
- CHEQUE
- SALMON
- OTHER

At least one payment type is required when **Check all** is disabled.

## Restricted behavior

For a restricted Deposit Checker:

- Supabase returns only the selected payment values.
- The displayed expected total is the sum of only those selected fields.
- Difference is calculated as `Actual Received - Authorized Expected Total`.
- Unselected payment values are returned as `null`, not as their real values.
- Complete reported total is not returned.
- Customer count is not returned.
- Store remarks are not returned.
- Direct `daily_reports` reads are blocked by Row Level Security.
- Verification records preserve the payment scope used at the time of checking.

When **Check all** is enabled, the checker may view all eight payment fields, customer count, and store remarks.

## Existing checker accounts

After the migration, existing Deposit Checker accounts default to **Check all** to avoid unexpectedly blocking current operations. Edit every checker account and save the intended payment scope.

## Required tests

### G-CASH only

1. Configure a checker with only G-CASH selected.
2. Submit a store report containing values in all payment fields.
3. Sign in as the checker.
4. Confirm only G-CASH is displayed.
5. Confirm the expected total equals G-CASH only.
6. Confirm customer count and store remarks show as restricted.

### CREDIT and DEBIT only

1. Configure another checker with CREDIT and DEBIT selected.
2. Confirm only CREDIT and DEBIT are displayed.
3. Confirm the expected total equals `CREDIT + DEBIT`.
4. Enter the same amount in Actual Received and confirm the result is Matched.
5. Enter a different amount and confirm remarks are required.

### Check all

1. Enable **Check all store-entry payment types**.
2. Confirm all eight payment values are visible.
3. Confirm customer count and store remarks are visible.
4. Confirm the expected total equals the complete store reported total.

### API security

Using a Deposit Checker session, confirm a direct browser request to `daily_reports` returns no complete report rows. The checker interface must continue to work through `get_scoped_daily_reports`.

## Rollback warning

Do not roll back only the website while leaving checker accounts dependent on the scoped RPC. If a rollback is required, restore the application and database from a coordinated backup or release point.
