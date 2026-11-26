import React, { useEffect, useState } from "react";
import { Trash2, RotateCcw, X } from "lucide-react";
import { api, hosted } from "./client";
type SavedScan = { id: string; url: string; pages: number; issues: number; status: string; startedAt: string };
export default function SavedWebsites({ close, select, changed }: { close: () => void; select: (id: string) => void; changed: (id: string, trashed: boolean) => void }) {
  const [rows, setRows] = useState<SavedScan[]>([]);
  const [trash, setTrash] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setBusy(true); setError("");
    void api<SavedScan[]>(trash ? "/api/scans?trash=1" : "/api/scans", undefined, abort.signal).then(result => { if (!abort.signal.aborted) setRows(result); }).catch(reason => { if (!abort.signal.aborted) setError(reason.message); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [trash, revision]);
  async function update(row: SavedScan) {
    setBusy(true); setError("");
    try {
      await api("/api/scans/" + row.id + (trash ? "/restore" : "/trash"), {});
      changed(row.id, !trash);
      setRows(previous => previous.filter(item => item.id !== row.id));
      setNotice(trash ? "Scan restored with its saved work." : "Scan moved to Trash. You can restore it at any time.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  const visible = rows.filter(row => row.url.toLowerCase().includes(query.toLowerCase()));
  return <div className="scrim" onClick={close}><section className="saved-websites-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-websites-title" onClick={event => event.stopPropagation()}>
    <button className="icon-button saved-websites-close" aria-label="Close saved websites" onClick={close} autoFocus><X size={20} aria-hidden="true" /></button>
    <h2 id="saved-websites-title">Saved websites</h2><p>Manage every saved scan. Deleting moves a scan to Trash and keeps its drafts, notes and research for restoration. Your live website is never changed.</p><small>{hosted ? "Saved in this browser on this device." : "Scans are saved on this computer; drafts stay in this browser."} Separate scans of the same website are managed individually.</small>
    <div className="page-segments" role="group" aria-label="Saved websites view"><button aria-pressed={!trash} disabled={busy} onClick={() => { setTrash(false); setNotice(""); }}>Saved scans</button><button aria-pressed={trash} disabled={busy} onClick={() => { setTrash(true); setNotice(""); }}>Trash</button></div>
    <label>Find a website<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by domain or URL" type="search" /></label>
    {error && <p className="error-box" role="alert">{error} <button className="text-button" onClick={() => setRevision(n => n + 1)}>Retry</button></p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="saved-website-list" aria-busy={busy}>{busy && <p role="status">Updating saved websites…</p>}{!busy && !visible.length && <p>{query ? "No websites match your search." : trash ? "Trash is empty." : "No saved websites yet. Start a new scan."}</p>}{visible.map(row => <article key={row.id}><div><strong>{new URL(row.url).host}</strong><p>{row.url}</p><small>{row.pages} pages · {row.issues} findings · {new Date(row.startedAt).toLocaleString()}</small></div><div className="saved-website-actions">{!trash && <button className="button secondary" disabled={busy} onClick={() => select(row.id)}>Open scan</button>}<button className="button secondary" disabled={busy || row.status === "running"} onClick={() => void update(row)} aria-label={(trash ? "Restore " : "Delete scan for ") + row.url}>{trash ? <RotateCcw size={16} aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}{trash ? "Restore" : "Delete scan"}</button>{row.status === "running" && <small>Stop this scan before deleting.</small>}</div></article>)}</div>
  </section></div>;
}
