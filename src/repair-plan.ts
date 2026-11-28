import { z } from "zod";
import type { Repair, Scan } from "./types";

const httpUrl = z.string().max(8000).refine(value => { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } });
const timestamp = z.string().max(60).refine(value => Number.isFinite(Date.parse(value)));
const workflowSchema = z.object({
  revision: z.number().int().min(1).max(1000000), baselineScanId: z.string().max(200), updatedAt: timestamp,
  reviewedAt: timestamp.optional(), publishedAt: timestamp.optional(),
  previous: z.array(z.object({ revision: z.number().int().positive(), value: z.string().max(20000), updatedAt: timestamp })).max(5),
  checks: z.array(z.object({ scanId: z.string().max(200), checkedAt: timestamp, status: z.enum(["matches_draft", "does_not_match", "not_checked"]), actual: z.string().max(20000).nullable().optional() })).max(5),
});
const repairSchema = z.object({ id: z.string().max(20000), url: httpUrl, field: z.enum(["title", "meta_description", "alt_text"]), original: z.string().max(20000), value: z.string().max(20000), imageSrc: httpUrl.optional() });

export function readRepairPlan(raw: string | null): Repair[] {
  const data: unknown = JSON.parse(raw || "[]");
  if (!Array.isArray(data) || data.length > 5000) throw new Error("This saved plan could not be read. Export a backup before changing browser data.");
  return data.map(item => {
    const repair = repairSchema.parse(item);
    // Legacy drafts remain usable; malformed workflow metadata never grants approval.
    const result = workflowSchema.safeParse(item?.workflow);
    return { ...repair, ...(result.success ? { workflow: result.data } : {}) };
  });
}

export function savePlanDraft(previous: Repair | undefined, repair: Repair, scan: Pick<Scan, "id">, now = new Date().toISOString()): Repair {
  const clean = repairSchema.parse(repair);
  if (clean.field !== "alt_text" && !clean.value.trim()) throw new Error("Write a replacement before saving this draft.");
  const sameTarget = previous?.url === clean.url && previous.field === clean.field && previous.imageSrc === clean.imageSrc;
  const prior = sameTarget ? previous : undefined;
  if (prior && prior.value === clean.value && prior.original === clean.original) return prior;
  const revision = (prior?.workflow?.revision || (prior ? 1 : 0)) + 1;
  const previousVersions = prior ? [...(prior.workflow?.previous || []), { revision: prior.workflow?.revision || 1, value: prior.value, updatedAt: prior.workflow?.updatedAt || now }].slice(-5) : [];
  return { ...clean, workflow: { revision, baselineScanId: scan.id, updatedAt: now, previous: previousVersions, checks: [] } };
}

export function reviewPlanDraft(repair: Repair, baselineScanId: string, now = new Date().toISOString()): Repair {
  return { ...repair, workflow: { ...(repair.workflow || { revision: 1, baselineScanId, updatedAt: now, previous: [], checks: [] }), reviewedAt: now } };
}
export function reportPlanPublished(repair: Repair, now = new Date().toISOString()): Repair {
  if (!repair.workflow?.reviewedAt) throw new Error("Review the exact draft before reporting publication.");
  return { ...repair, workflow: { ...repair.workflow, publishedAt: now, checks: [] } };
}
export function recordPlanCheck(repair: Repair, expected: { revision: number; value: string }, check: NonNullable<Repair["workflow"]>["checks"][number]): Repair {
  if (!repair.workflow?.publishedAt || repair.workflow.revision !== expected.revision || repair.value !== expected.value) return repair;
  return { ...repair, workflow: { ...repair.workflow, checks: [...repair.workflow.checks, check].slice(-5) } };
}
export function repairStatus(repair: Repair): string {
  const check = repair.workflow?.checks.at(-1);
  return check ? check.status === "matches_draft" ? "Matches saved value" : check.status === "does_not_match" ? "Value differs" : "Could not check" : repair.workflow?.publishedAt ? "Reported published · needs check" : repair.workflow?.reviewedAt ? "Reviewed · ready to apply" : "Draft · needs review";
}
export function implementationBrief(repair: Repair): string {
  return ["SEO Workbench · implementation brief", `Page: ${repair.url}`, `Field: ${repair.field}`, ...(repair.imageSrc ? [`Image: ${repair.imageSrc}`] : []), `Baseline scan: ${repair.workflow?.baselineScanId || "See original scan"}`, `Draft revision: ${repair.workflow?.revision || 1}`, "", "Observed baseline value:", repair.original || "(empty or missing)", "", "Approved replacement:", repair.value === "" ? 'Empty alt attribute: alt="" (confirm the image is decorative).' : repair.value, "", "Locate the field for this exact page in the CMS or source. No repository path has been inferred.", "Compare the current value with the baseline before editing. If it differs, stop and review the conflict.", "Change only the named field; preserve other content, permissions and unrelated metadata. Review a preview before publishing.", ...(repair.field === "alt_text" ? ["Confirm image purpose visually. Attachment-level alt text may affect other uses of this image."] : []), "After publishing, return to the plan, report publication and check the page response.", "A matching response confirms this field only, not ranking or traffic impact."].join("\n");
}
