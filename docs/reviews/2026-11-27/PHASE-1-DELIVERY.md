# Approved Phase 1: implementation and checks

27 November 2026. Implements the Phase 1 scope approved after [the audit report](REPORT.md). This is a local delivery, not a Vercel release or completion of every proposal.

## Delivered

| Audit item | Change |
|---|---|
| U01 · narrow-screen actions | Action labels wrap; buttons, inputs and file controls remain bounded to their columns. Plan steps stack at narrow widths. |
| U02 · Results continuity | Results lists saved drafts and latest check outcomes from this website's available scan plans in this browser. It shows baseline identity, expected/observed values and timestamps. Open baseline plan returns to the source work. Advanced scan comparison is secondary. A newly requested check displays draft values before other findings. |
| U04 · competing navigation | Removed the permanent right journey rail and repeated overview workflow cards. Findings/Pages/Links remain together; AI, search data, speed and batch titles live under Tools and contextual entry points. A manual plan does not require choosing AI. |
| U07 · focused page review | Editable findings show the selected observation and the corresponding field editor together. Full page content, links, skeleton and other findings stay accessible through a disclosure. Technology/re-scan controls sit under response evidence. Unsupported repairs retain their practical evidence/instructions. |
| U08 · remembered context | Query, severity and finding-type filters are scoped by scan/destination and retained in this tab's session. Navigation scroll positions are retained in memory. Finding links include scan and finding identity; missing linked scans/findings explain the recovery path. Closing a review clears its link state. |
| U19 · copy | Consistent Plan/Results navigation, fewer repeated instructions, no inference of publication from saving, and repaired encoding characters in AI labels. Technical export identifiers remain unchanged. |

Additional checks caught and corrected low-contrast website-name text in the sidebar and focus restoration after closing a dialog. Remembered filters are removed for the specific scan on permanent deletion; other scan contexts remain.

## Verification

- Automated suite: 69 passing tests, including new result aggregation, cross-site isolation, unreadable-plan recovery, filter/deep-link parsing and scoped session cleanup.
- Production TypeScript/Vite/assets build passed during integration. Dependency audit reported zero vulnerabilities. The final build completed successfully.
- Browser: Results found the existing practice baseline check, with advanced comparison initially closed. A practice-page recheck ran through Results and saved a matching response value. This tests the comparison workflow; no customer website was published or edited.
- At 320 px, inspected Plan, Search Console, speed, titles, links and Results: no inspected action/form control extended outside the viewport; bounded table regions are separate. Plan/Search Console/Results also passed the same focused checks at 390 and 768 px. A desktop Results screenshot was inspected at 1440 px.
- Findings search survived moving to Pages and back. A fresh tab opened the linked scan and its selected description finding without an unrelated baseline selection. The description editor measured around y=763 in the 320 px drawer, versus roughly y=2906 in the audited mixed-content drawer; exact positions depend on content and text wrapping.
- Keyboard review covered Enter to open, focus entry, Shift+Tab containment and Escape. The final check found body-focus restoration; the fix tracks the last focused control outside dialogs and returns focus there, with a heading fallback. Retest passed: Escape closed the drawer and focus returned to the Review problem button.

These are focused checks, not a complete WCAG certification, OS reduced-motion audit or real-user validation study. The local sample can legitimately show technology inspection blocked by public-network safeguards; those protections were not loosened for the fixture.

## Remaining boundaries

Plans still use their original browser-local scan records. Results reads them across available scans; this phase does not migrate storage, create a cloud website database or provide cross-device history. Missing or unreadable plans do not get silently recreated.

AI prompts/models, GSC measurement in AI input, semantic retrieval, local inference, Lighthouse workers, provider publishing, public multi-user access and agency collaboration remain later phases. No model was installed or generated output benchmarked. No GitHub push or Vercel deployment was performed.

Primary modules: `src/main.tsx`, `ResultsPanel.tsx`, `result-records.ts`, `VerificationPanel.tsx`, `workspace-context.ts`, `phase-one.css`, `delete-storage.ts` and `tests/phase-one.test.ts`.
