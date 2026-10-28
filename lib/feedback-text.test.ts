import { test } from "node:test";
import assert from "node:assert/strict";
import { formatConversation, pageOf, feedbackAlert, FEEDBACK_ALERT_TO, CONVERSATION_MAX, type FeedbackTurn } from "./feedback-text.ts";

const turn = (col: "consultant" | "coach", role: "user" | "assistant", content: string, at: string): FeedbackTurn =>
  ({ column_type: col, role, content, created_at: at });

test("both panels read as one transcript, oldest first", () => {
  const text = formatConversation([
    turn("coach", "assistant", "Hello from the coach", "2026-10-27T10:02:00Z"),
    turn("consultant", "user", "I want a YouTube clone", "2026-10-27T10:00:00Z"),
    turn("consultant", "assistant", "Tell me more", "2026-10-27T10:01:00Z"),
  ]);
  assert.equal(
    text,
    "[Consultant] User:\nI want a YouTube clone\n\n[Consultant] Agent:\nTell me more\n\n[Coach] Agent:\nHello from the coach",
  );
});

test("markers stay verbatim", () => {
  const text = formatConversation([turn("consultant", "assistant", "Ok [[CHOICES: a|b]]", "2026-10-27T10:00:00Z")]);
  assert.match(text, /\[\[CHOICES: a\|b\]\]/);
});

test("an empty conversation is an empty string", () => {
  assert.equal(formatConversation([]), "");
});

test("a long conversation keeps the end and stays within the table's limit", () => {
  const turns = Array.from({ length: 50 }, (_, i) =>
    turn("consultant", "user", `message ${i} ` + "x".repeat(5000), `2026-10-27T10:${String(i).padStart(2, "0")}:00Z`));
  const text = formatConversation(turns);
  assert.equal(text.length <= CONVERSATION_MAX, true);
  assert.match(text, /^\[… earlier messages left out\]/);
  assert.match(text, /message 49 /);
  assert.doesNotMatch(text, /message 0 /);
});

test("the alert goes to Ana and Tudor and carries the message, never a conversation", () => {
  assert.deepEqual(FEEDBACK_ALERT_TO, ["ana@xoxocom.net", "tudor@xoxocom.net"]);
  const m = feedbackAlert({ email: "tester@example.com", message: "The chat is stuck", page: "/dashboard/project/x", hasConversation: true });
  assert.match(m.subject, /serious problem/);
  assert.match(m.text, /tester@example\.com marked this feedback as a serious problem/);
  assert.match(m.text, /The chat is stuck/);
  assert.match(m.text, /Settings → Plan → Feedback/);
});

test("the alert escapes what the tester wrote", () => {
  const m = feedbackAlert({ email: "a@b.co", message: "<script>alert(1)</script> & more", page: null, hasConversation: false });
  assert.doesNotMatch(m.html, /<script>/);
  assert.match(m.html, /&lt;script&gt;/);
  assert.match(m.html, /&amp; more/);
  assert.match(m.text, /No conversation attached/);
});

test("a very long message is cut in the email", () => {
  const m = feedbackAlert({ email: "a@b.co", message: "x".repeat(1500), page: null, hasConversation: false });
  assert.equal(m.text.includes("x".repeat(1001)), false);
});

test("the page is the path without query or fragment", () => {
  assert.equal(pageOf("/dashboard/project/abc?key=secret#x"), "/dashboard/project/abc");
  assert.equal(pageOf("/" + "a".repeat(500)).length, 200);
});
