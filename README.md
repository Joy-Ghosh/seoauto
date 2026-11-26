# Local SEO Workbench

Version 0.2 also includes a protected, stateless hosted workspace for Vercel. Start with [HOSTED.md](HOSTED.md) for phase-one deployment, [SECURITY.md](SECURITY.md) for the security model, and [docs/PHASES.md](docs/PHASES.md) for the future MCP work. The instructions below describe the original localhost mode; hosted credentials use encrypted session cookies and hosted history stays in the browser.

A local, rule-based website crawler, SEO audit and reviewable repair plan. No paid APIs, accounts or AI service are required.

Optional **AI Studio** adds NVIDIA-powered research using your own API key. The crawler works without it.

## Run

Requires Node.js 22.14 or newer.

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:4317**. The app binds to your computer only. Try **Try the local sample** to crawl a deliberately imperfect local fixture. Enter a website to scan its response HTML. Crawling makes HTTP requests to the target website but does not edit it.

For a production frontend build: `npm run build`, then `npm start`. `PORT` can change the default 4317 port.

## Included

- Robots-aware, same-origin crawl with a 10/40/100/200-page limit, cancellation and local history.
- Title/description/H1/alt, duplicate metadata, canonical, noindex, short-content and fetched internal-error checks.
- Page evidence drawer, filterable findings, scanned-page incoming/outgoing connections and click depth, and text-overlap internal-link candidates.
- Manual title/description/alt drafts with current-versus-proposed review and JSON export.
- HTML report (printable as PDF) and spreadsheet-safe CSV export.
- WordPress companion plugin with explicit preview/apply, original-value checks and guarded restoration.
- NVIDIA AI Studio: keyword ideas and intent clusters, competitor suggestions and comparisons, content plans and briefs, page improvements, SEO action plans, internal-link ideas, structured-data drafts and site questions.

## NVIDIA AI Studio

1. Scan your website or open a saved scan in Overview, then open **AI Studio**.

   You can also choose any action under **Explore this website with AI** on the scan overview. The selected analysis keeps that website as its context. Open a page review and choose **Improve this page with AI** to preselect that exact page.

2. Paste your NVIDIA Build API key into the password field and click **Connect & test**. The key is held only in the local Node server's memory. It is not saved to localStorage, files, exported reports or source code, and the app never returns it through the status endpoint. The field is cleared after the connection attempt. Disconnect or restart the server to clear the connection.
3. Choose a tool, add seed topics, market, language and business context, and optionally focus on a page.
4. Check the disclosure for sending page evidence to NVIDIA, then run the analysis. Your key goes only to NVIDIA in the server's Authorization header; competitor crawling uses separate requests without it.
5. Review the report, export Markdown, or explicitly add title/description suggestions to the local Repair plan. Nothing is automatically published.

The default text model is `nvidia/nemotron-3.5-lightning-30b-a3b`. You can enter another available NVIDIA text-chat model ID before connecting. Availability, quota and charges depend on your NVIDIA account. The connection test uses a short completion. See the [NVIDIA model page](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b) and [chat-completions API documentation](https://docs.api.nvidia.com/nim/reference/meta-llama-3_1-8b-infer).

Research sends sampled metadata, headings, paragraph text, links, image URL/alt attributes, and findings for up to 20 successful own-site pages. It does not send screenshots or image pixels. For competitor comparisons, enter up to two URLs: each is crawled with robots.txt checks and a 5-page limit, then its successful page evidence is included. Without competitor URLs, the model can suggest possible domains from its knowledge; these remain explicitly unverified. Each report lists the pages used as evidence and their crawl dates.

**AI is not a live keyword database or search engine.** Keyword intent, clustering, relevance and topic gaps are hypotheses. The app has no SERP, keyword volume, difficulty, CPC, ranking, backlink feed connected to AI research. Current competitor discovery requires independent validation; the app does not present generated domains as live search results. Structured-data drafts need factual review and manual validation before installation. AI alt text is not generated because image pixels were not inspected.

Reports are saved locally under `data/ai/` and the latest 20 for a scan appear in Saved research. Generated reports and scan content may contain business information: only export them when you intend to share it. The API key is never included. Each generation can be cancelled; aborting cannot retract content already sent to NVIDIA or guarantee that provider usage is not counted. One AI request runs at a time.

Research requests use JSON output constraints. If a model still returns an invalid report, the app makes at most one additional formatting-correction request, which also uses your provider allowance. Incomplete or invalid responses never become repair drafts.

If a broad report reaches the model's output limit, select a specific page under Page focus and ask for concise results in Additional direction. A focused live keyword report was verified with the default NVIDIA model. This version does not yet connect to a locally running Ollama model.

## WordPress companion

Install the `wordpress/local-seo-repairs` folder as a plugin, or upload `local-seo-repairs.zip` from this app folder. Activate it, then go to **Tools → SEO repair plans**. Import the app's JSON plan. Review the values and explicitly confirm before applying. Stored backup batches can be restored while their applied values have not been changed by another editor.

This first plugin supports SEO-title overrides, adding missing descriptions, updating its own descriptions and media-attachment alt text. It refuses to overwrite descriptions owned by another SEO plugin. H1, internal links, body content, external images and archive URLs require manual editing. An attachment's alt text is shared across its usages. Clear page caches and verify the public HTML after applying or restoring. Plugin deactivation does not undo stored alt-text writes.

The plugin is an initial implementation. PHP syntax was checked with a parser; runtime behavior and real WordPress/theme/cache integration still require staging validation. No live WordPress site was changed during development.

## Honest boundaries

This reads server HTML; it does not run target-page JavaScript, check external-link responses, measure search demand/rankings, or predict traffic. Sitemaps are not fetched, so it cannot prove a site-wide orphan-page inventory. Link suggestions come from words in existing paragraph/list text and require editorial review. Findings cover the scanned subset. A missing metric is not a zero score.

Scans are saved as JSON under `data/`. Drafts are stored in this browser's localStorage. There is no remote sync. AI runs explicitly send selected evidence to NVIDIA. Stop the local server to stop the app. The optional fonts request public Google Fonts; system fonts work when offline.

## Verify

`npm test` covers HTML evidence, robots precedence, verified broken links, URL normalization, local HTTP crawling, connection topology, PHP syntax, NVIDIA request boundaries, report persistence, cancellation and model-output validation. NVIDIA transport is simulated in tests; a real provider response needs your key. `npm run build` type-checks the app and produces the frontend bundle.


Optional Search Console CSV/Google connection and its setup are documented in [docs/SEARCH-CONSOLE.md](docs/SEARCH-CONSOLE.md). Website audit also offers baseline/new-scan verification. New scans retain passive technology hints and a safe HTML skeleton; older scans use a labeled fallback. Per-problem AI can draft H1/title/description/image-alt suggestions, with explicit sharing consent and user-provided image context. See [docs/NEXT-IMPROVEMENTS.md](docs/NEXT-IMPROVEMENTS.md) for the three priorities, free API/repository research and implementation limits.

### Manage saved websites

Open **Saved websites** in the header or sidebar. Search all saved scans, open one, or choose **Delete scan** to move it to **Trash**. Restore it from Trash whenever needed. Each scan is managed separately, including repeated scans of one domain. Drafts, notes and research remain available after restoration; the live website is never changed. Trashing does not free disk/browser storage. Stop a running scan before deleting it. Local scans are saved on this computer; hosted scans remain in the current browser. See [Ponytail audit](docs/PONYTAIL-AUDIT.md) for the code review and remaining limits.
