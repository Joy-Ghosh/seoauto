import type { Issue, Page, Repair } from "./types";

export function pageLinks(page: Page, pages: Page[]) {
  const known = new Map(pages.map(p => [p.url, p]));
  for (const p of pages) if (!known.has(p.finalUrl)) known.set(p.finalUrl, p);
  const origins = new Set([new URL(page.url).origin, new URL(page.finalUrl).origin]);
  const outgoing = page.links.map(link => ({
    ...link,
    target: known.get(link.url),
    internal: origins.has(new URL(link.url).origin),
  }));
  const incoming = pages.flatMap(source => source === page || source.url === page.url ? [] :
    source.links.filter(link => known.get(link.url)?.url === page.url).map(link => ({ ...link, source })));
  return { incoming, outgoing };
}

export function linkStatus(page?: Page) {
  if (!page) return "Not scanned";
  if (page.error || !page.status) return `Could not read${page.status ? ` · HTTP ${page.status}` : ""}`;
  return `HTTP ${page.status}${page.redirects ? ` · ${page.redirects} redirect${page.redirects === 1 ? "" : "s"}` : ""}`;
}

export function editableField(issue: Issue): Repair["field"] | null {
  if (["missing_title", "title_length", "duplicate_title"].includes(issue.type)) return "title";
  if (["missing_description", "duplicate_description"].includes(issue.type)) return "meta_description";
  if (issue.type === "missing_alt") return "alt_text";
  return null;
}

export function fixSteps(issue: Issue, page: Page): string[] {
  if (issue.type === "broken_internal") return [
    "Inspect each destination below. The source page can return HTTP 200 while its outgoing links return errors.",
    "For 404/410, correct the link URL, restore the intended article, or replace/remove the link. Add a relevant redirect only when a replacement exists.",
    "For 401/403/429, check access, firewall and rate-limit rules. Confirm in a browser before treating the destination as missing. For 5xx, repair the destination server.",
    "Edit the link in your website editor or shared navigation/footer template. Re-scan the source and destination to verify the result.",
  ];
  if (issue.type === "http_error") return [
    page.status === 404 || page.status === 410 ? "Restore this URL, redirect it to a relevant replacement, or remove/update incoming links." :
    [401, 403, 429].includes(page.status) ? "Check login requirements, firewall/bot rules and rate limits. This response does not prove the content is missing." :
    page.status >= 500 ? "Inspect the destination server logs, hosting and application errors, then restore a successful response." : "Inspect the response and correct the URL or server configuration.",
    "Use Incoming links to locate pages that reference this URL. Update shared templates if the same link appears throughout the site.",
    "Re-scan after publishing. A review status is a work note, not proof that the response changed.",
  ];
  if (issue.type === "fetch_error") return ["Check the URL, DNS, TLS, firewall and timeouts. A failed request is not a confirmed 404.", "Open the URL, investigate the server response, then re-scan."];
  if (editableField(issue)) return [issue.action, "Use Draft this fix below, compare the original and replacement, then save it to Plan.", "Export and apply the approved change in your CMS. Re-scan after publishing; saving a draft does not fix the live website."];
  if (["missing_h1", "multiple_h1"].includes(issue.type)) return [issue.action, `Current H1s: ${page.h1.join(" / ") || "none found"}. Update the heading hierarchy in the page or template editor.`, "Publish and re-scan. Headings cannot be applied through the metadata repair export."];
  if (issue.type === "noindex") return [issue.action, "If this page should be searchable, remove the unintended noindex directive in your CMS/SEO settings. Preserve it on pages that should stay private or out of search.", "Publish and re-scan. This app does not change robots settings."];
  if (issue.type === "canonical_review") return [issue.action, "Compare both URLs. Set the preferred equivalent URL in your CMS/SEO settings; do not change an intentional canonical just to remove a notice.", "Publish and re-scan the canonical response."];
  if (issue.type === "redirect_alias") return [issue.action, "Inspect the final destination and update incoming links if a direct link is appropriate.", "Re-scan after editing the source links."];
  return [issue.action, "Review the page in your website editor. Make a change only when it improves the visitor’s experience; informational checks may be intentional.", "Publish and re-scan, or record Reviewed intentionally with a note."];
}
