import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { parsePage, analyze, normalizeUrl } from "../server/audit.ts";
import { robotsAllows, crawl } from "../server/crawler.ts";
import type { Scan } from "../src/types.ts";
test("reads response evidence; empty decorative alt differs from a missing attribute", () => {
  const p = parsePage(
    '<head><title>A &amp; B</title><meta name="robots" content="noindex"></head><body><h1>Useful heading</h1><img src="a.jpg" alt=""><img src="b.jpg"><script>fake words h1 links</script><p>Useful page text.</p></body>',
    "https://example.test/",
  );
  assert.equal(p.title, "A & B");
  assert.deepEqual(p.h1, ["Useful heading"]);
  assert.equal(p.images[0].alt, "");
  assert.equal(p.images[1].alt, null);
  assert(
    analyze([p])
      .issues.find((i) => i.type === "missing_alt")
      ?.detail.startsWith("1 of 2"),
  );
  assert.equal(
    analyze([p]).issues.find((i) => i.type === "noindex")?.severity,
    "info",
  );
});
test("robots uses longest rule, Allow tie-break and the matching agent group", () => {
  const r =
    "User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*?draft=\n";
  assert(!robotsAllows(r, "https://x.test/private/a"));
  assert(robotsAllows(r, "https://x.test/private/public/a"));
  assert(!robotsAllows(r, "https://x.test/a?draft=1"));
  assert(
    robotsAllows("User-agent: OtherBot\nDisallow: /\n", "https://x.test/"),
  );
});
test("canonical consolidation is contextual; only fetched HTTP errors prove broken targets", () => {
  const a = parsePage(
    '<title>Unique useful page title</title><link rel="canonical" href="/preferred"><a href="/bad">Bad link</a><a href="/unread">Not read</a>',
    "https://x.test/",
  );
  const bad = parsePage("", "https://x.test/bad");
  bad.status = 404;
  const issues = analyze([a, bad]).issues;
  assert.equal(
    issues.find((i) => i.type === "canonical_review")?.severity,
    "info",
  );
  assert.equal(
    issues.find((i) => i.type === "broken_internal")?.detail,
    "https://x.test/bad",
  );
});
test("crawl respects robots, same-origin scope and page limit with actual HTTP fixtures", async () => {
  let blockedRead = false;
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    if (req.url === "/robots.txt")
      return res.end("User-agent: *\nDisallow: /private");
    if (req.url === "/private") blockedRead = true;
    res.end(
      '<title>Fixture</title><h1>Fixture</h1><a href="/private">Private</a><a href="/next">Next</a><a href="https://outside.invalid/">Outside</a>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const port = (server.address() as { port: number }).port;
    const s: Scan = {
      id: "test",
      url: `http://127.0.0.1:${port}/`,
      status: "running",
      startedAt: new Date().toISOString(),
      limit: 2,
      pages: [],
      issues: [],
      suggestions: [],
      discovered: 1,
      skipped: 0,
      skippedUrls: [],
      notice: [],
    };
    await crawl(s, new AbortController().signal, () => {});
    assert.equal(s.status, "completed", s.error);
    assert.equal(s.pages.length, 2);
    assert.equal(s.skipped, 1);
    assert(!blockedRead);
    assert(s.pages.every((p) => new URL(p.url).hostname === "127.0.0.1"));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
test("URL normalization removes fragments/tracking and rejects credentials and scripts", () => {
  assert.equal(
    normalizeUrl("https://x.test/a?utm_source=test&keep=1#h"),
    "https://x.test/a?keep=1",
  );
  assert.throws(() => normalizeUrl("javascript:alert(1)"));
  assert.throws(() => normalizeUrl("https://user:secret@x.test/"));
});
