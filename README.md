# ScreenHabit backend

A separate Node.js 24 + TypeScript + Fastify service backed by PostgreSQL. Tracking stays on the phone. The Android Local variant now connects to this service for configuration and explicitly consented feedback. No staging or production service has been deployed.

Implemented: configuration, optional feedback, database-aware readiness, request validation, bounded payloads, parameterized SQL, per-instance rate limits, graceful shutdown, and transactional versioned migrations. No accounts, AI calls, subscriptions, analytics ingestion, or admin website are implied to exist.

## Quick start without Docker (local only)

```sh
npm ci
npm run local
```

This uses PGlite, an embedded PostgreSQL engine, with persistent local files in `work/local-postgres`. It is a local developer convenience, not the production PostgreSQL server. The normal server and Docker image still use PostgreSQL through `DATABASE_URL`. See the app’s `docs/LOCAL-BACKEND.md` for USB forwarding and environment builds.

## Quick start with Docker

Install Docker Desktop (with Compose). From this folder:

```sh
docker compose up -d db
docker compose build api
docker compose run --rm api node dist/migrate.js
docker compose up -d api
curl http://localhost:3000/health/ready
curl http://localhost:3000/v1/config
```

Compose binds ports to localhost and uses a development-only password. Do not expose this Compose setup as your public production database. `docker compose down` preserves database storage; `docker compose down -v` deletes it.

## Develop without containerizing Node

Install Node 24 and run PostgreSQL 17 (or use Compose for the database).

```sh
cp .env.example .env
npm ci
npm run migrate
npm run dev
```

Scripts load `.env` for local development and migrations only. Production reads environment variables supplied by hosting. Never commit `.env` or credentials.

```sh
npm run typecheck
npm test
npm run build
```

## Logs

The terminal running `npm run local` shows `feedback_received` after a successful database save and `http_request` with route, status code and duration. Feedback text, query strings, authorization headers and client IP addresses are excluded. A request ID connects related lines. Restart the process after code changes: Ctrl+C, then `npm run local`.

## API

| Method | Path            | Behavior                                                            |
| ------ | --------------- | ------------------------------------------------------------------- |
| GET    | `/health/live`  | Process is running                                                  |
| GET    | `/health/ready` | Database and initial schema are accessible; otherwise 503           |
| GET    | `/v1/config`    | Minimum/latest Android version codes, update message, feature flags |
| POST   | `/v1/feedback`  | Validated feedback; returns 201 and generated UUID                  |

```sh
curl -X POST http://localhost:3000/v1/feedback \
  -H 'Content-Type: application/json' \
  -d '{"category":"suggestion","message":"Please add an hourly chart","platform":"android","appVersion":"0.1.16"}'
```

Feedback accepts only `category` (bug/suggestion/general), `message` (1–2000 characters with non-whitespace), `platform` (android), and optional `appVersion` (max 40). Unexpected fields are rejected. Ask users not to include sensitive usage history in messages. There is no contact field and no automatic response to the user.

Public configuration is readable without login. Feedback is deliberately anonymous and public, with five requests/minute per client IP and an 8 KB request limit. Rate limits are in memory per instance, not global bot protection. The server does not trust forwarding headers by default. **Never place a shared secret in an APK and treat it as user authentication.**

## Code map

- `src/app.ts`: HTTP setup, error handling, health routes.
- `src/modules/`: one small file per feature.
- `src/repository.ts`: typed data-access boundary and PostgreSQL queries.
- `src/config.ts`: environment validation and TLS settings.
- `src/migrate.ts`, `migrations/`: ordered, transaction-wrapped migrations with a database lock.
- `src/server.ts`: database pool, startup and shutdown.
- `tests/api.test.ts`: API boundary tests using an injected repository.

The pool has a maximum of ten connections per instance and five-second query/connection timeouts. Plan total connections across replicas. No ORM or microservice infrastructure is needed for these two small modules; a new module can reuse the repository boundary.

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment, production responsibilities and scaling.

## Update policy

Configuration now includes `updateUrl`, backed by the new `002_update_url.sql` migration. Restart the local service to apply it automatically; deployed PostgreSQL needs `npm run migrate:prod` before the new server version. Use `npm run config:local -- soft 21`, `hard 21`, or `none 20` while the local server is stopped. An optional third argument supplies the real update URL. See the app’s docs/UPDATE-POLICY.md for full testing and offline behavior.

## Daily starter-plan catalogue (0.4.0)

GET /v1/plans returns enabled starter plans from the starter_plans table. Restart local to apply migration 003_starter_plans.sql. For managed PostgreSQL, run migrations before rolling out and grant the runtime role SELECT on starter_plans. Saved personal budgets, reflections and timers stay in the mobile database and are not uploaded. Catalogue titles, descriptions, default minutes and suggested activity can be edited through a restricted database console. The app ships offline defaults.
# screenhabit_backend
