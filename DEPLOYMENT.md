# Deploying ScreenHabit backend

## What you need

1. A GitHub/GitLab repository containing this folder (no node_modules, .env or secrets).
2. A hosting account that runs Node 24 or Docker. Render is one documented option below.
3. A PostgreSQL database with credentials, backups, and a region chosen for your users and privacy requirements.
4. A hosting budget for an API instance and database. Check current provider pricing; this project does not assume permanent free production hosting.
5. HTTPS. A provider hostname is enough for CUG; a custom domain such as api.your-domain.com is optional.
6. Before mobile integration: updated privacy disclosures covering submitted feedback, host logging, retention and deletion/contact handling. Existing on-device-only claims must be revised where data is transmitted.

No AI key or Play Billing credential is needed for the implemented endpoints.

## Option A: Render Node service + managed PostgreSQL

Official references: [Node deployment](https://render.com/docs/deploy-node-express-app), [deploy lifecycle](https://render.com/docs/deploys), [PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting).

1. Push this backend as its own repository, or select `outputs/screenhabit-backend` as the root directory when deploying the whole workspace.
2. Create a managed PostgreSQL database and a Node web service in the same region. Use the database's internal connection URL when available.
3. Configure the web service:

   | Setting            | Value                                           |
   | ------------------ | ----------------------------------------------- |
   | Build command      | `npm ci --include=dev && npm run build`         |
   | Pre-deploy command | `npm run migrate:prod`                          |
   | Start command      | `npm start`                                     |
   | Health check path  | `/health/ready`                                 |
   | Node               | 24 (also enforced through package.json engines) |

   Render pre-deploy commands require an eligible paid service. If your plan lacks this, run migrations as a controlled one-off job with database network access **before** starting the new version. Do not put migration credentials into a frontend or APK.

4. Set environment variables in the hosting dashboard:

   - `DATABASE_URL`: private database connection URL.
   - `NODE_ENV=production`
   - `HOST=0.0.0.0`
   - `LOG_LEVEL=info`
   - `DATABASE_SSL`: follow your provider's connection requirements. Set `true` for TLS with certificate verification; supply `DATABASE_CA_FILE` if a private CA is required. The application does not disable certificate verification. Provider internal connections may have different TLS requirements from public connections.
   - `TRUST_PROXY_HOPS`: keep `0` unless you have verified your hosting proxy chain. Set `1` only when exactly one trusted proxy fronts the app and direct client access is prevented. A wrong value can break rate limits or allow IP spoofing.
   - `PORT`: use the provider-supplied value; the app defaults to 3000 locally.

5. Deploy. Verify `/health/live`, `/health/ready`, `/v1/config`, and one feedback POST over the issued HTTPS URL. Confirm a row appears in `feedback` using your database console.
6. Only after verification, configure the mobile app's API URL and add an explicit user-triggered feedback submission flow. Local app integration exists. Staging and production require an environment-specific build pointed at a real HTTPS service; the app sends feedback only after an explicit user action and consent.

## Option B: any Docker host

Build the included Dockerfile, configure the same environment variables, run `node dist/migrate.js` as a one-off container with database connectivity, then start the normal container. The runtime uses a non-root user. Put it behind a managed HTTPS load balancer or reverse proxy. Keep the database off the public network. Supply secrets through your hosting platform, not image layers.

## Manage configuration

There are deliberately no public admin write endpoints. Use a restricted database console until an authenticated admin tool is built.

```sql
UPDATE app_config
SET latest_version_code = 17,
    update_message = 'A newer version of ScreenHabit is available.',
    updated_at = now()
WHERE id = 1;
```

`minimum_version_code` is information for a future mobile update flow; the current APK does not consume it. Raising it does not repair an app or silently force an update. Do not set minimum versions above a version customers can actually install.

## Production operations

- Separate staging and production databases and credentials.
- Use a migration role for schema changes and a runtime role limited to `SELECT` on `app_config` and `SELECT, INSERT` on `feedback`; runtime needs no DDL or configuration writes. Apply least-privilege grants through your database administrator/provider.
- Enable automated backups, set retention explicitly, and perform a restore drill. Decide feedback retention and run a scheduled deletion job; no retention scheduler is implemented here.
- Monitor availability, readiness failures, latency, database connections and storage. This app avoids logging request bodies, tokens, IPs and feedback text; hosting access logs may still contain metadata and need their own policy.
- Protect anonymous write endpoints with an edge/WAF rate limit before broad campaigns. In-memory application limits are only a first layer; replica-wide limits need a shared store or gateway.
- Add authentication and ownership checks before accounts, cloud sync, AI quotas, subscriptions or any per-user history endpoint. Keep future AI/provider/service-role secrets server-side.
- For scaling, add stateless API replicas within the DB connection budget. Add a shared rate-limit store when running multiple replicas. Put AI and lengthy reports behind durable background jobs when implemented. Do not upload raw foreground events just to support these endpoints.

## Verification in this workspace

The TypeScript build and API tests can be run without a database server. API tests exercise validation, error redaction, health behavior and throttling. A PGlite test executes the actual initial SQL migration and parameterized feedback persistence. This does not establish networked PostgreSQL connectivity or Docker runtime success. Run the Docker quick start and a migration/restart/feedback smoke test in your deployment environment before connecting customers.
