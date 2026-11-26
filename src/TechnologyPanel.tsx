import React, { useState } from "react";
import type { Page } from "./types";
import { api } from "./client";
import { readInspection, scanTechnologies } from "./site-technology";
type Inspection = { url: string; status: number; technologies: Page["technologies"]; inspectedAt: string; inspectedScripts: number; limitation: string };
export default function TechnologyPanel({ page }: { page: Page }) {
  const key = "seo:technology:" + page.url;
  const [inspection, setInspection] = useState<Inspection | null>(() => { try { return readInspection(localStorage.getItem(key), page.url); } catch { return null; } });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const inspect = async () => { setBusy(true); setError(""); try { const result = await api<Inspection>("/api/technology", { url: page.url }); setInspection(result); try { localStorage.setItem(key, JSON.stringify(result)); } catch {} } catch (error) { setError((error as Error).message); } finally { setBusy(false); } };
  const technologies = inspection?.technologies?.length ? inspection.technologies : scanTechnologies([page], page.url);
  return <section className="technology-evidence"><strong>Website technology hints</strong>{technologies?.length ? technologies.map(technology => <p key={technology.name}><strong>{technology.name}</strong> · {technology.confidence} hint · {technology.evidence}</p>) : <p>No reliable technology marker retained. Inspect now to check the page response and up to two same-origin JavaScript assets without executing them.</p>}{inspection && <small>Inspected {new Date(inspection.inspectedAt).toLocaleString()} · HTTP {inspection.status} · {inspection.inspectedScripts} script assets read</small>}<p><button className="button secondary" disabled={busy} onClick={() => void inspect()}>{busy ? "Inspecting public technology signals…" : "Detect technology now"}</button></p><small>Reads public resources and respects robots.txt. Evidence can be hidden or spoofed; an unknown backend is not proof of PHP, Laravel or any other framework.</small>{error && <p className="error" role="alert">{error}</p>}</section>;
}
