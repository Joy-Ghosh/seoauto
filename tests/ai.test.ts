import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  NvidiaClient,
  buildContext,
  messages,
  parseResult,
  validateInput,
} from "../server/ai.ts";
import { createAiApi } from "../server/ai-api.ts";
import { parsePage } from "../server/audit.ts";
import type { Scan } from "../src/types.ts";
import type { AiInput } from "../src/ai-types.ts";
import { DEFAULT_MODEL } from "../src/ai-types.ts";

function fixture(): Scan {
  const page = parsePage(
    '<title>Website performance guide</title><meta name="description" content="A practical guide"><h1>Performance checklist</h1><p>Review image sizes, navigation and website performance.</p>',
    "https://example.test/",
  );
  page.status = 200;
  return {
    id: "test-scan",
    url: page.url,
    status: "completed",
    startedAt: new Date().toISOString(),
    pages: [page],
    issues: [],
    suggestions: [],
    limit: 10,
    discovered: 1,
    skipped: 0,
    skippedUrls: [],
    notice: [],
  };
}
const input = (task: AiInput["task"] = "keywords"): AiInput => ({
  scanId: "test-scan",
  task,
  seeds: "website performance",
  market: "India",
  language: "English",
  audience: "Small businesses",
  question: "",
  competitorUrls: [],
});
const completion = (content: string, status = 200) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: { total_tokens: 100 },
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );

test("NVIDIA calls use only the fixed provider endpoint and never include the key in research messages or public status", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new NvidiaClient((async (url, init) => {
    calls.push({ url: String(url), init });
    return completion(
      calls.length === 1
        ? "OK"
        : JSON.stringify({
            summary: "Relevant keyword ideas",
            keywords: [
              {
                keyword: "website performance checklist",
                intent: "informational",
                cluster: "performance",
                targetUrl: "https://example.test/",
                reason: "Matches the guide.",
              },
            ],
          }),
    );
  }) as typeof fetch);
  const key = "nvapi-test-only-secret";
  await provider.connect(key, DEFAULT_MODEL);
  const result = await provider.research(fixture(), input(), []);
  assert.equal(result.keywords[0].keyword, "website performance checklist");
  assert.equal(result.usage?.total_tokens, 100);
  assert(
    calls.every(
      (c) => c.url === "https://integrate.api.nvidia.com/v1/chat/completions",
    ),
  );
  assert.equal(
    (calls[1].init!.headers as Record<string, string>).Authorization,
    "Bearer " + key,
  );
  assert(!String(calls[1].init!.body).includes(key));
  const researchRequest = JSON.parse(String(calls[1].init!.body));
  assert.equal(researchRequest.response_format.type, "json_schema");
  assert(
    researchRequest.response_format.json_schema.schema.required.includes(
      "summary",
    ),
  );
  assert(!JSON.stringify(provider.status()).includes(key));
  assert(!JSON.stringify(result).includes(key));
  provider.disconnect();
  await assert.rejects(
    provider.research(fixture(), input(), []),
    /Connect your NVIDIA key/,
  );
});

test("report parsing tolerates a prose wrapper and a single formatting correction preserves usage totals", async () => {
  const scan = fixture(),
    job = input(),
    context = buildContext(scan, job, []);
  const wrapped = parseResult(
    'Here is your report:\n```json\n{"summary":"Relevant ideas","keywords":[]}\n```\nReview before using.',
    scan,
    job,
    context,
    DEFAULT_MODEL,
  );
  assert.equal(wrapped.summary, "Relevant ideas");
  let calls = 0;
  const provider = new NvidiaClient((async () => {
    calls++;
    return completion(
      calls === 1
        ? "OK"
        : calls === 2
          ? "A narrative that does not follow the report format."
          : JSON.stringify({ summary: "Corrected formatting", keywords: [] }),
    );
  }) as typeof fetch);
  await provider.connect("nvapi-format-test", DEFAULT_MODEL);
  const report = await provider.research(scan, job, []);
  assert.equal(calls, 3);
  assert.equal(report.summary, "Corrected formatting");
  assert.equal(report.usage?.total_tokens, 200);
  assert(
    report.warnings.some((warning) =>
      warning.includes("additional model request"),
    ),
  );
});

test("formatting correction is attempted only once and still-invalid output never creates drafts", async () => {
  let calls = 0;
  const provider = new NvidiaClient((async () =>
    completion(++calls === 1 ? "OK" : "Still invalid output")) as typeof fetch);
  await provider.connect("nvapi-bad-format-test", DEFAULT_MODEL);
  await assert.rejects(
    provider.research(fixture(), input("optimize"), []),
    /complete research report/,
  );
  assert.equal(calls, 3);
});

test("untrusted model repairs cannot edit unrelated URLs or fields and original values come from the scan", () => {
  const scan = fixture(),
    job = input("optimize"),
    context = buildContext(scan, job, []);
  const result = parseResult(
    JSON.stringify({
      summary: "Suggested improvements",
      repairs: [
        {
          url: scan.url,
          field: "title",
          value: "A practical website performance checklist",
          original: "malicious replacement",
        },
        { url: scan.url, field: "robots", value: "index,follow" },
        { url: "https://unrelated.test/", field: "title", value: "Unrelated" },
        {
          url: scan.url,
          field: "alt_text",
          value: "Invented image description",
        },
      ],
      competitors: [{ name: "Bad URL", url: "javascript:alert(1)" }],
      actions: [
        { title: "Test", url: "javascript:alert(1)", action: "Review" },
      ],
    }),
    scan,
    job,
    context,
    DEFAULT_MODEL,
  );
  assert.equal(result.repairs.length, 1);
  assert.equal(result.repairs[0].original, scan.pages[0].title);
  assert.equal(result.competitors.length, 0);
  assert.equal(result.actions[0].url, "");
  assert.equal(
    parseResult(
      JSON.stringify({
        summary: "No automatic repairs",
        repairs: [{ url: scan.url, field: "title", value: "New title" }],
      }),
      scan,
      input("keywords"),
      context,
      DEFAULT_MODEL,
    ).repairs.length,
    0,
  );
});

test("research context preserves provenance, excludes failed pages and limits page selection", () => {
  const scan = fixture();
  const bad = {
    ...scan.pages[0],
    url: "https://example.test/failure",
    status: 404,
  };
  scan.pages = [
    ...Array.from({ length: 25 }, (_, index) => ({
      ...scan.pages[0],
      url: "https://example.test/" + index,
      finalUrl: "https://example.test/" + index,
    })),
    bad,
  ];
  const context = buildContext(scan, input(), []);
  assert.equal(context.selected.length, 20);
  assert.equal(context.counts.totalPageCount, 26);
  assert(!context.sources.some((s) => s.url === bad.url));
  assert.equal(context.sources[0].scannedAt, scan.startedAt);
  const focused = buildContext(
    scan,
    { ...input(), pageUrl: scan.pages[24].url },
    [],
  );
  assert.equal(focused.selected.length, 1);
  assert.equal(focused.selected[0].url, scan.pages[24].url);
  assert.throws(
    () => buildContext(scan, { ...input(), pageUrl: bad.url }, []),
    /no successful/,
  );
  assert(
    messages(scan, input(), []).messages[0].content.includes("untrusted data"),
  );
});

test("provider errors are actionable and never echo upstream bodies or credentials", async () => {
  const key = "nvapi-secret-test";
  const provider = new NvidiaClient(
    (async () =>
      new Response("Bearer " + key, { status: 401 })) as typeof fetch,
  );
  await assert.rejects(
    provider.connect(key, DEFAULT_MODEL),
    (error) =>
      error instanceof Error &&
      /rejected the key/.test(error.message) &&
      !error.message.includes(key),
  );
  assert.equal(provider.status().connected, false);
  assert.throws(
    () =>
      parseResult(
        "not JSON",
        fixture(),
        input(),
        buildContext(fixture(), input(), []),
        DEFAULT_MODEL,
      ),
    /complete research report/,
  );
  assert.throws(
    () =>
      validateInput({
        ...input(),
        competitorUrls: ["https://user:password@example.test/"],
      }),
    /credentials/i,
  );
  assert.throws(
    () => validateInput({ ...input(), task: "delete_site" }),
    /Choose an AI tool/,
  );
});

test("AI HTTP workflow connects, saves a report, restores history and disconnects without writing credentials", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seo-ai-test-"));
  const scan = fixture();
  let calls = 0;
  const provider = new NvidiaClient((async () =>
    completion(
      ++calls === 1
        ? "OK"
        : JSON.stringify({
            summary: "An evidence-led keyword report",
            sections: [
              { heading: "Next step", text: "Review keyword relevance." },
            ],
          }),
    )) as typeof fetch);
  const handler = createAiApi(directory, new Map([[scan.id, scan]]), provider);
  const server = http.createServer((req, res) => {
    if (req.url === "/robots.txt") {
      res.end("User-agent: *\nAllow: /");
      return;
    }
    if (!req.url?.startsWith("/api/")) {
      assert.equal(req.headers.authorization, undefined);
      res.setHeader("Content-Type", "text/html");
      res.end(
        "<title>Competitor page</title><h1>Performance services</h1><p>Useful content about website performance.</p>",
      );
      return;
    }
    void handler(req, res, new URL(req.url!, "http://localhost"));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const post = async (route: string, body: unknown) =>
    fetch(base + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const key = "nvapi-local-fixture-key";
    assert.equal(
      (await post("/api/ai/connect", { key, model: DEFAULT_MODEL })).status,
      200,
    );
    const response = await post("/api/ai/research", {
      ...input("competitors"),
      competitorUrls: [base + "/competitor"],
    });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.summary, "An evidence-led keyword report");
    assert.equal(report.context.competitorPageCount, 1);
    assert(
      report.sources.some(
        (s: { kind: string; url: string }) =>
          s.kind === "competitor" && s.url === base + "/competitor",
      ),
    );
    const saved = await fetch(base + "/api/ai/reports?scanId=" + scan.id).then(
      (r) => r.json(),
    );
    assert.equal(saved[0].id, report.id);
    const names = await readdir(path.join(directory, "ai"));
    const file = await readFile(path.join(directory, "ai", names[0]), "utf8");
    assert(!file.includes(key));
    assert.equal((await post("/api/ai/disconnect", {})).status, 200);
    assert.equal((await post("/api/ai/research", input())).status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("cancelling an AI request aborts the provider request and releases the single-request lock", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seo-ai-cancel-"));
  const scan = fixture();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let calls = 0;
  const provider = new NvidiaClient((async (_url, init) => {
    if (++calls === 1) return completion("OK");
    started();
    await new Promise((_resolve, reject) => {
      init!.signal!.addEventListener(
        "abort",
        () => reject(new Error("aborted")),
        { once: true },
      );
    });
    throw new Error("unreachable");
  }) as typeof fetch);
  const handler = createAiApi(directory, new Map([[scan.id, scan]]), provider);
  const server = http.createServer((req, res) => {
    void handler(req, res, new URL(req.url!, "http://localhost"));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const post = (route: string, body: unknown) =>
    fetch(base + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    await post("/api/ai/connect", {
      key: "nvapi-cancel-test",
      model: DEFAULT_MODEL,
    });
    const pending = post("/api/ai/research", input());
    await ready;
    assert.equal((await post("/api/ai/research", input())).status, 409);
    await post("/api/ai/cancel", {});
    const cancelled = await pending;
    assert.equal(cancelled.status, 400);
    assert.match((await cancelled.json()).error, /cancelled/);
    assert.equal((await post("/api/ai/disconnect", {})).status, 200);
    const disconnected = await post("/api/ai/research", input());
    assert.equal(disconnected.status, 400);
    assert.match((await disconnected.json()).error, /Connect your NVIDIA key/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
