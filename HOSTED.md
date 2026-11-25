# Private hosted workspace

Phase one supports a private owner workspace on Vercel. It does not require a database. It keeps the original localhost mode available too.

## Included

- Public-website crawls with streamed progress, cancellation, a page limit and saved evidence.
- Rule-based findings, deduplicated redirect aliases, page connections and text-overlap link candidates.
- Nine task-specific NVIDIA research options on each scan and page-focused title/description drafts.
- Owner sign-in, session-isolated encrypted AI credentials, public-network-only crawling and bounded requests.
- Browser-local history, scan backup/import, HTML/CSV reports, Markdown research and JSON repair plans.
- A companion WordPress plugin ZIP generated from reviewed source during the build.

## Configure owner access

Requires Node.js 22.14 or later; the Vercel project uses Node.js 24.

```powershell
npm ci
npm run setup:hosted
```

Setup creates `.env.local` and a private `../seo-workbench-access.txt` file. The password is not printed. The setup script refuses to overwrite an existing `.env.local`. Keep both files out of Git and do not paste their values into chat.

Set `APP_SECRET` and `APP_PASSWORD_HASH` as **server-only protected environment variables** for the Vercel project, in production and preview. Use the values from `.env.local` through the Vercel dashboard or authenticated CLI; do not prefix them with `VITE_`. The live app fails closed when either is missing. The NVIDIA key is entered separately in AI Studio after owner sign-in.

Retain Vercel deployment protection. Phase one is intended for the owner, not public registration or multiple customers. Rotate `APP_SECRET` and redeploy to invalidate all existing sessions. The separate workspace password can be replaced by generating a new scrypt hash; changing just the password does not invalidate existing cookies.

## Run the hosted adapter locally

After configuration:

```powershell
npm run build
npm run dev:hosted
```

Open `http://127.0.0.1:4318` and use the password in the private access file. This uses the same handler as the Vercel deployment, with localhost-only binding and non-Secure development cookies. Vercel uses Secure cookies automatically.

## Publish

Use a private GitHub repository. The `.gitignore` and `.vercelignore` exclude scan data, credentials, local environment files, dependency folders and generated archives. The GitHub checks run tests, the production build and a dependency audit. GitHub Actions are pinned to verified publisher commit hashes.

The Vercel build runs `npm run build`, serves `dist`, and routes `/api/*` to the stateless Node handler. Function duration is capped at 300 seconds. No local data folder, environment file, access-password file or provider key belongs in a deployment upload.

## Use the app

1. Sign in, then scan a public website. HTTP/HTTPS and standard web ports are supported. Private IPs, metadata endpoints and redirects into private networks are blocked.
2. Choose an action under **Explore this website with AI**, or open a page and choose **Improve this page with AI**.
3. Connect your NVIDIA key, choose a target market/language/topic, review the disclosure and run the analysis.
4. Review observations and suggestions. Add title/description drafts to Repair plan only when appropriate; exports never publish them automatically.
5. Export a scan backup before clearing browser storage. A backup can be imported into the hosted workspace to move a local scan to it. Existing scan IDs are preserved without overwriting an existing imported scan.

History and research are stored in this browser's IndexedDB. Drafts use localStorage. There is no cross-device cloud sync. AI credentials use encrypted HttpOnly cookies, are tied to the exact owner sign-in, expire after at most eight hours, and are removed from the browser by disconnect/sign-out. They are never included in exports.

## AI capabilities and limits

The default model is `nvidia/nemotron-3.5-lightning-30b-a3b`; other available NVIDIA text-chat model IDs may be entered. Model access, rate limits and allowance depend on the NVIDIA account. The app has no local Ollama integration yet.

Research uses sampled page text and findings, constrained JSON, task-specific result fields, provenance and a bounded formatting-correction request. An additional correction request uses the provider allowance too. Default Nemotron research has a larger output budget and disables optional reasoning to leave room for the actual report. A focused page and a concise direction can still be useful for large sites.

Keyword ideas, intent and topic clusters are inferences. There is no live keyword-volume, difficulty, CPC, SERP, backlink or Search Console feed. Possible competitor domains are unverified model suggestions. Supplying competitor URLs enables a comparison of up to three fetched pages per competitor (two competitors maximum). No search ranking, traffic uplift or rich-result eligibility is guaranteed.

The crawler reads response HTML, not target-page JavaScript. It does not fetch sitemaps or prove site-wide orphan-page inventory. Hosted scans stop after four minutes or the captured-evidence budget, preserving partial results. Large pages are explicitly sampled at up to 1,000 links, 100 images and 100 paragraph blocks. Individual responses have size limits.

## WordPress

Download the companion ZIP from Repair plan. Install it manually on a staging WordPress site first, then import and preview the exported JSON plan under Tools → SEO repair plans. Original-value and permission checks guard writes; backups support guarded restoration. Titles, descriptions and shared media alt text are supported. H1s, body content, links, archives and external images require manual editing. Live WordPress/theme/cache integration has not been validated.

See [SECURITY.md](SECURITY.md) for the access and network model, and [docs/PHASES.md](docs/PHASES.md) for the deferred ChatGPT MCP work.
