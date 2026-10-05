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
  /**
   * Which email actually went: the Resend template, or the one built into
   * this file. Without this the two are indistinguishable from the outside,
   * and "the template is configured but the plain email arrived" is a
   * question you cannot answer by looking at the inbox.
   */
  via?: "template" | "built-in";
}

/**
 * Resend's sandbox sender. It needs no DNS and works the moment there is an
 * API key — but it may only write to the address the Resend account was
 * opened with, so it gets you a real end-to-end test and nothing more.
 * Resend refuses anything else with a message this file passes straight
 * through, so the limit announces itself rather than failing quietly.
 */
const SANDBOX_FROM = "AgentiX Projects <onboarding@resend.dev>";

/** The address invitations are sent from. */
export function inviteFrom(): string {
  return process.env.INVITE_FROM?.trim() || SANDBOX_FROM;
}

/** True once sending is possible at all, which takes only the API key. */
export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Whether we are still on the sandbox sender, which the panel says out loud. */
export function usingSandboxSender(): boolean {
  return !process.env.INVITE_FROM?.trim();
}

/** A plausible address. Not validation — the provider decides that. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * The variables an invitation template has to declare, spelled exactly like
 * this. They match the "Beta Invitation" template in Resend: BETA_KEY sits in
 * the key panel, APP_URL is used bare and with /login, /impressum and
 * /datenschutz appended — so it must carry no trailing slash. Nothing here
 * warns you if a template asks for a different name; the send simply renders
 * the fallback value, which for a key means an empty box.
 */
export const TEMPLATE_VARS = ["BETA_KEY", "APP_URL"] as const;

/**
 * The line that shows up in the inbox. A template carries its own design but
 * not the subject, so this applies either way and is worth setting: it is the
 * only part of the email a recipient reads before deciding to open it.
 */
export function inviteSubject(): string {
  return process.env.INVITE_SUBJECT?.trim() || "Your invitation to AgentiX Projects";
}

/** A published template id or alias, when one is configured. */
export function inviteTemplate(): string | null {
  return process.env.INVITE_TEMPLATE?.trim() || null;
}

export async function sendInvite(to: string, code: string, appUrl: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { sent: false, reason: "Email isn't set up on the server (RESEND_API_KEY)." };
  }
  if (!looksLikeEmail(to)) {
    return { sent: false, reason: "That doesn't look like an email address." };
  }

  const template = inviteTemplate();
  if (template) {
    const viaTemplate = await post(key, {
      // Resend rejects the request if html/text are sent alongside a
      // template, so this payload carries one or the other, never both.
      template: { id: template, variables: { BETA_KEY: code, APP_URL: appUrl } },
    }, to);
    if (viaTemplate.sent) return { ...viaTemplate, via: "template" };

    /*
     * The template failed — renamed, unpublished, a variable it expects that
     * we do not send. The recipient still needs the code, so the built-in
     * email goes out instead and the panel is told both things. Falling back
     * silently would leave a broken template broken forever; not falling
     * back would lose an invitation over a copy edit.
     */
    const fallback = await post(key, { text: inviteText(code, appUrl), html: inviteHtml(code, appUrl) }, to);
    return fallback.sent
      ? {
          sent: true,
          via: "built-in",
          reason: `Template "${template}" failed (${viaTemplate.reason}) — sent the built-in email instead.`,
        }
      : fallback;
  }

  const plain = await post(key, { text: inviteText(code, appUrl), html: inviteHtml(code, appUrl) }, to);
  return plain.sent ? { ...plain, via: "built-in" } : plain;
}

/** One request to Resend. `content` is either the template or the html/text. */
async function post(key: string, content: Record<string, unknown>, to: string): Promise<MailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: inviteFrom(),
        to: [to.trim()],
        subject: inviteSubject(),
        ...content,
      }),
      // A hung provider must not hold the request open: the key is already
      // minted by this point and the caller is waiting to be shown it.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      console.error("[mail] resend refused:", res.status, body.message);
      /*
       * Resend's own words first. A 403 is a setup step rather than a bug,
       * but there are two different setup steps behind it — an unverified
       * domain, and the sandbox sender that may only write to the account
       * owner — and collapsing both into "domain isn't verified" sends you
       * to edit DNS when the actual fix is the recipient address.
       */
      if (body.message) return { sent: false, reason: body.message };
      if (res.status === 403) {
        return { sent: false, reason: "Resend refused it: check the sender domain and the recipient." };
      }
      return { sent: false, reason: "The email provider refused it." };
    }
    return { sent: true, reason: null };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    console.error("[mail] send failed:", (e as Error).message);
    return { sent: false, reason: timedOut ? "The email provider didn't answer." : "The email couldn't be sent." };
  }
}

/**
 * Where the invitation's button points: the login page, with the key in the
 * fragment so the BetaGate can fill it in (lib/beta-key-handoff.ts). The
 * Resend template builds the same link from APP_URL and BETA_KEY.
 */
export function inviteLink(code: string, appUrl: string): string {
  return `${appUrl}/login#beta=${encodeURIComponent(code)}`;
}

/** Plain text, sent alongside the HTML — some clients show only this one. */
function inviteText(code: string, appUrl: string): string {
  return [
    "You've been invited to AgentiX Projects.",
    "",
    `Your key: ${code}`,
    "",
    `Open ${inviteLink(code, appUrl)} and sign in. The key is filled in for you.`,
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
          <a href="${esc(inviteLink(code, appUrl))}" style="display:inline-block;background:#154E80;color:#ffffff;
             text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:9px;">
            Open AgentiX Projects
          </a>
        </td></tr>
        <!-- #667085, not a lighter grey: this line is an instruction, and at
             #98a2b3 it sat at 2.6:1 on white, which is not readable text. -->
        <tr><td style="font-size:12px;line-height:1.6;color:#667085;">
          Sign in first, then enter the key when it asks. If you weren't expecting this,
          you can ignore it — the key does nothing until someone uses it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
