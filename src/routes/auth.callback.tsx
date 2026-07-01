import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { getSupabaseServerClient } from "@/lib/supabase/server";

const exchangeCodeForSession = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => {
    const data = (raw ?? {}) as { code?: string; redirectTo?: string };
    return { code: data.code, redirectTo: data.redirectTo ?? "/" };
  })
  .handler(async ({ data }) => {
    if (!data.code) {
      return { redirectTo: data.redirectTo, error: "Missing OAuth code" };
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(data.code);

    if (error) {
      console.error("Supabase OAuth exchange failed:", error.message);
      return { redirectTo: data.redirectTo, error: error.message };
    }

    return { redirectTo: data.redirectTo, error: null };
  });

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    redirectTo:
      typeof search.redirectTo === "string" ? search.redirectTo : "/",
  }),
  loaderDeps: ({ search }) => ({
    code: search.code,
    redirectTo: search.redirectTo,
  }),
  loader: async ({ deps }) => {
    const result = await exchangeCodeForSession({ data: deps });
    // Redirect regardless of outcome — on error, the destination page
    // simply renders in its signed-out state.
    throw redirect({ href: result.redirectTo, replace: true });
  },
});
