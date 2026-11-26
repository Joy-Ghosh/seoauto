import { test } from "node:test";
import assert from "node:assert/strict";
import { readInspection, scanTechnologies, technologyKey, TECHNOLOGY_TTL } from "../src/site-technology.js";
import { detectTechnologies } from "../server/technologies.js";
import type { Page } from "../src/types.js";

test("site technology cache isolates origins and rejects expired or malformed evidence", () => {
  const now = Date.now();
  const result = { url: "https://example.com/blog", status: 200, technologies: [{ name: "Next.js", confidence: "strong", evidence: "Build path" }], inspectedAt: new Date(now - 1000).toISOString(), inspectedScripts: 1, limitation: "" };
  assert.equal(technologyKey(result.url), technologyKey("https://example.com/products"));
  assert.notEqual(technologyKey(result.url), technologyKey("https://other.example.com"));
  assert.equal(readInspection(JSON.stringify(result), "https://example.com", now)?.technologies[0].name, "Next.js");
  assert.equal(readInspection(JSON.stringify(result), "https://other.example.com", now), null);
  assert.equal(readInspection(JSON.stringify(result), result.url, now + TECHNOLOGY_TTL), null);
  assert.equal(readInspection(JSON.stringify({ ...result, technologies: [{ name: "WordPress" }] }), result.url, now), null);
  assert.equal(readInspection("{broken", result.url, now), null);
});

test("website summary deduplicates scan evidence and excludes other origins", () => {
  const page = (url: string, confidence: "possible" | "strong") => ({ url, images: [], links: [], technologies: [{ name: "Next.js", confidence, evidence: "Build asset" }] }) as unknown as Page;
  const results = scanTechnologies([page("https://example.com/", "possible"), page("https://example.com/blog", "strong"), { url: "https://foreign.com", technologies: [{ name: "Shopify", confidence: "strong", evidence: "CDN" }] } as Page], "https://example.com");
  assert.deepEqual(results.map(t => [t.name, t.confidence]), [["Next.js", "strong"]]);
});

test("legacy Hestia scan identifies WordPress from same-site retained images without a live request", () => {
  const url = "https://hestia.webrush.net.in/";
  const page = { url, finalUrl: url, images: [{ src: url + "wp-content/uploads/logo.png" }], links: [] } as unknown as Page;
  assert.equal(scanTechnologies([page], url)[0].name, "WordPress");
  assert.match(scanTechnologies([page], url)[0].evidence, /saved scan/);
  page.images[0].src = "https://unrelated.example/wp-content/logo.png";
  assert.deepEqual(scanTechnologies([page], url), []);
});

test("common platforms produce distinct evidence without inventing hidden CMS", () => {
  for (const [html, expected] of [["<script src='/wp-includes/js/main.js'></script>", "WordPress"], ["<script src='https://cdn.shopify.com/store.js'></script>", "Shopify"], ["<script src='/_next/static/app.js'></script>", "Next.js"]]) {
    assert.deepEqual(detectTechnologies(html).map(t => t.name), [expected]);
  }
  assert.deepEqual(detectTechnologies("<main>A website</main>"), []);
});
