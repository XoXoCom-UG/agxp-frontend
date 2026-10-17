-- AgxP — raspunsurile agentului le scrie doar serverul (2026-10-17)
--
-- RUN THIS ONLY AFTER the code that saves replies on the server is deployed.
-- Before that, the live app still writes the agent's replies from the
-- browser, and this policy would refuse every one of them.
--
-- Why: the chat route now reads the conversation from this table instead of
-- trusting the browser (lib/conversation-server.ts). That only helps if the
-- table itself cannot be filled with fake agent replies — and until now any
-- signed-in user could insert role = 'assistant' rows into their own project
-- straight through the REST API, then have the model continue "its own"
-- invented conversation. The server now writes replies with the service
-- role, so the browser is limited to what a person actually types.

drop policy if exists "agxp_project_messages_owner_insert" on agxp_project_messages;
create policy "agxp_project_messages_owner_insert" on agxp_project_messages for insert to authenticated
  with check (
    role = 'user'
    and exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- The same cap the route applies (lib/chat-input.ts MAX_USER_CHARS), in the
-- table, so a message inserted around the app cannot be larger than one sent
-- through it. NOT VALID: rows that already exist are not checked, new ones are.
alter table agxp_project_messages drop constraint if exists agxp_project_messages_user_len;
alter table agxp_project_messages add constraint agxp_project_messages_user_len
  check (role <> 'user' or char_length(content) <= 20000) not valid;

-- There is deliberately still no UPDATE policy: a stored message, the agent's
-- or the user's, cannot be rewritten afterwards.
