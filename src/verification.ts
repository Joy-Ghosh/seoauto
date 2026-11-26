import type { Repair, Scan } from "./types";
import { siteHost } from "./search-data";
export function verifyChanges(before: Scan, after: Scan, repairs: Repair[] = []) {
  if (siteHost(before.url) !== siteHost(after.url)) throw new Error("Compare scans of the same website.");
  if (before.id === after.id || Date.parse(after.startedAt) <= Date.parse(before.startedAt)) throw new Error("Choose an older baseline scan and a newer verification scan.");
  if (after.status === "running") throw new Error("Finish the verification scan first.");
  const index = new Map(after.pages.map(page => [page.url, page]));
  for (const page of after.pages) if (!index.has(page.finalUrl)) index.set(page.finalUrl, page);
  const findings = before.issues.map(issue => {
    const old = before.pages.find(page => page.url === issue.url);
    const page = index.get(issue.url) || (old && index.get(old.finalUrl));
    const observed = page && !page.error && page.status > 0;
    const stillPresent = page && after.issues.some(next => next.url === page.url && next.type === issue.type);
    let coverageReason = "";
    if (page && !stillPresent && issue.type.startsWith("duplicate_")) {
      const peers = before.pages.filter(other => other.url !== issue.url && other.finalUrl !== old?.finalUrl && other.status >= 200 && other.status < 300);
      if (peers.some(other => { const next = index.get(other.url) || index.get(other.finalUrl); return !next || !!next.error || next.status < 200 || next.status >= 300; })) coverageReason = "The page value can be checked, but other baseline pages were not successfully re-scanned. Cross-page uniqueness is not verified.";
    }
    if (page && !stillPresent && issue.type === "broken_internal") {
      const oldErrors = issue.detail.split(/\r?\n/).filter(url => /^https?:\/\//.test(url));
      if (oldErrors.some(url => { if (!page.links.some(link => link.url === url)) return false; const destination = index.get(url); return !destination || !!destination.error || destination.status < 200 || destination.status >= 300; })) coverageReason = "Links to previously failing destinations are still present, but their successful responses were not verified in this scan.";
    }
    if (page && !stillPresent && issue.type === "redirect_alias" && (page.redirects || page.finalUrl !== page.url)) coverageReason = "The redirect still exists; the newer scan may simply lack the other destination record.";
    const status = !observed ? "not_checked" : stillPresent ? "still_present" : coverageReason || page.status >= 400 && issue.type !== "http_error" ? "not_checked" : "no_longer_observed";
    return { issue, status, response: page?.status || 0, reason: !page ? "URL was not covered by the newer scan." : page.error ? page.error : coverageReason || (status === "not_checked" ? "Page content was not successfully readable; absence of a finding is not proof of a fix." : status === "still_present" ? "The same check still reports a finding." : "This check no longer reports the finding in the newer response.") };
  });
  const drafts = repairs.map(repair => {
    const page = index.get(repair.url);
    const actual = !page || page.error || page.status < 200 || page.status >= 300 ? undefined : repair.field === "title" ? page.title : repair.field === "meta_description" ? page.description : page.images.find(image => image.src === repair.imageSrc)?.alt;
    return { repair, actual, status: actual === undefined ? "not_checked" : actual?.trim() === repair.value.trim() ? "matches_draft" : "does_not_match" };
  });
  const metadata = before.pages.flatMap(old => { const current = index.get(old.url) || index.get(old.finalUrl); if (!current || current.error || current.status < 200 || current.status >= 300) return []; return (["title", "description", "h1"] as const).flatMap(field => { const a = Array.isArray(old[field]) ? old[field].join(" / ") : old[field] as string; const b = Array.isArray(current[field]) ? current[field].join(" / ") : current[field] as string; return a === b ? [] : [{ url: old.url, field, before: a, after: b }]; }); });
  return { findings, drafts, metadata, newFindings: after.issues.filter(issue => !before.issues.some(old => old.url === issue.url && old.type === issue.type)) };
}
