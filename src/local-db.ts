import type { Scan } from "./types";
import type { AiResult } from "./ai-types";
let pending: Promise<IDBDatabase> | undefined;
function database() {
  return (pending ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("seo-workbench-v1", 1);
    request.onupgradeneeded = () => {
      for (const name of ["scans", "reports"])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. Enable site storage to save your work.",
        ),
      );
  }));
}
async function read<T>(store: string, id?: string): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = id
      ? tx.objectStore(store).get(id)
      : tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not read saved work."));
  });
}
async function save(store: string, value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(
        new Error(
          "Browser storage is full or blocked. Export your work before clearing site data.",
        ),
      );
    tx.onabort = () => reject(new Error("Browser storage write was interrupted. Your changes were not saved."));
  });
}
export const localDb = {
  scans: () => read<Scan[]>("scans"),
  scan: (id: string) => read<Scan | undefined>("scans", id),
  saveScan: (scan: Scan) => save("scans", scan),
  reports: async (scanId: string) =>
    (await read<AiResult[]>("reports"))
      .filter((r) => r.scanId === scanId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20),
  saveReport: (report: AiResult) => save("reports", report),
};
