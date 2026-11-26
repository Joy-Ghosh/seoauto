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
  deleteScan: async (id: string) => {
    const db = await database();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["scans", "reports"], "readwrite");
      tx.objectStore("scans").delete(id);
      const cursor = tx.objectStore("reports").openCursor();
      cursor.onsuccess = () => { const row = cursor.result; if (row) { if (row.value.scanId === id) row.delete(); row.continue(); } };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error("Permanent deletion failed. Your scan may still be in Trash; retry."));
    });
  },
  scans: () => read<Scan[]>("scans"),
  scan: (id: string) => read<Scan | undefined>("scans", id),
  saveScan: (scan: Scan) => save("scans", scan),
  reports: async (scanId: string) =>
    (await read<AiResult[]>("reports"))
      .filter((r) => r.scanId === scanId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20),
  saveReport: async (report: AiResult) => {
    const db = await database();
    return new Promise<void>((resolve, reject) => {
      // The shared transaction prevents a late AI response recreating data after deletion in another tab.
      const tx = db.transaction(["scans", "reports"], "readwrite");
      const scan = tx.objectStore("scans").get(report.scanId);
      scan.onsuccess = () => { if (!scan.result || scan.result.deletedAt) tx.abort(); else tx.objectStore("reports").put(report); };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("Could not save research. Browser storage may be full or blocked."));
      tx.onabort = () => reject(new Error("Research was not saved: the scan is unavailable or browser storage was interrupted."));
    });
  },
};
