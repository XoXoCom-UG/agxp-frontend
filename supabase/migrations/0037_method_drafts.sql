-- The first draft of each method, kept with the project (2026-11-27).
--
-- Until now the draft lived in the browser's localStorage only: on another
-- computer, or after signing out, the Cockpit showed the methods' bare
-- descriptions. One row per project, owned through the project (the same rule
-- as agxp_project_messages), readable and writable by its owner only.
--
-- The owner may write it, on purpose: the person can correct a draft line in
-- the Cockpit. So a draft is the person's material, never something the agent
-- said — the chat route reads it under the caller's token and frames it as
-- material, not as an order (UNTRUSTED_CONTENT in lib/agent-prompt.ts).
--
-- `drafts` is a JSON array of {label, text}; the app checks labels against the
-- consultant's stations and cuts each text (lib/method-draft.ts), and the size
-- check below keeps one row from growing without end.

create table if not exists agxp_method_drafts (
  project_id  uuid primary key references agxp_projects(id) on delete cascade,
  kind        text not null check (kind ~ '^[a-z-]{1,24}$'),
  drafts      jsonb not null default '[]'::jsonb
              check (jsonb_typeof(drafts) = 'array' and pg_column_size(drafts) < 32000),
  -- Why the app chose this consultant, one sentence from /api/agent/start.
  reason      text check (reason is null or length(reason) <= 400),
  updated_at  timestamptz not null default now()
);
alter table agxp_method_drafts add column if not exists reason text;

alter table agxp_method_drafts enable row level security;

drop policy if exists "agxp_method_drafts_owner_select" on agxp_method_drafts;
create policy "agxp_method_drafts_owner_select" on agxp_method_drafts for select to authenticated
  using (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));

drop policy if exists "agxp_method_drafts_owner_insert" on agxp_method_drafts;
create policy "agxp_method_drafts_owner_insert" on agxp_method_drafts for insert to authenticated
  with check (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));

drop policy if exists "agxp_method_drafts_owner_update" on agxp_method_drafts;
create policy "agxp_method_drafts_owner_update" on agxp_method_drafts for update to authenticated
  using (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));

revoke all on agxp_method_drafts from anon, authenticated;
grant select, insert, update on agxp_method_drafts to authenticated;
