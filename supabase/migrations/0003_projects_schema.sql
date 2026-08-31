-- AgxP — Proiecte ca entitate reala (conform conceptului lui Ana,
-- agxp-functional-ui): un proiect are un Coach si un Consultant asignati,
-- fiecare cu conversatia lui persistenta.
--
-- NOTE (2026-08-31): the old bi-agent-frontend schema already has its own
-- `projects` table (a different shape, used by the legacy chat app). Our
-- tables are prefixed `agxp_` specifically to avoid colliding with it — a
-- first attempt using the bare name `projects` hit `create table if not
-- exists` silently skipping creation because that table already existed,
-- which then broke the RLS/policy statements that followed.

-- ── agents: campuri suplimentare cerute de designul de agent-directory ──────
alter table agents add column if not exists tagline text;          -- ex: "Strategy & AI Transformation"
alter table agents add column if not exists description text;
alter table agents add column if not exists expertise text;        -- ex: "AI Strategy · Transformation · Requirements"
alter table agents add column if not exists knowledge_level text not null default 'New';

-- ── agxp_projects ───────────────────────────────────────────────────────────
create table if not exists agxp_projects (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  description        text,
  type               text not null default 'AI Transformation',
  status             text not null default 'Not Started', -- Not Started | In Progress | Completed | Archived
  coach_agent_id     uuid references agents(id) on delete set null,
  consultant_agent_id uuid references agents(id) on delete set null,
  activity           jsonb not null default '[]'::jsonb,   -- [{t, d}] timeline entries, newest first
  created_at         timestamptz not null default now(),
  last_activity_at   timestamptz not null default now()
);

create index if not exists agxp_projects_owner_id_idx on agxp_projects(owner_id);

-- ── agxp_project_messages ───────────────────────────────────────────────────
-- Persists the two independent Coach/Consultant conversations per project.
create table if not exists agxp_project_messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references agxp_projects(id) on delete cascade,
  column_type agent_type not null, -- 'coach' | 'consultant' — which panel this belongs to
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists agxp_project_messages_project_id_idx on agxp_project_messages(project_id, column_type, created_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Projects (and their messages) are private to the owner — unlike the shared
-- agent/skill/method catalog, this is a user's own work.
alter table agxp_projects enable row level security;
alter table agxp_project_messages enable row level security;

create policy "agxp_projects_owner_select" on agxp_projects for select to authenticated using (owner_id = auth.uid());
create policy "agxp_projects_owner_insert" on agxp_projects for insert to authenticated with check (owner_id = auth.uid());
create policy "agxp_projects_owner_update" on agxp_projects for update to authenticated using (owner_id = auth.uid());
create policy "agxp_projects_owner_delete" on agxp_projects for delete to authenticated using (owner_id = auth.uid());

create policy "agxp_project_messages_owner_select" on agxp_project_messages for select to authenticated
  using (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "agxp_project_messages_owner_insert" on agxp_project_messages for insert to authenticated
  with check (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));
