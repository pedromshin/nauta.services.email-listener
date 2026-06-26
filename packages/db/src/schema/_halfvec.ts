/**
 * halfvec customType for drizzle-orm/pg-core.
 *
 * halfvec saves ~50% space vs vector(1536) for the same accuracy with OpenAI
 * text-embedding-3-* models. Supabase exposes halfvec via pgvector ≥ 0.7.
 *
 * Usage:
 *   embedding: halfvec("embedding", { dimensions: 1536 })
 *
 * Drizzle does NOT have a built-in halfvec type (only `vector`), so this
 * customType is the project-wide precedent for halfvec columns.
 */

import { customType } from "drizzle-orm/pg-core";

interface HalfvecConfig {
  dimensions: number;
}

/**
 * drizzle customType wrapping Postgres halfvec(N).
 *
 * `toDriver`/`fromDriver` pass through as string — the postgres driver
 * transfers halfvec values as "[0.1, 0.2, ...]" string format which
 * pgvector parses natively.
 */
export const halfvec = customType<{
  data: string;
  config: HalfvecConfig;
  driverData: string;
}>({
  dataType(config?: HalfvecConfig) {
    if (!config) {
      throw new Error("halfvec requires a { dimensions } config");
    }
    return `halfvec(${config.dimensions})`;
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: string): string {
    return value;
  },
});
