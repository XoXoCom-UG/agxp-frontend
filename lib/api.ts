/**
 * api.ts — centralised client for the Modal backend.
 * All fetch calls go through here so the base URL is one place to change.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

function headers(token?: string | null): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...headers(token), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────
export const api = {
  health: () => request<{ status: string }>("/api/health"),

  // ── Profile ────────────────────────────────────────────────
  getProfile: (token: string) =>
    request<Profile>("/api/profile", {}, token),

  saveProfile: (token: string, data: Partial<Profile>) =>
    request<{ ok: boolean }>("/api/profile", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),

  // ── Chat ───────────────────────────────────────────────────
  chat: (token: string, body: ChatRequest) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  research: (token: string, body: ResearchRequest) =>
    request<ChatResponse>("/api/research", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  // ── History ────────────────────────────────────────────────
  getHistory: (token: string, n = 200) =>
    request<{ sessions: Session[]; count: number }>(`/api/history?n=${n}`, {}, token),

  getSession: (token: string, sessionId: string) =>
    request<Session>(`/api/session/${sessionId}`, {}, token),

  deleteSession: (token: string, sessionId: string) =>
    request<{ ok: boolean }>(`/api/session/${sessionId}`, { method: "DELETE" }, token),

  // ── Projects ───────────────────────────────────────────────
  getProjects: (token: string) =>
    request<{ projects: Project[] }>("/api/projects", {}, token),

  createProject: (token: string, name: string) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }, token),

  renameProject: (token: string, project_id: string, name: string) =>
    request<{ ok: boolean }>("/api/projects/rename", {
      method: "POST",
      body: JSON.stringify({ project_id, name }),
    }, token),

  deleteProject: (token: string, project_id: string, delete_chats = false) =>
    request<{ ok: boolean }>("/api/projects/delete", {
      method: "POST",
      body: JSON.stringify({ project_id, delete_chats }),
    }, token),

  getProjectSessions: (token: string, projectId: string) =>
    request<{ sessions: Session[] }>(`/api/projects/${projectId}/sessions`, {}, token),

  assignSession: (token: string, session_id: string, project_id: string | null) =>
    request<{ ok: boolean }>("/api/session/assign", {
      method: "POST",
      body: JSON.stringify({ session_id, project_id }),
    }, token),

  // ── Transformation Concept ─────────────────────────────────
  generateConcept: (token: string, body: TransformationRequest) =>
    request<ConceptResponse>("/api/transformation", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  saveConcept: (token: string, session_id: string, concept: ConceptData) =>
    request<{ ok: boolean }>("/api/transformation/save", {
      method: "POST",
      body: JSON.stringify({ session_id, concept }),
    }, token),

  getConcept: (token: string, session_id: string) =>
    request<{ concept: ConceptData; title: string } | null>(
      `/api/transformation/${session_id}`, {}, token
    ),

  // ── Roadmap ────────────────────────────────────────────────
  generateRoadmap: (token: string, session_id: string, regenerate = false) =>
    request<{ roadmap: RoadmapData; cached?: boolean }>("/api/roadmap", {
      method: "POST",
      body: JSON.stringify({ session_id, regenerate }),
    }, token),

  getRoadmap: (token: string, session_id: string) =>
    request<{ roadmap: RoadmapData }>(`/api/roadmap/${session_id}`, {}, token),

  saveRoadmap: (token: string, session_id: string, roadmap: RoadmapData) =>
    request<{ ok: boolean }>("/api/roadmap/save", {
      method: "POST",
      body: JSON.stringify({ session_id, roadmap }),
    }, token),

  // ── Deck ───────────────────────────────────────────────────
  getDeck: (token: string, n = 200) =>
    request<{ deck: DeckRow[] }>(`/api/deck?n=${n}`, {}, token),

  // ── Assistant side-thread (right panel, per conversation) ──
  getAssistantThread: (token: string, scopeKey: string) =>
    request<{ messages: Message[] }>(`/api/assistant-thread/${encodeURIComponent(scopeKey)}`, {}, token),

  saveAssistantThread: (token: string, scopeKey: string, messages: Message[]) =>
    request<{ ok: boolean }>("/api/assistant-thread", {
      method: "POST",
      body: JSON.stringify({ scope_key: scopeKey, messages }),
    }, token),

  // ── Assisted edit of Concept / Roadmap ─────────────────────
  assistantEdit: (token: string, body: {
    kind: "concept" | "roadmap";
    current: ConceptData | RoadmapData;
    target?: string;
    instruction: string;
    messages?: Message[];
  }) =>
    request<{ reply: string; updated: ConceptData | RoadmapData }>("/api/assistant-edit", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),
};

// ── Types ─────────────────────────────────────────────────────

export interface Profile {
  name?: string;
  background?: string;
  current_project?: string;
  target_market?: string;
  business_stage?: string;
  interests?: string;
  notes?: string;
  display_name?: string;
  email?: string;
}

export interface Message {
  role: "user" | "assistant";
  // Backend may return an array of Anthropic content blocks instead of a plain string
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}

export interface Session {
  session_id: string;
  title: string;
  saved_at: string;
  message_count: number;
  messages?: Message[];
  project_id?: string | null;
}

export interface Project {
  project_id: string;
  name: string;
  chats: number;
  created_at: string;
  // Consent flags the agent records in-chat; null = not asked yet
  use_profile?: boolean | null;
  use_other_projects?: boolean | null;
}

export interface DeckRow {
  session_id: string;
  title: string;
  message_count: number;
  saved_at: string;
  has_concept: boolean;
  concept_title: string;
}

export interface ChatRequest {
  messages: Message[];
  model?: string;
  session_id?: string;
  user_id?: string;
  project_id?: string | null;
  guided?: boolean;
  persona?: "berater" | "kritiker";
}

export interface ResearchRequest {
  messages: Message[];
  model?: string;
  session_id?: string;
  user_id?: string;
  allow_web?: boolean;
}

export interface ChatResponse {
  response: string;
  messages: Message[];
  session_id: string;
}

export interface TransformationRequest {
  messages: Message[];
  session_id?: string;
  refine_instruction?: string;
}

export interface GoalTableRow {
  ziel: string;
  tooling: string;
  alternativen: string[];
}

export type MeasureCategory = "tooling" | "agile" | "business" | "security";

/** One recommended "Mehrwert" measure, freshly written per client by the agent.
 *  Rendered by the switchable diagram views (bento / matrix / dependencies /
 *  radar). Everything except id+title is optional so an older backend that
 *  doesn't emit this section yet degrades silently. */
export interface RecommendedMeasure {
  id: string;
  title: string;
  category: MeasureCategory;
  lens?: string;
  description?: string;
  impact?: "Low" | "Medium" | "High";
  effort?: "S" | "M" | "L" | "XL";
  depends_on?: string[];
}

/** One rendered result card. `component` resolves the React renderer;
 *  `data` is validated server-side against the template's declared fields. */
export interface ConceptCard {
  template_id: string;
  component: string;
  /** From the TEMPLATE, not the component — four risk templates used to render
   *  four cards all titled "Risiken" with no way to tell them apart. */
  title?: string;
  /** Subject the card covers. At most one card per topic, which is what stops the
   *  section repeating itself. */
  topic?: string;
  data: Record<string, unknown>;
}

export interface ConceptData {
  title?: string;
  now?: { summary?: string; pain_points?: string[] };
  goal?: { summary?: string; outcomes?: string[]; table?: GoalTableRow[] };
  transformation_steps?: Array<{
    title: string;
    description?: string;
    effort?: string;
    business_value?: string;
    ai_model?: string;
    implementation_ideas?: string[];
    knowledge_needed?: string;
  }>;
  user_stories?: Array<{
    title: string;
    size?: string;
    story?: string;
    acceptance_criteria?: string;
  }>;
  business_value_summary?: {
    manual_effort?: string;
    error_rate?: string;
    cost_savings?: string;
  };
  recommended_measures?: RecommendedMeasure[];
  /** Distinct consultant perspectives across the measures, e.g. ["Agile Coaching", "Security Engineering"]. */
  measures_lens_summary?: string[];
  /** Result cards chosen to fit this concept's subject. Absent on concepts
   *  generated before the feature existed — the UI then falls back to the
   *  static KPI tiles built from business_value_summary. */
  cards?: ConceptCard[];
  /** Diagnostics: picked | picked_after_retry | fallback_* — why these cards. */
  cards_source?: string;
  cards_similarity?: number;
  /** Cards the user hid, and the one they pinned to the top. Template ids, kept in
   *  the concept blob so the choice survives a reload without a DB migration. */
  cards_hidden?: string[];
  cards_pinned?: string | null;
  /** Milestones the user ticked off inside a card, keyed by template id then by the
   *  item's own label. Labels rather than indexes, so a regenerated card with the
   *  same milestone keeps its tick. */
  card_state?: { checked?: Record<string, string[]> };
  /** What the user has actually done with the measures: which are ticked off, and
   *  any quadrant they moved by hand because they disagreed with the AI's call.
   *  Same storage trick as the card preferences — it lives in the concept blob. */
  measure_state?: {
    done?: string[];
    quadrant?: Record<string, string>;
  };
}

export interface ConceptResponse {
  concept: ConceptData;
  session_id: string;
}

export interface RoadmapData {
  title?: string;
  overview?: string;
  phases?: Array<{
    name: string;
    goal: string;
    steps: Array<{
      id: string;
      title: string;
      what?: string;
      why?: string;
      effort?: string;
      depends_on?: string[];
      tools?: Array<{
        name: string;
        why?: string;
        pros?: string[];
        cons?: string[];
        verdict?: string;
      }>;
    }>;
  }>;
}
