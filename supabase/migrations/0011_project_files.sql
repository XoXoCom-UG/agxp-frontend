-- 0011_project_files.sql — attachments for the chat.
--
-- A private bucket, no new table. What was attached to a message is recorded
-- by a [[FILE: path | name | mime]] marker inside the message itself, the same
-- way a lesson is recorded by [[MEMORY:]] (see lib/agent-memory.ts). The
-- message row stays the whole record, so an attachment survives a reload with
-- nothing to join and no second policy to get wrong.
--
-- The path is "<user id>/<project id>/<uuid>.<ext>", and the first segment is
-- what every policy below checks. Putting the owner in the path is what makes
-- a single rule cover read, write and delete.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  -- 10 MB. Claude's own limits are higher, but a bigger file mostly means a
  -- bigger bill on every turn that resends it; see lib/project-files.ts.
  10485760,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'text/plain', 'text/csv', 'text/markdown'
  ]
)
on conflict (id) do update
  set file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = false;

-- ── Policies ────────────────────────────────────────────────────────────────
-- The bucket is private, so nothing is readable without one of these. Each is
-- the same condition: the object sits in a folder named after the caller.

drop policy if exists "project_files_own_select" on storage.objects;
create policy "project_files_own_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "project_files_own_insert" on storage.objects;
create policy "project_files_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "project_files_own_delete" on storage.objects;
create policy "project_files_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deliberately no update policy: a file is written once and replaced by
-- uploading a new one. Allowing an overwrite would let the bytes behind an
-- already-sent message change after the fact.

-- ── Cleanup ─────────────────────────────────────────────────────────────────
-- Deleting a project cascades to its messages through a foreign key, but
-- storage objects are not reachable that way: the link between them is a
-- string inside a message. Without this, every deleted project leaves its
-- files behind, paid for and unreferenced.

create or replace function delete_project_files()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
   where bucket_id = 'project-files'
     and name like old.owner_id::text || '/' || old.id::text || '/%';
  return old;
end;
$$;

drop trigger if exists agxp_projects_files_cleanup on agxp_projects;
create trigger agxp_projects_files_cleanup
  before delete on agxp_projects
  for each row execute function delete_project_files();

comment on function delete_project_files is
  'Removes a deleted project''s attachments from the project-files bucket. '
  'security definer because storage.objects is not writable by the owner role '
  'outside the policies above, and this runs as part of the project delete.';
