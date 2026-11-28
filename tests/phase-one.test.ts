import { test } from "node:test";
import assert from "node:assert/strict";
import { collectResultRecords } from "../src/result-records";
import { readContexts, readWorkspaceRoute } from "../src/workspace-context";
import type { Repair } from "../src/types";
import { clearScanStorage } from "../src/delete-storage";

const baselines = [
  { id: "original", url: "https://example.com/", startedAt: "2026-11-25T10:00:00Z" },
  { id: "page-check", url: "https://example.com/page", startedAt: "2026-11-27T10:00:00Z" },
  { id: "other", url: "https://other.test/", startedAt: "2026-11-26T10:00:00Z" },
];
const repair: Repair = { id: "page-title", url: "https://example.com/page", field: "title", original: "Before", value: "After", workflow: { baselineScanId: "original", revision: 2, updatedAt: "2026-11-26T10:00:00Z", previous: [], checks: [{ scanId: "page-check", checkedAt: "2026-11-27T10:00:00Z", status: "matches_draft", actual: "After" }] } };

test("Results finds original-plan checks when another scan is open without including other sites or removed scans", () => {
  const stored: Record<string, string> = { "repairs:original": JSON.stringify([repair]), "repairs:other": JSON.stringify([{ ...repair, url: "https://other.test/" }]), "repairs:deleted": JSON.stringify([repair]) };
  const result = collectResultRecords("https://example.com/", baselines, key => stored[key] || null, { id: "page-check", repairs: [] });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].baseline.id, "original");
  assert.equal(result.records[0].repair.workflow?.checks[0].actual, "After");
  assert.deepEqual(result.unreadable, []);
  assert.equal(collectResultRecords("https://example.com/", baselines.slice(1), key => stored[key] || null).records.length, 0);
});

test("Results preserves unsaved current work and isolates unreadable plans rather than failing the screen", () => {
  const pending = { ...repair, id: "pending", workflow: undefined };
  const result = collectResultRecords("https://example.com/", baselines, () => "malformed", { id: "page-check", repairs: [pending] });
  assert.equal(result.records[0].repair.id, "pending");
  assert.deepEqual(result.unreadable, ["original"]);
});

test("view filters stay scoped to scan and destination, and deep links retain encoded finding and scan identity", () => {
  const contexts = readContexts(JSON.stringify({ "original:issues": { query: "guide", severity: "high", problemType: "broken_internal" }, "original:pages": { query: "article", severity: "all", problemType: "all" }, "other:issues": { query: "other", severity: "low", problemType: "all" }, invalid: { query: {}, severity: "unknown" } }));
  assert.equal(contexts["original:issues"].query, "guide");
  assert.equal(contexts["original:pages"].query, "article");
  assert.equal(contexts.invalid, undefined);
  assert.deepEqual(readWorkspaceRoute("#issues?finding=" + encodeURIComponent("page:title/length") + "&scan=original"), { view: "issues", finding: "page:title/length", scan: "original" });
  assert.deepEqual(readContexts("not-json"), {});
});

test("permanent deletion clears only the removed scan's remembered filters", () => {
  const row = { query: "private work", severity: "high", problemType: "http_error" };
  const data = new Map<string, string>([["seo:view-contexts", JSON.stringify({ "original:issues": row, "page-check:issues": row })]]);
  const storage = { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } } as Storage;
  clearScanStorage({ id: "original", url: "https://example.com/", pageUrls: [] }, [], storage, storage);
  assert.deepEqual(Object.keys(readContexts(storage.getItem("seo:view-contexts"))), ["page-check:issues"]);
  clearScanStorage({ id: "page-check", url: "https://example.com/", pageUrls: [] }, [], storage, storage);
  assert.equal(storage.getItem("seo:view-contexts"), null);
});
