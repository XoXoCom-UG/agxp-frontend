-- AgxP — feedback de la testeri (2026-10-27)
--
-- Sedinta din 2026-10-23: un buton prin care testerii beta ne spun ce merge si
-- ce nu, cu o optiune clara — trimite si conversatia, sau nu. Conversatiile
-- pot contine secrete de afaceri, deci implicit NU pleaca nimic din ele.
--
-- Safe to run before or after deploying the code that writes to it.
--
-- Ca la agxp_reports (0020): omul poate INSERA propriile randuri si nimic
-- altceva — fara select, update, delete. Echipa citeste in SQL editor:
--
--   select created_at, message, include_conversation, page, length(conversation) as chars
--     from agxp_feedback order by created_at desc;
--
-- `conversation` e o copie text a celor doua conversatii ale proiectului, luata
-- de browser DOAR cand omul a bifat. Ramane si dupa ce proiectul e sters (omul
-- a trimis-o, nu e legata de proiect) si dispare odata cu contul.

create table if not exists agxp_feedback (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id            uuid references agxp_projects(id) on delete set null,
  message               text not null check (char_length(btrim(message)) between 1 and 2000),
  include_conversation  boolean not null default false,
  conversation          text check (char_length(conversation) <= 100000),
  page                  text check (char_length(page) <= 200),
  created_at            timestamptz not null default now(),
  -- O conversatie fara bifa nu intra, oricine ar apela API-ul direct.
  constraint agxp_feedback_conversation_needs_consent
    check (include_conversation or conversation is null)
);

create index if not exists agxp_feedback_created_idx on agxp_feedback(created_at desc);

alter table agxp_feedback enable row level security;

drop policy if exists agxp_feedback_insert_own on agxp_feedback;
create policy agxp_feedback_insert_own on agxp_feedback for insert to authenticated
  with check (
    user_id = auth.uid()
    -- Doar despre un proiect al tau.
    and (
      project_id is null
      or exists (
        select 1 from agxp_projects p
         where p.id = project_id and p.owner_id = auth.uid()
      )
    )
  );

-- Un formular de feedback e si un mod de a umple un tabel (cu pana la 100 KB
-- pe rand). Douazeci pe zi e mult mai mult decat trimite cineva cinstit.
create or replace function agxp_feedback_daily_cap() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from agxp_feedback
       where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have sent a lot of feedback today. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists agxp_feedback_daily_cap on agxp_feedback;
create trigger agxp_feedback_daily_cap before insert on agxp_feedback
  for each row execute function agxp_feedback_daily_cap();
