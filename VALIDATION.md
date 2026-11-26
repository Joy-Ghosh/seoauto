# Validation

## Phase one hosted release

- 32 automated tests pass, covering owner authentication, expiry/tampering, credential isolation across cold handler instances, cross-origin rejection, public-only DNS/socket resolution, redirect guards, streamed crawls and cancellation, audit redirect aliases, export formula escaping, WordPress PHP syntax, and stale/overlapping scan reads.
- The initial JavaScript build is 282.38 KB (87.04 KB gzip), compared with 390.44 KB (118.14 KB gzip) before deferred loading. Research and backup modules load on demand, with a loading state and a recoverable error panel. These are bundle measurements, not a measured real-device speed score.
- Local UI checks verified the page-focused AI handoff, task selection surviving navigation after that handoff, and backup controls loading on disclosure. The original localhost mode is running separately from hosted credentials.
- Hosted browser QA used separate disposable credentials. A real example.com crawl completed; a metadata/private-IP target was rejected. History survived reload, a page repair draft appeared in Repair plan, and owner sign-out/sign-in worked. Desktop and 390px layouts were inspected.
- An earlier Chrome import check was blocked by its extension file-URL permission, which was left unchanged. A subsequent isolated hosted-mode check in Brave successfully imported a scan fixture, restored it after reload, and re-imported the same ID without duplicating or overwriting it. The schema and field allowlist were reviewed.
- Hosted NVIDIA transport is covered by simulated-provider tests; the live NVIDIA result below was from the original localhost mode, before these hosted changes.
- Source is published to `Joy-Ghosh/seoauto`. GitHub Actions passed tests, build and dependency audit for commit `44eb09d45e880f2d5ff209570d44f1ba942873e1`.
- Production is READY at https://seo-workbench-ten.vercel.app. Live checks confirmed configured owner authentication, successful sign-in, a completed streamed example.com crawl with one page, and HTTP 401 for an unauthenticated AI endpoint. The corrected deployment had no error/fatal runtime logs during verification. The production sign-in screen was also opened in Chrome.
- The first deployment exposed an ESM import packaging error. Server imports now use compiled `.js` paths, and Node is constrained below version 25; tests and build passed again before the corrected deployment. GitHub is linked for subsequent deployments. Secrets were provisioned through authenticated CLI stdin and excluded from source and archives.
- This is a private single-owner workspace with browser-local persistence, not a multi-user service. ChatGPT MCP integration is deferred to phase two. No live WordPress write was performed.

## NVIDIA AI Studio

- TypeScript check and production frontend build pass.
- The original AI checks are included in the 32-test suite, including crawler and WordPress syntax checks.
- AI tests use a simulated NVIDIA transport and real isolated local HTTP endpoints. They cover the fixed provider URL, Authorization handling, error redaction, allowed repair fields and page URLs, original-value provenance, context limits, report persistence, competitor fetching without credentials, cancellation and concurrent-request rejection.
- Desktop and 390px mobile browser checks cover the connection form, research-tool selection, competitor inputs and disabled generation until connected and consented. Scan-overview actions were checked to retain the website and selected task. The page-review action was checked to preselect the exact page for improvement.
- The running app's status endpoint returns no credentials. Cross-origin API access returns HTTP 403.

A live NVIDIA connection test succeeded after the user entered the key directly in AI Studio. A focused keyword-research run against the saved RankMeRabbit homepage scan then completed successfully, saved a report, displayed its keyword table, actions and evidence, and reported 4,312 total tokens. The key was not read or written to source files.

An earlier broad run using the first 20 successful pages reached the model's output limit. Selecting a page focus and requesting a concise report completed successfully. JSON output constraints, prose-wrapper tolerance and a bounded formatting-correction retry are implemented; the app still reports output-limit failures instead of accepting incomplete drafts. Broad reports may need a narrower page focus or a more concise direction. Provider access, quota and speed depend on the account.

The app does not have a live search engine, keyword metrics, rank tracker or analytics feed. Generated keyword ideas and competitor suggestions require validation. Competitor comparison is grounded in successful fetched pages when URLs are supplied. No website changes were published during this work.

The WordPress companion remains unverified against a live WordPress runtime; its PHP syntax parser check passes.

Local hardware was inspected for a model recommendation: NVIDIA GeForce RTX 3050 Laptop GPU with 4 GB VRAM and about 15 GB usable system RAM. Qwen3 4B via Ollama was recommended as a local option, but neither Ollama nor a local model was installed or integrated during this work. The app's current AI provider is NVIDIA.

## Workflow simplification — 26 November 2026

Four main destinations replace six: Start, Website audit, AI tools and Saved changes. The audit keeps issue, page and link evidence in contextual subviews. Start shows the review → analysis → saved-changes path; detailed statistics and previous scans are disclosed on demand. AI offers four common outcomes and five additional tools, reuses scan context, and collapses optional setup. Required brief/question fields reveal their containing details on browser validation.

The public project guide is available at `/project-guide.html`, with a separate script compatible with the existing Content Security Policy. It contains no credentials or user scan data. It explains usage, owning source files, runtime/storage differences and three proposed next investments.

Validation: 32 automated tests passed with host localhost access (the restricted sandbox blocked three HTTP integration tests). Production build passed. Manual local checks covered audit subviews, AI task switching, page-focus preservation, optional fields, guide tabs and node details. AI view had no document overflow at 390px and 320px; four mobile navigation controls measured 55px tall. No live provider generation or WordPress application was repeated for this UI-only change.

Design Taste gate: FAIL 16, round 1. Open findings: hero-fill; two flush; three no-visual; two button-styles; two cta; five section-tile; container. The checker assumes a marketing page with full-screen sections, marketing imagery and a `.wrap` shell. Those requirements conflict with the requested compact task workspace. No waivers or checker overrides were added. The checker also could not walk 1440; it is not a full accessibility certification. Footer controls subsequently received 44px minimum height. The direct browser interaction checks above are separate evidence.

## Per-page diagnosis and link investigation — 26 November 2026

Replaced the drawer’s finding count-only approach with actual issue evidence, type-specific repair steps, metadata-draft shortcuts, manual work states/notes and Markdown action-list export. A source HTTP 200 is explicitly separated from linked destinations’ recorded HTTP errors. Duplicate metadata lists other matching pages; missing-alt findings list the affected image URLs. Unsuccessful pages no longer offer metadata drafts.

Every scanned page exposes a link neighborhood plus searchable incoming/outgoing occurrences, anchors, follow/nofollow, internal/external scope, response status, redirects and unknown destinations. Full lists retain repeated links; the map previews four connections per side. Clicking a scanned source/destination opens its review, with a return action. Incoming coverage is limited to this scan; unscanned destinations are never called broken. A re-scan shortcut prepares the page URL and a 10-page limit for explicit user submission.

Added three regression tests for healthy sources linking to 404/403 destinations, unknown/external targets, repeated anchors, redirect alias precedence, incoming connections, and status-specific fix guidance. All 35 tests passed. Manual local checks used the user’s existing 44-page scan to verify six recorded 404 article destinations and 18 incoming pages to the Valley of Flowers destination. No user scan data was added to source. Fixture checks confirmed targeted issue expansion, metadata-field selection and focus, persisted manual review state/notes, incoming navigation, return navigation and re-scan URL prefill. Mobile drawer width equaled content width at 390px (375px content area) and 320px (305px content area).

Work states are explicitly unverified notes in browser storage. No publishing, automatic resolution, cross-device note synchronization or new scan comparison is claimed. Supported metadata changes still require export/review/application, and links/headings/server/robots changes require the website editor or hosting configuration. Existing scans remain usable without re-crawling.

## Search data, fix generation and verification — 26 November 2026

Added optional Search Console CSV import and a read-only Google OAuth/API path, with explicit setup/skip states, per-website browser datasets, date/provenance labels and loaded-row metric totals. English Pages/Queries or combined CSVs are bounded at 3 MB/5,000 rows; other-host and invalid rows are excluded. Separate dimensions are not joined. Google OAuth uses state + PKCE, fixed provider endpoints, encrypted owner-bound credentials (maximum one hour), no refresh token persistence, and purpose-separated cookies. Only the short-lived callback-state cookie is Lax; owner and credential cookies stay Strict. Google client credentials are not configured or bundled, so a real account consent/data fetch has not been verified. CSV and OAuth protocol/security mocks were tested independently.

New scans capture up to 200 safe HTML outline blocks, with an explicitly labeled grouped fallback for older scans. Page skeleton issue pins open the relevant problem. Per-problem AI offers H1/title/description/alt/general drafts; alt generation requires user-supplied image context because the text model cannot inspect pixels. H1 is applied manually; supported metadata drafts can be saved to the plan. Category-based title batches select up to ten successful pages, run sequentially, support review/editing and refuse empty/conflicting selected titles. AI and page evidence modules are loaded on demand.

Saved-plan and page-review re-scan actions now create a one-page scan, remember the baseline and automatically compare after completion. Expected drafts, metadata changes and finding states are distinct. A limited re-scan does not verify cross-page uniqueness or still-linked destinations that were not re-read. Manual review states do not affect evidence-based verification. Two added regressions cover these coverage traps and bulk title conflicts.

Technology hints are collected passively during new crawls. On-demand inspection supports older scans by reading public HTML/headers and up to two same-origin script prefixes (700 KB each), with robots and public-network restrictions; scripts are never executed. Real public inspection of the Kuari Pass URL returned HTTP 200 and Next.js/React hints from page/first-party assets. An undisclosed PHP/Laravel/backend remains unknown without public evidence. Competitor research now guides URL selection by market/intent, opens competitor inputs directly and requests a source-backed gap/action matrix; model-only competitors remain unverified.

Final automated validation: 45 tests passed; dependency audit reported zero vulnerabilities. The production build passed with lazy chunks for page evidence, technology, bulk titles, Search Console and verification. Existing third-party Zod annotation warnings are non-blocking.

Isolated UI QA used a localhost-only fixture server and simulated NVIDIA/website responses, not production credentials or actual publishing: selected two category/title-problem pages, generated and reviewed two drafts, saved both to the plan, simulated publication, and verified an exact expected title match plus the H1 change through the one-page workflow. Duplicate title review blocked saving until edited. Skeleton → issue → H1 generation returned a reviewable fixture draft. Search Console CSV import produced 15 clicks, 900 impressions, 1.67% CTR and 9.7 weighted position, and persisted after reload. Search view fit at 390px and bulk-title view fit at 320px without document overflow. Temporary QA server and tab were closed. These tests validate workflow behavior, not live model quality, a real Google account connection or WordPress application.

Free API/repository research and limitations are in docs/NEXT-IMPROVEMENTS.md; optional Google setup is in docs/SEARCH-CONSOLE.md. Generated ZIP downloads are excluded from source publication and recreated from reviewed PHP by the build.

## Dashboard technology visibility — 26 November 2026

- Fixed the visibility gap: website technology now appears below the page heading in every scanned website view, rather than only inside a page review. Older scans automatically get a bounded public-resource inspection. Signals distinguish platforms, frameworks, UI libraries and backend hints; no WordPress/Shopify claims without evidence.
- A per-origin 24-hour cache avoids repeated inspections when navigating or reopening a scan. Recheck bypasses it. Expired/malformed/foreign-origin cached data is rejected; abandoned requests cannot update a different scan. Sample audits are not inspected. Page-specific inspection remains available separately.
- Polished audit navigation, mobile two-column tabs, readable website switcher, visible page/finding totals, keyboard focus rings, responsive technology badges and review-copy plurals. Kept existing semantic color tokens and system fonts. UI/UX Pro Max's dashboard style and async error guidance applied; its unrelated marketing gateway pattern was excluded.
- 48 tests passed, including three new regressions for cache age/origin/data shape, scan evidence merging and WordPress/Shopify/Next.js markers. Initial sandbox run blocked three local-HTTP integration tests; rerun with local network access passed all 48. Production build passed; dependency audit reports zero vulnerabilities.
- Browser verification: an existing 44-page Himalayas Griffon scan automatically displays Next.js + React on Start and Website audit. Mobile 375x812 and landscape 844x390 have no document horizontal overflow; audit controls measure at least 44px tall. Local fixture URL inspection shows a clear public-URL restriction and retry state. No new NVIDIA call or CMS mutation was performed.
- Dark theme colors inherit existing independently defined semantic tokens; full OS-level dark-mode, largest system text, screen-reader and reduced-motion interaction testing was not performed in this pass. No new animations were introduced. This is not a full production security/accessibility certification.
