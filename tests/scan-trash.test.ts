import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { setScanTrash } from "../src/scan-trash.js";
import { saveScanFile } from "../server/scan-store.js";
import { api, configureClient } from "../src/client.js";
import { localDb } from "../src/local-db.js";
import type { Scan } from "../src/types.js";

const fixture = (): Scan => ({ id: "trash-fixture", url: "https://example.com/", status: "completed", startedAt: new Date().toISOString(), limit: 1, pages: [], issues: [], suggestions: [], discovered: 1, skipped: 0, skippedUrls: [], notice: [] });
test("trash is reversible without changing scan evidence and refuses a running scan", () => {
  const scan = fixture(); const removed = setScanTrash(scan, false);
  assert(removed.deletedAt); assert.equal(scan.deletedAt, undefined);
  assert.deepEqual(setScanTrash(removed, true), scan);
  assert.throws(() => setScanTrash({ ...scan, status: "running" }, false), /Stop the scan/);
});
test("local scan writes are atomic and preserve the last queued trash/restore state", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seo-trash-"));
  try {
    const scan = fixture();
    await Promise.all([saveScanFile(directory, scan), saveScanFile(directory, setScanTrash(scan, false))]);
    assert(JSON.parse(await readFile(path.join(directory, scan.id + ".json"), "utf8")).deletedAt);
    await saveScanFile(directory, scan);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, scan.id + ".json"), "utf8")), scan);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("hosted scan list excludes trash, restore returns it, and trashed scans cannot be opened", async () => {
  const originals = { scans: localDb.scans, scan: localDb.scan, saveScan: localDb.saveScan };
  let scan = fixture();
  localDb.scans = async () => [scan]; localDb.scan = async () => scan; localDb.saveScan = async value => { scan = value; };
  configureClient(true);
  try {
    assert.equal((await api<unknown[]>("/api/scans")).length, 1);
    await api("/api/scans/trash-fixture/trash", {});
    assert.equal((await api<unknown[]>("/api/scans")).length, 0);
    assert.equal((await api<unknown[]>("/api/scans?trash=1")).length, 1);
    await assert.rejects(api("/api/scans/trash-fixture"), /Trash/);
    await api("/api/scans/trash-fixture/restore", {});
    assert.equal((await api<unknown[]>("/api/scans")).length, 1);
    assert.deepEqual(await api("/api/scans/trash-fixture"), fixtureWithDate(scan.startedAt));
    scan.status = "running";
    await assert.rejects(api("/api/scans/trash-fixture/trash", {}), /Stop/);
  } finally { Object.assign(localDb, originals); configureClient(false); }
});
function fixtureWithDate(startedAt: string) { return { ...fixture(), startedAt }; }
