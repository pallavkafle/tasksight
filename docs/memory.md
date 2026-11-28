# Memory: TaskSight (my notes)

## About me and the project

- I'm Pallav Kafle, a Computer Engineering student at Himalaya College of Engineering (TU). I have a background in MERN and generative AI, and I'm aiming for an AI Engineer role.
- TaskSight is my rebuild of an old deployed expense tracker (which stays live as the "before" version) to practice modern full-stack engineering and AI integration.
- Repo: `C:\D_Drive_Backup\PROJECTS\tasksight`, GitHub `pallavkafle/tasksight`. Windows, VS Code, PowerShell. Name: TaskSight (renamed 2026-11-20 from TaskSathi after checking GitHub, npm and domains).
- Time budget: about 10 to 12 hours a week.
- Work is split into Lane A (API, shared, CI) and Lane B (web). When one lane is blocked I cover it (rule.md section 1).

## Current state (2026-11-28)

- Phase 1 and Phase 2 of `task.md` are done, except 1.13 (skeleton deploy, not started). Nothing is deployed.
- Phase 3.2 usage endpoint is merged; full validation passed.
- H1 and A-08 implementation and full validation are complete on `fix/api-hardening`; H2 adds the web build to CI and the local typecheck probe passed. The combined PR is not yet open.
- Phase 2 on `main`: workspaces with 3 roles (#13), task API with filters and cursor pagination (#15), CI with tests and a MongoDB binary cache (#16, #20), app shell (#17), auth rate limits and auto-workspace (#18), Kanban (#19), web fixes (#21), task dialog and members page (#22), dashboard (#23), id validation and assignee membership (#24), then my own PRs: card-drop fix and workspace switcher, members management, task dialog with subtask panel, board filters, auth resilience (wake screen), `completedAt` plus task stats, refresh race fix, dashboard on real stats, members page layout fix, rate-limit fix. Use `git log` for hashes.
- Records: `docs/issues.md` is the issues and errors ledger. `docs/improvements.md` is the ideas stash (nothing there is built unless I ask).
- Not yet independently reviewed: #24, my PRs above, and this docs PR. Commit `6565690` was pushed to `main` by mistake.
- Next: open the combined H1/A-08/H2 PR; complete the CI-failure proof and branch protection, merge, then do the skeleton deployment before continuing Phase 3.
- Manual items I still owe: Gemini API key and model IDs, Render and Vercel connected to GitHub, Atlas MongoDB version and vector index check, branch protection on `main`.

## Key decisions

| Decision | Reason |
|---|---|
| Fresh repo, old tracker untouched | The stack changes in every file |
| Web-first installable PWA | A recruiter can open a link; works across devices |
| Next.js and Express as separate apps | Streaming, long jobs, a future mobile client |
| Same-origin API through Next.js rewrites (`SameSite=Lax` cookie, `Path=/api/auth`) | Third-party cookies fail on Safari and Firefox across Vercel and Render |
| Shared package exports raw TypeScript | Fast cross-package development; `transpilePackages` for web, `tsup` for the API build |
| Express 5 | Async errors reach the handler; `req.query` is read-only, so validation uses `req.valid` |
| Refresh grace window, default 10 s, from env; the server retries a refresh on a version conflict | Two tabs refreshing at once must not log me out |
| Argon2id at 19456 KiB, t=2, p=1, concurrency cap 2; refresh tokens use sha256 | The Render free container has 512 MB RAM and 0.1 CPU |
| No mock API for the web client | Mocks hide cookie, proxy and refresh bugs |
| PWA is installable only in v1 | Service-worker caching of RSC payloads breaks navigation |
| 768-dimension embeddings, one chunk collection, async re-embedding | Atlas M0 limits; saves must not depend on the LLM |
| Embedded subtasks, 3 roles (owner, member, viewer) | Less complexity in v1 |
| Agent: 2 tools, version checks, TTL, idempotency key, role re-check | Stale proposals must not corrupt data |
| Replay evals on every PR, live evals on demand, no LLM judge | Free-tier quota and run-to-run variance |
| Models, IDs and limits from env and the AI Studio console | Providers change them without notice |
| Squash merge for every PR; record PR numbers, not branch hashes | One commit per task on `main`; a squash changes the hash |
| Extend the section 5 contract as endpoints ship (done: `completedAt`, tasks stats, register creates a workspace) | Doc drift between code and contract is worse than a growing contract |
| Aggregate pipeline for task list and stats, `.find()` for task CRUD | `sanitizeFilter: true` breaks `$gte/$lte/$ifNull/$or`; aggregate bypasses it and does not cast ids |
| Cursor-based pagination with base64url JSON | Offset pagination duplicates or skips on write |
| Network errors, 429 and 5xx do not log the user out; only a rejected refresh does (D-23) | A cold or busy API must not end a valid session |
| Nav is Dashboard, Board, Members only | No Project model; Insight appears when built |
| Task dialog is "Path B": dialog plus a separate subtask panel | Subtasks get their own component for the later AI breakdown |
| recharts for the weekly chart, hand-written SVG for sparklines | Chart library accepted after the fact (D-18) |
| Workspace choice kept in `localStorage` (try/catch) | A user with several workspaces keeps their place |
| Board loads pages of 100 up to 300 tasks | The first 100-task cap hid tasks silently |
| `RATE_LIMIT_ENABLED=false` disables every limiter; login limiter counts failures only; defaults 600 global, 300 for `/auth/*` | A normal session hit the old 100-per-15-minutes limit (A-25) |
| Tagline "clarity into what matters"; in-app line "your AI task companion" | Resolves D-04 without code changes |

## Lessons

| Problem | Fix |
|---|---|
| `corepack enable` failed (EPERM) | Use `npm i -g pnpm` |
| `npm.ps1` blocked | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Pasting several commands broke PowerShell | One command, Enter, wait (several `Edit-Text` calls in one paste work) |
| `pnpm add typescript` pulled 7.0.2 | Pin `typescript@~6.0.0` |
| `ERR_PNPM_IGNORED_BUILDS: esbuild` | `allowBuilds` in `pnpm-workspace.yaml` |
| Stray empty file in `apps/api` | Check `git status` and the file list before committing |
| Merged a PR normally instead of squashing and clicked Revert on it | Closed the revert PR, deleted the extra branches; use Squash and merge only |
| Typo in a branch name | `git branch -m` before the first push |
| PowerShell `Set-Content` breaks Next.js and JSON | It adds a BOM. Use `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)` |
| Folder rename failed ("file in use") | VS Code holds locks on the folder. Close it completely before renaming |
| Atlas connection "bad auth" | Autogenerated password had special characters. Reset to an alphanumeric-only password |
| A PowerShell helper named `rp` did nothing | `rp` is an alias of `Remove-ItemProperty`. Use `Edit-Text` and `wf` |
| A file called `tash list` appeared in the repo | The git pager's save key created it. Use `git --no-pager` |
| Docs showed odd characters instead of dashes and garbled Devanagari | They were double-encoded. Fixed 2026-11-27. Read files with `-Encoding UTF8` |
| Commit `6565690` went straight to `main` | Always use a branch and PR; turn on branch protection |
| A PR description did not match the code (PR #22 claimed a dialog that arrived later) | Check every claim with a git command |
| Local login lockout after a few test logins | The global limiter ignored `RATE_LIMIT_ENABLED`. Fixed |
| Members page cards were cut off | `h-full` on the page plus `overflow-hidden` on `Card`. Let the page grow |
| Atlas Vector Search cannot be tested in mongodb-memory-server | Keep it behind a repository interface and use a fake in CI |

## Open items

- Gemini: create the API key (env only) and check model IDs and limits in AI Studio before Phase 3.
- Accounts: connect Render and Vercel to GitHub before the first deploy.
- Verify at the first deploy: SSE through the Vercel rewrite; `req.ip` and `TRUST_PROXY_HOPS` behind Vercel and Render (A-02); whether Gemma handles structured JSON as well as Flash Lite.
- Decide D-07 before task 3.6: what "restricted tasks" and comments mean (default: workspace-level filter, tasks only).
- Everything else is in `docs/issues.md`.
