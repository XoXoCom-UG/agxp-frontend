import {
  knowledgeCheck, SEC_LEVEL, SEC_LEXICON, SEC_SUMMARY, SEC_NEXT_STEPS, glanceSection, promptsFor,
  type Deliverable,
} from "./deliverable-parts.ts";
import * as M from "./method-library.ts";

/* ---------------------------------------------------------------------------
   THE SIX CONSULTANT TYPES THAT ARE BUILT ENTIRELY FROM THE METHOD SHEET

   "AgxP – Method Groups per Consultant" (Ana, 2026-10-23) lists nine consultant
   types and, for each, every method it runs with the trigger that decides
   whether it applies. The Strategy Consultant, Solution Architect and Change
   Manager predate it and live in lib/deliverables.ts, where the sheet's
   methods were added to what they already had. These six are new, so their
   documents are the sheet and nothing else:

     - the stations are the questions the sheet's methods need answered, in the
       order an interview wants them (what the user wants, then the details),
     - the sections are the methods' outputs, in the sheet's order and with the
       sheet's columns,
     - a method with a trigger ("only if …") is skipped in one sentence when the
       trigger does not apply, never invented.

   Knowledge Check, Lexicon and At a Glance open every type, Next Steps closes
   it; those are shared (lib/deliverable-parts.ts).
   --------------------------------------------------------------------------- */

/* --- Business Analyst: the Requirements Specification ---------------------- */

const asIs = M.asIsToBe();
const painPoints = M.painPointHeatmap();
const impactBa = M.impactMapping("das Geschäftsziel vage ist oder mehrere Akteurstypen betroffen sind");
const gap = M.gapAnalysis();
const reqs = M.requirements();
const edge = M.edgeCaseHunt();
const processMap = M.processMapping();
const dataMap = M.dataMapping();
const dod = M.definitionOfDone();
const smart = M.smartGoals(true);
const riskBa = M.riskRegister(
  "Anforderungen, Prozess und Daten",
  "Anforderungen, die niemand testen kann; Daten aus Altsystemen, die es nicht gibt; unklare Verantwortliche; " +
    "Randfälle ohne festgelegtes Verhalten; ein Scope, der größer ist als Zeit und Team",
);

const BUSINESS_ANALYST: Deliverable = {
  title: "Requirements Specification",
  subtitle: "What has to be built and why: today against target, requirements, edge cases and success criteria.",
  stations: [
    knowledgeCheck(
      "Business-Analyse und Anforderungen",
      "User Story, MoSCoW, Akzeptanzkriterien, As-Is/To-Be",
      "wie groß das Team ist und wie viel Zeit es gibt (allein / 2-5 Personen / mehr)",
    ),
    { label: "Starting point", note: "What this is about, and why now.", goal: "Worum geht es? Branche, Unternehmensgröße, Anlass, wer fragt an und warum jetzt. Daraus entstehen der Anwendungsfall in EINEM Satz, das Kernproblem, die Beschreibung, das benötigte Wissen und die Eckdaten (Personen, Zeit, Budget). Frag dabei auch, wie viele Personen im Team arbeiten und wie viele Rollen am Ablauf beteiligt sind — davon hängt ab, welche der folgenden Methoden gebraucht werden." },
    asIs.station,
    painPoints.station,
    impactBa.station,
    gap.station,
    reqs.station,
    edge.station,
    processMap.station,
    dataMap.station,
    dod.station,
    smart.station,
    riskBa.station,
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Anwendungsfall in einem Satz", "Benötigtes Wissen"),
    asIs.section,
    gap.section,
    reqs.section,
    impactBa.section,
    processMap.section,
    painPoints.section,
    dataMap.section,
    edge.section,
    dod.section,
    smart.section,
    riskBa.section,
    SEC_NEXT_STEPS,
  ],
  ...promptsFor("Requirements Specification", "requirements, roles and numbers"),
};

/* --- Digital Transformation Mgr: the Transformation Roadmap ---------------- */

const maturity = M.capabilityMaturity();
const useCases = M.prioritizeUseCases();
const roadmap = M.roadmap();
const governanceDtm = M.governanceModel("mehr als ein KI-Projekt parallel läuft oder die Branche reguliert ist");
const stakeholdersDtm = M.stakeholderMap("mehr als 3 Abteilungen betroffen sind oder Widerstand zu erwarten ist");
const canvas = M.aiUseCaseCanvas();
const pulse = M.pulseCheck();
const preMortem = M.preMortem();
const okrs = M.okrs();
const riskDtm = M.riskRegister(
  "Transformation und Organisation",
  "ein niedriger Reifegrad; fehlender Rückhalt im Management; Use Cases ohne brauchbare Daten; Widerstand " +
    "einzelner Abteilungen; mehrere KI-Projekte ohne Regeln",
);

const TRANSFORMATION: Deliverable = {
  title: "Transformation Roadmap",
  subtitle: "Where the organisation stands, which AI use cases come first, and the roadmap to embed them.",
  stations: [
    knowledgeCheck(
      "digitale Transformation und KI im Unternehmen",
      "Reifegrad, Use Case, Governance, OKR",
      "wie groß die Organisation ist und wie viele Abteilungen betroffen sind (eine / 2-3 / mehr)",
    ),
    { label: "Starting point", note: "What this is about, and how far it reaches.", goal: "Worum geht es? Branche, Unternehmensgröße, Anlass, wer fragt an und warum jetzt. Daraus entstehen Kernproblem, Beschreibung, benötigtes Wissen, Eckdaten — und der TRANSFORMATIONSUMFANG: ein Projekt, eine Abteilung oder das ganze Unternehmen. Frag auch, wie viele KI-Projekte parallel laufen oder geplant sind, ob die Branche reguliert ist, wie viele Abteilungen betroffen sind und ob Widerstand zu erwarten ist — davon hängt ab, welche der folgenden Methoden gebraucht werden." },
    maturity.station,
    useCases.station,
    canvas.station,
    stakeholdersDtm.station,
    governanceDtm.station,
    roadmap.station,
    pulse.station,
    preMortem.station,
    okrs.station,
    riskDtm.station,
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Transformationsumfang (ein Projekt / eine Abteilung / unternehmensweit)", "Benötigtes Wissen"),
    maturity.section,
    useCases.section,
    roadmap.section,
    governanceDtm.section,
    stakeholdersDtm.section,
    canvas.section,
    pulse.section,
    preMortem.section,
    okrs.section,
    riskDtm.section,
    SEC_NEXT_STEPS,
  ],
  ...promptsFor("Transformation Roadmap", "use cases, phases and owners"),
};

/* --- Data Scientist: the Data Science Plan --------------------------------- */

const framing = M.problemFraming();
const readiness = M.dataReadiness();
const options = M.modelOptions();
const rca = M.rootCause();
const labels = M.labelAudit();
const hitl = M.humanInTheLoop();
const card = M.modelCard();
const metrics = M.evaluationMetrics();
const poc = M.pocPlan();
const riskDs = M.riskRegister(
  "Daten und Modell",
  "fehlende oder schlechte Labels; kein Zugang zu den Daten; ein Modell unter dem Zielwert; Drift im Betrieb; " +
    "Verzerrung (Bias); fehlende menschliche Kontrolle",
);

const DATA_SCIENTIST: Deliverable = {
  title: "Data Science Plan",
  subtitle: "From business question to proof of concept: the task, the data, the options and the threshold for a yes.",
  stations: [
    knowledgeCheck(
      "Data Science und maschinelles Lernen",
      "Klassifikation, Trainings- und Testdaten, Precision und Recall, Overfitting",
      "wie viele Daten vorhanden sind (noch keine / Tausende Datensätze / Millionen)",
    ),
    { label: "Starting point", note: "The question behind the project, and where it stands.", goal: "Worum geht es? Branche, Anlass, wer fragt an und warum jetzt; Stand (Idee, PoC, Modell läuft bereits). Daraus entstehen Kernproblem, Beschreibung, benötigtes Wissen, Eckdaten und der ML-AUFGABENTYP (Klassifikation, Regression, Ranking, Prognose, Clustering — du schlägst ihn vor, der Nutzer bestätigt). Frag auch, ob schon ein Modell existiert, ob gelabelte Daten vorliegen und ob das Ergebnis Menschen oder Geld betrifft — davon hängt ab, welche der folgenden Methoden gebraucht werden." },
    framing.station,
    readiness.station,
    labels.station,
    options.station,
    hitl.station,
    rca.station,
    metrics.station,
    poc.station,
    card.station,
    riskDs.station,
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("ML-Aufgabentyp", "Benötigtes Wissen"),
    framing.section,
    readiness.section,
    options.section,
    rca.section,
    labels.section,
    hitl.section,
    card.section,
    metrics.section,
    poc.section,
    riskDs.section,
    SEC_NEXT_STEPS,
  ],
  ...promptsFor("Data Science Plan", "data sources, metrics and thresholds"),
};

/* --- Product Manager: the Product Brief ------------------------------------ */

const headlinePm = M.futureHeadline("OKRs");
const personas = M.personas();
const impactPm = M.impactMapping();
const mvp = M.mvpScope();
const journey = M.userJourney();
const abTest = M.abTestPlan();
const jtbd = M.jobsToBeDone();
const killList = M.featureKillList();
const fakeDoor = M.fakeDoorTest();
const retention = M.retentionHookMap();
const okrsPm = M.okrs();
const assumptions = M.assumptionTests();

const PRODUCT: Deliverable = {
  title: "Product Brief",
  subtitle: "Who the product is for, what the first release contains, and which assumptions to test first.",
  stations: [
    knowledgeCheck(
      "Produktmanagement",
      "Persona, MVP, A/B-Test, Retention",
      "ob das Produkt schon Nutzer hat (noch keine / einige / mehrere hundert)",
    ),
    headlinePm.station,
    { label: "Starting point", note: "What this is about, and who it is for.", goal: "Worum geht es? Branche, Anlass, wer fragt an und warum jetzt. Daraus entstehen Kernproblem, Beschreibung, benötigtes Wissen, Eckdaten und der ZIELNUTZER in EINEM Satz. Frag auch, ob das Produkt für Endkunden gedacht ist (Consumer), ob es schon Live-Nutzer gibt (wie viele), wie viele Schritte der Kernablauf hat und ob ein teures Feature zur Wahl steht — davon hängt ab, welche der folgenden Methoden gebraucht werden." },
    personas.station,
    jtbd.station,
    impactPm.station,
    mvp.station,
    killList.station,
    journey.station,
    retention.station,
    fakeDoor.station,
    abTest.station,
    okrsPm.station,
    assumptions.station,
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Zielnutzer in einem Satz", "Benötigtes Wissen"),
    headlinePm.section,
    personas.section,
    impactPm.section,
    mvp.section,
    journey.section,
    abTest.section,
    jtbd.section,
    killList.section,
    fakeDoor.section,
    retention.section,
    okrsPm.section,
    assumptions.section,
    SEC_NEXT_STEPS,
  ],
  ...promptsFor("Product Brief", "personas, features and numbers"),
};

/* --- Enterprise Architect: the Enterprise Architecture Plan ---------------- */

const landscape = M.itLandscape();
const integration = M.integrationBlueprint();
const governanceEa = M.governanceModel();
const compliance = M.complianceCheck();
const register = M.aiModelRegister();
const shadow = M.shadowAiScan();
const lineage = M.dataLineage();
const impactEa = M.changeImpact();
const riskEa = M.riskRegister(
  "IT-Landschaft und Compliance",
  "Legacy-Systeme ohne Schnittstelle; ein Integrationsaufwand, der unterschätzt wurde; Compliance-Lücken; " +
    "Schatten-KI; Daten, deren Herkunft niemand belegen kann; Auswirkungen auf Rollen, die niemand besprochen hat",
);

const ENTERPRISE: Deliverable = {
  title: "Enterprise Architecture Plan",
  subtitle: "The IT landscape the AI use case touches: systems, integrations, rules, compliance and impact.",
  stations: [
    knowledgeCheck(
      "Unternehmensarchitektur und IT-Landschaft",
      "Legacy-System, Schnittstelle, Governance, Data Lineage",
      "wie viele Mitarbeitende die Organisation hat (unter 50 / 50-500 / mehr)",
    ),
    { label: "Starting point", note: "The use case, and which systems it touches.", goal: "Worum geht es? Branche, Anlass, wer fragt an und warum jetzt. Daraus entstehen Kernproblem, Beschreibung, benötigtes Wissen, Eckdaten und die BETROFFENEN SYSTEME (Anzahl und Namen). Frag auch, ob personenbezogene Daten verarbeitet werden, ob die Branche reguliert ist oder eine Prüfung ansteht, wie viele KI-Tools oder Modelle schon im Einsatz sind und wie viele Mitarbeitende die Organisation hat — davon hängt ab, welche der folgenden Methoden gebraucht werden." },
    landscape.station,
    integration.station,
    governanceEa.station,
    compliance.station,
    register.station,
    shadow.station,
    lineage.station,
    impactEa.station,
    riskEa.station,
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Betroffene Systeme (Anzahl und Namen)", "Benötigtes Wissen"),
    landscape.section,
    integration.section,
    governanceEa.section,
    compliance.section,
    register.section,
    shadow.section,
    lineage.section,
    impactEa.section,
    riskEa.section,
    SEC_NEXT_STEPS,
  ],
  ...promptsFor("Enterprise Architecture Plan", "systems, interfaces and owners"),
};

/* --- Startup CTO: the Startup Tech Plan ------------------------------------ */

const lean = M.leanCanvas();
const loop = M.mvpCoreLoop();
const stack = M.leanTechStack();
const team = M.teamSetup();
const pivot = M.pivotTriggers();
const shipLog = M.weeklyShipLog();
const hiring = M.hiringScorecard();
const preMortemCto = M.preMortem();
const bml = M.buildMeasureLearn();
const debt = M.techDebtLog();

const STARTUP_CTO: Deliverable = {
  title: "Startup Tech Plan",
  subtitle: "The leanest way to a first user: the model, the core loop, the stack, the team and the signals to pivot.",
  stations: [
    knowledgeCheck(
      "Produktentwicklung im Startup",
      "MVP, Pivot, Tech Debt, Build-Measure-Learn",
      "wie viel Zeit und Geld bis zum ersten Nutzer da sind (Wochen oder Monate; 0 € / etwas / mehr)",
    ),
    { label: "Starting point", note: "The idea, and the date of the first user.", goal: "Worum geht es? Idee, Anlass, wer baut und warum jetzt. Daraus entstehen Kernproblem, Beschreibung, benötigtes Wissen, Eckdaten und die ZEIT BIS ZUM ERSTEN NUTZER (Zieldatum). Frag auch, wie viele Personen im Team sind oder noch dazukommen sollen, ob Einstellungen geplant sind, ob die Bauphase schon läuft und ob Budget zugesagt oder ein Start beschlossen werden soll — davon hängt ab, welche der folgenden Methoden gebraucht werden." },
    lean.station,
    loop.station,
    stack.station,
    team.station,
    pivot.station,
    hiring.station,
    preMortemCto.station,
    bml.station,
    shipLog.station,
    debt.station,
  ],
  sections: [
    SEC_LEVEL,
    SEC_LEXICON,
    SEC_SUMMARY,
    glanceSection("Zeit bis zum ersten Nutzer (Zieldatum)", "Benötigtes Wissen"),
    lean.section,
    loop.section,
    stack.section,
    team.section,
    pivot.section,
    shipLog.section,
    hiring.section,
    preMortemCto.section,
    bml.section,
    debt.section,
    SEC_NEXT_STEPS,
  ],
  ...promptsFor("Startup Tech Plan", "weeks, numbers and decisions"),
};

/** The six types the method sheet added, by TYPE_CATALOG id (lib/agent-types.ts). */
export const SHEET_DELIVERABLES: Record<string, Deliverable> = {
  "business-analyst": BUSINESS_ANALYST,
  transformation: TRANSFORMATION,
  "data-scientist": DATA_SCIENTIST,
  product: PRODUCT,
  enterprise: ENTERPRISE,
  "startup-cto": STARTUP_CTO,
};
