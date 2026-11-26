import { writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Scan } from "../src/types.js";
const pending = new Map<string, Promise<void>>();
/** Serialize each scan's writes so completion cannot overwrite a later trash/restore. */
export function saveScanFile(directory: string, scan: Scan) {
  const target = path.join(directory, scan.id + ".json");
  const content = JSON.stringify(scan);
  const operation = (pending.get(target) || Promise.resolve()).catch(() => {}).then(async () => {
    const temporary = target + "." + randomUUID() + ".tmp";
    try { await writeFile(temporary, content); await rename(temporary, target); }
    finally { await rm(temporary, { force: true }).catch(() => {}); }
  });
  pending.set(target, operation);
  void operation.finally(() => { if (pending.get(target) === operation) pending.delete(target); }).catch(() => {});
  return operation;
}
