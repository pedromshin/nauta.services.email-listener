# @polytoken/web

Next.js 15 (App Router) frontend that lists inbound emails via tRPC.

- **No auth.** tRPC uses a single `publicProcedure`; the context carries only the
  Drizzle `db` handle (`@polytoken/api-client`).
- The page (`src/app/page.tsx`) calls `api.emails.list` and renders the rows.
- Data flows: browser → `/api/trpc` route → `@polytoken/api-client` tRPC router →
  Drizzle (`@polytoken/db`) → Supabase Postgres.

## Which database it reads from

The frontend talks to Postgres through `@polytoken/db`, which reads
`POSTGRES_URL_NON_POOLING` (falls back to `POSTGRES_URL`) from the environment.
Targeting is **controlled by the npm script you run** (local dev) and by **Vercel
environment variables** (cloud), mirroring `examples/acme-os-dev`.

### Local dev — script picks the target

Each script loads a different root `.env.*` file via `dotenv-cli`:

| Command (from repo root)  | Loads             | Target DB           |
| ------------------------- | ----------------- | ------------------- |
| `npm run web:dev`         | `.env.local`      | Local Supabase      |
| `npm run web:dev:staging` | `.env.staging`    | Staging Supabase    |
| `npm run web:dev:prod`    | `.env.production` | Production Supabase |

(Equivalent per-package scripts: `npm run dev` / `dev:staging` / `dev:prod`
inside `apps/web`.)

### Vercel — deployment environment picks the target

`build`/`start` use **ambient env** (no dotenv file), so Vercel's per-environment
variables decide the target. Set these in the Vercel project:

| Vercel environment | `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` point at |
| ------------------ | --------------------------------------------------- |
| Preview            | Staging Supabase (ref `fyfwkjvbcrmjqjysdyqw`)       |
| Production         | Production Supabase (ref `dazyccjijdahxyciptkp`)    |

Use the **session-mode** connection (port 5432, `...NON_POOLING`) — the
transaction pooler (6543) strips the role needed for these queries.

## Vercel setup (one time)

```bash
vercel login
cd apps/web
vercel link                       # link this dir as the project root
# Add DB env vars per environment (session-mode / port 5432 URLs):
vercel env add POSTGRES_URL_NON_POOLING preview
vercel env add POSTGRES_URL_NON_POOLING production
vercel env add POSTGRES_URL preview
vercel env add POSTGRES_URL production
vercel deploy                     # preview
vercel deploy --prod              # production
```

`vercel.json` here sets the build/install commands to run from the monorepo root
so the `@polytoken/*` workspace packages resolve.

## Scripts

| Script        | What it does                             |
| ------------- | ---------------------------------------- |
| `dev`         | Next dev against local DB (`.env.local`) |
| `dev:staging` | Next dev against staging DB              |
| `dev:prod`    | Next dev against production DB           |
| `build`       | `next build` (ambient env — for Vercel)  |
| `build:local` | `next build` with `.env.local` loaded    |
| `typecheck`   | `tsc --noEmit`                           |
