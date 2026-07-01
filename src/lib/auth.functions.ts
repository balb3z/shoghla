import { createServerFn } from "@tanstack/react-start";

import { getSupabaseServerClient } from "./supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Reads the current Supabase session (if any) from cookies. Runs on every
 * route load via the root route's beforeLoad. Must never throw — if
 * Supabase is unreachable or misconfigured, the app should still render
 * signed-out rather than take down every page (jobs browsing doesn't
 * require auth).
 */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;

      const meta = data.user.user_metadata ?? {};
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        name: (meta.full_name as string) ?? (meta.name as string) ?? null,
        avatarUrl: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
      };
    } catch (e) {
      console.error("getCurrentUser failed:", e instanceof Error ? e.message : e);
      return null;
    }
  },
);

/** Clears the Supabase session cookies. */
export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.auth.signOut();
    return { success: true };
  } catch (e) {
    console.error("signOut failed:", e instanceof Error ? e.message : e);
    return { success: false };
  }
});
