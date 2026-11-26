import React, { useEffect, useRef, useState } from "react";
import { Trash2, RotateCcw, X, AlertTriangle } from "lucide-react";
import { api, hosted } from "./client";
type SavedScan = { id: string; url: string; pages: number; issues: number; status: string; startedAt: string };
type Confirmation = { row: SavedScan; permanent: boolean };
export default function SavedWebsites({ close, select, changed }: { close: () => void; select: (id: string) => void; changed: (id: string, trashed: boolean) => void }) {
  const [rows, setRows] = useState<SavedScan[]>([]);
  const [trash, setTrash] = useState(false), [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0), [confirmation, setConfirmation] = useState<Confirmation | null>(null), [typed, setTyped] = useState("");
  const cancel = useRef<HTMLButtonElement>(null), previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const abort = new AbortController(); setBusy(true); setError("");
    void api<SavedScan[]>(trash ? "/api/scans?trash=1" : "/api/scans", undefined, abort.signal).then(result => { if (!abort.signal.aborted) setRows(result); }).catch(reason => { if (!abort.signal.aborted) setError(reason.message); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [trash, revision]);
  useEffect(() => { if (confirmation) cancel.current?.focus(); else previous.current?.focus(); }, [confirmation]);
  const dismiss = () => { if (busy && confirmation) return; if (confirmation) { setConfirmation(null); setTyped(""); } else close(); };
  function ask(row: SavedScan, permanent: boolean) { previous.current = document.activeElement as HTMLElement; setError(""); setTyped(""); setConfirmation({ row, permanent }); }
  async function update(row: SavedScan, action: "trash" | "restore" | "purge") {
    setBusy(true); setError("");
    try {
      const result = await api<{ warning?: string }>("/api/scans/" + row.id + "/" + action, action === "purge" ? { confirm: row.id } : {});
      changed(row.id, action !== "restore");
      setRows(previous => previous.filter(item => item.id !== row.id)); setConfirmation(null); setTyped("");
      setNotice(result.warning || (action === "restore" ? "Scan restored with its saved work." : action === "purge" ? "Scan and its saved research permanently deleted. Shared website data remains if other scans use it." : "Scan moved to Trash. Open Trash to restore it."));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  const visible = rows.filter(row => row.url.toLowerCase().includes(query.toLowerCase()));
  return <div className="scrim" onClick={dismiss}><section className="saved-websites-dialog" role={confirmation ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="saved-websites-title" aria-describedby="saved-websites-description" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); dismiss(); } }}>
    <button className="saved-websites-close" aria-label={confirmation ? "Cancel deletion" : "Close saved websites"} onClick={dismiss} disabled={busy} autoFocus><X size={20} aria-hidden="true" /></button>
    {confirmation ? <>
      <AlertTriangle className="destructive-symbol" size={28} aria-hidden="true" />
      <h2 id="saved-websites-title">{confirmation.permanent ? "Permanently delete this scan?" : "Move this scan to Trash?"}</h2>
      <p id="saved-websites-description">{confirmation.permanent ? "This cannot be undone. This scan, its research, drafts and review notes will be removed from this workspace. Downloaded backups and data on other devices are not erased." : "This scan will disappear from your saved list. Its research, drafts and notes stay in Trash until you restore it or permanently delete it."}</p>
      <div className="delete-target"><strong>{new URL(confirmation.row.url).host}</strong><p>{confirmation.row.url}</p><small>{confirmation.row.pages} pages · {new Date(confirmation.row.startedAt).toLocaleString()}</small></div>
      <p>Your live website will not be changed. Other scans of this website will stay.</p>
      {confirmation.permanent && <label>Type DELETE to confirm<input value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy} /></label>}
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="confirmation-actions"><button ref={cancel} className="button secondary" disabled={busy} onClick={dismiss}>{confirmation.permanent ? "Keep in Trash" : "Keep scan"}</button><button className="button danger" disabled={busy || (confirmation.permanent && typed !== "DELETE")} onClick={() => void update(confirmation.row, confirmation.permanent ? "purge" : "trash")}>{busy ? "Deleting…" : confirmation.permanent ? "Delete permanently" : "Move to Trash"}</button></div>
    </> : <>
      <h2 id="saved-websites-title">Saved websites</h2><p id="saved-websites-description">Open a scan or manage its saved work. Move scans to Trash first; permanent deletion is only available inside Trash.</p><small>{hosted ? "Saved in this browser on this device." : "Scans are saved on this computer; drafts stay in this browser."} Each scan is managed separately.</small>
      <div className="page-segments" role="group" aria-label="Saved websites view"><button aria-pressed={!trash} disabled={busy} onClick={() => { setTrash(false); setNotice(""); }}>Saved scans</button><button aria-pressed={trash} disabled={busy} onClick={() => { setTrash(true); setNotice(""); }}>Trash</button></div>
      {trash && <p className="evidence-hint">Restore brings your work back. Delete permanently removes it and cannot be undone.</p>}
      <label>Find a website<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by domain or URL" type="search" /></label>
      {error && <p className="error-box" role="alert">{error} <button className="text-button" onClick={() => setRevision(n => n + 1)}>Retry</button></p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="saved-website-list" aria-busy={busy}>{busy && <p role="status">Updating saved websites…</p>}{!busy && !visible.length && <p>{query ? "No websites match your search. Try a shorter domain name." : trash ? "Trash is empty. Deleted scans will appear here." : "No saved websites yet. Close this window and start a scan."}</p>}{visible.map(row => <article key={row.id}><div><strong>{new URL(row.url).host}</strong><p>{row.url}</p><small>{row.pages} pages · {row.issues} findings · {new Date(row.startedAt).toLocaleString()}</small></div><div className="saved-website-actions">{trash ? <button className="button secondary" disabled={busy} onClick={() => void update(row, "restore")} aria-label={"Restore " + row.url}><RotateCcw size={16} aria-hidden="true" />Restore</button> : <button className="button secondary" disabled={busy} onClick={() => select(row.id)}>Open scan</button>}<button className={"button " + (trash ? "danger-outline" : "secondary")} disabled={busy || row.status === "running"} onClick={() => ask(row, trash)} aria-label={(trash ? "Permanently delete scan for " : "Delete scan for ") + row.url}><Trash2 size={16} aria-hidden="true" />{trash ? "Delete permanently" : "Delete scan"}</button>{row.status === "running" && <small>Stop this scan before deleting.</small>}</div></article>)}</div>
    </>}
  </section></div>;
}
