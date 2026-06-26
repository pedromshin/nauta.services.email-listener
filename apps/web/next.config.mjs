import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /** Pin the monorepo root so Next ignores the stray parent lockfile. */
  outputFileTracingRoot: path.join(__dirname, "../../"),

  /** Hot-reload local workspace packages without a separate build step. */
  transpilePackages: ["@nauta/api-client", "@nauta/db", "@nauta/ui"],

  /** Linting / typechecking run as separate tasks. */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default config;
