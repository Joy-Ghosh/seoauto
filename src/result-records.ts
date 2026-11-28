import type { Repair } from "./types";
import { readRepairPlan } from "./repair-plan";
import { siteHost } from "./search-data";
export type BaselineSummary = { id: string; url: string; startedAt: string };
export type ResultRecord = { baseline: BaselineSummary; repair: Repair };
export function collectResultRecords(website: string, baselines: BaselineSummary[], read: (key: string) => string | null, current?: { id: string; repairs: Repair[] }) {
  const records: ResultRecord[] = [], unreadable: string[] = [];
  for (const baseline of baselines) {
    if (siteHost(baseline.url) !== siteHost(website)) continue;
    try {
      const repairs = current?.id === baseline.id ? current.repairs : readRepairPlan(read("repairs:" + baseline.id));
      for (const repair of repairs) if (siteHost(repair.url) === siteHost(website)) records.push({ baseline, repair });
    } catch { unreadable.push(baseline.id); }
  }
  return { records: records.sort((a, b) => (b.repair.workflow?.checks.at(-1)?.checkedAt || b.repair.workflow?.updatedAt || b.baseline.startedAt).localeCompare(a.repair.workflow?.checks.at(-1)?.checkedAt || a.repair.workflow?.updatedAt || a.baseline.startedAt)), unreadable };
}
