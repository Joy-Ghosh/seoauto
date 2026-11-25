import { randomUUID } from "node:crypto";
import { NvidiaClient, validateInput, buildContext } from "../server/ai.ts";
import { publicFetch, publicUrl } from "../server/public-network.ts";
import { crawl } from "../server/crawler.ts";
import { analyze, parsePage } from "../server/audit.ts";
import { scanSchema } from "../src/scan-schema.ts";
import { DEFAULT_MODEL } from "../src/ai-types.ts";
import type { Scan } from "../src/types.ts";
import {
  authReady,
  cookie,
  newSession,
  passwordMatches,
  sameOrigin,
  seal,
  securityHeaders,
  session,
  setCookie,
  unseal,
  type AuthConfig,
} from "../server/hosted-auth.ts";

export function configFromEnv(): AuthConfig {
  return {
    secret: process.env.APP_SECRET || "",
    passwordHash: process.env.APP_PASSWORD_HASH || "",
    secure: Boolean(process.env.VERCEL),
  };
}
export async function readJson(request: Request, maxBytes = 2_000_000) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Expected JSON.");
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new Error("Request exceeds the size limit.");
  const reader = request.body?.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) throw new Error("Request exceeds the size limit.");
        parts.push(value);
      }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new Error("Invalid or oversized JSON request.");
  } finally {
    await reader?.cancel().catch(() => {});
  }
}
function emptyScan(url: string, limit: number, id = randomUUID()): Scan {
  return {
    id,
    url,
    limit,
    status: "running",
    startedAt: new Date().toISOString(),
    pages: [],
    issues: [],
    suggestions: [],
    discovered: 1,
    skipped: 0,
    skippedUrls: [],
    notice: [],
  };
}
function compact(scan: Scan) {
  // Keep evidence useful while bounding browser memory and future AI request size.
  for (const page of scan.pages) {
    page.title = page.title.slice(0, 3000);
    page.description = page.description.slice(0, 5000);
    page.h1 = page.h1.slice(0, 100).map((t) => t.slice(0, 3000));
    page.robots = page.robots.slice(0, 2000);
    if (
      page.links.length > 1000 ||
      page.images.length > 100 ||
      page.paragraphs.length > 100
    ) {
      const note =
        "Large-page evidence is sampled at 1,000 links, 100 images and 100 paragraph blocks per page. Review the full website before applying changes.";
      if (!scan.notice.includes(note)) scan.notice.push(note);
    }
    page.links = page.links
      .filter((l) => l.url.length <= 2500)
      .slice(0, 1000)
      .map((l) => ({ ...l, text: l.text.slice(0, 1000) }));
    page.images = page.images
      .filter((i) => i.src.length <= 2500)
      .slice(0, 100)
      .map((i) => ({ ...i, alt: i.alt?.slice(0, 1000) ?? null }));
    page.paragraphs = page.paragraphs
      .slice(0, 100)
      .map((t) => t.slice(0, 1000));
  }
}
function demoScan() {
  const scan = emptyScan("https://sample.example/", 10);
  const fixtures = [
    [
      "",
      '<title>Sample website performance guide</title><h1>Make your website faster</h1><p>A practical website performance checklist for teams improving images, navigation and content.</p><a href="/guide">Guide</a><a href="/missing">Old resource</a>',
    ],
    [
      "guide",
      '<title>Guide</title><h1>Website performance checklist</h1><p>Review website performance, image sizes and navigation before making larger changes.</p><img src="/photo.jpg"><a href="/">Home</a>',
    ],
    ["missing", "<title>Not found</title><h1>Not found</h1>"],
  ];
  scan.pages = fixtures.map(([part, html]) => {
    const p = parsePage(html, scan.url + part);
    if (part === "missing") p.status = 404;
    return p;
  });
  Object.assign(scan, analyze(scan.pages));
  scan.status = "completed";
  scan.finishedAt = new Date().toISOString();
  scan.discovered = 3;
  scan.notice = [
    "Sample fixture generated from bundled HTML. This is a demonstration, not a crawl of an external website.",
  ];
  return scan;
}
export function createHostedHandler(
  config: AuthConfig,
  nvidiaFactory = () => new NvidiaClient(),
  websiteFetch: typeof fetch = publicFetch,
) {
  const json = (body: unknown, status = 200, cookies: string[] = []) => {
    const headers = new Headers({
      ...securityHeaders(),
      "Content-Type": "application/json",
    });
    cookies.forEach((v) => headers.append("Set-Cookie", v));
    return new Response(JSON.stringify(body), { status, headers });
  };
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url),
      route =
        "/api/" +
        (url.searchParams.get("route") ||
          url.pathname.replace(/^\/api\/?/, ""));
    if (!sameOrigin(request))
      return json({ error: "Cross-origin requests are not accepted." }, 403);
    const owner = session(request, config);
    if (route === "/api/system" && request.method === "GET")
      return json({
        mode: "hosted",
        protected: true,
        configured: authReady(config),
        authenticated: Boolean(owner),
        storage: "browser",
        maxPages: 200,
        version: "0.2.0",
      });
    if (route === "/api/health" && request.method === "GET")
      return json(
        { ok: authReady(config), version: "0.2.0" },
        authReady(config) ? 200 : 503,
      );
    if (!authReady(config))
      return json(
        {
          error:
            "Owner access is not configured. Set server-only APP_SECRET and APP_PASSWORD_HASH.",
        },
        503,
      );
    try {
      if (route === "/api/login" && request.method === "POST") {
        const body = await readJson(request, 2000);
        if (
          typeof body?.password !== "string" ||
          body.password.length > 200 ||
          !passwordMatches(body.password, config.passwordHash)
        )
          return json({ error: "Incorrect workspace password." }, 401);
        const next = newSession();
        return json({ ok: true }, 200, [
          setCookie("owner", seal(next, config, "owner"), config),
          setCookie("ai", "", config, 0),
        ]);
      }
      if (!owner)
        return json({ error: "Sign in to your private workspace." }, 401);
      if (route === "/api/logout" && request.method === "POST")
        return json({ ok: true }, 200, [
          setCookie("owner", "", config, 0),
          setCookie("ai", "", config, 0),
        ]);
      const credentials = unseal<{
        key: string;
        model: string;
        owner: string;
        expires: number;
      }>(cookie(request, "ai", config), config, "ai");
      const connected = Boolean(
        credentials &&
          credentials.owner === owner.id &&
          credentials.expires > Date.now(),
      );
      if (route === "/api/ai/status" && request.method === "GET")
        return json({
          connected,
          model: connected ? credentials!.model : DEFAULT_MODEL,
          source: connected ? "session" : "none",
        });
      if (route === "/api/ai/connect" && request.method === "POST") {
        const body = await readJson(request, 5000),
          client = nvidiaFactory();
        const result = await client.connect(
          body?.key,
          body?.model,
          request.signal,
        );
        return json(result, 200, [
          setCookie(
            "ai",
            seal(
              {
                key: body.key.trim(),
                model: result.model,
                owner: owner.id,
                expires: owner.expires,
              },
              config,
              "ai",
            ),
            config,
            Math.max(0, Math.floor((owner.expires - Date.now()) / 1000)),
          ),
        ]);
      }
      if (route === "/api/ai/disconnect" && request.method === "POST")
        return json(
          {
            connected: false,
            model: credentials?.model || DEFAULT_MODEL,
            source: "none",
          },
          200,
          [setCookie("ai", "", config, 0)],
        );
      if (route === "/api/ai/cancel" && request.method === "POST")
        return json({ ok: true }); // Cancellation is scoped to the caller's aborted request.
      if (route === "/api/demo" && request.method === "POST")
        return json(demoScan());
      if (route === "/api/crawl" && request.method === "POST") {
        const body = await readJson(request, 5000),
          target = publicUrl(body?.url),
          limit = Math.max(
            1,
            Math.min(200, Math.floor(Number(body?.limit) || 40)),
          );
        const scan = emptyScan(
          target,
          limit,
          typeof body.id === "string" && /^[\w-]{1,100}$/.test(body.id)
            ? body.id
            : undefined,
        );
        const stop = new AbortController();
        const signal = AbortSignal.any([
          request.signal,
          stop.signal,
          AbortSignal.timeout(240_000),
        ]);
        const encoder = new TextEncoder();
        let sentPages = 0,
          closed = false,
          storedBytes = 0;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const emit = (value: unknown) => {
              if (!closed && !request.signal.aborted)
                try {
                  controller.enqueue(
                    encoder.encode(JSON.stringify(value) + "\n"),
                  );
                } catch {
                  closed = true;
                  stop.abort();
                }
            };
            emit({ type: "start", scan });
            void crawl(
              scan,
              signal,
              () => {
                compact(scan);
                if (scan.status === "running") {
                  const added = scan.pages.slice(sentPages);
                  sentPages = scan.pages.length;
                  storedBytes += Buffer.byteLength(JSON.stringify(added));
                  if (storedBytes > 18_000_000) {
                    scan.notice.push(
                      "The hosted evidence size budget was reached. This scan contains partial website coverage.",
                    );
                    stop.abort();
                  }
                  emit({
                    type: "progress",
                    pages: added,
                    current: scan.current,
                    discovered: scan.discovered,
                    skipped: scan.skipped,
                    skippedUrls: scan.skippedUrls,
                  });
                }
              },
              websiteFetch,
            )
              .then(() => {
                if (signal.aborted && !request.signal.aborted)
                  scan.notice.push(
                    "Hosted scan time budget reached. Results cover the pages completed so far.",
                  );
                compact(scan);
                emit({ type: "complete", scan });
              })
              .catch(() =>
                emit({
                  type: "error",
                  error:
                    "The scan could not finish. You can retry with a smaller page limit.",
                }),
              )
              .finally(() => {
                if (!closed) {
                  closed = true;
                  try {
                    controller.close();
                  } catch {}
                }
              });
          },
          cancel() {
            closed = true;
            stop.abort();
          },
        });
        return new Response(stream, {
          headers: {
            ...securityHeaders(),
            "Content-Type": "application/x-ndjson",
            "X-Accel-Buffering": "no",
          },
        });
      }
      if (route === "/api/ai/research" && request.method === "POST") {
        if (!connected)
          return json({ error: "Connect your NVIDIA key first." }, 400);
        const body = await readJson(request),
          input = validateInput(body),
          parsed = scanSchema.safeParse(body.scan);
        if (!parsed.success || parsed.data.id !== input.scanId)
          return json(
            {
              error:
                "Invalid scan evidence. Open a saved scan or scan the website again.",
            },
            400,
          );
        const scan = parsed.data;
        buildContext(scan, input, []);
        const signal = AbortSignal.any([
            request.signal,
            AbortSignal.timeout(260_000),
          ]),
          competitors: Scan[] = [];
        for (const target of input.competitorUrls) {
          const comparison = emptyScan(publicUrl(target), 3);
          await crawl(comparison, signal, () => {}, websiteFetch);
          competitors.push(comparison);
        }
        const client = nvidiaFactory();
        client.restoreSession(credentials!.key, credentials!.model);
        const report = await client.research(scan, input, competitors, signal);
        for (const comparison of competitors)
          if (comparison.status !== "completed" || comparison.error)
            report.warnings.push(
              "Competitor crawl was incomplete: " + comparison.url,
            );
        return json(report);
      }
      return json({ error: "Endpoint not found." }, 404);
    } catch (error) {
      if (request.signal.aborted)
        return json({ error: "Request cancelled." }, 499);
      const message =
        error instanceof Error ? error.message : "Request failed.";
      // No provider response bodies, request bodies or credentials go to logs.
      return json(
        {
          error:
            message.length < 500
              ? message
              : "Request failed. Check the input and retry.",
        },
        400,
      );
    }
  };
}
export default {
  fetch(request: Request) {
    return createHostedHandler(configFromEnv())(request);
  },
};
