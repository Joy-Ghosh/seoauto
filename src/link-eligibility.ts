import type { Page } from "./types";
const legalSlugs = new Set(["privacy", "privacy-policy", "terms", "terms-of-service", "terms-and-conditions", "cookies", "cookie-policy", "legal", "disclaimer"]);
export function editorialLinkPage(page: Page) {
  const slug = new URL(page.url).pathname.toLowerCase().replace(/\/$/, "").split("/").pop()?.replace(/\.html?$/, "") || "";
  return page.status >= 200 && page.status < 300 && !page.error && !/\b(noindex|none)\b/i.test(page.robots) && !legalSlugs.has(slug);
}
