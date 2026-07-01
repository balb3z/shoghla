# AGENTS.md

This project is a standalone TanStack Start application deployed on Vercel.
It is no longer connected to Lovable — there is no synced git history or
Lovable editor to keep in sync with, so normal git workflows (force pushing,
rebasing, squashing) are safe to use.

## Stack

- **Frontend/SSR**: TanStack Start (React 19) + TanStack Router, built with Vite and deployed via Nitro's `vercel` preset.
- **Auth**: Supabase Auth (Google OAuth / "Sign in with Google"). See `src/lib/supabase/`.
- **Jobs data**: Databricks SQL Warehouse is the single source of truth for job listings, queried directly via the Databricks SQL Statement Execution API in `src/lib/jobs.functions.ts`. Job data is **not** mirrored into Supabase.

See `DEPLOYMENT.md` for environment variables and setup steps.
