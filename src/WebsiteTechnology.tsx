import React, { useEffect, useMemo, useState } from "react";
import { Code2, RefreshCw } from "lucide-react";
import type { Scan } from "./types";
import { api } from "./client";
import { type Inspection, readInspection, scanTechnologies, technologyKey } from "./site-technology";

export default function WebsiteTechnology({ scan }: { scan: Scan }) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const sample = (new URL(scan.url).hostname === "sample.example" || new URL(scan.url).hostname === "127.0.0.1" && new URL(scan.url).pathname.startsWith("/fixture"));
  useEffect(() => {
    const abort = new AbortController();
    setInspection(null); setError(""); setBusy(false);
    if (sample || scan.status === "running") return () => abort.abort();
    let cached: Inspection | null = null;
    try { cached = readInspection(localStorage.getItem(technologyKey(scan.url)), scan.url); } catch {}
    if (cached && !attempt) { setInspection(cached); return () => abort.abort(); }
    setBusy(true);
    void api<Inspection>("/api/technology", { url: scan.url }, abort.signal).then(result => {
      if (abort.signal.aborted) return;
      setInspection(result);
      try { localStorage.setItem(technologyKey(scan.url), JSON.stringify(result)); } catch {}
    }).catch(reason => {
      if (!abort.signal.aborted) {
        const message = reason instanceof Error ? reason.message : "";
        setError(!message || /fetch failed|failed to fetch|networkerror/i.test(message)
          ? "Could not reach the website. Check that it is publicly available, then retry."
          : message);
      }
    })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [scan.id, scan.url, scan.status, sample, attempt]);
  const retained = useMemo(() => scanTechnologies(scan.pages, scan.url), [scan.pages, scan.url]);
  const technologies = inspection?.technologies.length ? inspection.technologies : retained;
  const fromScan = !inspection?.technologies.length && retained.length > 0;
  const category = (name: string) => ["WordPress", "Shopify", "Wix", "Webflow"].includes(name) ? "Platform" : ["PHP", "Laravel"].includes(name) ? "Backend" : ["React", "Vue"].includes(name) ? "UI library" : "Framework";
  return <section className="website-technology" aria-labelledby="website-technology-title" aria-busy={busy}>
    <div className="technology-heading"><span className="technology-symbol"><Code2 size={20} aria-hidden="true" /></span><div><h2 id="website-technology-title">Website technology</h2><p>{sample ? "Sample audit · technology inspection unavailable" : "Platform and framework signals from public website resources"}</p></div>
      <button className="button secondary" disabled={busy || sample || scan.status === "running"} onClick={() => setAttempt(n => n + 1)}><RefreshCw size={15} aria-hidden="true" />{busy ? "Detecting…" : "Recheck technology"}</button>
    </div>
    <div className="technology-body" role="status" aria-live="polite">
      {technologies.length ? <><ul className="technology-badges">{technologies.map(t => <li key={t.name}><span>{category(t.name)}</span><strong>{t.name}</strong><small>{t.confidence === "strong" ? "Detected" : "Possible"}</small></li>)}</ul>{fromScan && <p className="technology-provenance">Saved scan evidence · {new Date(scan.startedAt).toLocaleString()}{busy ? " · Checking live website…" : ""}</p>}</> : <p className="technology-empty">{busy ? "Checking for WordPress, Shopify, Next.js and other technology signals…" : error ? "Technology check could not finish." : scan.status === "running" ? "Technology inspection starts when your scan finishes." : sample ? "Scan a real website to identify its technology." : "No reliable platform identified. Some websites hide their technology."}</p>}
    </div>
    {error && <p className="error" role="alert">{error} Use Recheck technology to try again.</p>}
    <details className="technology-details"><summary>Detection evidence & limitations</summary>
      {technologies.map(t => <p key={t.name}><strong>{t.name}:</strong> {t.evidence}</p>)}
      {inspection && <p>Checked {new Date(inspection.inspectedAt).toLocaleString()} · HTTP {inspection.status} · {inspection.inspectedScripts} script assets inspected · cached for up to 24 hours.</p>}
      {fromScan && <p>Evidence retained in this scan. The live check {inspection ? "found no recognizable marker" : "has not confirmed this result"}; re-scan when the website is reachable to refresh it.</p>}
      <p>Public HTML, headers and up to two same-origin scripts; scripts are never executed. Respects robots.txt. Signals can be hidden or spoofed. A hidden CMS or backend remains unknown.</p>
    </details>
  </section>;
}
