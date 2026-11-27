# PRD: TaskSight

**Tagline:** TaskSight — clarity into what matters.
**Owner:** Pallav Kafle, Computer Engineering, Himalaya College of Engineering (TU), Nepal

## 1. Overview
TaskSight is an AI-powered task management web app. You type a sentence and get a task, ask questions about your workspace and get cited answers, and approve AI-proposed changes before anything is written.

It replaces my deployed MERN expense tracker (`Expense-Tracker`), which was a tutorial-level project and stays live as the "before". TaskSight is my main portfolio project for AI Engineer roles.

## 2. Goals

| Goal | Success criteria |
|---|---|
| Hiring | A live demo link, a README and a 2-minute video that a recruiter understands in under 2 minutes |
| AI engineering skills | RAG with citations, structured outputs, an approval-gated agent, evals that gate CI, cost and latency telemetry |
| Engineering depth | TypeScript strict, Zod validation everywhere, refresh-token auth, RBAC, tests, CI |
| Finishable | A demoable core by the end of Week 5, with a scope-freeze checkpoint at the end of Week 3 |

## 3. Users
- **Demo user:** a recruiter or hiring manager who opens a link and judges within 2 minutes.
- **Product user:** an individual or small team managing tasks in workspaces.

## 4. v1 scope

| # | Feature | Behavior |
|---|---|---|
| 1 | Natural-language quick-add | A command bar turns "submit report Friday, high priority" into a validated task shown as a confirm chip. One retry on invalid model output. On rate limit or parse failure it opens a pre-filled manual form instead of blocking |
| 2 | Ask Sathi (RAG) | Answers questions from the user's workspace and cites task IDs. Every cited ID is validated. Workspace and role filters apply inside the vector search |
| 3 | Evals and cost dashboard | Two-tier evals (replay on every PR, live runs on demand). Every AI call logs feature, model, tokens, latency, cost and success. The dashboard shows p95 latency and cost per query |
| 4 | Kanban, workspaces, RBAC | Workspaces with 3 roles (owner, member, viewer). Kanban with touch-safe drag and drop, filters, cursor pagination. The last owner cannot demote themselves or leave |
| 5 | AI subtask breakdown | A task becomes a validated list of embedded checklist items (max 30) |
| 6 | Agent with approval | The model proposes actions using 2 tools (generate subtasks, reschedule overdue). The UI shows a diff. Nothing is written until I approve |

## 5. Non-goals
- **v1.1:** offline read and service-worker caching, multi-tab sync (BroadcastChannel), hybrid keyword + vector retrieval, admin role, standalone subtask documents, calendar view, nested projects and an inbox in the navigation.
- **v1.5:** focus sessions, AI "Today plan", habit streaks, weekly AI review, Web Push reminders, voice quick-add.
- **v2:** Expo/React Native client on the same API, real-time collaboration, a small Python service.
- **Out of scope:** Slack and Notion integrations, document storage, billing, fine-tuning, LLM-as-judge evals.

## 6. Platform
Web app, installable as a PWA (manifest only in v1, no offline caching). One codebase, reachable from a link.

## 7. Non-functional requirements
- **Quota resilience:** free-tier LLM limits are tight and can change. A visitor's click must never fail: caching, per-user limits, a seeded demo workspace and cached sample answers.
- **Privacy:** free-tier model requests may be used by the provider to improve its products. Use synthetic demo data only, and say so in the README.
- **Accessibility:** WCAG AA contrast (4.5:1), mobile-first, large touch targets.
- **Cold start:** the API sleeps after 15 minutes idle and takes about a minute to wake. The UI shows a wake screen instead of an error.

## 8. Milestones

| Week | Outcome | Done when |
|---|---|---|
| 1 | Auth, tests, CI, same-origin proxy, skeleton deploy | Live login on Vercel and Render |
| 2 | Workspaces, 3-role RBAC, task CRUD, Kanban, embedded subtasks, nav shell, theme | A teammate can use it without help |
| 3 | LLM layer, command bar, quick-add, usage logging, streaming spike | The quick-add example creates the correct task |
| 4 | Embeddings, vector search, Ask Sathi with citations, subtasks, replay evals | Evals replay in CI and retrieval respects workspace filters |
| 5 | Approval agent, live eval recordings, README, ADR, demo video | I can walk an interviewer through the whole app |

**Status on 2026-11-27:** Week 1 is done except the skeleton deploy (task 1.13). Week 2 is done (workspaces, RBAC, tasks, Kanban, subtasks, shell, theme, dashboard, members page). Weeks 3 to 5 have not started. Before the deploy there is a short hardening step (tasks H1 to H3 in `docs/task.md`).

**Scope freeze:** at the end of Week 3, if the schedule is behind, the agent and the live eval tier become stretch items. A working core (auth, Kanban, quick-add, RAG with citations) ships first.

## 9. Portfolio deliverables
- README with a one-line description, live demo link, screenshots or GIF, architecture diagram, eval results table, p95 latency and cost-per-query numbers, tech decisions, "what I'd do next", and a link to the old expense tracker.
- An ADR section: why 768-dimension embeddings, why same-origin API rewrites, why workspace filtering in MongoDB instead of row-level security.
- A 2-minute video: command bar, a task created, Ask Sathi with citations, the eval table.

## 10. Risks

The live list of issues is `docs/issues.md`. Ideas that are not built are in `docs/improvements.md`.

| Risk | Mitigation |
|---|---|
| Name collision | Check domains, registries and package names before launch; keep the rename cost low by avoiding hard-coded names outside package scope and docs |
| Scope against the 8th-semester workload and TrailMind | Trimmed v1, scope-freeze checkpoint at Week 3, TrailMind at maintenance level |
| Free LLM quota exhausted or cut | Cache, per-user limits, seeded demo, cached fallback, limits and model IDs read from env |
| Model IDs retire | IDs from env, provider-agnostic LLM layer |
| Render cold start | Wake screen and health preflight, no constant pinger |
| Render 512 MB RAM, 0.1 CPU | Argon2 at low memory cost, concurrency cap |
| Atlas M0 storage and index caps | 768-dimension vectors, one chunk collection |
| Python-heavy job postings | README stresses language-agnostic evals and telemetry |
| Secret leakage | `.env` ignored, old leaked Atlas credentials removed |