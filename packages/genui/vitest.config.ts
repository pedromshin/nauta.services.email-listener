import { defineConfig } from "vitest/config";

export default defineConfig({
  // Automatic JSX runtime (react/jsx-runtime) — vendored @polytoken/ui
  // components (number-ticker, marquee, ...) use JSX without importing React
  // (Next.js automatic-runtime convention). Both tsconfigs say "jsx":
  // "preserve", so esbuild would otherwise fall back to the classic
  // React.createElement transform and throw "React is not defined" at render.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom", // catalog entries reference React components (D-20)
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
