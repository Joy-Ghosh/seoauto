import React, { useEffect, useRef, useState } from "react";
import type { Page, Repair, Scan } from "./types";
import { api } from "./client";
import { collectResultRecords, type BaselineSummary, type ResultRecord } from "./result-records";
import { repairStatus } from "./repair-plan";
import VerificationPanel from "./VerificationPanel";
import "./phase-one.css";
import { Pip } from "./Pip";

export default function ResultsPanel({ scan, repairs, inspect, openPlan }: { scan: Scan; repairs: Repair[]; inspect: (page: Page) => void; openPlan: (id: string) => void }) {
  const [baselines, setBaselines] = useState<BaselineSummary[]>([]), [error, setError] = useState("");
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [filter, setFilter] = useState("all");
  const [hasRequest] = useState(() => { try { return !!localStorage.getItem("seo:verify-request:" + scan.id); } catch { return false; } });
  const [comparison, setComparison] = useState(hasRequest);
  const completedRequest = useRef(false);
  const compared = () => { setRevision(n => n + 1); if (hasRequest && !completedRequest.current) { completedRequest.current = true; setComparison(false); } };
  useEffect(() => { const stop = new AbortController(); setLoading(true); api<BaselineSummary[]>("/api/scans", undefined, stop.signal).then(setBaselines).catch(e => { if (!stop.signal.aborted) setError(e.message); }).finally(() => { if (!stop.signal.aborted) setLoading(false); }); return () => stop.abort(); }, [scan.id, revision]);
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener("storage", refresh); return () => window.removeEventListener("storage", refresh); }, []);
  const rows = baselines.some(b => b.id === scan.id) ? baselines : [...baselines, scan];
  const { records, unreadable } = collectResultRecords(scan.url, rows, key => localStorage.getItem(key), { id: scan.id, repairs });
  const checked = (row: ResultRecord) => !!row.repair.workflow?.checks.length;
  const pending = (row: ResultRecord) => row.repair.workflow?.checks.at(-1)?.status !== "matches_draft";
  const visible = records.filter(row => filter === "all" || (filter === "checked" ? checked(row) : pending(row)));
  return <section className="results-workspace" aria-labelledby="results-heading">
    <div className="section-heading"><div><h2 id="results-heading">Saved changes & checks</h2>{completedRequest.current && records.some(row => row.repair.workflow?.checks.at(-1)?.scanId === scan.id && row.repair.workflow.checks.at(-1)?.status === "matches_draft") && <Pip mood="checked" size={42} />}<p>Saved checks and unfinished drafts from this website’s available scans in this browser. A matching value is not a ranking result.</p></div></div>
    {new URL(scan.url).hostname === "127.0.0.1" && <p className="notice">Practice website · these records demonstrate value checks, not customer website changes.</p>}
    {loading && <p role="status">Loading this website’s saved work…</p>}
    {error && <p role="alert" className="error-box">Could not load all saved scans: {error} <button className="text-button" onClick={() => { setError(""); setRevision(n => n + 1); }}>Retry saved work</button></p>}
    {!!unreadable.length && <p role="alert" className="error-box">Some saved plans could not be read. Their original data has not been changed. Keep a backup before clearing browser data.</p>}
    <div className="page-segments result-filters" role="group" aria-label="Result filters">{[["all", "All saved work"], ["pending", "Needs attention"], ["checked", "Check attempts"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} ({records.filter(row => id === "all" || (id === "checked" ? checked(row) : pending(row))).length})</button>)}</div>
    {visible.map(({ baseline, repair }) => { const check = repair.workflow?.checks.at(-1); return <article className="result-card" key={baseline.id + ":" + repair.id}><div className="section-heading"><div><span className="eyebrow">{repair.field.replaceAll("_", " ")} · REVISION {repair.workflow?.revision || 1}</span><h3>{repairStatus(repair)}</h3></div><button className="button secondary" onClick={() => openPlan(baseline.id)}>Open baseline plan</button></div><a href={repair.url} target="_blank" rel="noreferrer">{repair.url}</a><dl className="result-values"><div><dt>Expected value</dt><dd>{repair.value || 'Empty alt: alt=""'}</dd></div><div><dt>{check ? "Observed value" : "Next step"}</dt><dd>{check ? check.actual === undefined ? "Unavailable — this value was not readable" : check.actual === null ? "Alt attribute missing" : check.actual || "Empty value" : repair.workflow?.publishedAt ? "Publication reported. Open the plan to check this page." : repair.workflow?.reviewedAt ? "Apply the reviewed change in your website editor." : "Review and approve the exact draft in your plan."}</dd></div></dl><p className="evidence-hint">Baseline: {new Date(baseline.startedAt).toLocaleString()}{check ? ` · Checked: ${new Date(check.checkedAt).toLocaleString()}` : " · No response check for this revision"}</p>{check?.status === "does_not_match" && <p>Compare the expected and observed text. Check publishing, caches and template overrides before changing the draft again.</p>}{check?.status === "not_checked" && <p>The draft is still here. Retry from the baseline plan when the page is readable.</p>}</article>; })}
    {!loading && !visible.length && <div className="fix-empty"><h3>{records.length ? "No saved work matches this filter." : "No saved changes for this website yet."}</h3><p>{records.length ? "Choose another filter to see the other drafts and checks." : "Start with a page finding, save an exact draft, then return after publishing. Your website has not been changed by opening this screen."}</p>{records.length ? <button className="button secondary" onClick={() => setFilter("all")}>Show all saved work</button> : <button className="button secondary" onClick={() => openPlan(scan.id)}>Open this scan’s plan</button>}</div>}
    <details className="advanced-comparison" open={comparison} onToggle={e => setComparison(e.currentTarget.open)}><summary>Advanced: compare scan evidence</summary><p>Choose an older baseline and compare it with the open scan. This is separate from your saved change history.</p>{(hasRequest || comparison) && <VerificationPanel scan={scan} inspect={inspect} returnToPlan={openPlan} onCompared={compared} />}</details>
  </section>;
}
