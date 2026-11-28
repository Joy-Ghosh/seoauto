import React, { useState } from "react";
import SemanticLinks from "./SemanticLinks";
import { editorialLinkPage } from "./link-eligibility";
import { ArrowDown, ArrowRight, FileText, Link2 } from "lucide-react";
import type { Page, Scan } from "./types";
import "./link-opportunities.css";

const path = (value: string) => { try { return new URL(value).pathname || "/"; } catch { return value; } };
const responseLabel = (page?: Page) => !page ? "Not scanned" : page.error ? "Could not read page" : page.status ? `HTTP ${page.status}` : "Response unknown";

export default function LinkOpportunities({ scan, page, inspect }: { scan: Scan; page?: Page; inspect: (page: Page) => void }) {
  const [semantic, setSemantic] = useState<import("./types").Suggestion[] | null>(null);
  const find = (url: string) => scan.pages.find(item => item.url === url) || scan.pages.find(item => item.finalUrl === url);
  const suggestions = (semantic || scan.suggestions).filter(item => { const source = find(item.source), target = find(item.target); return !!source && !!target && editorialLinkPage(source) && editorialLinkPage(target) && (!page || item.source === page.url || item.target === page.url); });
  return <section className="link-opportunities link-workshop" aria-label="Internal linking opportunities">
    <div className="link-workshop-heading"><span className="link-workshop-symbol"><Link2 size={22} aria-hidden="true" /></span><div><h3>Make a useful connection.</h3><p>{suggestions.length ? `${suggestions.length} candidate ${suggestions.length === 1 ? "connection" : "connections"} to review` : "Internal linking opportunities"}</p></div></div>
    <SemanticLinks scan={scan} page={page} onResults={setSemantic} />
    {semantic !== null && <span className="semantic-mode">Local meaning matches · sampled pages · review required</span>}
    <p className="evidence-hint">Donor = the source page you edit. Receiver = the destination page. Suggestions use captured page text; review the relevance and placement before publishing. Privacy/legal pages, noindex pages and unreadable responses are excluded.</p>
    <div className="link-workshop-list">{suggestions.map((item, index) => {
      const donor = find(item.source), receiver = find(item.target), start = item.context.indexOf(item.anchor);
      return <article className="link-connection" key={item.source + item.target + index}>
        <header className="link-connection-heading"><span className="link-connection-number">{String(index + 1).padStart(2, "0")}</span><strong>Proposed connection</strong><span className="link-draft-label">Not published</span></header>
        <div className="link-connection-route">
          <div className="link-page-card link-page-donor"><span className="link-page-role"><FileText size={15} aria-hidden="true" /> DONOR · ADD THE LINK HERE</span><a href={item.source} target="_blank" rel="noreferrer">{donor?.title || path(item.source)}</a><span className="link-page-path">{path(item.source)}</span><span className="link-response">{responseLabel(donor)}</span><button className="button secondary" disabled={!donor} onClick={() => donor && inspect(donor)}>Inspect donor links</button></div>
          <span className="link-connection-arrow" aria-hidden="true"><ArrowRight size={24} className="link-arrow-wide" /><ArrowDown size={24} className="link-arrow-narrow" /></span>
          <div className="link-page-card link-page-receiver"><span className="link-page-role"><Link2 size={15} aria-hidden="true" /> RECEIVER · DESTINATION</span><a href={item.target} target="_blank" rel="noreferrer">{receiver?.title || path(item.target)}</a><span className="link-page-path">{path(item.target)}</span><span className="link-response">{responseLabel(receiver)}</span><button className="button secondary" disabled={!receiver} onClick={() => receiver && inspect(receiver)}>Inspect receiver links</button></div>
        </div>
        <div className="link-placement"><span className="link-placement-label">PLACE THE LINK IN THIS DONOR TEXT</span><blockquote>{start >= 0 && item.anchor ? <>{item.context.slice(0, start)}<mark>{item.anchor}</mark>{item.context.slice(start + item.anchor.length)}</> : item.context}</blockquote><div className="link-anchor-preview"><span>Exact candidate anchor</span><strong>{item.anchor || "Rewrite needed — choose a natural phrase"}</strong></div></div>
        {!item.anchor && <p className="rewrite-note">The pages may be related, but no suitable existing anchor was established. Review and edit the donor paragraph before adding a link.</p>}
        <footer className="link-connection-footer"><div className="link-keywords"><span>{semantic ? "Meaning match" : "Shared words"}</span>{item.overlap.map((word, position) => <span className="link-keyword" key={word + position}>{word}</span>)}</div><p>Response evidence covers this scan only. A successful response does not prove indexability. Edit the donor page, then re-scan to check the published link.</p></footer>
      </article>;
    })}</div>
    {!suggestions.length && <div className="link-workshop-empty"><Link2 size={26} aria-hidden="true" /><strong>{semantic ? "No meaning matches passed the review filters." : "No new text-match connections here yet."}</strong><p>Existing links may already cover the relevant pages. A larger crawl or richer paragraph evidence can reveal more candidates.</p></div>}
  </section>;
}
