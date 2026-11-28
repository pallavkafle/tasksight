# Design: TaskSight

Implemented in `apps/web`. Updated 2026-11-27 to match what is built.

## 1. Principles

- The command bar is the main input (planned, Phase 3). It will create tasks and answer questions.
- Dark emerald-black glass is the default theme, with a light theme.
- Mobile-first, large touch targets, bottom nav on mobile.
- WCAG AA contrast (4.5:1) for all text, including muted labels.
- AI output is never applied silently: quick-add shows a confirm chip, agent actions show a diff, answers show citations.
- Restraint: one sans font, tabular numbers for counts, one emerald-to-teal accent used sparingly for glow and active states.

## 2. Theme tokens

CSS variables in `apps/web/src/app/globals.css`. Dark is the default (`:root` and `.dark`); `.light` overrides it. Both themes define the same names.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` / `--background` | #07100d | #f6f7f6 | Page background |
| `--card`, `--popover` | #0f1a16 | #ffffff | Cards, dialogs |
| `--text` / `--foreground` | #e8f0ec | #0b1a15 | Body text |
| `--muted-text` / `--muted-foreground` | #94a3a0 | #5a6b66 | Secondary TEXT only |
| `--muted` | white at 6% | #f0f2f1 | Subtle SURFACES (chips, track, column) |
| `--brand` / `--primary` | #10b981 | #059669 | Accent, buttons |
| `--brand-2` | #14b8a6 | #0d9488 | Secondary accent |
| `--danger` / `--destructive` | #ef4444 | #dc2626 | Errors |
| `--border`, `--input`, `--ring`, `--radius` | see file | see file | Borders, inputs, focus, 0.75rem |

Rule: never use a text colour as a background. `--muted` used to hold the text colour and made `bg-muted` fail contrast (W-12). The `--chart-*` and `--sidebar-*` tokens were removed (D-22). Radii 12 to 16px, 1px low-opacity borders, soft shadows. Glass only on floating surfaces.

## 3. Layout

| Area | What is built |
|---|---|
| Desktop sidebar | Brand, workspace switcher, nav (Dashboard, Board, Members), user and logout |
| Mobile | Header with switcher, theme toggle and logout; bottom nav with the same three items |
| Header | Theme toggle (desktop) |
| Not built | Insight (`/chat`) is hidden until built. Projects, Inbox, Calendar and Insights were cut (no Project model) |

## 3b. Screens (built)

1. **Dashboard** (`/`): greeting, four stat cards (Total, In progress, Done, Done this week with a sparkline), weekly progress chart, in-progress cards, add-task tile. Loading, empty and error states.
2. **Board** (`/board`): Kanban columns by status, drag and drop, filters (priority, assignee, label), cards with priority, due date, label chips, subtask bar and assignee initials, "New Task" for owners and members.
3. **Members** (`/members`): create a workspace, invite with a role, change role, remove, leave, last-owner guard.
4. **Login and Register**: react-hook-form with the shared Zod schemas.
5. **Insight**: not built (Phase 3).

## 4. Components

shadcn base-nova on `@base-ui/react`, installed: Button, Card, Input, Label, Textarea, Dialog, Badge. Custom: WorkspaceSwitcher, TaskDialog (create, edit, delete, read-only), SubtaskEditor, TaskCard, KanbanColumn, BoardFilters, DashboardStats, DashboardChart (recharts), Sparkline (SVG), WakeScreen, NoWorkspace, ThemeToggle. Planned: CommandBar, ConfirmChip, DiffView, CitationChip, and shadcn Command and Toast.

## 5. States and behavior

- **Loading:** pulsing blocks (only with `motion-safe`) and short text. `WakeScreen` appears after the first failed health check; after 90 seconds it becomes a "did not respond" screen with a Try again button.
- **Errors:** inline messages. A server `VALIDATION_ERROR` shows next to the field. Network errors do not log the user out.
- **Roles:** until the member list loads the UI is read-only. Viewers cannot drag cards and see "Task details" (fields locked, only Close). Owner-only actions are hidden for other roles.
- **Destructive actions:** two steps (Delete then Confirm delete; Remove then Confirm remove; Leave then Confirm leave).
- **Kanban input:** mouse needs a 5 px move; touch needs a 250 ms hold (`TouchSensor`, tolerance 5). Cards open on click or Enter.
- **Empty states:** one short line and a primary action.
- **Quick-add failure or rate limit (planned):** open a pre-filled manual form. Task creation is never blocked.
- **Quota exhausted (planned):** a short notice and cached sample answers.
- **Motion:** only small transitions; spinners and pulses use `motion-safe`; the chart animation is off.

## 6. PWA

Installable only: web manifest and icons (task 4.5, not built). No offline caching in v1. A later service worker may cache static assets only, with `/api/*` and React Server Component requests kept network-only, because caching them by URL serves broken payloads.

## 7. Branding

Name: TaskSight. Tagline (README, PRD, page metadata): "clarity into what matters". In-app line on the login and register screens: "your AI task companion". The in-app assistant is called Insight.
