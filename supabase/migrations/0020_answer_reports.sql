-- AgxP — raportarea raspunsurilor problematice (2026-10-21)
--
-- Safe to run before or after deploying the code that writes to it.
--
-- A person can flag an agent's answer as wrong, harmful or otherwise off.
-- The report carries a short excerpt of the answer, because the team must be
-- able to see what was reported without reading the rest of someone's
-- project — the reporter is told the excerpt is sent.
--
-- The reporter may INSERT their own reports and nothing else: no select, no
-- update, no delete. The team reads them in the SQL editor:
--
--   select created_at, reason, note, excerpt from agxp_reports order by created_at desc;

create table if not exists agxp_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message_id  uuid references agxp_project_messages(id) on delete set null,
  reason      text not null check (reason in ('wrong','harmful','other')),
  note        text check (char_length(note) <= 1000),
  excerpt     text check (char_length(excerpt) <= 600),
  created_at  timestamptz not null default now()
);

create index if not exists agxp_reports_created_idx on agxp_reports(created_at desc);

alter table agxp_reports enable row level security;

drop policy if exists agxp_reports_insert_own on agxp_reports;
create policy agxp_reports_insert_own on agxp_reports for insert to authenticated
  with check (
    user_id = auth.uid()
    -- Only about an answer in one of your own projects.
    and (
      message_id is null
      or exists (
        select 1 from agxp_project_messages m
          join agxp_projects p on p.id = m.project_id
         where m.id = message_id and p.owner_id = auth.uid() and m.role = 'assistant'
      )
    )
  );

-- A report form is also a way to fill a table. Thirty a day is far more than
-- anyone flags honestly.
create or replace function agxp_reports_daily_cap() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from agxp_reports
       where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'You have sent a lot of reports today. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists agxp_reports_daily_cap on agxp_reports;
create trigger agxp_reports_daily_cap before insert on agxp_reports
  for each row execute function agxp_reports_daily_cap();
