import "server-only";

/**
 * send-mail.ts — the one transactional email this app sends.
 *
 * Over Resend's REST API with fetch, deliberately: no SDK to add to an
 * eight-dependency project, and switching provider later is this file and
 * nothing else. Vercel also blocks outbound SMTP on some plans, so an HTTP
 * API is the shape that keeps working.
 *
 * Sending is OPTIONAL everywhere it is used. Without a key the invitation is
 * still created and still works — it just has to be copied by hand, which is
 * what happened before this existed. Losing an email must never lose a key.
 */

export interface MailResult {
  sent: boolean;
  /** Why not, in words a team member can act on. Null when it went out. */
  reason: string | null;
}

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.INVITE_FROM;
}

/** A plausible address. Not validation — the provider decides that. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export async function sendInvite(to: string, code: string, appUrl: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM;
  if (!key || !from) {
    return { sent: false, reason: "Email isn't set up on the server (RESEND_API_KEY, INVITE_FROM)." };
  }
  if (!looksLikeEmail(to)) {
    return { sent: false, reason: "That doesn't look like an email address." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to.trim()],
        subject: "Your invitation to AgentiX Projects",
        text: inviteText(code, appUrl),
        html: inviteHtml(code, appUrl),
      }),
      // A hung provider must not hold the request open: the key is already
      // minted by this point and the caller is waiting to be shown it.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      console.error("[mail] resend refused:", res.status, body.message);
      // 403 here is almost always an unverified sending domain, which is a
      // setup step rather than a bug, so it is worth naming.
      if (res.status === 403) {
        return { sent: false, reason: "The sending domain isn't verified with Resend yet." };
      }
      return { sent: false, reason: body.message || "The email provider refused it." };
    }
    return { sent: true, reason: null };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    console.error("[mail] send failed:", (e as Error).message);
    return { sent: false, reason: timedOut ? "The email provider didn't answer." : "The email couldn't be sent." };
  }
}

/** Plain text, sent alongside the HTML — some clients show only this one. */
function inviteText(code: string, appUrl: string): string {
  return [
    "You've been invited to AgentiX Projects.",
    "",
    `Your key: ${code}`,
    "",
    `Open ${appUrl}, sign in, and enter the key when it asks.`,
    "",
    "An AI consultant and an AI coach work one transformation project through",
    "with you, and write the two documents at the end.",
  ].join("\n");
}

/**
 * Deliberately plain HTML with inline styles: email clients strip <style>
 * blocks, ignore custom properties, and several still lay out with tables.
 * The code is the one thing that has to survive, so it is also in the plain
 * text part above.
 */
function inviteHtml(code: string, appUrl: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:480px;background:#ffffff;border-radius:14px;padding:32px;
                    font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="font-size:19px;font-weight:600;color:#101828;padding-bottom:10px;">
          You've been invited to AgentiX Projects
        </td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:#475467;padding-bottom:22px;">
          An AI consultant and an AI coach work one transformation project through with you,
          ask the questions, and write the two documents at the end.
        </td></tr>
        <tr><td align="center" style="padding-bottom:22px;">
          <div style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:23px;
                      letter-spacing:3px;color:#101828;background:#f4f5f7;border:1px solid #e4e7ec;
                      border-radius:10px;padding:14px 18px;">${esc(code)}</div>
        </td></tr>
        <tr><td align="center" style="padding-bottom:20px;">
          <a href="${esc(appUrl)}" style="display:inline-block;background:#154E80;color:#ffffff;
             text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:9px;">
            Open AgentiX Projects
          </a>
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.6;color:#98a2b3;">
          Sign in first, then enter the key when it asks. If you weren't expecting this,
          you can ignore it — the key does nothing until someone uses it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
