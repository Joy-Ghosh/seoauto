# Optional Search Console data

Audits, page review, technology hints, verification and NVIDIA research work without Search Console. Choose either data source under Website audit → Search Console, or skip the section.

## CSV: no API configuration

In Google Search Console, open Performance → Search results, select your property/date range, then export. Upload the ZIP directly, or import Pages.csv or Queries.csv separately. Set the same dates in the workspace first. English column names are supported. ZIP imports keep pages, queries, countries, devices and search appearance as separate dimensions; they cannot establish page-query associations. Chart and Filters files are not loaded. ZIP limits are 15 MB compressed, 12 MB expanded, 3 MB per entry and 32 entries. Extraction happens in the browser.

Up to 5,000 rows and 3 MB are accepted. Invalid and different-host page rows are excluded with a warning. One import replaces the selected website's previous dataset. Separate page/query exports cannot be joined or added together: they do not establish individual page-query associations. Data remains in this browser's localStorage and is not sent to NVIDIA. Keep your original CSV because scan backups do not include search datasets.

## Google connection: optional owner setup

1. Enable the Search Console API in your Google Cloud project. Configure the OAuth consent screen and permitted test users (or complete the Google verification required for your publishing audience).
2. Create an OAuth **Web application** client. Register exact callback URLs, for example `https://seo-workbench-ten.vercel.app/api/search-console/callback` and the localhost origin you actually run, such as `http://127.0.0.1:4317/api/search-console/callback`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as server-only environment variables. Never use a `VITE_` prefix. Hosted mode also requires the existing `APP_SECRET`/owner configuration. Redeploy after configuration.
4. Locally, launch with environment variables supplied to the process. To load your gitignored `.env.local`, use `npx tsx --env-file=.env.local server/index.ts`; its PORT controls the actual origin. `npm run dev:hosted` also loads that file and tests the hosted owner gate.
5. In the UI, choose Connect Search Console, select your Google account, and grant **webmasters.readonly** access. Then load a property, choose dates, and load search performance. No Google password belongs in the workspace.

OAuth uses state + PKCE. The short-lived state cookie alone is SameSite=Lax to receive Google's top-level callback. Owner and Google credential cookies remain HttpOnly/SameSite=Strict and Secure on Vercel. Credentials are encrypted, purpose-separated and bound to the owner session. Access expires within one hour; there are no persisted refresh tokens or background sync. Disconnect clears the browser's Google session; revoke the grant in your Google account if desired. Owner sign-out clears Google credentials too.

Results are requested as web-search query/page rows, up to 5,000 at a time. Google may omit anonymized queries and return top rows rather than all data. Metrics displayed as totals are for loaded rows, not necessarily the whole property. Average position is not a live rank. The workspace filters page rows to the selected scan's hostname.

No Google client credentials are bundled with the repository. Without them, the setup state is shown and CSV/skip continue to work. A real Google consent/data fetch requires credentials and a property the user can access; mocked protocol tests are not proof of a real account connection.

Sources: [authorization](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing), [web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [properties](https://developers.google.com/webmaster-tools/v1/sites/list), [Search Analytics query and limits](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).
