import type { Repair, Scan } from "./types";
export function nextTask(scan: Scan, repairs: Repair[]) {
  const waiting = repairs.find(r => r.workflow?.publishedAt && r.workflow.checks.at(-1)?.status !== "matches_draft");
  if (waiting) return { kind: "plan" as const, pageUrl: waiting.url, title: "Check the change you published", detail: "Your publication report is saved. Compare the page response with this exact draft next.", action: "Continue in Plan" };
  const urgent = scan.issues.find(i => i.severity === "high");
  if (urgent) return { kind: "finding" as const, pageUrl: urgent.url, title: urgent.label, detail: urgent.detail.slice(0, 220), action: "Review this finding", issueId: urgent.id };
  const unfinished = repairs.find(r => r.workflow?.checks.at(-1)?.status !== "matches_draft");
  if (unfinished) return { kind: "plan" as const, pageUrl: unfinished.url, title: "Finish your saved draft", detail: "Review the exact replacement, apply it in your website editor, then check the response here.", action: "Continue in Plan" };
  const issue = scan.issues.find(i => i.severity !== "info");
  if (issue) return { kind: "finding" as const, pageUrl: issue.url, title: issue.label, detail: issue.detail.slice(0, 220), action: "Review this finding", issueId: issue.id };
  return { kind: "pages" as const, pageUrl: scan.url, title: "Explore the pages we read", detail: "No higher-priority finding was recorded by these checks. Review the page evidence; this is not a complete SEO assessment.", action: "Review page evidence" };
}
