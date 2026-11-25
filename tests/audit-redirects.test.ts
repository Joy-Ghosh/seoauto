import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePage, analyze } from "../server/audit.ts";
import { fetchDocument } from "../server/crawler.ts";
test("redirect aliases are reviewed once and do not create duplicate metadata or self-link suggestions", () => {
  const final = parsePage(
    '<title>Website performance guide</title><meta name="description" content="A practical guide"><h1>Website performance</h1><p>A website performance guide for improving useful content and navigation.</p>',
    "https://example.test/guide",
  );
  const alias = {
    ...final,
    url: "https://example.test/old-guide",
    redirects: 1,
  };
  const result = analyze([alias, final]);
  assert(
    !result.issues.some(
      (i) => i.type === "duplicate_title" || i.type === "duplicate_description",
    ),
  );
  assert(
    result.issues.some(
      (i) => i.url === alias.url && i.type === "redirect_alias",
    ),
  );
  assert.equal(result.suggestions.length, 0);
});
test("different final pages with repeated titles still produce genuine duplicate findings", () => {
  const first = parsePage(
    "<title>Repeated title</title><h1>First</h1>",
    "https://example.test/first",
  );
  const second = {
    ...first,
    url: "https://example.test/second",
    finalUrl: "https://example.test/second",
  };
  assert.equal(
    analyze([first, second]).issues.filter((i) => i.type === "duplicate_title")
      .length,
    2,
  );
});
test("JSON error responses preserve verified HTTP status rather than becoming unknown fetch errors", async () => {
  const response = new Response('{"error":"missing"}', {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
  Object.defineProperty(response, "url", {
    value: "https://example.test/missing",
  });
  const doc = await fetchDocument(
    "https://example.test/missing",
    new AbortController().signal,
    (async () => response) as typeof fetch,
  );
  assert.equal(doc.status, 404);
  assert.equal(doc.html, "");
});
