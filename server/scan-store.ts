import { writeFile, rename, rm, readdir, readFile } from "node:fs/promises";
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
export async function purgeScanFiles(directory: string, scan: Scan) {
  await pending.get(path.join(directory, scan.id + ".json"));
  let names: string[] = [];
  try { names = await readdir(path.join(directory, "ai")); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  for (const name of names.filter(name => /^[\w-]+\.json$/.test(name))) {
    const file = path.join(directory, "ai", name);
    const report = JSON.parse(await readFile(file, "utf8"));
    if (report.scanId === scan.id) await rm(file);
  }
  await rm(path.join(directory, scan.id + ".json"), { force: true });
}
