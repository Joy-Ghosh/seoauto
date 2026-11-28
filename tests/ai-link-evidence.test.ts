import test from "node:test";
import assert from "node:assert/strict";
import { mentionedEvidencePages } from "../src/ai-link-evidence.js";
import type { Page } from "../src/types.js";

const pages = ["/", "/services", "/blogs/story"].map(path => ({ url: "https://example.com" + path, finalUrl: "https://example.com" + path })) as Page[];
test("AI linking actions resolve exact observed URLs and quoted paths without inventing pages", () => {
  assert.deepEqual(mentionedEvidencePages('Add a link from /services to `/blogs/story`.', pages).map(page => page.url), [pages[1].url, pages[2].url]);
  assert.deepEqual(mentionedEvidencePages("https://example.com/services", pages), [pages[1]]);
  assert.deepEqual(mentionedEvidencePages("https://other.example/services-extra and /unknown", pages), []);
  assert.deepEqual(mentionedEvidencePages("https://example.com/unknown", pages), []);
  assert.deepEqual(mentionedEvidencePages("https://example.com/", pages), [pages[0]]);
});
