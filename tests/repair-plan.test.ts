import { test } from "node:test";
import assert from "node:assert/strict";
import { implementationBrief, readRepairPlan, recordPlanCheck, repairStatus, reportPlanPublished, reviewPlanDraft, savePlanDraft } from "../src/repair-plan";
import { verifyChanges } from "../src/verification";
import { parsePage, analyze } from "../server/audit";
import type { Repair, Scan } from "../src/types";
const draft: Repair = { id: "title-draft", url: "https://example.test/page", field: "title", original: "Old title", value: "Specific page title" };
const baseline = { id: "baseline" };
const now = "2026-11-27T10:00:00Z";

test("legacy drafts require review, publication reports do not verify, and revisions invalidate old checks", () => {
  const legacy = readRepairPlan(JSON.stringify([draft]))[0];
  assert.equal(repairStatus(legacy), "Draft · needs review");
  assert.throws(() => reportPlanPublished(legacy), /Review/);
  const reviewed = reviewPlanDraft(legacy, baseline.id, now);
  const published = reportPlanPublished(reviewed, now);
  assert.equal(repairStatus(published), "Reported published · needs check");
  const checked = recordPlanCheck(published, { revision: 1, value: draft.value }, { scanId: "after", checkedAt: now, status: "matches_draft", actual: draft.value });
  assert.equal(repairStatus(checked), "Matches saved value");
  const changed = savePlanDraft(checked, { ...checked, value: "Another specific title" }, baseline, now);
  assert.equal(changed.workflow?.revision, 2);
  assert.equal(changed.workflow?.reviewedAt, undefined);
  assert.equal(changed.workflow?.publishedAt, undefined);
  assert.equal(changed.workflow?.checks.length, 0);
  assert.equal(changed.workflow?.previous[0].value, draft.value);
  const reapproved = reportPlanPublished(reviewPlanDraft(changed, baseline.id, now), now);
  assert.equal(recordPlanCheck(reapproved, { revision: 1, value: draft.value }, { scanId: "stale", checkedAt: now, status: "matches_draft" }), reapproved);
});

test("malformed storage cannot grant approval; unsafe URLs and unsupported fields are rejected", () => {
  const parsed = readRepairPlan(JSON.stringify([{ ...draft, workflow: { reviewedAt: true, publishedAt: true } }]))[0];
  assert.equal(parsed.workflow, undefined);
  assert.throws(() => readRepairPlan(JSON.stringify([{ ...draft, url: "javascript:alert(1)" }])));
  assert.throws(() => readRepairPlan(JSON.stringify([{ ...draft, field: "body_html" }])));
  assert.throws(() => readRepairPlan("{}"));
  assert.throws(() => savePlanDraft(undefined, { ...draft, value: " " }, baseline));
  assert(!implementationBrief(draft).includes("src/app"));
  assert.match(implementationBrief(draft), /stop and review the conflict/);
});

test("response comparison retains mismatch/unavailable and distinguishes missing versus decorative alt", () => {
  const page = parsePage('<title>Old title</title><img src="/photo.png">', draft.url);
  const makeScan = (id: string, date: string, pages: Scan["pages"]): Scan => ({ id, url: draft.url, startedAt: date, status: "completed", limit: 1, pages, ...analyze(pages), discovered: pages.length, skipped: 0, skippedUrls: [], notice: [] });
  const before = makeScan("before", "2026-11-26T10:00:00Z", [page]);
  const alt: Repair = { ...draft, field: "alt_text", imageSrc: page.images[0].src, original: "", value: "" };
  const missing = makeScan("missing", now, [page]);
  assert.equal(verifyChanges(before, missing, [alt]).drafts[0].status, "does_not_match");
  const decorative = makeScan("decorative", now, [parsePage('<img src="/photo.png" alt="">', draft.url)]);
  assert.equal(verifyChanges(before, decorative, [alt]).drafts[0].status, "matches_draft");
  const failed = makeScan("failed", now, [{ ...page, status: 0, error: "Timeout" }]);
  assert.equal(verifyChanges(before, failed, [draft]).drafts[0].status, "not_checked");
  const check = recordPlanCheck(reportPlanPublished(reviewPlanDraft(draft, baseline.id, now), now), { revision: 1, value: draft.value }, { scanId: "failed", checkedAt: now, status: "not_checked" });
  assert.equal(repairStatus(check), "Could not check");
});
