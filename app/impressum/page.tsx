import type { Metadata } from "next";
import { LegalShell, LegalSection, MissingDataNotice, Fact } from "@/components/layout/legal";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Impressum" };

/**
 * Pflichtangaben nach § 5 DDG / § 18 Abs. 2 MStV.
 *
 * Every fact comes from lib/company.ts; nothing is written twice. While that
 * file is blank the page says so out loud, in production as well — see
 * MissingDataNotice.
 */
export default function ImpressumPage() {
  const { registerCourt, registerNumber, vatId, phone } = COMPANY;

  return (
    <LegalShell title="Impressum">
      <MissingDataNotice />

      <LegalSection heading="Angaben gemäß § 5 DDG">
        <Fact field="name" />
        <Fact field="street" />
        <p>
          {COMPANY.postalCode || COMPANY.city
            ? `${COMPANY.postalCode} ${COMPANY.city}`.trim()
            : <span className="legal-gap">— noch nicht eingetragen —</span>}
        </p>
        <Fact field="country" />
      </LegalSection>

      <LegalSection heading="Vertreten durch">
        <Fact field="representedBy" />
      </LegalSection>

      <LegalSection heading="Kontakt">
        {phone && <p>Telefon: {phone}</p>}
        <Fact field="email" prefix="E-Mail" />
      </LegalSection>

      {/* Only shown once there is an entry. A sole trader has none, and an
          empty "Registernummer:" line would suggest one is missing. */}
      {(registerCourt || registerNumber) && (
        <LegalSection heading="Registereintrag">
          <p>Eintragung im Handelsregister.</p>
          {registerCourt && <p>Registergericht: {registerCourt}</p>}
          {registerNumber && <p>Registernummer: {registerNumber}</p>}
        </LegalSection>
      )}

      {vatId && (
        <LegalSection heading="Umsatzsteuer-ID">
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: {vatId}</p>
        </LegalSection>
      )}

      <LegalSection heading="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <Fact field="contentResponsible" />
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
