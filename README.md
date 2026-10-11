"# DevPulse AI

DevPulse AI is an Engineering Risk Intelligence MVP for turning everyday engineering signals into an explainable project health view. Teams can record failed tests, bugs, and dependency alerts, track remediation status, attach verification evidence, and see the deterministic evidence behind project risk.

## Features

- JWT-based registration, login, and protected ownership.
- Project create, list, detail, update, and delete workflows.
- Signal create, list, detail, update, status transition, and delete workflows.
- Verification evidence is required before a signal can become `verified`.
- Deterministic risk and health scoring with per-signal contributions.
- Immutable risk snapshots and a project risk-history endpoint.
- Responsive React dashboard with loading, empty, validation, and API-error states.

## Architecture and stack

The backend is a CommonJS Express application using Mongoose and MongoDB Atlas. Authentication uses bcryptjs password hashing and signed JSON Web Tokens. The frontend is a Vite-powered React application that talks to the JSON API. The pure scoring service is isolated from HTTP and database concerns, which keeps its formula testable and transparent.

## Local setup

Requirements: Node.js 18 or newer and a MongoDB deployment.

1. Copy `server/.env.example` to `server/.env`.
2. Set a real MongoDB connection string and a long random `JWT_SECRET`. Never commit `server/.env`.
3. Install dependencies:

   ```bash
   npm install --prefix server
   npm install --prefix client
   ```

4. Start the API:

   ```bash
   npm start --prefix server
   ```

5. Start the frontend in another terminal:

   ```bash
   npm run dev --prefix client
   ```

The frontend defaults to `http://localhost:5000/api`. Set `VITE_API_BASE_URL` in the frontend environment when the API is hosted elsewhere. Only the API base URL belongs in frontend configuration; database credentials and JWT secrets stay server-side.

## Tests and build

```bash
npm test --prefix server
npm run build --prefix client
```

The automated suite uses Node's built-in `node:test` and does not require a live database. API workflows should be exercised against a separate test database or mocked model boundary; do not use tests to delete existing development data.

## API overview

Public:

- `POST /api/auth/register` — create an account.
- `POST /api/auth/login` — receive a signed bearer token.
- `GET /api/health` — service health check.

Authenticated with `Authorization: Bearer <token>`:

- `GET /api/projects?page=1&limit=20`
- `POST /api/projects`
- `GET/PATCH/DELETE /api/projects/:id`
- `GET /api/projects/:id/risk-history`
- `GET/POST /api/projects/:projectId/signals`
- `GET/PATCH/DELETE /api/signals/:id`
- `PATCH /api/signals/:id/status`

Project and signal responses use `{ success, data }`; project detail and signal-list responses additionally include a `risk` object. Validation, missing resources, authentication failures, and database failures use sanitized JSON errors.

## Risk formula

Each signal contributes:

`(severity points + type points) × status multiplier`

Severity points: low `5`, medium `12`, high `25`, critical `40`. Type points: failed test `10`, bug `8`, dependency alert `12`. Status multipliers: open `1.0`, in progress `0.7`, fixed unverified `0.5`, verified `0`, reopened `1.2`.

The summed contribution is rounded to the nearest integer and capped at 100. Health is `100 - risk`. Levels are low `0–24`, medium `25–49`, high `50–74`, and critical `75–100`. Every response includes signal count, status counts, and a breakdown with title, type, severity, status, base points, multiplier, and contribution.

## Security and current limitations

Passwords are hashed and never returned. Ownership is derived from the verified JWT rather than a client-supplied owner ID, and protected reads, updates, and deletes check the authenticated user. Tokens use the server-only `JWT_SECRET`; error responses do not expose stack traces, database URIs, or credentials.

This is an MVP and does not scan live GitHub repositories, apply autonomous fixes, provide team permissions or billing, or call an external AI service. MongoDB availability and secret configuration are required for live use. Production deployments still need HTTPS, secret rotation, rate limiting, operational logging, and a dedicated test database.

## Screenshots

Add real product screenshots here after running the frontend locally. Do not fabricate screenshots or include credentials in captured images.

## AI-assisted development reflection

CodeZero, powered by GitHub Copilot, was used to inspect the repository, plan changes, implement backend models and routes, create the deterministic scoring service and tests, integrate risk summaries, and build the React dashboard. Generated code was reviewed against the existing CommonJS conventions, validated with the Node test runner and Vite production build, and kept within the requested security boundaries. The implementation deliberately avoids claiming that an AI model scanned or evaluated real repositories; the current risk score is deterministic and evidence-based."
