import type { Scan } from "./types";
export function setScanTrash(scan: Scan, restore: boolean): Scan {
  if (scan.status === "running") throw new Error("Stop the scan before deleting it.");
  const next = { ...scan };
  if (restore) delete next.deletedAt; else next.deletedAt = new Date().toISOString();
  return next;
}
