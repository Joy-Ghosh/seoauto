import React, { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, FileSearch, GitBranch } from "lucide-react";
import type { Issue, Page, Repair, Scan } from "./types";
import { editableField, fixSteps, linkStatus, pageLinks } from "./page-evidence";
import ProblemAssistant from "./ProblemAssistant";
import PageSkeleton from "./PageSkeleton";
import LinkOpportunities from "./LinkOpportunities";

type Review = { state: "open" | "planned" | "recheck" | "intentional"; note: string };
const labels = { open: "Open", planned: "Fix planned", recheck: "Changed · needs re-scan", intentional: "Reviewed intentionally" };
const path = (url: string) => { const value = new URL(url); return value.pathname + value.search; };

export default function PageEvidence({ page, scan, initialIssueId, inspect, draft, save, setup }: {
  page: Page; scan: Scan; initialIssueId?: string;
  inspect: (page: Page) => void;
  draft: (field: Repair["field"]) => void;
  save: (repair: Repair) => void;
  setup: () => void;
}) {
  const issues = scan.issues.filter(issue => issue.url === page.url);
  const [tab, setTab] = useState<"issues" | "links" | "skeleton">("issues");
  const [activeIssue, setActiveIssue] = useState(initialIssueId);
  const [aiIssue, setAiIssue] = useState<Issue>();
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [storageError, setStorageError] = useState("");
  const storageKey = "seo:issue-review:" + scan.id + ":" + page.url;
  const [reviews, setReviews] = useState<Record<string, Review>>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return Object.fromEntries(issues.filter(issue => data[issue.id] && Object.hasOwn(labels, data[issue.id].state))
        .map(issue => [issue.id, { state: data[issue.id].state, note: typeof data[issue.id].note === "string" ? data[issue.id].note.slice(0, 2000) : "" }]));
    } catch { return {}; }
  });
  const links = useMemo(() => pageLinks(page, scan.pages), [page, scan.pages]);
  const known = useMemo(() => {
    const index = new Map(scan.pages.map(p => [p.url, p]));
    for (const p of scan.pages) if (!index.has(p.finalUrl)) index.set(p.finalUrl, p);
    return index;
  }, [scan.pages]);
  const updateReview = (issue: Issue, patch: Partial<Review>) => {
    const next = { ...reviews, [issue.id]: { ...(reviews[issue.id] || { state: "open" as const, note: "" }), ...patch } };
    setReviews(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("Review notes could not be saved to browser storage. Export this page’s action list before closing."); }
  };
  const exportActions = () => {
    const text = [`# Page action list`, page.url, `Scan: ${scan.startedAt}`, "Review states are manual work notes, not verified resolutions.", ...issues.flatMap(issue => [
      `\n## ${issue.label} (${issue.severity})`, issue.detail, `State: ${labels[reviews[issue.id]?.state || "open"]}`, `Note: ${reviews[issue.id]?.note || ""}`,
      ...fixSteps(issue, page).map((step, index) => `${index + 1}. ${step}`),
    ])].join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "seo-page-actions.md"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const outgoing = links.outgoing.filter(link => {
    const match = (link.url + " " + link.text).toLowerCase().includes(query.toLowerCase());
    return match && (scope === "all" || scope === "internal" && link.internal || scope === "external" && !link.internal || scope === "errors" && !!link.target && link.target.status >= 400 || scope === "unknown" && (!link.target || !!link.target.error || !link.target.status));
  });
  const incoming = links.incoming.filter(link => (link.source.url + " " + link.text).toLowerCase().includes(query.toLowerCase()));
  const targets = (issue: Issue) => issue.type === "broken_internal" ? issue.detail.split(/\r?\n/).filter(url => /^https?:\/\//.test(url)) : [];
  const showLink = (url: string, target?: Page) => <div className="link-destination">
    <a href={url} target="_blank" rel="noreferrer">{url}<ArrowUpRight size={13} aria-hidden="true" /></a>
    <span className={"link-response " + (target && target.status >= 400 ? "bad" : "")}>{linkStatus(target)}</span>
    {target?.error && <small>{target.error}</small>}
    {target && target.finalUrl !== url && <small>Final URL: {target.finalUrl}</small>}
    {target && target.url !== page.url && <button className="text-button" onClick={() => inspect(target)}>Review linked page</button>}
  </div>;
  return <section className="page-evidence" aria-label="Page problems and internal links">
    <div className="evidence-switch" role="group" aria-label="Page review views">
      <button aria-pressed={tab === "issues"} onClick={() => setTab("issues")}><FileSearch size={16} />Problems ({issues.length})</button>
      <button aria-pressed={tab === "links"} onClick={() => setTab("links")}><GitBranch size={16} />Link structure</button>
      <button aria-pressed={tab === "skeleton"} onClick={() => setTab("skeleton")}>Page skeleton</button>
    </div>
    {tab === "skeleton" ? <PageSkeleton page={page} issues={issues} select={issue => { setActiveIssue(issue.id); setTab("issues"); }} /> : tab === "issues" ? <>
      <div className="section-heading"><h3>Problems on this page</h3><button className="text-button" onClick={exportActions}><ArrowDownToLine size={15} />Export action list</button></div>
      <p className="evidence-hint">Each finding includes evidence and a way to address it. Review states are saved in this browser; only a new scan can verify a live fix.</p>
      {storageError && <p className="error" role="alert">{storageError}</p>}
      {!issues.length && <p className="notice">No findings were recorded for this page in this scan. Open Link structure to inspect its connections.</p>}
      <button className="button secondary" onClick={() => setAiIssue({ id: "page-improvement", type: "page_review", label: "Improve this page’s headings, metadata or image descriptions", severity: "info", url: page.url, detail: "Review existing page evidence and the field I choose.", action: "Generate a draft for manual review." })}>Generate a page improvement</button>
      {issues.map(issue => <details className="issue-review" key={issue.id} open={activeIssue === issue.id || issues.length === 1}>
        <summary><span className={"severity-tag " + issue.severity}>{issue.severity === "high" ? "Needs attention" : issue.severity === "info" ? "Context" : "Review"}</span><strong>{issue.label}</strong><small>{labels[reviews[issue.id]?.state || "open"]}</small></summary>
        <div className="issue-review-body"><h4>What we found</h4><p className="evidence">{issue.detail}</p>
          {issue.type === "broken_internal" && <><p>The HTTP status at the top belongs to this source page. These are the destinations that returned error responses during this scan:</p><ul className="destination-list">{targets(issue).map(url => <li key={url}>{showLink(url, known.get(url))}<small>Anchor text: {page.links.filter(link => link.url === url).map(link => link.text || "No text label").join(" · ") || "Not retained in this scan"}</small></li>)}</ul></>}
          {issue.type === "missing_alt" && <ul className="destination-list">{page.images.filter(image => image.alt === null).map((image, index) => <li key={index}><a href={image.src} target="_blank" rel="noreferrer">{image.src}</a><small>Missing alt attribute. Check whether the image conveys meaning before adding text.</small></li>)}</ul>}
          {issue.type.startsWith("duplicate_") && <><h4>Pages with the same text</h4><ul className="destination-list">{scan.pages.filter(other => other.url !== page.url && other.status >= 200 && other.status < 300 && (issue.type === "duplicate_title" ? other.title.trim().replace(/\s+/g, " ").toLowerCase() === page.title.trim().replace(/\s+/g, " ").toLowerCase() : other.description.trim().replace(/\s+/g, " ").toLowerCase() === page.description.trim().replace(/\s+/g, " ").toLowerCase())).map(other => <li key={other.url}>{showLink(other.url, other)}</li>)}</ul></>}
          {issue.type === "canonical_review" && page.canonical && showLink(page.canonical, known.get(page.canonical))}
          {issue.type === "broken_internal" && <button className="text-button" onClick={() => { setTab("links"); setDirection("outgoing"); setScope("errors"); setQuery(""); }}>Inspect all error destinations</button>}
          {issue.type === "http_error" && <button className="text-button" onClick={() => { setTab("links"); setDirection("incoming"); setQuery(""); }}>Find pages linking to this URL</button>}
          <h4>How to address it</h4><ol>{fixSteps(issue, page).map(step => <li key={step}>{step}</li>)}</ol>
          {editableField(issue) && <button className="button secondary" onClick={() => draft(editableField(issue)!)}>Draft this fix</button>}
          <button className="button secondary" onClick={() => { setAiIssue(issue); requestAnimationFrame(() => document.getElementById("problem-ai-assistant")?.scrollIntoView({ block: "start" })); }}>Generate AI solution for this problem</button>
          <label>Work status<select value={reviews[issue.id]?.state || "open"} onChange={event => updateReview(issue, { state: event.target.value as Review["state"] })}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Resolution note (optional)<textarea rows={2} maxLength={2000} value={reviews[issue.id]?.note || ""} onChange={event => updateReview(issue, { note: event.target.value })} placeholder="What needs changing, where, and what you checked" /></label>
        </div>
      </details>)}
    </> : <>
      <h3>Internal linking structure</h3>
      <p className="evidence-hint">{new Set(links.incoming.map(link => link.source.url)).size} scanned pages link here · {links.outgoing.filter(link => link.internal).length} outgoing internal link occurrences. Incoming links cover this scan only. Repeated anchors are retained.</p>
      <div className="link-neighborhood" aria-label="Page link neighborhood">
        <div><strong>Incoming →</strong>{[...new Map(links.incoming.map(link => [link.source.url, link.source])).values()].slice(0, 4).map(source => <button key={source.url} onClick={() => inspect(source)}>{path(source.url)}</button>)}{!links.incoming.length && <small>None observed in this scan</small>}</div>
        <div><strong>{path(page.url)}</strong><small>Current page · {linkStatus(page)}</small></div>
        <div><strong>→ Outgoing</strong>{[...new Map(links.outgoing.filter(link => link.internal).map(link => [link.url, link])).values()].slice(0, 4).map(link => link.target ? <button key={link.url} onClick={() => inspect(link.target!)}>{path(link.url)} · {linkStatus(link.target)}</button> : <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{path(link.url)} · Not scanned</a>)}{!links.outgoing.some(link => link.internal) && <small>No internal destinations observed</small>}</div>
      </div><p className="evidence-hint">Map preview shows up to four connections per side. The searchable lists below include every retained link.</p>
      <div className="evidence-switch" role="group" aria-label="Link direction"><button aria-pressed={direction === "outgoing"} onClick={() => setDirection("outgoing")}>Outgoing ({links.outgoing.length})</button><button aria-pressed={direction === "incoming"} onClick={() => setDirection("incoming")}>Incoming ({links.incoming.length})</button></div>
      <label>Search URL or anchor text<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a page or a link label" /></label>
      {direction === "outgoing" && <label>Link filter<select value={scope} onChange={event => setScope(event.target.value)}><option value="all">All destinations</option><option value="internal">Internal links</option><option value="external">External links</option><option value="errors">HTTP errors</option><option value="unknown">Unscanned or unreadable</option></select></label>}
      <p className="evidence-hint">{direction === "outgoing" ? outgoing.length : incoming.length} matching link occurrences. “Not scanned” does not mean broken. Evidence reflects the scan date, not a live recheck.</p>
      <ul className="destination-list">{direction === "outgoing" ? outgoing.map((link, index) => <li key={index}>{showLink(link.url, link.target)}<small>Anchor: {link.text || "No text label"} · {link.internal ? "Internal" : "External"} · {link.nofollow ? "nofollow" : "follow"}</small>{link.target && link.target.status >= 400 && <p>{[401, 403, 429].includes(link.target.status) ? "Check access or rate limits before removing this link." : link.target.status >= 500 ? "Investigate the destination server before changing the source link." : "Correct, replace or remove this link, or restore its destination."}</p>}</li>) : incoming.map((link, index) => <li key={index}><button className="page-link" onClick={() => inspect(link.source)}>{link.source.title || path(link.source.url)}</button>{showLink(link.source.url, link.source)}<small>Anchor: {link.text || "No text label"} · {link.nofollow ? "nofollow" : "follow"} · Links to: {link.url}</small></li>)}</ul>
      {!(direction === "outgoing" ? outgoing.length : incoming.length) && <p className="notice">No matching links in this scan. Incoming links from unscanned pages are unknown.</p>}
      <p className="notice">To change a link, edit its source page or shared template in your CMS, publish, and re-scan. This workspace does not publish link edits.</p>
      <LinkOpportunities scan={scan} page={page} inspect={inspect} />
    </>}
    {aiIssue && <ProblemAssistant key={aiIssue.id} page={page} scan={scan} issue={aiIssue} save={save} setup={setup} />}
  </section>;
}
