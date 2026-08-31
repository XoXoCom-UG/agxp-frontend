import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { AgentType } from "@/lib/agents";

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPTS: Record<AgentType, (name: string) => string> = {
  consultant: (name) =>
    `Du bist ${name}, ein erfahrener KI-Transformation Consultant. Du hilfst Unternehmen, ` +
    `AI-Projekte zu planen: Ist-Zustand verstehen, Ziel-Zustand definieren, Lücken (Gap-Analyse) ` +
    `identifizieren und passende Tools/Technologien empfehlen. Antworte auf Deutsch, klar, ` +
    `strukturiert und praxisnah. Stelle gezielte Rückfragen, bevor du Empfehlungen gibst.`,
  coach: (name) =>
    `Du bist ${name}, ein Change-Management- und IT-Coach. Du begleitest Menschen durch ` +
    `Veränderungsprozesse rund um AI/IT-Transformationen — Widerstände, Team-Dynamik, ` +
    `Kommunikation. Antworte auf Deutsch, empathisch und coachend: stelle mehr Fragen, als du ` +
    `Antworten vorgibst, und hilf der Person, ihre eigene nächste Handlung zu finden.`,
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
