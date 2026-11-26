# Contributing to SEO Workbench

Help make the path from a website problem to a verified fix easier to understand. A useful contribution improves evidence, a user's next action, or the reliability of their saved work.

## Start locally

Use Node.js 22.14+ or 24.x, below version 25. CI uses Node.js 24.

```bash
git clone https://github.com/Joy-Ghosh/seoauto.git
cd seoauto
npm ci
npm run dev
```

Open `http://127.0.0.1:4317` and try **Explore a sample**. Public speed tools are at `/public.html`. The hosted development adapter uses separate owner configuration; see [HOSTED.md](HOSTED.md).

## Find the owning code

| Change | Start here |
| --- | --- |
| Audit findings, crawl rules, redirects | `server/audit.ts`, `server/crawler.ts`, `server/public-network.ts` |
| Dashboard and page review | `src/main.tsx`, `PageEvidence.tsx`, `PageSkeleton.tsx` |
| Linking and connections | `src/topology.ts`, `page-evidence.ts`, `LinkOpportunities.tsx` |
| AI research and drafts | `server/ai.ts`, `server/ai-api.ts`, `src/AiStudio.tsx`, `ProblemAssistant.tsx`, `BatchTitles.tsx` |
| Local/hosted request behavior | `server/index.ts`, `api/index.ts`, `src/client.ts` |
| Saved work and deletion | `src/local-db.ts`, `SavedWebsites.tsx`, `delete-storage.ts`, `server/scan-store.ts` |
| Performance and search data | `src/pagespeed.ts`, `PageSpeedPanel.tsx`, `SearchConsolePanel.tsx`, `server/search-console.ts` |
| Verification and exports | `src/verification.ts`, `VerificationPanel.tsx`, `exports.ts`, `ScanBackup.tsx` |

The [interactive project guide](https://seo-workbench-ten.vercel.app/project-guide.html) connects these modules to the user workflow. [AGENTS.md](AGENTS.md) provides concise instructions for coding agents.

## ECC and Superpowers

These are optional **development tools**, not app dependencies. Contributors can run the project and tests without installing them.

- [ECC](https://github.com/affaan-m/ECC): use the relevant writing, security-review and verification-loop skills. Compare documentation claims with the actual code and distinguish unavailable checks from passing checks.
- [Superpowers](https://github.com/obra/superpowers): use systematic debugging for reproducible defects and verification-before-completion before reporting success. For feature work, apply the planning/testing skills that fit its size and risk.

Install them through Codex's native plugin lifecycle. ECC currently documents:

```bash
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
```

Superpowers recommends the official Codex plugin marketplace: open **Plugins**, find **Superpowers**, and install it. Follow each repository's current instructions for other environments. Native hook/MCP trust remains managed by the host. Do not replace a contributor's global agent configuration with a repository preset.

This project's documentation pass used ECC's writing/verification guidance and Superpowers' verification-before-completion checklist. Project-specific commands and security boundaries remain in this repository, rather than copying hundreds of skills into the application.

## Make a focused change

1. Reproduce the problem or define the requested behavior. Check existing helpers and every affected caller.
2. Add a meaningful regression for non-trivial behavior. Keep provider/network transport mocked where possible; never spend someone else's API allowance in tests.
3. Implement the smallest complete fix across the local and hosted paths it affects.
4. Preserve keyboard access, visible errors, safe cancellation and saved data. A visual change needs a real UI check; a passing build is not a usability review.
5. Update the owning documentation when behavior changes. Keep README focused on users; setup, security and validation details have separate linked documents.

## Quality checks

```bash
npm test
npm run build
npm audit --audit-level=moderate
```

`npm run build` runs TypeScript and builds both frontend entries plus the WordPress plugin download. The test suite covers audit evidence, crawling, authentication, network guards, provider boundaries, storage/deletion, imports and verification. It uses mocked provider calls; it does not prove real NVIDIA/Google/WordPress integrations work in every environment.

There is no configured linter or coverage gate. Do not report a lint pass or an 80% coverage result without introducing and running an agreed check. Check Markdown links and SVG/XML syntax for documentation assets. Review the actual diff before submitting.

For a deployed change, record the exact commit and test the target URL/API separately. Local tests, a merged commit and a successful deployment are different pieces of evidence. Keep validation notes in [VALIDATION.md](VALIDATION.md), including limitations.

## Protect real work

Read [SECURITY.md](SECURITY.md) before changing authentication, fetching, uploads, provider requests or deletion. Keep credentials, `.env.local`, scan history, research exports and access files out of issues, screenshots and commits. Use disposable fixtures for destructive tests. Never change a user's live website merely to test this console.

## Submit an issue or change

For bugs, include reproducible steps, expected/actual behavior and sanitized evidence. For changes, explain the user-visible result, relevant validation and remaining limits. Do not claim search ranking improvements from an audit score or a single Lighthouse run.

The [roadmap](docs/PHASES.md) distinguishes shipped features from planned MCP/public SaaS work.
