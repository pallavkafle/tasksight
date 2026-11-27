# Rules: TaskSight

All working rules live in this file.

## 1. Lanes
- **Lane A** owns `apps/api`, `packages/shared` and `.github`.
- **Lane B** owns `apps/web`.
- Lanes never edit each other's files. Root files (`package.json`, `tsconfig.base.json`, `eslint.config.mjs`, `pnpm-workspace.yaml`) change only in a PR that says so.
- The API contract in `architecture.md` section 5 is frozen. A change needs a deliberate decision, recorded in `memory.md`.
- Work in order, one task at a time. Run both lanes at once only when one is blocked on something external (Atlas, Vercel, Render, an API key).
- The web client is built against the real API. No mock adapters or stub routes.
- Each PR is reviewed by the other lane before merge. Auth, refresh-token rotation, RBAC and the web refresh client get a strict security review.
- Exception (recorded 2026-11-27): while a lane was out of quota, Claude worked in both lanes (PR #19 and the Phase 2 web, stats and refresh-race work). The owner reviewed and merged those PRs; an independent review is still listed as D-11 in `docs/issues.md`.

## 2. Git workflow
- One branch per task: `feat/api-*`, `feat/web-*`, `chore/*`, `docs/*`. PR into `main`, Squash and merge, delete the branch.
- Do not use GitHub's Revert button on a merged PR unless the change really must be undone.
- Never push to `main` directly (commit `6565690` did). Turn on branch protection so it is blocked.
- Conventional commits: `feat(api): ...`, `fix(web): ...`, `chore: ...`, `docs: ...`.
- Never commit `.env`, secrets, `node_modules`, `dist`, `.next` or scratch files.
- Run `git status` before every `git add .`. To list every file with its size:
```powershell
Get-ChildItem -Recurse -File -Force | Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch 'node_modules' } | ForEach-Object { "{0,6}  {1}" -f $_.Length, $_.FullName.Replace("$PWD\","") }
```
- Before pushing: `git fetch`, `git rebase origin/main`, and re-run `pnpm install` if any `package.json` changed.
- Lockfile conflicts: `git checkout origin/main -- pnpm-lock.yaml`, then `pnpm install`. Never hand-edit the lockfile.
- PR diff for review: `git diff main...HEAD -- . ":(exclude)pnpm-lock.yaml"`.
- Line endings are LF: `.gitattributes` (`* text=auto eol=lf`) and `.editorconfig`.

## 3. Environment (Windows, PowerShell)
- PowerShell syntax only.
- One command at a time. Press Enter and wait before the next. Pasting several lines breaks PowerShell.
- Use `curl.exe`, not `curl` (an alias for another command).
- No corepack (it fails without admin rights). Install pnpm with `npm i -g pnpm`.
- If scripts are blocked: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- `$env:NAME="value"` sets a variable for the current terminal; `Remove-Item Env:NAME` clears it.
- Packages with native install scripts must be listed under `allowBuilds` in `pnpm-workspace.yaml` (`onlyBuiltDependencies` is no longer honored).
- Do not name a PowerShell helper `rp`: it is an alias of `Remove-ItemProperty` and runs instead of your function. Use `Edit-Text` and `wf`.
- Windows PowerShell 5 shows UTF-8 files garbled unless you add `-Encoding UTF8`. Write files with `[System.IO.File]::WriteAllText` and `UTF8Encoding($false)`.
- Use `git --no-pager` so the pager cannot create stray files (it once created `tash list`).
- AI assistants never run commands themselves. They give exact commands and the owner pastes the output.

## 4. Versions (do not upgrade without a reason)
Node 22.16.0 (the `cn` package needs Node 22 or newer, so set Node 22 on Vercel and Render), pnpm 12.18.0, TypeScript ~6.0.3 (use `~`; typescript-eslint 8.x does not support TypeScript 7), ESLint 10.14.0, typescript-eslint 8.72.2, Prettier 3.10.1, Zod 4.6.7, tsx 4.23.15, `@types/node` ~22, Express 5 with `@types/express@5`, Next.js 16.4.6. Check the resolved versions after every `pnpm add`.

## 5. Code standards
- TypeScript strict with `noUncheckedIndexedAccess`. No `any`. Unused variables are prefixed `_`.
- `moduleResolution: "Bundler"`. Prettier: semicolons, double quotes, trailing commas, print width 100.
- One ESLint config at the root. `eslint-plugin-react-hooks` and `@next/eslint-plugin-next` are scoped to `apps/web/**`.
- Feature-based modules, small single-purpose files, short comments only where intent is not obvious.
- Validate every body, query and params with Zod. Never assign to `req.query` (Express 5); use `req.valid`.
- Mongoose: strict schemas and `sanitizeFilter: true`. Do not use `express-mongo-sanitize`.
- `packages/shared` stays isomorphic: no Node built-ins, Mongoose or server-only code.
- Zod 4 deprecates `z.string().email()`; switch to `z.email()` only if lint flags it.

## 6. Security
- Secrets live only in env files. `.env` is gitignored; `.env.example` holds placeholders. No keys or connection strings in chat, issues or commits.
- Use a new Atlas DB user for TaskSight. Delete or rotate the old leaked credentials.
- Never return raw errors or stack traces. Use the API error shape.
- helmet, a CORS origin allowlist, rate limits (strictest on `/auth/*` and `/ai/*`), `Cache-Control: no-store` on API responses, and an exact `TRUST_PROXY_HOPS`.
- Access token in memory only. Refresh token: httpOnly cookie, stored hashed, rotated, with reuse detection.
- Never rely on library defaults for password hashing parameters; set them explicitly.
- RBAC check on every workspace route. Scope every query by workspace and user, including `$vectorSearch` filters. Whitelist updatable fields (no mass assignment). The last owner cannot leave or demote themselves.

## 7. LLM feature rules
- Model IDs, embedding dimensions and rate limits come from env, never from code.
- All model calls go through the `llm/` module. Every call writes an `AiLog` row.
- Saving a task never calls the model. Re-embedding runs in the background.
- Task and comment text is untrusted. Retrieved text never triggers actions. Writes need explicit approval.
- Validate every model output with Zod and every cited task ID against the database.
- Use synthetic demo data only.

## 8. Testing
- Test failure paths as well as success: wrong password, token reuse, missing token, validation errors, rate limiting, role checks.
- Vector queries stay behind a repository interface (see `architecture.md` section 11).
- Prove the checks can fail: a deliberate type error must fail CI.

## 9. Definition of done
1. The "Done when" criteria in `task.md` are met.
2. `pnpm lint`, `pnpm typecheck`, `pnpm format:check` and `pnpm test` pass locally and in CI.
3. The other lane has reviewed the PR.
4. `memory.md` is updated.
5. No stray files or secrets in the commit.
6. For web changes, `pnpm --filter @tasksight/web build` also passes.
7. `docs/issues.md` and `docs/improvements.md` are updated when the work changes them.