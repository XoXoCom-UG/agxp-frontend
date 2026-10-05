-- 0013_message_feedback.sql — thumbs up / thumbs down on an agent's answer.
--
-- A table rather than a marker, unlike memory and attachments, for one
-- reason: those are written BY the model into its own reply, and this is
-- written by the reader about someone else's reply. Editing a stored
-- assistant message to record what a human thought of it would corrupt the
-- one record of what the model actually said.
--
-- Deliberately small. One row per person per message, replaced when they
-- change their mind, gone when the message goes.

create table if not exists agxp_message_feedback (
  message_id uuid not null references agxp_project_messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- 1 or -1 rather than a boolean: "no opinion" is the absence of a row,
  -- and a third value later (a report, say) needs no migration.
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists agxp_message_feedback_vote_idx
  on agxp_message_feedback(vote, created_at desc);

alter table agxp_message_feedback enable row level security;

-- Owner-scoped like everything else a user writes. A person can only ever
-- see and change their own vote; nobody reads anyone else's from the app.
drop policy if exists agxp_message_feedback_own_select on agxp_message_feedback;
create policy agxp_message_feedback_own_select on agxp_message_feedback
  for select to authenticated using (user_id = auth.uid());

drop policy if exists agxp_message_feedback_own_insert on agxp_message_feedback;
create policy agxp_message_feedback_own_insert on agxp_message_feedback
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists agxp_message_feedback_own_update on agxp_message_feedback;
create policy agxp_message_feedback_own_update on agxp_message_feedback
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists agxp_message_feedback_own_delete on agxp_message_feedback;
create policy agxp_message_feedback_own_delete on agxp_message_feedback
  for delete to authenticated using (user_id = auth.uid());

comment on table agxp_message_feedback is
  'Thumbs up/down a reader gave an assistant message. Read it to find the '
  'answers people disliked: join to agxp_project_messages on message_id.';
