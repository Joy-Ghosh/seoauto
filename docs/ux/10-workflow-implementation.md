# First complete fix workflow

Implemented locally on 27 November 2026. This is the first workflow slice from the UX foundation, not completion of every roadmap phase or validation of customer demand.

## Try it

1. Open `http://127.0.0.1:4317`. Use **Explore a sample** or open a saved website.
2. Open **Opportunities**, then **Review problem**. The page panel explains the evidence source, date, limits and next decision. Incoming/outgoing links and the skeleton remain available.
3. Write a title, description or image-alt replacement. Save the draft, then open **Plan**.
4. Compare the observed baseline with your replacement. Inspect the page if needed, then **Approve this draft**.
5. **Copy implementation brief** and apply the change in your CMS or source. The brief names the page, field, original and replacement, and asks the implementer to stop on a conflict. It does not invent a source-file path.
6. After actual publication, select **I’ve published this change**, then **Check published page**.
7. **Results** shows expected and observed values. **Return to baseline plan** brings the result back to the saved work. A mismatch and an unavailable check remain distinct from a match.

The sample is deliberately imperfect. Do not report it published as evidence of changing a real website. QA exercised the state transitions with this fixture without publishing to any customer website.

## What changed

- Main navigation follows Websites / Opportunities / Plan / Results. AI tools remain available through Tools and contextual actions.
- Opportunity review now exposes a compact evidence contract. Editorial heuristics are identified as review signals rather than automatic defects.
- Drafts retain a revision, baseline scan identity, update time, review time and user-reported publication time. The last five previous replacements and five checks per current revision are bounded in storage.
- Editing the replacement clears that revision’s approval, publication report and checks. Previous check results cannot validate changed wording.
- A plan-initiated check captures the exact draft revision and value. Its result is written only to a matching, reported-published revision, after a scan started following the publication report. The current stored plan is reread before updates; a missing/deleted plan is not recreated.
- Existing drafts load as needing review. Malformed workflow metadata cannot grant approval. Unsupported repair fields and unsafe URL schemes are rejected on plan load.
- Missing alt and deliberately empty alt stay distinct in comparisons. Empty-alt drafts require visual review and manual application; the current WordPress companion rejects empty replacements.
- Storage errors keep the current draft in view and explain exporting before leaving. A failed write is not durable storage. Successful later writes clear the storage warning.

## Evidence and checks

The production build and 65-test suite passed during this implementation. The initial restricted-shell suite had three local-HTTP failures; all 65 passed when rerun with host networking. Dependency audit reported zero vulnerabilities. Final check results are recorded in the completion message.

Chrome checks covered opportunity → manual draft → approval → publication report → page check → return to baseline plan; a mismatch; a matching existing fixture value; and resetting approval/checks after editing. The matching fixture test proves value comparison, not a successful website edit. A quota-error simulation retained the replacement in view and displayed the backup warning. Desktop and 390-pixel mobile screenshots were inspected; the plan had no page overflow and its action buttons were at least 44 pixels high. Reduced-motion behavior is implemented through a `no-preference` media guard on the small status acknowledgement; this pass did not emulate the OS motion preference or certify accessibility. A reload retained the saved revision and comparison. Editing focused the textarea, and cancelling returned focus to Edit replacement. These focused checks do not constitute a complete keyboard or screen-reader audit. No real participant study was performed.

## Boundaries and remaining tasks

- Publishing is manual. Provider-specific live application still requires separate staging and permission checks.
- Supported typed repairs remain title, description and image alt. H1, schema and internal-link changes remain suggestions/manual work.
- Plans are browser-local and attached to a baseline scan. Re-scans link back to that baseline; this is not a cloud project database or cross-device collaboration.
- Exported plans include workflow metadata for reference. The existing scan-backup importer restores draft values, not approval/verification history. Review imported drafts again.
- Search Console has not been added to AI input in this phase. Competitor/SERP intelligence and the Google connection redesign remain separate work.
- The broader dashboard, agency permissions, durable site-level history and usability research remain roadmap tasks. This implementation does not establish SEO traffic or ranking impact.
- No GitHub push or Vercel deployment was performed for this slice.

Owning modules: `src/repair-plan.ts`, `src/PlanPanel.tsx`, `src/fix-workflow.css`, `src/main.tsx`, `src/PageEvidence.tsx`, `src/VerificationPanel.tsx`, `src/types.ts`; regressions: `tests/repair-plan.test.ts`.
