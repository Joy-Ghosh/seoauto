import { test } from "node:test";
import assert from "node:assert/strict";
import { crawl } from "../server/crawler.js";
import { createPublicFetch } from "../server/public-network.js";
import type { Scan } from "../src/types.js";
test("robots access denial and rate limiting stop the crawl before reading pages", async () => {
  for (const status of [401, 403, 429, 503]) {
    const scan: Scan = { id: "robots", url: "https://example.com/", status: "running", startedAt: new Date().toISOString(), limit: 1, pages: [], issues: [], suggestions: [], discovered: 1, skipped: 0, skippedUrls: [], notice: [] };
    const calls: string[] = [];
    await crawl(scan, new AbortController().signal, () => {}, (async input => { calls.push(String(input)); return new Response("Denied", { status }); }) as typeof fetch);
    assert.equal(scan.status, "failed"); assert.equal(scan.pages.length, 0); assert.deepEqual(calls, ["https://example.com/robots.txt"]);
  }
});
test("public fetch uses the robots-matched crawler identity and explains DNS failures", async () => {
  let userAgent: string | null = null;
  const transport = (async (_url: unknown, init: RequestInit) => { userAgent = new Headers(init.headers).get("user-agent"); return new Response("OK"); }) as unknown as Parameters<typeof createPublicFetch>[0];
  await createPublicFetch(transport)("https://example.com"); assert.match(userAgent || "", /^LocalSEOWorkbench\//);
  const failed = (async () => { throw new Error("fetch failed", { cause: { code: "EAI_AGAIN" } }); }) as unknown as Parameters<typeof createPublicFetch>[0];
  await assert.rejects(createPublicFetch(failed)("https://example.com"), /DNS lookup failed/);
});
