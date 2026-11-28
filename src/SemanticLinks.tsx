import React, { useEffect, useRef, useState } from "react";
import type { Page, Scan, Suggestion } from "./types";
import { semanticPages } from "./semantic-links";
import "./semantic-links.css";
export default function SemanticLinks({ scan, page, onResults }: { scan: Scan; page?: Page; onResults: (rows: Suggestion[] | null) => void }) {
  const worker = useRef<Worker | null>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => () => { worker.current?.terminate(); if (timer.current) clearTimeout(timer.current); }, []);
  const stop = () => { worker.current?.terminate(); worker.current = null; if (timer.current) clearTimeout(timer.current); setBusy(false); };
  const run = () => {
    const pages = semanticPages(scan, page);
    if (pages.length < 2) { setError("At least two successful, non-legal pages without noindex are needed. Text matching remains available."); return; }
    setBusy(true); setError(""); setMessage("Starting local meaning match…");
    try {
      worker.current ||= new Worker(new URL("./semantic.worker.ts", import.meta.url), { type: "module" });
      worker.current.onmessage = event => {
        if (event.data.type === "progress") setMessage(event.data.text);
        if (event.data.type === "result") { if (timer.current) clearTimeout(timer.current); setBusy(false); setMessage(`Compared ${event.data.pageCount} sampled pages locally. Review relevance and exact placement; no website was changed.`); onResults(event.data.suggestions); }
        if (event.data.type === "error") { stop(); setError(event.data.text); }
      };
      worker.current.onerror = () => { stop(); setError("The local worker could not start. Text matching still works; retry after checking browser permissions."); };
      worker.current.postMessage({ pages, focus: page?.url });
      timer.current = setTimeout(() => { stop(); setError("Local matching took too long and was stopped. Try fewer pages or return to text matching."); }, 180000);
    } catch { stop(); setError("Local matching is unavailable in this browser. Use the existing text candidates."); }
  };
  return <details className="semantic-tool"><summary>Optional: find connections by meaning</summary><p>Use a small English-focused model to compare up to 24 scanned pages. Processing runs in a worker on your device; page text is not sent to an inference API.</p><p className="evidence-hint">First use downloads model files from Hugging Face and the local runtime—tens of MB. Downloads may be cached by your browser. This uses your bandwidth and memory, not a shared AI key.</p><label className="ai-consent"><input type="checkbox" disabled={busy} checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Allow the model download and local processing. I understand this compares a sample and does not measure SEO impact.</span></label><div className="measurement-actions"><button className="button secondary" disabled={!consent || busy} onClick={run}>{busy ? "Comparing locally…" : "Match pages by meaning"}</button>{busy && <button className="button secondary" onClick={() => { stop(); setMessage("Local matching cancelled. Previous candidates remain available."); }}>Cancel local matching</button>}<button className="text-button" onClick={() => onResults(null)} disabled={busy}>Use text matches</button></div><p role="status">{message}</p>{error && <p className="error-box" role="alert">{error}</p>}</details>;
}
