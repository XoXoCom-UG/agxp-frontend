/** Short date for lists and timelines: "18 Jul 2026". */
export function dateStr(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
