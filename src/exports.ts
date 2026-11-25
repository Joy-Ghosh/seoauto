import type { Scan } from "./types";
function save(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function exportScan(scan: Scan) {
  save(
    "seo-audit.html",
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SEO audit</title><style>body{font:15px/1.7 system-ui;max-width:1050px;margin:40px auto;padding:20px;color:#243e35}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}small{color:#66766e}@media print{tr{break-inside:avoid}}</style><h1>Website audit</h1><p>${escape(scan.url)}</p><p>${scan.pages.length} pages · ${scan.issues.length} findings · ${escape(scan.status)} · ${escape(scan.startedAt)}</p><h2>Coverage</h2><p>${escape(scan.notice.join(" "))}</p><p>Response HTML checks, not a search ranking or traffic forecast.</p><table><thead><tr><th>Finding</th><th>Evidence</th><th>Next step</th></tr></thead><tbody>${scan.issues.map((issue) => `<tr><td><strong>${escape(issue.label)}</strong><br><small>${escape(issue.severity)}</small></td><td>${escape(issue.url)}<br>${escape(issue.detail)}</td><td>${escape(issue.action)}</td></tr>`).join("")}</tbody></table><h2>Internal-link candidates</h2>${scan.suggestions.map((s) => `<p>${escape(s.source)} → ${escape(s.target)}<br>Anchor: ${escape(s.anchor)}<br><small>Text overlap only; review relevance and placement.</small></p>`).join("") || "<p>No eligible candidates found.</p>"}</html>`,
    "text/html;charset=utf-8",
  );
}
export function csvCell(text: string) {
  return (
    '"' +
    (/^(?:\s*[=+\-@]|[\t\r\n])/.test(text) ? "'" : "") +
    text.replace(/"/g, '""') +
    '"'
  );
}
export function exportCsv(scan: Scan) {
  save(
    "seo-findings.csv",
    "\uFEFF" +
      [
        ["Severity", "Finding", "URL", "Evidence", "Next step"],
        ...scan.issues.map((i) => [
          i.severity,
          i.label,
          i.url,
          i.detail,
          i.action,
        ]),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
