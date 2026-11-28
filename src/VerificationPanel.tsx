import React, { useEffect, useRef, useState } from "react";
import type { Page, Repair, Scan } from "./types";
import { api } from "./client";
import { siteHost } from "./search-data";
import { verifyChanges } from "./verification";
import { readRepairPlan, recordPlanCheck } from "./repair-plan";
type ExpectedDraft = { id: string; revision: number; value: string };
type CheckRequest = { baseline: string; url: string; drafts?: ExpectedDraft[] };
export default function VerificationPanel({ scan, inspect, returnToPlan, onCompared }: { scan: Scan; inspect: (page: Page) => void; returnToPlan?: (baseline: string) => void; onCompared?: () => void }) {
  const [request] = useState<CheckRequest | null>(() => { try { const value = JSON.parse(localStorage.getItem("seo:verify-request:" + scan.id) || "null"); if (typeof value?.baseline !== "string" || typeof value?.url !== "string") return null; const drafts = Array.isArray(value.drafts) ? value.drafts.filter((draft: ExpectedDraft) => typeof draft?.id === "string" && typeof draft?.value === "string" && Number.isInteger(draft?.revision)).slice(0, 100) : undefined; return { baseline: value.baseline, url: value.url, drafts }; } catch { return null; } });
  const compared = useRef(false);
  const [history, setHistory] = useState<{ id: string; url: string; startedAt: string; pages: number }[]>([]);
  const [baseline, setBaseline] = useState(request?.baseline || ""); const [result, setResult] = useState<ReturnType<typeof verifyChanges>>(); const [before, setBefore] = useState<Scan>(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { const stop = new AbortController(); api<typeof history>("/api/scans", undefined, stop.signal).then(rows => setHistory(rows.filter(row => row.id !== scan.id && siteHost(row.url) === siteHost(scan.url) && row.startedAt < scan.startedAt))).catch(error => { if (!stop.signal.aborted) setError(error.message); }); return () => stop.abort(); }, [scan.id]);
  const compare = async () => {
    setBusy(true); setError(""); setResult(undefined);
    try {
      const old = await api<Scan>("/api/scans/" + baseline);
      const drafts = readRepairPlan(localStorage.getItem("repairs:" + old.id));
      const scoped = request ? { ...old, issues: old.issues.filter(issue => issue.url === request.url) } : old;
      const selected = request ? drafts.filter(draft => draft.url === request.url && (!request.drafts || request.drafts.some(expected => expected.id === draft.id && expected.revision === (draft.workflow?.revision || 1) && expected.value === draft.value))) : drafts;
      const comparison = verifyChanges(scoped, scan, selected);
      setBefore(old); setResult(comparison);
      if (request?.drafts?.length) {
        if (!selected.length) setError("The requested draft has changed or was removed. No previous result was applied to it. Return to the baseline plan and check its current revision.");
        // Re-read immediately before writing: never recreate a deleted plan or overwrite a new revision.
        const raw = localStorage.getItem("repairs:" + old.id);
        if (raw !== null) {
          const current = readRepairPlan(raw);
          const updated = current.map(repair => {
            const row = comparison.drafts.find(row => row.repair.id === repair.id);
            const expected = request.drafts!.find(item => item.id === repair.id);
            return row && expected && (!repair.workflow?.publishedAt || Date.parse(scan.startedAt) >= Date.parse(repair.workflow.publishedAt)) ? recordPlanCheck(repair, expected, { scanId: scan.id, checkedAt: scan.finishedAt || new Date().toISOString(), status: row.status as "matches_draft" | "does_not_match" | "not_checked", ...(row.actual !== undefined ? { actual: row.actual } : {}) }) : repair;
          });
          try { localStorage.setItem("repairs:" + old.id, JSON.stringify(updated)); onCompared?.(); }
          catch { setError("The comparison is visible, but it could not be saved to your plan. Export or copy this result before leaving."); }
        }
      }
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { if (request && baseline && scan.status !== "running" && !compared.current) { compared.current = true; void compare(); } }, [scan.status, baseline]);
  return <section className="panel verification-panel"><h2>Check what the page serves</h2>{request && returnToPlan && <button className="button secondary" onClick={() => returnToPlan(request.baseline)}>Return to baseline plan</button>}{request && <p className="notice">Verification is focused on {request.url}. The baseline was selected automatically from the page or saved plan you re-scanned.</p>}{!request && <><p>This open scan is the verification scan. Choose an older scan of this website as the baseline. The comparison checks response evidence, findings and saved metadata drafts; it does not measure ranking impact.</p><ol><li>Save the original scan and drafts before editing.</li><li>Publish the approved changes in your website editor.</li><li>Run a new scan covering the edited URLs, open it here, and compare.</li></ol><label>Older baseline scan<select disabled={!!request} value={baseline} onChange={event => { setBaseline(event.target.value); setResult(undefined); }}><option value="">Choose an older scan</option>{history.map(row => <option value={row.id} key={row.id}>{new Date(row.startedAt).toLocaleString()} · {row.pages} pages</option>)}</select></label><button className="button primary" disabled={!baseline || busy || scan.status === "running"} onClick={() => void compare()}>{busy ? "Comparing response evidence…" : "Compare scans"}</button></>}
    {!request && !history.length && <p className="notice">No older scan of this site is saved in this workspace. Keep this scan as a baseline, publish your changes, then run another scan. You can also import a baseline backup.</p>}{error && <p className="error-box" role="alert">{error}</p>}
    {result && <><h3>Comparison results</h3><h3>Saved draft verification</h3>{!result.drafts.length && <p>No metadata drafts were saved for this baseline in this browser. Finding and metadata comparisons still work.</p>}{result.drafts.map(row => <article className="verification-row" key={row.repair.id}><strong>{row.repair.field} · {row.status.replaceAll("_", " ")}</strong><a href={row.repair.url} target="_blank" rel="noreferrer">{row.repair.url}</a><p>Expected: {row.repair.value}</p><p>Observed: {row.actual === undefined ? "Not checked" : row.actual === null ? "Alt attribute missing" : row.actual === "" ? "Empty value" : row.actual}</p></article>)}
      <details className="comparison-observations"><summary>Other scan observations and coverage</summary><p>Baseline: {new Date(before!.startedAt).toLocaleString()} → New scan: {new Date(scan.startedAt).toLocaleString()}</p><div className="search-metrics">{(["no_longer_observed", "still_present", "not_checked"] as const).map(status => <span key={status}><strong>{result.findings.filter(row => row.status === status).length}</strong>{status.replaceAll("_", " ")}</span>)}<span><strong>{result.newFindings.length}</strong>New findings</span></div><p className="notice">“No longer observed” applies to this check and scan date. Unscanned, blocked or unreadable pages are not treated as fixed. Work notes do not affect these results.</p>
      <h3>Baseline findings</h3>{result.findings.map(row => <article className="verification-row" key={row.issue.id}><strong>{row.issue.label}</strong><span className="link-response">{row.status.replaceAll("_", " ")}</span><a href={row.issue.url} target="_blank" rel="noreferrer">{row.issue.url}</a><p>{row.reason}{row.response ? ` New response: HTTP ${row.response}.` : ""}</p>{scan.pages.find(page => page.url === row.issue.url) && <button className="text-button" onClick={() => inspect(scan.pages.find(page => page.url === row.issue.url)!)}>Inspect current page</button>}</article>)}
      <h3>Observed metadata changes</h3>{!result.metadata.length && <p>No title, description or H1 differences were observed on comparable pages.</p>}{result.metadata.map((row, index) => <article className="verification-row" key={index}><strong>{row.field} · {row.url}</strong><p>Before: {row.before || "Missing"}</p><p>After: {row.after || "Missing"}</p></article>)}
      <h3>New findings</h3>{result.newFindings.map(issue => <p key={issue.id}>{issue.label} · {issue.url}</p>)}{!result.newFindings.length && <p>No new findings in the newer scan.</p>}</details>
    </>}
  </section>;
}
