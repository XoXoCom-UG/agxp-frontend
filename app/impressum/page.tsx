import type { Metadata } from "next";
import { LegalShell, LegalSection, TodoNotice } from "@/components/layout/legal";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <LegalShell title="Impressum">
      <TodoNotice>
        Platzhalter — bitte vor dem Launch mit euren echten Angaben ausfüllen und
        rechtlich prüfen lassen. Pflichtangaben nach § 5 DDG / § 18 Abs. 2 MStV.
      </TodoNotice>

      <LegalSection heading="Angaben gemäß § 5 DDG">
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

      {/* The EU's online dispute resolution (ODR) platform was shut down in July
          2025, so the old pointer to it is gone; the VSBG statement stays. */}
      <LegalSection heading="Verbraucherstreitbeilegung">
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
