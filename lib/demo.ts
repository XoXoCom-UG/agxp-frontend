/**
 * demo.ts — the bundled example the onboarding tour shows, so a new user sees
 * a fully populated Concept + Roadmap instantly, with no API call and no wait.
 * Purely frontend, clearly labelled "Beispiel", ephemeral (only while the tour
 * runs). Nothing here is persisted.
 */
import { Message, ConceptData, RoadmapData } from "@/lib/api";

export const DEMO_TITLE = "Beispiel: Cloud-Migration eines IT-Teams";

export const DEMO_MESSAGES: Message[] = [
  { role: "user", content: "Wir wollen unsere Alt-Systeme in die Cloud migrieren, wissen aber nicht, wo wir anfangen sollen." },
  { role: "assistant", content: "**Strategische Einordnung**\n\n- Klassischer Lift-and-Shift ist selten der beste erste Schritt\n- Wichtiger ist zuerst Transparenz über Abhängigkeiten und Kosten\n- Ein sicheres Fundament (Identität, Netzwerk) muss vor der Migration stehen\n\n**Empfehlung**\n\n- Startet mit einer Bestandsaufnahme und einem Pilot-Workload\n- Danach schrittweise Migration nach Business-Priorität\n\nÖffne das Transformation Concept für die strukturierte Ist/Ziel-Übersicht.\n\n[[OPEN:concept]]" },
];

export const DEMO_CONCEPT: ConceptData = {
  title: "Cloud-Migration eines IT-Teams",
  now: {
    summary: "On-Premise-Alt-Systeme mit hohem Wartungsaufwand und unklaren Abhängigkeiten.",
    pain_points: [
      "Hohe Betriebskosten für eigene Server",
      "Lange Bereitstellungszeiten für neue Umgebungen",
      "Fehlende Skalierbarkeit bei Lastspitzen",
      "Unklare Abhängigkeiten zwischen Alt-Systemen",
    ],
  },
  goal: {
    summary: "Skalierbare, sichere Cloud-Umgebung mit automatisierter Bereitstellung.",
    outcomes: [
      "Infrastruktur on-demand statt fester Server",
      "Automatisierte, wiederholbare Deployments",
      "Kosten transparent und nutzungsbasiert",
    ],
    table: [
      { ziel: "Skalierbare Infrastruktur", tooling: "AWS (primär), Azure (sekundär)", alternativen: ["Google Cloud", "Hetzner (EU)"] },
      { ziel: "Automatisierte Bereitstellung", tooling: "Terraform + GitHub Actions", alternativen: ["Pulumi", "Azure DevOps"] },
      { ziel: "Sicherheit & Identität", tooling: "Zero Trust + SSO (Entra ID)", alternativen: ["Okta", "Keycloak (self-hosted)"] },
    ],
  },
  transformation_steps: [
    { title: "Bestandsaufnahme & Abhängigkeiten", description: "Alle Systeme, Datenflüsse und Abhängigkeiten erfassen.", effort: "M", business_value: "Grundlage für risikoarme Migration" },
    { title: "Pilot-Workload migrieren", description: "Einen unkritischen Service in die Cloud bringen und Erfahrungen sammeln.", effort: "M", business_value: "Schneller Lerneffekt, geringes Risiko" },
    { title: "Schrittweise Migration", description: "Weitere Workloads nach Business-Priorität migrieren.", effort: "L", business_value: "Kontinuierlicher Kostenvorteil" },
  ],
  user_stories: [
    { title: "Automatische Umgebung", size: "M", story: "Als Entwickler möchte ich eine neue Testumgebung per Klick, um schneller zu liefern.", acceptance_criteria: "Umgebung in < 10 Min. bereitgestellt" },
    { title: "Kostentransparenz", size: "S", story: "Als IT-Leitung möchte ich Kosten pro Projekt sehen, um Budgets zu steuern.", acceptance_criteria: "Kosten-Dashboard pro Team" },
  ],
  business_value_summary: {
    manual_effort: "von 3 Tagen auf unter 4 Stunden pro Bereitstellung",
    error_rate: "Fehldeployments von 30 % auf unter 8 %",
    cost_savings: "€6.500/Monat Einsparung durch nutzungsbasierte Infrastruktur — ca. €78.000 pro Jahr",
  },
};

export const DEMO_ROADMAP: RoadmapData = {
  title: "Cloud-Migration eines IT-Teams",
  overview: "Das Ziel ist eine skalierbare, sichere Cloud-Umgebung. Zuerst schaffen wir Transparenz und ein sicheres Fundament (Phase 1), dann migrieren wir schrittweise die Workloads (Phase 2). Jede Phase baut auf der vorherigen auf — ohne Bestandsaufnahme keine risikoarme Migration.",
  phases: [
    {
      name: "Grundlagen & Fundament",
      goal: "Transparenz schaffen und ein sicheres Fundament legen — Basis für alles Weitere.",
      steps: [
        { id: "s1", title: "Bestandsaufnahme der Systeme", what: "Alle Alt-Systeme und Abhängigkeiten dokumentieren.", why: "Verhindert böse Überraschungen bei der Migration.", effort: "M", depends_on: [],
          tools: [{ name: "AWS Application Discovery", why: "Erfasst Abhängigkeiten automatisch", pros: ["Automatisch", "Detailliert"], cons: ["AWS-nah"], verdict: "empfohlen" }] },
        { id: "s2", title: "Identität & Netzwerk aufsetzen", what: "SSO, Rollen und Netzwerksegmente einrichten.", why: "Sicherheit muss vor der Migration stehen.", effort: "M", depends_on: ["s1"],
          tools: [{ name: "Entra ID + Terraform", why: "Identität und Infrastruktur als Code", pros: ["Wiederholbar", "Auditierbar"], cons: ["Lernkurve"], verdict: "empfohlen" }] },
      ],
    },
    {
      name: "Migration & Betrieb",
      goal: "Aufbauend auf dem Fundament die Workloads schrittweise migrieren und stabil betreiben.",
      steps: [
        { id: "s3", title: "Pilot-Workload migrieren", what: "Einen unkritischen Service migrieren.", why: "Lerneffekt bei geringem Risiko.", effort: "M", depends_on: ["s2"],
          tools: [{ name: "GitHub Actions", why: "Automatisierte Deployments", pros: ["Einfach", "Weit verbreitet"], cons: ["Runner-Kosten"], verdict: "empfohlen" }] },
        { id: "s4", title: "Rest schrittweise migrieren", what: "Weitere Workloads nach Priorität.", why: "Kontinuierlicher Nutzen statt Big Bang.", effort: "L", depends_on: ["s3"],
          tools: [{ name: "Terraform", why: "Reproduzierbare Infrastruktur", pros: ["Multi-Cloud", "Community"], cons: ["State-Management"], verdict: "empfohlen" }] },
      ],
    },
  ],
};
