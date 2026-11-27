# Future improvements stash: TaskSight

Last updated 2026-11-27. Nothing here is built unless the owner asks. Bugs are in `docs/issues.md`.

## Not built

| ID | Idea |
|---|---|
| S-01 | Atomic refresh with a separate `RefreshToken` collection and a TTL index |
| S-02 | MongoDB transactions for register and workspace create (needs a replica set in tests) |
| S-03 | Optimistic concurrency: `expectedVersion` on PATCH, 409 on mismatch |
| S-04 | Per-account login throttling |
| S-06 | Request-ID header and correlated logs |
| S-07 | OpenAPI generated from the Zod schemas |
| S-08 | Vitest and Testing Library for the web, plus Playwright end-to-end |
| S-09 | Drag-to-reorder within a column; keyboard drag with ARIA announcements |
| S-10 | Toasts and an error boundary for failed mutations |
| S-12 | Soft delete and undo for tasks |
| S-13 | Husky and lint-staged, PR template, CODEOWNERS |
| S-14 | Dev seed script (before 4.4) |
| S-15 | Pin GitHub Actions to SHAs and add Dependabot |
| S-16 | Label autocomplete and saved filters |
| S-17 | Hybrid keyword and vector retrieval (v1.1 in the PRD) |
| S-18 | A re-index command for model or dimension changes |
| S-19 | A "why this answer" panel with retrieved chunks and scores for Ask Sathi |
| S-20 | `GET /workspaces/:id/members/me` (role only) instead of loading all members |
| S-21 | Per-column limit or a "done" archive view for boards above 300 tasks |
| S-22 | Migration that sets `completedAt` for tasks done before A2 |
| S-23 | Rate-limit key per user for logged-in routes |
| S-24 | Real history charts for the other dashboard cards (needs status history) |
| S-25 | Overdue and due-soon dashboard widgets |
| S-26 | Replace recharts with hand-written SVG if the bundle size matters |

## Done (moved out of the stash)

| ID | Idea | Done in |
|---|---|---|
| S-05 | `completedAt` plus a stats endpoint | A2 |
| S-11 | Remember the last-used workspace | W1 |
