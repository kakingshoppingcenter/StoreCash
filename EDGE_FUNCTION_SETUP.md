# Fix: Failed to send a request to the Edge Function

The Administration page calls a Supabase Edge Function named exactly `admin-users`. This function must be deployed separately from the Vercel website.

## A. Apply the administration database extension

1. Open the Supabase project `Kaking Store Cash`.
2. Go to **SQL Editor**.
3. Select **New query**.
4. Open `supabase/admin_extension.sql` from this repository.
5. Copy the complete SQL file into the editor.
6. Select **Run**.
7. Confirm the query finishes successfully.

This adds the `email` and `permissions` profile fields and permission-aware Row Level Security policies.

## B. Deploy the Edge Function through the Supabase Dashboard

1. In Supabase, open **Edge Functions**.
2. Select **Deploy a new function**.
3. Choose **Via Editor**.
4. Set the function name to exactly:

```text
admin-users
```

5. Open `supabase/functions/admin-users/index.ts` from this repository.
6. Copy the complete file into the Supabase function editor.
7. Keep JWT verification enabled.
8. Select **Deploy function**.
9. Wait until the function status shows deployed/active.

The expected endpoint is:

```text
https://cdmghdexjcqcmrwnbglw.supabase.co/functions/v1/admin-users
```

Do not put a service-role key in the website. Hosted Supabase Edge Functions receive the required server-side secret environment variables automatically.

## C. Verify the deployment

1. Open **Edge Functions > admin-users**.
2. Open the function logs.
3. Return to Kaking Store Cash.
4. Sign out and sign in again as an administrator.
5. Refresh using `Ctrl + F5`.
6. Open **Administration**.
7. Confirm the user list loads.
8. Create one test user with a temporary password of at least 10 characters.

## D. If it still fails

Check the function logs for one of these messages:

- `Invalid or expired session` — sign out and sign in again.
- `Your account is not active` — activate the administrator profile.
- `You are not authorized to manage users` — set the account role to `admin` or grant `manage_users`.
- `relation ... does not exist` or missing profile columns — run both `supabase/schema.sql` and `supabase/admin_extension.sql`.
- CORS or network failure — confirm the deployed function name is exactly `admin-users`.

## E. Confirm the administrator account

Run this in the SQL Editor, replacing the email:

```sql
select
  u.email,
  p.full_name,
  p.role,
  p.active,
  p.permissions
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('YOUR-ADMIN-EMAIL');
```

The administrator should show `role = admin` and `active = true`.
