/**
 * The text side of the feedback button: what is cut, and how a conversation is
 * written down. Pure, so the limits (which the table repeats, 0025) are tested
 * without a browser or a database.
 */

export const FEEDBACK_MAX = 2000;
export const CONVERSATION_MAX = 100_000;
const PAGE_MAX = 200;

const OMITTED = "[… earlier messages left out]\n\n";

export interface FeedbackTurn {
  column_type: "consultant" | "coach";
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const COLUMN_LABEL = { consultant: "Consultant", coach: "Coach" } as const;

/**
 * Both panels as one transcript, oldest first. Message text is kept as stored
 * (markers and all): it is what the team needs to see what went wrong. When it
 * is too long the START is dropped, because the problem the person is writing
 * about is nearly always in the latest messages.
 */
export function formatConversation(turns: FeedbackTurn[]): string {
  const text = [...turns]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(t => `[${COLUMN_LABEL[t.column_type]}] ${t.role === "user" ? "User" : "Agent"}:\n${t.content}`)
    .join("\n\n");
  if (text.length <= CONVERSATION_MAX) return text;
  return OMITTED + text.slice(text.length - (CONVERSATION_MAX - OMITTED.length));
}

/** Who is told at once when a tester marks feedback as a serious problem. */
export const FEEDBACK_ALERT_TO = ["ana@xoxocom.net", "tudor@xoxocom.net"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The email the team gets for a serious problem. The message is the tester's
 * own words, sent to the team on purpose (the dialog says so); the conversation
 * is never in the email — only whether one is attached, to read in the panel.
 */
export function feedbackAlert(f: { email: string; message: string; page: string | null; hasConversation: boolean }): {
  subject: string; text: string; html: string;
} {
  const who = f.email || "an account";
  const excerpt = f.message.length > 1000 ? `${f.message.slice(0, 1000)}…` : f.message;
  const where = f.page ? `Page: ${f.page}` : "";
  const chat = f.hasConversation
    ? "The conversation is attached: Settings → Plan → Feedback."
    : "No conversation attached.";
  const text = [`${who} marked this feedback as a serious problem:`, "", excerpt, "", where, chat]
    .filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#101828;">
<p style="font-size:15px;"><b>${esc(who)}</b> marked this feedback as a serious problem:</p>
<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #d92d20;background:#f4f5f7;white-space:pre-wrap;font-size:14px;line-height:1.55;">${esc(excerpt)}</blockquote>
${where ? `<p style="font-size:13px;color:#475467;margin:0 0 4px;">${esc(where)}</p>` : ""}
<p style="font-size:13px;color:#475467;margin:0;">${esc(chat)}</p>
</body></html>`;
  return { subject: "AgentiX feedback: serious problem", text, html };
}

/** The path only: no query string, which may carry an invitation key. */
export function pageOf(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  return path.slice(0, PAGE_MAX);
}
