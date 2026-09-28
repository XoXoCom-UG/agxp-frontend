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
        Erklärung ist Pflicht. Neu und besonders zu prüfen: Abschnitt 5 (Anmeldung mit
        Google) und Abschnitt 6 (Fehlerüberwachung mit Sentry, inkl. Session Replay —
        klären, ob dafür eine Einwilligung nach § 25 TDDDG nötig ist), außerdem die
        Drittlandübermittlungen in Abschnitt 4. Hinweis: Sentry ist im Code konfiguriert
        (sentry.*.config.ts, nur im Live-Betrieb), wird aber derzeit noch nicht geladen —
        Abschnitt 6 beschreibt den Zustand nach der Aktivierung.
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
        <p>• KI-Verarbeitung: Anthropic (Claude) zur Erzeugung der Antworten/Artefakte.</p>
        <p>• Fehlerüberwachung: Sentry (Functional Software, Inc.), siehe Abschnitt 6.</p>
        <p>[Mit diesen Anbietern sind Auftragsverarbeitungsverträge (AVV) abzuschließen; Angaben ergänzen.]</p>
        <p>[Angaben zur Übermittlung in Drittländer (z. B. USA) und zur jeweiligen Grundlage
          (z. B. EU-U.S. Data Privacy Framework, Standardvertragsklauseln) ergänzen.]</p>
      </LegalSection>

      <LegalSection heading="5. Anmeldung mit Google">
        <p>Du kannst dich statt mit E-Mail und Passwort auch mit deinem Google-Konto anmelden.
          Wählst du diese Option, wirst du zu Google (Google Ireland Limited, Gordon House,
          Barrow Street, Dublin 4, Irland) weitergeleitet und meldest dich dort an. Google
          übermittelt uns anschließend die für das Konto nötigen Angaben, insbesondere deine
          E-Mail-Adresse und deinen Namen. Welche Daten Google dabei selbst verarbeitet, regelt
          die Datenschutzerklärung von Google.</p>
        <p>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Kontos). Die
          Anmeldung mit Google ist freiwillig; die Anmeldung mit E-Mail und Passwort steht dir
          jederzeit offen.</p>
      </LegalSection>

      <LegalSection heading="6. Fehlerüberwachung (Sentry)">
        <p>Um technische Fehler zu erkennen und zu beheben, nutzen wir im Live-Betrieb den Dienst
          Sentry (Functional Software, Inc.). Tritt ein Fehler auf, werden technische Angaben
          übermittelt, etwa Fehlermeldung, betroffene Seite, Browser und Betriebssystem sowie
          Zeitpunkt. Bei einem Teil der Sitzungen und bei Fehlern kann zusätzlich der Ablauf der
          Seite technisch aufgezeichnet werden (Session Replay), damit sich der Fehler
          nachvollziehen lässt.</p>
        <p>Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in
          einem stabilen und sicheren Betrieb des Dienstes. [Speicherdauer bei Sentry und
          Maßnahmen zur Datenminimierung (z. B. Maskierung von Eingaben) ergänzen.]</p>
      </LegalSection>

      <LegalSection heading="7. Speicherdauer">
        <p>Wir speichern deine Daten, solange dein Konto besteht bzw. solange es für die genannten Zwecke
          erforderlich ist. [Konkrete Fristen ergänzen.]</p>
      </LegalSection>

      <LegalSection heading="8. Deine Rechte">
        <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie ein Beschwerderecht bei einer
          Aufsichtsbehörde. Anfragen richte bitte an [E-Mail].</p>
      </LegalSection>

      <LegalSection heading="9. Cookies / lokale Speicherung">
        <p>Wir verwenden nur technisch notwendige Cookies bzw. lokale Speicherung (z. B. für Login-Sitzung
          und Einstellungen). Es findet kein Tracking zu Werbezwecken statt. Die Fehlerüberwachung
          (Abschnitt 6) kann dafür Daten im Sitzungsspeicher des Browsers ablegen.</p>
      </LegalSection>

      <LegalSection heading="10. Kontakt zum Datenschutz">
        <p>Bei Fragen zum Datenschutz: [E-Mail / ggf. Datenschutzbeauftragte:r].</p>
      </LegalSection>
    </LegalShell>
  );
}
