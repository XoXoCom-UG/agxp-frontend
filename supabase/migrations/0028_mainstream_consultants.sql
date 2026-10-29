-- AgxP — cei doi consultanti simpli: General Consultant si Agentics Consultant (2026-10-27)
--
-- Sedinta din 2026-10-23 (Patryk): in afara celor noua tipuri profesionale trebuie
-- un tip simplu pentru cineva care vine cu o idee si nu stie termenii. Doua tipuri,
-- cu putine metode (lib/agent-types.ts, lib/mainstream-documents.ts).
--
-- Pickerul leaga un agent de randurile din `methods` dupa NUME
-- (agent-picker-panel.tsx, ConfigureView): daca un nume lipseste de aici, tipul nu
-- se poate crea ("None of this type's methods are in the database yet"). Numele de
-- mai jos trebuie sa fie IDENTICE cu cele din TYPE_CATALOG; lib/agent-types.test.ts
-- compara fisierul cu catalogul.
--
-- Metodele refolosite (Knowledge Check, Lexicon, At a Glance, Future Headline, SMART
-- Goals, Risk Register, Personas, Competitor Benchmark, Assumption Tests) exista deja
-- (0016, 0024) si nu se ating; aici se adauga doar cele patru noi. Tipurile sunt noi,
-- deci nu exista agenti de relegat.
--
-- Ana, 2026-10-29: metodele cele mai simple si mai importante. General Consultant:
-- Idea Check, First Steps Plan, Lexicon, Personas, Competitor Benchmark, Future
-- Headline, SMART Goals, Risk Register, At a Glance (+ Knowledge Check); Agentics
-- Consultant: What the AI Needs, First Small Version, Lexicon, Assumption Tests,
-- Risk Register, At a Glance (+ Knowledge Check).
--
-- Safe to re-run: un nume care exista deja nu se mai insereaza.

insert into skills (name, description)
values ('AI Transformation Roadmap', 'From the current state to a plan that can be carried out.')
on conflict (name) do nothing;

with wanted(name, is_primary, description) as (values
  ('Idea Check', true,  'Your idea in one sentence: who it is for, which problem it solves, why now and how far it is.'),
  ('First Steps Plan', true,  'Three steps in time, this week, this month and after: who does what, how long, and how you know it worked.'),
  ('What the AI Needs', true,  'The information the AI works with: do you have it, where is it, may you use it, and what is missing.'),
  ('First Small Version', true,  'The smallest version worth trying first: what must be in it, what can wait and what stays out.')
)
insert into methods (skill_id, name, is_primary, description)
select s.id, w.name, w.is_primary, w.description
  from wanted w
  cross join (select id from skills where name = 'AI Transformation Roadmap' limit 1) s
 where not exists (select 1 from methods m where m.name = w.name);
