import type { Metadata } from "next";
import { LegalShell, LegalSection, TodoNotice } from "@/components/layout/legal";

export const metadata: Metadata = { title: "AGB" };

export default function AGBPage() {
  return (
    <LegalShell title="Allgemeine Geschäftsbedingungen">
      <TodoNotice>
        Vorlage — vor dem Launch mit euren tatsächlichen Konditionen ausfüllen und
        rechtlich prüfen lassen (besonders bei kostenpflichtigen Plänen).
      </TodoNotice>

      <LegalSection heading="1. Geltungsbereich">
        <p>Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform matfit.ai
          („Dienst") durch registrierte Nutzer:innen.</p>
      </LegalSection>

      <LegalSection heading="2. Leistungsbeschreibung">
        <p>matfit.ai ist ein KI-gestützter IT-Beratungsassistent, der auf Basis der Eingaben der
          Nutzer:innen Konzepte, Roadmaps und Empfehlungen erstellt. Die Ergebnisse sind
          Vorschläge und ersetzen keine individuelle fachliche oder rechtliche Beratung.</p>
      </LegalSection>

      <LegalSection heading="3. Registrierung und Konto">
        <p>Für die Nutzung ist ein Konto erforderlich. Die Zugangsdaten sind vertraulich zu behandeln.</p>
      </LegalSection>

      <LegalSection heading="4. Preise und Zahlung">
        <p>[Sofern kostenpflichtig: Preise, Abrechnungszeitraum, Zahlungsmittel und Kündigung hier ergänzen.]</p>
      </LegalSection>

      <LegalSection heading="5. Pflichten der Nutzer:innen">
        <p>Der Dienst darf nicht missbräuchlich, rechtswidrig oder in einer Weise genutzt werden,
          die den Betrieb beeinträchtigt.</p>
      </LegalSection>

      <LegalSection heading="6. Haftung">
        <p>Die Nutzung der KI-Ergebnisse erfolgt auf eigene Verantwortung. Für die Richtigkeit,
          Vollständigkeit und Eignung der generierten Inhalte wird keine Gewähr übernommen.
          [Haftungsregelungen präzisieren.]</p>
      </LegalSection>

      <LegalSection heading="7. Laufzeit und Kündigung">
        <p>[Regelungen zu Laufzeit und Kündigung ergänzen.]</p>
      </LegalSection>

      <LegalSection heading="8. Schlussbestimmungen">
        <p>Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen unwirksam
          sein, bleibt die Wirksamkeit der übrigen unberührt.</p>
      </LegalSection>
    </LegalShell>
  );
}
