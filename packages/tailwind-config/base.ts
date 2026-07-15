import type { Config } from "tailwindcss";

/**
 * base.ts — OBSOLETE as of 55-02 (Tailwind v4 migration). The v3 JS preset
 * this package used to export (colors/borderRadius/boxShadow, every color
 * `hsl(var(--x))`-wrapped) has been ported natively into
 * apps/web/src/app/globals.css's `@theme inline` block + `:root`/`.dark`
 * oklch token declarations — CSS is now the single source of truth
 * (55-RESEARCH.md Pattern 2). No `@config` directive loads this file
 * anymore (removed from globals.css in 55-02 Task 1). Kept as a minimal
 * stub only so `@polytoken/tailwind-config`'s existing package.json
 * dependents don't hit a missing-module error before a later cleanup phase
 * removes the dependency declarations entirely.
 */
export default {
  content: ["src/**/*.{ts,tsx}"],
} satisfies Config;
