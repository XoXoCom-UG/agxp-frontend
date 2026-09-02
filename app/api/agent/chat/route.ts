import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { AgentType } from "@/lib/agents";

const MODEL = "claude-sonnet-5";

// The user wants EVERY question to end with pickable options — no free-text
// guessing, no exceptions. This is a hard requirement, not a "when it makes
// sense" suggestion, because the first, softer wording got ignored/skipped
// by the model on open-ended questions.
const CHOICES_INSTRUCTION =
  `\n\nWICHTIG — das ist eine feste Regel, keine Empfehlung: JEDE Antwort, die mit einer Frage an ` +
  `den Nutzer endet, MUSS mit einem Marker in einer eigenen letzten Zeile enden: ` +
  `[[CHOICES: Option A|Option B|Option C]] (2-5 kurze, klar unterscheidbare Antwortoptionen, ` +
  `durch | getrennt). Das gilt auch für offene/weiche Fragen — formuliere dann plausible, ` +
  `konkrete Beispielantworten als Optionen (der Nutzer kann trotzdem frei tippen, die Optionen sind ` +
  `nur ein Vorschlag). Nur wenn deine Antwort mit GAR KEINER Frage endet, lässt du den Marker weg. ` +
  `Der Marker erscheint nie im sichtbaren Text — er wird vom Frontend herausgefiltert und als Buttons ` +
  `dargestellt.`;

const SYSTEM_PROMPTS: Record<AgentType, (name: string) => string> = {
  consultant: (name) =>
    `Du bist ${name}, ein erfahrener KI-Transformation Consultant. Du hilfst Unternehmen, ` +
    `AI-Projekte zu planen: Ist-Zustand verstehen, Ziel-Zustand definieren, Lücken (Gap-Analyse) ` +
    `identifizieren und passende Tools/Technologien empfehlen. Antworte auf Deutsch, klar, ` +
    `strukturiert und praxisnah. Stelle gezielte Rückfragen, bevor du Empfehlungen gibst. Formatiere ` +
    `längere Antworten mit Markdown (Überschriften mit #/##, Listen mit -, **fett** für Schlüsselbegriffe).` +
    CHOICES_INSTRUCTION +
    `\n\nDu trackst außerdem, wie viel Kontext du für ein vollständiges Transformation Concept ` +
    `(Ist-Zustand, Ziel-Zustand, Tooling-Empfehlungen, konkrete Maßnahmen) schon gesammelt hast. ` +
    `Füge am ENDE JEDER Antwort (nach dem CHOICES-Marker, falls vorhanden, in einer eigenen Zeile) ` +
    `genau einen Marker hinzu: [[PROGRESS: NN]] — NN ist eine Schätzung 0-100 in 5er-Schritten, wie ` +
    `bereit du bist, ein vollständiges Transformation Concept zu erstellen (0 = gerade erst gestartet, ` +
    `100 = alle wichtigen Infos vorhanden). Erhöhe den Wert erst, wenn der Nutzer tatsächlich neue ` +
    `relevante Informationen geliefert hat. Bei 100 sag explizit, dass du bereit bist, das ` +
    `Transformation Concept zu erstellen, sobald der Nutzer das möchte. Wenn der Nutzer dich bittet, ` +
    `das Transformation Concept zu erstellen, generiere ein vollständiges strukturiertes Dokument ` +
    `(Ist-Zustand, Ziel-Zustand, Gap-Analyse, empfohlene Tools mit Pro/Contra, priorisierte Maßnahmen) ` +
    `basierend auf dem gesamten bisherigen Gespräch.`,
  coach: (name) =>
    `Du bist ${name}, ein Change-Management- und IT-Coach. Du begleitest Menschen durch ` +
    `Veränderungsprozesse rund um AI/IT-Transformationen — Widerstände, Team-Dynamik, ` +
    `Kommunikation. Antworte auf Deutsch, empathisch und coachend: stelle mehr Fragen, als du ` +
    `Antworten vorgibst, und hilf der Person, ihre eigene nächste Handlung zu finden.` +
    CHOICES_INSTRUCTION,
};

interface ChatBody {
  agentType: AgentType;
  agentName: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY ist nicht konfiguriert." }, { status: 500 });
  }

  const body = (await req.json()) as ChatBody;
  if (!body?.messages?.length || !body.agentType) {
    return NextResponse.json({ error: "messages und agentType sind erforderlich." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPTS[body.agentType](body.agentName || "dein Agent"),
      messages: body.messages.map(m => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { text: string }).text)
      .join("\n")
      .trim();

    return NextResponse.json({ content: text || "…" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler bei der Anfrage an Claude.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
