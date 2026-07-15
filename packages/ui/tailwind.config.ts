/*
 * This file is not used for any compilation purpose, it is only used
 * for Tailwind Intellisense & Autocompletion in the source files
 */
import type { Config } from "tailwindcss";

import baseConfig from "@polytoken/tailwind-config/web";

export default {
  // Bare "class" (not the ["class"] tuple) — behaviorally identical v3/v4
  // class-based dark-mode strategy, but only the bare string is directly in
  // v4's DarkModeStrategy union without a second selector element.
  darkMode: "class",
  content: ["./src/**/*.tsx"],
  // baseConfig (packages/tailwind-config, still v3-typed — out of this
  // stage's scope, ported natively in Stage 2/3) doesn't structurally match
  // v4's stricter UserConfig shape (see apps/web/tailwind.config.ts's
  // identical comment) — same transient, type-only bridge cast.
  presets: [baseConfig as unknown as Config],
  theme: {
    extend: {
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      colors: {
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
    },
  },
} satisfies Config;
