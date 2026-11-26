import type { Scan } from "./types";
import type { AiResult } from "./ai-types";
import { localDb } from "./local-db";
import { setScanTrash } from "./scan-trash";
export let hosted = false;
export function configureClient(value: boolean) {
  hosted = value;
}
const active = new Map<string, { scan: Scan; abort: AbortController }>();
export async function http<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    signal,
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  let value: any;
  try {
    value = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Try again.");
  }
  if (!response.ok) throw new Error(value.error || "Request failed.");
  return value;
}
function compactEvidence(scan: Scan, pageUrl?: string): Scan {
  const relevant = pageUrl
    ? scan.pages.filter((page) => page.url === pageUrl)
    : scan.pages;
  const result = {
    ...scan,
    sourcePageCount: scan.pages.length,
    pages: relevant.map(({ outline: _outline, technologies: _technologies, ...p }) => ({
      ...p,
      title: p.title.slice(0, 300),
      description: p.description.slice(0, 500),
      h1: p.h1.slice(0, 4).map((t) => t.slice(0, 300)),
      robots: p.robots.slice(0, 200),
      images: p.images
        .filter((i) => i.src.length <= 1000)
        .slice(0, 4)
        .map((i) => ({ ...i, alt: i.alt?.slice(0, 300) ?? null })),
      links: p.links
        .filter((l) => l.url.length <= 1000)
        .slice(0, 8)
        .map((l) => ({ ...l, text: l.text.slice(0, 100) })),
      paragraphs: p.paragraphs.slice(0, 5).map((t) => t.slice(0, 300)),
    })),
    issues: scan.issues
      .filter((i) => !pageUrl || i.url === pageUrl)
      .slice(0, 100)
      .map((i) => ({
        ...i,
        detail: i.detail.slice(0, 6000),
        action: i.action.slice(0, 3000),
      })),
    suggestions: scan.suggestions.slice(0, 12),
    skippedUrls: scan.skippedUrls.slice(0, 100),
  };
  if (JSON.stringify(result).length > 1_500_000)
    result.pages = result.pages.slice(0, 20);
  return result;
}
async function remoteCrawl(scan: Scan, abort: AbortController) {
  let persisted = 0;
  try {
    const response = await fetch("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: scan.id, url: scan.url, limit: scan.limit }),
      signal: abort.signal,
    });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "Scan failed.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Streaming is unavailable.");
    const decoder = new TextDecoder();
    let buffer = "",
      complete = false;
    const event = async (line: string) => {
      if (!line.trim()) return;
      const value = JSON.parse(line);
      if (value.type === "start") Object.assign(scan, value.scan);
      else if (value.type === "progress") {
        scan.pages.push(...value.pages);
        Object.assign(scan, {
          current: value.current,
          discovered: value.discovered,
          skipped: value.skipped,
          skippedUrls: value.skippedUrls,
        });
      } else if (value.type === "complete") {
        Object.assign(scan, value.scan);
        complete = true;
      } else if (value.type === "error") throw new Error(value.error);
      if (complete || Date.now() - persisted > 2000) {
        await localDb.saveScan(scan);
        persisted = Date.now();
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) await event(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) await event(buffer);
    if (!complete)
      throw new Error(
        "The connection ended before the scan completed. Partial pages are saved.",
      );
  } catch (error) {
    scan.status = abort.signal.aborted ? "cancelled" : "failed";
    scan.error = abort.signal.aborted ? undefined : (error as Error).message;
    scan.finishedAt = new Date().toISOString();
    scan.current = undefined;
    if (abort.signal.aborted)
      scan.notice.push("Scan stopped. Completed page evidence was saved.");
  } finally {
    await localDb.saveScan(scan).catch(() => {});
    active.delete(scan.id);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (!hosted) return http<T>(path, body, signal);
  if ((path === "/api/scans" || path === "/api/scans?trash=1") && body === undefined) {
    const scans = await localDb.scans();
    for (const scan of scans)
      if (scan.status === "running" && !active.has(scan.id)) {
        scan.status = "cancelled";
        scan.notice.push(
          "The browser session ended before this scan finished.",
        );
        await localDb.saveScan(scan);
      }
    return scans.filter(scan => Boolean(scan.deletedAt) === path.includes("trash=1"))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map(({ id, url, status, startedAt, pages, issues, deletedAt }) => ({
        id,
        url,
        status,
        startedAt,
        deletedAt,
        pages: pages.length,
        issues: issues.length,
      })) as T;
  }
  if (path === "/api/scans" && body) {
    if (active.size)
      throw new Error("Wait for the current scan or stop it first.");
    const input = body as { url: string; limit: number; sample?: boolean };
    if (input.sample) {
      const scan = await http<Scan>("/api/demo", {});
      await localDb.saveScan(scan);
      return { id: scan.id } as T;
    }
    const scan: Scan = {
      id: crypto.randomUUID(),
      url: input.url,
      status: "running",
      startedAt: new Date().toISOString(),
      limit: input.limit,
      pages: [],
      issues: [],
      suggestions: [],
      discovered: 1,
      skipped: 0,
      skippedUrls: [],
      notice: [],
    };
    await localDb.saveScan(scan);
    const abort = new AbortController();
    active.set(scan.id, { scan, abort });
    void remoteCrawl(scan, abort);
    return { id: scan.id } as T;
  }
  const match = path.match(/^\/api\/scans\/([\w-]+)(?:\/(stop|trash|restore))?$/);
  if (match) {
    if (match[2] === "stop") {
      active.get(match[1])?.abort.abort();
      return { ok: true } as T;
    }
    const scan = active.get(match[1])?.scan || (await localDb.scan(match[1]));
    if (!scan) throw new Error("Scan not found in this browser.");
    if (["trash", "restore"].includes(match[2]) && body) {
      if (scan.status === "running" || active.has(scan.id)) throw new Error("Stop the scan before deleting it.");
      const next = setScanTrash(scan, match[2] === "restore");
      await localDb.saveScan(next);
      return { ok: true } as T;
    }
    if (scan.deletedAt) throw new Error("This scan is in Trash. Restore it from Saved websites.");
    return structuredClone(scan) as T;
  }
  if (path.startsWith("/api/ai/reports?"))
    return (await localDb.reports(
      new URL(path, location.origin).searchParams.get("scanId") || "",
    )) as T;
  if (path === "/api/ai/research" && body) {
    const input = body as { scanId: string; pageUrl?: string };
    const scan = await localDb.scan(input.scanId);
    if (!scan) throw new Error("Open a saved scan first.");
    const report = await http<AiResult>(
      path,
      { ...body, scan: compactEvidence(scan, input.pageUrl) },
      signal,
    );
    await localDb.saveReport(report);
    return report as T;
  }
  return http<T>(path, body, signal);
}
export function cancelAll() {
  for (const entry of active.values()) entry.abort.abort();
}
