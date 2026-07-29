# Supabase migrations

All future production database changes must be added here as timestamped SQL migration files.

Example:

```text
20260729150000_add_new_report_field.sql
```

Deployment is performed by `.github/workflows/deploy-supabase-database.yml` through a manual production run. Do not use `supabase db reset --linked` on production.

The original schema and administration extension were created before migration tracking was enabled. Keep `supabase/schema.sql` and `supabase/admin_extension.sql` as reference files. New changes must be placed in new migration files instead of editing an already-deployed migration.
