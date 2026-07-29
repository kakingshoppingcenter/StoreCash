# Kaking Store Cash — Codex Instructions

## System purpose
Kaking Store Cash is a production financial-control web application for daily branch payment reporting, deposit verification, reconciliation, audit history, branch administration, and user/permission management.

## Architecture
- Frontend: static HTML, CSS, and JavaScript hosted by GitHub Pages.
- Backend: Supabase Auth, PostgreSQL, Row Level Security, and Edge Functions.
- Production Supabase project ref: `cdmghdexjcqcmrwnbglw`.
- Browser code may use only the Supabase project URL and publishable key.
- User administration must use the `admin-users` Edge Function.

## Non-negotiable production safety
- Never commit or print Supabase secret keys, service-role keys, personal access tokens, database passwords, JWT secrets, or user passwords.
- Never place elevated credentials in `config.js`, browser code, HTML, CSS, screenshots, logs, issues, pull requests, or documentation.
- Never delete, truncate, reset, or recreate production tables or production data.
- Never run destructive database commands against production.
- Never weaken Row Level Security to fix an interface problem.
- Never expose PostgreSQL directly to the public internet.
- Preserve audit logs and submitted financial reports.
- Use additive, idempotent migrations and test them before production deployment.

## Required checks before committing
1. Confirm the login flow works with active profiles and provides a clear message for inactive or missing profiles.
2. Confirm GitHub Pages asset paths are relative to the `/StoreCash/` project path.
3. Confirm the logo, favicon, and copyright render without depending on Supabase.
4. Confirm Dashboard, Daily Entry, Deposit Checker, Branch Reports, Executive Summary, Audit Trail, and Administration navigation work by permission.
5. Confirm the Dashboard does not call `admin-users`; call it only when Administration is opened or a user-management action is performed.
6. Confirm branch management remains usable even if the Edge Function is unavailable.
7. Confirm store users can see only their assigned branch.
8. Confirm submitted reports remain locked except through authorized workflows.
9. Confirm payment totals and deposit differences use decimal-safe database calculations.
10. Confirm no real credentials or personal data were added to Git history.

## Supabase deployment
- Edge Function workflow: `.github/workflows/deploy-supabase-functions.yml`.
- Database workflow: `.github/workflows/deploy-supabase-database.yml`.
- Edge Function source: `supabase/functions/admin-users/index.ts`.
- Base schema: `supabase/schema.sql`.
- Administration extension: `supabase/admin_extension.sql`.
- Production migrations: `supabase/migrations/`.

The Edge Function deployment requires the encrypted GitHub Actions secret `SUPABASE_ACCESS_TOKEN`.
The database migration workflow additionally requires `SUPABASE_DB_PASSWORD` and manual confirmation `DEPLOY_DATABASE`.
Do not substitute the browser publishable key, legacy anon key, or `sb_secret_...` project key for the Supabase personal access token.

## GitHub Pages deployment
- The production branch is `main`.
- Use relative asset paths such as `./assets/...`.
- When browser caching may preserve a previous build, update the version query on CSS and JavaScript references in `index.html`.
- Do not introduce server-only dependencies into the static frontend.

## Change strategy
- Prefer focused, reversible commits.
- Do not change unrelated modules while fixing one issue.
- Preserve backward compatibility when a database extension may not yet be installed.
- Surface actionable errors to administrators while keeping technical details out of normal user screens.
- For production database changes, create a migration rather than editing live data manually.

## Completion standard
A change is complete only when code, permissions, database behavior, failure handling, mobile responsiveness, and production deployment implications have all been reviewed.