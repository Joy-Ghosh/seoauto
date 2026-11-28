# SEO Workbench

**Turn website findings into changes you can review, apply and verify.**

Crawl a website, inspect the evidence behind each SEO issue, explore internal links, and build an exact repair plan. Add AI research or Google data when you need it. The core audit runs locally without an AI key.

[**Try the free speed tools →**](https://seo-workbench-ten.vercel.app/public.html) · [Run the full workbench locally](#run-locally) · [Explore the project map](https://seo-workbench-ten.vercel.app/project-guide.html)

[![Validate SEO Workbench](https://github.com/Joy-Ghosh/seoauto/actions/workflows/checks.yml/badge.svg)](https://github.com/Joy-Ghosh/seoauto/actions/workflows/checks.yml)

![SEO Workbench workflow illustration: scan, review, plan, apply changes in your CMS, then verify](docs/assets/workflow.svg)

## From a finding to a finished fix

A page can return HTTP 200 and still send visitors to broken destinations. SEO Workbench shows the source page, the failed links, their anchor text and the scanned response evidence. Review the problem, save a change, publish it in your CMS, then re-scan to check the result.

It is built for site owners, developers and SEO practitioners who want to understand **what is wrong, where it happens and what to change next**.

1. **Scan** — read up to 1,000 HTML pages locally or up to 200 in the time-limited hosted crawler, with progress, cancellation and robots.txt checks. These are coverage limits, not a guarantee of discovering every page.
2. **Review** — inspect findings, page metadata, an HTML skeleton and incoming/outgoing connections.
3. **Plan** — compare exact replacements, approve a draft revision and copy its implementation brief. AI suggestions are optional.
4. **Apply and verify** — publish in your website editor, report publication, then check the expected value. Matching, different and unreadable responses stay distinct. Editing the draft requires a new approval and check.

The dashboard keeps **Opportunities → Plan → Results** connected: filters stay with each scan/view, finding links reopen their evidence, and Results collects saved checks across available scans of the website. [Phase 1 delivery and limits](docs/reviews/2026-11-27/PHASE-1-DELIVERY.md).

## What you can do

| Workflow | What you get |
| --- | --- |
| **Website audit** | Response errors, broken internal destinations, missing headings, title/description checks, duplicate metadata, missing image alt attributes, canonical and robots evidence. Filter by page, priority or problem type. |
| **Page review** | The original page values, explanations, practical fix steps, review notes and a safe HTML skeleton showing where content and problems appear. |
| **Internal linking** | Searchable donor/source and receiver/destination pages, observed anchors, incoming/outgoing connections, scanned click depth and text-based linking opportunities. |
| **Technology detection** | Evidence-backed hints for WordPress, Shopify, Next.js and other technologies. Saved evidence is dated; hidden or unreachable technology stays unconfirmed. |
| **AI Studio** | Nine NVIDIA-powered tools for keyword ideas, competitor comparisons, content planning, page improvements, priorities, briefs, links, schema drafts and site questions. Uses your own key. |
| **Problem-specific drafts** | Generate suggestions for titles, H1s, descriptions and image alt text. Alt suggestions require your image description; the text model does not inspect image pixels. |
| **Bulk title planning** | Filter pages by category or problem, select up to ten, generate suggestions, edit them, check duplicates and save only approved drafts. |
| **Change verification** | Re-scan a page or compare scans. Check expected title/description/alt values and distinguish still-present findings from checks that lack enough coverage. |
| **Page speed** | Mobile/desktop PageSpeed requests, optional personal Google key, Lighthouse JSON import, lab scores, timing metrics and failing-audit recommendations. |
| **Search Console** | Import an English CSV, optionally connect Google with read-only access, or skip it. View actual supplied search-performance data separately from AI ideas. |
| **Saved work** | Scan history, reviewable change plans, research reports, HTML/CSV/Markdown/JSON exports, scan backups, recoverable Trash and confirmed permanent deletion. |

## Choose how to use it

| Option | Best for | Access and processing |
| --- | --- | --- |
| [**Public tools**](https://seo-workbench-ten.vercel.app/public.html) | A quick speed check or an existing Lighthouse report | No workspace password. Google requests run directly from your browser. Imported reports stay in the tab unless exported. |
| **Local workbench** | The complete crawl → review → plan → verify workflow | Runs on your computer at `127.0.0.1:4317`. No AI key needed for the audit. |
| [**Hosted owner workspace**](https://seo-workbench-ten.vercel.app) | The project owner's private dashboard | Requires the owner password. History stays in the current browser; this is not a public multi-user SaaS. |

The public tools do not use an app-owner PageSpeed key or run the hosted crawler. Google quotas and hosting limits still apply. For the full workflow without using the owner's crawler/AI compute, run the project locally and use your own optional provider keys. See [public usage and cost boundaries](docs/PUBLIC-USAGE.md).

## Run locally

Use **Node.js 22.14+ or 24.x**, below version 25, with npm. Node.js 24 is used by CI and the hosted project.

```bash
git clone https://github.com/Joy-Ghosh/seoauto.git
cd seoauto
npm ci
npm run dev
```

Open **[http://127.0.0.1:4317](http://127.0.0.1:4317)**. Enter a website or choose **Explore a sample** to try the deliberately imperfect local fixture. The local server binds to your computer only.

For a production frontend build:

```bash
npm run build
npm start
```

Set `PORT` if `4317` is already in use. For the private hosted adapter, owner credentials and deployment instructions, follow [HOSTED.md](HOSTED.md). Keep `.env.local` and the private access file out of Git.

## Optional local meaning matches

In **Opportunities → Connections & links**, open **Optional: find connections by meaning**, allow the download, then choose **Match pages by meaning**. Transformers.js compares a sample of up to 24 pages in a browser worker without an inference API key. Review the donor paragraph, receiver and exact anchor (or rewrite-needed notice) before editing your website. Text matching remains available.

First use downloads model/runtime files and uses your device memory and bandwidth. This English-focused feature proposes connections; it does not measure SEO impact or generate titles. [First-use changes, Pip and validation](docs/reviews/2026-11-27/FIRST-USE-AND-PIP.md) · [Licenses and runtime preparation](THIRD-PARTY.md).

## Optional AI: your evidence, your key

Open **Tools → AI tools**, connect your NVIDIA Build key, choose a task and review the disclosure before running it. Focus on a single page for precise drafts, or supply up to two competitor URLs for a comparison grounded in crawled pages.

- The core crawler and manual change plan work without AI.
- The local server holds the key in memory until disconnect/restart. The hosted adapter uses an encrypted, HttpOnly credential cookie bound to the owner session.
- Selected page evidence is sent to NVIDIA only when you run AI. Keys are not included in research messages, scan files or exports.
- Provider availability, quota and charges belong to your NVIDIA account. A connection test uses a short completion; invalid report formatting can trigger one correction request.
- AI keyword ideas and competitor suggestions are hypotheses. The app does not invent search volume, rankings, backlinks or measured demand. Supplied competitor pages give evidence for the sampled comparison.

The default model is `nvidia/nemotron-3.5-lightning-30b-a3b`. A local Ollama integration is not included.

## Speed metrics without a paid SEO subscription

Open **Page speed** inside a scan, or use the [public tools](https://seo-workbench-ten.vercel.app/public.html).

**Google PageSpeed:** choose a URL and mobile/desktop strategy, then consent to sending that URL to Google. Keyless requests may hit quota limits. You can optionally use your own Google PageSpeed key, held only in the form's memory and cleared when a test starts.

**Lighthouse import:** in Chrome DevTools, open **Lighthouse**, analyze the page and export JSON. Import that file here to review the scores, FCP, LCP, TBT, CLS, Speed Index and available recommendations without an API key. You can also import/export this app's speed summaries.

Lab scores vary between runs. They are separate from search rankings and real-user Core Web Vitals. Missing measurements are shown as missing. [Read the performance-data guide](docs/PUBLIC-USAGE.md#getting-speed-metrics-without-a-paid-api).

## Publish changes with control

The audit does not publish changes automatically. Open **Plan** to review the baseline and replacement, approve the exact revision, and copy an implementation brief for your CMS or coding agent. After publishing in your editor, choose **I’ve published this change**, then **Check published page**. Results return to the original baseline plan; editing a replacement clears its approval and check state. [Read the workflow and current boundaries](docs/ux/10-workflow-implementation.md).

The optional [WordPress companion](wordpress/local-seo-repairs/local-seo-repairs.php) supports preview, explicit apply and guarded restoration for title overrides, supported descriptions and attachment-alt fields. The build creates the plugin ZIP for the hosted download. H1, body content, links, archives and descriptions controlled by another SEO plugin require manual editing. Shared attachment alt text affects every use of that image.

WordPress syntax and guards are tested; real theme/cache/plugin behavior still requires **staging validation before live use**.

## Your data and the product's limits

- **Local:** scans and research are JSON files under `data/`; drafts and review notes use browser storage.
- **Hosted:** scans and research use browser IndexedDB; drafts and notes use localStorage. There is no shared cloud history or cross-device sync. Export backups before clearing browser data.
- **Deletion:** moving to Trash is reversible. Permanent deletion requires a separate named confirmation and typed `DELETE`. It removes workspace scan/research records and associated browser work. Other scans, exported backups, other devices and the live website have separate scopes.
- **Coverage:** the audit reads response HTML. It does not execute the target site's JavaScript, check every external destination or prove that every website page was discovered. Sitemaps are not crawled.
- **Evidence:** links and findings cover the scanned subset. An unscanned destination is unknown; absence from a small re-scan is not proof that a site-wide issue is fixed.
- **Phase two:** a ChatGPT MCP connection and a full public multi-user service are planned, not shipped.

See [SECURITY.md](SECURITY.md) for credential handling, network restrictions, imports and output protections.

## Built with

React 19 · TypeScript · Vite · Node.js · htmlparser2 · Zod · IndexedDB · optional NVIDIA and Google APIs.

The application has two frontend entries (`index.html` and `public.html`), a localhost Node server and a protected stateless hosted adapter. [Explore the interactive project map](https://seo-workbench-ten.vercel.app/project-guide.html).

## Contribute and follow the project

Found a confusing flow or a reproducible bug? [Open an issue](https://github.com/Joy-Ghosh/seoauto/issues) with the steps, expected behavior, actual result and sanitized evidence. If this workflow is useful to you, star the repository so you can find it again.

Start with [CONTRIBUTING.md](CONTRIBUTING.md) for setup, module ownership, tests and the ECC/Superpowers development workflow. Never include API keys, passwords or private scan exports in an issue.

| Documentation | Purpose |
| --- | --- |
| [Hosted setup](HOSTED.md) | Owner access, Vercel and the hosted adapter |
| [Public usage](docs/PUBLIC-USAGE.md) | Password-free tools, local use, cost and data boundaries |
| [Search Console setup](docs/SEARCH-CONSOLE.md) | CSV import and optional Google OAuth |
| [Security model](SECURITY.md) | Credentials, network guards and data handling |
| [Validation record](VALIDATION.md) | Executed checks and remaining test limitations |
| [Roadmap and phases](docs/PHASES.md) | Current scope and future MCP work |
