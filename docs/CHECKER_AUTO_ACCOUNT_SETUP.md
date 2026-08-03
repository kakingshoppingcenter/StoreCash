# Deposit Checker Auto-Account Setup

This extension prevents a restricted Deposit Checker from creating a false full-branch difference when the checker is authorized to verify only selected payment types.

## Accounting behavior

Example store report:

- Complete reported total: `₱6,350.00`
- Checker scope: `CREDIT` and `DEBIT`
- CREDIT + DEBIT expected amount: `₱2,750.00`
- Checker actual received: `₱2,750.00`
- Unassigned payment types: `₱3,600.00`

With **Auto-account for unassigned payment types** enabled:

```text
Reconciled amount = Checker actual received + Store-reported unassigned amount
                  = ₱2,750.00 + ₱3,600.00
                  = ₱6,350.00

Branch difference = ₱6,350.00 - ₱6,350.00
                  = ₱0.00
```

The system does not overwrite or inflate the checker's entered amount. It stores and displays these values separately:

- Scoped expected amount
- Checker-entered actual received
- Payment types checked
- Auto-account setting used
- Amount carried from unassigned store payment types
- Final full-branch reconciliation difference

A real scoped variance is never hidden. For example, if the checker enters `₱2,700.00` against a CREDIT + DEBIT expected amount of `₱2,750.00`, the full-branch difference remains `-₱50.00`.

## Required deployment

1. Back up the Supabase database.
2. Run `supabase/checker_auto_account_extension.sql` in **Supabase Dashboard > SQL Editor**.
3. Redeploy `supabase/functions/admin-users/index.ts` using the exact Edge Function name `admin-users`.
4. Refresh the StoreCash GitHub Pages application.
5. Sign out and sign in again before testing.

## Configure a Deposit Checker

1. Sign in as a System Administrator.
2. Open **Administration**.
3. Select the Deposit Checker account.
4. Disable **Check all store-entry payment types**.
5. Select the payment types the checker is responsible for, such as CREDIT and DEBIT.
6. Enable **Auto-account for unassigned payment types**.
7. Save the user.

The option is disabled when **Check all** is enabled because there are no unassigned payment types.

## Existing verifications

Existing verification records remain unchanged for audit safety. After enabling the option, the Deposit Checker must open and save the applicable verification again. The database will then stamp that verification with the current payment scope and auto-account setting.

## Required tests

### Matched scoped verification

1. Submit a store report containing values in all payment fields.
2. Configure a checker for CREDIT and DEBIT only.
3. Enable auto-accounting.
4. Enter an Actual Received amount equal to CREDIT + DEBIT.
5. Save the verification.
6. Confirm Branch Reconciliation shows the full store total as reconciled and a difference of `₱0.00`.
7. Confirm the row identifies the verified amount and auto-accounted amount separately.

### Real scoped difference

1. Enter an Actual Received amount lower than CREDIT + DEBIT by `₱50.00`.
2. Confirm verification remarks are required.
3. Save the verification.
4. Confirm Branch Reconciliation shows a full-branch difference of `-₱50.00`, not zero.

### Disabled option

1. Disable auto-accounting for the checker and save the user.
2. Save a new verification.
3. Confirm the system does not carry unassigned payment types into the reconciled amount.

## Security and audit notes

- A restricted checker still cannot view unselected payment values.
- Direct complete `daily_reports` access remains blocked for checker accounts.
- The browser never receives a privileged Supabase key.
- PostgreSQL remains the source of truth for the scoped expected amount and verification difference.
- The new option adds reconciliation metadata; it does not modify store-entered payment values.
