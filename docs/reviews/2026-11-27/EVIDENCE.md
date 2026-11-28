# Audit evidence and limits

27 November 2026. Canonical project: `C:\Users\joygh\Documents\Codex\2026-11-26\use-this-skill-install-it-https\outputs\seo-workbench`. `J:\seoauto` contains earlier documentation/graph material, not this running application checkout.

## Browser observations made in this report pass

- Local app at `http://127.0.0.1:4317`, existing five-page practice scan. No new crawl or AI generation was requested. Navigating screens can update normal session/view preferences; no customer content was edited.
- At 1536 px, visited overview, issues, pages, links, Search Console, title batches, speed, plan, verify and AI. All ten rendered without document-level horizontal overflow in this walkthrough. This does not imply every component or data variant fits.
- Overview repeats scan scope, journey cards, next-step guidance, AI suggestions and the right rail. Findings pages expose seven secondary tool/view buttons as well as global navigation.
- Plan displayed an existing practice revision and its matching-value check. Results opened from that baseline displayed older-baseline selection and no older scan, rather than the plan's known check history. No artificial customer success was inferred.
- At 390 px, revisited all ten destinations. Main area measured 322 px because of the 68 px left rail. No document-level horizontal overflow was reported. The inspected visible main buttons did not measure under 24 px in this sample; this is not a complete target-size or spacing audit.
- In the page-review drawer, opened the sample missing-description problem. After lazy evidence content loaded: drawer height 844 px, scroll height about 3269 px, editor top about 2906 px; one issue expanded. The page already has a Draft this fix jump and existing dialog focus management. The problem is density and mixed hierarchy, not absence of all navigation/recovery.
- At 320 px, visited overview, issues, links, plan, search, speed and AI. Main measured 252 px. Plan's Copy implementation brief / Check this page again and Search Console's upload/file controls had bounds extending past the viewport. Root overflow stayed false. This supports U01; do not infer every narrower-screen issue from a single body-overflow check.
- NVIDIA showed Connected. The audit did not read the key, disconnect it or issue a completion.

No screenshot-based full visual review was added in this pass. Findings combine live DOM/layout observations, source and the user's supplied visual examples. Initial, populated and empty surfaces were inspected as available; all failure/provider/data variants were not reproduced.

## Source anchors

| Concern | Owning source examined |
|---|---|
| Global routing and filter reset | `src/main.tsx:336` (`choose`), hash restoration and `reviewIssue` |
| Duplicate overview and rail actions | `src/main.tsx:868–970`, `1437–1449` |
| Page editor and issue-specific evidence | `src/main.tsx` PageDrawer; `src/PageEvidence.tsx:73–105` |
| Browser/scan-scoped draft state | `src/main.tsx:183–208`, `src/repair-plan.ts`, `src/delete-storage.ts` |
| Plan review/revision/handoff | `src/PlanPanel.tsx`, `src/fix-workflow.css`, `tests/repair-plan.test.ts` |
| Check comparison vs Results destination | `src/VerificationPanel.tsx:10–46`, `src/verification.ts` |
| GSC dimensions and fixed screening | `src/search-data.ts` SearchDataset and `searchOpportunities`; `src/SearchConsolePanel.tsx` |
| Links and lexical ranking | `server/audit.ts:342–420`, `src/LinkOpportunities.tsx`, `src/ai-link-evidence.ts` |
| AI source sampling and task instructions | `server/ai.ts:76–204` |
| AI parse/output restrictions | `server/ai.ts` `parseReport`, `REPORT_SCHEMA`, `NvidiaClient`; `src/ai-types.ts` |
| Problem-specific extraction/save | `src/ProblemAssistant.tsx:10–27` |
| AI result presentation | `src/AiStudio.tsx:703` onward, report sections/actions/repair rendering |
| Speed fallback and measurements | `src/PageSpeedPanel.tsx`, `src/pagespeed.ts` |
| Saved scans/Trash and confirmation | `src/SavedWebsites.tsx`, `src/delete-storage.ts`, `src/ScanBackup.tsx` |
| Local/hosted boundaries | `AGENTS.md`, README, SECURITY, `server/index.ts`, `api/index.ts`, `src/client.ts` |
| Shell/reflow/state styling | `src/studio-shell.css`, layered `src/workspace.css`, `src/fix-workflow.css` |

Line numbers are navigation hints for this inspected state, not stable identifiers after implementation. Findings about current behavior defer to owning source and runtime observations, not the older Graphify snapshot.

## What remains unvalidated

Actual recommendation quality across models, latency/hardware suitability, a representative real-user study, all import/result fixtures, concurrent-tab recovery, full keyboard/screen-reader navigation, 400% browser zoom, OS reduced-motion emulation, deployed hosted behavior, external CMS publication and production Google OAuth.

Existing automated tests were inspected as relevant; the previously reported build/test/audit passes were not rerun for this documentation-only request. No new conformance or security certification is claimed.

## Research method

Primary sources were used for model cards, licenses, provider quotas, Google API behavior and WCAG explanations. Links are adjacent to claims in the other reports. UI/UX Pro Max queries supplied supporting guidance: the broad navigation query returned a sticky-nav and unrelated typography result, so it was not accepted as evidence for a new IA; the AI feedback query supported explicit AI labelling/feedback, but does not establish improved model quality. Proposed flows come from this product's observed tasks and source constraints.

Only report files were created for this request. No implementation, model installation or deployment follows until the owner approves a concrete scope.
