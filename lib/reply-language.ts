/**
 * reply-language.ts — which language the agent answers in, decided from what
 * the person actually wrote.
 *
 * LANGUAGE_RULE in lib/agent-prompt.ts asks the model to follow the user's
 * language, but it sits at the end of the stable prompt: after it come the
 * other panel's transcript (German, if the Coach was spoken to in German) and
 * an agenda whose labels are German ("Einstufung: Experte"). A tester wrote in
 * English for a dozen turns and the Consultant switched to German halfway
 * (2026-11-03). So the server names the language itself, in a block that comes
 * last, after the peer transcript.
 *
 * Only English and German are told apart; anything else returns null and the
 * general rule alone applies. Pure, so the tests can import it.
 */

export type ReplyLanguage = "en" | "de";

// Words that are common in one language and not words in the other. Left out
// on purpose: what both share or spell alike ("in", "so", "was", "die",
// "will", "also", "war", "man", "hat", "bin" in English slang).
const EN = new Set((
  "the and is are i i'm you you're my me we it it's to of for with that this what how not do don't " +
  "does have want can would should could about just yes all them they their our your be am on at " +
  "which there if or but myself build using uses need think like because already working project " +
  "students student people more some any been only than then when where who why from"
).split(" "));
const DE = new Set((
  "der das und ist sind ich du mein meine meinen wir es zu von für mit dass nicht ein eine einen " +
  "auch aber oder wie habe haben möchte kann können sie nein ja noch schon bei auf den dem des sich " +
  "wenn mir mich uns euch gibt sehr nur über weil keine kein würde soll sollte jetzt hier da nach " +
  "unsere unser ihr ihre wird werden wurde mehr etwa eigentlich bereits arbeite projekt leute"
).split(" "));

/** Enough evidence to decide, counted from the most recent message back. */
const ENOUGH = 6;

function words(text: string): string[] {
  return text
    // Markers ([[FILE: …]], [[CHOICES: …]]) are the app's, not the person's.
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .split(/[^a-zäöüß']+/)
    .filter(Boolean);
}

/**
 * The language of these messages (oldest first), weighted towards the latest:
 * the count runs backwards and stops once it has enough, so a switch of
 * language is followed within a message or two.
 */
export function detectLanguage(texts: string[]): ReplyLanguage | null {
  let en = 0, de = 0;
  for (let i = texts.length - 1; i >= 0 && en + de < ENOUGH; i--) {
    const text = texts[i];
    for (const w of words(text)) {
      if (EN.has(w)) en++;
      else if (DE.has(w)) de++;
    }
    // Umlauts and ß are German whatever the words.
    de += Math.min(2, (text.match(/[äöüß]/gi) ?? []).length);
  }
  if (en + de < 2) return null;
  if (en >= de * 2) return "en";
  if (de >= en * 2) return "de";
  return null;
}

/**
 * What the person typed: their turns without the app's own commands (English
 * document buttons, German read-along prompts) and without a click on one of
 * the options the agent offered — those are the agent's words, and once the
 * agent had slipped into German they were German ("2-3 Freunde") and pulled
 * the detection along (2026-11-03).
 */
export function typedByUser(
  turns: { role: "user" | "assistant"; content: string }[],
  isCommand: (text: string) => boolean,
): string[] {
  const out: string[] = [];
  let offered: string[] = [];
  for (const t of turns) {
    if (t.role === "assistant") {
      const m = t.content.match(/\[\[CHOICES:([^\]]*)\]\]/);
      offered = m ? m[1].split("|").map(o => o.trim().toLowerCase()) : [];
      continue;
    }
    const text = t.content.trim();
    if (!isCommand(text) && !offered.includes(text.toLowerCase())) out.push(text);
    offered = [];
  }
  return out;
}

/** This panel's messages decide; the other panel's only when these say nothing. */
export function replyLanguage(own: string[], other: string[]): ReplyLanguage | null {
  return detectLanguage(own) ?? detectLanguage(other);
}

/**
 * The last thing in the system prompt, in the language it asks for — an
 * instruction in English is the strongest hint that the answer is English.
 * Not enough on its own: in a conversation where the agent had already
 * answered in German a few times, its own history outweighed the system text
 * and it went on in German. Hence languageNote() below as well.
 */
export function languagePrompt(lang: ReplyLanguage | null): string {
  if (lang === "en") {
    return (
      "\n\nLANGUAGE — this overrides everything above: the user writes in English. Write this whole " +
      "reply in English, including the [[CHOICES]] options and every heading or label the agenda gives " +
      "in German (translate it: \"Einstufung\" becomes \"Level\"). The German of this system text, of " +
      "your notes and of the parallel conversation says nothing about the user's language. Switch only " +
      "if the user switches."
    );
  }
  if (lang === "de") {
    return (
      "\n\nSPRACHE — das gilt vor allem anderen: Der Nutzer schreibt Deutsch. Schreib diese ganze " +
      "Antwort auf Deutsch, auch die Optionen in [[CHOICES]]. Englische Befehle der App (\"Create the " +
      "complete …\") und ein englisches paralleles Gespräch ändern daran nichts. Wechsle nur, wenn der " +
      "Nutzer wechselt."
    );
  }
  return "";
}

/**
 * The same, as a short note after the person's latest message — the last
 * thing the model reads before it answers, which outweighs a run of its own
 * replies in the wrong language. Sent to the model only, never stored, and
 * marked as the app's, not the person's.
 */
export function languageNote(lang: ReplyLanguage | null): string {
  if (lang === "en") {
    return (
      "(App note, not written by the user: the user writes in English. Answer in English, " +
      "[[CHOICES]] included, even if earlier replies, the app's notes or the parallel conversation " +
      "were in German.)"
    );
  }
  if (lang === "de") {
    return (
      "(Hinweis der App, nicht vom Nutzer geschrieben: Der Nutzer schreibt Deutsch. Antworte auf " +
      "Deutsch, auch in [[CHOICES]], selbst wenn frühere Antworten oder das parallele Gespräch " +
      "Englisch waren.)"
    );
  }
  return "";
}
