"use client";

import Link from "next/link";
import { IconArrow } from "@/components/layout/agxp-icons";

/**
 * Settings → Plan, team only: the way into the feedback dashboard.
 *
 * Only a door. The list lives on its own page (/dashboard/feedback) because it
 * is long and a settings sheet is not the place to read it; the data behind it
 * refuses anyone off the team whatever this button shows.
 */
export function DevFeedback() {
  return (
    <div className="ss-field ss-dev">
      <span className="ss-label">Feedback <em>team only</em></span>
      <span className="ss-hint">Everything testers sent, most serious first (rated by AI).</span>
      <Link className="btn btn-ghost fbd-open" href="/dashboard/feedback">
        Open feedback dashboard <IconArrow size={13} />
      </Link>
    </div>
  );
}
