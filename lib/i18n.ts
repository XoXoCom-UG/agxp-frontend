/**
 * The German for the app's own words. The components are written in English
 * and ask `useT()` (lib/language.ts) for each string; the English IS the key,
 * so a string missing here simply stays English instead of showing a key name.
 *
 * `{name}` in a key is a slot filled from `vars`, in both languages.
 *
 * "Du", like the cookie banner and the legal pages' own German. What comes
 * from data — agent type names, method names, industries, plan names and
 * everything the agents write — is not in here and stays as written.
 *
 * Relative imports only: the test runner does not know the "@/" alias.
 */

export type Lang = "en" | "de";

export const DE: Record<string, string> = {
  // The bar
  "Skip to content": "Zum Inhalt springen",
  "AgentiX Projects, home": "AgentiX Projects, Startseite",
  "Project History": "Projektverlauf",
  "Agent Dashboard": "Agenten-Dashboard",
  "Untitled task": "Unbenannte Aufgabe",
  "Current Project": "Aktuelles Projekt",
  "New Task": "Neue Aufgabe",
  "New task": "Neue Aufgabe",
  "Main": "Hauptmenü",
  "Switch light or dark theme": "Hell oder dunkel umschalten",
  "Account menu": "Kontomenü",
  "Account": "Konto",
  "Profile & settings": "Profil & Einstellungen",
  "Sign out": "Abmelden",
  "Legal": "Rechtliches",

  // Home
  "Two agents.": "Zwei Agenten.",
  "One project.": "Ein Projekt.",
  "Bring an idea. A consultant works it out with you, step by step.":
    "Bring eine Idee mit. Ein Consultant arbeitet sie Schritt für Schritt mit dir aus.",
  "Start a new chat": "Neuen Chat starten",

  // Settings
  "Settings": "Einstellungen",
  "Close settings": "Einstellungen schließen",
  "Settings sections": "Bereiche der Einstellungen",
  "Profile": "Profil",
  "Plan": "Tarif",
  "Your data": "Deine Daten",
  "Appearance": "Darstellung",
  "Add your name": "Name hinzufügen",
  "Display name": "Anzeigename",
  "How your agents address you": "Wie deine Agenten dich ansprechen",
  "Your agents use this when they talk to you.": "Deine Agenten sprechen dich mit diesem Namen an.",
  "Email": "E-Mail",
  "Sign-in address. Not changeable here.": "Adresse für die Anmeldung. Hier nicht änderbar.",
  "Could not save your name.": "Dein Name konnte nicht gespeichert werden.",
  "Saving…": "Speichert…",
  "Saved": "Gespeichert",
  "Save changes": "Änderungen speichern",
  "Guided tour": "Geführte Tour",
  "The one-minute introduction to the two agents, the documents and the colours.":
    "Die einminütige Einführung in die zwei Agenten, die Dokumente und die Farben.",
  "Play it again": "Noch einmal abspielen",
  "Language": "Sprache",
  "The app's buttons and labels. What the agents write is not changed.":
    "Die Schaltflächen und Beschriftungen der App. Was die Agenten schreiben, bleibt unverändert.",
  "Theme": "Farbschema",
  "System": "System",
  "Light": "Hell",
  "Dark": "Dunkel",
  "System follows whatever your computer is set to.": "System folgt der Einstellung deines Computers.",
  "Accent": "Akzentfarbe",
  "Accent colour": "Akzentfarbe",
  "Changes every accent in the app, including the light in the room behind the panels. Saved on this browser.":
    "Ändert jede Akzentfarbe der App, auch das Licht im Raum hinter den Panels. Wird in diesem Browser gespeichert.",
  "Background": "Hintergrund",
  "Background pattern": "Hintergrundmuster",
  "Plain": "Schlicht",
  "Just the room, nothing in the air": "Nur der Raum, nichts in der Luft",
  "Still": "Ruhig",
  "The dust, held in place": "Der Staub, an seinem Platz",
  "Drifting": "Treibend",
  "Two planes of dust on the move, slowly enough to notice only if you look":
    "Zwei Ebenen Staub in Bewegung, so langsam, dass man es nur beim Hinsehen bemerkt",
  "Drifting moves about a third of a pixel a second — enough to feel alive, not enough to follow.":
    "Treibend bewegt sich etwa ein Drittel Pixel pro Sekunde – genug, um lebendig zu wirken, zu wenig, um ihm zu folgen.",
  "Glass": "Glas",
  "How much glass": "Wie viel Glas",
  "Solid": "Deckend",
  "No blur — every bar and sheet is opaque": "Keine Unschärfe – jede Leiste und jedes Fenster ist deckend",
  "A little blur, the room still legible through it": "Etwas Unschärfe, der Raum bleibt dahinter erkennbar",
  "Full": "Voll",
  "The full frosted material": "Das volle Milchglas",
  "How much the bars, the sheets and the panels blur what is behind them. Solid is also the faster one.":
    "Wie stark Leisten, Fenster und Panels verwischen, was hinter ihnen liegt. Deckend ist auch die schnellere Variante.",
  "Conversation width": "Breite der Unterhaltungen",
  "How the two conversations share the screen": "Wie sich die zwei Unterhaltungen den Bildschirm teilen",
  "Equal": "Gleich",
  "Both conversations the same width": "Beide Unterhaltungen gleich breit",
  "One leads": "Eine führt",
  "The active one takes about two thirds": "Die aktive nimmt etwa zwei Drittel ein",
  "Focused": "Fokussiert",
  "The other one stays as a narrow column": "Die andere bleibt eine schmale Spalte",
  "How much room the conversation you are in takes.": "Wie viel Platz die Unterhaltung einnimmt, in der du gerade bist.",
  " The seam between them is locked.": " Die Trennlinie zwischen ihnen ist gesperrt.",
  " You can also drag the seam between them.": " Du kannst auch die Trennlinie zwischen ihnen ziehen.",
  "Dragging the seam": "Trennlinie ziehen",
  "Whether the seam can be dragged": "Ob die Trennlinie gezogen werden kann",
  "Free": "Frei",
  "Locked": "Gesperrt",
  "Locked, the width only changes here — the seam keeps its swap button.":
    "Gesperrt ändert sich die Breite nur hier – die Trennlinie behält ihre Tausch-Schaltfläche.",
  "Your plan": "Dein Tarif",
  "Unlimited projects": "Unbegrenzte Projekte",
  "{left} of {total} projects left this month": "{left} von {total} Projekten in diesem Monat übrig",
  "{left} of {total} projects left this week": "{left} von {total} Projekten in dieser Woche übrig",
  "Resets on the 1st.": "Wird am 1. zurückgesetzt.",
  "Resets Monday.": "Wird am Montag zurückgesetzt.",
  "A project is one conversation — rebuilding its document as often as you like costs nothing extra.":
    "Ein Projekt ist eine Unterhaltung – sein Dokument so oft neu zu erstellen, wie du willst, kostet nichts extra.",
  "What each plan includes": "Was jeder Tarif enthält",
  "Current": "Aktuell",
  "projects per month": "Projekte pro Monat",
  "projects per week": "Projekte pro Woche",
  "Unlimited": "Unbegrenzt",
  "1 type per role, up to 1 agent of each, all your own": "1 Typ pro Rolle, bis zu 1 Agent pro Typ, alle deine eigenen",
  "Every type, up to 4 agents of each, all your own": "Jeder Typ, bis zu 4 Agenten pro Typ, alle deine eigenen",
  "Full interview": "Vollständiges Interview",
  "First {n} interview steps": "Die ersten {n} Interviewschritte",
  "Coach reads the consultation": "Der Coach liest die Beratung mit",
  "Coach reads it once, as a preview": "Der Coach liest sie einmal, als Vorschau",
  "Coach speaks up on its own": "Der Coach meldet sich von selbst",
  "Coach answers when asked": "Der Coach antwortet, wenn du fragst",
  "Upgrading isn't wired up yet — get in touch and we'll move your account.":
    "Ein Upgrade geht noch nicht automatisch – melde dich bei uns und wir stellen dein Konto um.",

  // The chat panel
  "Consultant": "Consultant",
  "Coach": "Coach",
  "Methods": "Methoden",
  "Show on this side": "Auf dieser Seite zeigen",
  ", has something to add": ", hat etwas hinzuzufügen",
  "Fold away. The Coach keeps listening.": "Einklappen. Der Coach hört weiter zu.",
  "Fold this panel away": "Dieses Panel einklappen",
  "ready": "fertig",
  "{title}, ready": "{title}, fertig",
  "{title}, {pct}% ready": "{title}, {pct} % fertig",
  "Read what {name} said": "Lies, was {name} gesagt hat",
  "New": "Neu",
  "Medium": "Mittel",
  "High": "Hoch",
  "Experience": "Erfahrung",
  "Level up": "Aufgestiegen",
  "1 more project to {next}": "Noch 1 Projekt bis {next}",
  "{n} more projects to {next}": "Noch {n} Projekte bis {next}",
  "Projects together": "Gemeinsame Projekte",
  "Change agent": "Agent wechseln",
  "Role": "Rolle",
  "Remembers about you": "Weiß über dich",
  "+{n} new": "+{n} neu",
  "and {n} more": "und {n} weitere",
  "Can help with": "Kann helfen bei",
  "Remove {name}": "{name} entfernen",
  "Uploading…": "Wird hochgeladen…",
  "Uploading {n}…": "{n} werden hochgeladen…",
  "Message your consultant": "Nachricht an deinen Consultant",
  "Message your coach": "Nachricht an deinen Coach",
  "Ask your consultant…": "Frag deinen Consultant…",
  "Ask your coach…": "Frag deinen Coach…",
  "Attach a file": "Datei anhängen",
  "Wait for the answer": "Warte auf die Antwort",
  "Not available yet": "Noch nicht verfügbar",
  "Stop generating": "Antwort stoppen",
  "Send message": "Nachricht senden",
  "You're talking to an AI agent. It can make mistakes and is no substitute for legal, tax or financial advice. Don't share passwords or payment details.":
    "Du sprichst mit einem KI-Agenten. Er kann Fehler machen und ersetzt keine Rechts-, Steuer- oder Finanzberatung. Teile keine Passwörter oder Zahlungsdaten.",

  // The picker
  "Create new AI consultant": "Neuen KI-Consultant erstellen",
  "Create new AI coach": "Neuen KI-Coach erstellen",
  "Train one of your AI team members": "Eines deiner KI-Teammitglieder trainieren",
  "{level} · 1 project together": "{level} · 1 gemeinsames Projekt",
  "{level} · {n} projects together": "{level} · {n} gemeinsame Projekte",
  "Back": "Zurück",
  "Retry": "Erneut versuchen",
  "Your coach joins next": "Dein Coach kommt als Nächstes dazu",
  "Pick a Consultant first. This seat opens once there is one.":
    "Wähle zuerst einen Consultant. Dieser Platz öffnet sich, sobald es einen gibt.",
  "Your consultants": "Deine Consultants",
  "Your coaches": "Deine Coaches",
  "Search your consultants": "Deine Consultants durchsuchen",
  "Search your coaches": "Deine Coaches durchsuchen",
  "Open a name to see its profile, or Select to bring it into this project.":
    "Öffne einen Namen für sein Profil, oder wähle ihn für dieses Projekt aus.",
  "Search by name or what they do…": "Nach Name oder Aufgabe suchen…",
  "No agents found": "Keine Agenten gefunden",
  "Try another name, or make a new one.": "Versuch einen anderen Namen oder erstelle einen neuen.",
  "Clear search": "Suche leeren",
  "No {type} yet.": "Noch kein {type}.",
  "Create one": "Einen erstellen",
  "{level} experience": "Erfahrung: {level}",
  "Works with": "Arbeitet mit",
  "1 project": "1 Projekt",
  "{n} projects": "{n} Projekte",
  "Select {name}": "{name} auswählen",
  "Select": "Auswählen",
  "Step 1 of 2": "Schritt 1 von 2",
  "What kind of help?": "Welche Art von Hilfe?",
  "Recommended": "Empfohlen",
  "Start here if you have an idea. Plain words, no consulting jargon.":
    "Starte hier, wenn du eine Idee hast. Einfache Worte, kein Beraterjargon.",
  "Professional AI Consultants": "Professionelle KI-Consultants",
  "Consulting methods, for work in a company.": "Beratungsmethoden, für die Arbeit im Unternehmen.",
  "Full, archive one first": "Voll, archiviere zuerst einen",
  "{used} of {max} in use": "{used} von {max} belegt",
  "Recent projects": "Letzte Projekte",
  "Select Consultant": "Consultant auswählen",
  "Select Coach": "Coach auswählen",
  "Loading what this agent can help with…": "Lade, wobei dieser Agent helfen kann…",
  "None of this type's methods are in the database yet, so it can't be created.":
    "Keine Methode dieses Typs ist schon in der Datenbank, deshalb kann er nicht erstellt werden.",
  "Give the agent a name first.": "Gib dem Agenten zuerst einen Namen.",
  "Step 2 of 2 · Name your consultant": "Schritt 2 von 2 · Benenne deinen Consultant",
  "Step 2 of 2 · Name your coach": "Schritt 2 von 2 · Benenne deinen Coach",
  "Unnamed": "Ohne Namen",
  "Name": "Name",
  "Agent name is required.": "Der Agent braucht einen Namen.",
  "Description": "Beschreibung",
  "New. You two have not worked together yet.": "Neu. Ihr zwei habt noch nicht zusammengearbeitet.",
  "Creating…": "Wird erstellt…",
  "Create": "Erstellen",

  // History
  "All projects": "Alle Projekte",
  "In progress": "In Arbeit",
  "Not started": "Nicht begonnen",
  "In Progress": "In Arbeit",
  "Not Started": "Nicht begonnen",
  "Completed": "Abgeschlossen",
  "Archived": "Archiviert",
  "Last updated": "Zuletzt geändert",
  "Messages": "Nachrichten",
  "Progress": "Fortschritt",
  "Category": "Kategorie",
  "Newest first": "Neueste zuerst",
  "Oldest first": "Älteste zuerst",
  "A to Z": "A bis Z",
  "Z to A": "Z bis A",
  "Most first": "Meiste zuerst",
  "Fewest first": "Wenigste zuerst",
  "Most advanced first": "Am weitesten zuerst",
  "Least advanced first": "Am wenigsten weit zuerst",
  "Last 7 days": "Letzte 7 Tage",
  "Last 30 days": "Letzte 30 Tage",
  "Last 90 days": "Letzte 90 Tage",
  "No agents assigned yet": "Noch keine Agenten zugewiesen",
  "Not generated yet": "Noch nicht erstellt",
  "Consultant document generated": "Consultant-Dokument erstellt",
  "Change Plan generated": "Change Plan erstellt",
  "Documents": "Dokumente",
  "Industry: {name}": "Branche: {name}",
  "Loading…": "Lädt…",
  "Archive project?": "Projekt archivieren?",
  "\"{name}\" will be moved out of your active projects.": "„{name}“ wird aus deinen aktiven Projekten verschoben.",
  "Archive": "Archivieren",
  "Cancel": "Abbrechen",
  "\"{name}\" couldn't be renamed. Check your connection and try again.":
    "„{name}“ konnte nicht umbenannt werden. Prüfe deine Verbindung und versuch es noch einmal.",
  "\"{name}\" couldn't be archived. Check your connection and try again.":
    "„{name}“ konnte nicht archiviert werden. Prüfe deine Verbindung und versuch es noch einmal.",
  "Overview and filters": "Übersicht und Filter",
  "Project overview": "Projektübersicht",
  "Total projects": "Projekte insgesamt",
  "Active": "Aktiv",
  "Filter projects": "Projekte filtern",
  "Filter by status": "Nach Status filtern",
  "Agents": "Agenten",
  "Industry": "Branche",
  "Clear filters": "Filter löschen",
  "Search projects": "Projekte durchsuchen",
  "Search projects…": "Projekte durchsuchen…",
  "Sort by": "Sortieren nach",
  "Sort projects by": "Projekte sortieren nach",
  "Order: {order}. Click to reverse.": "Reihenfolge: {order}. Klicken zum Umkehren.",
  "Active filters": "Aktive Filter",
  "Remove filter: {name}": "Filter entfernen: {name}",
  "Clear all": "Alle löschen",
  "Dismiss": "Schließen",
  "Your projects couldn't be loaded. Check your connection and try again.":
    "Deine Projekte konnten nicht geladen werden. Prüfe deine Verbindung und versuch es noch einmal.",
  "No project by that name": "Kein Projekt mit diesem Namen",
  "Nothing here matches what you typed. Try a shorter word. The search looks at names, descriptions, categories and agents.":
    "Nichts passt zu deiner Eingabe. Versuch ein kürzeres Wort. Die Suche durchsucht Namen, Beschreibungen, Kategorien und Agenten.",
  "Nothing in this filter": "Nichts in diesem Filter",
  "No project matches the filters on the left.": "Kein Projekt passt zu den Filtern links.",
  "Show all projects": "Alle Projekte zeigen",
  "Nothing here yet": "Noch nichts hier",
  "Start a task and it turns up here on its own, with the agents that worked on it and everything they produced.":
    "Starte eine Aufgabe, und sie erscheint hier von selbst – mit den Agenten, die daran gearbeitet haben, und allem, was sie erstellt haben.",
  "Project name": "Projektname",
  "1 message": "1 Nachricht",
  "{n} messages": "{n} Nachrichten",
  "1 document": "1 Dokument",
  "{n} documents": "{n} Dokumente",
  "Updated {when}": "Aktualisiert {when}",
  "More": "Mehr",
  "More actions for {name}": "Weitere Aktionen für {name}",
  "Actions for {name}": "Aktionen für {name}",
  "Rename project": "Projekt umbenennen",
  "Archive project": "Projekt archivieren",
};

/** "5m ago", "Yesterday" and friends from agoStr() (lib/utils.ts). */
function agoDe(s: string): string | null {
  if (s === "Just now") return "gerade eben";
  if (s === "Yesterday") return "gestern";
  const m = /^(\d+)([mhdw]) ago$/.exec(s);
  if (!m) return null;
  const unit = m[2] === "w" && m[1] === "1" ? "Woche"
    : { m: "Min.", h: "Std.", d: "Tagen", w: "Wochen" }[m[2] as "m" | "h" | "d" | "w"];
  return `vor ${m[1]} ${unit}`;
}

export function translate(lang: Lang, en: string, vars?: Record<string, string | number>): string {
  let out = lang === "de" ? (DE[en] ?? agoDe(en) ?? en) : en;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
