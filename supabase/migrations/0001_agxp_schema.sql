-- AgxP (Agentix Projects) — Faza 0: fundatia de date
-- Agenti (Consultant / Coach), skill-uri, metode si proiectele anterioare ale unui agent.

create extension if not exists "pgcrypto";

-- ── agent_type ──────────────────────────────────────────────────────────────
do $$ begin
  create type agent_type as enum ('consultant', 'coach');
exception when duplicate_object then null;
end $$;

-- ── agents ──────────────────────────────────────────────────────────────────
create table if not exists agents (
  id                 uuid primary key default gen_random_uuid(),
  type               agent_type not null,
  name               text not null,
  avatar_placeholder text,
  persistent_memory  jsonb not null default '{}'::jsonb,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

comment on table agents is 'AI Consultant / Coach agents a user can pick or create.';
comment on column agents.persistent_memory is 'Free-form JSON memory the agent carries across projects.';

-- ── skills ──────────────────────────────────────────────────────────────────
create table if not exists skills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text
);

-- ── methods ─────────────────────────────────────────────────────────────────
create table if not exists methods (
  id            uuid primary key default gen_random_uuid(),
  skill_id      uuid not null references skills(id) on delete cascade,
  name          text not null,
  is_primary    boolean not null default false,
  output_schema jsonb,
  description   text
);

create index if not exists methods_skill_id_idx on methods(skill_id);

-- ── agent_methods (many-to-many) ───────────────────────────────────────────
create table if not exists agent_methods (
  agent_id  uuid not null references agents(id) on delete cascade,
  method_id uuid not null references methods(id) on delete cascade,
  primary key (agent_id, method_id)
);

create index if not exists agent_methods_method_id_idx on agent_methods(method_id);

-- ── agent_projects ──────────────────────────────────────────────────────────
-- "Last Projects" shown on an agent's card.
create table if not exists agent_projects (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references agents(id) on delete cascade,
  name       text not null,
  summary    text,
  created_at timestamptz not null default now()
);

create index if not exists agent_projects_agent_id_idx on agent_projects(agent_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- This is a shared catalog (agents/skills/methods/projects are visible to every
-- signed-in user for now, mirroring the existing app's model where there is no
-- per-team isolation yet). Writes are not exposed to the client in this phase —
-- only SELECT is granted, so seeding/administration happens via the service role.
alter table agents         enable row level security;
alter table skills         enable row level security;
alter table methods        enable row level security;
alter table agent_methods  enable row level security;
alter table agent_projects enable row level security;

create policy "agents_select_authenticated"         on agents         for select to authenticated using (true);
create policy "skills_select_authenticated"         on skills         for select to authenticated using (true);
create policy "methods_select_authenticated"        on methods        for select to authenticated using (true);
create policy "agent_methods_select_authenticated"  on agent_methods  for select to authenticated using (true);
create policy "agent_projects_select_authenticated" on agent_projects for select to authenticated using (true);
