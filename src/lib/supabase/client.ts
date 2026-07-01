import { createBrowserClient } from "@supabase/ssr";

// Public, browser-safe Supabase client. Only ever uses the anon/publishable
// key — never the service role key. Auth uses Google as the sole OAuth
// provider (configured in the Supabase dashboard under Authentication →
// Providers). This client is NOT used to read job listings — jobs are
// served exclusively from Databricks via server functions, see
// src/lib/jobs.functions.ts.
export function getSupabaseBrowserClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient(url, anonKey);
}
