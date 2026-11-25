# Validation

## Phase one hosted release

- 29 automated tests pass, covering owner authentication, expiry/tampering, credential isolation across cold handler instances, cross-origin rejection, public-only DNS/socket resolution, redirect guards, streamed crawls and cancellation, audit redirect aliases, export formula escaping and WordPress PHP syntax.
- Hosted browser QA used separate disposable credentials. A real example.com crawl completed; a metadata/private-IP target was rejected. History survived reload, a page repair draft appeared in Repair plan, and owner sign-out/sign-in worked. Desktop and 390px layouts were inspected.
- Browser scan-import verification was blocked by the Chrome extension's file-URL permission. The setting was left unchanged. The import schema and field allowlist were reviewed.
- Hosted NVIDIA transport is covered by simulated-provider tests; the live NVIDIA result below was from the original localhost mode, before these hosted changes.
- GitHub publication and Vercel deployment remain pending account authentication. The Vercel project exists, but its connector rejected environment-variable provisioning; the CLI login is expired. No functional cloud release is claimed.
- This is a private single-owner workspace with browser-local persistence, not a multi-user service. ChatGPT MCP integration is deferred to phase two. No live WordPress write was performed.

## NVIDIA AI Studio

- TypeScript check and production frontend build pass.
- The original AI checks are included in the 29-test suite, including crawler and WordPress syntax checks.
- AI tests use a simulated NVIDIA transport and real isolated local HTTP endpoints. They cover the fixed provider URL, Authorization handling, error redaction, allowed repair fields and page URLs, original-value provenance, context limits, report persistence, competitor fetching without credentials, cancellation and concurrent-request rejection.
- Desktop and 390px mobile browser checks cover the connection form, research-tool selection, competitor inputs and disabled generation until connected and consented. Scan-overview actions were checked to retain the website and selected task. The page-review action was checked to preselect the exact page for improvement.
- The running app's status endpoint returns no credentials. Cross-origin API access returns HTTP 403.

A live NVIDIA connection test succeeded after the user entered the key directly in AI Studio. A focused keyword-research run against the saved RankMeRabbit homepage scan then completed successfully, saved a report, displayed its keyword table, actions and evidence, and reported 4,312 total tokens. The key was not read or written to source files.

An earlier broad run using the first 20 successful pages reached the model's output limit. Selecting a page focus and requesting a concise report completed successfully. JSON output constraints, prose-wrapper tolerance and a bounded formatting-correction retry are implemented; the app still reports output-limit failures instead of accepting incomplete drafts. Broad reports may need a narrower page focus or a more concise direction. Provider access, quota and speed depend on the account.

The app does not have a live search engine, keyword metrics, rank tracker or analytics feed. Generated keyword ideas and competitor suggestions require validation. Competitor comparison is grounded in successful fetched pages when URLs are supplied. No website changes were published during this work.

The WordPress companion remains unverified against a live WordPress runtime; its PHP syntax parser check passes.

Local hardware was inspected for a model recommendation: NVIDIA GeForce RTX 3050 Laptop GPU with 4 GB VRAM and about 15 GB usable system RAM. Qwen3 4B via Ollama was recommended as a local option, but neither Ollama nor a local model was installed or integrated during this work. The app's current AI provider is NVIDIA.
