# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # next dev, http://localhost:3000
npm run build    # next build
npm run start    # next start (serves the build)
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npm test         # node --experimental-strip-types --test lib/*.test.ts
```

Tests use Node's built-in test runner (`node:test`), not Jest/Vitest — test files are `lib/*.test.ts`, imported directly with a `.ts` extension.

- Run one file: `node --experimental-strip-types --test lib/message-markers.test.ts`
- Filter by test name: add `--test-name-pattern="<substring>"`

Required env vars (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (server-only, used by the chat API route), `SUPABASE_SERVICE_ROLE_KEY` (server-only — plans and usage are written with it precisely because the user must not be able to write them; see Plans and metering below), `NEXT_PUBLIC_SENTRY_DSN` (optional, Sentry only initializes when `NODE_ENV === "production"`).

Without `SUPABASE_SERVICE_ROLE_KEY` the app still runs: every account reads as the free plan and nothing is metered. That is deliberate — a missing key must not lock anyone out — but it also means a silent misconfiguration looks exactly like a working free tier. If `agxp_usage` stays empty after real conversations, the key is missing.

## Big picture

This is **Agentix Projects (AgXP)**: a user pairs with two AI agents on one project — a **Consultant** (produces a "Transformation Concept") and a **Coach** (produces a "Change Plan"). Both agents run in the same screen, side by side, each with its own conversation and its own document.

### Next.js 16 — read before touching routing/middleware

`node_modules` is a Next.js version ahead of this model's training data (see [AGENTS.md](AGENTS.md)). Concretely: **middleware is gone, replaced by `proxy.ts`** ([proxy.ts](proxy.ts)) with an exported `proxy()` function instead of `middleware()`. Don't reintroduce a `middleware.ts` or assume old-Next conventions — check `node_modules/next/dist/docs/` for anything that looks unfamiliar.

### Auth is a two-layer, deliberately loose gate

- [proxy.ts](proxy.ts) does an **optimistic** check: it only looks for the presence of a `sb-*-auth-token` cookie to gate `/dashboard/*` and `/login`. It cannot validate the session (no way to call Supabase from there cheaply).
- [lib/auth-context.tsx](lib/auth-context.tsx) (`AuthProvider`) does the real check client-side via `supabase.auth.getSession()`, and **actively clears the stale auth cookie** when it resolves no session. This exists to break a redirect loop: proxy sees the cookie → lets `/dashboard` through → client finds no real session → redirects to `/login` → proxy still sees the cookie → bounces back. Read the comments in that file before changing either side of this dance.
- Every actual API call is re-validated server-side against the bearer token ([app/api/agent/chat/route.ts](app/api/agent/chat/route.ts) `callerId()`) — the cookie check is UX only, not authorization.
- One shared Supabase browser client ([lib/supabase.ts](lib/supabase.ts)), created lazily and cached at module scope — do not call `createBrowserClient` again elsewhere, a second client's auth listeners won't stay in sync with the rest of the app.

### The chat pipeline: one API route, marker protocol, no chat-message table for memory

- Single route, [app/api/agent/chat/route.ts](app/api/agent/chat/route.ts): verifies the Supabase bearer token, rate-limits per user (in-memory, per-instance — a seatbelt, not a real limiter, since serverless instances don't share memory), then streams a Claude (`claude-sonnet-5`) completion back as plain text (not SSE — the client reads the raw stream and appends chunks).
- The system prompt is assembled from several pieces, each independently editable: role personality (`ROLE_PROMPTS`), a hard one-question-per-turn style rule (`CONVERSATIONAL_STYLE`), the marker-output contract (`CHOICES_INSTRUCTION`), the interview agenda + document spec (`agendaPrompt()` from [lib/deliverables.ts](lib/deliverables.ts)), the learning-marker instruction, and per-user memory/experience text.
- **[lib/deliverables.ts](lib/deliverables.ts) is the single source of truth** for each agent's interview stations and document sections — it's imported by both the API route (to build the prompt) and the UI (to draw the progress rail), specifically so the two can't drift apart. Change the agenda here, not in the prompt string directly.
- The model is instructed to emit inline markers at the end of replies: `[[CHOICES: a|b|c]]`, `[[PROGRESS: NN]]`, `[[TOPIC: n/N Label]]`, `[[DOC: Title]]` (marks the whole reply as the finished deliverable), `[[MEMORY: kind | fact]]` (a lesson to carry into this user's future projects). All parsing lives in [lib/message-markers.ts](lib/message-markers.ts) (`parseMarkers`, `streamingText` for the in-flight render, `looksLikeDocument` as a fallback when the model forgets `[[DOC:]]`). Markers are stored **verbatim** in `agxp_project_messages` and re-parsed on every render — never strip them before saving.
- **Agent memory has no dedicated table.** [lib/agent-memory.ts](lib/agent-memory.ts) reads memory back by scanning this user's own past projects with that agent for `[[MEMORY:]]` markers already embedded in stored assistant messages. This keeps memory scoped to owner-RLS'd rows with no extra migration or policy.
- Custom fenced code blocks (```agxp-kpi```, ```agxp-gap```, ```agxp-flow```, ```agxp-roadmap```, ```agxp-risks```, ```agxp-stakeholders```) are the document's only "graphics" — the model is instructed to never write prose paragraphs in the deliverable, only these blocks plus short bullets. The renderer for each block type lives in `lib/doc-visuals.ts`; adding a new visual means updating the spec text in `deliverables.ts` *and* the renderer, together.

### UI structure: two panels, one screen, lazy project creation

- [components/layout/new-task-screen.tsx](components/layout/new-task-screen.tsx) is the whole workspace: it always renders both a Consultant panel and a Coach panel (side by side on wide screens, tab-switched below ~1000px via `pane-switch`), each independently showing either [components/layout/agent-picker-panel.tsx](components/layout/agent-picker-panel.tsx) (no agent assigned yet) or [components/layout/project-chat-panel.tsx](components/layout/project-chat-panel.tsx) (agent assigned).
- A project is **not created** when a user starts a new task — `agxp_projects` only gets a row on the first real agent pick (`ensureProject()` / `createBlankProject()` in [lib/projects.ts](lib/projects.ts)), named `"New Project"` and silently renamed from the first message actually sent (`renameFromFirstMessage`). Don't add a create-project form in front of this flow — it was deliberately removed.
- Both panels stay mounted at all times so switching tabs never drops in-progress typing or a live stream.
- Same routes serve both a blank task (`/dashboard`) and a resumed one (`/dashboard/project/[id]`) — [app/dashboard/page.tsx](app/dashboard/page.tsx) and [app/dashboard/project/[id]/page.tsx](<app/dashboard/project/[id]/page.tsx>) both just mount `NewTaskScreen`, with or without a `projectId`.

### Data model (Supabase/Postgres)

- Shared, RLS-`select`-only catalog: `agents`, `skills`, `methods`, `agent_methods`, `agent_projects` — visible to every signed-in user, writes are effectively admin/seed-only in phase 0 (see [supabase/migrations/0001_agxp_schema.sql](supabase/migrations/0001_agxp_schema.sql)).
- Owner-scoped, per-user data: `agxp_projects`, `agxp_project_messages` (later migrations) — this is what actually gets written to at runtime, and it's what agent memory is read back from.
- An agent's `knowledge_level` ("New"/"Medium"/"High") is **derived per-viewing-user** from how many of *that user's* projects it's been assigned to ([lib/agent-progress.ts](lib/agent-progress.ts)), not stored on the shared `agents` row — storing it there would leak one user's usage into everyone else's view of the same agent.
- Loose SQL fix/diagnostic scripts live directly under `supabase/` (`fix_create_agent.sql`, `ensure_policies.sql`, `URGENT_fix_rls.sql`, `diagnose_agents.sql`), separate from `supabase/migrations/`. These are meant to be run manually in the Supabase SQL editor when RLS drifts from what the code expects — [lib/db-error.ts](lib/db-error.ts) maps Postgres error codes (e.g. `42501` row-level security) to which script fixes them, so a raw DB error surfacing in the UI should point at one of these files.

### Plans and metering

- **[lib/plans.ts](lib/plans.ts) is the single source of truth** for what Free / Mid / Max allow — imported by the API route that enforces it and the UI that shows it, the same discipline as `deliverables.ts`. Two numbers per plan, only one ever shown: `projects` is what the customer buys; `tokenCeiling` is an invisible backstop that exists because cost grows with the SQUARE of conversation length (the whole history is resent every turn), so one runaway conversation can cost more than a subscription.
- **The plan is not in user metadata, on purpose.** `lib/auth-context.tsx` writes `auth.users.raw_user_meta_data` from the browser, so anything stored there is user-writable — a plan there is a plan they can set to `max` themselves. Plans live in `agxp_entitlements` and usage in `agxp_usage`; the user may `select` both and write neither ([0007_plans_and_usage.sql](supabase/migrations/0007_plans_and_usage.sql)). Every write goes through `SUPABASE_SERVICE_ROLE_KEY` in [lib/entitlement-server.ts](lib/entitlement-server.ts), which starts with `import "server-only"` so it can never reach a client bundle.
- **Enforcement is split, and the split is the design.** The token ceiling runs server-side in the chat route and cannot be bypassed. The project count is checked in the browser (`lib/entitlement.ts`) for a clear message — it is a product rule, not the cost control, and someone who skips it still hits the ceiling. If it ever guards real revenue it wants a database trigger too.
- **Usage is recorded after the stream closes**, from `stream.finalMessage().usage` — real numbers from the API, not an estimate. Deliberately fire-and-forget: the answer is already delivered, so a lost count is cheaper than a thrown error on a finished response.
- **The system prompt is split into a cached block and a volatile one.** Prompt caching is a prefix match and `system` renders before `messages`, so the stable prompt carries the breakpoint and the peer transcript — which grows whenever the other panel answers — sits after it. Moving the peer block into the last user message would cache more, but it would restate another model's output as something the user said, which is what `peerPrompt()` exists to prevent. When there is no peer block the history gets a breakpoint too. Check `cache_read_input_tokens` in `agxp_usage`: if it stays zero, something is invalidating the prefix.

### Attachments

- The paper clip uploads to a private Supabase Storage bucket (`project-files`, [0011](supabase/migrations/0011_project_files.sql)) at `<user id>/<project id>/<uuid>.<ext>`, and **there is no table** — what a message carries is a `[[FILE: path | name | mime]]` marker in its own text, the same trick as agent memory. The owner is the first path segment, so one condition covers select/insert/delete, and there is deliberately no update policy: the bytes behind a sent message must not change afterwards.
- **The server resolves the markers, the client never sends bytes.** [lib/message-files.ts](lib/message-files.ts) downloads each path on every turn using the **caller's bearer token, not the service role** — a marker is text in a client-sent message, so with the service role a forged path would read another customer's document. Under RLS it reads nothing.
- Claude reads PDFs and images natively (`document` / `image` blocks), so no parser dependency was added; text files are inlined. Caps: 10 MB per file (enforced on the bucket, not just the browser) and 24 MB per conversation, because the whole history is resent every turn.
- Deleting a project cascades to messages through a foreign key but **not** to storage — the link is a string inside a message — so `delete_project_files()` in 0011 is what stops orphaned, paid-for objects.

### The team-only panels

Switch plan, Invitations and Agent memory in Settings → Plan are drawn only for the team, and "the team" is **two conditions at once** ([0012](supabase/migrations/0012_team_domain.sql)): the account was granted `can_switch_plan`, **and** its confirmed `auth.users.email` is on `@xoxocom.net`. Neither half alone opens anything — a flag granted by mistake is useless from a private address, and a company address is useless without the grant.

The rule lives in one place, `is_team_member()`, and every privileged function asks it. Clients and the API route ask `am_i_team()`, which takes no argument and reads `auth.uid()` from the verified token, so it cannot be aimed at another account. Hiding a panel is a courtesy; the refusal inside the function is the security.

### When something is misconfigured

- [lib/config-check.ts](lib/config-check.ts) names every missing environment variable at boot (from `register()` in [instrumentation.ts](instrumentation.ts)) and in the team-only Settings panel. It exists for `SUPABASE_SERVICE_ROLE_KEY` above all: without it nothing errors, every account just reads as free and `agxp_usage` stays empty. The dev route reads the team flag with the *caller's* token precisely so it can still report the case where the service role is what's missing.
- [supabase/health_check.sql](supabase/health_check.sql) answers "which migrations are actually applied here" — tables, columns, functions, triggers and RLS — in the SQL editor. A missing migration does not look like an error from the app.
- Sentry runs through [instrumentation.ts](instrumentation.ts) / [instrumentation-client.ts](instrumentation-client.ts), **not** `sentry.client.config.ts`: the SDK only picks that file up via its webpack plugin, and this project builds with Turbopack. `onRequestError` is what catches errors thrown while rendering. No session replay, `sendDefaultPii: false`.

### Legal pages

[lib/company.ts](lib/company.ts) is the only place the company's details are written; all three pages read from it, and while a required field is blank every page says so **in production too** (`MissingDataNotice`). That matters because the warning used to be dev-only while the `[placeholder]` text stayed visible — a live page looked finished and nobody saw a warning. The AGB's plan limits are generated from [lib/plans.ts](lib/plans.ts) so terms cannot promise something the code doesn't enforce; the liability and cancellation clauses are deliberately not drafted.

### Misc

- `next.config.ts` sets a real CSP + security headers on every route — check it before adding a new external script/style/connect source.
- `.agents/skills/` + `skills-lock.json` are imported third-party design-taste skills (frontend/UI design guidance), not application code.
