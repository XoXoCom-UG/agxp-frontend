-- Read-only links to a finished document (2026-11-27).
--
-- A share is a random token that points at ONE assistant message — the
-- document exactly as the agent wrote it. It never holds text of its own, so a
-- link on our domain can only ever show what an agent wrote (agents' replies
-- are written by the server alone, 0019), never a page someone typed up.
--
-- The owner creates, lists and stops their own shares under RLS. Nobody reads
-- a share through the API: the public page /share/<token> reads it on the
-- server with the service role, by token, and only while it is not revoked.
--
-- Number 0036 on purpose: 0033/0034 are taken on main, and 0035 is kept for
-- renumbering agxp-redesign's 0033_max_agents.

create table if not exists agxp_doc_shares (
  id          uuid primary key default gen_random_uuid(),
  -- Two random UUIDs without dashes (~244 random bits, hex): unguessable, safe
  -- in a URL, and only core functions (pgcrypto's gen_random_bytes lives in
  -- the extensions schema, which an insert through the API may not see).
  token       text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  uuid not null references agxp_projects(id) on delete cascade,
  message_id  uuid not null references agxp_project_messages(id) on delete cascade,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create index if not exists agxp_doc_shares_message on agxp_doc_shares (message_id) where revoked_at is null;

alter table agxp_doc_shares enable row level security;

drop policy if exists "agxp_doc_shares_owner_select" on agxp_doc_shares;
create policy "agxp_doc_shares_owner_select" on agxp_doc_shares for select to authenticated
  using (owner_id = auth.uid());

-- Only for an agent's reply in a project the caller owns.
drop policy if exists "agxp_doc_shares_owner_insert" on agxp_doc_shares;
create policy "agxp_doc_shares_owner_insert" on agxp_doc_shares for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from agxp_project_messages m
      join agxp_projects p on p.id = m.project_id
      where m.id = message_id and m.project_id = project_id
        and m.role = 'assistant' and p.owner_id = auth.uid()
    )
  );

-- Stopping a share is the only change: revoked_at, by its owner.
drop policy if exists "agxp_doc_shares_owner_update" on agxp_doc_shares;
create policy "agxp_doc_shares_owner_update" on agxp_doc_shares for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on agxp_doc_shares from anon, authenticated;
grant select, insert on agxp_doc_shares to authenticated;
-- Only revoked_at may change: a share can be stopped, never pointed elsewhere.
grant update (revoked_at) on agxp_doc_shares to authenticated;
