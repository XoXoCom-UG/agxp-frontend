# Refacere AgXP → software de consultanță (meeting 2026-11-20, Mural 19.11.)

Ce a cerut Patryk: aplicația devine **doar software de consultanță** („Consulting Software”). Coach-ul dispare ca rol separat (coaching = o metodă de consultanță), user-ul nu mai alege nimic („idiotensicher”, Kaizen), iar ecranul de lucru devine un **Cockpit**.
Patryk a cerut explicit să ne gândim înainte de implementare — de aceea planul e pe faze, fiecare livrabilă și reversibilă separat.

## Decizii de arhitectură (propuse, de confirmat)

1. **Baza de date rămâne cum e.** `coach_agent_id`, `agents.type = 'coach'`, `agxp_project_messages.panel` etc. nu se redenumesc. „Assistant” e doar numele din UI. Zero migrări riscante, istoricul existent rămâne valid.
2. **Cele 9+2 tipuri de consultanți rămân** (cu toate metodele din foaia de metode). Se schimbă doar *cum ajunge user-ul la ele*: nu le mai alege, le primește pe baza promptului și ale „câștigă” prin nivel.
3. **Metodele devin obiectul central**, nu interviul. Interviul rămâne, dar opțional.
4. Orice apel nou la model trece prin `beginAiCall` / `settleAiCall` (buget + lease), ca la chat.

## Faze

### F0 — Poziționare și text (fără schimbări de logică)
- „Coach” → „Assistant” în tot UI-ul (tab-uri, panou, picker, tur, setări, mail-uri). Cheile i18n DE/EN/RO se actualizează odată.
- „Transformation Concept” dispare din textele de marketing (landing, meta-descriere, tur, mail-uri); în loc: **„tailored consulting methods”** (sticky din Mural: „Bitte Wort Transformation Concept löschen — stattdessen tailored consulting methods — auch ändern auf Websites und Mails”). Numele documentului Strategy Consultant rămâne (e cuprins în marcajul `[[DOC:]]` și în teste).
- „Methods” → „Consulting Methods”.
- Deschis: textul de poziționare „Consulting Software” pe landing.

### F1 — Cockpit (partea dreaptă)
- Dreapta = **Cockpit | Assistant**. Cockpit-ul arată *metodele* consultantului (nu stațiile interviului), fiecare clicabilă *în* cockpit (nu fereastră nouă): click → consultantul discută metoda cu user-ul („vrei să știi ceva? cum o schimbăm?”).
- Un prim draft al metodelor apare fără interviu.
- Interviul → buton opțional „Optimizează toate metodele” (pornește interviul de acum).
- Design: *foarte clean*, mai puțin colorat decât acum, fără efecte luminoase (Patryk: „noch ein Ticken zu bunt”).

### F2 — Prompt Pad (ecranul de start)
- Înlocuiește picker-ul de consultanți. Un câmp mare „Type commands to enable your consultant” + trei butoane: **Command Prompts** (director de șabloane), **Method Glossary**, **Activate Assistant**.
- Șabloanele = formulare cu câmpuri (ex. „IT Projekt Implementierung”: Name, Ziel, Mitarbeiter…). Mai multă informație de la început = mai puțini tokeni la interviu.
- Unde e ecranul în user journey (înainte de login? după tutorial, înainte de plată?) — **de decis cu Patryk/Anton**; Ana: ecranul „mystery”, plata la jumătatea muncii, după ce ai pierdut timp (FOMO).

### F3 — Consultant creat automat + metode propuse de AI
- Rută nouă (ex. `/api/agent/start`, prin lease): din prompt → alege tipul de consultant, creează agentul, propune metodele necesare.
- User fără consultant → „There is no consultant yet” → se creează; user cu consultanți → „We recommend this consultant / a new toolset for this project”.
- Draft-ul metodelor se generează în fundal în timp ce user-ul confirmă consultantul.

### F4 — Niveluri și specializare („Pokémon”)
- Se pornește de la `lib/agent-level.ts` (nivel 1–5 deja existent, doar crește).
- General Consultant pornește la Lvl 1/2; după Lvl 2 se specializează (ex. Solution Architect Lvl 1) după ce folosește user-ul cel mai des. Lvl 1 → restul metodelor clasei (Major); Lvl 2 specializare → user-ul alege metodele unei clase în plus (Minor).

### F5 — Agent Dashboard
- Maxim 1 sau 5 agenți per plan (azi 4 per tip, 9+2 tipuri). Carduri mai mari, filtrele mutate în stânga.

### F6 — Roluri noi
- AI Developer, AI Security Engineer (+ „Technical Consultant”) cu metode proprii. Metodele vin din foaia de metode — **așteptăm lista de la Ana/Patryk**.

## Făcut până acum (2026-11-24, necomis)
- Partea dreaptă: tab-urile se numesc **Cockpit | Assistant** (ids interne neschimbate, DB neatins), la fel pastilele, tooltip-urile, eticheta din cap și placeholder-ul compozitorului (EN + DE).
- Cockpit: **fiecare metodă e clicabilă** → consultantul o discută (`discussMethodPrompt` în `lib/deliverables.ts`, `controls.discuss`), nu mută interviul (fără `[[TOPIC]]`/`[[PROGRESS]]`); în chat apare ca o linie discretă „Geöffnet: …”. Test nou în `deliverables.test.ts`.
- **F2+F3 (necomis, doar local):** `components/layout/prompt-pad.tsx` înlocuiește picker-ul când proiectul nu are consultant: câmp mare, *Command Prompts* (5 șabloane cu câmpuri, `lib/prompt-templates.ts`), *Method Glossary*, *Activate consultant*. `POST /api/agent/start` (`lib/start-plan.ts`, haiku, același lease/limite ca `title`, fără migrare) alege tipul de consultant + metodele; răspunsul e validat contra catalogului. Apoi „There is no consultant yet" / „We recommend this consultant" (refolosește unul existent de același tip sau creează), **Start** creează consultantul + un Assistant (`lib/start-flow.ts`), trimite textul ca primul mesaj și deschide chatul. Teste: `start-plan.test.ts`, `prompt-templates.test.ts`.
- **Nu e făcut încă:** textele de poveste (landing, tur, home, login, mail-uri, meta) încă spun „Coach” / „Transformation Concept” — se rescriu odată cu F2, ca să nu le scriem de două ori.

## Ordinea
F0 → F1 → F2+F3 (împreună: pad-ul fără auto-consultant nu are sens) → F4 → F5 → F6.
F0 acum; F1 imediat după.
