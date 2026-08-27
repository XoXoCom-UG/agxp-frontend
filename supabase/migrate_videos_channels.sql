-- ONE-TIME data transfer: copies `channels` + `videos` from the OLD Supabase
-- project (bi-agent-frontend) into THIS project, using postgres_fdw — no local
-- pg_dump/psql needed.
--
-- Run this AFTER 0001_agxp_schema.sql and 0002_media_library_schema.sql are
-- applied here. Run it in the SQL Editor of the NEW project.
--
-- Before running: replace the four placeholders below with the OLD project's
-- direct database connection details (Settings → Database → Connection string
-- → "Direct connection", not the pooler). The password only lives in this
-- session/script — step 5 removes it again once the copy is done.

-- 1. Extension + foreign server pointing at the OLD database
create extension if not exists postgres_fdw;

create server if not exists old_bi_agent_db
  foreign data wrapper postgres_fdw
  options (host 'db.OLD_PROJECT_REF.supabase.co', port '5432', dbname 'postgres');

create user mapping if not exists for current_user
  server old_bi_agent_db
  options (user 'postgres', password 'OLD_DB_PASSWORD');

-- 2. Foreign tables mirroring the old schema
create foreign table if not exists old_channels (
  channel_name     text,
  total_videos     integer,
  avg_quality      real,
  top_category     text,
  top_technologies text,
  first_seen       text,
  last_seen        text
) server old_bi_agent_db options (schema_name 'public', table_name 'channels');

create foreign table if not exists old_videos (
  video_id             text,
  title                text,
  url                  text,
  channel              text,
  published            text,
  duration             text,
  duration_seconds     integer,
  views                text,
  language             text,
  sub_language         text,
  category             text,
  difficulty           text,
  quality_score        real,
  priority_score       real,
  core_idea            text,
  actionable_insight   text,
  target_audience      text,
  creator_info         text,
  mentioned_companies  text,
  company_details      text,
  financial_data       text,
  technologies         text,
  tech_stack_context   text,
  auto_tags            text,
  semantic_topics      text,
  geo_focus            text,
  business_model       text,
  eu_relevance         real,
  business_ideas       text,
  problems_addressed   text,
  solutions_offered    text,
  industry_sectors     text,
  revenue_potential    text,
  de_applicability     text,
  eu_applicability     text,
  de_problems          text,
  strategies           text,
  marketing_insights   text,
  sales_insights       text,
  ai_applications      text,
  barriers_to_entry    text,
  key_metrics          text,
  theme_tags           text,
  project_category     text,
  processed_at         text,
  transcript           text,
  qa_analysis          text,
  raw_json             text,
  module               text,
  embedding_text       text,
  embedding_model      text,
  embedded_at          text,
  embedding            vector(512),
  search_vector        tsvector
) server old_bi_agent_db options (schema_name 'public', table_name 'videos');

-- 3. Copy the data
insert into channels select * from old_channels
on conflict (channel_name) do nothing;

insert into videos select * from old_videos
on conflict (video_id) do nothing;

-- 4. Sanity check — should match the counts from the old project
select 'channels' as table_name, count(*) from channels
union all
select 'videos', count(*) from videos;

-- 5. Cleanup — drop the foreign tables/server so the old DB password doesn't
-- linger in this project's catalog.
drop foreign table if exists old_channels;
drop foreign table if exists old_videos;
drop user mapping if exists for current_user server old_bi_agent_db;
drop server if exists old_bi_agent_db;
