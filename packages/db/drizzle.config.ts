import type { Config } from "drizzle-kit";

import { env } from "./src/client";

export default {
  schema: "./src/schema",
  schemaFilter: ["public"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use non-pooling URL for migrations (transaction pooler breaks DDL)
    url: env.POSTGRES_URL_NON_POOLING,
  },
  tablesFilter: ["*"],
} satisfies Config;
