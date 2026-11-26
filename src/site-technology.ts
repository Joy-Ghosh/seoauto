import type { Page } from "./types";

export type Inspection = { url: string; status: number; technologies: NonNullable<Page["technologies"]>; inspectedAt: string; inspectedScripts: number; limitation: string };
export const TECHNOLOGY_TTL = 24 * 60 * 60 * 1000;
export function technologyKey(url: string) { return "seo:site-technology:" + new URL(url).origin; }
export function readInspection(value: string | null, url: string, now = Date.now()): Inspection | null {
  try {
    const data = JSON.parse(value || "null") as Inspection;
    const age = now - Date.parse(data.inspectedAt);
    if (new URL(data.url).origin !== new URL(url).origin || !Number.isFinite(age) || age < 0 || age > TECHNOLOGY_TTL ||
      !Number.isInteger(data.status) || !Array.isArray(data.technologies) || !data.technologies.every(t =>
        typeof t.name === "string" && typeof t.evidence === "string" && ["strong", "possible"].includes(t.confidence))) return null;
    return data;
  } catch { return null; }
}
export function scanTechnologies(pages: Page[], url: string) {
  const hints = new Map<string, NonNullable<Page["technologies"]>[number]>();
  for (const page of pages) {
    try { if (new URL(page.url).origin !== new URL(url).origin) continue; } catch { continue; }
    for (const hint of page.technologies || []) {
      if (!hints.has(hint.name) || hint.confidence === "strong") hints.set(hint.name, hint);
    }
  }
  return [...hints.values()];
}
