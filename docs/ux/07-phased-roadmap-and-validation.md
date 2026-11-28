# Phased delivery and validation gates

Status: proposed delivery plan, 27 November 2026. No phase below is marked shipped by this document. Existing functionality is evidence for feasibility, not proof of usability, customer demand or SEO impact.

Implementation update: the first supported metadata workflow is available locally; see [implementation status](10-workflow-implementation.md). The formative participant validation gates below remain open.

## MVP hypothesis

The first audience, selected by the user, is freelance SEO practitioners and vibe coders. The smallest useful product helps them choose one credible finding, save an accurate title/description/alt draft, apply it through their editor or an editable coding-agent brief, and verify the change in the retrieved HTML response. A core audit and manual draft must work without AI or Google connections. WordPress/Shopify owners follow; multi-client agencies require stronger durable provenance and collaboration contracts.

The first win is **one worthwhile change whose observed value matches the approved draft**. It is not “scan completed”, “AI report generated” or “ranking improved”. Users also need a legitimate exit: decide a finding is intentional, record why and stop reviewing it.

The proposed MVP excludes automatic publishing, broad keyword intelligence, guaranteed traffic gains, a multi-user public SaaS and a mandatory mascot. H1, link and schema work can stay inspectable as suggestions until a comparable plan item and verifier exist. Public speed tools, local full audit and the private hosted owner workspace remain visibly different access modes.

## Phase gates

| Phase | Deliverable | Pass criteria before proceeding | Failure / stop condition |
| --- | --- | --- | --- |
| 0 · Understand | Current evidence inventory, provisional personas, journeys, opportunity/trust model, architecture/copy and brand rules | Every claimed capability cites owning source; every demand/emotion claim is labelled hypothesis or supported by research; prioritised research questions exist | Team cannot explain the primary user, first win or publication boundary consistently |
| 1 · First useful decision | Task-led prototype and opportunity review flow | Representative users find a relevant page, explain the evidence and choose a sensible next action without choosing among nine AI tools; retry and partial-scan paths preserve work | Participants mistake a heuristic/AI suggestion for a proven problem or cannot find the next action |
| 2 · Finish a fix | Versioned plan item → manual implementation → expected/actual check | Supported title/meta/alt cases retain baseline, original and proposal; matches/mismatches/not-checked are distinct; editable draft never counts as published | Saving a draft marks an issue fixed; unavailable coverage appears successful; storage failure loses work without recovery |
| 3 · Prioritise using measurement | GSC evidence attached to opportunities and optional AI inputs; comparison periods | Correct property/date/dimension survive import; separate exports are not joined; only consented rows reach AI; no invented uplift estimates; comparison uses compatible periods | Query-only data is labelled page data, imports imply live ownership verification, or GSC is treated as competitor data |
| 4 · Apply with connectors | One provider-specific draft/preview/apply/restore workflow | Owned staging test proves preview, permission scope, conflict detection, publish confirmation, rollback and live verification; provider-specific fields are documented | Stored value differs from served page without detection, conflicting edits overwrite, or rollback fails |
| 5 · Access through MCP / broader service | Durable ownership, scoped authorisation, typed tools, quotas and cross-device model | Read/research/write boundaries and revocation tested; tools reuse evidence and plan contracts; hosted cost model and access expectations clear | Browser-local history is presented as remotely available, a private owner password becomes public customer authentication, or unlimited-free usage is promised |

Provider connectors require separate implementation and staging checks. Google OAuth redesign is separately scoped; ZIP research can be tested without it.

## What to validate and how

Start with a small formative round across both primary groups and one less-technical owner. This is discovery, not a statistically representative market study. Observe actual work on a site they are permitted to edit, plus controlled fixtures for errors. Record consent and redact credentials/client details.

Give outcome tasks rather than screen instructions:

1. “Choose one page you would improve next and explain why.”
2. “Prepare a change you would be comfortable applying.”
3. “Show what you would give the person editing the website.”
4. “You have made the change. Find out whether this tool can confirm it.”
5. “The re-scan failed. Recover without losing the draft.”

Measure task completion, moderator help, incorrect interpretation of evidence, loss of context and abandoned/reworked drafts. Ask confidence in their own words before and after checking evidence. Do not replace observed behaviour with a satisfaction score. Time each task only in research sessions; no current time-to-value baseline has been measured.

Proposed events: result reviewed, draft saved, verification requested and its outcome, retry/export recovery, return to unfinished work. No page content, query text or URL in analytics by default. Report match rate over readable checks, with unreadable checks separately.

A provisional first-round release gate is that every participant can distinguish **draft**, **reported published** and **verified value**, and no participant loses work in the scripted recovery cases. If that fails, revise the labels and workflow before adding capabilities. Numerical speed or conversion targets should be set after a baseline round, not invented now.

## Design and engineering acceptance

- Trace each screen to a job and one primary action; move optional connections and advanced research behind relevant contexts.
- Test no-scan, no-AI, no-GSC, partial crawl, zero result, invalid import, provider quota, cancelled work, stale baseline and failed storage.
- Preserve keyboard order, visible focus, named controls, readable errors and focus return after a drawer closes. Verify phone/tablet/desktop, long URLs, text enlargement and reduced motion with the built UI.
- Severity, evidence completeness, editorial judgement and ranking effect remain separate. Unknown is not zero, and fewer reported findings are not automatically a healthier site.
- A brand illustration may assist onboarding, an empty state or a completed-work acknowledgement. It must not cover evidence, imply improvement before verification or turn a failure/deletion into a joke.
- Build and run the relevant regression checks after implementation; document the exact revision and paths tested. A passing build does not validate the journey. A usability session does not establish ranking causation.

## Immediate next slice

After reviewing Phase 0, prototype one opportunity detail and one plan/verification sequence using real retained evidence and a labelled fixture. Test the copy and information order before another full-theme rewrite. Use the same component and state vocabulary when expanding the rest of the product. Keep the current app available as a baseline while the proposed workflow is evaluated.

Sources: `src/types.ts`, `src/verification.ts`, `src/main.tsx`, `src/SearchConsolePanel.tsx`, README and SECURITY.md. See [product evidence](01-current-product-evidence.md), [journeys](03-journeys-and-service-blueprint.md) and [screen contracts](05-information-architecture-and-copy.md).
