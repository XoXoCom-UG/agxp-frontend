import type { Metadata } from "next";
import { LegalShell, LegalSection, TodoNotice, MissingDataNotice } from "@/components/layout/legal";
import { COMPANY, postalAddress } from "@/lib/company";
import { ConsentLink } from "@/components/layout/cookie-banner";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

/**
 * The processing described here is the processing the code actually performs.
 * It was checked against the source, not written from a template:
 *
 *  - §2/§4 Anthropic: app/api/agent/chat/route.ts sends the conversation.
 *  - §4 Supabase: lib/supabase.ts (auth) and the agxp_* tables.
 *  - §6 Sentry: instrumentation-client.ts / sentry.*.config.ts. No session
 *    replay and sendDefaultPii:false — an earlier version of this page claimed
 *    replay was running, which was never true.
 *  - §4 Cloudflare Turnstile: components/layout/turnstile.tsx, login page only.
 *  - §4 Resend: lib/send-mail.ts, invitation emails the team sends.
 *  - §2 memory: lib/agent-memory.ts reads [[MEMORY:]] notes from the user's
 *    own stored replies; reports: agxp_reports (0020); feedback: agxp_feedback
 *    (0025, lib/send-feedback.ts — the conversation only with the ticked box).
 *  - §8 self-service: Settings → Your data (lib/account-data.ts,
 *    app/api/account/delete/route.ts).
 *  - §9 local storage: the sb-* auth cookie and UI preferences only.
 *
 * If you change what the app sends anywhere, this page changes with it.
 */
export default function DatenschutzPage() {
  const address = postalAddress();

  return (
    <LegalShell title="Datenschutzerklärung">
      <MissingDataNotice />

      <TodoNotice>
        Inhaltlich am Code geprüft, juristisch noch nicht. Vor dem Launch von einer
        Anwältin oder einem Anwalt prüfen lassen — insbesondere die Speicherfristen
        (Abschnitt 7), die Drittlandübermittlung an Anthropic (Abschnitt 4) und die
        Frage, ob für Sentry eine Einwilligung nach § 25 TDDDG nötig ist. Offene
        Angaben: Hosting-Region von Supabase, Speicherdauer bei Sentry, Stand der
        Auftragsverarbeitungsverträge (auch Cloudflare und Resend), und ob die
        Merkfunktion der Agenten (Abschnitt 2) eine eigene Einwilligung braucht.
      </TodoNotice>

      <LegalSection heading="1. Verantwortlicher">
        <p>Verantwortlich für die Datenverarbeitung auf dieser Plattform ist:</p>
        <p>
          {COMPANY.name || <span className="legal-gap">— noch nicht eingetragen —</span>}
          {address ? `, ${address}` : ""}
          {COMPANY.privacyEmail ? `, ${COMPANY.privacyEmail}` : ""}
        </p>
        <p>Siehe auch Impressum.</p>
      </LegalSection>

      <LegalSection heading="2. Welche Daten wir verarbeiten">
        <p>• Kontodaten: E-Mail-Adresse und Anzeigename (bei Registrierung oder Login).</p>
        <p>• Nutzungsinhalte: deine Chat-Nachrichten und die daraus erzeugten Dokumente
          (Transformation Concept, Architecture Blueprint, Adoption Plan, Change Plan) samt Projektnamen. Diese Inhalte enthalten
          typischerweise Angaben über dein Unternehmen, die du selbst eingibst.</p>
        <p>• Angehängte Dateien: PDFs, Bilder und Textdateien, die du selbst an eine
          Nachricht anhängst. Sie werden in einem privaten Speicher abgelegt, der nur deinem
          Konto zugänglich ist, und bei jeder weiteren Nachricht desselben Gesprächs erneut
          an Anthropic übermittelt, damit der Agent sie weiter berücksichtigen kann.</p>
        <p>• Lernnotizen der Agenten: Ein Agent kann sich kurze Notizen über dich und dein
          Unternehmen merken (etwa Branche oder bevorzugte Arbeitsweise) und sie in deinen
          späteren Projekten mit demselben Agenten wieder berücksichtigen. Die Notizen stehen
          in deinen gespeicherten Gesprächen, sind nur deinem Konto zugänglich und werden mit
          ihnen gelöscht. In den Datenschutz-Einstellungen („Cookie-Einstellungen“) kannst du
          die Lernnotizen jederzeit ausschalten (Widerspruch, Art. 21 DSGVO); dann beginnt jedes
          neue Gespräch ohne Notizen aus früheren Projekten. Die Einstellung gilt für dein Konto
          auf allen Geräten.</p>
        <p>• Nutzungsumfang: Anzahl der Anfragen, verarbeitete Token und die daraus berechneten
          Kosten pro Monat, um die Grenzen deines Plans und unser Gesamtbudget durchzusetzen.
          Keine Inhalte, nur Zahlen.</p>
        <p>• Meldungen: Wenn du eine Antwort des Agenten meldest, speichern wir den Grund,
          deine optionale Notiz und die ersten Zeilen der gemeldeten Antwort (höchstens 600
          Zeichen), damit wir den Fall prüfen können.</p>
        <p>• Feedback: Wenn du über den Feedback-Knopf schreibst, speichern wir deine Nachricht
          (höchstens 2000 Zeichen) und die Seite, auf der du warst. Nur wenn du das Kästchen
          ausdrücklich ankreuzt, speichern wir zusätzlich eine Textkopie beider Gespräche des
          geöffneten Projekts (höchstens 100.000 Zeichen). Ohne Häkchen wird nichts aus deinen
          Gesprächen gelesen oder gesendet. Markierst du dein Feedback als schwerwiegendes
          Problem, senden wir deine Nachricht (nie die Gespräche) zusätzlich per E-Mail an
          zwei Mitglieder unseres Teams; der Versand läuft über Resend (Abschnitt 4). Um das
          Feedback nach Dringlichkeit zu ordnen, wird deine Nachricht (nie die Gespräche) an
          ein Sprachmodell von Anthropic gesendet, das sie in vier Stufen einordnet; die Stufe
          und eine Begründung in einem Satz speichern wir beim Feedback.</p>
        <p>• Technische Daten: für Betrieb und Sicherheit notwendige Log- und
          Verbindungsdaten.</p>
      </LegalSection>

      <LegalSection heading="3. Zwecke und Rechtsgrundlagen">
        <p>Wir verarbeiten diese Daten, um den Dienst bereitzustellen (Art. 6 Abs. 1 lit. b
          DSGVO – Vertrag) sowie zur Gewährleistung von Sicherheit und Betrieb
          (Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse).</p>
      </LegalSection>

      <LegalSection heading="4. Auftragsverarbeiter und Drittanbieter">
        <p>Zur Erbringung des Dienstes setzen wir ein:</p>
        <p>• <b>Anthropic PBC</b> (USA) – erzeugt die Antworten. Dorthin wird der Inhalt
          deiner Unterhaltung übermittelt, einschließlich der Angaben über dein Unternehmen,
          die du eingibst. Das ist die weitreichendste Übermittlung in dieser Erklärung.
          Anthropic verwendet über die Programmierschnittstelle übermittelte Inhalte nach
          eigenen Angaben nicht zum Training seiner Modelle.</p>
        <p>• <b>Supabase</b> – Authentifizierung und Datenbank. Hier liegen Konto, Projekte
          und Nachrichten dauerhaft.</p>
        <p>• <b>Vercel Inc.</b> (USA) – Hosting und Auslieferung der Anwendung.</p>
        <p>• <b>Functional Software, Inc. (Sentry)</b> – Fehlerüberwachung, siehe Abschnitt 6.</p>
        <p>• <b>Cloudflare, Inc.</b> (USA) – Turnstile, eine Prüfung auf der Anmeldeseite, die
          automatisierte Registrierungen und Anmeldeversuche abwehrt. Dabei verarbeitet Cloudflare
          technische Angaben wie IP-Adresse und Browsermerkmale. Rechtsgrundlage ist Art. 6 Abs. 1
          lit. f DSGVO; unser berechtigtes Interesse ist der Schutz der Konten und des Dienstes
          vor Missbrauch.</p>
        <p>• <b>Resend</b> (USA) – Versand von Einladungs-E-Mails, wenn wir
          dich zur Beta einladen. Übermittelt werden deine E-Mail-Adresse und der Einladungscode.</p>
        <p>Mit diesen Anbietern sind Auftragsverarbeitungsverträge nach Art. 28 DSGVO zu
          schließen. Für Übermittlungen in die USA ist die jeweilige Grundlage anzugeben
          (EU-U.S. Data Privacy Framework oder Standardvertragsklauseln).</p>
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
          Sentry (Functional Software, Inc., USA). Tritt ein Fehler auf, werden technische Angaben
          übermittelt: Fehlermeldung und Programmablauf, die betroffene Seite, Browser und
          Betriebssystem sowie der Zeitpunkt.</p>
        <p>In deinem Browser läuft Sentry <b>nur, wenn du im Cookie-Hinweis zustimmst</b>
          (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Lehnst du ab, werden aus deinem Browser
          keine Fehlerberichte gesendet. Fehler, die auf unseren Servern auftreten, melden wir
          unabhängig davon.</p>
        <p>Es findet <b>keine Bildschirmaufzeichnung</b> (Session Replay) statt. Die Übermittlung
          von IP-Adresse, Cookies und Anfrage-Kopfzeilen ist in der Konfiguration ausdrücklich
          abgeschaltet.</p>
        <p>Für Fehlerberichte vom Server ist die Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO; unser
          berechtigtes Interesse liegt in einem stabilen und sicheren Betrieb des Dienstes.</p>
      </LegalSection>

      <LegalSection heading="7. Speicherdauer">
        <p>Konto, Projekte und Nachrichten speichern wir, solange dein Konto besteht. Löschst du
          ein Projekt, werden seine Nachrichten und die daran angehängten Dateien mitgelöscht.
          Wird das Konto gelöscht, entfallen damit auch Projekte, Nachrichten, Dateien und
          Nutzungszähler.</p>
        <p>Meldungen zu Antworten und Feedback werden mit dem Konto gelöscht. Eine mit dem
          Feedback gesendete Gesprächskopie bleibt auch dann erhalten, wenn du das Projekt
          löschst; sie ist eine eigene Kopie und wird erst mit dem Konto gelöscht. Für Log- und Fehlerdaten gelten
          die Fristen der jeweiligen Anbieter; konkrete Angaben werden ergänzt.</p>
      </LegalSection>

      <LegalSection heading="8. Deine Rechte">
        <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie ein Beschwerderecht bei einer
          Aufsichtsbehörde.</p>
        <p>Zwei davon kannst du jederzeit selbst ausüben, unter <b>Einstellungen → Your data</b>:
          eine vollständige Kopie deiner Daten als Datei herunterladen (Art. 15 und 20 DSGVO) und
          dein Konto mit allen Projekten, Gesprächen, Dateien und Agenten löschen (Art. 17 DSGVO).</p>
        <p>Alle übrigen Anfragen richte bitte an{" "}
          {COMPANY.privacyEmail
            ? COMPANY.privacyEmail
            : <span className="legal-gap">— noch nicht eingetragen —</span>}.</p>
      </LegalSection>

      <LegalSection heading="9. Cookies und lokale Speicherung">
        <p><b>Notwendig</b> (§ 25 Abs. 2 Nr. 2 TDDDG, ohne Einwilligung): ein Cookie für deine
          Login-Sitzung, deine Einstellungen im Browser (etwa Farbschema, Akzentfarbe und
          Fensteraufteilung), ob du die Einführung schon gesehen hast, und deine Auswahl im
          Cookie-Hinweis selbst. Ohne sie funktioniert der Dienst nicht wie von dir gewünscht.</p>
        <p><b>Optional</b>, nur mit deiner Einwilligung: Fehlerberichte aus dem Browser an Sentry
          (Abschnitt 6).</p>
        <p>Es findet kein Tracking zu Werbezwecken statt, und es werden keine Daten für
          Werbenetzwerke weitergegeben. Deine Einwilligung kannst du jederzeit mit Wirkung für die
          Zukunft widerrufen: <ConsentLink /></p>
      </LegalSection>

      <LegalSection heading="10. Kontakt zum Datenschutz">
        <p>Bei Fragen zum Datenschutz:{" "}
          {COMPANY.privacyEmail
            ? COMPANY.privacyEmail
            : <span className="legal-gap">— noch nicht eingetragen —</span>}.</p>
      </LegalSection>
    </LegalShell>
  );
}
