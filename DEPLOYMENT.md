# ScreenHabit backend deployment

The API is a stateless Node 24 service with a separate PostgreSQL database. Usage events and app names remain on the phone; the API stores only feedback and serves configuration and starter plans. Production resources are isolated from the existing beta service and database.

## Current no-cost validation phase

Use the existing free `screenhabit-beta-api` service and `screenhabit-beta-db`; do not sync the production Blueprint below during this phase. The service can spin down and cause a cold start. Render currently shows the free database expiring on **November 27, 2026**; Render will delete it unless it is upgraded. Export any feedback you need to keep before that date. Treat this setup as temporary validation infrastructure, not durable production storage. The mobile production API URL currently points to this existing beta service.

## Future paid production setup

`render.yaml` defines a Singapore web service and a separate managed PostgreSQL database. It uses paid plans, turns off automatic production deploys, keeps the database off the public network, runs schema migrations before each deploy, and checks `/health/ready`. This is for after Play acceptance and user validation. Review Render's current pricing before syncing the Blueprint; the service and database are billable resources.

1. In Render, choose **New → Blueprint** and connect `https://github.com/bhaskarj61/screenhabit_backend` on the `main` branch. Select `render.yaml` at the repository root.
2. Review the resources and monthly prices shown by Render. Syncing creates a new `screenhabit-api-prod` service and `screenhabit-prod-db`; it does not reuse the beta database.
3. When prompted for `DATABASE_URL`, provide a connection URL for the runtime role using the **internal** host, port, and database shown by the new database. Choose a distinct role name (for example `screenhabit_runtime`) and a long random password. URL-encode special characters in the username/password. It is safe to enter this value in Render; never commit it.
4. Render supplies the owner URL separately as `MIGRATION_DATABASE_URL`. The pre-deploy step applies migrations, then creates/resets the runtime role from the credentials in `DATABASE_URL` and grants only the access the API needs. The start command removes `MIGRATION_DATABASE_URL` before launching Node, so the running API process does not receive the database-owner credential.
5. Wait for the first deploy to finish and confirm the service is **Live**. Keep auto-deploy off for production; review changes and deploy deliberately.

Required production environment is declared in the Blueprint. `TRUST_PROXY_HOPS=1` uses the single Render ingress proxy for client IP rate limiting. The database uses Render's internal connection on the private network, so `DATABASE_SSL=false`; do not substitute the public database URL.

## Verify the service

Run these from a terminal after Render gives the service its HTTPS URL:

```sh
curl -fsS https://YOUR-PROD-HOST/health/live
curl -fsS https://YOUR-PROD-HOST/health/ready
curl -fsS https://YOUR-PROD-HOST/v1/config
curl -fsS https://YOUR-PROD-HOST/v1/plans
```

`/health/ready` must return `{"status":"ready"}`. Confirm logs contain route/status/duration and feedback receipt IDs only; never send real personal information in a smoke-test feedback message. Review database backups, retention, and recovery before inviting a broad audience.

## Before connecting a production app build

- Change the mobile production API and privacy-policy links from `screenhabit-beta-api.onrender.com` to the verified production hostname. The current mobile production configuration still points to the **beta** API.
- Build and install a new production-signed AAB with a version code higher than the currently uploaded Play build. The current source candidate is versionCode 34; migration `004_current_app_version.sql` makes the API's latest-version value at least 34 without lowering operator settings.
- Do not raise `minimum_version_code` until the replacement build is available to every affected user in Play. The current migration intentionally leaves it unchanged.
- Confirm the public privacy policy matches what the app actually transmits and how long submitted feedback is retained. The in-app policy endpoint is `/privacy`.

## Production operations

- Inspect Render web logs and Postgres metrics regularly. Set alerting for failed deploys, readiness failures, database storage, and connection saturation.
- Render provides managed backups for paid PostgreSQL plans. Verify the retention window for the selected plan and practice restoring to a separate database before storing important data.
- The API's rate limits are per process. Keep one web instance for this small service; if you scale to multiple instances, add a shared rate-limit store or edge protection before relying on those limits for abuse control.
- Feedback is anonymous and limited to five submissions per client IP per minute. Current application logs exclude message bodies, raw URLs, and client IPs. Hosting infrastructure may separately retain operational logs.
- Deletion requests for submitted feedback need to be handled by an authorized operator in the database. No authenticated admin or automatic retention job exists yet; define and document a retention period before production feedback collection.
- There are no accounts, cloud sync, raw usage-event uploads, ads, subscription endpoints, or AI calls in this backend. Add authentication and per-user authorization before implementing any user-specific server data.

## Manual deployment fallback

If you are not using the Blueprint, configure the web service with:

| Setting | Value |
| --- | --- |
| Runtime | Node 24 |
| Build command | `npm ci --include=dev && npm run build` |
| Pre-deploy command | `npm run migrate:prod && npm run grant:prod` |
| Start command | `sh -c 'unset MIGRATION_DATABASE_URL; exec npm start'` |
| Health check | `/health/ready` |
| Region | Singapore, same as the production database |

Set `DATABASE_URL` to the runtime-role internal URL and `MIGRATION_DATABASE_URL` to the database-owner internal URL. Never put either credential in the app, APK, Git, or build output.
