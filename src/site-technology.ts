import type { Page } from "./types";

export type Inspection = { url: string; status: number; favicon?: string | null; technologies: NonNullable<Page["technologies"]>; inspectedAt: string; inspectedScripts: number; limitation: string };
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
    // Older scans retain asset URLs even when technology metadata was not recorded.
    const pageOrigin = new URL(page.finalUrl || page.url).origin;
    const assets = [...page.images.map(image => image.src), ...page.links.map(link => link.url)];
    if (assets.some(asset => { try { const target = new URL(asset); return target.origin === pageOrigin && /\/(wp-content|wp-includes)\//i.test(target.pathname); } catch { return false; } })) {
      if (!hints.has("WordPress")) hints.set("WordPress", { name: "WordPress", confidence: "strong", evidence: "WordPress wp-content/wp-includes asset URLs retained in the saved scan" });
    }
  }
  return [...hints.values()];
}
