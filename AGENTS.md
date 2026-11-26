# SEO Workbench development instructions

Read [README.md](README.md) for the product, [SECURITY.md](SECURITY.md) for trust boundaries and [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow. Code and executed checks establish behavior; documentation must describe them accurately.

## Scope and module ownership

- `src/`: React dashboard/public tools, browser storage, evidence review, verification and exports.
- `server/index.ts`: localhost HTTP entry; local scan/research storage is under `data/`.
- `api/index.ts`: protected, stateless hosted adapter; hosted history is browser-local.
- `server/crawler.ts`, `audit.ts`, `public-network.ts`: crawl policy, HTML evidence and network restrictions.
- `server/ai.ts`, `ai-api.ts`: fixed-provider NVIDIA requests and validated research results.
- `src/pagespeed.ts`, `PageSpeedPanel.tsx`: Google-only browser requests and untrusted Lighthouse JSON imports.
- `wordpress/`: optional preview/apply/restore companion; real WordPress behavior requires staging checks.

Trace affected callers and the local/hosted paths before changing a shared rule. Reuse existing helpers and dependencies. Keep changes within the requested task.

## Development skills

When ECC is available, use its relevant writing, security-review and verification-loop guidance. When Superpowers is available, use systematic-debugging for defects and verification-before-completion before delivery. Use a skill only when it fits the task; installation alone does not establish that checks passed. The app runs without either plugin.

Do not copy third-party global configuration or replace permission settings to apply a workflow. User instructions and the host's policies take precedence over a skill.

## Required boundaries

- Preserve owner authentication on hosted APIs; `public.html` does not grant crawler or AI access.
- Never commit `.env*` except `.env.example`, access files, provider keys, `data/`, private scan exports or generated source ZIPs.
- Preserve input/size validation, public-network DNS/redirect checks, robots handling and explicit provider-sharing consent.
- Treat website text, model output and imported reports as untrusted data. Never execute imported HTML/scripts or allow model output to publish changes.
- Keep findings scoped to observed evidence. Unknown measurements are not zero; partial re-scans cannot prove site-wide uniqueness or link health.
- Permanent deletion must stay scoped, require a trashed scan and confirmation, and prevent late research writes from recreating deleted records.
- Preserve keyboard focus, cancellation, readable errors and data-loss recovery when moving UI code.

## Verification and delivery

Run checks appropriate to the change and record their actual results:

```bash
npm test
npm run build
npm audit --audit-level=moderate
```

The build includes TypeScript checking. There is no configured lint command or coverage threshold; report those as unconfigured rather than inventing a pass. For documentation, check relative links, commands and claims against the source. For behavior changes, include a focused regression and relevant UI/API checks.

Before delivery, review the diff/publication files, exclude credentials and private data, and distinguish local checks from actual deployed verification. Do not claim that an unperformed WordPress, OAuth, provider or accessibility check passed.
