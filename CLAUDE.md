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

Required env vars (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (server-only, used by the chat API route), `NEXT_PUBLIC_SENTRY_DSN` (optional, Sentry only initializes when `NODE_ENV === "production"`).

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

### Misc

- `next.config.ts` sets a real CSP + security headers on every route — check it before adding a new external script/style/connect source.
- `.agents/skills/` + `skills-lock.json` are imported third-party design-taste skills (frontend/UI design guidance), not application code.
