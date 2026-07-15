import type { Config } from "tailwindcss";

import baseConfig from "@polytoken/tailwind-config/web";

// Tailwind v4's `tailwindcss/defaultTheme` module no longer has a named
// `fontFamily` export (it is now `export default theme`, confirmed against
// node_modules/tailwindcss/lib/public/default-theme.js -> stubs/config.full.js
// at v4.3.2) — inlined here as the literal v3/v4-identical default stacks
// rather than importing, per 55-01-PLAN.md Task 1 step 5's minimal-fix
// guidance. Font arrays only; the rest of the theme is unaffected.
const DEFAULT_SANS_FONT_FAMILY = [
  "ui-sans-serif",
  "system-ui",
  "sans-serif",
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
  '"Noto Color Emoji"',
];
const DEFAULT_MONO_FONT_FAMILY = [
  "ui-monospace",
  "SFMono-Regular",
  "Menlo",
  "Monaco",
  "Consolas",
  '"Liberation Mono"',
  '"Courier New"',
  "monospace",
];

export default {
  // Append the UI + genui package paths so their classes (e.g. the genui
  // page-shell + layout primitives) are included in the build.
  content: [
    ...baseConfig.content,
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/genui/src/**/*.{ts,tsx}",
  ],
  // `baseConfig` (packages/tailwind-config/web.ts -> base.ts) still imports
  // its `Config` type from the ROOT-hoisted tailwindcss@3.4.x (that package
  // is out of this stage's scope — it stays a v3 JS preset until Stage 2/3
  // ports it to native @theme blocks), while THIS file's own `Config` type
  // resolves against apps/web's local tailwindcss@4.3.2. v4's `darkMode`
  // type tightened to `false | 'media' | 'class' | ['class', string] | ...`,
  // which the v3-typed `["class"]` single-element tuple doesn't structurally
  // satisfy — a type-only cross-version artifact of the transient @config
  // bridge, not a runtime behavior change (the @config directive loads the
  // compiled JS value, never these TS types). `unknown` bridges the two
  // otherwise-incompatible `Config` shapes without altering the object.
  presets: [baseConfig as unknown as Config],
  theme: {
    extend: {
      fontFamily: {
        sans: [...DEFAULT_SANS_FONT_FAMILY],
        mono: [...DEFAULT_MONO_FONT_FAMILY],
        code: [
          "var(--font-code)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
} satisfies Config;
