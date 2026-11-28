# Issues and errors ledger: TaskSight

Last updated 2026-11-27. IDs never change. Severity: H high, M medium, L low. "Closed (unreviewed)" means merged but not yet independently reviewed. Ideas that are not bugs are in `docs/improvements.md` and are not built unless the owner asks.

## Docs and process

| ID | Issue | Sev | Status |
|---|---|---|---|
| D-01 | `memory.md` was stale and recorded branch hashes instead of PR numbers | M | Closed |
| D-02 | Tasks 1.12 and 1.13 were not tracked | M | Closed (1.12 done, 1.13 open in task.md) |
| D-03 | `task.md` and `design.md` were double-encoded | L | Closed |
| D-04 | Two taglines | L | Closed (see design.md section 7) |
| D-05 | Auto-workspace on register missing from the contract | M | Closed |
| D-06 | Projects, Inbox and Calendar in the nav with no Project model | M | Closed (cut) |
| D-07 | "Restricted tasks" and comments mentioned without a model or meaning | M | Open (decide before 3.6; default workspace-level filter, tasks only) |
| D-08 | Root `engines` says node >=20 but `cn` needs 22; `package.json` has `\u003e` escapes | L | Closed (Node >=22) |
| D-09 | Stray `tash list` file and untracked `.vscode` | L | Closed |
| D-10 | Comment in `shared/errors.ts` cites section 4 (contract is section 5) | L | Open |
| D-11 | PRs #18 and #19 merged after self-review only; Phase 2 web work, A2, A3 and the rate-limit fix have no independent review yet | M | Open |
| D-12 | Dashboard needed `completedAt` and counts | M | Closed |
| D-13 | No UI to create a workspace, invite, change roles | M | Closed |
| D-14 | No web test harness; `pnpm test` covers only the API | M | Open |
| D-15 | TaskSathi leftovers in code | L | Closed |
| D-16 | AI subtasks were mislabeled "2.9" | L | Closed |
| D-17 | Commit `6565690` was pushed straight to `main` | M | Open (branch protection, task H2) |
| D-18 | recharts added against the hand-written SVG plan | L | Closed (accepted) |
| D-19 | Docs not updated since #19 | M | Closed |
| D-20 | Task 2.5 incomplete | M | Closed |
| D-21 | PR descriptions disagreed with the code | L | Info: verify claims with git |
| D-22 | `--chart-*` and `--sidebar-*` tokens removed silently | L | Open |
| D-23 | Network errors must not log the user out | M | Closed |
| D-24 | Contract extensions missing from `architecture.md` | M | Closed |
| D-25 | Docs named `gemini-embedding-2`; the live model list shows `gemini-embedding-001` (768 dimensions through `outputDimensionality`, normalize vectors in code) | M | Closed (docs corrected 2026-11-27) |
| D-26 | Price table: kept in `llm/pricing.ts` keyed by model ID (not env), because there are several models and a missing price only affects an estimate | L | Closed (decision) |

## API and security

| ID | Issue | Sev | Status |
|---|---|---|---|
| A-01 | Two simultaneous refreshes returned 500 (version conflict) | H | Closed (A3: retry plus test; owner has not reported whether the test failed before the fix) |
| A-02 | `TRUST_PROXY_HOPS` default 1, docs say 2 behind Vercel and Render | H | Open (verify at first deploy) |
| A-03 | Register is not atomic | M | Closed (H1) |
| A-04 | No indexes on refresh token hashes | M | Closed (A3) |
| A-05 | `refreshTokens` grows without limit | M | Closed (H1; max 10 records) |
| A-06 | JWT secret can be empty in production; `JWT_REFRESH_SECRET` unused | M | Closed (H1) |
| A-07 | `requireAuth` turns database errors into 401 | M | Closed (H1) |
| A-08 | Task `version` not atomic | M | Closed (atomic increment; concurrent PATCH test) |
| A-09 | Assignee need not be a workspace member | M | Closed (unreviewed, #24) |
| A-10 | Bad `userId` in `/members/:userId` returned 500 | M | Closed (unreviewed, #24) |
| A-11 | `Workspace.ownerId` goes stale | L | Open |
| A-12 | Last-owner check can be raced | L | Open |
| A-13 | Task list sorts in memory | L | Open |
| A-14 | Cast errors and oversized JSON return 500 | L | Closed (H1) |
| A-15 | `/health` has no `no-store` | L | Closed (H1) |
| A-16 | `jwtVerify` does not pin HS256; login timing leak; argon prefix dispatch not implemented | L | Open |
| A-17 | `req.valid` typed `unknown`; dead `Task.toJSON`; `getDetail` over-fetches; `console.log` in `connect.ts` | L | Open |
| A-18 | `.env.example` is incomplete | L | Closed (H1) |
| A-19 | Test gaps: expired refresh token, Secure cookie flag | M | Open (other gaps closed by #24, A2, A3) |
| A-20 | `workspaces.test.ts` assertion was weakened | M | Closed (unreviewed, #24) |
| A-21 | `isValidObjectId` accepts any 12-character string | L | Open (the new helper in #24 is strict) |
| A-22 | Tasks stayed assigned to removed members | M | Closed (unreviewed, #24) |
| A-23 | Stats 7-day window moves in 24-hour steps (daylight saving) | L | Open (accepted) |
| A-24 | Tasks done before A2 have no `completedAt` | L | Open (accepted; S-22) |
| A-25 | Global rate limit too low; `RATE_LIMIT_ENABLED=false` did not disable it; successful logins counted | M | Closed (unreviewed, fix/api-rate-limit) |
| A-26 | Stats `tz` relies on MongoDB accepting any zone name Node accepts; web maps Asia/Katmandu to Asia/Kathmandu | L | Open |

## CI and infrastructure

| ID | Issue | Sev | Status |
|---|---|---|---|
| C-01 | CI never builds the web app | M | Closed (H2; web build added to CI) |
| C-02 | MongoDB binary cache never saved | M | Closed |
| C-03 | No API build, `render.yaml` or `vercel.json` | M | Open (1.13, 4.1) |
| C-04 | `cn` package | Info | Closed (official shadcn package) |
| C-05 | Actions pinned to tags; "deliberate type error fails CI" not proven | L | Open (H2) |
| C-06 | Branch protection on `main` not confirmed | M | Open (owner, H2) |

## Web

| ID | Issue | Sev | Status |
|---|---|---|---|
| W-01 | No WakeScreen, preflight, or session reset on refresh failure | H | Closed (unreviewed) |
| W-02 | Some responses are cast, not parsed with shared schemas | M | Open (H3) |
| W-03 | Board showed only the first 20 tasks | H | Closed (up to 300) |
| W-04 | No workspace switcher | M | Closed |
| W-05 | Fake nav items and badge | M | Closed |
| W-06 | No touch drag | M | Closed |
| W-07 | Cards missing details; no filters | M | Closed |
| W-08 | UI not role-aware | M | Closed |
| W-09 | 360 px layout and light theme unverified | M | Closed (walkthrough) |
| W-10 | `cn` imported directly in components and re-exported in `lib/utils.ts` | L | Open |
| W-11 | Web `tsconfig` does not extend the base | L | Open |
| W-12 | `--muted` was a text colour used as a background | M | Closed |
| W-13 | `completedAt` read through a cast | H | Closed |
| W-14 | Dropping on a card sent the card id as status | H | Closed (unreviewed) |
| W-15 | Invited user could not reach the invited workspace | H | Closed |
| W-16 | Some status and priority colours low contrast on light | L | Open (cards fixed) |
| W-17 | Task dialog ignored server errors | M | Closed |
| W-18 | Viewers could start a drag | L | Closed |
| W-19 | Members page could only invite as member | M | Closed |
| W-20 | Dashboard placeholder cards and missing states | M | Closed |
| W-21 | Dead `/chat` link | L | Closed |
| W-22 | "Loading workspace..." forever with no workspace | M | Closed |
| W-23 | Subtask text typed but not added is lost on save | L | Open (H3) |
| W-24 | Editing sends the whole task; two editors overwrite each other | L | Open (S-03) |
| W-25 | If `/auth/me` or `/workspaces` fails for any reason (including 429) the UI looks logged out | M | Open (H3) |
| W-26 | More than 300 tasks are cut with a notice | L | Open (S-21) |
| W-27 | Health check adds one request per page load | Info | Accepted |
| W-28 | Only "Done this week" has a sparkline | L | Open |
| W-29 | Members page cards clipped (`h-full` plus `overflow-hidden`) | M | Closed |

## Phase 3 planning risks

| ID | Issue | Sev | Status |
|---|---|---|---|
| P-01 | Atlas M0 allows 3 search indexes in total; `$vectorSearch` cannot run in mongodb-memory-server | M | Open (3.6) |
| P-02 | Embedding worker must claim `dirty` tasks atomically and compare `version` | M | Open (3.6) |
| P-03 | Free-tier limits are tight and can change | M | Open (3.1) |
| P-04 | SSE through the Vercel rewrite is unproven | M | Open (3.5) |
| P-05 | Cost estimate needs a price table in env | L | Open (3.1) |

## Phase 3 notes (added 2026-11-28)

| ID | Issue | Sev | Status |
|---|---|---|---|
| D-27 | A planned 3.1 branch was never saved, so 3.1 was rebuilt from `main` | L | Closed |
| D-28 | The command bar, the Insight chat and the agent diff view were built (#36 to #41) before their API tasks (3.7, 3.11) existed, so parts rest on mocked data. Check each against the real endpoint when its API task is done | M | Open |
| D-29 | "Insight" is now "Insight" in the app (#40); docs renamed | L | Closed |
| D-30 | `llm/pricing.ts` is empty, so every cost estimate is null | L | Open (copy prices from the official Google price page) |
| A-27 | The web command bar does not send `workspaceId` to `/ai/parse-task`, so `AiLog.workspaceId` is null for those calls | L | Open |
| A-28 | Fallback model limits (5 per minute, 20 per day) are my estimate; only the main text and embedding limits were read from AI Studio | L | Open |
