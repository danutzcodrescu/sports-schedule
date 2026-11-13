# Sports Schedule

A personal sports dashboard for following leagues, saving favourite teams, and browsing upcoming events powered by [TheSportsDB](https://www.thesportsdb.com/).

## Features

- Follow leagues and manage favourite teams tied to your account.
- Filter the schedule by league, team, or favourites, with a `Cmd/Ctrl+K` filter dialog.
- Email/password authentication with Better Auth and Cloudflare Turnstile.
- Cached sports data, a daily event-cache refresh, and API rate limiting.
- Signup controlled through a KV feature flag.
- Optional Sentry error reporting for the browser, API, and scheduled cache refresh.

## Stack

- **Client:** React 19 APIs with the TanStack Redact runtime, TypeScript, Vite, TanStack Router and Query, Tailwind CSS 4, and Base UI.
- **Server:** Hono running on Cloudflare Workers, with the client served as static assets.
- **Storage:** Cloudflare D1 (SQLite) through Drizzle ORM, plus Workers KV for sports caching and feature flags.

The [Redact Vite plugin](https://tanstack.com/redact/latest/docs/vite-plugin) replaces the React runtime in the app and Vitest; application imports stay on `react` and `react-dom`.

## Local development

### 1. Install dependencies and configure Wrangler

Use Node.js **22.18+** (or a current LTS release) and pnpm. The test command uses Node's native TypeScript support.

```sh
pnpm install
cp wrangler.example.jsonc wrangler.jsonc
```

If you already have a `wrangler.jsonc`, keep it and use the example as a reference. The working configuration is gitignored. The example includes all required bindings and placeholder D1/KV IDs; local development uses emulated resources, so real IDs are only needed for deployment.

### 2. Configure local secrets

Create `.dev.vars` in the project root:

```dotenv
BETTER_AUTH_SECRET=replace-with-a-generated-secret
BETTER_AUTH_URL=http://localhost:5173
SPORTSDB_API_KEY=your-thesportsdb-api-key
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Generate an authentication secret with:

```sh
openssl rand -base64 32
```

The Turnstile secret above is Cloudflare's testing key. The client automatically uses the matching test site key during development. Leave `VITE_TURNSTILE_SITE_KEY` unset locally to use that default. Sports requests still call TheSportsDB and require an API key with access to the endpoints used by the app.

### 3. Initialize the database and enable signup

```sh
pnpm db:migrate:local
pnpm exec wrangler kv key put signup-enabled true --binding FEATURE_FLAGS --local
pnpm dev
```

Open the URL printed by Vite, then visit `/signup` to create an account. If Vite uses a different port or hostname, update `BETTER_AUTH_URL` to match. `/api/health` returns `{"status":"ok"}` when the Worker is running.

Local D1 and KV state is stored under `.wrangler/`. Signup is disabled unless the `signup-enabled` value in `FEATURE_FLAGS` is exactly `true`; when disabled, `/signup` redirects to `/signin` and the signup API returns `403`.

Client-side signup navigation checks `/api/signup-status` without caching. Disabled signup, a failed lookup, or an invalid status response redirects to `/signin`; the server independently checks the flag before accepting registration.

## Environment variables

| Variable                  | Purpose                                                | Local configuration                              | Production configuration                                      |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | Signs authentication data                              | `.dev.vars`                                      | `.env.production`                                             |
| `BETTER_AUTH_URL`         | App origin used by Better Auth                         | `.dev.vars`, e.g. `http://localhost:5173`        | `.env.production`, e.g. `https://sports-schedule.example.com` |
| `SPORTSDB_API_KEY`        | Server-side TheSportsDB API key                        | `.dev.vars`                                      | `.env.production`                                             |
| `TURNSTILE_SECRET_KEY`    | Server-side CAPTCHA verification                       | `.dev.vars` with the test key above              | `.env.production` with a real widget secret                   |
| `VITE_TURNSTILE_SITE_KEY` | Public CAPTCHA widget site key, embedded at build time | Optional in `.env.local`; defaults to a test key | Build environment or `.env.production.local`                  |
| `VITE_SENTRY_DSN`         | Public browser Sentry DSN, embedded at build time      | Omit; browser monitoring is disabled in dev      | Build environment or `.env.production.local`                  |
| `SENTRY_DSN`              | Worker Sentry DSN                                      | Omit to disable monitoring                       | `.env.production`                                             |
| `SENTRY_ENVIRONMENT`      | Worker Sentry environment (defaults to `production`)   | Optional in `.dev.vars`                          | Optional in `.env.production`                                 |

`.dev.vars`, `.env.local`, `.env.production`, and `*.local` files are gitignored. Only public values such as the Turnstile site key and browser Sentry DSN should use the `VITE_` prefix, because Vite exposes those variables to the browser.

## Sentry

The configured project is [danut-empire/sports-schedule](https://danut-empire.sentry.io/issues/?project=4512407868014592), owned by the existing `-` team. Its browser DSN and source-map project settings are in the gitignored `.env.production.local`; the Worker DSN is in `.env.production`.

Set `VITE_SENTRY_DSN` for browser errors and `SENTRY_DSN` for Worker errors. You can use the same Sentry project for both, or separate projects. Browser monitoring runs only in production builds; Worker monitoring is disabled when its DSN is absent. React root errors, TanStack Router errors, Hono request errors, and failed scheduled jobs are reported without changing error responses or job failures.

Tracing, replay, logs, and metrics are not enabled. Automatic collection of user identity, cookies, HTTP headers/bodies, URL query parameters, and database query data (Worker) is disabled. Error messages and stack traces are still sent, so avoid including secrets in thrown errors.

For readable production stack traces, set these **build-only** variables in CI or `.env.production.local`:

```dotenv
SENTRY_AUTH_TOKEN=your-source-map-upload-token
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-project-slug
```

When all three are set, `pnpm build` generates hidden source maps and uploads each client and Worker build to that project. Client maps are deleted after upload so they are not deployed as public assets. Without upload credentials, builds still work and client source maps are not emitted. If using separate browser and Worker projects, upload the Worker maps separately to its project.

Never prefix `SENTRY_AUTH_TOKEN` with `VITE_` or put it in `.env.production`, which the deployment command uploads as Worker secrets. The Worker SDK requires `nodejs_compat`; keep that flag in your `wrangler.jsonc` as shown in the example.

## Deploy to Cloudflare

### 1. Create the resources

Log in to your Cloudflare account, then create a D1 database and two KV namespaces:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create sports-schedule-db
pnpm exec wrangler kv namespace create SPORTS_CACHE
pnpm exec wrangler kv namespace create FEATURE_FLAGS
```

Update `wrangler.jsonc` with the returned database and namespace IDs. If you choose a different database name, update `database_name` too. Keep the binding names: the Worker references them directly.

| Binding          | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `DB`             | Users, sessions, followed leagues, and favourite teams                         |
| `SPORTS_CACHE`   | Cached responses from TheSportsDB                                              |
| `FEATURE_FLAGS`  | Runtime flags, including `signup-enabled`                                      |
| `ASSETS`         | Built client assets, configured by the Cloudflare Vite plugin                  |
| `*_RATE_LIMITER` | Six rate-limit bindings for API, authentication, sports, and mutation requests |

Choose an available Worker `name` and distinct rate-limit `namespace_id` values within your account. The template runs the event-cache refresh every day at **00:00 UTC** for leagues referenced by followed leagues or favourite teams.

Event retrieval retries HTTP 429, 502, 503, and 504 responses up to three times after the initial request, with exponential backoff and jitter (0.5–1, 1–2, then 2–4 seconds). `Retry-After` is respected up to 30 seconds; longer waits fail without retrying early. Failed refreshes preserve existing cache entries until their original expiry. The daily job continues with other leagues and reports any remaining failures to Sentry; persistent failures are retried on the next scheduled run.

### 2. Configure production authentication

Create a [Turnstile widget](https://developers.cloudflare.com/turnstile/get-started/) for your deployment hostname. Create `.env.production` with the Worker secrets used by the deploy script:

```dotenv
BETTER_AUTH_SECRET=replace-with-a-production-secret
BETTER_AUTH_URL=https://your-worker.your-subdomain.workers.dev
SPORTSDB_API_KEY=your-thesportsdb-api-key
TURNSTILE_SECRET_KEY=your-production-turnstile-secret-key
```

Set `BETTER_AUTH_URL` to the actual origin users will visit. Set the matching public site key in `.env.production.local` (or in your build environment):

```dotenv
VITE_TURNSTILE_SITE_KEY=your-production-turnstile-site-key
```

The site key must be present when building the client. Changing it requires a rebuild and redeploy.

### 3. Apply migrations and deploy

```sh
pnpm db:migrate:remote
pnpm run deploy
```

`pnpm run deploy` builds the client and Worker using Vite, then runs `wrangler deploy --secrets-file .env.production` to upload the Worker and its secrets. Use `pnpm run deploy` explicitly because `pnpm deploy` is also a built-in pnpm command.

Enable production signup when you want users to register:

```sh
pnpm exec wrangler kv key put signup-enabled true --binding FEATURE_FLAGS --remote
```

To disable signup again, write `false` to the same key. Local and remote flags are separate.

## Development commands

| Command                             | Description                                                          |
| ----------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev`                          | Run Vite with the local Cloudflare Workers runtime                   |
| `pnpm build`                        | Build the client and Worker                                          |
| `pnpm preview`                      | Preview the production build locally                                 |
| `pnpm run deploy`                   | Build and deploy with `.env.production` secrets                      |
| `pnpm test`                         | Run data, schedule interaction, authentication, and Worker tests     |
| `pnpm test:node` / `pnpm test:app`  | Run native Node tests or Vitest interaction/integration tests        |
| `pnpm lint` / `pnpm lint:fix`       | Check or fix lint issues with Oxlint                                 |
| `pnpm format:check` / `pnpm format` | Check or apply formatting with Oxfmt                                 |
| `pnpm cf-typegen`                   | Regenerate `CloudflareBindings` after Wrangler configuration changes |
| `pnpm generate-routes`              | Regenerate the TanStack route tree                                   |
| `pnpm db:generate`                  | Generate SQL migrations from the Drizzle schemas                     |
| `pnpm db:migrate:local`             | Apply migrations to local D1                                         |
| `pnpm db:migrate:remote`            | Apply migrations to remote D1                                        |
| `pnpm auth:generate`                | Regenerate the Better Auth Drizzle schema                            |

After changing database schemas, generate a migration, inspect the SQL, and apply it locally before deploying it remotely.

## Project layout

```text
src/client/           React application, routes, components, and API client
src/worker/           Hono Worker entry point and rate limiting
src/worker/auth/      Better Auth configuration and auth middleware
src/worker/db/        Drizzle database setup and schemas
src/worker/routes/    Sports, followed-league, and favourite-team endpoints
src/worker/services/  TheSportsDB integration and caching
src/worker/jobs/      Scheduled event-cache refresh
migrations/          D1 SQL migrations and Drizzle metadata
public/              Static client assets
wrangler.example.jsonc  Copyable Cloudflare Workers configuration
```

See [the client design system](src/client/DESIGN_SYSTEM.md) for UI conventions.
