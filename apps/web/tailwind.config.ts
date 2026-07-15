import type { Config } from "tailwindcss";

/**
 * apps/web/tailwind.config.ts — OBSOLETE as of 55-02 (Tailwind v4
 * migration). apps/web/src/app/globals.css's `@theme`/`@theme inline`
 * blocks + `@source` directives are now the single source of truth for
 * theme and content detection (no `@config` directive loads this file
 * anymore — removed from globals.css in 55-02 Task 1). Kept as a minimal
 * stub for any editor tooling that may still resolve this path; has no
 * external reference (unlike packages/ui/tailwind.config.ts, which
 * components.json still points at until 55-06).
 */
export default {
  content: ["src/**/*.{ts,tsx}"],
} satisfies Config;
