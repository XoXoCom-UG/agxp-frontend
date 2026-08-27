import type { Metadata } from "next";
import { LegalShell, LegalSection, TodoNotice } from "@/components/layout/legal";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <LegalShell title="Impressum">
      <TodoNotice>
        Platzhalter — bitte vor dem Launch mit euren echten Angaben ausfüllen und
        rechtlich prüfen lassen. Pflichtangaben nach § 5 TMG / § 18 MStV.
      </TodoNotice>

      <LegalSection heading="Angaben gemäß § 5 TMG">
        <p>[Firmenname / Anbieter]</p>
        <p>[Straße und Hausnummer]</p>
        <p>[PLZ, Ort]</p>
        <p>[Land]</p>
      </LegalSection>

      <LegalSection heading="Vertreten durch">
        <p>[Name der vertretungsberechtigten Person(en) / Geschäftsführung]</p>
      </LegalSection>

      <LegalSection heading="Kontakt">
        <p>Telefon: [Telefonnummer]</p>
        <p>E-Mail: [E-Mail-Adresse]</p>
      </LegalSection>

      <LegalSection heading="Registereintrag">
        <p>Eintragung im Handelsregister.</p>
        <p>Registergericht: [z. B. Amtsgericht …]</p>
        <p>Registernummer: [HRB …]</p>
      </LegalSection>

      <LegalSection heading="Umsatzsteuer-ID">
        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: [DE …]</p>
      </LegalSection>

      <LegalSection heading="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>[Name]</p>
        <p>[Anschrift]</p>
      </LegalSection>

      <LegalSection heading="Streitschlichtung">
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
          {" "}<a href="https://ec.europa.eu/consumers/odr/" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>.
        </p>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
