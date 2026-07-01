import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";

// Server-only Supabase client. Reads/writes the auth session via HTTP
// cookies through TanStack Start's server cookie helpers, so the session
// survives SSR and is available in server functions and route loaders.
//
// This client is only ever used for authentication (session lookup, OAuth
// code exchange, sign-out). It must never be used to query job listings —
// Databricks remains the sole source for jobs data, see
// src/lib/jobs.functions.ts.
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookies) {
        cookies.forEach((cookie) => {
          setCookie(cookie.name, cookie.value, {
            ...cookie.options,
            // Auth cookies must be readable on the redirect back from
            // Google/Supabase and on subsequent same-site navigations.
            sameSite: "lax",
            path: "/",
          });
        });
      },
    },
  });
}
