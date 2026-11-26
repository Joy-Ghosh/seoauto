# Public usage and free performance data

The hosted root dashboard is a private, single-owner workspace. Its password protects hosted crawling, the AI proxy and optional Google OAuth. It is separate from a user's NVIDIA key. Do not share the owner password as a customer-account system.

## Available now

| Option | What visitors can use | App-owner compute/API cost |
| --- | --- | --- |
| `/public.html` | PageSpeed mobile/desktop tests, optional personal Google key, Lighthouse JSON import, score/metric review and summary export | No crawler or AI function calls. Static delivery still uses the hosting provider's bandwidth allowance. |
| Download and run locally | Full crawling, internal links, issue reviews, change plans, verification and optional NVIDIA AI | Runs on the visitor's computer. Each visitor supplies any optional provider key and is responsible for their provider allowance. |
| Private hosted dashboard | Existing owner features plus the Page speed view | Uses the current Vercel project's function/hosting allowance and the owner's own session. |

The public page is a separate static entry. It does not disable or bypass owner authentication on `/api/`. No app-owner PageSpeed key is configured. Reports imported on the public page stay in that tab unless exported. Inside a scan, the latest speed summary is stored in that browser and removed with permanent scan deletion.

## Getting speed metrics without a paid API

Google's [PageSpeed Insights v5 documentation](https://developers.google.com/speed/docs/insights/v5/get-started) supports requests with or without a key. The keyless request returned HTTP 429 during this release, so keyless availability is not promised. A visitor can supply their own Google PageSpeed key; it is sent directly from their browser to Google's fixed endpoint, cleared from the form when a test starts, and never saved or sent through this app's server. Keys can be restricted to the PageSpeed API and the intended browser origin. The request sends only the origin as its cross-origin referrer, allowing those restrictions without sending the full workspace URL.

The dependable no-API-quota alternative is [Lighthouse in Chrome DevTools or its Node CLI](https://github.com/GoogleChrome/lighthouse). Run a mobile or desktop audit locally and export JSON, then import it here. The app displays Performance, Accessibility, Best practices and SEO scores when supplied, plus FCP, LCP, TBT, CLS, Speed Index and server-response measurements. It lists failing audits from the report. A missing score is not a pass or zero.

Reports from files are labelled user-supplied. Lab conditions are simulated and scores vary by machine, network and run. They are not search rankings or a measured real-user Core Web Vitals pass. Google is retiring the field-data portion of PSI; CrUX is a separate integration and is not implemented here.

## Before a full public hosted service

A public SaaS needs individual accounts, ownership checks, durable storage if cross-device history is promised, rate limits, abuse protection, per-user keys/quotas, deletion/privacy handling, and a hosting budget model. Removing the current password does not create these.

Unlimited hosted usage cannot honestly be guaranteed to cost the owner nothing. Vercel's [Hobby plan](https://vercel.com/docs/plans/hobby) is limited to personal/non-commercial use and has usage caps. Keep the existing private dashboard protected. Public static tools plus local/self-hosted full audits are the current way to avoid paying for visitors' crawler and AI compute. Hosting eligibility and usage limits still apply.

## Deletion behavior

Delete scan first shows a named confirmation. Moving to Trash is reversible. Inside Trash, Delete permanently opens a separate warning, identifies the URL/date/page count, starts focus on Keep in Trash, and requires typing DELETE. The API also requires a trashed scan and its exact identifier before removal.

Permanent deletion removes the scan and its saved research. Browser notes, drafts, research settings and speed summaries are cleaned up. Shared website caches/Search Console data are retained while another scan of that site exists. Downloaded backups, other devices, the website itself and provider-side records are outside this workspace's deletion scope. Browser storage failures are reported. Late AI responses cannot re-create reports after the scan is gone.
