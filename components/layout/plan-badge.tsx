"use client";

import { useEntitlement } from "@/lib/entitlement";
import { projectsLabel } from "@/lib/plans";

/**
 * What is left, in the header.
 *
 * The allowance used to be invisible until it ran out: you pressed New Task,
 * got an error, and found out the rule and that you had broken it in the same
 * sentence. A limit nobody can see is a trap, and "1 project left this week"
 * is also the only honest moment to mention upgrading — at the point where
 * the person can feel what they are buying.
 *
 * Deliberately quiet until it matters. On a plan with room it is a plain
 * count; it only takes colour in the last two, and says nothing at all on
 * the unlimited plan, where a number would be noise.
 */
export function PlanBadge() {
  const { plan, projectsLeft, loading } = useEntitlement();

  // Nothing during the first read: a badge that appears saying "3 left" and
  // corrects itself to "1 left" a moment later is worse than a short gap.
  if (loading) return null;
  if (plan.projects >= 1000) return null;

  const left = projectsLeft;
  const tone = left === 0 ? "out" : left <= 1 ? "low" : "";
  const window = plan.period === "week" ? "this week" : "this month";

  return (
    <span className={`plan-badge ${tone}`}
      data-tooltip={left === 0
        ? `No projects left ${window} on ${plan.label}. The allowance resets at the start of the next ${plan.period}.`
        : `${left} of ${projectsLabel(plan)} projects left ${window} on the ${plan.label} plan`}>
      <span className="pb-dot" aria-hidden="true" />
      {left === 0
        ? <>None left <em>{window}</em></>
        : <>{left} left <em>{window}</em></>}
    </span>
  );
}
