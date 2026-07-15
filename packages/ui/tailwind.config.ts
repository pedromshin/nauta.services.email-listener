/*
 * OBSOLETE as of 55-02 (Tailwind v4 migration) — this file is not used for
 * any compilation purpose. apps/web/src/app/globals.css's `@theme`/
 * `@theme inline` blocks + `@source "../../../../packages/ui/src"`
 * directive are now the single source of truth (no `@config` bridge exists
 * anymore). Kept as a minimal stub because packages/ui/components.json's
 * `tailwind.config` field still points here — that field is blanked out
 * per the official v4 shadcn convention in 55-06, at which point this file
 * can be deleted outright.
 */
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.tsx"],
} satisfies Config;
