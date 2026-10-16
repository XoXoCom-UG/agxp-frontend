-- AgxP — toti userii pe Max, pana sunt gata planurile (2026-10-15)
--
-- Aplicatia ii tine pe toti pe planul Max cat timp EVERYONE_IS_MAX din
-- lib/plans.ts e true. Baza are insa propria copie a doua limite, in
-- agxp_plan_limits: proiectele pe perioada (0008) si agentii pe tip (0014).
-- Fara randul de mai jos, un cont "free" ar fi vazut Max in aplicatie si ar fi
-- fost oprit de trigger la al treilea proiect pe saptamana sau la al doilea agent
-- de acelasi tip.
--
-- Se ridica randurile free si mid la valorile lui max. Randurile din
-- agxp_entitlements nu se ating, deci fiecare cont isi pastreaza planul real.
--
-- CA SA REVII (cand EVERYONE_IS_MAX devine false), ruleaza:
--   update agxp_plan_limits set projects = 3,  period = 'week',  agents_per_type = 1 where plan = 'free';
--   update agxp_plan_limits set projects = 15, period = 'month', agents_per_type = 4 where plan = 'mid';

update agxp_plan_limits l
   set projects        = m.projects,
       period          = m.period,
       agents_per_type = m.agents_per_type
  from agxp_plan_limits m
 where m.plan = 'max' and l.plan in ('free', 'mid');
