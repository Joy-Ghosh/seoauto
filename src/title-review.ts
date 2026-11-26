import type { Page, Repair } from "./types";
const normalized = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();
export function titleConflicts(pages: Page[], existing: Repair[], candidates: Repair[]) {
  const proposed = new Map([...existing, ...candidates].filter(repair => repair.field === "title").map(repair => [repair.url, repair.value]));
  return new Set(candidates.filter(candidate => !candidate.value.trim() || pages.some(other => other.url !== candidate.url && other.finalUrl !== pages.find(page => page.url === candidate.url)?.finalUrl && normalized(proposed.get(other.url) ?? other.title) === normalized(candidate.value))).map(candidate => candidate.id));
}
