# Protected Operational Data Reset

The System Administration module now contains **Data Reset and Recovery** for authorized System Administrators.

## Reset scope

The reset permanently removes:

- Daily store reports
- Deposit verifications
- Previous audit entries

The reset preserves:

- Supabase authentication users
- System profiles
- Branches
- Roles and permissions
- Database tables, policies, triggers, and schema

After a successful reset, one new audit entry is written with the administrator name, deletion counts, timestamp, and stated reason.

## Required deployment

1. In **Supabase Dashboard > SQL Editor**, run:

   ```text
   supabase/reset_data_extension.sql
   ```

   Run it after the existing production migrations, especially `production_hardening.sql`.

2. Deploy the Edge Function using the exact name:

   ```text
   admin-reset-data
   ```

   Source file:

   ```text
   supabase/functions/admin-reset-data/index.ts
   ```

3. Configure the same server-side Supabase secrets used by the existing administration functions. Never expose the secret key in browser files.

4. In the Edge Function settings, use the same JWT-verification configuration as the working `admin-users` function. The function validates the caller token itself and permits only active profiles with role `admin`.

## Required confirmation

The web system requires all of the following before reset:

- Active System Administrator account
- Current authenticated session
- A written reset reason containing 10 to 500 characters
- Exact phrase: `RESET ALL RECORDS`
- Irreversible-action acknowledgement checkbox

The server repeats these checks. Browser controls alone are not trusted.

## Production procedure

Before reset:

1. Confirm written authorization from management/accounting.
2. Export the required business reports.
3. Confirm a current Supabase backup or point-in-time recovery option.
4. Review the record counts displayed in the Administration module.
5. Perform the reset during an approved maintenance window.
6. Confirm that reports and verifications are empty afterward.
7. Confirm that users, branches, roles, and permissions remain available.
8. Confirm that the new `system_reset` audit entry is visible.

Do not use this function as a routine cleanup tool. It is intended for authorized clean starts, test-data removal before production launch, or formally approved system resets.
