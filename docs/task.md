# Tasks: TaskSight

Lane A owns `apps/api`, `packages/shared` and CI. Lane B owns `apps/web`. "Manual" means setup I do myself.

## Phase 1 - Foundations & Auth

Phase 1 is complete except 1.13 (skeleton deploy).

### 1.1 Monorepo scaffold and tooling (Lane A)

**Status:** Done.

pnpm workspace with `apps/api`, `apps/web`, `packages/shared`. Root scripts for lint, typecheck, format and format:check. TypeScript strict with `noUncheckedIndexedAccess`, ESLint flat config, Prettier, `.gitignore` (`.env` ignored, `.env.example` kept), `.gitattributes`, `.editorconfig`, `packageManager` and `engines` in the root `package.json`, `esbuild` under `allowBuilds`, `@types/node` pinned to `~22`, and the six docs in `docs/`.
**Done when:** `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm format:check` pass, and the API imports from `@tasksight/shared` and runs under `tsx`.

### 1.2 Shared contract (Lane A)

**Status:** Done. Extended since: workspace and task schemas, `completedAt`, task stats schemas.

In `packages/shared`: error codes with their HTTP statuses and the error schema (`details` as `Array<{path, message}>`), plus the auth schemas: trimmed lowercase email, password 8 to 128 characters, name 1 to 80, register, login, user (`id`, `name`, `email`), auth response, me response, health response.
**Done when:** valid input parses, a register body with a blank name, bad email and short password returns 3 issues, an unknown error code is rejected, and typecheck passes.

### 1.3 CI (Lane A)

**Status:** Done. Extended: tests and a MongoDB binary cache (#16, #20). Still open: a web build step (C-01) and proof that a deliberate type error fails CI (C-05).

GitHub Actions workflow on pull requests and pushes to `main`: checkout, pnpm setup from `packageManager`, Node 22 with pnpm cache, `pnpm install --frozen-lockfile`, lint, typecheck, format:check.
**Done when:** the workflow is green on a PR, and a throwaway branch with a deliberate type error fails it.

### 1.4 Express skeleton (Lane A)

**Status:** Done. Open: `/health` has no `no-store` header (A-15); cast errors and oversized bodies return 500 (A-14). `RATE_LIMIT_ENABLED=false` now disables every limiter.

Zod-validated env, Pino logger that redacts the authorization header and cookies, `AppError` with a central error handler (JSON 404, JSON error for invalid request bodies, no raw errors), `/health`, helmet, CORS allowlist with credentials, global rate limiter (429 in the error shape, `/health` exempt), JSON body limit 100 KB, `trust proxy`, `app.ts` / `server.ts` split, graceful shutdown on SIGTERM and SIGINT.
**Done when:** `/health` returns 200 with `status`, `uptime`, `version`; an unknown route returns a 404 in the error shape; CORS headers appear only for allowed origins; malformed JSON returns 400 `VALIDATION_ERROR`; an invalid `PORT` exits with a clear message; with the limit set to 3 the fourth request returns 429 and `/health` still returns 200.

### 1.5 Web scaffold (Lane B)

**Status:** Done.

Next.js 16.4.6 in `apps/web` (App Router, TypeScript, Tailwind, `src` directory). Delete `apps/web/.gitkeep` before generating. Add `@tasksight/shared` as `workspace:*` and `transpilePackages: ["@tasksight/shared"]`. Use the generated `apps/web/tsconfig.json` and add `noUncheckedIndexedAccess`. Add `eslint-plugin-react-hooks` and `@next/eslint-plugin-next` to the root ESLint config, scoped to `apps/web/**` (check ESLint 10 and TypeScript 6 support on install; do not downgrade either). Add the web tsconfig to the root `typecheck` script only after the file exists. Initialize shadcn and add the dark and light theme tokens from `design.md`.
**Done when:** the dev server renders a page that imports `APP_NAME` from shared, and `pnpm lint`, `pnpm typecheck` and `pnpm format:check` pass.

### 1.6 Accounts and infrastructure setup (Manual)

**Status:** Partly confirmed. Atlas cluster and `MONGODB_URI` work. Not confirmed: Gemini key and model IDs, Render and Vercel connections, removal of the old leaked credentials. The owner confirms these before Phase 3.

Check the name: open `TaskSight.xyz` and `TaskSight.com`, search the name on LinkedIn and the Nepal company registry, run `npm view TaskSight`, search GitHub. Create the Atlas M0 cluster with a new DB user, allow my current IP, and store the connection string in `apps/api/.env` as `MONGODB_URI`. Delete or rotate the old leaked Atlas credentials. Note the search-index limit, connection limit and MongoDB version shown in the Atlas UI. Create the Gemini API key (env only) and note the model IDs and limits in the AI Studio console. Connect Render and Vercel to GitHub.
**Done when:** the name check result is written in `memory.md`, the cluster is active, `.env` is not tracked by git, the old credentials are gone, and the Render and Vercel projects can see the repo.

### 1.7 User model and database connection (Lane A)

**Status:** Done.

`db/connect.ts` with Mongoose `sanitizeFilter: true`. `User` model with a unique email index and `refreshTokens[]` (`tokenHash`, `familyId`, `expiresAt`, `previousTokenHash`, `previousUsedAt`). A `toJSON` transform that outputs `id`, `name`, `email` only.
**Done when:** the server connects to Atlas, a script creates a user, a duplicate email is rejected, and the serialized user has exactly `id`, `name` and `email`.

### 1.8 Auth API (Lane A)

**Status:** Done. Open hardening: A-02 (proxy hops), A-03, A-05, A-06, A-07. Password verify does not dispatch on the hash prefix (not needed yet).

Routes: register, login, refresh, logout, `me`, and a `requireAuth` middleware. Passwords use `@node-rs/argon2` with explicit parameters (19456 KiB, t=2, p=1) behind a semaphore of 2, and verification dispatches on the hash prefix (list the package in `allowBuilds` if its install script is blocked). Access token via `jose`, 15 minutes. Refresh token: random 256-bit value stored as a sha256 hash with a family id, rotation, `REFRESH_TOKEN_TTL_DAYS`, and the `REFRESH_GRACE_SECONDS` window described in `architecture.md` section 4. Cookie: `refreshToken`, `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/api/auth`. A Zod validation middleware that writes to `req.valid`. A stricter limiter on `/auth/*`. Move the rate limiter before `express.json`, send `Cache-Control: no-store`, and replace the fixed `trust proxy 1` with `TRUST_PROXY_HOPS`.
**Done when:** every route matches the contract in `architecture.md` section 5 in an HTTP client; a refresh inside the grace window succeeds and sets a new cookie; reusing a token after the window revokes the family and returns 401; the cookie flags are correct; passwords never appear in logs or responses.

### 1.9 Auth tests (Lane A)

**Status:** Done. Added: race test for simultaneous refresh (`tests/auth-race.test.ts`) and a login limiter test. Open: expired refresh token, Secure cookie flag.

Vitest, Supertest and mongodb-memory-server, with the Mongo binary cached in CI. Cases: register, duplicate email, validation errors, login, wrong password, refresh, refresh inside the grace window, reuse after the window, logout, `me` without a token, rate limiting (429), cookie attributes.
**Done when:** `pnpm test` passes locally and in CI.

### 1.10 Auth UI (Lane B)

**Status:** Done.

`/login` and `/register` with react-hook-form and the shared Zod schemas. Field errors, loading state, and rendering of the API error shape. No network calls yet.
**Done when:** both forms validate in the browser with no API running and meet the AA contrast requirement.

### 1.11 Web API client and same-origin proxy (Lane B)

**Status:** Done in Phase 2 (W6): health check before the first session check, wake screen with a retry state, clean session reset (clears the Query cache) when refresh is rejected. Decision D-23: network errors, 429 and 5xx do not log the user out.

Add the Next.js rewrite `/api/:path*` to `${API_ORIGIN}/:path*` (`API_ORIGIN=http://localhost:4000` in development). `lib/api.ts` is a typed fetch client using `credentials: "include"` and the error shape. It implements the single-flight refresh from `architecture.md` section 4 (loop guard, queue and replay, health preflight, clear state and redirect on failure). The token stays in memory. Add `WakeScreen`, the auth provider, a protected app layout and a logout that clears the TanStack Query cache.
**Done when:** against the real local API, login, a protected page, logout and a page reload that keeps the session through `/api/auth/refresh` all work, and a deliberately expired access token triggers exactly one refresh.

### 1.12 Auth integration check (Lane A + B)

**Status:** Done 2026-11-27. The server retries a refresh on a version conflict (A3), a test covers two simultaneous refreshes, and the owner tested two tabs reloading together.

Run the whole auth flow in the browser and check the cookie in dev tools (`HttpOnly`, `Lax`, path `/api/auth`). Test two tabs refreshing at once.
**Done when:** the flow works end to end and two simultaneous refreshes do not log either tab out.

### 1.13 Skeleton deploy (Lane A + B)

**Status:** **In progress.** The API bundle and Render/Vercel configs are implemented and the full local validation passes. The live services, production environment variables and auth smoke tests are still pending.

Deploy the API to Render and the web app to Vercel. Build config comes from task 4.1; use a minimal version now if needed. Set `API_ORIGIN`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS` and the auth secrets. Allow `0.0.0.0/0` in Atlas network access with a strong DB password.
**Done when:** register, login, refresh and logout work on the live URLs.

## Phase 2 - Core Product

Phase 2 is complete as of 2026-11-27.

### 2.1 Workspaces and RBAC (Lane A)

**Status:** Done.

`Workspace` and `WorkspaceMember` models. Routes to create and list workspaces, add a member by email, change a role and remove a member. Roles: owner, member, viewer. A `requireRole` middleware used on every workspace route. The last owner cannot demote themselves or leave.
**Done when:** tests prove a viewer cannot write, a member cannot manage members, the last owner cannot leave, and a user cannot read another workspace's data.

### 2.2 Task API (Lane A)

**Status:** Done. Extended: `completedAt`, `GET .../tasks/stats` (A2), assignee must be a workspace member, and a removed member's tasks are unassigned (#24).

Task CRUD with title, description, status, priority, due date, labels, assignee and embedded subtasks (max 30). A `version` counter increments on every update and `embeddingStatus` becomes `dirty` when content changes. Filters (status, priority, assignee, label, due range), sorting and cursor pagination. Indexes `{workspaceId, status}` and `{workspaceId, dueDate}`. Updates whitelist their fields.
**Done when:** tests cover each filter, pagination across several pages, field whitelisting, version increments, the subtask cap, and role checks.

### 2.3 App shell and theme (Lane B)

**Status:** Done. Sidebar and bottom nav (Dashboard, Board, Members), workspace switcher with a remembered choice, theme toggle, theme token fix. Nested projects and an inbox were cut (no Project model).

Sidebar with nested projects and count badges, bottom nav on mobile, light and dark theme toggle from the tokens in `design.md`, workspace switcher, protected layout.
**Done when:** the shell works from 360 px wide to desktop, both themes pass the contrast check, and the toggle persists.

### 2.4 Kanban board (Lane B)

**Status:** Done. Touch drag, optimistic updates with rollback, filters (priority, assignee, label), initials, label chips, subtask bar, loads up to 300 tasks. Above 300 the board is cut with a notice (W-26).

Columns by status, task cards with priority, due date and label chips, assignee initials and a subtask progress bar. dnd-kit drag and drop with `TouchSensor` (`delay: 250`, `tolerance: 5`) and `touch-action` CSS. Filters bound to the API. Optimistic updates that roll back on error.
**Done when:** dragging a card persists its status, touch scrolling still works on a phone, and a failed update restores the card.

### 2.5 Task dialog and subtasks UI (Lane B)

**Status:** Done (Path B: dialog plus a separate subtask panel). Create, edit, delete, read-only view for viewers, inline field errors.

Create and edit dialog with all task fields and a checklist editor for subtasks. Viewers see a read-only version.
**Done when:** every field saves, viewers cannot edit, and validation errors show inline.

### 2.6 Home dashboard (Lane B)

**Status:** Done. Stat cards (one sparkline), weekly chart (recharts), in-progress cards, add-task tile, loading, empty and error states, all from `GET .../tasks/stats`.

Greeting, stats cards with sparklines, weekly progress chart, in-progress cards and an add-task tile, using real API data.
**Done when:** the numbers match the board and the page has loading, empty and error states.

### 2.7 Core product check (Lane A + B)

**Status:** Done 2026-11-27. The owner ran the two-account walkthrough and it passed. Found and fixed during it: the members page layout bug (W-29) and a login lockout from the default rate limits (A-25).

Run the whole product as a new user: register, create a workspace, invite a second user, create and move tasks, check roles.
**Done when:** a second person can use it without help and no role check can be bypassed from the UI or the API.

## Phase 2.5 - Hardening before deploy (added 2026-11-27)

Found during the Phase 2 review. Order: 3.1 to 3.3, then H1 and H2, then the skeleton deploy (1.13), then the rest of Phase 3. A-08 (atomic task `version`) must be done before 3.11.

**A-08 status:** Done and merged; task PATCH increments `version` atomically, with concurrent-update regression coverage.

### H1 Pre-deploy API hardening (Lane A)

**Status:** Done and merged; implementation and full validation passed.

A-03 make register atomic or compensate on failure. A-05 prune and cap `refreshTokens`. A-06 require JWT secrets of 32 or more characters in production and remove the unused `JWT_REFRESH_SECRET`. A-07 `requireAuth` returns 401 only for token errors. A-14 map cast errors to 400 and oversized bodies to 413. A-15 `no-store` on `/health`. A-18 complete `.env.example`. Set Node 22 in `engines`.
**Done when:** each item has a test, `pnpm test` passes, and `.env.example` lists every variable.

### H2 CI and repository settings (Lane A + owner)

**Status:** Web build is in CI. C-05 is proven by PR #48, where an intentional TS2322 failed the CI typecheck. The owner reports C-06 settings enabled; confirm the saved branch rule before closing it.

Add `pnpm --filter @tasksight/web build` to CI. Prove a deliberate type error fails CI (C-05). Turn on branch protection for `main` (PR required, CI required) so a direct push like `6565690` is blocked (C-06).
**Done when:** CI builds the web app, a deliberate type error is red, and the saved rule requires a PR and the CI check before merging.

### H3 Web leftovers (Lane B)

W-25 show a retry screen instead of "logged out" when `/auth/me` or `/workspaces` fails for a reason other than 401. W-02 parse the remaining responses with the shared schemas. W-23 keep or warn about unsaved subtask text.
**Done when:** forcing a 429 or a 500 on `/auth/me` shows a retry screen, and no `as T` cast remains on API responses.

## Phase 3 - AI Features

All Phase 3 tasks are **Not started** unless a status line says otherwise.

### 3.1 LLM module (Lane A)

**Status:** Done (#42). Confirmed 2026-11-27 from the live model list: text `gemini-3.1-flash-lite`, fallback `gemini-3.5-flash-lite`, embeddings `gemini-embedding-001` at 768 dimensions. Free-tier limits: 15 RPM and 500 RPD for text, 100 RPM and 1,000 RPD for embeddings. Atlas runs MongoDB 8.0.39 and a Vector Search index can be created (done in 3.6). Prices live in `llm/pricing.ts` (estimates at paid-tier prices; an unknown model gives no estimate; the table stays empty until I copy the prices from the official Google price page).
`llm/` with a provider interface, token-bucket limiter (limits from env), retry with exponential backoff and jitter, a response cache keyed by prompt hash and model, a per-user quota, a cached-sample fallback and an `AiLog` write on every call. Model IDs come from env (`gemini-3.1-flash-lite`, fallback `gemini-3.5-flash-lite`, `gemini-embedding-001`).
**Done when:** unit tests cover the limiter, retries, cache hits and the fallback, and no code outside `llm/` calls the provider SDK.

### 3.2 Usage endpoint (Lane A)

**Status:** Done.

`GET /ai/usage?days=7` aggregates the authenticated caller's `AiLog` rows for 1 to 30 days. It returns per-feature and total call, failure, cache-hit, sample, token, estimated-cost, and p95 latency metrics, plus daily quota usage.
**Done when:** the endpoint returns correct numbers for seeded log rows, isolates users, and validates the requested day range.

### 3.3 Quick-add API (Lane A)

**Status:** Done (#44). `POST /ai/parse-task` with a server-side date, delimited input, Zod-validated output with one retry, and the saved sample when the model is unavailable. The web command bar calls it (#39, #43) but does not yet send `workspaceId` (A-27).
`POST /ai/parse-task` returns JSON validated by a Zod schema (title, due date, priority, labels) with one retry on invalid output. Task text is wrapped in delimiters in the prompt.
**Done when:** "submit report Friday, high priority" produces the correct task, invalid model output is retried once and then returns a clear error, and an injection attempt in the input does not change the output schema.

### 3.4 Command bar and quick-add UI (Lane B)
Glowing command bar (Ctrl/Cmd+K, pinned at the bottom on mobile) with a confirm chip. On rate limit or parse failure it opens a pre-filled manual form.
**Done when:** quick-add creates a task only after confirmation, and a forced failure still lets me create the task manually.

### 3.5 Streaming spike (Lane A)
Test server-sent events from the API through the Vercel rewrite: no buffering, behavior past 60 seconds idle, reconnect.
**Done when:** the result is recorded in `architecture.md`, either as "streams through the rewrite" or as the direct-stream fallback with the bearer token.

### 3.6 Embedding pipeline (Lane A)

**Status:** Not started. Atlas M0 allows 3 search indexes in total, so create one vector index only (P-01). Claim `dirty` tasks atomically and compare the embedded `version` (P-02). Index tasks only; decide D-07 first.
`RagChunk` collection. A background worker embeds tasks and comments with `RETRIEVAL_DOCUMENT` at 768 dimensions, normalizes vectors, and processes `dirty` tasks. Backoff on 429. Create the vector index with `workspaceId` and `sourceType` filter fields.
**Done when:** editing a task marks it dirty and the worker re-embeds it, task saves never call the model, and a forced 429 delays embedding without failing the save.

### 3.7 Insight API (Lane A)
`POST /ai/ask` embeds the question with `RETRIEVAL_QUERY`, runs `$vectorSearch` with the workspace and role pre-filter, builds the prompt with delimiters, streams the answer and returns cited task IDs. Every cited ID is checked against the database. Vector queries sit behind a repository interface.
**Done when:** answers cite real tasks, a made-up ID is dropped, restricted tasks never appear in the context, and a user cannot retrieve another workspace's tasks.

### 3.8 Insight UI (Lane B)
Streaming conversation view with clickable citation chips that open the cited task.
**Done when:** the answer streams, citations open the right task, and an exhausted quota shows a notice with a cached sample answer.

### 3.9 Subtask breakdown (Lane A + B)
`POST /ai/subtasks` returns a validated list (max 30). The task dialog gets a "break down" button that shows the suggestion as a confirm chip and saves it as embedded subtasks.
**Done when:** a task is split into valid subtasks only after I confirm.

### 3.10 Replay evals (Lane A)
`evals/` with about 50 cases, recorded fixtures and `run.ts`. Metrics: JSON validity, field accuracy, retrieval hit@k, groundedness. Replay runs on every PR with no API calls and fails below per-metric thresholds.
**Done when:** the replay job runs in CI, passes, and fails when a fixture is deliberately broken.

### 3.11 Agent API (Lane A)
`POST /ai/agent/propose` and `/ai/agent/approve` with 2 tools (generate subtasks, reschedule overdue). Proposals store target versions, a TTL, an idempotency key and a snapshot. Approval re-checks the approver's role and each target's version.
**Done when:** a stale or expired proposal is rejected, a second approval with the same key does nothing, an under-privileged approver is rejected, and nothing is written before approval.

### 3.12 Agent approval UI (Lane B)
`DiffView` showing the proposed changes per task, with approve and reject buttons and a clear error when a proposal is stale.
**Done when:** approving applies exactly the shown diff and rejecting changes nothing.

### 3.13 Live evals and provider comparison (Lane A)
`pnpm eval:record` re-records fixtures with real model calls, and the same cases run on Gemini Flash Lite, Gemma and one more hosted provider. Agent runs are graded by the final database state, including that unrelated tasks were untouched.
**Done when:** `evals/results/` holds the latest table with scores, cost and latency per provider.

### 3.14 Cost dashboard (Lane B)
Usage view with calls, tokens, estimated cost and p95 latency per feature.
**Done when:** the numbers match the usage endpoint.

## Phase 4 - Deployment, Polish & Portfolio

Deployment skeleton work has started. Task 4.1 is in progress; live deployment and verification remain pending.

### 4.1 Production API build (Lane A)
**Status:** The API bundle and Render/Vercel manifests are implemented; the full local validation passes. A production-environment startup and live `/health` check remain.

`apps/api/tsup.config.ts` bundles `@tasksight/shared`; scripts are `build: "tsup"` and `start: "node dist/server.js"`. `render.yaml` defines the frozen-lockfile install, API build/start commands and `/health` check. `.env.example` lists the API environment variables.
**Done when:** the production build runs locally with production env values and `/health` responds.

### 4.2 Production deploy and proxy verification (Lane A + B)
**Status:** Pending deployment; API logs include `requestIp` and `xForwardedFor` for proxy-hop verification.

Redeploy both apps with the full feature set. Set all env vars (including the LLM keys and model IDs). Verify `req.ip` and `x-forwarded-for` behind Vercel and Render and set `TRUST_PROXY_HOPS` to match.
**Done when:** two different clients get separate rate-limit buckets, and register, login, refresh, logout and a page reload all work on the live URLs.

### 4.3 Production hardening (Lane A + B)
Add `x-origin-secret` (Vercel adds it, the API rejects requests without it). Confirm `Cache-Control: no-store` and, if rewritten responses are still cached, add `Vercel-CDN-Cache-Control: no-store`. Confirm the wake screen and health preflight on a cold API. Confirm the Atlas cluster is active.
**Done when:** a direct request to the Render URL without the secret is rejected, repeated API calls through Vercel are never served from cache, and a cold start shows the wake screen and then recovers on its own.

### 4.4 Seed data and demo workspace (Lane A)
A script that creates a synthetic workspace with realistic tasks and pre-embedded chunks, and cached sample answers for the quota-exhausted case.
**Done when:** a fresh visitor can use quick-add and Insight, and with the LLM quota deliberately exhausted the demo still returns cached answers.

### 4.5 PWA manifest (Lane B)
Web manifest, icons and theme colors. No service worker caching.
**Done when:** the app is installable on desktop and Android Chrome, and no request is served from a service worker cache.

### 4.6 Accessibility and responsive pass (Lane B)
Check contrast, keyboard navigation, focus rings, touch targets and 360 px layouts for every screen, in both themes. Respect `prefers-reduced-motion`.
**Done when:** a contrast check shows AA for all text, every screen works by keyboard, and nothing scrolls horizontally on a phone.

### 4.7 README and ADR (Lane A + B)
README with the description, live link, screenshots or GIF, architecture diagram, eval results table, p95 latency and cost per query, tech decisions, "what I'd do next", the free-tier data-use note, and a link to the old expense tracker. An ADR section for 768-dimension embeddings, same-origin rewrites, and workspace filtering instead of row-level security. A note on why the evals and telemetry are language-agnostic.
**Done when:** someone who has never seen the project can understand it and run it from the README.

### 4.8 Demo video and final verification (Manual)
Record the 2-minute video: command bar, a task created, Insight with citations, the eval table. Run the final checklist on the live site.
**Done when:** CI is green on `main`, no secrets are in the repo history, the live demo works end to end on desktop and phone, and the video and README links are published.