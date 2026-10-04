/**
 * company.ts — the facts the three legal pages need, in one place.
 *
 * Every field here is a legal requirement somewhere: § 5 DDG wants the name,
 * address, representation, contact and register entry; § 27a UStG the VAT ID;
 * § 18 Abs. 2 MStV a person responsible for the content; the DSGVO a
 * controller and an address for data-subject requests.
 *
 * They are empty on purpose and must be filled by someone who knows them —
 * not inferred from a domain or a GitHub organisation. A wrong Impressum is a
 * worse position than a missing one, because it looks deliberate.
 *
 * Nothing here is secret: an Impressum is published by definition. It lives in
 * code rather than in an environment variable so that it is reviewable in a
 * diff and identical on every deployment.
 */

export interface Company {
  /** Legal entity, exactly as registered — e.g. "Muster GmbH", not "Muster". */
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  /** Managing director(s) / authorised representative(s). */
  representedBy: string;
  email: string;
  phone: string;
  /** e.g. "Amtsgericht München". Empty if the entity is not registered. */
  registerCourt: string;
  /** e.g. "HRB 123456". */
  registerNumber: string;
  /** § 27a UStG, e.g. "DE123456789". */
  vatId: string;
  /** § 18 Abs. 2 MStV — a natural person, with an address. */
  contentResponsible: string;
  /** Where data-subject requests go. Often the same as `email`. */
  privacyEmail: string;
}

export const COMPANY: Company = {
  name: "",
  street: "",
  postalCode: "",
  city: "",
  country: "Deutschland",
  representedBy: "",
  email: "",
  phone: "",
  registerCourt: "",
  registerNumber: "",
  vatId: "",
  contentResponsible: "",
  privacyEmail: "",
};

/**
 * Fields that may legitimately stay empty: a sole trader has no register
 * entry, a small business under § 19 UStG has no VAT ID, and a phone number
 * is not strictly required when another "unmittelbare" channel exists. Every
 * other field is mandatory for a public commercial site in Germany.
 */
const OPTIONAL: (keyof Company)[] = ["registerCourt", "registerNumber", "vatId", "phone"];

/** The required fields that are still blank, in page order. */
export function missingCompanyFields(): (keyof Company)[] {
  return (Object.keys(COMPANY) as (keyof Company)[])
    .filter(k => !OPTIONAL.includes(k) && !COMPANY[k].trim());
}

export function companyComplete(): boolean {
  return missingCompanyFields().length === 0;
}

/** The postal address as the Impressum prints it, or "" while incomplete. */
export function postalAddress(): string {
  const { street, postalCode, city, country } = COMPANY;
  if (!street || !postalCode || !city) return "";
  return [street, `${postalCode} ${city}`, country].filter(Boolean).join(", ");
}
