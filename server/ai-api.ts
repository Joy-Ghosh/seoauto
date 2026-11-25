import type http from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NvidiaClient, buildContext, validateInput } from "./ai.ts";
import { crawl } from "./crawler.ts";
import type { Scan } from "../src/types.ts";
import type { AiResult } from "../src/ai-types.ts";

export function createAiApi(
  dataDir: string,
  scans: Map<string, Scan>,
  nvidia = new NvidiaClient(),
) {
  let active: AbortController | null = null;
  const directory = path.join(dataDir, "ai");
  const send = (res: http.ServerResponse, status: number, body: unknown) => {
    if (res.destroyed) return;
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  const readBody = async (req: http.IncomingMessage) => {
    if (!req.headers["content-type"]?.includes("application/json"))
      throw new Error("Expected JSON.");
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 24_000)
        throw new Error("AI request is too large. Shorten the research notes.");
    }
    try {
      return JSON.parse(body);
    } catch {
      throw new Error("Invalid JSON request.");
    }
  };
  return async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ) => {
    if (!url.pathname.startsWith("/api/ai/")) return false;
    let controller: AbortController | null = null;
    try {
      if (req.method === "GET" && url.pathname === "/api/ai/status") {
        send(res, 200, nvidia.status());
      } else if (req.method === "GET" && url.pathname === "/api/ai/reports") {
        await mkdir(directory, { recursive: true });
        const reports: AiResult[] = [];
        for (const filename of await readdir(directory)) {
          if (!/^[\w-]+\.json$/.test(filename)) continue;
          try {
            const report = JSON.parse(
              await readFile(path.join(directory, filename), "utf8"),
            ) as AiResult;
            if (report.scanId === url.searchParams.get("scanId"))
              reports.push(report);
          } catch {}
        }
        send(
          res,
          200,
          reports
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 20),
        );
      } else if (req.method === "POST" && url.pathname === "/api/ai/cancel") {
        await readBody(req);
        active?.abort();
        send(res, 200, { ok: true });
      } else if (
        req.method === "POST" &&
        url.pathname === "/api/ai/disconnect"
      ) {
        await readBody(req);
        active?.abort();
        nvidia.disconnect();
        send(res, 200, nvidia.status());
      } else if (
        req.method === "POST" &&
        ["/api/ai/connect", "/api/ai/research"].includes(url.pathname)
      ) {
        const body = await readBody(req);
        if (active) {
          send(res, 409, {
            error: "An AI request is already running. Wait or cancel it first.",
          });
          return true;
        }
        controller = new AbortController();
        active = controller;
        const cancelOnClose = () => {
          if (!res.writableEnded) controller?.abort();
        };
        res.on("close", cancelOnClose);
        if (url.pathname.endsWith("/connect")) {
          const status = await nvidia.connect(
            body.key,
            body.model,
            controller.signal,
          );
          if (controller.signal.aborted) {
            nvidia.disconnect();
            throw new Error("Connection cancelled.");
          }
          send(res, 200, status);
        } else {
          if (!nvidia.status().connected)
            throw new Error("Connect your NVIDIA key before running AI.");
          const input = validateInput(body);
          const scan = scans.get(input.scanId);
          if (!scan) throw new Error("Scan not found. Select a saved scan.");
          buildContext(scan, input, []);
          const competitors: Scan[] = [];
          for (const competitorUrl of input.competitorUrls) {
            if (controller.signal.aborted)
              throw new Error("AI request cancelled.");
            const competitor: Scan = {
              id: randomUUID(),
              url: competitorUrl,
              status: "running",
              startedAt: new Date().toISOString(),
              limit: 5,
              pages: [],
              issues: [],
              suggestions: [],
              discovered: 0,
              skipped: 0,
              skippedUrls: [],
              notice: [],
            };
            await crawl(competitor, controller.signal, () => {});
            competitors.push(competitor);
          }
          if (controller.signal.aborted)
            throw new Error("AI request cancelled.");
          const report = await nvidia.research(
            scan,
            input,
            competitors,
            controller.signal,
          );
          for (const c of competitors)
            if (
              c.status !== "completed" ||
              c.pages.some((p) => p.error || p.status >= 400)
            )
              report.warnings.push(
                `Competitor crawl was incomplete or returned errors: ${c.url}. ${c.error || "Comparison covers successful pages only."}`,
              );
          if (controller.signal.aborted)
            throw new Error("AI request cancelled.");
          await mkdir(directory, { recursive: true });
          await writeFile(
            path.join(directory, report.id + ".json"),
            JSON.stringify(report, null, 2),
          );
          send(res, 200, report);
        }
        res.off("close", cancelOnClose);
      } else {
        send(res, 405, { error: "Unknown AI endpoint or method." });
      }
    } catch (error) {
      send(res, 400, {
        error: error instanceof Error ? error.message : "AI request failed.",
      });
    } finally {
      if (controller && active === controller) active = null;
    }
    return true;
  };
}
