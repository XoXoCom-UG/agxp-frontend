/**
 * Whether the first thing a user typed is worth naming a project after.
 *
 * The opening message used to become the project's name unconditionally, so
 * "Hallo" or "salut, wie geht's" ended up as a title in Project History. The
 * agent names the project properly once it knows what it is about
 * ([[TITLE:]], see lib/agent-prompt.ts); this only decides whether the stopgap
 * is better than the placeholder it replaces.
 */
export function worthNaming(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  return !(t.length < 20 && words <= 3);
}
