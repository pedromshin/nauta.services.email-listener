import type { Config } from "tailwindcss";

import base from "./base";

/**
 * web.ts — OBSOLETE as of 55-02 (Tailwind v4 migration). The v3 JS preset
 * this package used to export (container/keyframes/animation/borderRadius/
 * fontFamily) has been ported natively into apps/web/src/app/globals.css's
 * native `@theme` block + top-level `@keyframes` + `@utility container` —
 * CSS is now the single source of truth (55-RESEARCH.md Pattern 2). No
 * `@config` directive loads this file anymore. Kept as a minimal stub for
 * the same reason as base.ts.
 */
export default {
  content: base.content,
  presets: [base],
} satisfies Config;
