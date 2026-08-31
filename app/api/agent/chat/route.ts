import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { AgentType } from "@/lib/agents";

const MODEL = "claude-sonnet-5";

// Both roles can offer clickable quick-replies for a question with a short,
// predictable set of likely answers — the client parses this marker out of
// the text and renders it as chips instead of the raw "[[CHOICES: ...]]".
const CHOICES_INSTRUCTION =
  `\n\nWenn deine Antwort mit einer Frage endet, die typischerweise 2-4 kurze, klar ` +
  `unterscheidbare Antwortoptionen hat, füge ganz am Ende (in einer eigenen Zeile) genau einen ` +
  `Marker hinzu: [[CHOICES: Option A|Option B|Option C]] (2-4 kurze Optionen, durch | getrennt). ` +
  `Nutze das NICHT bei offenen Fragen ohne sinnvolle kurze Antwortoptionen. Der Marker erscheint ` +
  `nie im sichtbaren Text — er wird vom Frontend herausgefiltert und als Buttons dargestellt.`;

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
      max_tokens: 1024,
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
