# Three priorities and useful public tools

## 1. Measured opportunities

Implemented: optional Search Console CSV import and a read-only Google OAuth/API path. Compare queries/pages by impressions, CTR and average position, keeping loaded-row metrics separate from AI ideas. Google OAuth needs the owner's server-side client configuration; CSV does not.

Next useful addition: PageSpeed Insights or local Lighthouse runs to add measured performance/accessibility evidence. The [PageSpeed API](https://developers.google.com/speed/docs/insights/v5/get-started) can be called without a key for limited use; Google recommends a key for automated use. Treat quotas as service constraints, not unlimited free capacity. Google plans to remove CrUX field data from that API, so use the separate CrUX API if field history is needed. This integration is researched, not installed here.

## 2. Verify published changes

Implemented: compare an older baseline with a newer saved scan, inspect unchanged/new/no-longer-observed findings, compare metadata, and check expected saved title/description/alt drafts. Unreadable and uncovered URLs remain unverified. Publishing and ranking improvement are not inferred from a changed browser work note.

Next useful addition: an owned staging-site WordPress apply/restore exercise and persistent deployment/change records. [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) provides automated audits under [Apache 2.0](https://github.com/GoogleChrome/lighthouse/blob/main/LICENSE). It is better run as a local/queued worker than inside every Vercel request. No Lighthouse runner is added yet.

## 3. Evidence beside every proposed fix

Implemented: problem-specific NVIDIA generation for H1, title, description, user-described image alt text and general fixes; ordered response-HTML skeletons on new scans, a labeled fallback for older scans, per-page donor/receiver link exploration and exact text-match anchor opportunities. Passive technology hints cover common WordPress, Shopify, Next.js, PHP/Laravel and other markers; missing/spoofable signals prevent certainty about hidden backends.

For broader technology coverage, [projectdiscovery/wappalyzergo](https://github.com/projectdiscovery/wappalyzergo) is a Go library with an MIT code license and a large fingerprint database. Its README names the upstream fingerprint sources; review the applicable data licenses before importing a database. This project currently uses its own small passive rule set, not that repository's code/data. A separate Go worker would be an optional architecture change, not a JavaScript drop-in.

These are the three practical priorities: measured data → verified changes → actionable, inspectable fixes. Durable authenticated project storage remains the prerequisite for the later ChatGPT MCP phase. No MCP endpoint is present yet.
