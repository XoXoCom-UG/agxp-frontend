import type { Metadata } from "next";
import { LegalShell, LegalSection, TodoNotice, MissingDataNotice } from "@/components/layout/legal";
import { COMPANY } from "@/lib/company";
import { PLANS, INVITE_ONLY, type PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "AGB" };

/**
 * The service description is generated from lib/plans.ts rather than typed
 * out, for the same reason the UI is: terms that promise three projects while
 * the code enforces five are worse than no terms. Change a plan there and this
 * page follows.
 *
 * The clauses that create obligations — liability, term, cancellation,
 * payment — are deliberately NOT drafted here. They need a lawyer, and a
 * plausible-sounding paragraph would only make it easy to forget that.
 */
export default function AGBPage() {
  const order: PlanId[] = ["free", "mid", "max"];

  return (
    <LegalShell title="Allgemeine Geschäftsbedingungen">
      <MissingDataNotice />

      <TodoNotice>
        Die Abschnitte 1–3 und 5 beschreiben den tatsächlichen Stand des Dienstes und sind
        aus dem Code erzeugt. Die Abschnitte 6–9 (Haftung, Laufzeit, Kündigung, Preise) sind
        bewusst noch nicht ausformuliert — sie müssen von einer Anwältin oder einem Anwalt
        geschrieben werden, spätestens bevor der erste Plan Geld kostet.
      </TodoNotice>

      <LegalSection heading="1. Geltungsbereich">
        <p>Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform
          AgentiX Projects („Dienst“)
          {COMPANY.name ? ` der ${COMPANY.name}` : ""} durch registrierte Nutzer:innen.</p>
        {INVITE_ONLY && (
          <p>Der Dienst befindet sich derzeit in einer geschlossenen Testphase. Der Zugang
            ist nur mit einem Einladungscode möglich.</p>
        )}
      </LegalSection>

      <LegalSection heading="2. Leistungsbeschreibung">
        <p>AgentiX Projects ist ein KI-gestützter Beratungsassistent. Auf Grundlage deiner
          Eingaben führen zwei Agenten ein strukturiertes Interview und erstellen daraus zwei
          Dokumente: ein Transformation Concept und einen Change Plan.</p>
        <p>Die Ergebnisse werden von einem Sprachmodell erzeugt. Sie sind Vorschläge, können
          sachlich falsch sein und ersetzen keine individuelle fachliche, steuerliche oder
          rechtliche Beratung. Die Prüfung der Ergebnisse obliegt dir.</p>
      </LegalSection>

      <LegalSection heading="3. Pläne und Nutzungsgrenzen">
        <p>Der Dienst wird in drei Plänen angeboten. Es gelten die folgenden Grenzen je
          Abrechnungszeitraum:</p>
        <ul className="legal-list">
          {order.map(id => {
            const p = PLANS[id];
            const period = p.period === "week" ? "pro Woche" : "pro Monat";
            const projects = p.projects >= Number.MAX_SAFE_INTEGER
              ? "unbegrenzt viele Projekte"
              : `${p.projects} Projekte`;
            const stations = p.stations === null
              ? "das vollständige Interview"
              : `${p.stations} Interviewschritte`;
            const agents = p.agentSlots === null
              ? "alle Agenten" : `${p.agentSlots} Agenten`;
            return (
              <li key={id}>
                <b>{p.label}</b>: {projects} {period}, {stations}, {agents}
                {p.createAgents ? ", eigene Agenten" : ""}.
              </li>
            );
          })}
        </ul>
        <p>Zusätzlich besteht je Plan eine technische Obergrenze für die verarbeitete
          Datenmenge, die vor missbräuchlicher oder versehentlich extremer Nutzung schützt.
          Sie ist so bemessen, dass sie bei üblicher Nutzung nicht erreicht wird.</p>
      </LegalSection>

      <LegalSection heading="4. Registrierung und Konto">
        <p>Für die Nutzung ist ein Konto erforderlich. Die Zugangsdaten sind vertraulich zu
          behandeln und nicht an Dritte weiterzugeben.</p>
      </LegalSection>

      <LegalSection heading="5. Pflichten der Nutzer:innen">
        <p>Der Dienst darf nicht missbräuchlich, rechtswidrig oder in einer Weise genutzt
          werden, die den Betrieb beeinträchtigt. Du bist dafür verantwortlich, welche Daten
          du eingibst; gib keine personenbezogenen Daten Dritter ein, für deren Verarbeitung
          du keine Grundlage hast.</p>
      </LegalSection>

      <LegalSection heading="6. Preise und Zahlung">
        <p>Derzeit ist keine Zahlungsabwicklung eingerichtet; die Nutzung ist im Rahmen der
          Testphase unentgeltlich. Vor der Einführung kostenpflichtiger Pläne werden hier
          Preise, Abrechnungszeitraum, Zahlungsmittel und Kündigung geregelt.</p>
      </LegalSection>

      <LegalSection heading="7. Verfügbarkeit">
        <p>Der Dienst befindet sich in der Entwicklung. Eine bestimmte Verfügbarkeit wird
          nicht zugesichert; Unterbrechungen für Wartung und Änderungen sind möglich.</p>
      </LegalSection>

      <LegalSection heading="8. Haftung">
        <p>Die Nutzung der KI-Ergebnisse erfolgt auf eigene Verantwortung. Für die
          Richtigkeit, Vollständigkeit und Eignung der generierten Inhalte wird keine Gewähr
          übernommen.</p>
      </LegalSection>

      <LegalSection heading="9. Laufzeit und Kündigung">
        <p>Du kannst dein Konto jederzeit beenden. Die weiteren Regelungen zu Laufzeit und
          Kündigung werden mit der Einführung kostenpflichtiger Pläne ergänzt.</p>
      </LegalSection>

      <LegalSection heading="10. Schlussbestimmungen">
        <p>Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen
          unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.</p>
      </LegalSection>
    </LegalShell>
  );
}
