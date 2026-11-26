export type SpeedReport = {
  url: string; requestedUrl: string; device: string; fetchedAt: string | null; version: string;
  source: "google" | "import";
  scores: { id: string; label: string; score: number | null }[];
  metrics: { id: string; label: string; value: string }[];
  opportunities: { id: string; title: string; description: string; detail: string }[];
};
const record = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
export function speedUrl(value: string) {
  let url: URL; try { url = new URL(value); } catch { throw new Error("Enter the full page URL, for example https://example.com/page."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.href.length > 2500) throw new Error("Use an HTTP or HTTPS page URL without a username or password.");
  url.hash = ""; return url.href;
}
export function readSpeedSummary(value: unknown): SpeedReport {
  const report = record(value);
  if (!["google", "import"].includes(report.source) || typeof report.device !== "string" || typeof report.version !== "string" || report.version.length > 50 || !Array.isArray(report.scores) || report.scores.length !== 4 || !report.scores.every((s: any) => typeof s.id === "string" && typeof s.label === "string" && (s.score === null || Number.isInteger(s.score) && s.score >= 0 && s.score <= 100)) || !Array.isArray(report.metrics) || report.metrics.length > 10 || !report.metrics.every((m: any) => [m.id,m.label,m.value].every(v=>typeof v === "string" && v.length < 200)) || !Array.isArray(report.opportunities) || report.opportunities.length > 20 || !report.opportunities.every((a: any) => [a.id,a.title,a.description,a.detail].every(v=>typeof v === "string" && v.length <= 2000))) throw new Error("This saved speed summary is invalid. Import the original Lighthouse JSON instead.");
  speedUrl(report.url); speedUrl(report.requestedUrl);
  if (report.fetchedAt !== null && (typeof report.fetchedAt !== "string" || !Number.isFinite(Date.parse(report.fetchedAt)))) throw new Error("Speed report has an invalid date.");
  return report as SpeedReport;
}
export function pageSpeedRequest(url: string, device: "mobile" | "desktop", key = "") {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", speedUrl(url)); endpoint.searchParams.set("strategy", device);
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) endpoint.searchParams.append("category", category);
  if (key.trim()) endpoint.searchParams.set("key", key.trim());
  return endpoint.href;
}
export function parseSpeedReport(input: unknown, source: "google" | "import"): SpeedReport {
  const envelope = record(input); const report = record(envelope.lighthouseResult || input);
  if (report.runtimeError) throw new Error("Lighthouse could not complete this page test. Check that the URL is publicly reachable and retry.");
  const categories = record(report.categories), audits = record(report.audits);
  if (!report.lighthouseVersion || !Object.keys(categories).length || !Object.keys(audits).length) throw new Error("Choose a Lighthouse or PageSpeed Insights JSON report, not a scan backup or HTML file.");
  const url = speedUrl(String(report.finalDisplayedUrl || report.finalUrl || report.requestedUrl || ""));
  const metrics = [["first-contentful-paint", "First Contentful Paint"], ["largest-contentful-paint", "Largest Contentful Paint"], ["total-blocking-time", "Total Blocking Time"], ["cumulative-layout-shift", "Cumulative Layout Shift"], ["speed-index", "Speed Index"], ["server-response-time", "Server response time"]];
  const metricIds = new Set(metrics.map(([id]) => id));
  return { url, requestedUrl: speedUrl(String(report.requestedUrl || url)), device: ["mobile", "desktop"].includes(report.configSettings?.formFactor) ? report.configSettings.formFactor : "not specified", fetchedAt: typeof report.fetchTime === "string" && Number.isFinite(Date.parse(report.fetchTime)) ? report.fetchTime : null, version: String(report.lighthouseVersion).slice(0, 50), source,
    scores: [["performance", "Performance"], ["accessibility", "Accessibility"], ["best-practices", "Best practices"], ["seo", "SEO"]].map(([id,label]) => { const score = record(categories[id]).score; return {id,label,score: typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1 ? Math.round(score * 100) : null}; }),
    metrics: metrics.map(([id,label]) => { const audit = record(audits[id]); const n = audit.numericValue; return {id,label,value: typeof audit.displayValue === "string" ? audit.displayValue.slice(0,100) : typeof n === "number" && Number.isFinite(n) ? id === "cumulative-layout-shift" ? n.toFixed(3) : (n / 1000).toFixed(2) + " s" : "Not measured"}; }),
    opportunities: Object.entries(audits).filter(([id, raw]) => { const audit = record(raw); return !metricIds.has(id) && typeof audit.score === "number" && audit.score < 0.9 && !["manual", "informative", "notApplicable"].includes(audit.scoreDisplayMode); }).sort(([,a],[,b]) => Number(record(a).score) - Number(record(b).score)).slice(0,20).map(([id, raw]) => { const audit = record(raw); return {id,title:String(audit.title || id).slice(0,300),description:String(audit.description || "Review this audit in the original Lighthouse report.").slice(0,2000),detail:String(audit.displayValue || "").slice(0,200)}; })
  };
}
