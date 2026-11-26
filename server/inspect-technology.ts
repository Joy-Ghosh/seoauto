import { Parser } from "htmlparser2";
import { fetchDocument, robotsAllows, readRobots } from "./crawler.js";
import { publicFetch, publicUrl } from "./public-network.js";
import type { Page } from "../src/types.js";
export async function inspectTechnology(input: string, signal: AbortSignal, fetcher: typeof fetch = publicFetch) {
  const url = publicUrl(input); const origin = new URL(url).origin;
  let robots = await readRobots(url, signal, fetcher);
  if (!robotsAllows(robots, url)) throw new Error("robots.txt excludes this URL from inspection.");
  const doc = await fetchDocument(url, signal, fetcher);
  if (new URL(doc.url || url).origin !== origin) {
    robots = await readRobots(doc.url || url, signal, fetcher);
    if (!robotsAllows(robots, doc.url || url)) throw new Error("robots.txt excludes the redirected URL from further inspection.");
  }
  const technologies: NonNullable<Page["technologies"]> = [...(doc.technologies || [])];
  const add = (name: string, confidence: "strong" | "possible", evidence: string) => { if (!technologies.some(item => item.name === name)) technologies.push({ name, confidence, evidence }); };
  if (/<script[^>]+type=["']module["'][^>]+src=["'][^"']*\/assets\//i.test(doc.html)) add("Vite or similar ES-module build", "possible", "Production module script loaded from an assets directory; bundler identity is not proven");
  const scripts: string[] = [];
  new Parser({ onopentag(name, attrs) { if (name === "script" && attrs.src && scripts.length < 2) { try { const script = new URL(attrs.src, doc.url || url); if (script.origin === new URL(doc.url || url).origin && !scripts.includes(script.href)) scripts.push(script.href); } catch {} } } }).end(doc.html);
  let inspectedScripts = 0;
  for (const script of scripts) {
    if (!robotsAllows(robots, script)) continue;
    try { const response = await fetcher(script, { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) }); if (!response.ok || !/javascript|ecmascript|text\/plain/.test(response.headers.get("content-type") || "")) { await response.body?.cancel(); continue; }
      const reader = response.body?.getReader(); const parts: Uint8Array[] = []; let bytes = 0;
      try { while (reader && bytes < 700000) { const part = await reader.read(); if (part.done) break; const kept = part.value.subarray(0, 700000 - bytes); bytes += kept.length; parts.push(kept); } } finally { await reader?.cancel().catch(() => {}); }
      const text = Buffer.concat(parts).toString("utf8"); inspectedScripts++;
      if (/react\.transitional\.element|react-dom|react\.element/.test(text)) add("React", "strong", "React library marker in a first-party JavaScript asset (read as text, not executed)");
      if (/__VUE__|__vueParentComponent|createElementVNode/.test(text)) add("Vue", "possible", "Vue runtime marker in a first-party JavaScript asset");
      if (/__vite__mapDeps|vite\/modulepreload-polyfill/.test(text)) add("Vite", "strong", "Vite build helper in a first-party JavaScript asset");
    } catch { /* HTML hints remain useful if a bounded asset fetch fails. */ }
  }
  return { url, finalUrl: doc.url || url, status: doc.status, technologies, inspectedAt: new Date().toISOString(), inspectedScripts, limitation: "Passive hints can be hidden or spoofed. They do not prove an undisclosed PHP/Laravel/backend implementation or exact software version." };
}
