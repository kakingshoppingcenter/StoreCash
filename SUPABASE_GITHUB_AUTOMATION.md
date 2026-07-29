# Supabase GitHub Automation

The repository now contains controlled GitHub Actions workflows for the Supabase project `cdmghdexjcqcmrwnbglw`.

## Workflows

### Edge Functions

File: `.github/workflows/deploy-supabase-functions.yml`

- Automatically runs when files under `supabase/functions/` or `supabase/config.toml` change on `main`.
- Can also be started manually from GitHub Actions.
- Deploys the `admin-users` Edge Function.
- Uses only the encrypted secret `SUPABASE_ACCESS_TOKEN`.
- Does not use or expose a service-role key in the repository or website.

### Database migrations

File: `.github/workflows/deploy-supabase-database.yml`

- Manual production deployment only.
- Requires typing `DEPLOY_DATABASE` before the job can run.
- Performs a dry run before applying migrations.
- Uses encrypted secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.
- Applies only timestamped migration files under `supabase/migrations/`.

## Required encrypted GitHub secrets

Open the repository and go to:

```text
Settings → Secrets and variables → Actions → New repository secret
```

Add:

```text
SUPABASE_ACCESS_TOKEN
```

Create the value in the Supabase account access-token page. This is a personal deployment token and must never be committed to a file or pasted into the website.

For database migrations, also add:

```text
SUPABASE_DB_PASSWORD
```

Use the Supabase project database password, not the website login password.

## First function deployment

After `SUPABASE_ACCESS_TOKEN` is added:

1. Open GitHub → Actions.
2. Select **Deploy Supabase Edge Functions**.
3. Select **Run workflow** on `main`.
4. Wait for **Deploy admin-users** to complete successfully.
5. Sign out and sign back in to Kaking Store Cash.
6. Open **Administration** and confirm the authorized-user list loads.

## Production safety

- Never commit `.env` files, access tokens, database passwords, secret keys, or service-role keys.
- Never run `supabase db reset --linked` against production.
- Add each future database change as a new timestamped migration.
- Review the dry-run output before approving a production database deployment.
