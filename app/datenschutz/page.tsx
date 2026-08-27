import type { Metadata } from "next";
import { LegalShell, LegalSection, TodoNotice } from "@/components/layout/legal";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

export default function DatenschutzPage() {
  return (
    <LegalShell title="Datenschutzerklärung">
      <TodoNotice>
        Vorlage — die konkreten Angaben (Verantwortlicher, Dienstleister, Speicherfristen)
        müssen ergänzt und vor dem Launch rechtlich geprüft werden. Diese App verarbeitet
        personenbezogene Daten (Konto, Chat-Inhalte); eine DSGVO-konforme, geprüfte
        Erklärung ist Pflicht.
      </TodoNotice>

      <LegalSection heading="1. Verantwortlicher">
        <p>Verantwortlich für die Datenverarbeitung auf dieser Plattform ist:</p>
        <p>[Firmenname], [Anschrift], [E-Mail]. Siehe auch Impressum.</p>
      </LegalSection>

      <LegalSection heading="2. Welche Daten wir verarbeiten">
        <p>• Kontodaten: E-Mail-Adresse und Anzeigename (bei Registrierung/Login).</p>
        <p>• Nutzungsinhalte: deine Chat-Nachrichten, Projekte, Transformation Concepts und Roadmaps.</p>
        <p>• Technische Daten: für Betrieb und Sicherheit notwendige Log-/Verbindungsdaten.</p>
      </LegalSection>

      <LegalSection heading="3. Zwecke und Rechtsgrundlagen">
        <p>Wir verarbeiten diese Daten, um den Dienst bereitzustellen (Art. 6 Abs. 1 lit. b DSGVO – Vertrag)
          sowie zur Gewährleistung von Sicherheit und Betrieb (Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse).</p>
      </LegalSection>

      <LegalSection heading="4. Auftragsverarbeiter / Drittanbieter">
        <p>Zur Erbringung des Dienstes setzen wir Dienstleister ein, u. a.:</p>
        <p>• Hosting/Frontend: Vercel Inc.</p>
        <p>• Authentifizierung &amp; Datenbank: Supabase.</p>
        <p>• Backend-Ausführung: Modal.</p>
        <p>• KI-Verarbeitung: Anthropic (Claude) zur Erzeugung der Antworten/Artefakte.</p>
        <p>[Mit diesen Anbietern sind Auftragsverarbeitungsverträge (AVV) abzuschließen; Angaben ergänzen.]</p>
      </LegalSection>

      <LegalSection heading="5. Speicherdauer">
        <p>Wir speichern deine Daten, solange dein Konto besteht bzw. solange es für die genannten Zwecke
          erforderlich ist. [Konkrete Fristen ergänzen.]</p>
      </LegalSection>

      <LegalSection heading="6. Deine Rechte">
        <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie ein Beschwerderecht bei einer
          Aufsichtsbehörde. Anfragen richte bitte an [E-Mail].</p>
      </LegalSection>

      <LegalSection heading="7. Cookies / lokale Speicherung">
        <p>Wir verwenden nur technisch notwendige Cookies bzw. lokale Speicherung (z. B. für Login-Sitzung
          und Einstellungen). Es findet kein Tracking zu Werbezwecken statt. [Falls Analyse-/Monitoring-Tools
          mit Personenbezug genutzt werden, hier ergänzen und ggf. Einwilligung einholen.]</p>
      </LegalSection>

      <LegalSection heading="8. Kontakt zum Datenschutz">
        <p>Bei Fragen zum Datenschutz: [E-Mail / ggf. Datenschutzbeauftragte:r].</p>
      </LegalSection>
    </LegalShell>
  );
}
