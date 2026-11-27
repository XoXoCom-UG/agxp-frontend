"use client";

import { useEntitlement } from "@/lib/entitlement";
import { projectsLabel, upgradeTarget, PLANS } from "@/lib/plans";
import { useT } from "@/lib/language";
import { openSettings } from "@/components/layout/settings-sheet";

/**
 * The plan, in the header, and the way to change it.
 *
 * The allowance used to be invisible until it ran out, and upgrading lived
 * three clicks deep (profile menu → Settings → Plan). Now the badge names the
 * plan and what is left, and one click opens Settings on the Plan tab, where
 * Upgrade goes through Stripe (2026-11-27). On a plan that can still go up it
 * says "Upgrade" outright; on Max it is a quiet name.
 */
export function PlanBadge() {
  const t = useT();
  const { plan, projectsLeft, loading } = useEntitlement();

  // Nothing during the first read: a badge that says "3 left" and corrects
  // itself to "1 left" a moment later is worse than a short gap.
  if (loading) return null;

  const unlimited = plan.projects >= 1000;
  const left = projectsLeft;
  const tone = unlimited ? "" : left === 0 ? "out" : left <= 1 ? "low" : "";
  const window_ = plan.period === "week" ? t("this week") : t("this month");
  const next = upgradeTarget(plan.id);
  const tip = unlimited
    ? t("{plan} plan. Open your plan.", { plan: plan.label })
    : t("{left} of {total} projects left {window} on the {plan} plan. Open your plan.",
      { left, total: projectsLabel(plan), window: window_, plan: plan.label });

  return (
    <button type="button" className={`plan-badge ${tone}`} data-tour="plan" data-tooltip={tip} aria-label={tip}
      onClick={() => openSettings("plan")}>
      <span className="pb-dot" aria-hidden="true" />
      <span className="pb-name">{plan.label}</span>
      {!unlimited && <em>{t("{left} left", { left })}</em>}
      {next && <span className="pb-up">{t("Upgrade to {plan}", { plan: PLANS[next].label })}</span>}
    </button>
  );
}
