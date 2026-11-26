# Ponytail audit — 26 November 2026

What this repo does: SEO Workbench reads public website HTML, records SEO and linking evidence, and creates reviewable change plans. Optional NVIDIA research and Search Console data support that workflow. I assumed one private owner using localhost or the protected Vercel workspace, at the existing 200-page scan limit.

## Must fix — resolved in this release

1. **Hestia's saved WordPress evidence was ignored** (`src/site-technology.ts`, `src/WebsiteTechnology.tsx`, `src/TechnologyPanel.tsx`).
   - What this is: Technology cards used a new optional scan field or a fresh public fetch.
   - Problem: Older Hestia scans have no technology field. During this check, the local resolver could not resolve the domain and Google's public resolver returned DNS status 2 (SERVFAIL). The saved scan already contains same-site `/wp-content/` image URLs. The UI discarded that useful evidence.
   - Fix: Infer WordPress from retained same-site asset paths. Show the scan date and distinguish saved evidence from a successful live inspection. Both the website card and page review use the same helper. Live DNS failures now have a specific error.
   - If skipped: A temporary connectivity problem makes a known WordPress site appear unidentified. This fix does not change the website's DNS or claim that historical evidence is a current live check.

2. **Local scan saves could race or leave a partial JSON file** (`server/index.ts`, `server/scan-store.ts`).
   - What this is: Local completion saves a scan to disk; the new delete/restore actions also save it.
   - Problem: Direct asynchronous writes to the same filename can overlap. A late completion write could overwrite a later trash action; a failed write could leave unreadable history.
   - Fix: Serialize writes per scan, capture each version at the call, and atomically rename a temporary file after writing it. A regression checks completion followed by trash and restore. No extra dependency.
   - If skipped: A removed scan can reappear after restart, or its saved evidence can be lost.

3. **Robots handling differed between normal and technology scans** (`server/crawler.ts`, `server/inspect-technology.ts`, `server/public-network.ts`).
   - What this is: Both flows read robots.txt before following site resources.
   - Problem: Normal crawling proceeded on HTTP 401/403/429; technology inspection refused those responses. The hosted request user-agent also differed from the identity used to select robots rules.
   - Fix: Share one bounded robots reader across both flows and redirected origins. Stop on denied, rate-limited or server-error responses; cancel unused response bodies; use the matching crawler identity. Tests cover denied responses and the actual public-fetch user-agent.
   - If skipped: Crawling can proceed despite unknown access restrictions or obey rules for the wrong crawler identity.

## Should fix

4. **Interrupted browser writes need a clear failure — fixed** (`src/local-db.ts`, `src/main.tsx`).
   - What this is: Browser history uses IndexedDB; change plans use localStorage.
   - Problem: An aborted IndexedDB transaction did not explicitly reject its save promise. A full/blocked localStorage write could throw from the root effect.
   - Fix: Reject aborted transactions and show an export-before-closing error when draft persistence fails. Scan-trash client tests check that successful writes precede removal from the visible list.
   - If skipped: A save action can remain pending or a storage problem can disrupt the dashboard.

5. **A failed final hosted scan save can still be hidden** (`src/client.ts:133`).
   - What this is: The streamed hosted scan performs a final browser persistence write.
   - Problem: If browser quota is exhausted at that exact write, the final catch suppresses the storage error. Earlier checkpoints may remain, but the newest completion state is not guaranteed to survive reload.
   - Fix: A follow-up should retain the unsaved result in a visible export/retry state instead of silently releasing the active scan. This requires an explicit recovery UI and quota-failure browser test; it was not added to the deletion change.
   - If skipped: Very large scans or a full browser profile can reopen an older checkpoint. Keep scan backups; trash is recoverable and deliberately does not free storage.

6. **WordPress writes need a staging runtime test** (`wordpress/local-seo-repairs/local-seo-repairs.php`).
   - What this is: The optional companion previews, applies and restores title, description and attachment-alt changes.
   - Problem: Syntax and guards are tested, but real WordPress database/cache/theme behavior is not. An SEO plugin or cached page can mask a stored override.
   - Fix: Test preview, competing edits, apply, cache purge and restore on a staging WordPress installation before enabling it on a live site.
   - If skipped: Stored values can differ from what the public page serves. No live WordPress mutation was performed here.

## Nice to have

7. **Keep further interface work scoped by responsibility** (`src/main.tsx`).
   - What this is: The root contains scan selection, repair persistence, the audit views and page editing.
   - Problem: A change in one workflow requires reviewing several unrelated state transitions. The new SavedWebsites component keeps trash management out of the root; the remaining existing views still share this large component.
   - Fix: Extract a view only when it next changes substantially; preserve its current validation, focus handling and error states. Do not add a state framework for this private-owner workload.
   - If skipped: Future edits need more careful regression review. No current correctness failure is asserted from file size alone.

Verdict: The requested delete/restore and WordPress fixes are implemented with regression coverage. Remaining priorities are explicit recovery for browser quota exhaustion and real WordPress staging validation.

Checked: build/dependency/CI configuration; local and hosted API entry points; auth/cookies and fixed provider endpoints; DNS/redirect guards; crawl/robots/parser flows; technology caches; browser/disk persistence; exports/import schema; verification/title conflict logic; research result validation; WordPress apply/restore guards; saved website and main dashboard UI. Tests/build/dependency audit and targeted browser checks are recorded in VALIDATION.md.

Not checked: Every line of every view, a multi-user/public-service load model, live Google OAuth consent, fresh NVIDIA generation, WordPress runtime writes, browser quota exhaustion recovery, or an independent penetration/accessibility assessment. Existing owner protection remains required; this app has no distributed login rate limiter or cross-device database. No dependencies were added. Deletion is recoverable trash, not permanent data erasure.
