import { test } from "node:test";
import assert from "node:assert/strict";
import { localDb } from "../src/local-db.js";
import type { AiResult } from "../src/ai-types.js";
test("research storage checks the scan in the same transaction and refuses late results after trash or purge",async()=>{
  const original=globalThis.indexedDB; let scan: {id:string;deletedAt?:string}|undefined={id:"scan"}; const saved:unknown[]=[];
  const db={ transaction(names: string[],mode:string) { assert.deepEqual(names,["scans","reports"]);assert.equal(mode,"readwrite");
    const tx:any={abort(){queueMicrotask(()=>tx.onabort?.());},objectStore(name:string){return name==="scans"?{get(id:string){assert.equal(id,"scan");const request:any={};queueMicrotask(()=>{request.result=scan;request.onsuccess?.();});return request;}}:{put(value:unknown){saved.push(value);queueMicrotask(()=>tx.oncomplete?.());}};}}; return tx;
  }};
  Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:{open(){const request:any={};queueMicrotask(()=>{request.result=db;request.onsuccess?.();});return request;}}});
  try { const report={id:"report",scanId:"scan"} as AiResult; await localDb.saveReport(report); assert.equal(saved.length,1);
    scan={id:"scan",deletedAt:new Date().toISOString()}; await assert.rejects(localDb.saveReport(report),/not saved/);
    scan=undefined;await assert.rejects(localDb.saveReport(report),/not saved/);assert.equal(saved.length,1);
  } finally { Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:original}); }
});
