# Security model

Phase one is a private, single-owner SEO workspace. It is not a public multi-user SaaS and it does not publish website changes automatically.

## Hosted access and credentials

- Hosted API routes require an encrypted owner-session cookie. Authentication is checked in the handler, including crawl, demo and AI routes. Missing owner configuration fails closed.
- Passwords are stored as salted scrypt hashes in server-only environment variables. Session cookies use AES-256-GCM, random nonces, purpose-specific authenticated data, an eight-hour expiration, HttpOnly, SameSite=Strict and Secure in Vercel.
- NVIDIA credentials are kept in a separate encrypted HttpOnly cookie bound to the exact owner-session identifier. They are not returned by status routes, included in model messages, or saved in scan files, browser localStorage, research exports, or Git.
- Logout and disconnect remove the browser credential cookies. Rotate `APP_SECRET` and redeploy to invalidate all existing owner and AI cookies. Changing only the password hash does not revoke already issued sessions.
- Vercel's existing deployment protection is retained. Production and preview should remain owner-protected. This app does not implement public registration or a distributed login rate limiter; do not remove deployment protection and offer it as a public service without further access controls.

## Network boundaries

- Hosted crawling permits public HTTP/HTTPS destinations on standard web ports. Private, loopback, link-local, metadata, carrier-grade NAT, multicast and reserved IP ranges are rejected, including IPv4-mapped IPv6 addresses and alternative numeric IPv4 forms.
- DNS answers are validated by the connection's lookup callback and passed directly to the connector; mixed public/private DNS results are rejected. Redirect destinations are checked before another request. Website requests never forward Authorization headers or browser cookies.
- Responses have size limits; robots checks, crawl delays, 200-page limits, a four-minute crawl deadline and a captured-evidence budget bound the work. Large pages are explicitly sampled. These controls do not guarantee every website will permit crawling.
- NVIDIA calls go to a fixed HTTPS endpoint with redirects disabled. Provider error bodies and credentials are not logged. AI requests have bounded input and time budgets.

## Browser data and output

- Hosted scan history and research use IndexedDB in the signed-in browser. Drafts use localStorage. Clearing site data removes this work. Back up scans before clearing it. There is no shared cloud project database in phase one.
- Scan imports use schema validation and size limits; unrecognized fields are dropped. Imports do not fetch URLs or publish changes.
- Rendered app text is escaped by React. HTML exports escape page content; CSV exports quote cells and neutralize formula-leading characters. The deployed app includes a restrictive content policy, no framing, no content sniffing and no indexing headers.
- AI content is untrusted: task-specific fields are filtered, repair fields are allowlisted, original values come from the scan, and proposed repair URLs must match the selected own-site evidence. Every draft needs human review. The model does not receive any tools that can apply changes.

## WordPress companion

The companion requires WordPress administrator/editor capabilities and nonces, validates the website and post targets, previews original values, rechecks them before writes, and retains restoration records. It refuses descriptions controlled by another SEO plugin and rejects unsupported fields. Shared media alt text affects all uses of the attachment. PHP syntax is tested, but theme/cache/WordPress runtime behavior still needs staging validation before installation on a live site.

## Limits and future work

The app has no live SERP, search-volume, keyword-difficulty, backlink or analytics feed. Competitor suggestions from model knowledge are unverified; comparisons are grounded only in fetched pages. A local Ollama model is not integrated. Phase two needs durable project storage, scoped OAuth, per-user ownership and MCP-specific authorization before exposing tools to ChatGPT.

Automated tests cover authentication, cookie tampering/isolation, cross-origin requests, DNS/range/redirect blocking, report restrictions and streaming. This is a tested implementation, not a security certification or a guarantee that all vulnerabilities have been eliminated.

## Public speed tools

`public.html` is a separate static tool entry; private hosted APIs still require the owner session. PageSpeed requests go directly from the browser to `https://www.googleapis.com`, after explicit URL-sharing consent. An optional personal Google API key is held only in component memory and cleared from the input on run. It is not stored or sent to the app server. Lighthouse imports are parsed as bounded JSON and rendered as escaped text; they never execute imported scripts.

Permanent scan deletion removes scan/research records and scoped browser work, with Trash and exact-ID confirmation guards. Shared per-site data remains while another scan uses it. Atomic scan/report browser transactions prevent late AI responses from recreating records after deletion. External backups, other browsers and provider-held data are outside this operation's scope.

## Optional browser model

Local semantic matching starts only after download consent. It uses a dedicated browser worker, a pinned model revision, at most 24 sampled pages and a bounded runtime. Download fetches omit credentials and referrers and allow only the app origin and the selected Hugging Face host families. Page text is processed on device; model hosts receive download requests. Downloaded code/model dependencies remain a supply-chain trust boundary.

The production CSP adds `wasm-unsafe-eval` for WASM compilation, `worker-src` and the Hugging Face model hosts; it does not enable JavaScript `unsafe-eval` or arbitrary API proxies. `npm start` serves the same CSP as the hosted static configuration. Errors and cancellation leave non-model matching available. Browser cache and separately exported files are outside scan deletion. Dependency audit results are not security certification.
