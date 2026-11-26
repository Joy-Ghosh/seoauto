import { siteHost } from "./search-data";
export type RemovedScan = { id: string; url: string; pageUrls: string[] };
export function clearScanStorage(scan: RemovedScan, remaining: { url: string }[], storage: Storage, session: Storage) {
  const sameSite = remaining.some(item => siteHost(item.url) === siteHost(scan.url));
  const exact = new Set(["repairs:" + scan.id, "seo:research-settings:" + scan.id, "seo:verify-request:" + scan.id, "seo:speed:" + scan.id]);
  const keys = Array.from({ length: storage.length }, (_,i) => storage.key(i)).filter((key): key is string => !!key);
  for (const key of keys) {
    if (exact.has(key) || key.startsWith("seo:issue-review:" + scan.id + ":")) storage.removeItem(key);
    if (!sameSite && (key === "seo:search-data:" + siteHost(scan.url) || key === "seo:site-technology:" + new URL(scan.url).origin || scan.pageUrls.some(url => key === "seo:technology:" + url || key.startsWith("seo:editor:" + url)))) storage.removeItem(key);
  }
  if (session.getItem("seo:last-scan") === scan.id) session.removeItem("seo:last-scan");
}
