-- 0003 only granted select/insert on agxp_project_messages; "New conversation"
-- (clear the current column's history) needs delete too.
create policy "agxp_project_messages_owner_delete" on agxp_project_messages for delete to authenticated
  using (exists (select 1 from agxp_projects p where p.id = project_id and p.owner_id = auth.uid()));
