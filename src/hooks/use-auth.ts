import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useAuth() {
  const router = useRouter();

  const signInWithGoogle = useCallback(() => {
    const supabase = getSupabaseBrowserClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set(
      "redirectTo",
      window.location.pathname + window.location.search,
    );
    // Full-page redirect to Google; the browser leaves the app here.
    void supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Re-run the root loader (getCurrentUser) so the SSR'd user clears.
    await router.invalidate();
  }, [router]);

  return { signInWithGoogle, signOut };
}
