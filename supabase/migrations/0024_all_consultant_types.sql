-- AgxP — toate cele noua tipuri de consultant, cu toate metodele din foaie (2026-10-23)
--
-- "AgxP – Method Groups per Consultant" (Ana, 2026-10-23) are noua tipuri de
-- consultant si, pentru fiecare, toate metodele (Core, Primary, Secondary,
-- Closing si New): Strategy Consultant, Business Analyst, Digital Transformation
-- Manager, Data Scientist, Product Manager, Solution Architect, Enterprise
-- Architect, Startup CTO, Change Manager (lib/agent-types.ts).
--
-- 0016 a pus metodele primelor trei tipuri. Aici se adauga restul, plus metodele
-- "New" ale celor trei. Pickerul leaga un agent de randurile din `methods` dupa
-- NUME (agent-picker-panel.tsx, ConfigureView): daca un nume lipseste de aici,
-- tipul nu se poate crea ("None of this type's methods are in the database
-- yet"). Numele de mai jos trebuie sa fie IDENTICE cu cele din TYPE_CATALOG;
-- lib/agent-types.test.ts compara fisierul cu catalogul.
--
-- is_primary aici e doar "primary pentru cel putin un tip". Ce e primary pentru
-- UN tip se hotaraste dupa sablonul tipului (listAgents(), lib/agents.ts),
-- fiindca foaia are aceeasi metoda primary pentru un tip si secondary pentru
-- altul (Stakeholder Map, Impact Mapping, Governance Model).
--
-- Randurile care exista deja (din 0016, din seed.sql) nu se ating: aceeasi
-- metoda ramane o singura linie, impartita intre tipuri si, unde e cazul, cu coach-ii.

insert into skills (name, description)
values ('AI Transformation Roadmap', 'From the current state to a plan that can be carried out.')
on conflict (name) do nothing;

with wanted(name, is_primary, description) as (values
  ('Gap Analysis + Action Plan', true,  'Current against desired state per dimension, with the gap and a prioritised action plan.'),
  ('Build / Buy / Partner Matrix', true,  'Per capability: build it, buy it or partner — scored on cost, time and control.'),
  ('SWOT', true,  'Strengths, weaknesses, opportunities and threats of the plan.'),
  ('Market / Opportunity Gaps', false, 'Market situation against its potential: demand the user does not serve yet.'),
  ('Competitor Benchmark', false, 'Compares the idea with 3-5 alternatives on the features that matter to users, and names the white space.'),
  ('Scenario Planning', false, 'Best, base and worst case for the plan, with early warning signs and responses.'),
  ('Future Headline', false, 'The user writes the news headline of their success 12 months from now; the agent works backwards.'),
  ('Consultant-Coach Debate', false, 'Consultant and Coach argue for and against a key decision, then the user decides.'),
  ('SMART Goals', false, 'Goals rewritten until each can be answered with yes or no.'),
  ('Knowledge Check', false, 'Three quick questions that set the level of everything that follows.'),
  ('Lexicon', false, 'Every foreign term in the document, clustered by topic and explained.'),
  ('At a Glance', false, 'The whole case in one table: core problem, description, required knowledge, recommended direction.'),
  ('As-Is / To-Be', true,  'Side by side: how things work today and how they should work after the project.'),
  ('Requirements (User Stories + MoSCoW)', true,  'User stories with acceptance criteria and a MoSCoW priority.'),
  ('Impact Mapping', true,  'Links a measurable goal to actors, the behaviour change wanted, and deliverables.'),
  ('Process Mapping', false, 'Step-by-step To-Be process with roles, inputs and outputs.'),
  ('Pain Point Heatmap', false, 'Rates pain points by frequency and severity to show where to start.'),
  ('Data Mapping', false, 'Maps every data field the use case needs to its source, owner and quality.'),
  ('Edge Case Hunt', false, 'Systematically asks what happens in unusual situations, for every must-have story.'),
  ('Definition of Done', false, 'A shared checklist every feature must pass before it counts as done.'),
  ('Risk Register', false, 'Risks with impact, likelihood and mitigation, focused on the consultant''s domain.'),
  ('Capability Maturity', true,  'Rates the organisation 1-5 per dimension against a target level.'),
  ('Use-Case Prioritization', true,  'Rates AI use cases by value, effort and data readiness into Quick Win, Strategic Bet, Later, Drop.'),
  ('Roadmap', true,  'Phases with milestones, owners and gates to the next phase.'),
  ('Governance Model', true,  'Who decides what, who is consulted, how often, and which rules apply.'),
  ('Stakeholder Map', true,  'Groups by interest and influence, with stance and how to involve them.'),
  ('AI Use-Case Canvas', false, 'A one-page card per AI use case: problem, users, data, model idea, value, risk, owner.'),
  ('Transformation Pulse Check', false, 'A monthly five-question check on progress, energy and blockers.'),
  ('Pre-Mortem', false, 'Assume the project failed in 12 months and ask why; each reason gets a prevention action.'),
  ('OKRs', false, 'Objectives with 2-3 measurable key results each.'),
  ('Problem Framing', true,  'Translates a business question into an ML task with input, output and the decision it supports.'),
  ('Data Readiness', true,  'Checks whether the data for an AI use case exists, is labelled, good enough and accessible.'),
  ('Model Options', true,  'Compares 2-3 technical approaches including a simple baseline.'),
  ('Root Cause Analysis (5 Whys)', false, 'Asks why repeatedly until reaching a cause the team can act on.'),
  ('Label Audit', false, 'Checks a sample of training labels for errors and inconsistency.'),
  ('Human-in-the-Loop Design', false, 'Defines when the AI decides alone, when it suggests, and when a human must decide.'),
  ('Model Card', false, 'Short fact sheet of a model: purpose, data, performance, limits, owner.'),
  ('Evaluation Metrics', false, 'Technical model metrics translated into business meaning, with baseline and target.'),
  ('PoC Experiment Plan', false, 'Hypothesis, dataset, success threshold, timebox and next step for a proof of concept.'),
  ('Personas', true,  'Short profiles of the main user types: context, goal, frustration, reason to return.'),
  ('MVP Scope (MoSCoW)', true,  'Feature list prioritised into Must, Should, Could, Won''t for the first release.'),
  ('User Journey', false, 'Stages the user goes through, with feelings and drop-off risks.'),
  ('A/B Test Plan', false, 'Controlled test of two variants with metric, sample size and decision rule.'),
  ('Jobs-to-be-Done', false, 'Describes the job the user hires the product for: when, want, so that.'),
  ('Feature Kill List', false, 'Features explicitly decided not to build, with the reason.'),
  ('Fake Door Test', false, 'A button or landing page for a feature that does not exist yet, to measure real interest.'),
  ('Retention Hook Map', false, 'Trigger, action, reward and investment that bring users back.'),
  ('Assumption Tests', false, 'The riskiest assumptions with the cheapest test and the signal that proves or kills them.'),
  ('Architecture Overview', true,  'Components, their responsibility, technology and who they talk to.'),
  ('Tech Stack Decisions (ADR)', true,  'Architecture decision records: what was decided, the alternatives, why, the consequence.'),
  ('Non-Functional Requirements', true,  'Performance, scalability, security and availability as measurable requirements.'),
  ('Data & ML Pipeline', false, 'Stages from data ingest to model serving and monitoring, with tool, frequency and owner.'),
  ('Infrastructure Plan', false, 'Cloud, on-premises or hybrid per layer, with the technology and the reason.'),
  ('Failure Mode Walkthrough', false, 'Walks through each component asking what happens when it fails.'),
  ('Vendor Lock-in Check', false, 'Rates how hard it would be to leave each external service.'),
  ('Load Story', false, 'A concrete story of 10x and 100x usage and what breaks first.'),
  ('Cost Model (TCO)', false, 'One-time and monthly costs with assumptions, people time included.'),
  ('IT Landscape', true,  'Inventory of the systems the use case touches.'),
  ('Integration Blueprint', true,  'Data flows between systems: from, to, interface, frequency, data.'),
  ('Compliance Check', false, 'Regulations that apply, the requirement, status and action.'),
  ('AI Model Register', false, 'Company-wide list of all AI models and tools in use, with owner and risk level.'),
  ('Shadow AI Scan', false, 'Finds AI tools employees already use without approval.'),
  ('Data Lineage Map', false, 'Shows where data comes from, how it is transformed and where it ends up.'),
  ('Change Impact', false, 'What changes in systems, processes and roles, how strongly, and for whom.'),
  ('Lean Canvas', true,  'One-page business model: problem, customer, value, solution, channels, revenue, costs, key metric, advantage.'),
  ('MVP Core Loop', true,  'The smallest repeatable loop a stranger can use without help, with done-criteria per step.'),
  ('Lean Tech Stack', true,  'Fastest stack to ship, with the trigger for replacing each choice.'),
  ('Team Setup', false, 'Roles, people, ownership and time commitment.'),
  ('Pivot Triggers', false, 'Pre-defined signals that mean change direction, with the alternative.'),
  ('Weekly Ship Log', false, 'One line per week: what shipped, what was learned.'),
  ('Hiring Scorecard', false, 'Defines the next hire by outcomes, not job titles.'),
  ('Build-Measure-Learn Milestones', false, 'Weekly loop of what to build, what to measure and which decision follows.'),
  ('Tech Debt Log', false, 'Shortcuts taken on purpose, why, and when to pay them back.'),
  ('Skill-Gap Analysis', true,  'Skills per group: current against target level and how to close the gap.'),
  ('ADKAR Assessment', true,  'Awareness, Desire, Knowledge, Ability, Reinforcement per group; finds where the change gets stuck.'),
  ('Role Matrix', false, 'How each role''s tasks change: today, after the change, and what stays.'),
  ('Fear & Myth Board', false, 'Collects fears and myths about the change and answers each honestly.'),
  ('Champion Network', false, 'Volunteers in each team who try the change first and help colleagues.'),
  ('Win Wall', false, 'A visible collection of small wins from the new way of working.'),
  ('Training & Communication Plan', false, 'When which group gets which message or training, through which channel, by whom.'),
  ('Adoption KPIs', false, 'Usage measures with target, source and deadline.')
)
insert into methods (skill_id, name, is_primary, description)
select s.id, w.name, w.is_primary, w.description
  from wanted w
  cross join (select id from skills where name = 'AI Transformation Roadmap' limit 1) s
 where not exists (select 1 from methods m where m.name = w.name);

-- Consultantii care exista deja continua ca tipul pe care il numeste tagline-ul.
-- Legaturile lor se aduc la cele ale tipului, ca cardul si chip-urile sa arate ce
-- face agentul acum (inclusiv metodele "New" adaugate): se adauga ce lipseste, apoi
-- se scot cele care nu mai apartin tipului. Doua instructiuni, nu un DELETE si un
-- INSERT in acelasi CTE: un INSERT ... ON CONFLICT DO NOTHING ar sari peste o pereche
-- tocmai stearsa de acelasi statement, si agentul ar ramane fara metoda.
-- Coach-ii si agentii cu alt tagline nu se ating.
drop table if exists _kind_methods;
create temp table _kind_methods (sub text not null, method text not null);

insert into _kind_methods (sub, method) values
  ('strategy & ai transformation', 'Gap Analysis + Action Plan'),
  ('strategy & ai transformation', 'Build / Buy / Partner Matrix'),
  ('strategy & ai transformation', 'SWOT'),
  ('strategy & ai transformation', 'Market / Opportunity Gaps'),
  ('strategy & ai transformation', 'Competitor Benchmark'),
  ('strategy & ai transformation', 'Scenario Planning'),
  ('strategy & ai transformation', 'Future Headline'),
  ('strategy & ai transformation', 'Consultant-Coach Debate'),
  ('strategy & ai transformation', 'SMART Goals'),
  ('strategy & ai transformation', 'Knowledge Check'),
  ('strategy & ai transformation', 'Lexicon'),
  ('strategy & ai transformation', 'At a Glance'),
  ('requirements & processes', 'As-Is / To-Be'),
  ('requirements & processes', 'Gap Analysis + Action Plan'),
  ('requirements & processes', 'Requirements (User Stories + MoSCoW)'),
  ('requirements & processes', 'Impact Mapping'),
  ('requirements & processes', 'Process Mapping'),
  ('requirements & processes', 'Pain Point Heatmap'),
  ('requirements & processes', 'Data Mapping'),
  ('requirements & processes', 'Edge Case Hunt'),
  ('requirements & processes', 'Definition of Done'),
  ('requirements & processes', 'SMART Goals'),
  ('requirements & processes', 'Risk Register'),
  ('requirements & processes', 'Knowledge Check'),
  ('requirements & processes', 'Lexicon'),
  ('requirements & processes', 'At a Glance'),
  ('roadmap & adoption', 'Capability Maturity'),
  ('roadmap & adoption', 'Use-Case Prioritization'),
  ('roadmap & adoption', 'Roadmap'),
  ('roadmap & adoption', 'Governance Model'),
  ('roadmap & adoption', 'Stakeholder Map'),
  ('roadmap & adoption', 'AI Use-Case Canvas'),
  ('roadmap & adoption', 'Transformation Pulse Check'),
  ('roadmap & adoption', 'Pre-Mortem'),
  ('roadmap & adoption', 'OKRs'),
  ('roadmap & adoption', 'Risk Register'),
  ('roadmap & adoption', 'Knowledge Check'),
  ('roadmap & adoption', 'Lexicon'),
  ('roadmap & adoption', 'At a Glance'),
  ('data & machine learning', 'Problem Framing'),
  ('data & machine learning', 'Data Readiness'),
  ('data & machine learning', 'Model Options'),
  ('data & machine learning', 'Root Cause Analysis (5 Whys)'),
  ('data & machine learning', 'Label Audit'),
  ('data & machine learning', 'Human-in-the-Loop Design'),
  ('data & machine learning', 'Model Card'),
  ('data & machine learning', 'Evaluation Metrics'),
  ('data & machine learning', 'PoC Experiment Plan'),
  ('data & machine learning', 'Risk Register'),
  ('data & machine learning', 'Knowledge Check'),
  ('data & machine learning', 'Lexicon'),
  ('data & machine learning', 'At a Glance'),
  ('product & users', 'Personas'),
  ('product & users', 'Impact Mapping'),
  ('product & users', 'MVP Scope (MoSCoW)'),
  ('product & users', 'User Journey'),
  ('product & users', 'A/B Test Plan'),
  ('product & users', 'Jobs-to-be-Done'),
  ('product & users', 'Feature Kill List'),
  ('product & users', 'Fake Door Test'),
  ('product & users', 'Retention Hook Map'),
  ('product & users', 'Future Headline'),
  ('product & users', 'OKRs'),
  ('product & users', 'Assumption Tests'),
  ('product & users', 'Knowledge Check'),
  ('product & users', 'Lexicon'),
  ('product & users', 'At a Glance'),
  ('systems & integration', 'Architecture Overview'),
  ('systems & integration', 'Tech Stack Decisions (ADR)'),
  ('systems & integration', 'Non-Functional Requirements'),
  ('systems & integration', 'Data & ML Pipeline'),
  ('systems & integration', 'Infrastructure Plan'),
  ('systems & integration', 'Failure Mode Walkthrough'),
  ('systems & integration', 'Vendor Lock-in Check'),
  ('systems & integration', 'Load Story'),
  ('systems & integration', 'Consultant-Coach Debate'),
  ('systems & integration', 'Cost Model (TCO)'),
  ('systems & integration', 'Risk Register'),
  ('systems & integration', 'Knowledge Check'),
  ('systems & integration', 'Lexicon'),
  ('systems & integration', 'At a Glance'),
  ('enterprise it & governance', 'IT Landscape'),
  ('enterprise it & governance', 'Integration Blueprint'),
  ('enterprise it & governance', 'Governance Model'),
  ('enterprise it & governance', 'Compliance Check'),
  ('enterprise it & governance', 'AI Model Register'),
  ('enterprise it & governance', 'Shadow AI Scan'),
  ('enterprise it & governance', 'Data Lineage Map'),
  ('enterprise it & governance', 'Change Impact'),
  ('enterprise it & governance', 'Risk Register'),
  ('enterprise it & governance', 'Knowledge Check'),
  ('enterprise it & governance', 'Lexicon'),
  ('enterprise it & governance', 'At a Glance'),
  ('startup tech & shipping', 'Lean Canvas'),
  ('startup tech & shipping', 'MVP Core Loop'),
  ('startup tech & shipping', 'Lean Tech Stack'),
  ('startup tech & shipping', 'Team Setup'),
  ('startup tech & shipping', 'Pivot Triggers'),
  ('startup tech & shipping', 'Weekly Ship Log'),
  ('startup tech & shipping', 'Hiring Scorecard'),
  ('startup tech & shipping', 'Pre-Mortem'),
  ('startup tech & shipping', 'Build-Measure-Learn Milestones'),
  ('startup tech & shipping', 'Tech Debt Log'),
  ('startup tech & shipping', 'Knowledge Check'),
  ('startup tech & shipping', 'Lexicon'),
  ('startup tech & shipping', 'At a Glance'),
  ('change & adoption', 'Stakeholder Map'),
  ('change & adoption', 'Skill-Gap Analysis'),
  ('change & adoption', 'ADKAR Assessment'),
  ('change & adoption', 'Role Matrix'),
  ('change & adoption', 'Fear & Myth Board'),
  ('change & adoption', 'Champion Network'),
  ('change & adoption', 'Win Wall'),
  ('change & adoption', 'Training & Communication Plan'),
  ('change & adoption', 'Adoption KPIs'),
  ('change & adoption', 'Knowledge Check'),
  ('change & adoption', 'Lexicon'),
  ('change & adoption', 'At a Glance');

insert into agent_methods (agent_id, method_id)
select distinct a.id, m.id
  from agents a
  join _kind_methods k on k.sub = lower(trim(a.tagline))
  join methods m on m.name = k.method
 where a.type::text = 'consultant'
on conflict do nothing;

delete from agent_methods am
 using agents a
 where am.agent_id = a.id
   and a.type::text = 'consultant'
   and lower(trim(a.tagline)) in (select sub from _kind_methods)
   and not exists (
     select 1
       from _kind_methods k
       join methods m on m.name = k.method
      where k.sub = lower(trim(a.tagline)) and m.id = am.method_id
   );

drop table _kind_methods;
