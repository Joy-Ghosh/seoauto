import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { setScanTrash } from "../src/scan-trash.js";
import { saveScanFile, purgeScanFiles } from "../server/scan-store.js";
import { clearScanStorage } from "../src/delete-storage.js";
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
test("permanent local deletion removes the scan and its reports without touching another scan",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"seo-purge-")); const scan=setScanTrash(fixture(),false);
  try { await saveScanFile(directory,scan); await mkdir(path.join(directory,"ai"));
    await writeFile(path.join(directory,"ai","own.json"),JSON.stringify({scanId:scan.id})); await writeFile(path.join(directory,"ai","other.json"),JSON.stringify({scanId:"other-scan"}));
    await purgeScanFiles(directory,scan);
    await assert.rejects(readFile(path.join(directory,scan.id+".json"))); await assert.rejects(readFile(path.join(directory,"ai","own.json")));
    assert.equal(JSON.parse(await readFile(path.join(directory,"ai","other.json"),"utf8")).scanId,"other-scan");
  } finally { await rm(directory,{recursive:true,force:true}); }
});
test("permanent hosted deletion requires Trash and the exact confirmation identifier",async()=>{
  const original={scan:localDb.scan,deleteScan:localDb.deleteScan,scans:localDb.scans}; let scan=fixture(); let deletes=0;
  localDb.scan=async()=>scan; localDb.scans=async()=>[]; localDb.deleteScan=async id=>{assert.equal(id,scan.id);deletes++;}; configureClient(true);
  try { await assert.rejects(api("/api/scans/trash-fixture/purge",{confirm:scan.id}),/Trash/); scan=setScanTrash(scan,false);
    await assert.rejects(api("/api/scans/trash-fixture/purge",{confirm:"another-scan"}),/confirmed/); assert.equal(deletes,0);
    await api("/api/scans/trash-fixture/purge",{confirm:scan.id}); assert.equal(deletes,1);
  } finally {Object.assign(localDb,original);configureClient(false);}
});
test("browser cleanup isolates scan notes and retains shared site data while another scan uses it",()=>{
  const data=new Map<string,string>([["repairs:trash-fixture","draft"],["repairs:other","keep"],["seo:issue-review:trash-fixture:https://example.com/","note"],["seo:search-data:example.com","shared"],["seo:editor:https://example.com/title","editor"]]);
  const storage={get length(){return data.size},key:(i:number)=>[...data.keys()][i]??null,getItem:(key:string)=>data.get(key)??null,removeItem:(key:string)=>{data.delete(key);}} as Storage;
  const scan={id:"trash-fixture",url:"https://example.com/",pageUrls:["https://example.com/"]};
  clearScanStorage(scan,[{url:"https://example.com/another"}],storage,storage);
  assert.equal(data.has("repairs:trash-fixture"),false); assert.equal(data.has("repairs:other"),true); assert.equal(data.has("seo:search-data:example.com"),true);
  clearScanStorage(scan,[],storage,storage); assert.equal(data.has("seo:search-data:example.com"),false);assert.equal(data.has("seo:editor:https://example.com/title"),false);
});
