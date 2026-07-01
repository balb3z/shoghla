import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Plain Vite + TanStack Start config (no Lovable wrapper).
// Nitro auto-detects the Vercel build environment and applies the
// `vercel` deployment preset with zero extra config — see
// https://vercel.com/docs/frameworks/full-stack/tanstack-start
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // Redirect TanStack Start's bundled server entry to src/server.ts
    // (our SSR error wrapper).
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    // React's Vite plugin must come after TanStack Start's Vite plugin.
    viteReact(),
  ],
});
