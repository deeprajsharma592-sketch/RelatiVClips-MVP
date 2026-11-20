# Supabase setup for RelatiV

This repo uses Supabase Auth for identity and Supabase Postgres for the existing
SQLAlchemy application tables. The browser uses only the project URL and
publishable key. FastAPI connects to Postgres and validates access tokens with
Supabase Auth. Do not put a `service_role` key in the frontend.

## Configure the existing Supabase project

1. In **Project Settings → API**, copy the Project URL and publishable key.
   Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   in the frontend environment. Set `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` on the backend to the same values.
2. In **Project Settings → Database**, use the **Session pooler** connection
   string for the backend's `DATABASE_URL`. Use the asyncpg driver, for example
   `postgresql+asyncpg://.../postgres?sslmode=require`. This app normalizes
   `sslmode` to asyncpg's `ssl` option. Keep the database password in the
   backend's secret manager only.
3. Set `BACKEND_BASE_URL` in the frontend deployment to the backend's stable
   HTTPS origin. The frontend API proxy forwards the Supabase session to it.
4. In **Authentication → URL Configuration**, allow the deployed callback
   `https://relativclips.com/auth/callback` and local development callback
   `http://localhost:3000/auth/callback`. Configure Google under **Providers**
   if Google sign-in is needed. Set the desired email confirmation policy and
   SMTP sender in Supabase Auth.
5. Set `ADMIN_EMAILS` on the backend to the two founder emails. Admin access is
   checked by FastAPI against this server-side allowlist, after Supabase has
   verified the account and email.

## Preserve current platform records

Do not point the application at a fresh Supabase database and assume existing
users, clips, campaigns, and jobs will appear there. First take a backup of the
current PostgreSQL database and move its `public` application tables to the
Supabase project. The app's startup migration is additive: it creates missing
tables, adds the nullable `users.auth_user_id` bridge, and installs the Auth
sync trigger. It does not copy records from the old database.

Existing app rows are linked to a Supabase identity by normalized email on the
first successful verified sign-in. Their existing app user IDs and associated
profiles/foreign keys are retained. Legacy password hashes are cleared as the
identity is linked; users set a Supabase password or use Google sign-in. New
accounts are created as creators. Existing app roles are preserved. Never
import Supabase `auth.users` rows over the public app `users` table.

After setting Supabase env vars and `DATABASE_URL`, start the backend against a
staging copy first and confirm the admin dashboard, creator/brand/clipper
profiles, and foreign-key relationships. Apply the same verified migration to
production only after the backup and staging check.

## Tables and row security

Business data remains behind FastAPI and SQLAlchemy. Startup enables RLS on
public tables without adding browser-facing policies, so the Supabase Data API
does not expose platform records. The backend must connect with the database
owner/session-pooler role that can run migrations and bypass RLS. Keep the
publishable key public; keep database credentials and any elevated Supabase
keys server-side.
