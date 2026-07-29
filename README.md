# KakingStoreCash

Professional daily store cash reporting and deposit reconciliation system.

## Included

- Responsive daily store entry interface
- Automatic total for CASH, G-CASH, MAYA, CREDIT, DEBIT, CHEQUE, SALMON, and OTHER
- Customer-count tracking
- Deposit verification with actual received amount and reading/reference
- Automatic difference and status calculation
- Mandatory remarks when a difference exists
- Branch submission table and executive daily summary
- CSV export
- Browser-based demo storage for immediate testing
- Supabase PostgreSQL production schema with Row Level Security
- Store User, Checker, Executive, and Administrator role design
- Submitted-report locking, unique branch/date control, and audit-ready tables

## Immediate preview

The current version is a static web application. Open `index.html` locally, or enable GitHub Pages for the repository.

## Recommended deployment

1. Make this repository **private** before adding real operational data or credentials.
2. Import the repository into Vercel.
3. Use the project name `kakingstorecash` to request the link `kakingstorecash.vercel.app`.
4. Create a Supabase project.
5. Run `supabase/schema.sql` in the Supabase SQL editor.
6. Create authorized users and corresponding `profiles` records.
7. Replace browser demo persistence with the Supabase client before production use.
8. Test all roles, report locking, calculations, exports, and backup/restore procedures.

## Calculation rules

- `Reported Total = CASH + G-CASH + MAYA + CREDIT + DEBIT + CHEQUE + SALMON + OTHER`
- `Difference = Actual Received - Reported Total`
- Difference `0.00` = `Matched`
- Non-zero difference = `With Difference`
- No verification yet = `Pending Verification`

## Production warning

The included browser-storage mode is for UI demonstration and controlled testing only. It is not a replacement for Supabase authentication and database storage. Do not use the demo mode for live confidential financial data.
