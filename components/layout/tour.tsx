"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { AgentMascot, type MascotMood } from "@/components/layout/agent-mascot";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  IconArrow, IconBack, IconCheck, IconDoc, IconX,
  IconSpark, IconNodes, IconUsers, IconSun, IconMoon, IconMonitor,
} from "@/components/layout/agxp-icons";
import { ACCENTS, readAccent, applyAccent, type Accent } from "@/lib/accent";
import { GLASS_OPTIONS, useAppearance, setAppearance } from "@/lib/appearance";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useExit } from "@/lib/use-exit";
import {
  TOUR_STEPS, TOUR_CHOICES, TOUR_QUESTION, TOUR_REPLIES, type Scene,
} from "@/lib/tour";

/**
 * The guided tour.
 *
 * Deliberately NOT a coachmark tour. Spotlights pinned to real buttons break
 * the moment anything moves, they can only ever point at the screen you
 * happen to be on, and they teach where things are rather than what the app
 * is for — which is the part that actually needs explaining here, because
 * "two agents interview you and write two documents" is not a thing anyone
 * guesses from a layout.
 *
 * So: its own stage, and every step is a WORKING miniature rather than a
 * picture of one. The chat types. The document assembles. The colour picker
 * is the real setting from lib/accent.ts, changing the real app behind the
 * glass while you watch. Nothing here is a screenshot that can go stale.
 *
 * The content is lib/tour.ts; this file only draws it.
 */

export function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const stage = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const [closing, exitThen] = useExit(220);
  const onClient = useOnClient();

  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;

  // Focus starts on Next, not on the close button in the corner: the tour is
  // a thing you step through, and Enter should advance it from the first key
  // press rather than quietly dismissing it.
  useDialogFocus(stage, nextBtn);

  const finish = useCallback(() => exitThen(onDone), [exitThen, onDone]);

  const go = useCallback((d: 1 | -1) => {
    setI(prev => {
      const n = prev + d;
      if (n < 0) return prev;
      if (n >= TOUR_STEPS.length) { finish(); return prev; }
      setDir(d);
      return n;
    });
  }, [finish]);

  // The whole keyboard, in one place. Arrows walk it, Enter advances,
  // Escape leaves — and Escape leaving counts as finished, because someone
  // who closes a tutorial is telling us they do not want it again.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); finish(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, finish]);

  // The page behind must not scroll under the stage.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // The portal needs a document, and the server has none — rendering null
  // there and the stage here is precisely the hydration mismatch React warns
  // about. Today nothing renders this during SSR (the host waits for the
  // session, which only resolves in the browser), but "safe because of where
  // it happens to be mounted" is not safe.
  if (!onClient) return null;

  return createPortal(
    <div className={`tour${closing ? " is-closing" : ""}`} role="dialog" aria-modal="true"
      aria-labelledby={`${uid}-title`}>
      {/* The same core art as the Home hero, tinted by the live accent — so
          the moment the colour step changes it, the room changes too. */}
      <span className="tour-art" aria-hidden="true" />

      <div className="tour-stage" ref={stage}>
        <header className="tour-top">
          <BrandLogo size={26} />
          <button className="tour-skip" onClick={finish}>
            {last ? "Close" : "Skip the tour"} <IconX size={13} />
          </button>
        </header>

        <div className="tour-main" key={step.id} data-dir={dir}>
          <div className="tour-words">
            <span className="tour-count">
              {String(i + 1).padStart(2, "0")}<i>/</i>{String(TOUR_STEPS.length).padStart(2, "0")}
            </span>
            <h2 id={`${uid}-title`} className="tour-title">{step.title}</h2>
            <p className="tour-line">{step.line}</p>
            <Guides scene={step.id} speaker={step.speaker} />
          </div>

          <div className="tour-scene">
            <SceneFor scene={step.id} />
          </div>
        </div>

        <footer className="tour-foot">
          {/* The rail is also the navigation: on a seven-step tour, going
              back two is a click, not two clicks. */}
          <ol className="tour-rail" aria-label="Tour progress">
            {TOUR_STEPS.map((s, n) => (
              <li key={s.id} className={n === i ? "on" : n < i ? "done" : ""}>
                <button onClick={() => { setDir(n > i ? 1 : -1); setI(n); }}
                  aria-current={n === i ? "step" : undefined}
                  aria-label={`Step ${n + 1}: ${s.tag}`}>
                  <span className="tour-dot" aria-hidden="true" />
                  <span className="tour-tag">{s.tag}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="tour-nav">
            <button className="tour-back" onClick={() => go(-1)} disabled={i === 0}>
              <IconBack size={14} /> Back
            </button>
            <button className="tour-next" ref={nextBtn} onClick={() => go(1)}>
              {last ? "Start working" : "Next"} <IconArrow size={15} />
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/* --- The two guides ------------------------------------------------------- */

/**
 * The pair, present on every step rather than only on their own.
 *
 * They are the thing being explained, so having them watch the explanation
 * is what makes the tour feel like an introduction to someone rather than a
 * slideshow. The mascot already owns looking and reacting; this only decides
 * which of the two leans in, and plays one reaction per step so the change of
 * subject registers.
 */
function Guides({ scene, speaker }: { scene: Scene; speaker?: "consultant" | "coach" }) {
  const big = scene === "hello" || scene === "go";
  // .tour-main is keyed on the step, so this remounts on every step and the
  // reaction is simply its opening state — no effect, and no render where the
  // new face is already up but still wearing the previous mood.
  const [mood, setMood] = useState<MascotMood>(scene === "go" ? "proud" : "nod");

  // A one-off reaction has to be cleared or it never fires again.
  useEffect(() => {
    const t = window.setTimeout(() => setMood(null), 700);
    return () => window.clearTimeout(t);
  }, []);

  const size = big ? 110 : 76;
  return (
    <div className={`tour-guides${big ? " big" : ""}`} aria-hidden="true">
      {(["consultant", "coach"] as const).map(role => (
        <span key={role} className={`tour-guide${speaker === role ? " lead" : ""}`}>
          <AgentMascot role={role} size={size} level={4}
            state={speaker === role ? "speaking" : "idle"}
            mood={speaker === role || big ? mood : null}
            lookAt={speaker && speaker !== role ? "card" : null} />
        </span>
      ))}
    </div>
  );
}

/* --- The scenes ----------------------------------------------------------- */

function SceneFor({ scene }: { scene: Scene }) {
  switch (scene) {
    case "pair": return <PairScene />;
    case "ask": return <AskScene />;
    case "build": return <BuildScene />;
    case "memory": return <MemoryScene />;
    case "paint": return <PaintScene />;
    case "go": return <GoScene />;
    default: return <HelloScene />;
  }
}

function HelloScene() {
  return (
    <div className="ts-hello">
      <span className="ts-orbit" aria-hidden="true">
        <i /><i /><i />
      </span>
      <p className="ts-hello-k">A transformation, worked by two.</p>
    </div>
  );
}

const PAIR = [
  {
    role: "consultant" as const, who: "Consultant", doc: "Transformation Concept",
    what: "Where you are today, where you are going, and what it costs to stay put.",
  },
  {
    role: "coach" as const, who: "Coach", doc: "Change Plan",
    what: "Who is affected, what they are afraid of, and how the rollout actually lands.",
  },
];

function PairScene() {
  return (
    <div className="ts-pair">
      {PAIR.map(p => (
        <article key={p.role} className={`ts-card ${p.role}`}>
          <span className="ts-card-face" aria-hidden="true">
            <AgentMascot role={p.role} size={46} level={3} />
          </span>
          <h3>{p.who}</h3>
          <p>{p.what}</p>
          <span className="ts-doc"><IconDoc size={12} />{p.doc}</span>
        </article>
      ))}
      <span className="ts-pair-seam" aria-hidden="true" />
    </div>
  );
}

/** Reading pace for the typist. Faster than anyone reads, slow enough that
 *  the sentence still arrives rather than appearing. */
const MS_PER_CHAR = 11;

/**
 * Text arriving a character at a time, with the caret while it does.
 *
 * Its own component, keyed on the text by the caller, so the starting point
 * is a useState initializer rather than an effect resetting state it just
 * rendered — and the interval only ever writes from its own callback.
 */
function Typed({ text }: { text: string }) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(() => (reduced ? text.length : 0));

  useEffect(() => {
    if (reduced) return;
    // Driven by elapsed time, not by counting ticks. A background tab has
    // its timers clamped to about one a second, and a tick-counted typist
    // comes back to a sentence frozen a third of the way in — this one is
    // simply further along when the tab wakes up.
    const start = performance.now();
    const id = window.setInterval(() => {
      const at = Math.floor((performance.now() - start) / MS_PER_CHAR);
      setN(Math.min(at, text.length));
      if (at >= text.length) window.clearInterval(id);
    }, 24);
    return () => window.clearInterval(id);
  }, [text, reduced]);

  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <i className="ts-caret" aria-hidden="true" />}
    </>
  );
}

/**
 * The interview, as a thing that happens rather than a thing described.
 *
 * The choice buttons are the real pattern from the chat — the model emits
 * `[[CHOICES: a|b|c]]` and the panel draws them — so picking one here is the
 * same gesture as picking one in a project, and the answer is typed out for
 * the same reason it is in the real chat: a reply that appears all at once
 * reads as a lookup, not as someone thinking.
 */
function AskScene() {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="ts-chat">
      <div className="ts-bubble agent">
        <span className="ts-who"><AgentMascot role="coach" size={22} level={3} /> Coach</span>
        {TOUR_QUESTION}
      </div>

      {picked ? (
        <>
          <div className="ts-bubble you">{picked}</div>
          <div className="ts-bubble agent">
            <span className="ts-who"><AgentMascot role="coach" size={22} level={3} /> Coach</span>
            <Typed key={picked} text={TOUR_REPLIES[picked] ?? ""} />
          </div>
          <button className="ts-again" onClick={() => setPicked(null)}>Try another answer</button>
        </>
      ) : (
        <div className="ts-choices">
          {TOUR_CHOICES.map(c => (
            <button key={c} onClick={() => setPicked(c)}>{c}</button>
          ))}
        </div>
      )}
      <p className="ts-note">You can always type instead — the buttons are a shortcut, never the only way.</p>
    </div>
  );
}

const STATIONS = ["Starting point", "Current process", "People & systems", "Pain points", "Target state"];

/**
 * The document assembling. The station rail and the two visual blocks are
 * the real vocabulary — stations come from lib/deliverables.ts, and
 * `agxp-kpi` / `agxp-gap` are two of the six block types the model is allowed
 * to emit (lib/doc-visuals.ts draws the real ones).
 */
function BuildScene() {
  const reduced = usePrefersReducedMotion();
  // Finished, for anyone who asked the system to stop moving things: the
  // point of the scene is the assembled document, not the assembling.
  const [n, setN] = useState(() => (reduced ? STATIONS.length : 0));

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setN(v => (v >= STATIONS.length ? 0 : v + 1));
    }, 900);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="ts-build">
      <ol className="ts-stations">
        {STATIONS.map((s, k) => (
          <li key={s} className={k < n ? "done" : k === n ? "at" : ""}>
            <span className="ts-tick" aria-hidden="true">{k < n && <IconCheck size={9} />}</span>{s}
          </li>
        ))}
      </ol>

      <div className="ts-doc-mini" aria-hidden="true">
        <span className="ts-doc-h"><IconDoc size={11} /> Transformation Concept</span>
        <div className="ts-kpis">
          {[["Orders / day", "180"], ["Planning / tour", "12 min"], ["Diesel / month", "600 €"]].map(([l, v], k) => (
            <span key={l} className={`ts-kpi${k < Math.max(0, n - 1) ? " in" : ""}`}>
              <b>{v}</b><em>{l}</em>
            </span>
          ))}
        </div>
        <div className={`ts-gap${n >= 4 ? " in" : ""}`}>
          <span className="ts-gap-l">Planning / tour</span>
          <span className="ts-gap-bar"><i style={{ width: "100%" }} /><u style={{ width: "25%" }} /></span>
          <span className="ts-gap-v">12 → 3 min</span>
        </div>
      </div>
    </div>
  );
}

function MemoryScene() {
  return (
    <div className="ts-memory">
      <div className="ts-proj past">
        <span className="ts-proj-h">Last project</span>
        <b>Warehouse rollout</b>
      </div>

      <div className="ts-carry" aria-hidden="true">
        <span className="ts-carry-line" />
        <span className="ts-note-card">
          <IconSpark size={11} />
          Dispatchers resist losing manual control — show the gain early.
        </span>
      </div>

      <div className="ts-proj next">
        <span className="ts-proj-h">This project</span>
        <b>Supplier portal</b>
      </div>
      <p className="ts-note">Nothing is shared between accounts — an agent only remembers what it learned with you.</p>
    </div>
  );
}

/**
 * The only scene wired to the real app: these are the actual settings, and
 * they take effect behind the glass as you click. Teaching a setting by
 * describing it and then asking someone to go and find it is two jobs; this
 * is one, and they leave the tour with the app already looking the way they
 * want it.
 */
function PaintScene() {
  const [accent, setAccent] = useState<Accent>(() => readAccent());
  const { theme, setTheme } = useTheme();
  const appearance = useAppearance();

  function pick(a: Accent) {
    setAccent(a);
    applyAccent(a);
  }

  return (
    <div className="ts-paint">
      <div className="ts-set">
        <span className="ts-set-l">Accent</span>
        <div className="ts-swatches">
          {ACCENTS.map(a => (
            <button key={a.id} className={`ts-sw${accent.id === a.id ? " on" : ""}`}
              style={{ ["--sw" as string]: a.primary, ["--sw2" as string]: a.soft }}
              aria-pressed={accent.id === a.id} aria-label={a.label} data-tooltip={a.label}
              onClick={() => pick(a)}>
              {accent.id === a.id && <IconCheck size={12} />}
            </button>
          ))}
        </div>
      </div>

      <div className="ts-set">
        <span className="ts-set-l">Light or dark</span>
        <div className="ts-seg" role="group" aria-label="Theme">
          {([["light", "Light", IconSun], ["dark", "Dark", IconMoon], ["system", "System", IconMonitor]] as const)
            .map(([id, label, Ic]) => (
              <button key={id} className={theme === id ? "on" : ""} aria-pressed={theme === id}
                onClick={() => setTheme(id)}><Ic size={13} />{label}</button>
            ))}
        </div>
      </div>

      <div className="ts-set">
        <span className="ts-set-l">Glass</span>
        <div className="ts-seg" role="group" aria-label="How much glass">
          {GLASS_OPTIONS.map(o => (
            <button key={o.id} className={appearance.glass === o.id ? "on" : ""}
              aria-pressed={appearance.glass === o.id} data-tooltip={o.hint}
              onClick={() => setAppearance({ glass: o.id })}>{o.label}</button>
          ))}
        </div>
      </div>

      <p className="ts-note">Saved on this browser. Settings has the rest — your name, the plan, how wide each conversation sits.</p>
    </div>
  );
}

const RECAP = [
  { Ic: IconUsers, t: "Pick two agents", d: "One Consultant, one Coach. You can change either later." },
  { Ic: IconNodes, t: "Answer as you go", d: "They ask, you answer, the rail shows how far along you are." },
  { Ic: IconDoc, t: "Take the documents", d: "Both export when they are done. Nothing to assemble by hand." },
];

function GoScene() {
  return (
    <ul className="ts-go">
      {RECAP.map(({ Ic, t, d }) => (
        <li key={t}>
          <span className="ts-go-ic" aria-hidden="true"><Ic size={15} /></span>
          <b>{t}</b><span>{d}</span>
        </li>
      ))}
    </ul>
  );
}

/* --- Small shared bits ---------------------------------------------------- */

/**
 * True once React is running in the browser, false while rendering on the
 * server and on the very first client render.
 *
 * useSyncExternalStore rather than a `mounted` flag flipped in an effect:
 * the server snapshot is part of the hook, so there is one render with the
 * server's answer and then one with the real one — no effect writing state
 * it has just rendered, and nothing to clean up. The store never changes,
 * so subscribing is a no-op.
 */
function useOnClient(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}
function subscribeNever(): () => void { return () => {}; }

/** Read once per mount: a tour lasts a minute, and re-subscribing to the
 *  query on every scene costs more than it could possibly catch. */
function usePrefersReducedMotion(): boolean {
  return useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
}
