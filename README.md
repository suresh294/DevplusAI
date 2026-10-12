# DevPulse AI

DevPulse AI is an Engineering Risk Intelligence MVP for recording engineering signals, tracking remediation, and explaining project health with deterministic risk scoring.

## Features

- JWT registration, login, expiration, and protected project ownership.
- Project and signal create, list, detail, update, and delete workflows.
- Verification evidence required before a signal becomes `verified`.
- Deterministic risk and health scores with transparent per-signal breakdowns.
- Risk snapshots recorded on signal changes and exposed through project history.
- Responsive React dashboard with loading, empty, validation, filtering, and API-error states.

## Architecture

The backend is a CommonJS Express application using Mongoose and MongoDB. Authentication uses bcryptjs password hashing and signed JSON Web Tokens. The frontend is a Vite-powered React application that calls the JSON API. The scoring service is pure and independently tested.

## Prerequisites

- Node.js 18 or newer
- A MongoDB deployment, such as MongoDB Atlas
- Separate development and test databases for live API testing

## Configuration and installation

1. Copy `server/.env.example` to `server/.env`.
2. Set `MONGODB_URI` to a database dedicated to this environment.
3. Set `JWT_SECRET` to a random value. Production requires at least 32 characters.
4. Set `CORS_ORIGINS` to a comma-separated list of exact frontend origins in production.
5. Optionally copy `client/.env.example` to `client/.env` and set `VITE_API_BASE_URL` to the API URL. Do not put database credentials or JWT secrets in frontend variables.
6. Install dependencies:

   ```bash
   npm install --prefix server
   npm install --prefix client
   ```

Never commit `.env` files, credentials, tokens, or production connection strings.

## Run locally

Start the API:

```bash
npm start --prefix server
```

Start the frontend in a second terminal:

```bash
npm run dev --prefix client
```

The local frontend is normally available at `http://localhost:5173`, and the API defaults to `http://localhost:5000/api`. The server connects to MongoDB before listening. `GET /api/health` reports `healthy` when MongoDB is connected and `degraded` with HTTP 503 otherwise.

## Tests, build, and audits

```bash
npm test --prefix server
npm run build --prefix client
git diff --check
npm audit --prefix client
npm audit --prefix server
```

The backend suite uses Node's built-in test runner and isolated model mocks; it does not require a live database. The frontend has a production build but no separate frontend test suite. Do not point automated tests at a development or production database.

## Reproducible demonstration

Use a disposable MongoDB database and a test account that contains no real data.

1. Configure the server and client environment files, then start both commands above.
2. Open the frontend and register a new user. Sign out and log in again to verify the authentication flow.
3. Refresh the page while logged in. The dashboard should restore the session; an invalid or expired token should require signing in again.
4. Create a project and confirm its empty state shows full health and zero signals.
5. Add a `failed_test`, `bug`, or `dependency_alert` signal with low, medium, high, or critical severity. The dashboard should display the risk and health values returned by the API.
6. Move the signal through permitted statuses. Attempting to set `verified` without non-empty evidence must fail; valid evidence must succeed.
7. Open risk history after the mutation. A snapshot should be present. Refreshing or listing signals should not create a new snapshot solely because of the read.
8. Register a second disposable user and create a separate project. Requests using the other user's project or signal IDs must return an inaccessible-resource response and must not change data.
9. Log out, then confirm protected project operations are rejected until logging in again.
10. Exercise an empty project, invalid form fields, malformed JSON, an unavailable API, and an expired session to check the visible loading and error states.

This script describes checks to perform; it is not a claim that browser or live MongoDB execution has been completed in this environment.

## API overview

Public endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/health`

Authenticated endpoints require `Authorization: Bearer <token>`:

- `GET /api/projects?page=1&limit=20`
- `POST /api/projects`
- `GET/PATCH/DELETE /api/projects/:id`
- `GET /api/projects/:id/risk-history`
- `GET/POST /api/projects/:projectId/signals`
- `GET/PATCH/DELETE /api/signals/:id`
- `PATCH /api/signals/:id/status`

Responses use `{ success, data }`; project detail and signal-list responses also include `risk`. Errors are sanitized JSON responses.

## Risk formula

Each signal contributes:

`(severity points + type points) × status multiplier`

Severity points: low `5`, medium `12`, high `25`, critical `40`. Type points: failed test `10`, bug `8`, dependency alert `12`. Status multipliers: open `1.0`, in progress `0.7`, fixed unverified `0.5`, verified `0`, reopened `1.2`.

The summed contribution is rounded to the nearest integer and capped at `100`. Health is `100 - risk`. Risk levels are low `0–24`, medium `25–49`, high `50–74`, and critical `75–100`.

## Troubleshooting and limitations

- **Authentication is not configured:** set `JWT_SECRET` on the server and restart it.
- **Database connection failed:** verify the isolated MongoDB URI, network access, and database permissions without printing the URI.
- **CORS failure:** add the exact browser origin to `CORS_ORIGINS`, then restart the API.
- **Frontend cannot reach the API:** set `VITE_API_BASE_URL` and rebuild or restart Vite.
- **Server audit findings:** development tooling may report transitive vulnerabilities through `nodemon`; do not use a breaking `npm audit fix --force` without reviewing the upgrade.

This MVP does not scan live GitHub repositories, apply autonomous fixes, provide team permissions or billing, or call an external AI service. Production deployment still requires HTTPS, secret rotation, rate limiting, monitoring, backups, and a dedicated integration-test database.

## Release checklist

- [ ] Review the final diff and confirm no `.env`, credentials, tokens, private keys, or production URIs are tracked.
- [ ] Configure production `MONGODB_URI`, `JWT_SECRET` (32+ random characters), `PORT`, and exact `CORS_ORIGINS`.
- [ ] Configure the frontend `VITE_API_BASE_URL` for the deployed API.
- [ ] Use HTTPS for frontend-to-API traffic and restrict MongoDB network access.
- [ ] Run backend tests, frontend build, diff check, and dependency audits.
- [ ] Run the demonstration against an isolated test database.
- [ ] Confirm health, startup failure, graceful shutdown, authentication, ownership, status/evidence, and risk-history behavior.
- [ ] Review unresolved audit findings and deployment logs before publishing.
- [ ] Commit, tag, push, and deploy only after repository-owner review.

## Screenshots

Add real screenshots only after running the application. Do not fabricate screenshots or include credentials.
