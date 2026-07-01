# Deploying Shoghla (Vercel + Supabase + Databricks)

This app is a plain TanStack Start project — no Lovable dependency. Jobs are
read live from Databricks; Supabase is used only for "Sign in with Google".
No job data is ever written to Supabase.

## 1. Install deps

The old `bun.lock` was removed because it pinned Lovable-only packages that
no longer exist in `package.json`. Regenerate a lockfile with whichever
package manager you use:

```bash
bun install        # or: npm install / pnpm install
```

## 2. Supabase project (Google sign-in)

1. Create a project at https://supabase.com (or use an existing one).
2. **Authentication → Sign In / Providers → Google**: turn it on.
3. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth 2.0 Client ID (Web application) and add this Authorized
   redirect URI (Supabase shows you the exact value on the same provider
   screen):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
4. Paste the Google **Client ID** and **Client Secret** into the Supabase
   Google provider settings and save.
5. **Authentication → URL Configuration**:
   - Site URL: your production URL, e.g. `https://your-app.vercel.app`
   - Redirect URLs: add both
     - `https://your-app.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback` (for local dev)
6. Grab the Project URL and anon/public key from **Project Settings → API**.
   You'll set these twice (see `.env.example`) — once without a prefix for
   server code, once with `VITE_` for the browser bundle. Both use the same
   values; there's no separate secret needed for this basic auth flow.

No database table is created in Supabase for this app — job data stays in
Databricks only, as required.

## 3. Databricks

You need a SQL Warehouse and a token that can query the jobs table:

- `DATABRICKS_HOST` — the workspace hostname only, e.g.
  `dbc-a1b2c3d4-e5f6.cloud.databricks.com` (no `https://`).
- `DATABRICKS_TOKEN` — a personal access token (User Settings → Developer →
  Access tokens) or an OAuth token for a service principal. It needs "Can
  use" on the SQL warehouse and `SELECT` on the jobs table.
- `DATABRICKS_WAREHOUSE_ID` / `DATABRICKS_JOBS_TABLE` — optional; only set
  these if they differ from the defaults already baked into
  `src/lib/jobs.functions.ts`.

The app calls the Databricks SQL Statement Execution API
(`https://$DATABRICKS_HOST/api/2.0/sql/statements`) directly from the
server — there's no proxy in between anymore.

## 4. Environment variables

Copy `.env.example` to `.env` for local dev, and set the same keys in
**Vercel → Project Settings → Environment Variables** for Preview and
Production:

| Variable | Used by |
| --- | --- |
| `SUPABASE_URL` | server (auth) |
| `SUPABASE_ANON_KEY` | server (auth) |
| `VITE_SUPABASE_URL` | browser (auth) |
| `VITE_SUPABASE_ANON_KEY` | browser (auth) |
| `DATABRICKS_HOST` | server (jobs) |
| `DATABRICKS_TOKEN` | server (jobs) |
| `DATABRICKS_WAREHOUSE_ID` | server (jobs, optional) |
| `DATABRICKS_JOBS_TABLE` | server (jobs, optional) |

## 5. Deploy to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In the Vercel dashboard: **Add New → Project**, import the repo.
3. Vercel auto-detects TanStack Start (via Nitro) and sets the build command
   and output directory for you — no extra config needed.
4. Add the environment variables from step 4 above.
5. Deploy. Nitro applies the `vercel` preset automatically during the Vercel
   build.
6. Once you have the real production URL, go back to Supabase's URL
   Configuration (step 2) and make sure the Site URL / Redirect URLs match
   it exactly — Google sign-in will fail with a redirect mismatch otherwise.

## Local development

```bash
bun install
bun run dev
# http://localhost:3000
```

Google sign-in works locally as long as `http://localhost:3000/auth/callback`
is in Supabase's Redirect URLs list (step 2.5) and your `.env` is filled in.
