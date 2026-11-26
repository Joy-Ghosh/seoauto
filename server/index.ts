import http from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { crawl } from "./crawler.js";
import { normalizeUrl } from "./audit.js";
import { createAiApi } from "./ai-api.js";
import { createSearchConsoleApi } from "./search-console.js";
import { inspectTechnology } from "./inspect-technology.js";
import type { Scan } from "../src/types.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = path.join(root, "data");
await mkdir(data, { recursive: true });
const scans = new Map<string, Scan>();
const controllers = new Map<string, AbortController>();
for (const name of await readdir(data)) {
  if (!name.endsWith(".json")) continue;
  try {
    const s = JSON.parse(await readFile(path.join(data, name), "utf8")) as Scan;
    if (s.status === "running") {
      s.status = "cancelled";
      s.notice.push("The previous session ended before this scan finished.");
    }
    scans.set(s.id, s);
  } catch {}
}
const production = process.argv.includes("--production");
const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({ root, server: { middlewareMode: true }, appType: "spa" });
const send = (res: http.ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
};
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const port = Number(process.env.PORT) || 4317;
const aiApi = createAiApi(data, scans);
const searchConsole = createSearchConsoleApi({ secret: process.env.APP_SECRET || randomUUID() + randomUUID(), passwordHash: "", secure: false });
const server = http.createServer(async (req, res) => {
  try {
    if (
      ![
        "127.0.0.1",
        `127.0.0.1:${port}`,
        "localhost",
        `localhost:${port}`,
      ].includes(req.headers.host || "")
    ) {
      send(res, 403, { error: "This app accepts localhost requests only." });
      return;
    }
    const u = new URL(req.url || "/", "http://127.0.0.1");
    if (u.pathname.startsWith("/api/")) {
      if (
        req.headers.origin &&
        !["http://127.0.0.1:" + port, "http://localhost:" + port].includes(
          req.headers.origin,
        )
      ) {
        send(res, 403, { error: "Cross-origin requests are not accepted." });
        return;
      }
      if (u.pathname.startsWith("/api/search-console/")) {
        let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 10000) { send(res, 413, { error: "Request too large." }); return; } }
        const headers = new Headers(); for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(",") : value);
        const response = await searchConsole(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, ...(body ? { body } : {}) }), u.pathname, "localhost");
        const outgoing: Record<string, string | string[]> = {}; for (const [key, value] of response.headers) if (key !== "set-cookie") outgoing[key] = value;
        if (response.headers.getSetCookie().length) outgoing["set-cookie"] = response.headers.getSetCookie(); res.writeHead(response.status, outgoing); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if (u.pathname === "/api/technology" && req.method === "POST") { let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 4000) { send(res, 413, { error: "Request too large." }); return; } } const input = JSON.parse(body); send(res, 200, await inspectTechnology(String(input.url || ""), AbortSignal.timeout(30000))); return; }
      if (await aiApi(req, res, u)) return;
      if (req.method === "GET" && u.pathname === "/api/scans") {
        send(
          res,
          200,
          [...scans.values()]
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .map(({ id, url, status, startedAt, pages, issues }) => ({
              id,
              url,
              status,
              startedAt,
              pages: pages.length,
              issues: issues.length,
            })),
        );
        return;
      }
      if (req.method === "POST" && u.pathname === "/api/scans") {
        if ([...scans.values()].some((s) => s.status === "running")) {
          send(res, 409, {
            error: "Wait for the current scan or stop it first.",
          });
          return;
        }
        if (!req.headers["content-type"]?.includes("application/json")) {
          send(res, 415, { error: "Expected JSON." });
          return;
        }
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 10000) {
            send(res, 413, { error: "Request too large." });
            return;
          }
        }
        const input = JSON.parse(body);
        const url = normalizeUrl(input.url);
        const limit = Math.max(
          1,
          Math.min(200, Math.floor(Number(input.limit) || 40)),
        );
        const scan: Scan = {
          id: randomUUID(),
          url,
          status: "running",
          startedAt: new Date().toISOString(),
          limit,
          pages: [],
          issues: [],
          suggestions: [],
          discovered: 1,
          skipped: 0,
          skippedUrls: [],
          notice: [],
        };
        scans.set(scan.id, scan);
        const controller = new AbortController();
        controllers.set(scan.id, controller);
        void crawl(scan, controller.signal, () => {
          if (scan.status !== "running") {
            void writeFile(
              path.join(data, scan.id + ".json"),
              JSON.stringify(scan),
            ).catch(console.error);
            controllers.delete(scan.id);
          }
        });
        send(res, 201, { id: scan.id });
        return;
      }
      const match = u.pathname.match(
        /^\/api\/scans\/([\w-]+)(?:\/(stop|report|csv))?$/,
      );
      const scan = match && scans.get(match[1]);
      if (!scan) {
        send(res, 404, { error: "Scan not found." });
        return;
      }
      if (req.method === "POST" && match![2] === "stop") {
        controllers.get(scan.id)?.abort();
        send(res, 200, { ok: true });
        return;
      }
      if (req.method === "GET" && match![2] === "csv") {
        const cell = (s: string) =>
          '"' +
          (/^(?:\s*[=+\-@]|[\t\r\n])/.test(s) ? "'" : "") +
          s.replace(/"/g, '""') +
          '"';
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="seo-issues.csv"',
        });
        res.end(
          "\uFEFF" +
            [
              ["Severity", "Issue", "URL", "Evidence", "Next step"],
              ...scan.issues.map((i) => [
                i.severity,
                i.label,
                i.url,
                i.detail,
                i.action,
              ]),
            ]
              .map((r) => r.map(cell).join(","))
              .join("\r\n"),
        );
        return;
      }
      if (req.method === "GET" && match![2] === "report") {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": 'attachment; filename="seo-audit.html"',
        });
        res.end(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SEO audit — ${esc(scan.url)}</title><style>body{font:15px/1.6 system-ui;max-width:1050px;margin:50px auto;padding:0 24px;color:#23372f}h1{font-size:32px}table{border-collapse:collapse;width:100%}td,th{text-align:left;vertical-align:top;padding:14px;border-bottom:1px solid #ddd}small{color:#53655d}a{color:#174b40}@media print{body{margin:0}tr{break-inside:avoid}}</style><h1>Website audit</h1><p>${esc(scan.url)}</p><p>${scan.pages.length} pages read · ${scan.issues.length} findings · ${esc(scan.status)} · ${esc(new Date(scan.startedAt).toISOString())}</p><h2>Coverage</h2><p>${esc(scan.notice.join(" "))}</p><p>Local rule-based checks, not a search ranking or traffic forecast. No website changes were made by the scan.</p><table><thead><tr><th>Finding</th><th>Page and evidence</th><th>Review action</th></tr></thead><tbody>${scan.issues.map((i) => `<tr><td><strong>${esc(i.label)}</strong><br><small>${esc(i.severity)}</small></td><td>${esc(i.url)}<br>${esc(i.detail)}</td><td>${esc(i.action)}</td></tr>`).join("")}</tbody></table><h2>Internal link candidates</h2>${scan.suggestions.map((s) => `<p><strong>${esc(s.anchor)}</strong><br>${esc(s.source)} → ${esc(s.target)}<br><small>Shared words: ${esc(s.overlap.join(", "))}. Text overlap only; review relevance and placement.</small></p>`).join("") || "<p>No safe text-match candidates were found in the scanned subset.</p>"}</html>`,
        );
        return;
      }
      if (req.method === "GET" && !match![2]) {
        send(res, 200, scan);
        return;
      }
      send(res, 405, { error: "Method not allowed." });
      return;
    }
    if (u.pathname === "/robots.txt") {
      res.end("User-agent: *\nAllow: /");
      return;
    }
    if (u.pathname.startsWith("/fixture")) {
      const key = u.pathname.replace(/\/$/, "");
      const pages: Record<string, string> = {
        "/fixture":
          '<title>Small website, useful ideas</title><meta name="description" content="A deliberately imperfect local sample for testing the SEO workbench."><h1>A small website with room to improve</h1><p>Start with a practical website performance checklist and improve website performance through small, measurable changes.</p><a href="/fixture/guide">Read the website guide</a><a href="/fixture/performance">Performance notes</a><a href="/fixture/contact">Contact</a>',
        "/fixture/guide":
          '<title>Guide</title><h1>A better website</h1><h1>Making changes</h1><p>Our website performance checklist helps teams review slow images, navigation and the content readers need. Start with small improvements and measure the result.</p><img src="/fixture/photo.svg"><a href="/fixture/missing">Old resource</a><a href="/fixture/">Home</a>',
        "/fixture/performance":
          '<title>Website performance checklist</title><meta name="description" content="A practical checklist for website performance, image sizes, navigation and clear content."><h1>Website performance checklist</h1><p>Website performance depends on useful content, efficient images and predictable navigation. This checklist helps you review the basics before making larger changes.</p><a href="/fixture/">Home</a>',
        "/fixture/contact":
          '<title>Contact the sample team</title><meta name="robots" content="noindex,nofollow"><p>This sample intentionally excludes the contact page from search indexing.</p><a href="/fixture/">Home</a>',
      };
      res.writeHead(pages[key] ? 200 : 404, {
        "Content-Type": "text/html; charset=utf-8",
      });
      res.end(
        '<!doctype html><html lang="en"><body>' +
          (pages[key] ||
            "<title>Page not found</title><h1>Page not found</h1>") +
          "</body></html>",
      );
      return;
    }
    if (vite) {
      vite.middlewares(req, res);
      return;
    }
    const rel = decodeURIComponent(u.pathname);
    const file = path.resolve(root, "dist", "." + rel);
    if (!file.startsWith(path.join(root, "dist") + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const b = await readFile(file);
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      res.end(b);
    } catch {
      res.setHeader("Content-Type", "text/html");
      res.end(await readFile(path.join(root, "dist/index.html")));
    }
  } catch (error) {
    send(res, 400, { error: (error as Error).message });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Local SEO Workbench: http://127.0.0.1:${port}`),
);
process.on("SIGINT", () => {
  controllers.forEach((c) => c.abort());
  server.close();
  void vite?.close();
});
