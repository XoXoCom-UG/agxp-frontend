-- AgxP — biblioteca de continut video mostenita din baza veche (bi-agent-frontend).
-- Videouri YouTube analizate (calitate, categorii, insight-uri de business) plus
-- embeddings pentru retrieval semantic (folosit in fazele viitoare de RAG).

create extension if not exists "vector";

-- ── channels ────────────────────────────────────────────────────────────────
create table if not exists channels (
  channel_name     text primary key,
  total_videos     integer,
  avg_quality      real,
  top_category     text,
  top_technologies text,
  first_seen       text,
  last_seen        text
);

-- ── videos ──────────────────────────────────────────────────────────────────
create table if not exists videos (
  video_id             text primary key,
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
);

create index if not exists videos_channel_idx        on videos(channel);
create index if not exists videos_search_vector_idx  on videos using gin(search_vector);
-- No ivfflat index yet — at today's row count (~25) an ANN index needs more rows
-- than it has lists for, and brute-force cosine distance is instant anyway. Add
-- `create index ... using ivfflat (embedding vector_cosine_ops) with (lists = N)`
-- once the library has grown enough to need it (N ≈ rows / 1000, min a few dozen).

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Same model as the agent catalog (0001): shared read-only data for every
-- signed-in user, writes only via the service role.
alter table channels enable row level security;
alter table videos   enable row level security;

create policy "channels_select_authenticated" on channels for select to authenticated using (true);
create policy "videos_select_authenticated"   on videos   for select to authenticated using (true);
